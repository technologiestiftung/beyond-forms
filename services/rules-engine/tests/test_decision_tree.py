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


def test_decision_tree_health_scenarios() -> None:
    evaluator = DecisionTreeEvaluator()

    base_form_data = {
        "eligibility_check": {
            "is_eu_citizen_5y": False,
            "has_residence_permit": False,
            "lives_in_germany": True,
            "receives_old_age_pension": False,
            "receives_reduced_earnings_pension": True,
            "income_not_sufficient": True,
            "income_concerned_insufficient": False,
            "assets_over_10000": False,
        },
        "applicant_information": {
            "applicant_personal_details": {
                "name": "Klar",
                "birth_name": "Klar",
                "first_name": "Helmut",
                "date_of_birth": "1959-01-20",
                "place_of_birth": "Berlin",
                "citizenship": "deutsch",
            },
            "applicant_gender": "male",
            "applicant_residence_address": "Platz der Luftbruecke 4",
            "has_applicant_succor": False,
            "has_applicant_guardian": False,
            "applicant_displaced_status": "none",
            "applicant_insurance_details": {
                "social_security_status": "none",
                "health_insurance_status": "compulsory_insurance",
                "health_insurance_provider": "AOK",
                "pension_insurance_provider": "Deutsche Rentenversicherung",
                "pension_insurance_number": "1234567890",
            },
            "has_applicant_received_benefits_before": False,
            "applicant_receives_old_age_pension": False,
            "applicant_receives_reduced_earnings_pension": True,
            "persons_in_household_count": 1,
            "marital_status": "single",
        },
        "income_information": {
            "benefits_awaiting_decision_details_applicant": {
                "has_applied_for_benefits_awaiting_decision": False,
            }
        },
        "has_rec_prev": False,
    }

    # Case A: Care dependent & lives in inpatient facility
    form_data_care_home = {
        **base_form_data,
        "applicant_earning_capacity": {
            "is_applicant_employed": False,
            "is_care_dependent": True,
            "has_inpatient_facility_accommodation": True,
            "inpatient_facility_move_in_date": "2026-06-01",
            "inpatient_facility_last_residence": "Platz der Luftbrücke 4",
            "ability_to_work": "Permanently disabled",
            "reduced_work_capacity_start_date": "2026-01-01",
            "reduced_work_capacity_reason": "Severe physical condition",
            "has_disability_id": True,
            "disability_valid_until": "2029-01-01",
            "merkzeichen": "G",
        },
    }

    result = evaluator.evaluate(form_data_care_home)
    assert "step_applicant_care_dependency" in result["visited_steps"]
    assert "step_applicant_stationary_facility" in result["visited_steps"]
    assert "step_applicant_stationary_facility_dates" in result["visited_steps"]
    assert "step_applicant_reduced_earnings" in result["visited_steps"]
    assert "step_applicant_reduced_earnings_permanent" in result["visited_steps"]

    # Required documents check
    assert "care_level_notice" in result["required_documents"]
    assert "care_home_contract" in result["required_documents"]
    assert "care_facility_costs" in result["required_documents"]
    assert "pension_notice" in result["required_documents"]
    assert "disability_id" in result["required_documents"]
    assert "care_service_invoice" not in result["required_documents"]

    # Case B: Care dependent but lives at home (outpatient)
    form_data_care_home_false = {
        **base_form_data,
        "applicant_earning_capacity": {
            "is_applicant_employed": False,
            "is_care_dependent": True,
            "has_inpatient_facility_accommodation": False,
            "ability_to_work": "Fully able",
        },
    }

    result_outpatient = evaluator.evaluate(form_data_care_home_false)
    assert "step_applicant_care_dependency" in result_outpatient["visited_steps"]
    assert "step_applicant_stationary_facility" in result_outpatient["visited_steps"]
    assert "step_applicant_stationary_facility_dates" not in result_outpatient["visited_steps"]
    assert "step_applicant_reduced_earnings" in result_outpatient["visited_steps"]

    assert "care_level_notice" in result_outpatient["required_documents"]
    assert "care_service_invoice" in result_outpatient["required_documents"]
    assert "care_home_contract" not in result_outpatient["required_documents"]
    assert "care_facility_costs" not in result_outpatient["required_documents"]
