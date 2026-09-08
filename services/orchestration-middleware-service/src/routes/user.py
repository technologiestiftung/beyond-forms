import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from beyondforms.auth import User as AuthUser, require_authenticated_user
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import requests
from sqlalchemy.orm import Session
from src.db import get_db
from src.models import Users as DbUser, UploadedFiles, UserDocuments
from src.schemas import AssociatedPersonSchema, UserProfileValidationSchema
from src.services.user_service import (
    ProfileWriteError,
    RELATION_KEYS,
    UserService,
    apply_profile_key,
    get_user_service,
)
from src.services.berlin_districts import sync_berlin_district
from src.utils import get_google_id_token
from src.mappers import map_flat_to_rules_engine_payload
from src.tasks.cleanup import run_background_gcs_cleanup
from src.gcs import get_gcs_client


def _delete_gcs_files_sync(files: list[tuple[str, str]]):
    client = get_gcs_client()
    for bucket_name, object_name in files:
        try:
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(object_name)
            if blob.exists():
                blob.delete()
        except Exception as e:
            logger.error(f"Failed to delete GCS blob {object_name} from {bucket_name}: {e}")


DISTRICT_SYNC_FIELDS = frozenset({"street", "house_number", "zip_code", "city"})

logger = logging.getLogger(__name__)

ENDPOINT_RULES_ENGINE = os.environ.get("ENDPOINT_RULES_ENGINE", "http://rules-engine:8080")

router = APIRouter(tags=["user"])


@router.get("/profile")
def get_profile(
    background_tasks: BackgroundTasks,
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
):
    """
    Get current user profile
    """
    db_user = db.query(DbUser).filter(DbUser.phone_number == current_user.user_name).first()

    if not db_user:
        return {
            "id": None,
            "first_name": "",
            "last_name": "",
            "phone_number": current_user.user_name,
        }

    # Run lazy cleanup for stale processing documents and reconcile expired GCS blobs
    user_service.cleanup_stale_documents(db_user.id)
    background_tasks.add_task(run_background_gcs_cleanup, db_user.id)

    user_data = {c.name: getattr(db_user, c.name) for c in db_user.__table__.columns}
    if user_data.get("displaced_status") is None:
        user_data["displaced_status"] = "none"
    user_data["associated_persons"] = [
        AssociatedPersonSchema.model_validate(person).model_dump(mode="json") for person in db_user.associated_persons
    ]

    return user_data


@router.get("/validate")
def validate_user_data(current_user: AuthUser = Depends(require_authenticated_user)):
    # TODO: fetch all the information related to the form and validate via rule engine
    return {"status": "work in progress"}


