import uuid
import logging
from typing import Any, Mapping, Optional
from google.cloud import storage

from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session, object_session

from src.models import (
    AssetEntries,
    AssociatedPersons,
    BenefitClaimEntries,
    ExpenseEntries,
    IncomeEntries,
    Users as DbUser,
    UserApplications,
    UserDocuments,
    DocumentStatusType,
    UploadedFiles,
)
from pydantic import BaseModel, ValidationError

from src.schemas import (
    AssetEntrySchema,
    AssociatedPersonSchema,
    BenefitClaimEntrySchema,
    ExpenseEntrySchema,
    IncomeEntrySchema,
)
from src.db import get_db

logger = logging.getLogger(__name__)


class ProfileWriteError(Exception):
    """A payload the caller sent is not writable. Every route translates this into its own
    idiom (tool-error dict, HTTP 422, DemoSeedError) so one bad payload cannot mean three
    different things depending on which endpoint received it."""


def _collection_writer(model: type, schema: type[BaseModel], attr: str):
    """Builds the writer for one child collection. `sort_order` is renumbered from list
    order so the PDFs' fixed person slots do not shift when someone is removed from the
    middle; the whole collection is replaced, and delete-orphan removes what dropped out."""

    def write(user_row: DbUser, items: object) -> None:
        if items is None:
            items = []
        if not isinstance(items, list):
            raise ProfileWriteError(f"{attr}: expected a list, got {type(items).__name__}")
        try:
            rows = [schema.model_validate(item) for item in items]
        except ValidationError as exc:
            raise ProfileWriteError(f"{attr}: {exc}") from exc
        setattr(
            user_row,
            attr,
            [model(**{**row.model_dump(), "sort_order": index}) for index, row in enumerate(rows)],
        )

    return write


def _money_grid_writer(model: type, schema: type[BaseModel], attr: str, type_field: Optional[str] = None):
    """Builds the writer for one money grid. Each row names its owner by
    `person_sort_order` rather than by id, because a person created in the same request
    has no id yet; the row is attached through the relationship so SQLAlchemy fills in
    both `user_id` and `person_id` on flush.

    `type_field` names the column the table's unique index is on, so a payload that lists
    the same form line twice for one person is rejected as a bad payload instead of
    surfacing as an IntegrityError at commit time. None for the free-list grids, whose
    rows are instead renumbered from list order so `sort_order` decides which of the
    form's blank numbered rows a record lands in."""

    def write(user_row: DbUser, items: object) -> None:
        if items is None:
            items = []
        if not isinstance(items, list):
            raise ProfileWriteError(f"{attr}: expected a list, got {type(items).__name__}")
        try:
            rows = [schema.model_validate(item) for item in items]
        except ValidationError as exc:
            raise ProfileWriteError(f"{attr}: {exc}") from exc

        # Emptying the collection and flushing before the replacements are built: within
        # one flush SQLAlchemy emits a mapper's INSERTs before its DELETEs, so replacing
        # the collection in place would insert a row for a form line the citizen already
        # has while the old row is still there - an IntegrityError against the
        # (person, type) unique index on every second write of the same line.
        session = object_session(user_row)
        if getattr(user_row, attr):
            setattr(user_row, attr, [])
            if session is not None:
                session.flush()

        by_sort_order = {person.sort_order: person for person in user_row.associated_persons}
        built = []
        seen: set[tuple] = set()
        for index, row in enumerate(rows):
            fields = row.model_dump()
            sort_order = fields.pop("person_sort_order")
            person = None
            if sort_order is not None:
                person = by_sort_order.get(sort_order)
                if person is None:
                    raise ProfileWriteError(
                        f"{attr}: no associated person with sort_order {sort_order}; "
                        "send associated_persons in the same payload"
                    )
            if type_field is not None:
                key = (sort_order, fields[type_field])
                if key in seen:
                    raise ProfileWriteError(
                        f"{attr}: duplicate {type_field} {fields[type_field]!r} for the same person; "
                        "send one row per form line"
                    )
                seen.add(key)
            else:
                fields["sort_order"] = index
            built.append(model(**fields, person=person))
        setattr(user_row, attr, built)

    return write


