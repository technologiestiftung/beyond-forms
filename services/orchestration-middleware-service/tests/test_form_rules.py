import json
import os
import tomllib
import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from src.models import UserApplications, Users
from src.routes.llm import _open_form_groups, _save_form_card_answer
from src.services.demo_seed_service import _coerce_to_column
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
from src.services.user_service import apply_profile_key, ordered_profile_items

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
    assert _open_ids({"p1_status": "0", "p1_female": True}, {"p1_expellee", "p1_resettler"}) == []


def test_a_follow_up_only_opens_when_its_condition_holds():
    assert _open_ids({"p1_status": "0"}, ALL_BUT) == []
    assert _open_ids({"p1_status": "2"}, ALL_BUT - {"p1_status"}) == ["p1_married_since"]
    # once the note is given, only the required date is still missing
    open_groups = FormRules(RULES).open_groups({"p1_status": "2", "p1_note": "Notiz"}, ALL_BUT - {"p1_status"})
    assert [f["field_id"] for f in open_groups[0]["fields"]] == ["p1_since"]
    assert _open_ids({"p1_status": "2", "p1_since": "01.01.2000"}, ALL_BUT - {"p1_status"}) == []


def test_a_question_that_may_stay_empty_is_asked_once():
    assert "p1_displaced" in _open_ids({})
    # answered "none": both boxes stored unticked
    assert "p1_displaced" not in _open_ids({}, {"p1_expellee", "p1_resettler"})


def test_documents_and_attachments_follow_their_condition():
    rules = FormRules(RULES)
    assert rules.required_documents({"p1_status": "2"}) == ["Anlage 1"]
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
        patch.object(FormService, "plain_profile_columns", return_value={"p1_city": "city"}),
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
    columns = {c.name: c for c in Users.__table__.columns}
    for key, value in ordered_profile_items(persona["profile"]):
        if not apply_profile_key(user, key, value):
            setattr(user, key, _coerce_to_column(columns[key], value))
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
