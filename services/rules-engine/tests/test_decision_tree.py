from fastapi.testclient import TestClient

from src.app.main import app
from src.app.domain.decision_tree import DecisionTreeEvaluator

client = TestClient(app)


def test_decision_tree_evaluator_german_citizen() -> None:
    # A German citizen with basic info
    form_data = {
        "applicant_information": {
            "applicant_personal_details": {
                "citizenship": "deutsch",
                "first_name": "Helmut",
                "name": "Klar",
                "birth_name": "Klar",
                "date_of_birth": "1959-01-20",
                "place_of_birth": "Berlin",
            },
            "applicant_gender": "male",
            "applicant_residence_address": "Platz der Luftbruecke 4",
            "has_applicant_succor": False,
            "has_applicant_guardian": False,
            "applicant_displaced_status": None,
        },
        "eligibility_check": {
            "is_eu_citizen_5y": False,
            "has_residence_permit": False,
            "lives_in_germany": True,
            "receives_old_age_pension": True,
            "receives_reduced_earnings_pension": False,
            "income_not_sufficient": True,
            "income_concerned_insufficient": False,
            "assets_over_10000": False,
        },
    }

    evaluator = DecisionTreeEvaluator()
    result = evaluator.evaluate(form_data)

    assert "step_eligibility_nationality" in result["visited_steps"]
    assert "step_eligibility_residence" in result["visited_steps"]
    assert "step_applicant_name" in result["visited_steps"]
    assert "step_applicant_nationality" in result["visited_steps"]

    # German citizens require ID card or passport
    assert "ID card or passport" in result["required_documents"]
    # German citizens do NOT require Anlage 2
    assert "Anlage 2" not in result["required_documents"]


def test_decision_tree_evaluator_foreign_citizen() -> None:
    # A foreign citizen
    form_data = {
        "applicant_information": {
            "applicant_personal_details": {
                "citizenship": "türkisch",
                "first_name": "Ali",
                "name": "Yilmaz",
                "birth_name": "Yilmaz",
                "date_of_birth": "1960-05-10",
                "place_of_birth": "Istanbul",
            },
            "applicant_gender": "male",
            "applicant_residence_address": "Karl-Marx-Str 100",
            "has_applicant_succor": False,
            "has_applicant_guardian": False,
            "applicant_displaced_status": None,
        },
        "eligibility_check": {
            "is_eu_citizen_5y": False,
            "has_residence_permit": True,
            "lives_in_germany": True,
            "receives_old_age_pension": True,
            "receives_reduced_earnings_pension": False,
            "income_not_sufficient": True,
            "income_concerned_insufficient": False,
            "assets_over_10000": False,
        },
    }

    evaluator = DecisionTreeEvaluator()
    result = evaluator.evaluate(form_data)

    assert "step_eligibility_nationality" in result["visited_steps"]
    assert "Anlage 2" in result["required_documents"]


