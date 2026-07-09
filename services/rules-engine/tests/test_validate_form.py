import pytest
from datetime import date, timedelta
from typing import Any, Dict

from fastapi.testclient import TestClient

from src.app.main import app
from src.app.domain.forms import UserInformation  # Import the real model to test validators

client = TestClient(app)


@pytest.fixture
def mock_form_registry(monkeypatch) -> Dict[str, Any]:
    mock_data = {"user_information": UserInformation}
    monkeypatch.setattr("src.app.main.form_registry._registry", mock_data)
    return mock_data


def test_validate_form_returns_success_for_valid_user_information(mock_form_registry: Dict[str, Any]) -> None:
    valid_payload: Dict[str, Any] = {
        "form_type": "user_information",
        "form_content": {
            "first_name": "Jane",
            "last_name": "Doe",
            "middle_name": "Quinn",
            "birth_date": "1990-05-15",
            "gender": "FEMALE",
            "nationality": "US",
            "city_of_birth": "New York",
            "country_of_birth": "US",
        },
    }

    response = client.post("/validate-form", json=valid_payload)
    response_data = response.json()

    assert response.status_code == 200
    assert response_data["status"] == "success"
    assert response_data["form_content"]["first_name"] == "Jane"
    assert "total_required_fields" in response_data
    assert response_data["is_submittable"] is True


def test_validate_form_returns_error_for_unregistered_form_type(mock_form_registry: Dict[str, Any]) -> None:
    unregistered_payload: Dict[str, Any] = {
        "form_type": "invalid_form_slug",
        "form_content": {"some_field": "some_value"},
    }

    response = client.post("/validate-form", json=unregistered_payload)
    response_data = response.json()

    assert response.status_code == 404
    assert "not found. Available:" in response_data["detail"]


def test_validate_form_returns_error_for_missing_required_fields(mock_form_registry: Dict[str, Any]) -> None:
    incomplete_payload: Dict[str, Any] = {
        "form_type": "user_information",
        "form_content": {"first_name": "Jane"},
    }

    response = client.post("/validate-form?validate_entire_form=True", json=incomplete_payload)
    response_data = response.json()

    assert response.status_code == 422
    assert response_data["status"] == "error"
    assert any("last_name" in error["field_path"] for error in response_data["validation_errors"])
    assert "total_required_fields" in response_data
    assert response_data["is_submittable"] is False


def test_validate_form_returns_error_for_invalid_field_data(mock_form_registry: Dict[str, Any]) -> None:
    future_date: str = (date.today() + timedelta(days=1)).isoformat()

    invalid_data_payload: Dict[str, Any] = {
        "form_type": "user_information",
        "form_content": {
            "first_name": "Jane",
            "last_name": "Doe",
            "birth_date": future_date,  # This triggers the AfterValidator(validate_date_is_not_future)
            "gender": "FEMALE",
            "nationality": "US",
            "city_of_birth": "New York",
            "country_of_birth": "US",
        },
    }

    response = client.post("/validate-form", json=invalid_data_payload)
    response_data = response.json()

    assert response.status_code == 422
    assert any("date" in error["field_path"] for error in response_data["validation_errors"])
    assert any("future" in error["message"].lower() for error in response_data["validation_errors"])
