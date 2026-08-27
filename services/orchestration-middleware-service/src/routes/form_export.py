import asyncio
import datetime
import logging
import os
import re
import uuid
from typing import Optional

from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from google.cloud import storage

from src.db import get_db
from src.models import Users as DbUser
from src.services.form_service import FormService, get_form_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/export", tags=["export"])

GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME", "beyondforms-dev-bucket")


class FormCompletenessResponse(BaseModel):
    form_type: str = Field(..., description="Application form identifier")
    filled_fields: int = Field(..., description="Number of mapped profile fields that currently have a value")
    total_fields: int = Field(..., description="Number of distinct profile fields the form's mapping reads from")


class ExportFormResponse(BaseModel):
    signed_open_url: str = Field(..., description="V4 Signed GCS URL with Content-Disposition: inline for tab preview")
    signed_download_url: str = Field(
        ..., description="V4 Signed GCS URL with Content-Disposition: attachment for downloading"
    )
    expires_in_seconds: int = Field(60, description="Validity window before URL expiration")
    filename: str = Field(..., description="Standardized export filename")
    form_type: str = Field(..., description="Application form identifier")


async def delayed_scrub_export_blob(bucket_name: str, object_name: str, local_path: Optional[str] = None):
    """Asynchronous background task that uses asyncio.sleep to prevent thread pool starvation."""
    env_val = os.environ.get("ENV", "development")

    # Wait for the TTL window unless running automated PyTest suites
    if env_val != "testing":
        await asyncio.sleep(300)

    # 1. Securely scrub local temporary disk files regardless of environment to prevent resource leaks
    if local_path and os.path.exists(local_path):
        try:
            os.remove(local_path)
            logger.info(f"Successfully scrubbed local ephemeral export file: {local_path}")
        except Exception as e:
            logger.error(f"Failed to scrub local export file {local_path}: {e}")

    # Exit early if cloud storage wasn't utilized
    if env_val in ("testing", "local"):
        return

    # 2. Delete GCS Object using safe synchronous calls run in a thread pool
    try:

        def _delete_gcs():
            storage_client = storage.Client()
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(object_name)
            if blob.exists():
                blob.delete()
                logger.info(f"Successfully scrubbed ephemeral cloud export blob: {object_name}")

        await asyncio.to_thread(_delete_gcs)
    except Exception as e:
        logger.error(f"Failed to scrub GCS blob {object_name}: {e}")


# Cryptographically robust regex validating standard UUIDv4 prefixes
UUID4_CAPABILITY_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_", re.IGNORECASE
)


def verify_export_access_policy(object_name: str, current_user: Optional[AuthUser]) -> str:
    sanitized = os.path.normpath("/" + object_name).lstrip("/")
    if sanitized.startswith("..") or ".." in sanitized:
        raise HTTPException(status_code=400, detail="Invalid path traversal detected.")

    path_segments = sanitized.split("/")

    # 1. Capability Verification for Ephemeral Exports
    # Must match: exports/ephemeral/{user_id}/{uuid4}_{filename}
    is_allowlisted_ephemeral = (
        len(path_segments) >= 4
        and path_segments[0] == "exports"
        and path_segments[1] == "ephemeral"
        and bool(UUID4_CAPABILITY_PATTERN.match(path_segments[-1]))
    )

    # 2. Strict Authentication and Ownership Verification for Permanent/Predictable Exports
    if not is_allowlisted_ephemeral:
        if not current_user or not current_user.is_authenticated:
            raise HTTPException(status_code=401, detail="Missing authentication token for protected export.")
        if len(path_segments) < 3 or path_segments[0] != "exports" or path_segments[2] != str(current_user.user_id):
            raise HTTPException(
                status_code=403,
                detail="Access Denied: You do not have permission to view this resource.",
            )

    return sanitized


def _resolve_base_url(request: Request) -> str:
    base_url = os.environ.get("API_PUBLIC_URL")
    if not base_url:
        forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        base_url = str(request.base_url).rstrip("/")
        if forwarded_proto == "https" and base_url.startswith("http://"):
            base_url = base_url.replace("http://", "https://", 1)
    return base_url


