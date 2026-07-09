# BeyondForms Pragmatic Load Testing Framework

This directory contains load testing framework designed to stress-test the BeyondForms microservices under real-world workshop conditions (**20–50 concurrent users**).

It is powered by **Locust** and leverages the existing **Helmut Klar** staging mock document fixtures.

---

## 1. Core Testing Blueprints

Each simulated Locust user performs authentic user flows in a highly concurrent coroutine loop:

1.  **Authentication**: Log in via `/auth/token` to acquire a bearer token. Supports `MOCK_AUTH_PASS=true` to bypass external auth systems in CI.
2.  **Dashboard Viewing**: Hammer the lightweight `GET /files` endpoint.
3.  **High-Fidelity Document Upload**: Sends the 5MB `Grundsicherung_Rentenbescheid_Helmut Klar.pdf` binary directly via the `POST /upload` endpoint.
4.  **Asynchronous Background Polling**: Polls `GET /files` up to 4 minutes (mimicking Playwright tests) and checks status. Captures background worker crashes (e.g., 60s timeouts) and asynchronous Vertex AI HTTP 429 rate-limits.
5.  **PDF Application Export**: Calls `GET /export/Grundsicherung` to test PDF generation under concurrent, stampede-heavy load.

---

## 2. Local Development Quickstart

To run the load tests locally in interactive mode (with the beautiful Locust Web GUI):

1.  Ensure your local docker stack is running and hot-reloaded:
    ```bash
    docker compose up
    ```
2.  Install dependencies and execute Locust:
    ```bash
    # Enter middleware directory
    cd services/orchestration-middleware-service/

    # Run Locust with uv
    uv run locust -f tests/load/locustfile.py -H http://localhost:8080
    ```
3.  Open [http://localhost:8089](http://localhost:8089) in your browser.
4.  Set the parameters:
    - **Number of Users**: `20`
    - **Spawn Rate**: `5` users per second
    - **Host**: `http://localhost:8080`
5.  Click **Start swarming** and watch the live latency percentiles and exception charts.

---

## 3. Automated CI/CD Execution (Headless Mode)

We have provided a robust execution wrapper script `run_load_test.sh` designed for automated staging pipeline validation.

It runs the load test headlessly for **3 minutes** under a concurrent load of **20 users**, enforcing a strict performance budget:

- **95th percentile latency** for PDF Benefits Export $\le 5.0$ seconds.
- **Total error rate** $\le 1\%$.
- Exit code will be non-zero (`1`) if the budget is violated, instantly failing the build.

### Running the automated pipeline check:

```bash
# Grant executable permissions
chmod +x tests/load/run_load_test.sh

# Execute headless load check against target host
./tests/load/run_load_test.sh http://localhost:8080
```

---

## 4. Performance Verification Strategy

To verify that the staging environment is fully futureproof:

- **CPU/RAM Consumption**: Monitor container RAM during swarming (`docker stats orchestration-middleware-service`). Due to GCS stream handling and RAM pre-loading in Locust, memory usage should remain completely flat ($< 150\text{MB}$).
- **System Latency**: Verify that under concurrent request load, the average and 95th percentile latency for endpoints remain within acceptable bounds.
