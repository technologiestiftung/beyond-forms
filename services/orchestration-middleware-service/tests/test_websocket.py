import pytest
import uuid
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from fastapi import WebSocketDisconnect

from src.main import app
from src.models import Users

client = TestClient(app)


def test_websocket_missing_token():
    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/documents") as _websocket:
            pass
    assert exc_info.value.code == 4001


@patch("src.main.get_current_user", new_callable=AsyncMock)
def test_websocket_invalid_auth(mock_get_user):
    mock_get_user.return_value = None

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/documents?token=invalid") as _websocket:
            pass
    assert exc_info.value.code == 4003


@patch("src.main.SessionLocal")
@patch("src.main.get_current_user", new_callable=AsyncMock)
def test_websocket_user_not_found(mock_get_user, mock_session_local):
    # Setup mock user
    mock_user = MagicMock()
    mock_user.user_name = "1234567890"
    mock_get_user.return_value = mock_user

    # Setup mock database query returning None (user not found)
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    mock_session_local.return_value = mock_db

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/documents?token=valid-token") as _websocket:
            pass
    assert exc_info.value.code == 4004
    mock_db.close.assert_called_once()


@patch("src.main.SessionLocal")
@patch("src.main.get_current_user", new_callable=AsyncMock)
def test_websocket_database_error(mock_get_user, mock_session_local):
    mock_user = MagicMock()
    mock_user.user_name = "1234567890"
    mock_get_user.return_value = mock_user

    # Setup mock database query raising an exception
    mock_db = MagicMock()
    mock_db.query.side_effect = Exception("DB connection failure")
    mock_session_local.return_value = mock_db

    with pytest.raises(WebSocketDisconnect) as exc_info:
        with client.websocket_connect("/ws/documents?token=valid-token") as _websocket:
            pass
    # Exception caught and socket closed with 4500
    assert exc_info.value.code == 4500
    mock_db.close.assert_called_once()


@patch("src.main.SessionLocal")
@patch("src.main.get_current_user", new_callable=AsyncMock)
def test_websocket_success(mock_get_user, mock_session_local):
    mock_user = MagicMock()
    mock_user.user_name = "1234567890"
    mock_get_user.return_value = mock_user

    # Setup mock database returning a valid User row
    db_user = Users(id=uuid.uuid4(), phone_number="1234567890")
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = db_user
    mock_session_local.return_value = mock_db

    with client.websocket_connect("/ws/documents?token=valid-token") as _websocket:
        # Connection should be accepted and kept open
        # We can close it manually or let the block exit
        pass

    mock_db.close.assert_called_once()
