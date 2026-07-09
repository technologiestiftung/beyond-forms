import uuid
import logging
from typing import Optional
from google.cloud import storage

from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from src.models import Users as DbUser, UserApplications, UserDocuments, DocumentStatusType, UploadedFiles
from src.db import get_db

logger = logging.getLogger(__name__)


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

    def get_or_create_user_application(self, internal_user_id: str) -> tuple[str, str]:
        """
        Finds or creates an application for the user.
        """
        application = self.db.query(UserApplications).filter(UserApplications.fk_user_id == internal_user_id).first()

        if application:
            application_id = application.application_id
        else:
            application_id = uuid.uuid4()
            new_app = UserApplications(
                application_id=application_id,
                fk_user_id=internal_user_id,
                form_type="grundsicherung",  # hardcoded for now
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
