"""
Unit tests for the demo-persona seeder.

Concentrates on the invariants that are expensive to discover by hand:
GCS blobs are actually uploaded (or verified documents silently rot),
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


def test_list_personas_returns_the_whole_file(service):
    """The endpoint exists so a caller can see what a seeded account will contain, which
    means the filled-in values — not just the field names. A summary that omits `profile`
    or a document's `raw_data` forces everyone back to reading the repo."""
    personas = {p["slug"]: p for p in service.list_personas()}
    helmut = personas["helmut"]

    assert helmut["profile"]["monthly_income"] == 650.00
    assert helmut["profile"]["iban"] == "DE65940594210000123456"
    assert helmut["applications"][0]["form_type"] == "antrag_grundsicherung"
    assert {a["form_type"] for a in helmut["applications"]} == {
        "antrag_grundsicherung",
        "antrag_wohngeld",
        "antrag_bewohnerparkausweis",
    }

    pension = next(d for d in helmut["documents"] if d["document_type"] == "pension_notice")
    assert pension["raw_data"]["pension_reason"] == "Altersrente"
    assert pension["display_name"] == "Rentenbescheid_Helmut_Klar.pdf"

    # `derived` keeps the name it has in the file, and the file's own $schema pointer is
    # repo-relative, so it must not be served.
    assert "birth_name" in helmut["derived"]
    assert "$schema" not in helmut

    # Every required key from the persona schema is reachable, so this cannot silently
    # narrow again if a new required block is added to the files.
    schema = json.loads((PERSONAS_DIR.parent / "persona.schema.json").read_text(encoding="utf-8"))
    expected = set(schema.get("required", [])) - {"$schema"}
    assert expected <= set(helmut)


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


# --------------------------------------------------------- multi-application seeding


def test_seed_gives_each_applications_entry_its_own_row():
    """Each `applications` entry is get-or-created by form_type so a form's
    `form_data` stays scoped to that type — e.g. Wohngeld-specific facts must not
    leak into the Grundsicherung export context. Documents attach to the first
    entry."""
    db = MagicMock(spec=Session)
    service = DemoSeedService(db, storage_client=MagicMock(), personas_dir=PERSONAS_DIR)

    internal_user_id = uuid.uuid4()
    db_user = MagicMock(spec=Users)
    created: list[tuple[str, MagicMock]] = []

    def fake_get_or_create(_user_id, form_type):
        app = MagicMock()
        app.form_type = form_type
        created.append((form_type, app))
        return _user_id, uuid.uuid4()

    def query_side_effect(model):
        m = MagicMock()
        m.filter.return_value.first.return_value = db_user if model is Users else created[-1][1]
        return m

    db.query.side_effect = query_side_effect

    persona = {
        "profile": {},
        "applications": [
            {"form_type": "antrag_grundsicherung", "status": "in_progress", "form_data": {}},
            {
                "form_type": "antrag_wohngeld",
                "status": "in_progress",
                "form_data": {"is_wohngeld_first_application": True},
            },
            {
                "form_type": "antrag_bewohnerparkausweis",
                "status": "in_progress",
                "form_data": {"consents_to_registry_verification": True},
            },
        ],
        "documents": [],
    }

    with (
        patch.object(service, "load_persona", return_value=persona),
        patch.object(
            service.user_service,
            "get_or_create_user_application",
            side_effect=fake_get_or_create,
        ),
    ):
        service.seed(internal_user_id, "helmut", reset=False)

    assert [form_type for form_type, _ in created] == [
        "antrag_grundsicherung",
        "antrag_wohngeld",
        "antrag_bewohnerparkausweis",
    ]
    assert created[0][1].form_data == {}
    assert created[1][1].form_data == {"is_wohngeld_first_application": True}
    assert created[2][1].form_data == {"consents_to_registry_verification": True}


# --------------------------------------------------------- ensure-on-startup


def test_ensure_skips_a_persona_that_already_has_a_profile():
    db = MagicMock(spec=Session)
    service = DemoSeedService(db, storage_client=MagicMock(), personas_dir=PERSONAS_DIR)
    existing = MagicMock(spec=Users)
    existing.first_name = "Helmut"
    db.query.return_value.filter.return_value.first.return_value = existing

    with (
        patch.object(
            service,
            "list_personas",
            return_value=[{"slug": "helmut", "phone_number": "+493023125102"}],
        ),
        patch.object(service, "seed") as seed,
    ):
        results = service.ensure_missing_personas()

    seed.assert_not_called()
    assert results == [
        {"persona": "helmut", "phone_number": "+493023125102", "status": "already_present"}
    ]


def test_ensure_inserts_and_seeds_a_missing_persona():
    db = MagicMock(spec=Session)
    service = DemoSeedService(db, storage_client=MagicMock(), personas_dir=PERSONAS_DIR)
    db.query.return_value.filter.return_value.first.return_value = None
    created = MagicMock(spec=Users)
    created.id = uuid.uuid4()

    with (
        patch.object(
            service,
            "list_personas",
            return_value=[{"slug": "helmut", "phone_number": "+493023125102"}],
        ),
        patch.object(service, "_insert_persona_user", return_value=created) as insert,
        patch.object(service, "seed", return_value={"persona": "helmut"}) as seed,
    ):
        results = service.ensure_missing_personas()

    insert.assert_called_once_with("+493023125102")
    seed.assert_called_once_with(created.id, "helmut", reset=True)
    assert results[0]["status"] == "seeded"


def test_ensure_seeds_an_empty_existing_account():
    """Logged in but never filled — first_name is still null, so we seed onto the row."""
    db = MagicMock(spec=Session)
    service = DemoSeedService(db, storage_client=MagicMock(), personas_dir=PERSONAS_DIR)
    existing = MagicMock(spec=Users)
    existing.first_name = None
    existing.id = uuid.uuid4()
    db.query.return_value.filter.return_value.first.return_value = existing

    with (
        patch.object(
            service,
            "list_personas",
            return_value=[{"slug": "sabine", "phone_number": "+493023125101"}],
        ),
        patch.object(service, "_insert_persona_user") as insert,
        patch.object(service, "seed", return_value={"persona": "sabine"}) as seed,
    ):
        service.ensure_missing_personas()

    insert.assert_not_called()
    seed.assert_called_once_with(existing.id, "sabine", reset=True)


def test_ensure_is_a_noop_when_the_flag_is_off(monkeypatch):
    from src import main as main_mod

    monkeypatch.setenv("DEMO_SEED_ENABLED", "false")
    with patch.object(main_mod, "SessionLocal") as session_local:
        main_mod._ensure_demo_personas()
    session_local.assert_not_called()


def test_demo_routes_are_not_mounted():
    """The seed API is gone. Personas are ensured on startup, not over HTTP."""
    from fastapi.testclient import TestClient

    from src.main import app

    paths = {getattr(route, "path", "") for route in app.routes}
    assert not any(path.startswith("/api/v1/demo") for path in paths)

    client = TestClient(app)
    assert client.get("/api/v1/demo/personas").status_code == 404
    assert client.post("/api/v1/demo/seed", json={"persona": "helmut"}).status_code == 404
