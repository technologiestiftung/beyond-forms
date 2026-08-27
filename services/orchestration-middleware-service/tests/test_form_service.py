import decimal
import uuid
import pytest
from unittest.mock import MagicMock, patch
from pyjexl import JEXL
from sqlalchemy.exc import DatabaseError
from src.services.form_service import (
    FormService,
    _extract_document_refs,
    _extract_required_context_fields,
    _is_context_value_filled,
)
from src.models import Users


@pytest.fixture
def form_service():
    # Mocking paths
    mock_db = MagicMock()
    return FormService(db=mock_db, forms_dir="/tmp/forms", forms_filler_url="http://filler")


@pytest.fixture
def mock_user():
    import datetime

    user = MagicMock(spec=Users)
    user.id = uuid.uuid4()
    user.first_name = "Max"
    user.last_name = "Mustermann"
    user.legal_gender = "Male"
    user.date_of_birth = datetime.date(1990, 1, 1)
    user.rent_total = decimal.Decimal("430.00")

    # Mock __table__.columns for user_dict building
    col1 = MagicMock()
    col1.name = "first_name"
    col2 = MagicMock()
    col2.name = "last_name"
    col3 = MagicMock()
    col3.name = "legal_gender"
    col4 = MagicMock()
    col4.name = "date_of_birth"
    col5 = MagicMock()
    col5.name = "district"
    col6 = MagicMock()
    col6.name = "zip_code"
    col7 = MagicMock()
    col7.name = "street"
    col8 = MagicMock()
    col8.name = "house_number"
    col9 = MagicMock()
    col9.name = "city"
    col10 = MagicMock()
    col10.name = "rent_total"
    user.__table__.columns = [col1, col2, col3, col4, col5, col6, col7, col8, col9, col10]
    user.district = "Neukölln"
    user.zip_code = None
    return user


@pytest.mark.asyncio
async def test_fill_form_smart_jexl_resolution(form_service, mock_user):
    mock_mapping = {
        "p1_name": "{{ first_name + ' ' + last_name }}",
        "p1_check": "{{ first_name == 'Max' }}",
        "p1_check_false": "{{ first_name == 'Other' }}",
        "p1_literal_true": True,
        "p1_literal_false": False,
        "p1_static": "Berlin",
        "p1_null": "{{ non_existent }}",
        "p1_interpolated": "Welcome {{ first_name }} {{ last_name }}!",
        "p1_multiple_jexl": "{{ last_name }}, {{ first_name }}",
        "p1_date": "{{ date_of_birth }}",
        "p1_rent": "{{ rent_total }}",
    }

    mock_field_types = {
        "p1_literal_true": "checkbox",
        "p1_literal_false": "checkbox",
    }

    # Mock asset loading to bypass disk and cache
    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, mock_field_types, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF_CONTENT")

        await form_service.fill_form("test_form", mock_user)

        payload = mock_post.call_args.kwargs["json"]
        assert payload["field_values"]["p1_name"] == "Max Mustermann"
        assert payload["field_values"]["p1_check"] == "Ja"
        assert payload["field_values"]["p1_check_false"] == ""
        assert payload["field_values"]["p1_literal_true"] is True
        assert payload["field_values"]["p1_literal_false"] is False
        assert payload["field_values"]["p1_static"] == "Berlin"
        assert payload["field_values"]["p1_null"] == ""
        assert payload["field_values"]["p1_interpolated"] == "Welcome Max Mustermann!"
        assert payload["field_values"]["p1_multiple_jexl"] == "Mustermann, Max"
        assert payload["field_values"]["p1_date"] == "01.01.1990"
        assert payload["field_values"]["p1_rent"] == "430.00"


