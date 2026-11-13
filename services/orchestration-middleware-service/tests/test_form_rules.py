import json
import os
import tomllib
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.models import UserApplications, Users
from src.routes.llm import _open_form_groups, _save_form_card_answer
from src.services.demo_seed_service import apply_persona_profile
from src.services.form_rules import (
    ANSWER_KEY,
    NONE_OPTION,
    RULES_DIR,
    FormRules,
    card_id,
    group_answer,
    group_inputs,
    load_form_rules,
    parse_card_id,
)
from src.services.form_service import FormService

REPO_ROOT = RULES_DIR.parents[1]


def _field(var: str, type_: str = "string", meaning: str = "", options: dict | None = None, optional=False):
    return {
        "field_id": var,
        "var": var,
        "type": type_,
        "meaning": meaning,
        "options": options or {},
        "optional": optional,
    }


def _group(id_: str, answer_type: str, fields: list, ask_if: str = "true", required=True, documents=()):
    return {
        "id": id_,
        "page": 1,
        "section": "I. Antragsteller/in",
        "person": "Personenziffer 1",
        "topic": id_,
        "hint": None,
        "answer_type": answer_type,
        "ask_if": ask_if,
        "required": required,
        "fields": fields,
        "documents": list(documents),
    }


MARITAL = _group(
    "p1_marital_status",
    "single_choice",
    [_field("p1_status", meaning="Familienstand", options={"0": "ledig", "2": "verheiratet"})],
    documents=[{"name": "Anlage 1", "condition": 'p1_status == "2"', "form_id": "anlage_1"}],
)
MARRIED_SINCE = _group(
    "p1_married_since",
    "date",
    [_field("p1_since", meaning="verheiratet seit"), _field("p1_note", meaning="Anmerkung", optional=True)],
    ask_if='p1_status == "2"',
)
GENDER = _group(
    "p1_gender",
    "single_choice",
    [_field("p1_male", options={"Ja": "männlich"}, meaning="männlich"), _field("p1_female", "bool", "weiblich")],
)
DISPLACED = _group(
    "p1_displaced",
    "multiple_choice",
    [_field("p1_expellee", "bool", "Heimatvertriebene/r"), _field("p1_resettler", "bool", "Spätaussiedler/in")],
    required=False,
)
RULES = {"form_id": "test_form", "groups": [MARITAL, MARRIED_SINCE, GENDER, DISPLACED], "out_of_scope": []}
ALL_BUT = {"p1_status", "p1_male", "p1_female", "p1_expellee", "p1_resettler"}


def _open_ids(values: dict, answered: set[str] = frozenset()) -> list[str]:
    return [group["id"] for group in FormRules(RULES).open_groups(values, set(answered))]


def test_every_group_that_applies_is_open_until_something_is_filled_in():
    assert _open_ids({}) == ["p1_marital_status", "p1_gender", "p1_displaced"]
    answered = {"p1_status", "p1_female", "p1_expellee", "p1_resettler"}
    assert _open_ids({"p1_status": "0", "p1_female": True}, answered) == []


def test_a_follow_up_only_opens_when_its_condition_holds():
    assert _open_ids({"p1_status": "0"}, ALL_BUT) == []
    assert _open_ids({"p1_status": "2"}, ALL_BUT) == ["p1_married_since"]
    # once the note is given, only the required date is still missing
    open_groups = FormRules(RULES).open_groups({"p1_status": "2", "p1_note": "Notiz"}, ALL_BUT | {"p1_note"})
    assert [f["field_id"] for f in open_groups[0]["fields"]] == ["p1_since"]
    assert _open_ids({"p1_status": "2", "p1_since": "01.01.2000"}, ALL_BUT | {"p1_since"}) == []


def test_a_question_that_may_stay_empty_is_asked_once():
    assert "p1_displaced" in _open_ids({})
    # answered "none": both boxes stored unticked
    assert "p1_displaced" not in _open_ids({}, {"p1_expellee", "p1_resettler"})


def test_an_optional_text_group_keeps_asking_what_the_profile_leaves_empty():
    pension = _group(
        "p5_pension", "text", [_field("p5_office", meaning="Bewilligungsstelle"), _field("p5_amount")], required=False
    )
    rules = FormRules({"form_id": "test_form", "groups": [pension], "out_of_scope": []})
    open_groups = rules.open_groups({"p5_office": "DRV"}, {"p5_office"})
    assert [f["field_id"] for f in open_groups[0]["fields"]] == ["p5_amount"]
    # skipped in the chat: every field of the card is recorded
    assert rules.open_groups({}, {"p5_office", "p5_amount"}) == []


