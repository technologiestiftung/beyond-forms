import os
import json
import logging
import sys
from datetime import datetime, timedelta, timezone

# Add the parent directory to sys.path to allow imports from src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
except ImportError:
    firebase_admin = None

from sqlalchemy import or_, and_
from src.db import SessionLocal
from src.models import UserApplications, Users, StatusType

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("stale_app_cleanup")

# Constants
STALE_APPLICATION_DAYS = int(os.environ.get("STALE_APPLICATION_DAYS", 14))
BATCH_SIZE = 100


def run_cleanup():
    """
    Finds stale 'in_progress' applications and sends FCM notifications to re-engage users.
    """
    logger.info("Starting stale application cleanup task...")

    if firebase_admin is None:
        logger.error("firebase-admin package not found. Skipping notifications.")
        return

    try:
        firebase_creds_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not firebase_creds_json:
            logger.error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable not set. Skipping.")
            return

        creds_dict = json.loads(firebase_creds_json)
        cred = credentials.Certificate(creds_dict)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return

    db = SessionLocal()
    try:
        threshold = datetime.now(timezone.utc) - timedelta(days=STALE_APPLICATION_DAYS)
        logger.info(f"Checking for applications updated before {threshold}")

        total_processed = 0
        while True:
            # Check last_reminded_at to prevent spam while preserving updated_at telemetry
            query = (
                db.query(UserApplications)
                .join(Users, UserApplications.fk_user_id == Users.id)
                .filter(
                    UserApplications.status == StatusType.IN_PROGRESS,
                    or_(
                        and_(UserApplications.last_reminded_at.is_(None), UserApplications.updated_at < threshold),
                        UserApplications.last_reminded_at < threshold,
                    ),
                    # Data Integrity: Check for both NULL and empty string to prevent Infinite Loop bug
                    Users.fcm_token.isnot(None),
                    Users.fcm_token != "",
                )
                .limit(BATCH_SIZE)
            )

            stale_apps = query.all()
            if not stale_apps:
                logger.info("No more stale applications found.")
                break

            logger.info(f"Processing batch of {len(stale_apps)} applications...")

            for app in stale_apps:
                user = app.fk_user
                token = user.fcm_token

                try:
                    message = messaging.Message(
                        notification=messaging.Notification(
                            title="Continue your application",
                            body=f"You haven't updated your {app.form_type} application in {STALE_APPLICATION_DAYS} days. Come back and finish it!",
                        ),
                        token=token,
                    )
                    messaging.send(message)
                    logger.info(f"Sent notification to user {user.id} for application {app.application_id}")
                except Exception as e:
                    # Individual failure doesn't halt the batch
                    logger.error(f"Failed to send notification to user {user.id}: {e}")
                finally:
                    # Infinite Loop Fix: ALWAYS update last_reminded_at even on failure
                    # This ensures the record is removed from the "stale" result set in the next loop
                    app.last_reminded_at = datetime.now(timezone.utc)
                    db.add(app)
                    total_processed += 1

            # Commit batch
            db.commit()

            if len(stale_apps) < BATCH_SIZE:
                break

        logger.info(f"Cleanup task completed. Total records processed: {total_processed}")

    except Exception as e:
        logger.error(f"An error occurred during database operations: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    run_cleanup()
