import os
import json
import logging
import signal
import sys
import time
import httpx
from sqlalchemy import text

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from concurrent.futures import ThreadPoolExecutor
from google.cloud.pubsub_v1.types import FlowControl
from google.cloud.pubsub_v1.subscriber.scheduler import ThreadScheduler

from src.db import SessionLocal
from src.models import DocumentStatusType
from src.utils import get_google_id_token
from src.services.pubsub_service import initialize_pubsub, get_subscriber_client, PROJECT_ID, SUBSCRIPTION_ID
from src.constants import SLOT_ID_TO_DIS_TYPE, DIS_TO_SLOT_ID_MAP

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("worker")

ENDPOINT_DOC_INTELLIGENCE = os.environ.get("ENDPOINT_DOC_INTELLIGENCE", "http://document-intelligence-service:8080")

shutdown_requested = False


def signal_handler(sig, frame):
    global shutdown_requested
    logger.info("Shutdown requested, stopping subscriber...")
    shutdown_requested = True


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


def process_message(message):
    """
    Processes a single Pub/Sub message.
    """
    db = SessionLocal()
    try:
        data = json.loads(message.data.decode("utf-8"))
        document_id = data.get("document_id")
        gcs_uri = data.get("gcs_uri")

        logger.info(f"Processing document {document_id} from {gcs_uri}")

        if not document_id or not gcs_uri:
            logger.error("Invalid message payload: missing document_id or gcs_uri")
            message.ack()
            return

        # 1. Optimistic Locking / Sanity Check
        # Check if document is still in 'processing' state
        row = db.execute(
            text("SELECT status, document_type FROM user_documents WHERE document_id = :doc_id"),
            {"doc_id": document_id},
        ).fetchone()

        if not row:
            logger.warning(f"Document {document_id} not found in database.")
            message.ack()
            return

        if row[0] != "processing":
            logger.info(f"Document {document_id} is already in state '{row[0]}'. Aborting worker task.")
            message.ack()
            return

        # 2. Call DIS with GCS URI (DIS downloads the file directly)
        try:
            user_selected_type = row[1] if row[1] and row[1] != "tbd" else None
            headers = {}
            token = get_google_id_token(ENDPOINT_DOC_INTELLIGENCE)
            if token:
                headers["Authorization"] = f"Bearer {token}"

            used_stateless_extract = False
            with httpx.Client(timeout=300.0) as client:  # Default timeout on Cloud Run is 5 minutes.
                if user_selected_type:
                    dis_doc_type = SLOT_ID_TO_DIS_TYPE.get(user_selected_type)
                    if dis_doc_type:
                        logger.info(
                            f"User selected '{user_selected_type}' → DIS type '{dis_doc_type}', using stateless extract"
                        )
                        extract_data = {"gcs_uri": gcs_uri, "document_type": dis_doc_type}
                        response = client.post(
                            f"{ENDPOINT_DOC_INTELLIGENCE}/api/v1/stateless/extract",
                            data=extract_data,
                            headers=headers,
                        )
                        used_stateless_extract = True
                    else:
                        logger.warning(f"No DIS type mapping for slot '{user_selected_type}', falling back to classify")
                        classify_data = {"gcs_uri": gcs_uri, "entity-extraction": "true"}
                        response = client.post(
                            f"{ENDPOINT_DOC_INTELLIGENCE}/classify", data=classify_data, headers=headers
                        )
                else:
                    classify_data = {"gcs_uri": gcs_uri, "entity-extraction": "true"}
                    response = client.post(f"{ENDPOINT_DOC_INTELLIGENCE}/classify", data=classify_data, headers=headers)

            if response.status_code != 200:
                raise RuntimeError(f"DIS returned status code {response.status_code}: {response.text}")

            dis_result = response.json()

            if dis_result.get("status") == "error":
                raise RuntimeError(f"DIS reported error: {dis_result.get('detail')}")

            dis_data = dis_result.get("data", {})

        except Exception as e:
            logger.error(f"DIS invocation failed: {e}")
            _update_db_failed(db, document_id, "DIS_INVOCATION_FAILED", str(e))
            message.ack()
            return

        # 4. Parse Results & Update DB
        dis_data = dis_result.get("data", {})

        if used_stateless_extract:
            # Stateless extract returns: {extracted_data: {...}}
            extraction_result = dis_data.get("extracted_data", {})
            doc_type = DIS_TO_SLOT_ID_MAP.get(user_selected_type, "OTHER")
        else:
            # Classify returns: {classified_document: {...}, extraction_result: {...}}
            classified_doc = dis_data.get("classified_document", {})
            extraction_result = dis_data.get("extraction_result", {})
            raw_doc_type = classified_doc.get("document_type", "unknown")
            doc_type = DIS_TO_SLOT_ID_MAP.get(raw_doc_type, "OTHER")

        raw_data = extraction_result if extraction_result else {}

        warnings = raw_data.get("warnings", []) if isinstance(raw_data, dict) else []
        new_status = DocumentStatusType.READY_FOR_REVIEW.value
        user_error_code = warnings[0] if warnings else None

        result = db.execute(
            text("""
                UPDATE user_documents
                SET status = :new_status,
                    document_type = :doc_type,
                    raw_data = CAST(:raw_data AS JSONB),
                    user_error_code = :user_error_code,
                    updated_at = NOW()
                WHERE document_id = :doc_id AND status = 'processing'
            """),
            {
                "new_status": new_status,
                "doc_type": doc_type,
                "raw_data": json.dumps(raw_data),
                "user_error_code": user_error_code,
                "doc_id": document_id,
            },
        )
        db.commit()

        if result.rowcount == 0:
            logger.warning(f"Optimistic lock failed for document {document_id}. Row state changed during processing.")
        else:
            logger.info(f"Successfully processed document {document_id}. Status: COMPLETED.")

            # Trigger real-time secure notification update back to middleware server
            try:
                middleware_url = os.environ.get("MIDDLEWARE_SERVICE_URL", "http://localhost:8080")
                internal_key = os.environ.get("INTERNAL_API_KEY")

                if not internal_key:
                    logger.warning("INTERNAL_API_KEY not set; skipping internal notification")
                else:
                    with httpx.Client(timeout=5.0) as client:
                        notify_resp = client.post(
                            f"{middleware_url}/api/v1/internal/documents/{document_id}/notify",
                            headers={"X-Internal-Token": internal_key},
                        )
                    logger.info(f"Internal websocket notification dispatched. Status: {notify_resp.status_code}")
            except Exception as net_err:
                logger.error(f"Failed to send internal notification callback: {net_err}")

        message.ack()

    except Exception as e:
        logger.error(f"Unexpected error processing message: {e}", exc_info=True)
        message.nack()
    finally:
        db.close()