def test_attachments_follow_their_condition():
    rules = FormRules(RULES)
    assert rules.required_attachments({"p1_status": "2"}) == ["anlage_1"]
    assert rules.required_attachments({"p1_status": "0"}) == []


def test_a_condition_on_an_unknown_field_is_rejected():
    broken = {**RULES, "groups": [{**MARRIED_SINCE, "ask_if": 'p9_unknown == "Ja"'}]}
    with pytest.raises(RuntimeError, match="undeclared reference"):
        FormRules(broken)


def test_card_ids_round_trip():
    assert parse_card_id(card_id("anlage_2", "p1_pass")) == ("anlage_2", "p1_pass")
    assert parse_card_id("step_applicant_name") is None


def test_one_radio_with_several_exports_becomes_one_choice():
    [card_input] = group_inputs(MARITAL)
    assert (card_input.key, card_input.kind, card_input.options) == (ANSWER_KEY, "choice", ("0", "2"))
    assert card_input.option_about == ("ledig", "verheiratet")
    assert group_answer(MARITAL, {ANSWER_KEY: "2"}) == {"p1_status": "2"}


def test_separate_boxes_become_the_options_of_one_choice():
    [card_input] = group_inputs(GENDER)
    assert card_input.options == ("p1_male", "p1_female")
    assert group_answer(GENDER, {ANSWER_KEY: "p1_female"}) == {"p1_male": "", "p1_female": True}
    assert group_answer(GENDER, {ANSWER_KEY: "p1_male"}) == {"p1_male": "Ja", "p1_female": False}


def test_a_list_of_boxes_that_may_all_apply_asks_yes_or_no_for_each():
    inputs = group_inputs(DISPLACED)
    assert [(i.key, i.options) for i in inputs] == [("p1_expellee", (True, False)), ("p1_resettler", (True, False))]
    assert group_answer(DISPLACED, {"p1_expellee": True, "p1_resettler": False}) == {
        "p1_expellee": True,
        "p1_resettler": False,
    }


def test_a_single_choice_that_may_stay_empty_offers_none():
    group = {**GENDER, "required": False}
    [card_input] = group_inputs(group)
    assert card_input.options[-1] == NONE_OPTION
    assert group_answer(group, {ANSWER_KEY: NONE_OPTION}) == {"p1_male": "", "p1_female": False}


def test_text_fields_become_inputs_and_dates_are_printed_german():
    inputs = group_inputs(MARRIED_SINCE)
    assert [(i.key, i.kind, i.optional) for i in inputs] == [("p1_since", "date", False), ("p1_note", "date", True)]
    assert group_answer(MARRIED_SINCE, {"p1_since": "2000-01-31"}) == {"p1_since": "31.01.2000"}


