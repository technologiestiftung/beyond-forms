"""
Materialises a demo persona into an existing account.

The point of this service is to skip the document-intelligence round trip. Normally a
document reaches VERIFIED via `POST /upload` -> Pub/Sub -> Gemini OCR -> `POST
/api/v1/documents/{id}/verify`, which is slow, costs money and is non-deterministic.
Here the extraction is a reviewed fixture, so the rows are written directly.

Two rules follow from that and must not be relaxed:

* **Never publish to Pub/Sub.** That would hand the document straight back to
  `src/worker.py` and the OCR path this exists to bypass.
* **Never insert a `users` row.** `auth-service.get_or_create_user` is the only writer
  and owns the `authentik_id` linkage that `routes/application.py` and
  `routes/form_export.py` look users up by. Log in first, then seed.
"""

import datetime
import decimal
import json
import logging
import os
import re
import uuid
from enum import Enum as PyEnum
from pathlib import Path
from typing import Any, Optional

import requests
from sqlalchemy import ARRAY, Date, DateTime, Enum, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from src.mappers import map_flat_to_rules_engine_payload
from src.models import (
    Conversations,
    DocumentStatusType,
    UploadedFiles,
    UserApplications,
    UserDocuments,
    Users,
)
from src.services.berlin_districts import sync_berlin_district
from src.services.demo_assets import resolve_asset
from src.services.user_service import UserService

logger = logging.getLogger(__name__)

DEFAULT_PERSONAS_DIR = Path("/app/demo/personas")
GCS_BUCKET_NAME = os.environ.get("GCS_BUCKET_NAME", "beyondforms-dev-bucket")
ENDPOINT_RULES_ENGINE = os.environ.get("ENDPOINT_RULES_ENGINE", "http://rules-engine:8080")

# Identity and audit columns belong to auth-service and to Postgres respectively.
# A persona that tried to set them would break the Authentik linkage.
PROTECTED_COLUMNS = frozenset({"id", "created_at", "updated_at", "phone_number", "authentik_id"})

# Preserved across a reset so the Authentik account stays usable and re-seedable.
# `fcm_token` is kept because losing it silently breaks push notifications for the account.
PRESERVED_ON_RESET = PROTECTED_COLUMNS | frozenset({"fcm_token"})


class DemoSeedError(Exception):
    """Raised for problems a caller can act on: unknown persona, bad fixture."""


def _personas_dir() -> Path:
    return Path(os.environ.get("DEMO_PERSONAS_DIR", str(DEFAULT_PERSONAS_DIR)))


def _coerce_to_column(column, value: Any) -> Any:
    """
    Coerces a JSON value to what the `users` column expects.

    Driven by the ORM column type rather than by a Pydantic schema, because
    `UserProfileValidationSchema` and `UserInformationUpdateSchema` between them omit
    columns the personas need (`district`, `pension_insurance_no`,
    `has_received_previous_benefits`, …) and would silently drop them. The fixture tests
    additionally run every profile through `UserInformationUpdateSchema` to catch enum
    typos at review time, where a loud failure is what you want.
    """
    if value is None:
        return None

    col_type = column.type

    if isinstance(col_type, Enum):
        enum_class = getattr(col_type, "enum_class", None)
        if enum_class is not None and issubclass(enum_class, PyEnum):
            try:
                return enum_class(value)
            except ValueError as exc:
                valid = [member.value for member in enum_class]
                raise DemoSeedError(
                    f"{column.name}: {value!r} is not a valid {enum_class.__name__}. Valid values: {valid}"
                ) from exc
        return value

    if isinstance(col_type, DateTime):
        return datetime.datetime.fromisoformat(value) if isinstance(value, str) else value

    if isinstance(col_type, Date):
        return datetime.date.fromisoformat(value) if isinstance(value, str) else value

    if isinstance(col_type, Numeric):
        return decimal.Decimal(str(value))

    if isinstance(col_type, (JSONB, ARRAY)):
        return value

    return value


