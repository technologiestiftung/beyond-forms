"""
Fixture validation for the demo personas.

Runs in the Docker `test` stage, so a persona file that drifts away from the schema
fails the image build rather than surfacing as a confusing 500 at seed time.

The valuable assertion here is the `raw_data` check: it goes through the exact same
registry lookup and strict validation that `validate_document_verified_fields` uses in
the rules engine, so a fixture that passes here also survives a real user re-verifying
the document through the UI.
"""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from beyondforms.auth import is_test_account
from beyondforms.document_schemas.document_registry import document_registry
from beyondforms.document_schemas.validation import validate_strict
from src.constants import SLOT_ID_TO_DIS_TYPE
from src.models import Users
from src.schemas import UserInformationUpdateSchema
from src.services.demo_seed_service import PROTECTED_COLUMNS

REPO_ROOT = Path(__file__).resolve().parents[3]
PERSONAS_DIR = REPO_ROOT / "demo" / "personas"
RESEARCH_DIR = REPO_ROOT / "demo" / "research"

PERSONA_FILES = sorted(PERSONAS_DIR.glob("*.json"))
USER_COLUMNS = {column.name for column in Users.__table__.columns}

# The four codes DatenPrufenForm.tsx renders a message for. Anything else shows the
# generic fallback, which defeats the point of seeding a specific failure state.
KNOWN_ERROR_CODES = {
    "PAGINATION_MISSING_PAGES",
    "LEGIBILITY_ISSUES",
    "DATA_CONFLICTS",
    "OLD_STATEMENT_WARNING",
}


def test_personas_directory_is_not_empty():
    assert PERSONA_FILES, f"No persona fixtures found in {PERSONAS_DIR}"


@pytest.fixture(params=PERSONA_FILES, ids=lambda p: p.stem)
def persona(request):
    return json.loads(request.param.read_text(encoding="utf-8")), request.param


def test_slug_matches_filename(persona):
    data, path = persona
    assert data["slug"] == path.stem


def test_phone_number_is_a_test_account(persona):
    """A persona whose number is not a drama number could never be seeded: the endpoint
    refuses non-test accounts, and auth-service would demand a real SMS code."""
    data, _ = persona
    assert is_test_account(data["phone_number"]), (
        f"{data['slug']}: {data['phone_number']} is not a Bundesnetzagentur drama number"
    )


def test_phone_numbers_are_unique():
    numbers = {}
    for path in PERSONA_FILES:
        data = json.loads(path.read_text(encoding="utf-8"))
        phone = data["phone_number"]
        assert phone not in numbers, f"{data['slug']} reuses {phone} from {numbers[phone]}"
        numbers[phone] = data["slug"]


def test_source_document_exists(persona):
    data, _ = persona
    source = REPO_ROOT / data["source"]
    assert source.is_file(), f"{data['slug']}: source {data['source']} does not exist"


def test_portrait_exists_if_declared(persona):
    data, _ = persona
    if "portrait" in data:
        portrait = PERSONAS_DIR / data["portrait"]
        assert portrait.is_file(), f"{data['slug']}: portrait {data['portrait']} does not exist"


def test_profile_keys_are_real_columns(persona):
    data, _ = persona
    unknown = sorted(set(data["profile"]) - USER_COLUMNS)
    assert not unknown, f"{data['slug']}: unknown `users` columns {unknown}"


def test_profile_does_not_touch_protected_columns(persona):
    """Identity columns belong to auth-service. A persona setting `authentik_id` or
    `phone_number` would break the linkage `form_export.py` looks users up by."""
    data, _ = persona
    protected = sorted(set(data["profile"]) & PROTECTED_COLUMNS)
    assert not protected, f"{data['slug']}: may not set protected columns {protected}"


def test_profile_enum_and_date_values_are_valid(persona):
    """
    Coerces the profile through `UserInformationUpdateSchema`, which types the enum
    columns as the real Python enums — so `"male"` instead of `"Male"` fails loudly here
    rather than at seed time. The schema does not cover every column (that is a filed
    gap), hence the separate column-name check above.
    """
    data, _ = persona
    known = set(UserInformationUpdateSchema.model_fields)
    subset = {k: v for k, v in data["profile"].items() if k in known}
    try:
        UserInformationUpdateSchema(**subset)
    except ValidationError as exc:
        pytest.fail(f"{data['slug']}: invalid profile values:\n{exc}")


def test_documents_resolve_to_a_registered_document_type(persona):
    data, _ = persona
    for doc in data["documents"]:
        slot = doc["document_type"]
        dis_type = SLOT_ID_TO_DIS_TYPE.get(slot, slot)
        document_registry.get_or_raise(dis_type)


def test_raw_data_validates_against_the_document_schema(persona):
    """
    The drift guard. `BaseDocument` sets `extra="forbid"`, so a renamed or invented
    `raw_data` key fails here — including computed fields such as
    `health_insurance_proof.is_private`, which must not be stored.
    """
    data, _ = persona
    for doc in data["documents"]:
        slot = doc["document_type"]
        dis_type = SLOT_ID_TO_DIS_TYPE.get(slot, slot)
        model = document_registry.get_or_raise(dis_type)
        try:
            validate_strict(model, doc["raw_data"])
        except ValidationError as exc:
            pytest.fail(f"{data['slug']} / {slot} -> {dis_type}: invalid raw_data:\n{exc}")


def test_error_codes_are_renderable(persona):
    data, _ = persona
    for doc in data["documents"]:
        code = doc.get("user_error_code")
        if code is not None:
            assert code in KNOWN_ERROR_CODES, (
                f"{data['slug']} / {doc['document_type']}: {code} has no message in DatenPrufenForm.tsx"
            )


def test_error_codes_only_on_non_verified_documents(persona):
    data, _ = persona
    for doc in data["documents"]:
        if doc["status"] == "verified":
            assert doc.get("user_error_code") is None, (
                f"{data['slug']} / {doc['document_type']}: a verified document should not carry an error code"
            )


def test_failed_documents_carry_no_extraction(persona):
    """A failed document with populated `raw_data` is contradictory — extraction either
    produced fields or it did not."""
    data, _ = persona
    for doc in data["documents"]:
        if doc["status"] == "failed":
            assert not doc["raw_data"], f"{data['slug']} / {doc['document_type']}: failed but has raw_data"


def test_personas_cover_distinct_document_states():
    """
    The point of having three personas is that they land in different places. If they all
    end up fully verified, the fixtures no longer exercise the review or to-do paths.
    """
    states = set()
    for path in PERSONA_FILES:
        data = json.loads(path.read_text(encoding="utf-8"))
        states.update(doc["status"] for doc in data["documents"])
    assert {"verified", "ready_for_review", "failed"} <= states, (
        f"personas only cover {sorted(states)}; the review and failure paths need coverage"
    )