def _update_db_failed(db, document_id, error_code, internal_log):
    try:
        result = db.execute(
            text("""
                UPDATE user_documents
                SET status = :new_status,
                    user_error_code = :error_code,
                    internal_error_log = :internal_log,
                    raw_data = CAST('{}' AS JSONB),
                    updated_at = NOW()
                WHERE document_id = :doc_id AND status = 'processing'
            """),
            {
                "new_status": DocumentStatusType.FAILED.value,
                "error_code": error_code,
                "internal_log": internal_log,
                "doc_id": document_id,
            },
        )
        db.commit()
        if result.rowcount == 0:
            logger.warning(f"Optimistic lock failed when marking document {document_id} as FAILED.")
    except Exception as e:
        logger.error(f"Failed to update DB to FAILED for {document_id}: {e}")


def main():
    initialize_pubsub()

    subscriber = get_subscriber_client()
    subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_ID)

    concurrency = int(os.environ.get("WORKER_CONCURRENCY", "80"))
    logger.info(f"Starting worker with concurrency level: {concurrency}...")

    flow_control = FlowControl(
        max_messages=concurrency * 2,
        max_bytes=100 * 1024 * 1024,  # 100 MB
    )

    executor = ThreadPoolExecutor(max_workers=concurrency)
    scheduler = ThreadScheduler(executor=executor)

    streaming_pull_future = subscriber.subscribe(
        subscription_path,
        callback=process_message,
        flow_control=flow_control,
        scheduler=scheduler,
    )

    while not shutdown_requested:
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            break

    logger.info("Shutting down subscriber...")
    streaming_pull_future.cancel()
    try:
        streaming_pull_future.result(timeout=5)
    except Exception as e:
        logger.error(f"Error during subscriber shutdown: {e}")

    logger.info("Worker stopped.")


if __name__ == "__main__":
    main()