class DemoSeedService:
    def __init__(self, db: Session, storage_client=None, personas_dir: Optional[Path] = None):
        self.db = db
        self.storage_client = storage_client
        self.personas_dir = personas_dir or _personas_dir()
        self.user_service = UserService(db, storage_client=storage_client)

    # ------------------------------------------------------------------ personas

    def load_persona(self, slug: str) -> dict[str, Any]:
        if not re.fullmatch(r"[a-z][a-z0-9_]*", slug):
            raise DemoSeedError(f"Invalid persona slug {slug!r}.")
        path = self.personas_dir / f"{slug}.json"
        if not path.is_file():
            available = sorted(p.stem for p in self.personas_dir.glob("*.json"))
            raise DemoSeedError(f"Unknown persona {slug!r}. Available: {available}")
        persona = json.loads(path.read_text(encoding="utf-8"))
        if persona.get("slug") != slug:
            raise DemoSeedError(f"Persona file {path.name} declares slug {persona.get('slug')!r}.")
        return persona

    def list_personas(self) -> list[dict[str, Any]]:
        """
        Summarises every persona file, including its `research` block.

        The research narrative is returned deliberately: it is what lets an experiment
        reason about the person rather than only about the row, and it records the facts
        the schema cannot hold.
        """
        personas = []
        for path in sorted(self.personas_dir.glob("*.json")):
            try:
                persona = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                logger.error("Skipping malformed persona file %s: %s", path.name, exc)
                continue
            personas.append(
                {
                    "slug": persona.get("slug", path.stem),
                    "title": persona.get("title"),
                    "phone_number": persona.get("phone_number"),
                    "scenario": persona.get("scenario"),
                    "source": persona.get("source"),
                    "portrait": persona.get("portrait"),
                    "derived_fields": persona.get("derived", []),
                    "research": persona.get("research", {}),
                    "documents": [
                        {
                            "document_type": doc["document_type"],
                            "status": doc["status"],
                            "confidence_score": doc.get("confidence_score"),
                            "user_error_code": doc.get("user_error_code"),
                        }
                        for doc in persona.get("documents", [])
                    ],
                    "missing_documents": persona.get("missing_documents", []),
                }
            )
        return personas

    # -------------------------------------------------------------------- reset

    def reset(self, internal_user_id: uuid.UUID, reset_tutorials: bool = False) -> dict[str, Any]:
        """
        Returns the account to a cold start without destroying the identity.

        Ordering mirrors the GDPR sequencing in `routes/files.py::delete_document` and
        `routes/user.py::delete_profile`: blobs first, then `user_documents` before
        `uploaded_files` (the FK is ON DELETE RESTRICT), then the rest.

        Two deliberate differences from `DELETE /profile`: the `users` row is nulled in
        place rather than deleted, and Authentik is left alone. Both exist so the demo
        account can be re-seeded without another login round trip.
        """
        db_user = self.db.query(Users).filter(Users.id == internal_user_id).first()
        if not db_user:
            raise DemoSeedError("User not found in internal database.")

        rows = (
            self.db.query(UserDocuments, UploadedFiles)
            .outerjoin(UploadedFiles, UserDocuments.fk_file_id == UploadedFiles.id)
            .filter(UserDocuments.fk_user_id == internal_user_id)
            .all()
        )
        blobs = [(f.bucket_name, f.object_name) for _, f in rows if f]
        uploaded_file_ids = [f.id for _, f in rows if f]

        # Blobs go first. Leaving metadata pointing at a deleted object would let
        # cleanup_missing_gcs_files turn it into a confusing GCS_BLOB_MISSING failure.
        deleted_blobs = self._delete_blobs(blobs)

        self.db.query(UserDocuments).filter(UserDocuments.fk_user_id == internal_user_id).delete(
            synchronize_session=False
        )
        if uploaded_file_ids:
            self.db.query(UploadedFiles).filter(UploadedFiles.id.in_(uploaded_file_ids)).delete(
                synchronize_session=False
            )
        self.db.query(Conversations).filter(Conversations.fk_user_id == internal_user_id).delete(
            synchronize_session=False
        )
        self.db.query(UserApplications).filter(UserApplications.fk_user_id == internal_user_id).delete(
            synchronize_session=False
        )
        if reset_tutorials:
            from src.models import UserTutorialStates

            self.db.query(UserTutorialStates).filter(UserTutorialStates.user_id == internal_user_id).delete(
                synchronize_session=False
            )

        for column in Users.__table__.columns:
            if column.name not in PRESERVED_ON_RESET:
                setattr(db_user, column.name, None)
        db_user.updated_at = datetime.datetime.now(datetime.timezone.utc)

        self.db.commit()
        return {
            "documents_deleted": len(rows),
            "blobs_deleted": deleted_blobs,
            "tutorials_reset": reset_tutorials,
        }

    def _delete_blobs(self, blobs: list[tuple[str, str]]) -> int:
        if not blobs or self.storage_client is None:
            return 0
        deleted = 0
        for bucket_name, object_name in blobs:
            try:
                blob = self.storage_client.bucket(bucket_name).blob(object_name)
                if blob.exists():
                    blob.delete()
                    deleted += 1
            except Exception as exc:  # a stale blob must not block a re-seed
                logger.warning("Could not delete demo blob %s/%s: %s", bucket_name, object_name, exc)
        return deleted

    # --------------------------------------------------------------------- seed

    def seed(self, internal_user_id: uuid.UUID, slug: str, reset: bool = True) -> dict[str, Any]:
        persona = self.load_persona(slug)

        reset_summary = self.reset(internal_user_id) if reset else None

        db_user = self.db.query(Users).filter(Users.id == internal_user_id).first()
        if not db_user:
            raise DemoSeedError("User not found in internal database.")

        columns = {c.name: c for c in Users.__table__.columns}
        applied: list[str] = []
        for key, value in persona["profile"].items():
            if key in PROTECTED_COLUMNS:
                raise DemoSeedError(f"Persona {slug!r} may not set protected column {key!r}.")
            column = columns.get(key)
            if column is None:
                raise DemoSeedError(f"Persona {slug!r} sets unknown `users` column {key!r}.")
            setattr(db_user, key, _coerce_to_column(column, value))
            applied.append(key)

        if not db_user.district:
            db_user.district = sync_berlin_district(
                db=self.db,
                street=db_user.street,
                house_number=db_user.house_number,
                zip_code=db_user.zip_code,
                city=db_user.city,
            )

        application_spec = persona["application"]
        _, application_id = self.user_service.get_or_create_user_application(internal_user_id)
        application = self.db.query(UserApplications).filter(UserApplications.application_id == application_id).first()
        # get_or_create_user_application hardcodes form_type="grundsicherung"; the export
        # is requested as "antrag_grundsicherung", so the persona states the form_type it
        # wants and we apply it here.
        application.form_type = application_spec["form_type"]
        application.status = application_spec["status"]
        application.form_data = application_spec.get("form_data", {})

        seeded_documents = []
        uploaded_objects: list[str] = []
        try:
            for spec in persona.get("documents", []):
                seeded_documents.append(self._seed_document(spec, internal_user_id, application_id, uploaded_objects))
            self.db.commit()
        except Exception:
            self.db.rollback()
            self._delete_blobs([(GCS_BUCKET_NAME, name) for name in uploaded_objects])
            raise

        self.db.refresh(db_user)
        return {
            "persona": slug,
            "title": persona.get("title"),
            "scenario": persona.get("scenario"),
            "phone_number": db_user.phone_number,
            "internal_user_id": str(internal_user_id),
            "application_id": str(application_id),
            "form_type": application.form_type,
            "profile_fields_written": len(applied),
            "district": db_user.district,
            "documents": seeded_documents,
            "reset": reset_summary,
            "submittability": self._check_submittability(db_user),
            "notes": self._notes(persona),
        }

    def _seed_document(
        self,
        spec: dict[str, Any],
        internal_user_id: uuid.UUID,
        application_id: uuid.UUID,
        uploaded_objects: list[str],
    ) -> dict[str, Any]:
        raw_data = spec.get("raw_data") or {}
        display_name = spec.get("display_name") or f"{spec['document_type']}.pdf"
        content, content_type, source = resolve_asset(spec["asset"], display_name, raw_data)

        if isinstance(spec["asset"], dict) and not display_name.lower().endswith(".pdf"):
            display_name = f"{Path(display_name).stem}.pdf"

        sanitized = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", display_name)
        object_name = f"{uuid.uuid4()}_{sanitized}"

        if self.storage_client is not None:
            blob = self.storage_client.bucket(GCS_BUCKET_NAME).blob(object_name)
            blob.upload_from_string(content, content_type=content_type)
            uploaded_objects.append(object_name)

        file_id = uuid.uuid4()
        uploaded_file = UploadedFiles(
            id=file_id, name=display_name, bucket_name=GCS_BUCKET_NAME, object_name=object_name
        )
        self.db.add(uploaded_file)
        self.db.flush()

        document_id = uuid.uuid4()
        confidence = spec.get("confidence_score")
        self.db.add(
            UserDocuments(
                document_id=document_id,
                fk_user_id=internal_user_id,
                fk_application_id=application_id,
                fk_file_id=file_id,
                document_type=spec["document_type"],
                status=DocumentStatusType(spec["status"]),
                confidence_score=decimal.Decimal(str(confidence)) if confidence is not None else None,
                raw_data=raw_data,
                user_error_code=spec.get("user_error_code"),
                internal_error_log=spec.get("internal_error_log"),
            )
        )
        return {
            "document_id": str(document_id),
            "document_type": spec["document_type"],
            "status": spec["status"],
            "confidence_score": confidence,
            "object_name": object_name,
            "asset_source": source,
            "size_bytes": len(content),
            "extracted_field_count": len(raw_data),
            "user_error_code": spec.get("user_error_code"),
        }

    # ------------------------------------------------------------- diagnostics

    def _check_submittability(self, db_user: Users) -> dict[str, Any]:
        """
        Asks the rules engine whether the seeded profile would pass — and writes nothing.

        This is the same contract `POST /profile` exercises, so it surfaces at seed time
        whether a persona is deliberately incomplete or accidentally broken. A rules-engine
        outage is reported, not raised: it must not fail a seed.
        """
        try:
            payload = map_flat_to_rules_engine_payload(db_user)
            response = requests.post(
                f"{ENDPOINT_RULES_ENGINE}/validate-form",
                json=payload,
                params={"validate_entire_form": True},
                timeout=15,
            )
            body = response.json() if response.content else {}
            return {
                "checked": True,
                "is_submittable": response.status_code == 200,
                "status_code": response.status_code,
                "detail": body,
            }
        except Exception as exc:
            logger.warning("Rules-engine submittability check unavailable: %s", exc)
            return {"checked": False, "reason": str(exc)}

    @staticmethod
    def _notes(persona: dict[str, Any]) -> list[str]:
        notes = [
            "milestone_level from GET /application/{id}/status caps at 2 regardless of documents: "
            "/validate-form never returns required_documents, so application.py falls back to a "
            "hardcoded uppercase ['ID_CARD'] that never matches the lowercase slot ids stored here. "
            "The frontend computes its own level client-side and is unaffected.",
        ]
        not_representable = persona.get("research", {}).get("not_representable")
        if not_representable:
            notes.append(
                "Facts this persona carries that no `users` column can hold: "
                + ", ".join(k for k in not_representable if k != "note")
            )
        return notes