RELATION_WRITERS = {
    "associated_persons": _collection_writer(AssociatedPersons, AssociatedPersonSchema, "associated_persons"),
    "income_entries": _money_grid_writer(IncomeEntries, IncomeEntrySchema, "income_entries", "income_type"),
    "expense_entries": _money_grid_writer(ExpenseEntries, ExpenseEntrySchema, "expense_entries", "expense_type"),
    "asset_entries": _money_grid_writer(AssetEntries, AssetEntrySchema, "asset_entries", "asset_type"),
    "benefit_claim_entries": _money_grid_writer(
        BenefitClaimEntries, BenefitClaimEntrySchema, "benefit_claim_entries"
    ),
}
RELATION_KEYS = frozenset(RELATION_WRITERS)
RELATION_WRITE_ORDER = tuple(RELATION_WRITERS)

_MERGEABLE_MONEY_GRIDS: dict[str, tuple[type[BaseModel], str]] = {
    "income_entries": (IncomeEntrySchema, "income_type"),
    "expense_entries": (ExpenseEntrySchema, "expense_type"),
    "asset_entries": (AssetEntrySchema, "asset_type"),
}


def _reconcile_money_grid_items(user_row: DbUser, key: str, items: object) -> object:
    spec = _MERGEABLE_MONEY_GRIDS.get(key)
    if spec is None or not isinstance(items, list):
        return items
    schema, type_field = spec

    merged: dict[tuple, dict] = {}
    for row in getattr(user_row, key):
        dumped = schema.model_validate(row).model_dump(mode="json")
        merged[(dumped["person_sort_order"], dumped[type_field])] = dumped

    for item in items:
        try:
            dumped = schema.model_validate(item).model_dump(mode="json")
        except ValidationError:
            return items
        merged[(dumped["person_sort_order"], dumped[type_field])] = dumped

    return list(merged.values())


def ordered_profile_items(payload: Mapping[str, Any]) -> list[tuple[str, Any]]:
    """`payload` as (key, value) pairs with the relationship keys moved to the end in
    RELATION_WRITE_ORDER. Plain columns are order-independent; the relationships are not,
    and a caller that iterates an arbitrary dict (an LLM tool call, a persona JSON file)
    would otherwise write them in whatever order the keys happened to arrive in."""
    relations = [(key, payload[key]) for key in RELATION_WRITE_ORDER if key in payload]
    columns = [(key, value) for key, value in payload.items() if key not in RELATION_KEYS]
    return columns + relations


def apply_profile_key(user_row: DbUser, key: str, value: object) -> bool:
    """Writes one payload key that is a relationship. Returns False if `key` is a plain
    column, which the caller then assigns itself. Raises ProfileWriteError on bad input."""
    writer = RELATION_WRITERS.get(key)
    if writer is None:
        return False
    writer(user_row, _reconcile_money_grid_items(user_row, key, value))
    return True


