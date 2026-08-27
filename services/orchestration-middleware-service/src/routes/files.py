import asyncio
import datetime
import decimal
import logging
import os
import google.auth.exceptions
import re
import uuid
import requests
import io
from typing import Any, List, Optional
from unittest.mock import MagicMock
import mimetypes
from PIL import Image, ImageOps
import pillow_heif
from starlette.datastructures import Headers
from beyondforms.auth import User as AuthUser
from beyondforms.auth import require_authenticated_user
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from google.cloud import storage, exceptions as gcloud_exceptions
from src.constants import SLOT_ID_TO_DIS_TYPE
from src.db import SessionLocal, get_db
from src.models import DocumentStatusType, UploadedFiles, UserApplications, UserDocuments, Users
from src.services.pubsub_service import publish_document_event
from src.services.user_service import UserService, get_user_service
from src.services.berlin_districts import sync_berlin_district
from src.tasks.cleanup import run_background_gcs_cleanup
from src.utils import get_google_id_token

# Register HEIF opener for Pillow to support HEIC files natively
pillow_heif.register_heif_opener()

logger = logging.getLogger(__name__)


router = APIRouter(tags=["files"])

# Configure GCS Bucket
GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME", "beyondforms-dev-bucket")


class LazyStorageClient:
    """
    High-performance lazy proxy for Google Cloud Storage.
    Defers expensive credential resolution and network client initialization until storage methods/attributes are explicitly invoked.
    Completely prevents CI/CD crashes in FastAPI dependency resolution when cloud credentials are unconfigured.
    """

    def __init__(self):
        self._client: Optional[storage.Client] = None

    @property
    def client(self) -> storage.Client:
        if self._client is None:
            try:
                self._client = storage.Client()
            except google.auth.exceptions.DefaultCredentialsError:
                self._client = MagicMock()
        return self._client

    def __getattr__(self, name: str):
        return getattr(self.client, name)


def get_storage_client() -> LazyStorageClient:
    return LazyStorageClient()


# --- Pydantic Schemas ---
class UploadedFileResponse(BaseModel):
    name: str
    id: Optional[str] = None
    object_name: Optional[str] = None
    document_id: Optional[str] = None
    error_message: Optional[str] = None
    status: Optional[str] = None


class UserDocumentResponse(BaseModel):
    document_id: str
    fk_user_id: str
    fk_application_id: str
    document_type: str
    object_name: str
    status: str
    upload_date: Optional[str] = None
    updated_at: Optional[str] = None


# --- Helper functions ---
def validate_file_type(file: UploadFile):
    ALLOWED_FILE_EXTENSIONS = {"jpeg", "jpg", "bmp", "png", "pdf", "heic", "heif"}
    _, ext = os.path.splitext(file.filename)
    file_ext = ext.lstrip(".").lower()
    if file_ext not in ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=400, detail="Invalid file type. Allowed types: jpeg, jpg, bmp, png, pdf, heic, heif"
        )


def get_file_size(file: UploadFile) -> int:
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)
    return file_size


def validate_file_size(file_size: int) -> None:
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 20MB.")


def upload_file_to_gcs(file: UploadFile, storage_client):
    try:
        bucket = storage_client.bucket(GCS_BUCKET_NAME)
        sanitized_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", file.filename)
        unique_filename = f"{uuid.uuid4()}_{sanitized_name}"
        blob = bucket.blob(unique_filename)
        blob.upload_from_file(file.file, content_type=file.content_type)
        return unique_filename
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to GCS: {str(e)}")