@pytest.mark.asyncio
async def test_fill_form_resolves_district_when_missing(form_service, mock_user):
    mock_user.district = None
    mock_user.zip_code = "10115"
    mock_mapping = {"p1_bezirksamt": "{{ district ? district : 'Mitte' }}"}

    with (
        patch(
            "src.services.form_service._get_form_assets",
            return_value=(mock_mapping, {"p1_bezirksamt": "choice"}, b"%PDF"),
        ),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test", mock_user)
        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_bezirksamt"] == "Mitte"


@pytest.mark.asyncio
async def test_fill_form_multiline_jexl(form_service, mock_user):
    mock_mapping = {
        "p1_multiline": """{{
            legal_gender == 'Male'
            ? 'Herr'
            : 'Frau'
        }}"""
    }

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")

        await form_service.fill_form("test", mock_user)
        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_multiline"] == "Herr"


@pytest.mark.asyncio
async def test_fill_form_ternary(form_service, mock_user):
    mock_mapping = {"p1_salutation": "{{ legal_gender == 'Male' ? 'Herr' : 'Frau' }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")

        # Test Male
        await form_service.fill_form("test", mock_user)
        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_salutation"] == "Herr"

        # Test Female
        mock_user.legal_gender = "Female"
        await form_service.fill_form("test", mock_user)
        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_salutation"] == "Frau"


def _mock_application(form_data: dict | None):
    application = MagicMock()
    application.form_data = form_data
    return application


def _set_application_query(form_service, application):
    query = form_service.db.query.return_value
    query.filter.return_value.order_by.return_value.first.return_value = application


@pytest.mark.asyncio
async def test_fill_form_includes_application_form_data(form_service, mock_user):
    mock_mapping = {
        "p1_cost_of_rent": "{{ cost_of_rent }}",
        "p1_special_note": "{{ special_note }}",
    }
    _set_application_query(
        form_service,
        _mock_application({"cost_of_rent": decimal.Decimal("550.00"), "special_note": "Bitte beachten"}),
    )

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        queried_models = [c.args[0].__name__ for c in form_service.db.query.call_args_list if c.args]
        assert "UserApplications" in queried_models

        field_values = mock_post.call_args.kwargs["json"]["field_values"]
        assert field_values["p1_cost_of_rent"] == "550.00"
        assert field_values["p1_special_note"] == "Bitte beachten"


@pytest.mark.asyncio
async def test_fill_form_profile_overrides_form_data(form_service, mock_user):
    mock_mapping = {"p1_rent": "{{ rent_total }}"}
    _set_application_query(form_service, _mock_application({"rent_total": decimal.Decimal("999.99")}))

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_rent"] == "430.00"


@pytest.mark.asyncio
async def test_fill_form_no_application_falls_back_to_profile(form_service, mock_user):
    _set_application_query(form_service, None)

    mock_mapping = {
        "p1_name": "{{ first_name }} {{ last_name }}",
        "p1_exclusive_form_key": "{{ form_only_value }}",
    }

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        field_values = mock_post.call_args.kwargs["json"]["field_values"]
        assert field_values["p1_name"] == "Max Mustermann"
        assert field_values["p1_exclusive_form_key"] == ""


@pytest.mark.asyncio
async def test_fill_form_application_query_failure_falls_back_to_profile(form_service, mock_user):
    form_service.db.query.return_value.filter.return_value.order_by.return_value.first.side_effect = DatabaseError(
        "db down", params=None, orig=None
    )

    mock_mapping = {"p1_name": "{{ first_name }} {{ last_name }}"}
    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_name"] == "Max Mustermann"


def _mock_document(document_type: str, raw_data: dict | None, status):
    doc = MagicMock()
    doc.document_type = document_type
    doc.raw_data = raw_data
    doc.status = status
    return doc


def _set_documents_query(form_service, docs: list):
    form_service.db.query.return_value.filter.return_value.order_by.return_value.all.return_value = docs


@pytest.mark.asyncio
async def test_fill_form_includes_verified_document_data(form_service, mock_user):
    _set_application_query(
        form_service,
        _mock_application(
            {"cost_of_rent": decimal.Decimal("100")},
        ),
    )
    _set_documents_query(
        form_service,
        [_mock_document("bank_statements", {"amount_rent": decimal.Decimal("450.00")}, "verified")],
    )

    mock_mapping = {"p1_rent": "{{ documents.bank_statements.amount_rent }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_rent"] == "450.00"


@pytest.mark.asyncio
async def test_fill_form_documents_namespace_isolated_from_users(form_service, mock_user):
    _set_application_query(form_service, _mock_application({}))
    _set_documents_query(
        form_service,
        [_mock_document("bank_statements", {"iban": "DE89370400440532013000"}, "verified")],
    )

    mock_mapping = {"p1_iban": "{{ documents.bank_statements.iban }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_iban"] == "DE89370400440532013000"


@pytest.mark.asyncio
async def test_fill_form_ignores_unverified_documents(form_service, mock_user):
    _set_application_query(form_service, _mock_application({}))
    _set_documents_query(
        form_service,
        [
            _mock_document("bank_statements", {"amount_rent": decimal.Decimal("450.00")}, "verified"),
            _mock_document("bank_statements", {"amount_rent": decimal.Decimal("999.99")}, "processing"),
        ],
    )

    mock_mapping = {"p1_rent": "{{ documents.bank_statements.amount_rent }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_rent"] == "450.00"


@pytest.mark.asyncio
async def test_fill_form_uses_latest_verified_document_per_type(form_service, mock_user):
    _set_application_query(form_service, _mock_application({}))

    newer = _mock_document("bank_statements", {"amount_rent": decimal.Decimal("500.00")}, "verified")
    newer.updated_at = None
    older = _mock_document("bank_statements", {"amount_rent": decimal.Decimal("300.00")}, "verified")
    older.updated_at = None
    _set_documents_query(form_service, [newer, older])

    mock_mapping = {"p1_rent": "{{ documents.bank_statements.amount_rent }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_rent"] == "500.00"


@pytest.mark.asyncio
async def test_fill_form_no_application_yields_empty_documents_namespace(form_service, mock_user):
    _set_application_query(form_service, None)

    mock_mapping = {"p1_rent": "{{ documents.bank_statements ? documents.bank_statements.amount_rent : '' }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_rent"] == ""


@pytest.mark.asyncio
async def test_fill_form_document_query_failure_falls_back_to_profile(form_service, mock_user):
    _set_application_query(form_service, _mock_application({}))
    form_service.db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = DatabaseError(
        "db down", params=None, orig=None
    )

    mock_mapping = {"p1_rent": "{{ documents.bank_statements ? documents.bank_statements.amount_rent : '' }}"}
    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("test_form", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_rent"] == ""


def test_extract_document_refs_finds_specific_keys():
    mapping = {
        "p1_rent": "{{ documents.bank_statements.amount_rent }}",
        "p1_iban": "{{ documents.bank_statements.iban }}",
        "p1_name": "{{ first_name }} {{ last_name }}",
    }
    refs = _extract_document_refs(mapping)
    assert refs == {"bank_statements": {"amount_rent", "iban"}}


def test_extract_document_refs_bare_reference_means_all_keys():
    mapping = {
        "p1_has_wage": "{{ documents.wage_slips ? 'Ja' : '' }}",
        "p1_net": "{{ documents.wage_slips.net_amount }}",
    }
    refs = _extract_document_refs(mapping)
    assert refs == {"wage_slips": None}


def test_extract_document_refs_no_references():
    mapping = {
        "p1_name": "{{ first_name }} {{ last_name }}",
        "p1_static": "Berlin",
    }
    refs = _extract_document_refs(mapping)
    assert refs == {}


@pytest.mark.asyncio
async def test_fill_form_resolves_dis_type_from_a_slot_id_document(form_service, mock_user):
    """
    Documents are stored under frontend slot ids (`id_card`), but the TOML mappings
    reference document-intelligence registry names (`documents.identity_document.*`).
    The two vocabularies overlap on `pension_notice` alone, so before the dual-key
    registration every `documents.*` reference in antrag_grundsicherung.toml resolved
    to nothing.
    """
    _set_application_query(form_service, _mock_application({}))
    _set_documents_query(
        form_service,
        [_mock_document("id_card", {"valid_until": "2030-05-19"}, "verified")],
    )

    mock_mapping = {"p1_id_valid": "{{ documents.identity_document.valid_until }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("antrag_grundsicherung", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_id_valid"] == "2030-05-19"


@pytest.mark.asyncio
async def test_fill_form_still_resolves_the_stored_slot_id(form_service, mock_user):
    """The alias must be additive: a mapping written against the slot id keeps working."""
    _set_application_query(form_service, _mock_application({}))
    _set_documents_query(
        form_service,
        [_mock_document("id_card", {"issuing_authority": "Bezirksamt Mitte"}, "verified")],
    )

    mock_mapping = {"p1_authority": "{{ documents.id_card.issuing_authority }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("antrag_grundsicherung", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_authority"] == "Bezirksamt Mitte"


@pytest.mark.asyncio
async def test_fill_form_falls_back_when_form_type_does_not_match(form_service, mock_user):
    """
    `get_or_create_user_application` used to write form_type="grundsicherung" while
    exports are requested as "antrag_grundsicherung". Legacy rows still exist, so
    the exact match can miss and we fall back to the most recently updated application.
    """
    application = _mock_application({"cost_of_rent": decimal.Decimal("1200.00")})
    query = form_service.db.query.return_value
    # First call is the exact form_type match (misses), second is the fallback.
    query.filter.return_value.order_by.return_value.first.side_effect = [None, application]
    _set_documents_query(form_service, [])

    mock_mapping = {"p1_cost_of_rent": "{{ cost_of_rent }}"}

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("antrag_grundsicherung", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_cost_of_rent"] == "1200.00"


def test_document_refs_in_the_grundsicherung_mapping_resolve_in_the_registry():
    """
    Drift guard over the real mapping: every `documents.<type>.<field>` it references
    should name a registered document type and an existing field, or no fixture can ever
    fill it. Eight references currently do not resolve — see the xfail below. The list is
    allowed to shrink, never to grow.
    """
    import tomllib
    from pathlib import Path

    from beyondforms.document_schemas.document_registry import document_registry

    mapping_path = Path(__file__).resolve().parents[3] / "forms" / "mappings" / "antrag_grundsicherung.toml"
    if not mapping_path.is_file():
        pytest.skip(f"{mapping_path} not available")

    with mapping_path.open("rb") as handle:
        raw = tomllib.load(handle)

    flat = {}
    for key, value in raw.items():
        if isinstance(value, dict) and "value" in value:
            flat[key] = value["value"]
        elif isinstance(value, str):
            flat[key] = value

    unresolvable = []
    for doc_type, fields in _extract_document_refs(flat).items():
        try:
            model = document_registry.get_or_raise(doc_type)
        except ValueError:
            unresolvable.append(f"{doc_type} (unknown type)")
            continue
        for field in fields or set():
            if field not in model.model_fields:
                unresolvable.append(f"{doc_type}.{field}")

    known_broken = {
        "asylblg_application.bg_number",
        "bank_details.bic",
        "care_facility_costs.invoice_amount",
        "disability_id.valid_until",
        "private_pension_proof.monthly_amount",
        "private_pension_yearly_information.accumulated_yearly_net_income",
        "recognition_decision.date_of_issue",
        "recognition_decision.issuing_authority",
    }
    regressions = sorted(set(unresolvable) - known_broken)
    assert not regressions, f"new unresolvable document references in the mapping: {regressions}"


@pytest.mark.asyncio
async def test_fill_form_interpolates_dates_in_german_format(form_service, mock_user):
    import datetime

    mock_user.reduced_work_capacity_start_date = datetime.date(2019, 10, 1)
    mock_user.reduced_work_capacity_end_date = None
    col_a, col_b = MagicMock(), MagicMock()
    col_a.name = "reduced_work_capacity_start_date"
    col_b.name = "reduced_work_capacity_end_date"
    mock_user.__table__.columns = list(mock_user.__table__.columns) + [col_a, col_b]
    _set_application_query(form_service, None)

    mock_mapping = {
        "p1_period": "{{ reduced_work_capacity_start_date }}"
        "{{ reduced_work_capacity_start_date ? ' bis ' : '' }}"
        "{{ reduced_work_capacity_start_date ? (reduced_work_capacity_end_date ? "
        "reduced_work_capacity_end_date : 'unbefristet') : '' }}"
    }

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("antrag_grundsicherung", mock_user)

        assert mock_post.call_args.kwargs["json"]["field_values"]["p1_period"] == "01.10.2019 bis unbefristet"


@pytest.mark.asyncio
async def test_fill_form_survives_an_unevaluable_mapping_entry(form_service, mock_user):
    """A single broken expression used to 500 the entire export."""
    _set_application_query(form_service, None)
    mock_mapping = {
        "p1_broken": "{{ date_of_birth + ' oops' }}",
        "p1_ok": "{{ first_name }}",
    }

    with (
        patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")),
        patch("httpx.AsyncClient.post") as mock_post,
    ):
        mock_post.return_value = MagicMock(status_code=200, content=b"PDF")
        await form_service.fill_form("antrag_grundsicherung", mock_user)

        field_values = mock_post.call_args.kwargs["json"]["field_values"]
        assert field_values["p1_broken"] == ""
        assert field_values["p1_ok"] == "Max"


def test_extract_required_context_fields_excludes_documents_and_string_literals():
    """Only bare identifiers referenced outside the `documents.*` namespace count as
    profile fields a form needs; string literals like 'Auswahl1' must not leak in."""
    mapping = {
        "p1_name": "{{ first_name }} {{ last_name }}",
        "p1_doc": "{{ documents.wage_slips ? documents.wage_slips.net_amount : '' }}",
        "p1_choice": "{{ status == 'Auswahl1' ? 'Ja' : '' }}",
        "p1_static": "Berlin",
        "p1_checkbox": True,
    }
    fields = _extract_required_context_fields(mapping, JEXL())
    assert fields == {"first_name", "last_name", "status"}


@pytest.mark.parametrize(
    "value, expected",
    [
        (None, False),
        ("", False),
        ("   ", False),
        ([], False),
        ({}, False),
        (False, True),
        (0, True),
        ("Berlin", True),
        (["employment"], True),
    ],
)
def test_is_context_value_filled_semantics(value, expected):
    assert _is_context_value_filled(value) is expected


@pytest.mark.asyncio
async def test_get_completeness_counts_filled_and_missing_fields(form_service):
    user = MagicMock(spec=Users)
    col_first, col_last, col_plate = MagicMock(), MagicMock(), MagicMock()
    col_first.name = "first_name"
    col_last.name = "last_name"
    col_plate.name = "license_plate"
    user.__table__.columns = [col_first, col_last, col_plate]
    user.first_name = "Max"
    user.last_name = ""
    user.license_plate = None

    mock_mapping = {
        "p1_name": "{{ first_name }} {{ last_name }}",
        "p1_plate": "{{ license_plate }}",
    }
    _set_application_query(form_service, None)

    with patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")):
        filled, total = await form_service.get_completeness("antrag_bewohnerparkausweis", user)

    assert total == 3
    assert filled == 1


@pytest.mark.asyncio
async def test_get_completeness_no_mapped_fields_returns_zero_total(form_service, mock_user):
    mock_mapping = {"p1_static": "Berlin", "p1_checkbox": True}
    _set_application_query(form_service, None)

    with patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")):
        filled, total = await form_service.get_completeness("test_form", mock_user)

    assert (filled, total) == (0, 0)


@pytest.mark.asyncio
async def test_get_completeness_counts_application_form_data(form_service, mock_user):
    _set_application_query(form_service, _mock_application({"income_sources": ["employment"]}))
    mock_mapping = {"p1_income": "{{ income_sources }}"}

    with patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")):
        filled, total = await form_service.get_completeness("test_form", mock_user)

    assert (filled, total) == (1, 1)


@pytest.mark.asyncio
async def test_get_completeness_ignores_documents_namespace(form_service, mock_user):
    """Neither the parking permit nor Wohngeld require document uploads today, so a
    field that's only reachable via `documents.*` must not count toward the total."""
    _set_application_query(form_service, None)
    mock_mapping = {"p1_doc": "{{ documents.wage_slips ? documents.wage_slips.net_amount : '' }}"}

    with patch("src.services.form_service._get_form_assets", return_value=(mock_mapping, {}, b"%PDF")):
        filled, total = await form_service.get_completeness("test_form", mock_user)

    assert (filled, total) == (0, 0)
