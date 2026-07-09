from typing import Annotated, Any, Dict, List

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from src.app.main import app

client = TestClient(app)


class MockForm(BaseModel):
    user_identifier: str = Field(description="A unique string")


MockFieldType = Annotated[str, Field(pattern=r"^\d{3}$")]


@pytest.fixture
def mock_registries(monkeypatch) -> Dict[str, Dict[str, Any]]:
    mock_forms: Dict[str, Any] = {"unemployment_benefit": MockForm, "mock_form": MockForm}
    mock_fields: Dict[str, Any] = {"email_address": MockFieldType, "mock_field": MockFieldType}

    monkeypatch.setattr("src.app.main.form_registry._registry", mock_forms)
    monkeypatch.setattr("src.app.main.field_registry._registry", mock_fields)

    return {"forms": mock_forms, "fields": mock_fields}


def test_health_check_endpoint_returns_ok_status() -> None:
    response = client.get("/health")
    response_payload: Dict[str, Any] = response.json()

    assert response.status_code == 200
    assert response_payload["status"] == "success"
    assert response_payload["code"] == 200


def test_get_forms_returns_all_registered_keys(mock_registries: Dict[str, Dict[str, Any]]) -> None:
    response = client.get("/get-available-forms")
    response_data: Dict[str, Any] = response.json()
    expected_forms: List[str] = list(mock_registries["forms"].keys())

    assert response.status_code == 200
    assert response_data["status"] == "success"
    assert set(response_data["available-forms"]) == set(expected_forms)


def test_get_field_types_returns_all_registered_keys(mock_registries: Dict[str, Dict[str, Any]]) -> None:
    response = client.get("/get-available-field-types")
    response_data: Dict[str, Any] = response.json()
    expected_fields: List[str] = list(mock_registries["fields"].keys())

    assert response.status_code == 200
    assert response_data["status"] == "success"
    assert set(response_data["available-field-types"]) == set(expected_fields)


def test_get_form_definition_returns_schema_for_existing_form(mock_registries: Dict[str, Any]) -> None:
    response = client.get("/get-form-definition/mock_form")
    response_data = response.json()

    assert response.status_code == 200
    assert response_data["code"] == 200
    assert "properties" in response_data["form-definition"]
    assert response_data["form-definition"]["properties"]["user_identifier"]["type"] == "string"


def test_get_form_definition_returns_404_for_missing_form(mock_registries: Dict[str, Any]) -> None:
    response = client.get("/get-form-definition/non_existent_form")
    response_data = response.json()

    assert response.status_code == 404
    assert response_data["status"] == "error"
    assert "not found" in response_data["detail"]