def save_file_to_database(
    file: UploadFile,
    db: Session,
    unique_filename: str,
    user_service: UserService,
    internal_user_id: str,
    document_type: Optional[str],
):
    new_uploaded_file = UploadedFiles(name=file.filename, bucket_name=GCS_BUCKET_NAME, object_name=unique_filename)
    db.add(new_uploaded_file)
    db.flush()

    # Profile-document uploads hang off the Grundsicherung application — the
    # form the documents flow is built around. Other form_types are created
    # explicitly (seed, or a future per-form start).
    _, application_id = user_service.get_or_create_user_application(
        internal_user_id, form_type="antrag_grundsicherung"
    )

    new_doc = UserDocuments(
        document_id=uuid.uuid4(),
        fk_user_id=internal_user_id,
        fk_application_id=application_id,
        fk_file_id=new_uploaded_file.id,
        document_type=document_type if document_type else "tbd",
        status=DocumentStatusType.PROCESSING,
        confidence_score=0,
    )
    db.add(new_doc)
    return new_uploaded_file, new_doc


def publish_document_event_to_pubsub(
    new_doc: UserDocuments, unique_filename: str, background_tasks: Optional[BackgroundTasks]
):
    if background_tasks:
        gcs_uri = f"gs://{GCS_BUCKET_NAME}/{unique_filename}"
        background_tasks.add_task(publish_document_event, new_doc.document_id, gcs_uri)
    else:
        # Fallback for synchronous test environments
        gcs_uri = f"gs://{GCS_BUCKET_NAME}/{unique_filename}"
        publish_document_event(new_doc.document_id, gcs_uri)


def _upload_file_impl(
    file: UploadFile,
    document_type: Optional[str],
    db: Session,
    current_user: AuthUser,
    user_service: UserService,
    storage_client: storage.Client,
    background_tasks: Optional[BackgroundTasks] = None,
):
    internal_user_id = user_service.get_internal_user_id(current_user.user_name)
    file_size = get_file_size(file)
    validate_file_size(file_size)
    validate_file_type(file)
    unique_filename = upload_file_to_gcs(file, storage_client)
    publish_error = None
    try:
        new_uploaded_file, new_user_document = save_file_to_database(
            file, db, unique_filename, user_service, internal_user_id, document_type
        )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Database error during file save: {str(e)}", exc_info=True)
        # Clean up GCS blob if database transaction fails before commit
        try:
            bucket = storage_client.bucket(GCS_BUCKET_NAME)
            blob = bucket.blob(unique_filename)
            blob.delete()
        except Exception as cleanup_err:
            logger.error(f"Failed to clean up GCS blob after rollback: {cleanup_err}")

        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while saving file information. Please try again later.",
        )

    try:
        publish_document_event_to_pubsub(new_user_document, unique_filename, background_tasks)
    except Exception as e:
        logger.error(f"Failed to publish document event for {new_user_document.document_id}: {e}")
        new_user_document.status = DocumentStatusType.FAILED
        new_user_document.user_error_code = "PUBLISH_FAILED"
        new_user_document.internal_error_log = f"Failed to publish Pub/Sub event: {str(e)}"
        db.commit()
        publish_error = e

    if publish_error:
        raise HTTPException(status_code=500, detail="Failed to queue document for processing. Please try again.")

    return {
        "id": str(new_uploaded_file.id),
        "name": new_uploaded_file.name,
        "object_name": new_uploaded_file.object_name,
        "document_id": str(new_user_document.document_id),
        "status": "success",
    }


async def upload_one_file_async(file: UploadFile, document_type: Optional[str], current_user: AuthUser):
    db = SessionLocal()
    try:
        user_service = UserService(db)
        storage_client = get_storage_client()
        return await asyncio.to_thread(
            _upload_file_impl, file, document_type, db, current_user, user_service, storage_client
        )
    finally:
        db.close()


def has_active_application(db: Session, current_user: AuthUser, user_service: UserService):
    internal_user_id = user_service.get_internal_user_id(current_user.user_name)
    application = db.query(UserApplications).filter(UserApplications.fk_user_id == internal_user_id).first()
    return application is not None


# --- Routes ---


