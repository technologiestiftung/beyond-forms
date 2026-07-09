import os
import json
import logging
from datetime import datetime
from locust import HttpUser, task, between, events

# Configure logging
logger = logging.getLogger(__name__)

# Resolve absolute path to the German ID fixture from wallet-frontend
FIXTURE_PATH = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "..",
        "wallet-frontend",
        "tests",
        "fixtures",
        "Personalausweis_ Helmut_Klar.png",
    )
)

FILE_BYTES = None
RESPONSES_LOG_PATH = "/tmp/beyondforms-doc-intel-reports/raw_responses.jsonl"


@events.init.add_listener
def on_locust_init(environment, **kwargs):
    """
    Pre-loads the German ID image fixture into RAM on startup
    to prevent disk I/O bottlenecks during load testing.
    Also ensures the response log directory exists and starts fresh.
    """
    global FILE_BYTES
    logger.info(f"Pre-loading German ID fixture from {FIXTURE_PATH}...")

    if os.path.exists(FIXTURE_PATH):
        try:
            with open(FIXTURE_PATH, "rb") as f:
                FILE_BYTES = f.read()
            logger.info(f"Successfully loaded fixture: {len(FILE_BYTES)} bytes")
        except Exception as e:
            logger.error(f"Failed to read fixture: {e}")
    else:
        # High-quality 1x1 png fallback just in case path changes in some environments
        FILE_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
        logger.warning("Fixture not found! Initialized fallback 1x1 pixel PNG bytes.")

    # Ensure response log directory exists
    try:
        os.makedirs(os.path.dirname(RESPONSES_LOG_PATH), exist_ok=True)
        # Clear or initialize the file
        with open(RESPONSES_LOG_PATH, "w", encoding="utf-8") as f:
            f.write("")
        logger.info(f"Initialized raw response log file at: {RESPONSES_LOG_PATH}")
    except Exception as e:
        logger.error(f"Failed to initialize response log file: {e}")


class DocumentIntelligenceUser(HttpUser):
    """
    Simulates clients sending German ID documents to the document-intelligence-service.
    """

    wait_time = between(1.0, 3.0)

    @task
    def classify_document(self):
        """
        Sends the German ID image to the /classify endpoint.
        Uses the default model, and sets entity-extraction to True.
        Logs the raw response of the call to the log file.
        """
        if FILE_BYTES is None:
            logger.error("No fixture bytes available for load test.")
            return

        files = {"file": ("Personalausweis_ Helmut_Klar.png", FILE_BYTES, "image/png")}
        data = {"entity-extraction": "True"}

        # POST /classify with multipart form data
        with self.client.post("/classify", files=files, data=data, catch_response=True) as response:
            # Capture the raw response data immediately
            log_entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "status_code": response.status_code,
                "response_body": response.text,
            }

            # Append the raw response to the log file
            try:
                with open(RESPONSES_LOG_PATH, "a", encoding="utf-8") as f:
                    f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
            except Exception as e:
                logger.error(f"Failed to write raw response to log file: {e}")

            if response.status_code != 200:
                response.failure(f"HTTP {response.status_code} received: {response.text}")
                return

            try:
                result = response.json()
                status = result.get("status")
                if status != "success":
                    response.failure(f"API status was not 'success': {status}. Details: {result.get('detail')}")
                else:
                    response.success()
            except Exception as e:
                response.failure(f"Failed to parse JSON response: {e}")
