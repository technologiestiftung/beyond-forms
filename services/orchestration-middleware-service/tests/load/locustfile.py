import os
from locust import HttpUser, task, between, events

# 1. Resolve dynamic path to shared high-fidelity Helmut Klar test fixtures
FIXTURES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "wallet-frontend", "tests", "fixtures")
)

MOCK_PAYLOADS = {}

SHARED_TOKEN = None


@events.init.add_listener
def on_locust_init(environment, **kwargs):
    """
    Pre-loads the mock binaries from the shared wallet-frontend fixtures
    directly into RAM once at controller startup, completely avoiding
    per-task disk I/O queue starvation.
    Also pre-authenticates a single OIDC token to share across users.
    """
    global SHARED_TOKEN
    targets = {
        "pension_proof.pdf": "Grundsicherung_Rentenbescheid_Helmut Klar.pdf",
        "rent_proof.pdf": "Beispiel Mietvertrag.pdf",
        "bank_statement.pdf": "Bank_Statement_Helmut_Klar.pdf",
    }

    print("Initializing high-fidelity mock payloads in RAM...")
    for alias, filename in targets.items():
        full_path = os.path.join(FIXTURES_DIR, filename)
        if os.path.exists(full_path):
            try:
                with open(full_path, "rb") as f:
                    MOCK_PAYLOADS[alias] = f.read()
                print(f"Pre-loaded {alias} ({len(MOCK_PAYLOADS[alias])} bytes) from {filename}")
            except Exception as e:
                print(f"Failed to read payload {filename}: {e}")
        else:
            # Fallback synthetic bytes if fixtures are missing in the runner context
            MOCK_PAYLOADS[alias] = b"%PDF-1.4 mock synthetic content"
            print(f"Warning: Fixture {filename} not found at {full_path}. Initialized fallback synthetic bytes.")

    # 2. Pre-authenticate test user
    if os.environ.get("MOCK_AUTH_PASS") == "true":
        SHARED_TOKEN = "mock_ci_token_value"
    else:
        import requests

        auth_url = os.environ.get("AUTH_SERVICE_URL", "http://localhost:8003")
        phone_number = "+49302312500"  # Helmut Klar drama number

        session = requests.Session()
        try:
            print(f"Pre-authenticating test user {phone_number} via {auth_url}...")
            start_resp = session.post(f"{auth_url}/login/start", json={"phone_number": phone_number}, timeout=15.0)
            if start_resp.status_code >= 400:
                raise Exception(f"Failed to start login: {start_resp.text}")

            finish_resp = session.post(f"{auth_url}/login/finish", json={"code": "111111"}, timeout=15.0)
            if finish_resp.status_code >= 400:
                raise Exception(f"Failed to finish login: {finish_resp.text}")

            SHARED_TOKEN = finish_resp.json().get("token")
            if SHARED_TOKEN:
                print(f"🟢 Successfully pre-authenticated shared token for {phone_number}.")
            else:
                print("❌ Auth service did not return a token.")
                SHARED_TOKEN = "local_development_fallback_token"
        except Exception as e:
            print(f"⚠️ Pre-authentication failed: {e}. Falling back to dev token.")
            SHARED_TOKEN = "local_development_fallback_token"


class BeyondFormsCitizen(HttpUser):
    """
    Simulates a virtual citizen performing actions along the Helmut Klar onboarding path.
    Uses the authentic API endpoints, request methods, and async background status checks.
    """

    wait_time = between(2.0, 5.0)
    token = None
    headers = {}

    def on_start(self):
        """
        Assigns the pre-authenticated shared token to the user session.
        """
        self.token = SHARED_TOKEN
        self.headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/json"}

    @task(1)
    def view_dashboard(self):
        """
        Simulates viewing the main files dashboard overview.
        Calls the authentic GET /files route.
        """
        self.client.get("/files", headers=self.headers)

    @task(3)
    def upload_and_verify_pension(self):
        """
        Uploads a 5MB Pension Statement PDF utilizing the async workflow.
        Uses the direct /upload route in the middleware and polls the authentic
        /files endpoint in a loop, checking for rate limits and worker crashes.
        """
        file_data = MOCK_PAYLOADS.get("pension_proof.pdf", b"")
        files = {"file": ("pension_proof.pdf", file_data, "application/pdf")}

        # Replicates the actual middleware file upload API call
        with self.client.post("/upload", files=files, headers=self.headers, catch_response=True) as response:
            if response.status_code != 201:
                response.failure(f"Document upload failed with HTTP status {response.status_code}: {response.text}")
                return

            data = response.json()
            document_id = data.get("document_id")
            if not document_id:
                response.failure(f"Upload response is missing document_id field: {data}")
                return

        # Start the status verification loop
        self.wait_for_background_ocr(document_id)

    def wait_for_background_ocr(self, document_id):
        """
        Polls the backend listing endpoint to monitor background document extraction status.
        Capped at 40 iterations with think time (representing ~2.5 minutes average, up to 4 minutes).
        Triggers formal Locust errors if worker timeouts or Vertex 429 quota limits occur.
        """
        # Maximum 40 polling steps
        max_polls = 40
        verified = False

        for poll_idx in range(max_polls):
            self.wait()

            # Replicates Playwright E2E tests: calls GET /files to read the status of the target ID
            with self.client.get("/files", headers=self.headers, catch_response=True) as response:
                if response.status_code != 200:
                    response.failure(f"Status polling on /files failed: {response.status_code}")
                    break

                files_list = response.json()
                target_doc = next((doc for doc in files_list if doc.get("document_id") == document_id), None)

                if not target_doc:
                    response.failure(
                        f"Uploaded document {document_id} was deleted or not found in user documents list."
                    )
                    break

                status = target_doc.get("status")

                # Extraction Successful
                if status in ["READY_FOR_REVIEW", "VERIFIED"]:
                    verified = True
                    break

                # Extraction Failed: Extract the exact background worker error code
                elif status == "FAILED":
                    error_code = target_doc.get("user_error_code", "UNKNOWN_BACKGROUND_ERROR")
                    if error_code == "RATE_LIMIT_EXCEEDED":
                        response.failure("Vertex AI Quota limit hit: Asynchronous HTTP 429 Rate Limit Exhausted.")
                    elif error_code == "DIS_INVOCATION_FAILED":
                        response.failure("Synchronous HTTP Timeout Trap: Worker exceeded 60s timeout waiting for DIS.")
                    else:
                        response.failure(f"Background worker processing failed with error code: {error_code}")
                    break

        if not verified and poll_idx == max_polls - 1:
            response.failure("Staging Timeout Alert: Background OCR failed to resolve within 4 minutes.")

    @task(2)
    def generate_pdf_export(self):
        """
        Simulates exporting the completed benefits application in PDF format.
        Calls the authentic GET /export/{form_type} route, validating that the
        LRU FormAssetCacheManager handles concurrent fills without filesystem stampedes.
        """
        form_type = "antrag_grundsicherung"
        with self.client.get(f"/export/{form_type}", headers=self.headers, catch_response=True) as response:
            if response.status_code != 200:
                response.failure(
                    f"PDF Benefits Export failed for {form_type}: {response.status_code} - {response.text}"
                )
            else:
                # Validate that the returned response is a valid PDF stream
                content_type = response.headers.get("content-type", "")
                if "application/pdf" not in content_type:
                    response.failure(
                        f"PDF Export returned incorrect Content-Type '{content_type}', expected 'application/pdf'"
                    )
                elif not response.content.startswith(b"%PDF"):
                    response.failure(
                        "PDF Export returned corrupt or empty payload: response stream does not start with %PDF"
                    )