@router.post("/upload", response_model=UploadedFileResponse)
def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    user_service: UserService = Depends(get_user_service),
    storage_client: storage.Client = Depends(get_storage_client),
):
    """
    Upload file to Google Cloud Storage, link to it in the database and trigger extraction using the Document Intelligence Service
    """
    file_size = get_file_size(file)
    validate_file_size(file_size)
    return _upload_file_impl(file, document_type, db, current_user, user_service, storage_client, background_tasks)


@router.post("/upload-stitched", response_model=UploadedFileResponse)
def upload_stitched_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    document_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    user_service: UserService = Depends(get_user_service),
    storage_client: storage.Client = Depends(get_storage_client),
):
    """
    Stitch multiple images vertically into a single image, upload to GCS, and process as a single document.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    total_size = 0

    for file in files:
        if file.content_type == "application/pdf" or file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="PDFs cannot be stitched. Please upload them individually.")
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type for stitching: {file.content_type}. Only images are allowed.",
            )
        file_size = get_file_size(file)
        total_size += file_size
    validate_file_size(total_size)

    try:
        images = []
        for file in files:
            file.file.seek(0)
            img = Image.open(io.BytesIO(file.file.read()))
            img = ImageOps.exif_transpose(img)
            # Convert to RGB to ensure compatibility and white background if RGBA
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                bg.paste(img, mask=img.split()[3])  # 3 is the alpha channel
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")
            images.append(img)

        if not images:
            raise HTTPException(status_code=400, detail="No valid images found for stitching.")

        MAX_WIDTH = 1200
        original_widths = [img.width for img in images]
        TARGET_WIDTH = min(max(original_widths), MAX_WIDTH)

        normalized_images = []
        for img in images:
            if img.width != TARGET_WIDTH:
                new_height = int(TARGET_WIDTH * img.height / img.width)
                img = img.resize((TARGET_WIDTH, new_height), Image.Resampling.LANCZOS)
            normalized_images.append(img)
        images = normalized_images

        # Calculate dimensions for the stitched image
        _widths, heights = zip(*(i.size for i in images))
        max_width = TARGET_WIDTH
        total_height = sum(heights)

        # Create a new blank image
        stitched_image = Image.new("RGB", (max_width, total_height), color=(255, 255, 255))

        # Paste images vertically
        y_offset = 0
        for img in images:
            x_offset = (max_width - img.width) // 2
            stitched_image.paste(img, (x_offset, y_offset))
            y_offset += img.height

        # Save to buffer
        img_byte_arr = io.BytesIO()
        stitched_image.save(img_byte_arr, format="JPEG", quality=85)
        img_byte_arr.seek(0)
        img_size = len(img_byte_arr.getvalue())

        stitched_filename = f"stitched_{uuid.uuid4().hex[:8]}.jpg"

        stitched_upload_file = UploadFile(
            file=img_byte_arr,
            size=img_size,
            filename=stitched_filename,
            headers=Headers({"content-type": "image/jpeg"}),
        )

        return _upload_file_impl(
            stitched_upload_file, document_type, db, current_user, user_service, storage_client, background_tasks
        )

    except Exception as e:
        logger.error(f"Error stitching images: {str(e)}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail="Failed to process and stitch images.")


@router.post("/bulk-upload", response_model=List[UploadedFileResponse])
async def bulk_upload_files(
    files: List[UploadFile] = File(...),
    document_types: List[str] = Form(...),
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
):
    """
    Bulk upload files in parallel and asynchronously to Google Cloud Storage, link to it in the database and trigger extraction using the Document Intelligence Service
    """
    if len(files) != len(document_types):
        raise HTTPException(status_code=400, detail="Number of files and document types must match")

    # check for active application to prevent race condition for new users
    if not has_active_application(db, current_user, user_service):
        raise HTTPException(
            status_code=400,
            detail="User needs to start an application in order to upload multiple files to prevent a race condition",
        )

    results = await asyncio.gather(
        *[upload_one_file_async(f, dt, current_user) for f, dt in zip(files, document_types)],
        return_exceptions=True,
    )

    responses = []
    for file, result in zip(files, results):
        if isinstance(result, Exception):
            detail = result.detail if isinstance(result, HTTPException) else str(result)
            responses.append(
                {
                    "name": file.filename,
                    "error_message": detail,
                    "status": "failed",
                }
            )
        else:
            responses.append(result)
    return responses


@router.get("/files", response_model=List[UserDocumentResponse])
def list_user_files(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    user_service: UserService = Depends(get_user_service),
):
    """
    Lists all files from the user_documents table
    """
    # Get internal user ID to filter correctly
    try:
        internal_user_id = user_service.get_internal_user_id(current_user.user_name)
    except HTTPException as exc:
        if exc.status_code != 404:  # only raise the exception if it's not a 404 (user not yet replicated)
            raise
        # Gracefully return an empty document list if the database row hasn't fully replicated yet
        return []

    # Reconcile stale or TTL-deleted GCS storage links in the background
    background_tasks.add_task(run_background_gcs_cleanup, internal_user_id)

    # Join UserDocuments with UploadedFiles to get the URL
    documents = (
        db.query(UserDocuments, UploadedFiles)
        .outerjoin(UploadedFiles, UserDocuments.fk_file_id == UploadedFiles.id)
        .filter(UserDocuments.fk_user_id == internal_user_id)
        .all()
    )

    result = []
    for doc, uploaded_file in documents:
        result.append(
            {
                "document_id": str(doc.document_id),
                "fk_user_id": str(doc.fk_user_id),
                "fk_application_id": str(doc.fk_application_id),
                "document_type": str(doc.document_type),
                "object_name": uploaded_file.object_name if uploaded_file else None,
                "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
                "upload_date": doc.created_at.isoformat() if doc.created_at else None,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            }
        )

    return result


@router.get("/download")
def download_user_file(file_uri: str):
    """
    Download file from Google Cloud Storage
    """
    # TODO: Implement file download route
    pass


class VerifyPayload(BaseModel):
    corrected_data: dict[str, Any]
    verified_fields: List[str]
    document_type: Optional[str] = None

    @field_validator("document_type")
    @classmethod
    def validate_document_type(cls, v: Optional[str]) -> Optional[str]:
        ALLOWED_DOCUMENT_TYPES = {
            "id_card",
            "registration",
            "health_insurance",
            "pension_notice",
            "stmt3",
            "income",
            "assets",
            "bank",
            "rent",
            "utility_bill",
            "heating",
            "housing",
            "cooperation_agreement",
            "household",
            "OTHER",
        }
        if v is not None and v not in ALLOWED_DOCUMENT_TYPES:
            raise ValueError(f"Invalid document_type value. Must be one of {ALLOWED_DOCUMENT_TYPES}")
        return v


def get_user_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: AuthUser = Depends(require_authenticated_user),
    user_service: UserService = Depends(get_user_service),
) -> UserDocuments:
    internal_user_id = user_service.get_internal_user_id(current_user.user_name)
    doc = (
        db.query(UserDocuments)
        .filter(UserDocuments.document_id == document_id, UserDocuments.fk_user_id == internal_user_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/api/v1/documents/{document_id}/file")
def get_document_file(
    disposition: str = "inline",
    doc: UserDocuments = Depends(get_user_document),
    storage_client: storage.Client = Depends(get_storage_client),
):
    """
    Securely proxies file contents from Google Cloud Storage (GCS) with IDOR/BOLA mitigation and high-performance chunks.
    """
    if disposition not in {"inline", "attachment"}:
        disposition = "inline"

    if not doc.fk_file:
        raise HTTPException(status_code=404, detail="No physical file linked to this document.")

    file_record = doc.fk_file
    bucket_name = file_record.bucket_name
    object_name = file_record.object_name
    display_name = file_record.name

    try:
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.get_blob(object_name)

        if not blob:
            raise HTTPException(status_code=404, detail="File not found in cloud storage.")

        media_type = blob.content_type or mimetypes.guess_type(display_name)[0] or "application/octet-stream"
        sanitized_filename = re.sub(r"[^\w\.\-]", "_", display_name)

        def chunk_generator():
            with blob.open("rb") as f:
                while chunk := f.read(64 * 1024):
                    yield chunk

        headers = {
            "Content-Disposition": f'{disposition}; filename="{sanitized_filename}"',
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
        }

        return StreamingResponse(chunk_generator(), media_type=media_type, headers=headers)

    except HTTPException:
        raise
    except gcloud_exceptions.GoogleCloudError as e:
        logger.error(f"GCS error fetching file {object_name} from bucket {bucket_name}: {e}")
        raise HTTPException(status_code=502, detail="Cloud storage service temporarily unavailable.")
    except Exception as e:
        logger.error(f"Unexpected error streaming file {object_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred retrieving the document.")


@router.get("/api/v1/documents/{document_id}/extractions")
def get_document_extractions(
    doc: UserDocuments = Depends(get_user_document),
):
    return {
        "raw_data": doc.raw_data,
        "user_error_code": doc.user_error_code,
        "document_type": doc.document_type,
    }


@router.post("/api/v1/documents/{document_id}/verify")
def verify_document(
    payload: VerifyPayload,
    doc: UserDocuments = Depends(get_user_document),
    db: Session = Depends(get_db),
):
    ENDPOINT_RULES_ENGINE = os.environ.get("ENDPOINT_RULES_ENGINE", "http://rules-engine:8080")

    DB_GENDER_FORMAT_MAPPING = {"MALE": "Male", "FEMALE": "Female", "NON_BINARY": "Diverse"}

    DB_HEALTH_INSURANCE_STATUS_MAPPING = {
        "compulsory_insurance": "Compulsory Insurance",
        "voluntary_insurance": "Voluntary Insurance",
        "family_insurance": "Family Insurance",
        "private_insurance": "Private Insurance",
        "care_by_health_insurance_under_264_sgb_v": "Care by Health Funds under § 264 SGB V",
    }

    NONE_FALLBACK_FIELDS = {
        "rent_total",
        "heating_costs",
        "hot_water_costs",
        "living_area",
        "monthly_income",
        "number_of_rooms",
        "date_of_birth",
        "legal_gender",
        "health_insurance_status",
    }

    # Keep corrections in local dictionary first (no DB row lock until validated)
    local_raw_data = dict(doc.raw_data) if doc.raw_data else {}
    for field, val in payload.corrected_data.items():
        local_raw_data[field] = val

    # Fetch user using internal user link from doc foreign key
    user = db.query(Users).filter(Users.id == doc.fk_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    slot_id = payload.document_type or doc.document_type
    dis_document_type = SLOT_ID_TO_DIS_TYPE.get(slot_id) if slot_id else None

    profile_sync = {}
    if payload.verified_fields:
        verified_subset = {field: local_raw_data[field] for field in payload.verified_fields if field in local_raw_data}
        rules_engine_headers = {}
        rules_engine_token = get_google_id_token(ENDPOINT_RULES_ENGINE)
        if rules_engine_token:
            rules_engine_headers["Authorization"] = f"Bearer {rules_engine_token}"

        request_body: dict = {"fields": verified_subset}
        if dis_document_type:
            request_body["document_type"] = dis_document_type

        try:
            response = requests.post(
                f"{ENDPOINT_RULES_ENGINE}/validate-fields",
                json=request_body,
                headers=rules_engine_headers,
                timeout=5,
            )
            if response.status_code == 422:
                error_data = response.json()
                raise HTTPException(
                    status_code=422,
                    detail={
                        "message": "Validation failed",
                        "errors": error_data.get("validation_errors") or {},
                    },
                )
            response.raise_for_status()
            response_data = response.json()
            profile_sync = response_data.get("profile_sync") or {}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to communicate with rules-engine: {e}")
            raise HTTPException(
                status_code=502,
                detail="Validation service is temporarily unavailable. Could not verify fields.",
            )

    # Validation succeeded. Apply database mutations and commit.
    if payload.document_type:
        doc.document_type = payload.document_type
    doc.raw_data = local_raw_data

    # Save coerced validated fields to database user record
    address_changed = False
    for db_field, value in profile_sync.items():
        if db_field == "is_main_tenant":
            if value is not None:
                user.tenancy_status = "Main Tenant" if value else "Subtenant"
            continue
        if not hasattr(user, db_field):
            continue
        if db_field == "legal_gender" and value:
            value = DB_GENDER_FORMAT_MAPPING.get(value, value)
        if db_field == "health_insurance_status" and value:
            value = DB_HEALTH_INSURANCE_STATUS_MAPPING.get(value, value)
        if db_field == "iban" and isinstance(value, str):
            value = "".join(value.split())

        # Convert string dates/decimals back to Python types before DB save
        if value is not None and value != "":
            if db_field in {"rent_total", "heating_costs", "hot_water_costs", "living_area", "monthly_income"}:
                try:
                    value = decimal.Decimal(str(value))
                except (decimal.InvalidOperation, ValueError):
                    value = None
            elif db_field == "number_of_rooms":
                try:
                    value = int(float(str(value)))
                except ValueError:
                    value = None
            elif db_field == "date_of_birth" and isinstance(value, str):
                try:
                    value = datetime.date.fromisoformat(value)
                except ValueError:
                    value = None

        # Fallback for non-string fields
        if value == "" or value is None:
            if db_field in NONE_FALLBACK_FIELDS:
                value = None
            else:
                value = ""

        if db_field in {"street", "house_number", "zip_code", "city"} and getattr(user, db_field) != value:
            address_changed = True

        setattr(user, db_field, value)

    if address_changed:
        user.district = sync_berlin_district(
            db=db,
            street=user.street,
            house_number=user.house_number,
            zip_code=user.zip_code,
            city=user.city,
        )

    # Update status
    doc.status = DocumentStatusType.VERIFIED

    if slot_id == "pension_notice":
        sources = set(user.income_sources or [])
        sources.add("pension")
        user.income_sources = list(sources)

    db.commit()

    return {"status": "success"}


@router.delete("/api/v1/documents/{document_id}")
def delete_user_document(
    doc: UserDocuments = Depends(get_user_document),
    db: Session = Depends(get_db),
    storage_client: storage.Client = Depends(get_storage_client),
):
    """
    Deletes the user document database entry and its corresponding physical file in Google Cloud Storage.
    Uses a GDPR-compliant order: GCS physical erasure is resolved first, followed by DB commit.
    """
    file_record = doc.fk_file
    bucket_name = file_record.bucket_name if file_record else None
    object_name = file_record.object_name if file_record else None

    # Step 1: Attempt GCS removal first inside the transaction boundaries
    if bucket_name and object_name:
        try:
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(object_name)
            if blob.exists():
                blob.delete()
        except Exception as storage_err:
            logger.error(f"GCS deletion failed: {storage_err}. Aborting DB transaction.")
            raise HTTPException(
                status_code=500,
                detail="Cloud storage deletion failed. Document could not be safely erased.",
            )

    # Step 2: Delete database records only if physical erasure succeeded
    try:
        # Delete UserDocuments before UploadedFiles (fk_file_id → uploaded_files.id is RESTRICT)
        db.delete(doc)
        if file_record:
            db.delete(file_record)
        db.commit()
    except Exception as db_err:
        db.rollback()
        logger.critical(f"Database metadata delete failed after GCS erasure! Inconsistency risk: {db_err}")
        raise HTTPException(status_code=500, detail="Metadata sync failed.")

    return {"status": "success", "message": "Document deleted successfully"}