@pytest.mark.parametrize("path", sorted(RULES_DIR.glob("*.rules.json")), ids=lambda p: p.name)
def test_every_rule_file_covers_its_mapping(path):
    """Every PDF field the mapping fills needs a rule or an explicit out-of-scope entry, or the
    chat could never tell whether it is still open."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert load_form_rules(raw["form_id"]) is not None
    mapping_path = RULES_DIR.parents[1] / "forms" / "mappings" / f"{raw['form_id']}.toml"
    mapping = tomllib.loads(mapping_path.read_text(encoding="utf-8"))
    covered = {f["field_id"] for g in raw["groups"] for f in g["fields"]} | {o["field_id"] for o in raw["out_of_scope"]}
    assert set(mapping) - covered == set()
    for form_id in {d["form_id"] for g in raw["groups"] for d in g["documents"] if d.get("form_id")}:
        assert load_form_rules(form_id) is not None, f"{form_id} is linked but has no rule file"


@pytest.mark.asyncio
async def test_a_chat_answer_fills_a_field_the_mapping_leaves_empty():
    form_service = FormService(db=MagicMock(), forms_dir="/tmp/forms", forms_filler_url="http://filler")
    answers = {"test_form": {"p1_unmapped": "Notiz", "p1_box": True, "p1_mapped": "alt"}, "other": {"p1_x": "y"}}
    application = MagicMock(form_data={"pdf_fields": answers})
    mapping = {"p1_unmapped": "", "p1_box": False, "p1_mapped": "Berlin", "p1_x": ""}
    with (
        patch("src.services.form_service._get_form_assets", return_value=(mapping, {"p1_box": "checkbox"}, b"%PDF")),
        patch.object(FormService, "_build_base_context", return_value=({}, application)),
    ):
        values, _pdf = await form_service.resolve_field_values("test_form", MagicMock())
    assert values == {"p1_unmapped": "Notiz", "p1_box": True, "p1_mapped": "Berlin", "p1_x": ""}


def test_an_attachment_is_filled_from_the_application_of_its_form():
    form_service = FormService(db=MagicMock(), forms_dir="/tmp/forms", forms_filler_url="http://filler")
    query = form_service.db.query.return_value.filter
    with patch("src.services.form_service.attachment_parents", return_value={"anlage_2": "antrag_main"}):
        form_service.find_application("anlage_2", MagicMock(id=uuid.uuid4()))
    form_type_filter = query.call_args_list[0].args[1]
    assert form_type_filter.right.value == "antrag_main"


@pytest.mark.asyncio
async def test_a_form_card_answer_goes_to_plain_columns_and_beside_the_mapping():
    group = _group("p1_name", "text", [_field("p1_city", meaning="Wohnort"), _field("p1_note", meaning="Notiz")])
    application = MagicMock(spec=UserApplications, form_type="test_form", form_data={})
    db, user_row = MagicMock(), MagicMock(id=uuid.uuid4())
    with (
        patch("src.routes.llm._open_form_groups", return_value=[("test_form", group)]),
        patch.object(FormService, "plain_profile_paths", return_value={"p1_city": ("city",)}),
        patch.object(FormService, "choice_profile_columns", return_value={}),
        patch.object(FormService, "find_application", return_value=application),
        patch("src.routes.llm.attachment_parents", return_value={}),
        patch("src.routes.llm.write_profile_payload") as write_profile,
    ):
        await _save_form_card_answer(
            db, user_row, MagicMock(), card_id("test_form", "p1_name"), {"p1_city": "Berlin", "p1_note": "x"}
        )
    assert write_profile.call_args.args[2].model_dump(exclude_unset=True) == {"city": "Berlin"}
    assert application.form_data == {"pdf_fields": {"test_form": {"p1_note": "x"}}}


@pytest.mark.asyncio
async def test_a_form_card_answer_is_checked_against_the_open_group():
    with patch("src.routes.llm._open_form_groups", return_value=[("test_form", MARITAL)]):
        with pytest.raises(HTTPException, match="invalid value"):
            await _save_form_card_answer(
                MagicMock(), MagicMock(), MagicMock(), card_id("test_form", "p1_marital_status"), {ANSWER_KEY: "7"}
            )
        with pytest.raises(HTTPException) as answered:
            await _save_form_card_answer(MagicMock(), MagicMock(), MagicMock(), card_id("test_form", "p1_gone"), {})
    assert answered.value.status_code == 409


def _seeded_user(persona: dict) -> Users:
    """The persona's `users` row as the demo seed writes it, without a database."""
    user = Users(id=uuid.uuid4())
    apply_persona_profile(user, persona["profile"], persona["slug"])
    return user


async def _open_groups_for(persona: dict, user: Users) -> list[str]:
    spec = next(a for a in persona["applications"] if a["form_type"] == "antrag_grundsicherung_im_alter")
    application = MagicMock(form_type=spec["form_type"], form_data=spec["form_data"], application_id=uuid.uuid4())
    documents = [
        MagicMock(raw_data=d["raw_data"], document_type=d["document_type"])
        for d in persona["documents"]
        if d["status"] == "verified"
    ]
    db = MagicMock()
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = documents
    with (
        patch.dict(os.environ, {"FORMS_ROOT": str(REPO_ROOT / "forms")}),
        patch.object(FormService, "find_application", return_value=application),
    ):
        open_groups = await _open_form_groups(db, user)
    return [f"{form_id}:{group['id']}" for form_id, group in open_groups]


@pytest.mark.asyncio
async def test_a_demo_persona_is_not_asked_for_what_it_leaves_out():
    persona = json.loads((REPO_ROOT / "demo" / "personas" / "helmut.json").read_text(encoding="utf-8"))
    user = _seeded_user(persona)
    assert await _open_groups_for(persona, user) != []
    user.demo_seed_fixture_hash = "seeded"
    assert await _open_groups_for(persona, user) == []


