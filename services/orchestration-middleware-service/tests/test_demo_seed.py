"""
Unit tests for the demo-persona seeder.

Concentrates on the invariants that are expensive to discover by hand:
GCS blobs are actually uploaded (or verified documents silently rot), confidence scores
stay inside the range the frontend accepts, the object name matches the convention the
frontend's slot matching depends on, and nothing is ever published to Pub/Sub.
"""

import datetime
import decimal
import json
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from src.models import (
    AbilityToWorkType,
    DocumentStatusType,
    GenderType,
    UploadedFiles,
    UserDocuments,
    Users,
)
from src.services.demo_assets import content_type_for, generate_demo_pdf, resolve_asset
from src.services.demo_seed_service import (
    PRESERVED_ON_RESET,
    PROTECTED_COLUMNS,
    DemoSeedError,
    DemoSeedService,
    _coerce_to_column,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
PERSONAS_DIR = REPO_ROOT / "demo" / "personas"

USER_COLUMNS = {column.name: column for column in Users.__table__.columns}


# --------------------------------------------------------------- type coercion


def test_coerce_enum_column_accepts_the_db_value():
    coerced = _coerce_to_column(USER_COLUMNS["legal_gender"], "Female")
    assert coerced is GenderType.FEMALE


def test_coerce_enum_column_rejects_a_typo_with_the_valid_values():
    with pytest.raises(DemoSeedError) as exc:
        _coerce_to_column(USER_COLUMNS["ability_to_work"], "permanently disabled")
    message = str(exc.value)
    assert "ability_to_work" in message
    assert AbilityToWorkType.PERMANENTLY_DISABLED.value in message


def test_coerce_date_column_parses_iso_strings():
    assert _coerce_to_column(USER_COLUMNS["date_of_birth"], "1968-04-22") == datetime.date(1968, 4, 22)


def test_coerce_numeric_column_yields_exact_decimal():
    """Going through Decimal(str(value)) avoids the float artefacts that would show up
    as 780.0000000001 in a rendered PDF."""
    assert _coerce_to_column(USER_COLUMNS["rent_total"], 780.00) == decimal.Decimal("780.00")


def test_coerce_jsonb_column_passes_lists_through():
    assert _coerce_to_column(USER_COLUMNS["income_sources"], ["pension"]) == ["pension"]


def test_coerce_none_stays_none():
    assert _coerce_to_column(USER_COLUMNS["married_since"], None) is None


def test_reset_preserves_identity_columns():
    """If a reset cleared `authentik_id` or `phone_number`, the account would be
    unfindable by `form_export.py` and would need a fresh login before the next seed."""
    assert {"id", "phone_number", "authentik_id", "created_at"} <= PRESERVED_ON_RESET
    assert PROTECTED_COLUMNS <= PRESERVED_ON_RESET


# ------------------------------------------------------------------ asset layer


def test_generated_pdf_is_a_watermarked_pdf():
    content = generate_demo_pdf("Rentenbescheid", "Deutsche Rentenversicherung", {"monthly_amount": 450.00})
    assert content.startswith(b"%PDF")
    assert len(content) > 500


def test_generated_pdf_handles_empty_raw_data():
    """Failed documents carry no extraction; the blob must still be a valid PDF."""
    content = generate_demo_pdf("Nebenkostenabrechnung", None, {})
    assert content.startswith(b"%PDF")


def test_resolve_asset_generates_when_asked():
    content, content_type, source = resolve_asset({"generate": True, "title": "Kontoauszug"}, "k.pdf", {"iban": "DE00"})
    assert content_type == "application/pdf"
    assert source.startswith("generated:")


def test_resolve_asset_falls_back_to_generation_for_a_missing_fixture(monkeypatch, tmp_path):
    """A fixture that has gone missing should degrade the demo, not break the seed."""
    monkeypatch.setenv("DEMO_ASSETS_PATH", str(tmp_path))
    content, content_type, source = resolve_asset("does_not_exist.pdf", "Mietvertrag_X.pdf", {"tenant_name": "X"})
    assert content.startswith(b"%PDF")
    assert content_type == "application/pdf"
    assert source.startswith("generated-fallback:")


def test_resolve_asset_reads_a_fixture_when_present(monkeypatch, tmp_path):
    (tmp_path / "Nachweis.png").write_bytes(b"\x89PNG\r\n\x1a\nfake")
    monkeypatch.setenv("DEMO_ASSETS_PATH", str(tmp_path))
    content, content_type, source = resolve_asset("Nachweis.png", "Nachweis.png", {})
    assert content == b"\x89PNG\r\n\x1a\nfake"
    assert content_type == "image/png"
    assert source.startswith("fixture:")


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("a.pdf", "application/pdf"),
        ("a.PNG", "image/png"),
        ("a.jpeg", "image/jpeg"),
        ("a.zip", "application/octet-stream"),
    ],
)
def test_content_type_detection(filename, expected):
    assert content_type_for(filename) == expected


# ------------------------------------------------------------- persona loading


@pytest.fixture
def service():
    return DemoSeedService(MagicMock(spec=Session), storage_client=MagicMock(), personas_dir=PERSONAS_DIR)


def test_load_persona_rejects_path_traversal(service):
    with pytest.raises(DemoSeedError):
        service.load_persona("../../etc/passwd")


def test_load_persona_reports_available_slugs(service):
    with pytest.raises(DemoSeedError) as exc:
        service.load_persona("nobody")
    assert "helmut" in str(exc.value)