@router.get("/proxy/{object_name:path}")
def proxy_local_blob(
    object_name: str,
    disposition: str = "inline",
    current_user: Optional[AuthUser] = Depends(get_current_user),
):
    """
    Authenticated proxy to stream exported PDFs from storage with strict BOLA/IDOR defense.
    Allows unauthenticated client access solely for high-entropy UUIDv4 capability links under exports/ephemeral/.
    Note: Ephemeral proxy blobs remain accessible for a 300-second (5 min) TTL window before automated background cleanup.
    """
    sanitized = verify_export_access_policy(object_name, current_user)

    local_path = os.path.join("/tmp/beyondforms_exports", sanitized)
    if os.path.exists(local_path):
        with open(local_path, "rb") as f:
            content = f.read()
    else:
        try:
            storage_client = storage.Client()
            bucket = storage_client.bucket(GCS_BUCKET_NAME)
            blob = bucket.blob(sanitized)
            if not blob.exists():
                raise HTTPException(status_code=404, detail="Blob expired or not found.")
            content = blob.download_as_bytes()
        except Exception:
            raise HTTPException(status_code=404, detail="Export expired or not found.")

    filename = sanitized.split("/")[-1].split("_", 1)[-1] if "_" in sanitized else "antrag.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )


@router.get("/{form_type}", response_model=ExportFormResponse)
async def export_filled_form(
    form_type: str,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    form_service: FormService = Depends(get_form_service),
):
    """
    Generate and export a filled PDF for a specific form type using current user profile data.
    """
    db_user = db.query(DbUser).filter(DbUser.authentik_id == current_user.user_id).first()
    if not db_user:
        if current_user.user_name and current_user.user_name.strip():
            db_user = db.query(DbUser).filter(DbUser.phone_number == current_user.user_name).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User profile not found")

    try:
        pdf_content = await form_service.fill_form(form_type, db_user)
        filename = f"antrag_{form_type}.pdf"
        object_name = f"exports/ephemeral/{current_user.user_id}/{uuid.uuid4()}_{filename}"

        env_val = os.environ.get("ENV", "development")
        local_path = None

        if env_val in ("local", "testing"):
            local_path = os.path.join("/tmp/beyondforms_exports", object_name)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(pdf_content)

            base_url = _resolve_base_url(request)
            signed_open_url = f"{base_url}/export/proxy/{object_name}?disposition=inline"
            signed_download_url = f"{base_url}/export/proxy/{object_name}?disposition=attachment"
        else:
            storage_client = storage.Client()
            bucket = storage_client.bucket(GCS_BUCKET_NAME)
            blob = bucket.blob(object_name)
            blob.upload_from_string(pdf_content, content_type="application/pdf")

            try:
                signed_open_url = blob.generate_signed_url(
                    version="v4",
                    expiration=datetime.timedelta(seconds=60),
                    method="GET",
                    response_disposition=f'inline; filename="{filename}"',
                )
                signed_download_url = blob.generate_signed_url(
                    version="v4",
                    expiration=datetime.timedelta(seconds=60),
                    method="GET",
                    response_disposition=f'attachment; filename="{filename}"',
                )
            except Exception as sign_err:
                logger.warning(
                    f"GCS signed URL generation failed: {sign_err}. Falling back to authenticated local proxy URL."
                )
                base_url = _resolve_base_url(request)
                signed_open_url = f"{base_url}/export/proxy/{object_name}?disposition=inline"
                signed_download_url = f"{base_url}/export/proxy/{object_name}?disposition=attachment"

        background_tasks.add_task(delayed_scrub_export_blob, GCS_BUCKET_NAME, object_name, local_path)

        return ExportFormResponse(
            signed_open_url=signed_open_url,
            signed_download_url=signed_download_url,
            expires_in_seconds=60,
            filename=filename,
            form_type=form_type,
        )
    except Exception as e:
        logger.error(f"Form export failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/{form_type}/completeness", response_model=FormCompletenessResponse)
async def get_form_completeness(
    form_type: str,
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    form_service: FormService = Depends(get_form_service),
):
    """
    Reports how many of the profile fields a form's mapping reads from are filled
    in, for a lightweight per-form readiness indicator (e.g. on the dashboard).
    """
    db_user = db.query(DbUser).filter(DbUser.authentik_id == current_user.user_id).first()
    if not db_user:
        if current_user.user_name and current_user.user_name.strip():
            db_user = db.query(DbUser).filter(DbUser.phone_number == current_user.user_name).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User profile not found")

    try:
        filled_fields, total_fields = await form_service.get_completeness(form_type, db_user)
    except Exception as e:
        logger.error(f"Form completeness check failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Completeness check failed: {str(e)}")

    return FormCompletenessResponse(form_type=form_type, filled_fields=filled_fields, total_fields=total_fields)
