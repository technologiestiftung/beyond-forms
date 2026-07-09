import logging
import uuid
from src.db import SessionLocal
from src.services.user_service import UserService

logger = logging.getLogger(__name__)


def run_background_gcs_cleanup(user_id: uuid.UUID):
    """
    Safely executes the GCS file cleanup task in the background
    using a dedicated database session.
    """
    db = SessionLocal()
    try:
        user_service = UserService(db)
        user_service.cleanup_missing_gcs_files(user_id)
    except Exception as e:
        logger.error(f"Failed to run background GCS cleanup for user {user_id}: {e}", exc_info=True)
    finally:
        db.close()