@router.post("/profile")
def update_user_profile(
    payload: UserProfileValidationSchema,
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Update user profile data after validation by the rules engine
    """
    db_user = db.query(DbUser).filter(DbUser.phone_number == current_user.user_name).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User profile not found")

    # Persist incoming fields to database first (decoupled draft)
    logger.info(f"[DEBUG] update_user_profile payload: {payload.model_dump(exclude_unset=True)}")
    exclude_keys = {"validate_entire_form"}
    address_changed = False
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key not in exclude_keys:
            if key in RELATION_KEYS:
                # Already validated by the request schema, so hand over the model
                # instances rather than round-tripping the dumped dicts.
                value = getattr(payload, key)
            try:
                if apply_profile_key(db_user, key, value):
                    continue
            except ProfileWriteError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            if key == "displaced_status" and value == "none":
                value = None
            if key in DISTRICT_SYNC_FIELDS and getattr(db_user, key) != value:
                address_changed = True
            setattr(db_user, key, value)

    if address_changed:
        db_user.district = sync_berlin_district(
            db=db,
            street=db_user.street,
            house_number=db_user.house_number,
            zip_code=db_user.zip_code,
            city=db_user.city,
        )

    logger.info(
        f"[DEBUG] db_user attributes updated: street={db_user.street}, house_number={db_user.house_number}, zip_code={db_user.zip_code}, city={db_user.city}, district={db_user.district}"
    )
    db.commit()

    # Construct payload for Rules Engine from updated DB user
    rules_engine_payload = map_flat_to_rules_engine_payload(db_user)

    validate_url = f"{ENDPOINT_RULES_ENGINE}/validate-form"
    eval_url = f"{ENDPOINT_RULES_ENGINE}/wizard/evaluate"
    params = {}
    if payload.validate_entire_form is not None:
        params["validate_entire_form"] = payload.validate_entire_form

    headers = {}
    token = get_google_id_token(ENDPOINT_RULES_ENGINE)
    if token:
        headers["Authorization"] = f"Bearer {token}"

    response = None
    wizard_data = {}

    try:
        # Perform downstream calls concurrently to minimize latency
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_validate = executor.submit(
                requests.post, validate_url, json=rules_engine_payload, params=params, headers=headers, timeout=10
            )
            future_evaluate = executor.submit(
                requests.post,
                eval_url,
                json={"form_content": rules_engine_payload["form_content"], "current_step_id": "step_applicant_name"},
                headers=headers,
                timeout=10,
            )

            # Wait for validate-form (critical path validation)
            response = future_validate.result()

            # Wait for wizard evaluation (optional / non-blocking path)
            try:
                eval_response = future_evaluate.result()
                if eval_response.status_code == 200:
                    wizard_data = eval_response.json().get("evaluation") or {}
                else:
                    logger.warning(f"Rules engine /wizard/evaluate returned status: {eval_response.status_code}")
            except Exception as eval_err:
                logger.warning(f"Failed to fetch wizard evaluation from rules engine: {eval_err}")

        # Coerce wizard_data mock structures inside unit tests
        if not isinstance(wizard_data, dict):
            wizard_data = {}

        # Downstream authentication check
        if response.status_code in (401, 403):
            logger.error(f"Middleware failed to authenticate with Rules Engine: {response.status_code}")
            raise HTTPException(status_code=502, detail="Upstream service authentication failure.")

        # Handle validation errors
        if response.status_code == 422:
            response_data = response.json()
            if payload.validate_entire_form:
                return JSONResponse(
                    status_code=422, content={**response_data, "wizard_evaluation": wizard_data or None}
                )
            else:
                return JSONResponse(
                    status_code=200,
                    content={
                        "status": "success",
                        "validation_status": "draft",
                        "rules_warnings": response_data.get("validation_errors") or [],
                        "wizard_evaluation": wizard_data or None,
                    },
                )

        # Raise HTTPError if status is 4xx/5xx (excluding 422 which was handled above)
        response.raise_for_status()
        response_data = response.json()

        # Build combined response on success
        combined_response = {
            "status": "success",
            "validation_status": "valid",
            "rules_warnings": [],
            "wizard_evaluation": wizard_data or None,
            "form_content": response_data.get("form_content"),
            "total_required_fields": response_data.get("total_required_fields"),
            "is_submittable": response_data.get("is_submittable", False),
        }
        return JSONResponse(status_code=200, content=combined_response)

    except requests.exceptions.Timeout as e:
        logger.error(f"Gateway Timeout calling rules engine: {str(e)}", exc_info=True)
        raise HTTPException(status_code=504, detail="Gateway Timeout: Could not reach upstream service.")
    except requests.exceptions.HTTPError as e:
        logger.error(f"HTTP error from rules engine: {str(e)}", exc_info=True)
        raise HTTPException(status_code=502, detail="Upstream service returned an error.")
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to call rules engine: {str(e)}", exc_info=True)
        raise HTTPException(status_code=504, detail="Gateway Timeout: Could not reach upstream service.")


@router.post("/login")
def login_user():
    """
    Login user
    """
    # TODO: Implement login route using the Authentik Auth API
    pass


@router.post("/register")
def register_user():
    """
    Register user
    """
    # TODO: Implement register route using the Authentik Auth API
    pass


AUTHENTIK_API_TOKEN = os.environ.get("AUTHENTIK_API_TOKEN")
AUTHENTIK_SERVER_URL = os.environ.get("AUTHENTIK_SERVER_URL", "http://authentik-server:9000")
GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME", "beyondforms-dev-bucket")


@router.delete("/profile")
async def delete_profile(
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Unsubscribes the user, removes their records from DB, deletes GCS files, and deletes Authentik user.
    """
    db_user = db.query(DbUser).filter(DbUser.phone_number == current_user.user_name).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. Fetch files info before we cascade delete them
    documents = (
        db.query(UserDocuments, UploadedFiles)
        .outerjoin(UploadedFiles, UserDocuments.fk_file_id == UploadedFiles.id)
        .filter(UserDocuments.fk_user_id == db_user.id)
        .all()
    )

    files_to_delete = []
    uploaded_file_ids = []
    for doc, uploaded_file in documents:
        if uploaded_file:
            files_to_delete.append((uploaded_file.bucket_name, uploaded_file.object_name))
            uploaded_file_ids.append(uploaded_file.id)

    authentik_id = db_user.authentik_id

    # 2. Execute External Cleanups FIRST
    # 2a. Purge Authentik Account
    authentik_api_token = os.environ.get("AUTHENTIK_API_TOKEN")
    authentik_server_url = os.environ.get("AUTHENTIK_SERVER_URL", "http://authentik-server:9000")
    if authentik_api_token and authentik_id:
        try:
            url = f"{authentik_server_url}/api/v3/core/users/{authentik_id}/"
            headers = {"Authorization": f"Bearer {authentik_api_token}"}
            import httpx

            async with httpx.AsyncClient() as client:
                auth_response = await client.delete(url, headers=headers, timeout=5.0)
                auth_response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to delete user in Authentik: {e}")
            raise HTTPException(status_code=502, detail="External identity provider cleanup failed.")
    else:
        logger.warning("AUTHENTIK_API_TOKEN or authentik_id missing. Skipping Authentik user deletion.")

    # 2b. Offload GCS Purge to non-blocking worker threads
    if files_to_delete:
        await asyncio.to_thread(_delete_gcs_files_sync, files_to_delete)

    # 3. Database Deletion (Atomic Transaction Commit)
    try:
        # Delete user (Cascades to UserDocuments, Conversations, etc.)
        db.delete(db_user)
        db.flush()

        # Bulk delete UploadedFiles records
        if uploaded_file_ids:
            db.query(UploadedFiles).filter(UploadedFiles.id.in_(uploaded_file_ids)).delete(synchronize_session=False)

        db.commit()
    except Exception as db_err:
        db.rollback()
        logger.error(f"Failed database transaction during account deletion: {db_err}")
        raise HTTPException(status_code=500, detail="Failed to delete account from database.")

    return {"status": "success", "message": "Account deleted successfully"}
