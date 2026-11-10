import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.routes import llm

PROFILE = {"first_name": "Sabine", "associated_persons": []}


def _client_answering(handler):
    real_client = httpx.AsyncClient
    return lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)


@pytest.mark.asyncio
async def test_check_progress_status_asks_the_eligibility_service_with_the_stored_profile():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"form": "antrag_kinderzuschlag", "complete": False, "next": {"field": "iban"}})

    with (
        patch.object(llm, "ENDPOINT_ELIGIBILITY_SERVICE", "http://eligibility-service:8080"),
        patch.object(llm, "get_user_data", new=AsyncMock(return_value=PROFILE)),
        patch.object(llm.httpx, "AsyncClient", new=_client_answering(handler)),
    ):
        result = await llm.check_progress_status(
            MagicMock(), MagicMock(), MagicMock(), form_type="antrag_kinderzuschlag"
        )

    assert result["next"] == {"field": "iban"}
    assert str(requests[0].url) == "http://eligibility-service:8080/applications/antrag_kinderzuschlag/progress"
    assert json.loads(requests[0].content) == {"profile": PROFILE, "lang": "de"}


@pytest.mark.asyncio
async def test_check_eligibility_reports_the_computed_statuses():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/eligibility"
        return httpx.Response(200, json={"benefits": [{"id": "kinderzuschlag", "status": "eligible"}]})

    with (
        patch.object(llm, "ENDPOINT_ELIGIBILITY_SERVICE", "http://eligibility-service:8080"),
        patch.object(llm, "get_user_data", new=AsyncMock(return_value=PROFILE)),
        patch.object(llm.httpx, "AsyncClient", new=_client_answering(handler)),
    ):
        result = await llm.check_eligibility(MagicMock(), MagicMock(), MagicMock())

    assert result == {"benefits": [{"id": "kinderzuschlag", "status": "eligible"}]}


@pytest.mark.asyncio
async def test_tools_explain_when_the_service_is_not_configured():
    with (
        patch.object(llm, "ENDPOINT_ELIGIBILITY_SERVICE", ""),
        patch.object(llm, "get_user_data", new=AsyncMock(return_value=PROFILE)),
    ):
        result = await llm.check_eligibility(MagicMock(), MagicMock(), MagicMock())

    assert result == {"error": "The eligibility service is not configured."}


@pytest.mark.asyncio
async def test_tools_pass_on_service_errors():
    with (
        patch.object(llm, "ENDPOINT_ELIGIBILITY_SERVICE", "http://eligibility-service:8080"),
        patch.object(llm, "get_user_data", new=AsyncMock(return_value=PROFILE)),
        patch.object(
            llm.httpx, "AsyncClient", new=_client_answering(lambda request: httpx.Response(404, text="Unknown"))
        ),
    ):
        result = await llm.check_progress_status(MagicMock(), MagicMock(), MagicMock(), form_type="antrag_unbekannt")

    assert result == {"error": "The eligibility service answered 404: Unknown"}
