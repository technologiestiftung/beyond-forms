import uuid
from unittest.mock import MagicMock, AsyncMock

import pytest
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from src.db import get_db
from src.main import app
from src.models import Users as DbUser, UserApplications as DbApplication, StatusType

client = TestClient(app)


@pytest.fixture
def mock_db():
    """Fixture to provide a mocked SQLAlchemy session."""
    mock = MagicMock(spec=Session)
    return mock


@pytest.fixture(autouse=True)
def override_dependencies(mock_db):
    """Fixture to override FastAPI dependencies for all tests."""

    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id-uuid", user_name="1234567890", session_id="test-session-id", is_authenticated=True
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user

    # Initialize state for tests that use state.http_client
    app.state.http_client = MagicMock()
    app.state.http_client.post = AsyncMock()

    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_application_status_success(mock_db):
    app_id = uuid.uuid4()
    local_user_id = uuid.uuid4()
    auth_sub = "test-auth-id-uuid"

    mock_user = DbUser(
        id=local_user_id,
        authentik_id=auth_sub,
        phone_number="1234567890",
        first_name="filled_val",
        last_name="filled_val",
        date_of_birth="filled_val",
        place_of_birth="filled_val",
        accomodation_type="filled_val",
    )
    mock_application = DbApplication(
        application_id=app_id,
        fk_user_id=local_user_id,
        form_type="user_information",
        status=StatusType.IN_PROGRESS,
        form_data={"first_name": "Jane"},
    )

    # Mock user query (by authentik_id) followed by application query
    mock_db.query.return_value.filter.return_value.first.side_effect = [mock_user, mock_application]

    # Mock rules engine response via shared http_client
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "status": "error",
        "code": 422,
        "total_required_fields": 10,
        "missing_field_count": 5,
        "is_submittable": False,
        "missing_fields": ["last_name", "birth_date"],
        "validation_errors": [{"field_path": "last_name", "message": "Field required", "type": "missing"}],
    }
    mock_response.status_code = 422

    # Set the return value of the async post
    app.state.http_client.post.return_value = mock_response

    response = client.get(f"/application/{app_id}/status")

    assert response.status_code == 200
    data = response.json()
    assert data["application_id"] == str(app_id)
    assert data["completeness"] == 50
    assert data["can_submit"] is False
    assert len(data["missing_fields"]) == 2

    # Verify shared client was used with correct params
    app.state.http_client.post.assert_called_once()
    args, kwargs = app.state.http_client.post.call_args
    assert kwargs["params"] == {"validate_entire_form": True}


@pytest.mark.asyncio
async def test_get_application_status_zero_fields_safeguard(mock_db):
    app_id = uuid.uuid4()
    local_user_id = uuid.uuid4()
    auth_sub = "test-auth-id-uuid"

    mock_user = DbUser(
        id=local_user_id,
        authentik_id=auth_sub,
        first_name="filled_val",
        last_name="filled_val",
        date_of_birth="filled_val",
        place_of_birth="filled_val",
        accomodation_type="filled_val",
        tenancy_status="filled_val",
        bank_name="filled_val",
        account_holder="filled_val",
        iban="filled_val",
        persons_in_household_count=1,
    )
    mock_application = DbApplication(
        application_id=app_id,
        fk_user_id=local_user_id,
        form_type="user_information",
        status=StatusType.IN_PROGRESS,
        form_data={},
    )

    mock_db.query.return_value.filter.return_value.first.side_effect = [mock_user, mock_application]

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "status": "success",
        "total_required_fields": 0,
        "missing_field_count": 0,
        "is_submittable": True,
    }
    mock_response.status_code = 200
    app.state.http_client.post.return_value = mock_response

    response = client.get(f"/application/{app_id}/status")

    assert response.status_code == 200
    assert response.json()["completeness"] == 100


def test_get_application_status_not_found(mock_db):
    app_id = uuid.uuid4()

    # Mock user lookup returns None
    mock_db.query.return_value.filter.return_value.first.return_value = None

    response = client.get(f"/application/{app_id}/status")
    assert response.status_code == 404
    assert response.json()["detail"] == "User profile not found"


@pytest.mark.asyncio
async def test_evaluate_wizard_endpoint_success():
    payload = {"form_content": {"eligibility_check": {"lives_in_germany": True}}}
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "status": "success",
        "evaluation": {
            "visited_steps": ["step_eligibility_nationality"],
            "next_step": "step_eligibility_residence",
            "required_documents": [],
            "missing_fields": ["eligibility_check.lives_in_germany"],
            "pending_step_id": "step_eligibility_residence",
        },
    }
    mock_response.status_code = 200
    app.state.http_client.post.return_value = mock_response

    response = client.post("/application/evaluate", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["evaluation"]["next_step"] == "step_eligibility_residence"