def test_a_list_of_boxes_keeps_asking_about_the_boxes_nobody_answered():
    open_groups = FormRules(RULES).open_groups({"p1_expellee": True}, ALL_BUT - {"p1_resettler"})
    assert [(g["id"], [f["field_id"] for f in g["fields"]]) for g in open_groups] == [
        ("p1_displaced", ["p1_resettler"])
    ]


def test_a_document_is_only_due_while_its_question_applies():
    routed = {**MARRIED_SINCE, "documents": [{"name": "Heiratsurkunde", "condition": "true", "form_id": "anlage_x"}]}
    rules = FormRules({**RULES, "groups": [MARITAL, routed]})
    assert rules.required_attachments({"p1_status": "0"}) == []
    assert rules.required_attachments({"p1_status": "2"}) == ["anlage_1", "anlage_x"]


def test_a_description_line_in_a_money_group_takes_text():
    group = _group("p1_repayments", "money", [{**_field("p1_label"), "input": "text"}, _field("p1_amount")])
    assert [(i.key, i.kind) for i in group_inputs(group)] == [("p1_label", "text"), ("p1_amount", "amount")]


@pytest.mark.asyncio
async def test_a_required_list_of_boxes_needs_one_ticked():
    required = {**DISPLACED, "required": True, "partial": False}
    with patch("src.routes.llm._open_form_groups", return_value=[("test_form", required)]):
        with pytest.raises(HTTPException, match="At least one"):
            await _save_form_card_answer(
                MagicMock(),
                MagicMock(),
                MagicMock(),
                card_id("test_form", "p1_displaced"),
                {"p1_expellee": False, "p1_resettler": False},
            )


@pytest.mark.asyncio
async def test_a_chat_answer_does_not_override_what_the_profile_says():
    form_service = FormService(db=MagicMock(), forms_dir="/tmp/forms", forms_filler_url="http://filler")
    application = MagicMock(form_data={"pdf_fields": {"test_form": {"p1_guardian": True, "p1_income": "500"}}})
    mapping = {"p1_guardian": "{{ has_guardian == true }}", "p1_income": "{{ income.Pension }}"}
    context = {"has_guardian": False, "income": {"Pension": 0}}
    with (
        patch(
            "src.services.form_service._get_form_assets", return_value=(mapping, {"p1_guardian": "checkbox"}, b"%PDF")
        ),
        patch.object(FormService, "_build_base_context", return_value=(context, application)),
    ):
        values, _pdf = await form_service.resolve_field_values("test_form", MagicMock())
    assert values == {"p1_guardian": False, "p1_income": "0"}


@pytest.mark.parametrize(
    "mapping, writes",
    [
        (
            "{{ marital_status == 'Single' ? '0' : marital_status == 'Married' ? '2' : '0' }}",
            (("0", "marital_status", "Single"), ("2", "marital_status", "Married")),
        ),
        ("{{ legal_gender == 'Male' ? 'Ja' : '' }}", (("Ja", "legal_gender", "Male"),)),
        ("{{ has_guardian == true }}", ((True, "has_guardian", True), (False, "has_guardian", False))),
        ("{{ sublet_room_count && sublet_room_count > 0 ? '0' : '' }}", ()),
        ("{{ partner && partner.has_guardian == true }}", ()),
        ("{{ last_name }}, {{ first_name }}", ()),
    ],
    ids=["radio chain", "one box", "checkbox", "compound test", "partner", "interpolation"],
)
def test_a_choice_mapping_is_read_backwards_only_when_it_compares_one_column(mapping, writes):
    from src.services.form_service import _choice_writes

    assert _choice_writes(mapping) == writes


