import uuid
from unittest.mock import MagicMock, AsyncMock
import pytest
from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from src.db import get_db
from src.main import app
from src.models import Users as DbUser, UserApplications as DbApplication, StatusType, UserDocuments

client = TestClient(app)


@pytest.fixture
def mock_db():
    mock = MagicMock(spec=Session)
    return mock


@pytest.fixture(autouse=True)
def override_dependencies(mock_db):
    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id-uuid", user_name="1234567890", session_id="test-session-id", is_authenticated=True
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user

    app.state.http_client = MagicMock()
    app.state.http_client.post = AsyncMock()

    yield
    app.dependency_overrides.clear()


@pytest.mark.parametrize(
    "req_total, req_missing, opt_total, opt_missing, docs_verified, expected_level",
    [
        (10, 10, 6, 6, False, 0),  # Level 0: 0% mandatory filled
        (10, 9, 6, 6, False, 1),  # Level 1: 10% mandatory filled
        (10, 8, 6, 6, False, 1),  # Level 1: 20% mandatory filled
        (10, 7, 6, 6, False, 2),  # Level 2: 30% mandatory filled
        (10, 1, 6, 6, False, 2),  # Level 2: 90% mandatory filled
        (10, 0, 6, 4, False, 2),  # Level 2: 100% mandatory, 2/6 optional filled (33% < 50%)
        (10, 0, 6, 3, False, 2),  # Level 2: 100% mandatory, 3/6 optional filled (50%), docs False
        (10, 0, 6, 3, True, 3),  # Level 3: 100% mandatory, 3/6 optional filled (50%), docs True
        (10, 0, 6, 0, True, 3),  # Level 3: 100% mandatory, 6/6 optional filled (100%), docs True
    ],
)
@pytest.mark.asyncio
async def test_application_milestone_levels(
    mock_db, req_total, req_missing, opt_total, opt_missing, docs_verified, expected_level
):
    app_id = uuid.uuid4()
    local_user_id = uuid.uuid4()
    auth_sub = "test-auth-id-uuid"

    mock_user = DbUser(id=local_user_id, authentik_id=auth_sub, phone_number="1234567890")

    MANDATORY_FIELDS = [
        "first_name",
        "last_name",
        "date_of_birth",
        "place_of_birth",
        "accomodation_type",
        "tenancy_status",
        "bank_name",
        "account_holder",
        "iban",
        "persons_in_household_count",
    ]
    OPTIONAL_FIELDS = ["legal_gender", "nationality", "rent_total", "heating_costs", "marital_status", "married_since"]

    filled_mandatory = req_total - req_missing
    for i in range(filled_mandatory):
        setattr(mock_user, MANDATORY_FIELDS[i], "filled_val")

    filled_optional = opt_total - opt_missing
    for i in range(filled_optional):
        setattr(mock_user, OPTIONAL_FIELDS[i], "filled_val")

    mock_application = DbApplication(
        application_id=app_id,
        fk_user_id=local_user_id,
        form_type="user_information",
        status=StatusType.IN_PROGRESS,
        form_data={},
    )

    def db_query_side_effect(model):
        query_mock = MagicMock()
        if model is DbUser:
            query_mock.filter.return_value.first.return_value = mock_user
        elif model is DbApplication:
            query_mock.filter.return_value.first.return_value = mock_application
        elif model is UserDocuments:
            if docs_verified:
                query_mock.filter.return_value.first.return_value = MagicMock()
            else:
                query_mock.filter.return_value.first.return_value = None
        return query_mock

    mock_db.query.side_effect = db_query_side_effect

    mock_response = MagicMock()
    mock_response.json.return_value = {
        "status": "success",
        "total_required_fields": req_total,
        "missing_field_count": req_missing,
        "total_optional_fields": opt_total,
        "missing_optional_field_count": opt_missing,
        "is_submittable": expected_level == 3,
        "required_documents": ["ID_CARD"] if req_missing == 0 else [],
    }
    mock_response.status_code = 200
    app.state.http_client.post.return_value = mock_response

    response = client.get(f"/application/{app_id}/status")

    assert response.status_code == 200
    data = response.json()
    assert data["milestone_level"] == expected_level