def test_decision_tree_api_endpoint() -> None:
    payload = {
        "form_content": {
            "applicant_information": {
                "applicant_personal_details": {
                    "citizenship": "deutsch",
                    "first_name": "Helmut",
                    "name": "Klar",
                    "birth_name": "Klar",
                    "date_of_birth": "1959-01-20",
                    "place_of_birth": "Berlin",
                },
                "applicant_gender": "male",
                "applicant_residence_address": "Platz der Luftbruecke 4",
                "has_applicant_succor": False,
                "has_applicant_guardian": False,
            },
            "eligibility_check": {
                "lives_in_germany": True,
                "receives_old_age_pension": True,
                "receives_reduced_earnings_pension": False,
                "income_not_sufficient": True,
                "income_concerned_insufficient": False,
                "assets_over_10000": False,
            },
        }
    }

    response = client.post("/wizard/evaluate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "success"
    evaluation = data["evaluation"]
    assert "step_eligibility_nationality" in evaluation["visited_steps"]
    assert "ID card or passport" in evaluation["required_documents"]


def test_resolve_path_with_list_indexing() -> None:
    from src.app.domain.decision_tree import resolve_path

    data = {"household_members": [{"first_name": "Alice", "age": 30}, {"first_name": "Bob", "age": 25}]}

    assert resolve_path(data, "household_members[0].first_name") == "Alice"
    assert resolve_path(data, "household_members[1].age") == 25
    assert resolve_path(data, "household_members[2].first_name") is None


def test_evaluate_condition_with_operators() -> None:
    from src.app.domain.decision_tree import evaluate_condition

    data = {"household_members_count": 2, "applicant_income": 800.0, "citizenship": "deutsch"}

    # Test operator matches (making sure >= and <= don't match = operator first)
    assert evaluate_condition(data, "household_members_count >= 1") is True
    assert evaluate_condition(data, "household_members_count >= 2") is True
    assert evaluate_condition(data, "household_members_count >= 3") is False
    assert evaluate_condition(data, "applicant_income <= 1000") is True
    assert evaluate_condition(data, "applicant_income <= 800") is True
    assert evaluate_condition(data, "applicant_income <= 500") is False
    assert evaluate_condition(data, "citizenship = 'deutsch'") is True
    assert evaluate_condition(data, "citizenship != 'deutsch'") is False


def _health(**earning_capacity) -> dict:
    return {
        "applicant_earning_capacity": earning_capacity,
        "benefits_for_special_additional_needs": {"does_household_have_costly_nutrition_for_medical_reasons": False},
    }


def test_decision_tree_health_scenarios() -> None:
    evaluator = DecisionTreeEvaluator()

    # Case A: care dependent, in an inpatient facility, permanently disabled with a disability ID
    result = evaluator.evaluate(
        _health(
            is_care_dependent=True,
            has_inpatient_facility_accommodation=True,
            inpatient_facility_move_in_date="2026-06-01",
            inpatient_facility_last_residence="Platz der Luftbrücke 4",
            ability_to_work="Permanently disabled",
            reduced_work_capacity_start_date="2026-01-01",
            reduced_work_capacity_reason="Severe physical condition",
            has_disability_id=True,
            disability_valid_until="2029-01-01",
            merkzeichen="G",
        ),
        "step_applicant_care_dependency",
    )
    assert result["visited_steps"] == [
        "step_applicant_care_dependency",
        "step_applicant_stationary_facility",
        "step_applicant_stationary_facility_dates",
        "step_applicant_reduced_earnings",
        "step_applicant_reduced_earnings_permanent",
        "step_applicant_disability",
        "step_applicant_nutrition",
    ]
    assert result["next_step"] == "END"
    assert {"care_level_notice", "care_home_contract", "care_facility_costs", "pension_notice", "disability_id"} <= set(
        result["required_documents"]
    )
    assert "care_service_invoice" not in result["required_documents"]

    # Case B: care dependent but at home, fully able to work
    result = evaluator.evaluate(
        _health(is_care_dependent=True, has_inpatient_facility_accommodation=False, ability_to_work="Fully able"),
        "step_applicant_care_dependency",
    )
    assert result["visited_steps"] == [
        "step_applicant_care_dependency",
        "step_applicant_stationary_facility",
        "step_applicant_reduced_earnings",
        "step_applicant_nutrition",
    ]
    assert "care_service_invoice" in result["required_documents"]
    assert "care_home_contract" not in result["required_documents"]


def test_decision_tree_starts_at_the_given_step() -> None:
    result = DecisionTreeEvaluator().evaluate({}, "step_applicant_name")
    assert result["visited_steps"] == ["step_applicant_name"]
    assert result["next_step"] == "step_applicant_name"


def test_decision_tree_unknown_start_step_falls_back_to_the_initial_step() -> None:
    result = DecisionTreeEvaluator().evaluate({}, "step_does_not_exist")
    assert result["visited_steps"] == ["step_eligibility_nationality"]


def test_decision_tree_marital_and_displaced_branches() -> None:
    evaluator = DecisionTreeEvaluator()
    household = {
        "applicant_information": {
            "has_applicant_succor": False,
            "has_applicant_guardian": False,
            "applicant_displaced_status": "none",
            "applicant_insurance_details": {
                "health_insurance_status": "Compulsory Insurance",
                "health_insurance_provider": "AOK Nordost",
                "social_security_status": "Pension Insurance",
            },
            "persons_in_household_count": 2,
            "marital_status": "Married",
        }
    }
    result = evaluator.evaluate(household, "step_applicant_legal_support")
    assert "step_applicant_displaced_details" not in result["visited_steps"]
    assert result["next_step"] == "step_marital_status_since"

    household["applicant_information"]["marital_status"] = "Single"
    result = evaluator.evaluate(household, "step_applicant_legal_support")
    assert result["next_step"] == "step_applicant_accommodation_type"


def _housing(**accommodation) -> dict:
    return {"applicant_accommodation": accommodation}


def test_decision_tree_housing_branches() -> None:
    evaluator = DecisionTreeEvaluator()
    costs = {
        "applicant_rent_total": 520.0,
        "applicant_heating_cost_advance": 80.0,
        "applicant_hot_water_costs": 20.0,
        "applicant_cable_tv_costs": 0.0,
        "applicant_accommodation_living_area": 52.0,
        "applicant_accommodation_number_of_rooms": 2,
        "applicant_heating_type": "Gasheizung",
    }

    main_tenant = evaluator.evaluate(
        _housing(
            applicant_accommodation_type="Rental Apartment",
            applicant_tenancy_status="Main Tenant",
            applicant_landlord_name="Wohnungsbaugesellschaft Mitte",
            applicant_accommodation_sublet_number_of_rooms=0,
            applicant_accommodation_sublet_empty_rooms_rent=0.0,
            applicant_rent_arrears=0.0,
            **costs,
        ),
        "step_applicant_accommodation_type",
    )
    assert main_tenant["visited_steps"] == [
        "step_applicant_accommodation_type",
        "step_applicant_rental_details",
        "step_applicant_sublet",
        "step_applicant_rent_arrears",
        "step_applicant_accommodation_costs",
        "step_applicant_accommodation_details",
        "step_applicant_heating",
        "step_applicant_benefits_awaiting_decision",
    ]

    subtenant = evaluator.evaluate(
        _housing(
            applicant_accommodation_type="Rental Apartment",
            applicant_tenancy_status="Subtenant",
            applicant_landlord_name="Anna Schmidt",
            applicant_rent_arrears=300.0,
        ),
        "step_applicant_accommodation_type",
    )
    assert "step_applicant_sublet" not in subtenant["visited_steps"]
    assert subtenant["next_step"] == "step_applicant_rent_arrears_details"

    owner = evaluator.evaluate(
        _housing(
            applicant_accommodation_type="Own Home",
            applicant_accommodation_sublet_number_of_rooms=0,
            applicant_accommodation_sublet_empty_rooms_rent=0.0,
            **costs,
        ),
        "step_applicant_accommodation_type",
    )
    assert "step_applicant_rent_arrears" not in owner["visited_steps"]
    assert owner["next_step"] == "step_applicant_benefits_awaiting_decision"

    shared = evaluator.evaluate(
        _housing(applicant_accommodation_type="Shared Household"), "step_applicant_accommodation_type"
    )
    assert shared["visited_steps"] == ["step_applicant_accommodation_type", "step_applicant_benefits_awaiting_decision"]
    assert shared["next_step"] == "step_applicant_benefits_awaiting_decision"

    free_lodging = evaluator.evaluate(
        _housing(
            applicant_accommodation_type="Rental Apartment",
            applicant_free_housing_right_holder="Erika Klar",
        ),
        "step_applicant_accommodation_type",
    )
    assert free_lodging["visited_steps"] == [
        "step_applicant_accommodation_type",
        "step_applicant_rental_details",
        "step_applicant_benefits_awaiting_decision",
    ]

    no_tenancy = evaluator.evaluate(
        _housing(applicant_accommodation_type="Rental Apartment"), "step_applicant_accommodation_type"
    )
    assert no_tenancy["next_step"] == "step_applicant_rental_details"