def test_list_personas_includes_research_context(service):
    personas = {p["slug"]: p for p in service.list_personas()}
    assert {"sabine", "helmut", "sandor"} <= set(personas)
    # The research block is what makes these fixtures useful beyond seeding rows.
    assert personas["sabine"]["research"]["core_barrier"]
    assert personas["helmut"]["research"]["not_representable"]
    assert personas["sandor"]["documents"]


# ------------------------------------------------------------ document seeding


def _seed_one_document(persona_slug: str, index: int = 0):
    db = MagicMock(spec=Session)
    storage = MagicMock()
    service = DemoSeedService(db, storage_client=storage, personas_dir=PERSONAS_DIR)
    persona = service.load_persona(persona_slug)
    spec = persona["documents"][index]
    uploaded: list[str] = []
    result = service._seed_document(spec, uuid.uuid4(), uuid.uuid4(), uploaded)
    return db, storage, result, uploaded, spec


def test_seeding_a_document_uploads_a_blob():
    """Mandatory: cleanup_missing_gcs_files demotes verified documents whose blob is
    absent to FAILED, and it runs from GET /profile and GET /files."""
    _, storage, result, uploaded, _ = _seed_one_document("helmut", index=2)
    storage.bucket.return_value.blob.return_value.upload_from_string.assert_called_once()
    kwargs = storage.bucket.return_value.blob.return_value.upload_from_string.call_args.kwargs
    assert kwargs["content_type"] == "application/pdf"
    assert uploaded == [result["object_name"]]
    assert result["size_bytes"] > 0


def test_object_name_follows_the_upload_convention():
    """`{uuid4}_{sanitized}`, flat, no prefix — matching routes/files.py. The frontend
    strips the UUID and keyword-matches the German remainder to a document slot, so the
    filename is load-bearing."""
    _, _, result, _, spec = _seed_one_document("helmut", index=2)
    object_name = result["object_name"]
    prefix, _, remainder = object_name.partition("_")
    uuid.UUID(prefix)  # raises if the prefix is not a UUID
    assert "/" not in object_name
    assert "Rentenbescheid" in remainder


def test_seeded_rows_carry_the_fixture_status_and_extraction():
    db, _, result, _, spec = _seed_one_document("helmut", index=2)
    added = [call.args[0] for call in db.add.call_args_list]
    assert any(isinstance(row, UploadedFiles) for row in added)
    documents = [row for row in added if isinstance(row, UserDocuments)]
    assert len(documents) == 1
    document = documents[0]
    assert document.status is DocumentStatusType.VERIFIED
    assert document.document_type == "pension_notice"
    assert document.raw_data == spec["raw_data"]
    assert document.fk_file_id is not None
    assert result["extracted_field_count"] == len(spec["raw_data"])


def test_seeded_confidence_score_stays_within_the_frontend_range():
    _, _, _, _, _ = _seed_one_document("helmut", index=2)
    for path in PERSONAS_DIR.glob("*.json"):
        persona = json.loads(path.read_text(encoding="utf-8"))
        db = MagicMock(spec=Session)
        service = DemoSeedService(db, storage_client=MagicMock(), personas_dir=PERSONAS_DIR)
        for i, _ in enumerate(persona["documents"]):
            service._seed_document(persona["documents"][i], uuid.uuid4(), uuid.uuid4(), [])
        for call in db.add.call_args_list:
            row = call.args[0]
            if isinstance(row, UserDocuments) and row.confidence_score is not None:
                assert decimal.Decimal("0") <= row.confidence_score <= decimal.Decimal("1")


def test_failed_document_keeps_its_error_code():
    db, _, result, _, spec = _seed_one_document("sandor", index=3)
    document = [c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], UserDocuments)][0]
    assert document.status is DocumentStatusType.FAILED
    assert document.user_error_code == "LEGIBILITY_ISSUES"
    assert document.internal_error_log
    assert result["extracted_field_count"] == 0


def test_seeding_never_publishes_to_pubsub():
    """Publishing would hand the document to src/worker.py and back into the Gemini OCR
    path this seeder exists to bypass."""
    with patch("src.services.pubsub_service.publish_document_event") as publish:
        _seed_one_document("helmut", index=2)
        _seed_one_document("sandor", index=3)
    publish.assert_not_called()


# ---------------------------------------------------------------- route gating


def test_demo_routes_are_not_mounted_by_default():
    """DEMO_SEED_ENABLED is unset in the test environment, so the routes must not exist
    at all — a 404, with nothing to fingerprint."""
    from fastapi.testclient import TestClient

    from src.main import app

    paths = {getattr(route, "path", "") for route in app.routes}
    assert not any(path.startswith("/api/v1/demo") for path in paths)

    # And prove it end to end, since the route table structure is a FastAPI detail.
    response = TestClient(app).get("/api/v1/demo/personas")
    assert response.status_code == 404


def test_seeding_is_refused_for_a_non_test_account():
    from beyondforms.auth import User as AuthUser
    from fastapi import HTTPException

    from src.routes.demo import get_demo_service

    real_user = AuthUser(
        user_id="real-auth-id",
        user_name="+4930123456789",
        session_id="s",
        is_authenticated=True,
    )
    with pytest.raises(HTTPException) as exc:
        get_demo_service(current_user=real_user, db=MagicMock(spec=Session))
    assert exc.value.status_code == 403


def test_seeding_is_allowed_for_a_drama_number():
    from beyondforms.auth import User as AuthUser

    from src.routes.demo import get_demo_service

    demo_user = AuthUser(
        user_id="demo-auth-id",
        user_name="+493023125102",
        session_id="s",
        is_authenticated=True,
    )
    service, returned = get_demo_service(current_user=demo_user, db=MagicMock(spec=Session))
    assert isinstance(service, DemoSeedService)
    assert returned is demo_user