@pytest.mark.asyncio
async def test_a_chosen_option_is_stored_in_the_column_its_mapping_reads():
    application = MagicMock(spec=UserApplications, form_type="test_form", form_data={})
    with (
        patch("src.routes.llm._open_form_groups", return_value=[("test_form", MARITAL)]),
        patch.object(FormService, "plain_profile_paths", return_value={}),
        patch.object(
            FormService,
            "choice_profile_columns",
            return_value={"p1_status": {"0": ("marital_status", "Single"), "2": ("marital_status", "Married")}},
        ),
        patch.object(FormService, "find_application", return_value=application),
        patch("src.routes.llm.attachment_parents", return_value={}),
        patch("src.routes.llm.write_profile_payload") as write_profile,
    ):
        await _save_form_card_answer(
            MagicMock(),
            MagicMock(id=uuid.uuid4()),
            MagicMock(),
            card_id("test_form", "p1_marital_status"),
            {"answer": "2"},
        )
    assert write_profile.call_args.args[2].model_dump(exclude_unset=True) == {"marital_status": "Married"}
    assert application.form_data == {"pdf_fields": {"test_form": {}}}


def test_a_value_the_mapping_only_defaulted_does_not_answer_the_question():
    # Familienstand resolves to '0' (ledig) while marital_status is still empty
    assert "p1_marital_status" in _open_ids({"p1_status": "0"}, ALL_BUT - {"p1_status"})


@pytest.mark.asyncio
async def test_a_field_is_answered_by_data_or_a_fixed_value_but_not_by_a_default():
    form_service = FormService(db=MagicMock(), forms_dir="/tmp/forms", forms_filler_url="http://filler")
    mapping = {
        "p1_status_empty": "{{ marital_status == 'Married' ? '2' : '0' }}",
        "p1_status_set": "{{ widowed == 'Married' ? '2' : '0' }}",
        "p1_fallback": "{{ rent ? rent : (documents.lease ? documents.lease.rent : '') }}",
        "p1_fixed": "{{ true }}",
        "p1_static": "Soziales",
        "p1_blank": "",
    }
    context = {"marital_status": None, "widowed": "Married", "rent": 430, "documents": {}}
    with (
        patch("src.services.form_service._get_form_assets", return_value=(mapping, {"p1_fixed": "checkbox"}, b"%PDF")),
        patch.object(FormService, "_build_base_context", return_value=(context, None)),
    ):
        values, answered, _pdf = await form_service.resolve_field_state("test_form", MagicMock())
    assert values["p1_status_empty"] == "0"
    assert answered == {"p1_status_set", "p1_fallback", "p1_fixed", "p1_static"}


@pytest.mark.asyncio
async def test_a_template_needs_every_part_answered():
    form_service = FormService(db=MagicMock(), forms_dir="/tmp/forms", forms_filler_url="http://filler")
    template = (
        "{{ landlord_name ? landlord_name : '' }}{{ landlord_name && landlord_address ? ', ' : '' }}"
        "{{ landlord_address ? landlord_address : '' }}"
    )
    mapping = {"p3_landlord": template}
    for context, expected in (
        ({"landlord_name": "Wohnungsbau eG", "landlord_address": None}, set()),
        ({"landlord_name": "Wohnungsbau eG", "landlord_address": "Torstr. 12"}, {"p3_landlord"}),
    ):
        with (
            patch("src.services.form_service._get_form_assets", return_value=(mapping, {}, b"%PDF")),
            patch.object(FormService, "_build_base_context", return_value=({**context, "documents": {}}, None)),
        ):
            _values, answered, _pdf = await form_service.resolve_field_state("test_form", MagicMock())
        assert answered == expected


@pytest.mark.asyncio
async def test_a_question_with_options_is_not_answered_in_the_chat():
    with patch("src.routes.llm._open_form_groups", return_value=[("test_form", MARITAL)]):
        with pytest.raises(HTTPException, match="show its card instead"):
            await _save_form_card_answer(
                MagicMock(),
                MagicMock(),
                MagicMock(),
                card_id("test_form", "p1_marital_status"),
                {ANSWER_KEY: "2"},
                in_chat=True,
            )


def _save_patches(group: dict, paths: dict, application: MagicMock, choices: dict | None = None):
    return (
        patch("src.routes.llm._open_form_groups", return_value=[("test_form", group)]),
        patch.object(FormService, "plain_profile_paths", return_value=paths),
        patch.object(FormService, "choice_profile_columns", return_value=choices or {}),
        patch.object(FormService, "find_application", return_value=application),
        patch("src.routes.llm.write_profile_payload"),
    )