class UserService:
    def __init__(self, db: Session, storage_client: Optional[storage.Client] = None):
        self.db = db
        self.storage_client = storage_client

    def cleanup_missing_gcs_files(self, user_id: uuid.UUID):
        """
        Reconciles UserDocuments database entries against physical GCS bucket listings.
        If a GCS blob has been scrubbed by bucket TTL rules, updates the database row status or unlinks it.
        """
        docs = (
            self.db.query(UserDocuments, UploadedFiles)
            .outerjoin(UploadedFiles, UserDocuments.fk_file_id == UploadedFiles.id)
            .filter(
                UserDocuments.fk_user_id == user_id,
                UserDocuments.status == DocumentStatusType.VERIFIED,
                UserDocuments.fk_file_id.isnot(None),
            )
            .all()
        )

        if not docs:
            return

        client = self.storage_client
        if not client:
            try:
                client = storage.Client()
            except Exception as e:
                logger.warning(f"Storage client could not be initialized for scavenging: {e}")
                return

        changed = False
        for doc, file_record in docs:
            if file_record and file_record.bucket_name and file_record.object_name:
                try:
                    bucket = client.bucket(file_record.bucket_name)
                    blob = bucket.blob(file_record.object_name)
                    if not blob.exists():
                        doc.status = DocumentStatusType.FAILED
                        doc.user_error_code = "GCS_BLOB_MISSING"
                        doc.internal_error_log = (
                            doc.internal_error_log + "; " if doc.internal_error_log else ""
                        ) + f"Physical GCS object {file_record.object_name} was scrubbed by storage TTL policy."
                        self.db.add(doc)
                        changed = True
                        logger.info(
                            f"Reconciled orphaned document {doc.document_id} to FAILED. Physical GCS object missing."
                        )
                except Exception as e:
                    logger.warning(f"Error checking existence of GCS blob {file_record.object_name}: {e}")

        if changed:
            self.db.commit()

    def cleanup_stale_documents(self, user_id: uuid.UUID):
        """
        Finds documents in 'processing' state for too long and marks them as 'failed'.
        """
        from datetime import datetime, timezone, timedelta

        threshold = datetime.now(timezone.utc) - timedelta(minutes=5)

        stale_docs = (
            self.db.query(UserDocuments)
            .filter(
                UserDocuments.fk_user_id == user_id,
                UserDocuments.status == DocumentStatusType.PROCESSING,
                UserDocuments.created_at < threshold,
            )
            .all()
        )

        if stale_docs:
            for doc in stale_docs:
                doc.status = DocumentStatusType.FAILED
                doc.user_error_code = "PROCESSING_TIMEOUT"
                doc.internal_error_log = "Document processing timed out after 5 minutes."
                self.db.add(doc)
            self.db.commit()

    def get_internal_user_id(self, phone_number_id: str) -> str:
        """
        Looks up and returns the internal user ID from the phone_number ID.
        """
        user = self.db.query(DbUser).filter(DbUser.phone_number == phone_number_id).first()

        if not user:
            raise HTTPException(status_code=404, detail="User not found in internal database")

        return user.id

    def get_user_application(self, internal_user_id: str, application_id: uuid.UUID) -> UserApplications:
        """Fetches an application by id, scoped to the given user. Raises 404 if it does not
        exist or belongs to someone else, so a caller cannot attach a document to another
        user's application by guessing an id (IDOR prevention)."""
        application = (
            self.db.query(UserApplications)
            .filter(
                UserApplications.application_id == application_id,
                UserApplications.fk_user_id == internal_user_id,
            )
            .first()
        )
        if application is None:
            raise HTTPException(status_code=404, detail="Application not found")
        return application

    def get_or_create_user_application(self, internal_user_id: str, form_type: str) -> tuple[str, str]:
        """
        Finds the user's application for `form_type`, or creates one.
        """
        application = (
            self.db.query(UserApplications)
            .filter(
                UserApplications.fk_user_id == internal_user_id,
                UserApplications.form_type == form_type,
            )
            .first()
        )

        if application:
            application_id = application.application_id
        else:
            application_id = uuid.uuid4()
            new_app = UserApplications(
                application_id=application_id,
                fk_user_id=internal_user_id,
                form_type=form_type,
                status="in_progress",
                form_data={},
            )
            self.db.add(new_app)
            self.db.flush()

        return internal_user_id, application_id


def get_user_service(db: Session = Depends(get_db)) -> UserService:
    """FastAPI dependency to get a UserService."""
    from src.routes.files import get_storage_client

    return UserService(db, storage_client=get_storage_client())
