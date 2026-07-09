import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import MagicMock

from beyondforms.auth import User as AuthUser, get_current_user, require_authenticated_user
from src.db import get_db
from src.main import app
from src.models import CmsTutorials, UserTutorialStates
from src.services.user_service import UserService, get_user_service

client = TestClient(app)


@pytest.fixture
def mock_db():
    mock = MagicMock(spec=Session)
    return mock


@pytest.fixture
def mock_user_service():
    mock = MagicMock(spec=UserService)
    mock.get_internal_user_id.return_value = "test-user-id"
    return mock


@pytest.fixture(autouse=True)
def override_dependencies(mock_db, mock_user_service):
    def override_get_current_user():
        return AuthUser(
            user_id="test-auth-id",
            user_name="1234567890",
            session_id="test-session-id",
            is_authenticated=True,
        )

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_authenticated_user] = override_get_current_user
    app.dependency_overrides[get_user_service] = lambda: mock_user_service
    yield
    app.dependency_overrides.clear()


def test_get_my_tutorials_success(mock_db):
    mock_tutorial = MagicMock(
        id=uuid.uuid4(),
        slug="slug",
        title={"en": "Title"},
        subtitle={"en": "Subtitle"},
        content=[],
        sort_order=1,
    )
    mock_state = MagicMock(status="in_progress", current_step="welcome")

    def mock_query(*args):
        mock = MagicMock()
        if args == (CmsTutorials, UserTutorialStates):
            mock.outerjoin.return_value.order_by.return_value.all.return_value = [(mock_tutorial, mock_state)]
        return mock

    mock_db.query.side_effect = mock_query

    response = client.get("/cms/my-tutorials")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["slug"] == "slug"
    assert data[0]["subtitle"] == {"en": "Subtitle"}
    assert data[0]["progress"]["status"] == "in_progress"
    assert "steps" in data[0]
    assert "content" not in data[0]


def test_get_my_tutorials_user_not_found(mock_db, mock_user_service):
    from fastapi import HTTPException

    mock_user_service.get_internal_user_id.side_effect = HTTPException(status_code=404, detail="User not found")

    response = client.get("/cms/my-tutorials")
    assert response.status_code == 200
    assert response.json() == []


def test_patch_progress_success(mock_db):
    mock_tutorial = MagicMock(id=uuid.uuid4())

    def mock_query(*args):
        mock = MagicMock()
        if args == (CmsTutorials,):
            mock.filter.return_value.first.return_value = mock_tutorial
        return mock

    mock_db.query.side_effect = mock_query

    response = client.patch(
        "/cms/my-tutorials/progress",
        json={"tutorial_id": str(mock_tutorial.id), "status": "in_progress", "current_step": "welcome"},
    )
    assert response.status_code == 200
    assert mock_db.execute.called
    assert mock_db.commit.called


def test_patch_progress_tutorial_not_found(mock_db):
    def mock_query(*args):
        mock = MagicMock()
        if args == (CmsTutorials,):
            mock.filter.return_value.first.return_value = None
        return mock

    mock_db.query.side_effect = mock_query

    response = client.patch(
        "/cms/my-tutorials/progress",
        json={"tutorial_id": str(uuid.uuid4()), "status": "in_progress", "current_step": "welcome"},
    )
    assert response.status_code == 404
    assert "Tutorial not found" in response.json()["detail"]
