from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy!"}


def test_cors():
    # Test allowed origin
    response = client.options(
        "/health",
        headers={
            "Origin": "https://beyond-forms-frontend.web.app",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://beyond-forms-frontend.web.app"

    # Test disallowed origin
    response = client.options(
        "/health",
        headers={
            "Origin": "https://unknown-origin.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    # Disallowed origins should not receive the allow-origin header
    assert "access-control-allow-origin" not in response.headers
