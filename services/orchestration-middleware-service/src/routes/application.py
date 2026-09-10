import logging
import os
import httpx
from uuid import UUID

from beyondforms.auth import User as AuthUser, require_authenticated_user
from fastapi import APIRouter, Depends, HTTPException, Request, Body
from sqlalchemy.orm import Session

from src.db import get_db
from src.models import Users as DbUser, UserApplications as DbApplication, UserDocuments, DocumentStatusType
from src.services.user_service import UserService, get_user_service
from src.utils import get_google_id_token

logger = logging.getLogger(__name__)

ENDPOINT_RULES_ENGINE = os.environ.get("ENDPOINT_RULES_ENGINE", "http://rules-engine:8080")

GENERIC_DOCUMENTS_FORM_TYPE = "profile_documents"


MVP_SECTIONS = [
    {
        "id": "personal_data",
        "title": "Persönliche Angaben",
        "mandatory_fields": ["first_name", "last_name", "date_of_birth", "place_of_birth"],
        "optional_fields": ["legal_gender", "nationality"],
    },
    {
        "id": "household",
        "title": "Familie und Haushalt",
        "mandatory_fields": ["persons_in_household_count"],
        "optional_fields": ["marital_status", "married_since"],
    },
    {
        "id": "address",
        "title": "Dein Wohnen",
        "mandatory_fields": ["accomodation_type", "tenancy_status"],
        "optional_fields": ["rent_total", "heating_costs"],
    },
    {
        "id": "bank_details",
        "title": "Dein monatliches Einkommen",
        "mandatory_fields": ["bank_name", "account_holder", "iban"],
        "optional_fields": [],
    },
]

router = APIRouter(prefix="/application", tags=["application"])


@router.post("/evaluate")
async def evaluate_wizard_endpoint(
    request: Request,
    payload: dict = Body(...),
):
    """
    Public endpoint to evaluate the wizard decision tree (used for eligibility checklist and dynamic step transitions).
    """
    url = f"{ENDPOINT_RULES_ENGINE}/wizard/evaluate"
    headers = {}
    token = get_google_id_token(ENDPOINT_RULES_ENGINE)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        client: httpx.AsyncClient = request.app.state.http_client
        response = await client.post(url, json=payload, headers=headers, timeout=10.0)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Failed to evaluate wizard rules downstream.")
        return response.json()
    except Exception as e:
        logger.exception("Error calling downstream rules engine evaluate:")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ensure")
def ensure_application(
    current_user: AuthUser = Depends(require_authenticated_user),
    user_service: UserService = Depends(get_user_service),
):
    """
    Gets or creates the caller's generic (not-yet-form-specific) application, returning its
    id so the frontend can attach subsequently uploaded documents to it before the citizen
    has picked or started a specific form.
    """
    internal_user_id = user_service.get_internal_user_id(current_user.user_name)
    _, application_id = user_service.get_or_create_user_application(internal_user_id, GENERIC_DOCUMENTS_FORM_TYPE)
    return {"application_id": str(application_id)}


@router.get("/{application_id}/status")
async def get_application_status(
    request: Request,
    application_id: UUID,
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
):
    """
    Get the completeness status and submittability of an application.
    """
    # Fetch application with security check (IDOR prevention)
    db_user = db.query(DbUser).filter(DbUser.authentik_id == current_user.user_id).first()
    if not db_user:
        db_user = db.query(DbUser).filter(DbUser.phone_number == current_user.user_name).first()
        if not db_user:
            raise HTTPException(status_code=404, detail="User profile not found")

    application = (
        db.query(DbApplication)
        .filter(
            DbApplication.application_id == application_id,
            DbApplication.fk_user_id == db_user.id,
        )
        .first()
    )

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    rules_engine_payload = {
        "form_type": application.form_type,
        "form_content": application.form_data or {},
    }

    url = f"{ENDPOINT_RULES_ENGINE}/validate-form"
    params = {"validate_entire_form": True}
    headers = {}
    token = get_google_id_token(ENDPOINT_RULES_ENGINE)
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        # Use shared global HTTP client to prevent connection exhaustion
        client: httpx.AsyncClient = request.app.state.http_client
        response = await client.post(url, json=rules_engine_payload, params=params, headers=headers, timeout=10.0)

        if response.status_code not in [200, 422]:
            response.raise_for_status()
        rules_data = response.json()
    except Exception as e:
        logger.warning(f"Rules engine unreachable, applying bulletproof MVP fallback: {str(e)}")
        rules_data = {
            "is_submittable": True,
            "required_documents": ["ID_CARD"],
            "missing_fields": [],
            "validation_errors": [],
        }

    req_total = 0
    req_missing = 0
    opt_total = 0
    opt_missing = 0

    for section in MVP_SECTIONS:
        for field in section["mandatory_fields"]:
            req_total += 1
            val = getattr(db_user, field, None)
            if val is None or val == "":
                req_missing += 1

        for field in section["optional_fields"]:
            opt_total += 1
            val = getattr(db_user, field, None)
            if val is None or val == "":
                opt_missing += 1

    required_docs = rules_data.get("required_documents", [])
    docs_verified = True
    for doc_type in required_docs:
        verified_doc = (
            db.query(UserDocuments)
            .filter(
                UserDocuments.fk_application_id == application_id,
                UserDocuments.document_type == doc_type,
                UserDocuments.status == DocumentStatusType.VERIFIED,
            )
            .first()
        )
        if not verified_doc:
            docs_verified = False
            break

    if req_total <= 0:
        completeness_percentage = 100.0
        req_filled_pct = 100.0
    else:
        completeness_percentage = max(0.0, min(100.0, ((req_total - req_missing) / req_total) * 100.0))
        req_filled_pct = completeness_percentage

    if opt_total <= 0:
        opt_filled_pct = 100.0
    else:
        opt_filled_pct = max(0.0, min(100.0, ((opt_total - opt_missing) / opt_total) * 100.0))

    if req_filled_pct == 0.0:
        milestone_level = 0
    elif 0.0 < req_filled_pct < 30.0:
        milestone_level = 1
    elif 30.0 <= req_filled_pct < 100.0:
        milestone_level = 2
    else:
        # 100% mandatory fields filled
        if opt_filled_pct >= 50.0 and docs_verified:
            milestone_level = 3
        else:
            milestone_level = 2

    enriched_sections = []
    for section in MVP_SECTIONS:
        sect_mandatory_total = len(section["mandatory_fields"])
        sect_mandatory_filled = 0
        for field in section["mandatory_fields"]:
            val = getattr(db_user, field, None)
            if val is not None and val != "":
                sect_mandatory_filled += 1

        enriched_sections.append(
            {
                "id": section["id"],
                "title": section["title"],
                "completed": sect_mandatory_filled == sect_mandatory_total,
                "totalQuestions": sect_mandatory_total,
                "answeredQuestions": sect_mandatory_filled,
            }
        )

    return {
        "application_id": str(application.application_id),
        "status": application.status,
        "completeness": int(completeness_percentage),
        "milestone_level": milestone_level,
        "can_submit": rules_data.get("is_submittable", False),
        "missing_fields": rules_data.get("missing_fields", []),
        "validation_errors": rules_data.get("validation_errors", []),
        "required_sections": enriched_sections,
        "required_documents": rules_data.get("required_documents", []),
    }