@pytest.mark.asyncio
async def test_a_value_its_column_does_not_take_stays_beside_the_mapping_and_the_others_are_still_written():
    group = _group(
        "p3_bank",
        "text",
        [_field("p3_city", meaning="Ort"), _field("p3_bic", meaning="BIC"), _field("p3_phone", meaning="Telefon")],
    )
    application = MagicMock(spec=UserApplications, form_type="test_form", form_data={})
    paths = {"p3_city": ("city",), "p3_bic": ("bic",), "p3_phone": ("phone_number",)}
    first, second, third, fourth, fifth = _save_patches(group, paths, application)
    with first, second, third, fourth, fifth as write_profile:
        await _save_form_card_answer(
            MagicMock(),
            MagicMock(id=uuid.uuid4()),
            MagicMock(),
            card_id("test_form", "p3_bank"),
            # a BIC is at most 11 characters, and the chat may not write the phone number
            {"p3_city": "Berlin", "p3_bic": "DEUTDEFF500XXX", "p3_phone": "030 123"},
        )
    assert write_profile.call_args.args[2].model_dump(exclude_unset=True) == {"city": "Berlin"}
    assert application.form_data == {"pdf_fields": {"test_form": {"p3_bic": "DEUTDEFF500XXX", "p3_phone": "030 123"}}}


@pytest.mark.asyncio
@pytest.mark.parametrize("income_type", ["Employment", "Pension"])
async def test_an_amount_for_an_income_line_becomes_an_income_row(income_type):
    group = _group("p4_income", "money", [_field("p4_income", meaning="Einkommen")])
    application = MagicMock(spec=UserApplications, form_type="test_form", form_data={})
    user_row = Users(id=uuid.uuid4())
    first, second, third, fourth, fifth = _save_patches(group, {"p4_income": ("income", income_type)}, application)
    with first, second, third, fourth, fifth as write_profile:
        await _save_form_card_answer(
            MagicMock(), user_row, MagicMock(), card_id("test_form", "p4_income"), {"p4_income": 450}
        )
    rows = write_profile.call_args.args[2].model_dump(exclude_unset=True)["income_entries"]
    assert [(row["income_type"], row["monthly_amount"]) for row in rows] == [(income_type, 450)]
    assert application.form_data == {"pdf_fields": {"test_form": {}}}


@pytest.mark.asyncio
async def test_a_text_for_an_income_line_must_be_an_amount():
    group = _group("p5_pension", "text", [_field("p5_amount", meaning="Renten/Pensionen")])
    application = MagicMock(spec=UserApplications, form_type="test_form", form_data={})
    first, second, third, fourth, fifth = _save_patches(group, {"p5_amount": ("income", "Pension")}, application)
    with first, second, third, fourth, fifth, pytest.raises(HTTPException) as refused:
        await _save_form_card_answer(
            MagicMock(), Users(id=uuid.uuid4()), MagicMock(), card_id("test_form", "p5_pension"), {"p5_amount": "abc"}
        )
    assert refused.value.status_code == 422 and application.form_data == {}


@pytest.mark.parametrize(
    "mapping, path",
    [
        ("{{ street }}", ("street",)),
        ("{{ street ? street : '' }}", ("street",)),
        (
            "{{ income['Agriculture and Forestry'] ? income['Agriculture and Forestry'] : '' }}",
            ("income", "Agriculture and Forestry"),
        ),
        ("{{ street ? house_number : '' }}", None),
        ("{{ last_name }}, {{ first_name }}", None),
    ],
)
def test_the_path_a_mapping_prints_unchanged(mapping, path):
    from src.services.form_service import _plain_path

    assert _plain_path(mapping) == path


def test_a_text_that_looks_like_a_date_is_not_reformatted():
    group = _group("p1_reference", "text", [_field("p1_reference", meaning="Geschäftszeichen")])
    assert group_answer(group, {"p1_reference": "20231215"}) == {"p1_reference": "20231215"}


def test_an_unreadable_rule_file_does_not_break_the_attachment_lookup(tmp_path):
    from src.services import form_rules

    (tmp_path / "broken.rules.json").write_text("{", encoding="utf-8")
    linked = {**RULES, "groups": [MARITAL]}
    (tmp_path / "test_form.rules.json").write_text(json.dumps(linked), encoding="utf-8")
    form_rules.attachment_parents.cache_clear()
    try:
        with patch.object(form_rules, "RULES_DIR", tmp_path):
            assert form_rules.attachment_parents() == {"anlage_1": "test_form"}
    finally:
        form_rules.attachment_parents.cache_clear()
