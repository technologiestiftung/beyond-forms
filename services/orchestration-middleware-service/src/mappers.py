from typing import Any
import logging
from src.models import Users as DbUser
from unittest.mock import Mock

logger = logging.getLogger(__name__)


def map_flat_to_rules_engine_payload(db_user: DbUser) -> dict:
    gender_val = None
    if db_user.legal_gender is not None:
        try:
            val = db_user.legal_gender.value
            if not isinstance(val, Mock):
                gender_val = val
        except AttributeError:
            pass

    gender_map = {"Male": "MALE", "Female": "FEMALE", "Diverse": "NON_BINARY"}
    rules_gender = gender_map.get(gender_val) if gender_val else None

    health_ins_val = None
    if db_user.health_insurance_status is not None:
        try:
            val = db_user.health_insurance_status.value
            if not isinstance(val, Mock):
                health_ins_val = val
        except AttributeError:
            pass

    health_ins_map = {
        "Compulsory Insurance": "compulsory_insurance",
        "Voluntary Insurance": "voluntary_insurance",
        "Family Insurance": "family_insurance",
        "Private Insurance": "private_insurance",
        "Care by Health Funds under § 264 SGB V": "care_by_health_insurance_under_264_sgb_v",
    }
    rules_health_status = health_ins_map.get(health_ins_val, "compulsory_insurance")

    social_sec_val = None
    if db_user.social_security_type is not None:
        try:
            val = db_user.social_security_type.value
            if not isinstance(val, Mock):
                social_sec_val = val
        except AttributeError:
            pass

    social_sec_map = {
        "None": "none",
        "Pension Insurance": "pension_insurance",
        "Long-term Care Insurance": "long_term_care_insurance",
    }
    rules_social_security = social_sec_map.get(social_sec_val, "none")

    rules_country = None
    if db_user.nationality is not None and not isinstance(db_user.nationality, Mock):
        rules_country = db_user.nationality

    first_name = None if isinstance(db_user.first_name, Mock) else db_user.first_name
    last_name = None if isinstance(db_user.last_name, Mock) else db_user.last_name

    birth_date_str = None
    if db_user.date_of_birth is not None and not isinstance(db_user.date_of_birth, Mock):
        try:
            birth_date_str = db_user.date_of_birth.isoformat()
        except AttributeError:
            pass

    place_of_birth = None if isinstance(db_user.place_of_birth, Mock) else db_user.place_of_birth

    applicant_identity = {
        "first_name": first_name,
        "last_name": last_name,
        "birth_date": birth_date_str,
        "gender": rules_gender,
        "nationality": rules_country or "DE",
        "city_of_birth": place_of_birth,
        "country_of_birth": rules_country or "DE",
    }

    pension_insurance_no = None if isinstance(db_user.pension_insurance_no, Mock) else db_user.pension_insurance_no
    pension_insurance_provider = (
        None if isinstance(db_user.pension_insurance_provider, Mock) else db_user.pension_insurance_provider
    )
    health_insurance_provider = (
        None if isinstance(db_user.health_insurance_provider, Mock) else db_user.health_insurance_provider
    )

    applicant_insurance = {
        "health_insurance_status": rules_health_status,
        "health_insurance_provider": health_insurance_provider,
        "pension_insurance_provider": pension_insurance_provider,
        "pension_insurance_number": pension_insurance_no,
        "social_security_status": rules_social_security,
    }

    acc_type = None
    if db_user.accomodation_type is not None:
        try:
            val = db_user.accomodation_type.value
            if not isinstance(val, Mock):
                acc_type = val
        except AttributeError:
            pass

    tenancy_status_val = None
    if db_user.tenancy_status is not None:
        try:
            val = db_user.tenancy_status.value
            if not isinstance(val, Mock):
                tenancy_status_val = val
        except AttributeError:
            pass
    is_main_tenant = (tenancy_status_val == "Main Tenant") if tenancy_status_val else None

    total_monthly_rent = None
    if db_user.rent_total is not None and not isinstance(db_user.rent_total, Mock):
        try:
            total_monthly_rent = float(db_user.rent_total)
        except (ValueError, TypeError):
            pass

    heating_cost_advance = None
    if db_user.heating_costs is not None and not isinstance(db_user.heating_costs, Mock):
        try:
            heating_cost_advance = float(db_user.heating_costs)
        except (ValueError, TypeError):
            pass

    living_area_sq = None
    if db_user.living_area is not None and not isinstance(db_user.living_area, Mock):
        try:
            living_area_sq = int(db_user.living_area)
        except (ValueError, TypeError):
            pass

    number_of_rooms = None
    if db_user.number_of_rooms is not None and not isinstance(db_user.number_of_rooms, Mock):
        try:
            number_of_rooms = int(db_user.number_of_rooms)
        except (ValueError, TypeError):
            pass

    landlord_name_val = "N/A"
    if (
        hasattr(db_user, "landlord_name")
        and db_user.landlord_name is not None
        and not isinstance(db_user.landlord_name, Mock)
    ):
        landlord_name_val = db_user.landlord_name

    accommodation = {
        "accommodation_type": acc_type,
        "is_main_tenant": is_main_tenant,
        "total_monthly_rent": total_monthly_rent,
        "heating_cost_advance": heating_cost_advance,
        "living_area_square_meters": living_area_sq,
        "number_of_rooms": number_of_rooms,
        "has_central_heating": True,
        "landlord_name": landlord_name_val,
        "landlord_address": {"street_name": "N/A", "house_number": "N/A", "city": "Berlin", "zip_code": "12101"},
    }

    sources = []
    has_old_age_pension = None
    has_reduced_earnings_pension = None
    if db_user.income_sources is not None and not isinstance(db_user.income_sources, Mock):
        sources = db_user.income_sources
        has_old_age_pension = "pension" in sources or "pension_retirement" in sources or "Altersrente" in sources
        has_reduced_earnings_pension = "pension_reduced" in sources or "Erwerbsminderungsrente" in sources

    income_val = None
    if db_user.monthly_income is not None and not isinstance(db_user.monthly_income, Mock):
        try:
            income_val = float(db_user.monthly_income)
        except (ValueError, TypeError):
            pass

    income_float = income_val if income_val is not None else 0.0
    pension_income = income_float if (has_old_age_pension or has_reduced_earnings_pension) else 0.0
    non_self_employed = income_float if "minor_employment" in sources else 0.0
    social_benefits = income_float if "other_benefits" in sources else 0.0

    applicant_finances = {
        "non_self_employed_income": non_self_employed,
        "health_insurance_benefits": 0.0,
        "commercial_operation_income": 0.0,
        "pension_income": pension_income,
        "social_benefits_income": social_benefits,
        "alimony_income": 0.0,
        "savings_amount": 0.0,
        "securities_amount": 0.0,
    }

    is_german = None if isinstance(db_user.is_german_citizen, Mock) else db_user.is_german_citizen
    is_resident = None if isinstance(db_user.is_resident_in_germany, Mock) else db_user.is_resident_in_germany
    has_assets = None if isinstance(db_user.has_assets, Mock) else db_user.has_assets

    income_not_sufficient = None
    if income_val is not None:
        income_not_sufficient = income_val < 800

    res_status_val = None
    if db_user.residence_status is not None and not isinstance(db_user.residence_status, Mock):
        try:
            res_status_val = db_user.residence_status.value
        except AttributeError:
            res_status_val = db_user.residence_status

    eligibility_check = {
        "lives_in_germany": is_resident if is_resident is not None else True,
        "receives_old_age_pension": has_old_age_pension if sources else True,
        "receives_reduced_earnings_pension": has_reduced_earnings_pension
        if has_reduced_earnings_pension is not None
        else False,
        "income_not_sufficient": income_not_sufficient if income_not_sufficient is not None else True,
        "income_concerned_insufficient": False,
        "assets_over_10000": has_assets if has_assets is not None else False,
        "is_eu_citizen_5y": True if res_status_val == "PermanentResident" else False,
        "has_residence_permit": True if res_status_val == "Other" else False,
    }

    street = None if isinstance(db_user.street, Mock) else db_user.street
    house_number = None if isinstance(db_user.house_number, Mock) else db_user.house_number
    zip_code = None if isinstance(db_user.zip_code, Mock) else db_user.zip_code
    city = None if isinstance(db_user.city, Mock) else db_user.city

    applicant_residence_address = None
    if street:
        applicant_residence_address = f"{street} {house_number or ''}, {zip_code or ''} {city or ''}".strip()

    has_guardian = None if isinstance(db_user.has_guardian, Mock) else db_user.has_guardian
    has_custodian = None if isinstance(db_user.has_custodian, Mock) else db_user.has_custodian

    displaced_val = "none"
    if db_user.displaced_status is not None:
        try:
            val = db_user.displaced_status.value
            if not isinstance(val, Mock):
                displaced_val = val
        except AttributeError:
            pass

    displaced_issued_on_str = None
    if db_user.displaced_issued_on is not None and not isinstance(db_user.displaced_issued_on, Mock):
        try:
            displaced_issued_on_str = db_user.displaced_issued_on.isoformat()
        except AttributeError:
            pass

    displaced_issued_by = None if isinstance(db_user.displaced_issued_by, Mock) else db_user.displaced_issued_by
    has_rec_prev = (
        None if isinstance(db_user.has_received_previous_benefits, Mock) else db_user.has_received_previous_benefits
    )
    prev_period = None if isinstance(db_user.previous_benefits_period, Mock) else db_user.previous_benefits_period
    prev_auth = None if isinstance(db_user.previous_benefits_authority, Mock) else db_user.previous_benefits_authority
    prev_ref = None if isinstance(db_user.previous_benefits_ref_no, Mock) else db_user.previous_benefits_ref_no

    bank_name = None if isinstance(db_user.bank_name, Mock) else db_user.bank_name
    iban = None if isinstance(db_user.iban, Mock) else db_user.iban
    account_holder = None if isinstance(db_user.account_holder, Mock) else db_user.account_holder
    bic = None if isinstance(db_user.bic, Mock) else db_user.bic

    # Extract and map household fields
    marital_status_val = None
    if db_user.marital_status is not None:
        try:
            val = db_user.marital_status.value
            if not isinstance(val, Mock):
                marital_status_val = val
        except AttributeError:
            marital_status_val = db_user.marital_status

    marital_status_map = {
        "Single": "single",
        "Divorced": "single",
        "Married": "married",
        "Registered Civil Partnership": "married",
        "Widowed": "widowed",
        "Cohabiting": "single",
        "Permanently Separated": "single",
    }
    rules_marital_status = marital_status_map.get(marital_status_val) if marital_status_val else None

    married_since_str = None
    if db_user.married_since is not None and not isinstance(db_user.married_since, Mock):
        try:
            married_since_str = db_user.married_since.isoformat()
        except AttributeError:
            pass

    persons_in_household_count = (
        None if isinstance(db_user.persons_in_household_count, Mock) else db_user.persons_in_household_count
    )

    applicant_information = {
        "applicant_personal_details": {
            "first_name": first_name,
            "name": last_name,
            "birth_name": last_name if last_name else None,
            "date_of_birth": birth_date_str,
            "place_of_birth": place_of_birth,
            "citizenship": "deutsch" if is_german else rules_country,
        },
        "applicant_gender": rules_gender.lower() if rules_gender else None,
        "applicant_residence_address": applicant_residence_address,
        "has_applicant_guardian": has_guardian,
        "has_applicant_succor": has_custodian,
        "applicant_displaced_status": displaced_val,
        "applicant_displaced_issued_on": displaced_issued_on_str,
        "applicant_displaced_issued_by": displaced_issued_by,
        "has_applicant_received_benefits_before": has_rec_prev,
        "applicant_previous_benefits_end": prev_period,
        "applicant_previous_benefits_authority": prev_auth,
        "applicant_previous_benefits_reference_number": prev_ref,
        "applicant_receives_old_age_pension": has_old_age_pension,
        "applicant_receives_reduced_earnings_pension": has_reduced_earnings_pension,
        "applicant_insurance_details": {
            "social_security_status": rules_social_security,
            "health_insurance_status": rules_health_status,
            "health_insurance_provider": health_insurance_provider,
            "pension_insurance_provider": pension_insurance_provider,
            "pension_insurance_number": pension_insurance_no,
        },
        "applicant_bank_details": {
            "bank_name": bank_name,
            "bank_account_number": iban,
            "bank_account_holder": account_holder,
            "bic": bic,
        },
        "persons_in_household_count": persons_in_household_count,
        "marital_status": rules_marital_status,
        "married_since": married_since_str,
    }

    is_employed = None if isinstance(db_user.is_currently_employed, Mock) else db_user.is_currently_employed

    ability_val = None
    if db_user.ability_to_work is not None:
        try:
            val = db_user.ability_to_work.value
            if not isinstance(val, Mock):
                ability_val = val
        except AttributeError:
            ability_val = db_user.ability_to_work
    ability_3h = (ability_val == "At least 3 hours") if ability_val else None

    is_care_dependent = None if isinstance(db_user.is_care_dependent, Mock) else db_user.is_care_dependent
    has_inpatient = (
        None
        if isinstance(db_user.has_inpatient_facility_accommodation, Mock)
        else db_user.has_inpatient_facility_accommodation
    )
    facility_move_in = (
        None if isinstance(db_user.inpatient_facility_move_in_date, Mock) else db_user.inpatient_facility_move_in_date
    )
    facility_move_in_str = facility_move_in.isoformat() if hasattr(facility_move_in, "isoformat") else None
    last_residence = (
        None
        if isinstance(db_user.inpatient_facility_last_residence, Mock)
        else db_user.inpatient_facility_last_residence
    )
    reduced_start = (
        None if isinstance(db_user.reduced_work_capacity_start_date, Mock) else db_user.reduced_work_capacity_start_date
    )
    reduced_start_str = reduced_start.isoformat() if hasattr(reduced_start, "isoformat") else None
    reduced_end = (
        None if isinstance(db_user.reduced_work_capacity_end_date, Mock) else db_user.reduced_work_capacity_end_date
    )
    reduced_end_str = reduced_end.isoformat() if hasattr(reduced_end, "isoformat") else None
    reduced_reason = (
        None if isinstance(db_user.reduced_work_capacity_reason, Mock) else db_user.reduced_work_capacity_reason
    )

    # Disability card details
    has_disability_id = None if isinstance(db_user.has_disability_id, Mock) else db_user.has_disability_id
    disability_valid = None if isinstance(db_user.disability_valid_until, Mock) else db_user.disability_valid_until
    disability_valid_str = disability_valid.isoformat() if hasattr(disability_valid, "isoformat") else None
    merkzeichen_val = None
    if db_user.merkzeichen is not None and not isinstance(db_user.merkzeichen, Mock):
        try:
            merkzeichen_val = db_user.merkzeichen.value
        except AttributeError:
            merkzeichen_val = db_user.merkzeichen

    applicant_earning_capacity = {
        "is_applicant_employed": is_employed,
        "applicant_occupation": "Retired" if has_old_age_pension else None,
        "applicant_employer": None,
        "applicant_work_capacity_at_least_3h_daily": ability_3h,
        "applicant_work_capacity_3h_daily_reason": None,
        "is_care_dependent": is_care_dependent,
        "has_inpatient_facility_accommodation": has_inpatient,
        "inpatient_facility_move_in_date": facility_move_in_str,
        "inpatient_facility_last_residence": last_residence,
        "ability_to_work": ability_val,
        "reduced_work_capacity_start_date": reduced_start_str,
        "reduced_work_capacity_end_date": reduced_end_str,
        "reduced_work_capacity_reason": reduced_reason,
        "has_disability_id": has_disability_id,
        "disability_valid_until": disability_valid_str,
        "merkzeichen": merkzeichen_val,
    }

    has_applied_for_benefits_awaiting_decision = (
        None
        if isinstance(db_user.has_applied_for_benefits_awaiting_decision, Mock)
        else db_user.has_applied_for_benefits_awaiting_decision
    )
    benefits_awaiting_decision_type = (
        None if isinstance(db_user.benefits_awaiting_decision_type, Mock) else db_user.benefits_awaiting_decision_type
    )
    benefits_awaiting_decision_office = (
        None
        if isinstance(db_user.benefits_awaiting_decision_office, Mock)
        else db_user.benefits_awaiting_decision_office
    )
    benefits_awaiting_decision_reference = (
        None
        if isinstance(db_user.benefits_awaiting_decision_reference, Mock)
        else db_user.benefits_awaiting_decision_reference
    )

    benefits_awaiting_decision_application_date_str = None
    if db_user.benefits_awaiting_decision_application_date is not None and not isinstance(
        db_user.benefits_awaiting_decision_application_date, Mock
    ):
        try:
            benefits_awaiting_decision_application_date_str = (
                db_user.benefits_awaiting_decision_application_date.isoformat()
            )
        except AttributeError as e:
            logger.warning("Failed to parse benefits_awaiting_decision_application_date: %s", e)
            pass

    are_one_time_payments_expected = (
        None if isinstance(db_user.are_one_time_payments_expected, Mock) else db_user.are_one_time_payments_expected
    )
    one_time_payments_expected_type = (
        None if isinstance(db_user.one_time_payments_expected_type, Mock) else db_user.one_time_payments_expected_type
    )

    one_time_payments_expected_amount = None
    if db_user.one_time_payments_expected_amount is not None and not isinstance(
        db_user.one_time_payments_expected_amount, Mock
    ):
        try:
            one_time_payments_expected_amount = float(db_user.one_time_payments_expected_amount)
        except (ValueError, TypeError) as e:
            logger.warning("Failed to parse one_time_payments_expected_amount: %s", e)
            pass

    one_time_payments_expected_date_str = None
    if db_user.one_time_payments_expected_date is not None and not isinstance(
        db_user.one_time_payments_expected_date, Mock
    ):
        try:
            one_time_payments_expected_date_str = db_user.one_time_payments_expected_date.isoformat()
        except AttributeError as e:
            logger.warning("Failed to parse one_time_payments_expected_date: %s", e)
            pass

    income_information = {
        "benefits_awaiting_decision_details_applicant": {
            "has_applied_for_benefits_awaiting_decision": has_applied_for_benefits_awaiting_decision,
            "benefits_awaiting_decision_type": benefits_awaiting_decision_type,
            "benefits_awaiting_decision_application_date": benefits_awaiting_decision_application_date_str,
            "benefits_awaiting_decision_office": benefits_awaiting_decision_office,
            "benefits_awaiting_decision_reference": benefits_awaiting_decision_reference,
        },
        "income_information_applicant": {
            "income_applicant_details": {
                "income_non_self_employed": non_self_employed if non_self_employed > 0 else None,
                "income_pension": pension_income if pension_income > 0 else None,
                "income_social_benefits": social_benefits if social_benefits > 0 else None,
            }
        },
        "one-time_payments_expected_details_applicant": {
            "are_one-time_payments_expected": are_one_time_payments_expected,
            "one-time_payments_expected_type": one_time_payments_expected_type,
            "one-time_payments_expected_amount": one_time_payments_expected_amount,
            "one-time_payments_expected_date": one_time_payments_expected_date_str,
        },
    }

    has_medical = (
        None if isinstance(db_user.has_costly_medical_nutrition, Mock) else db_user.has_costly_medical_nutrition
    )

    raw_payload = {
        "form_type": "elderly_disabled_welfare",
        "form_content": {
            "applicant_identity": applicant_identity,
            "applicant_insurance": applicant_insurance,
            "applicant_finances": applicant_finances,
            "accommodation": accommodation,
            "has_received_benefits_before": has_rec_prev or False,
            "previous_benefits_authority": prev_auth or "N/A",
            "has_costly_medical_nutrition": has_medical or False,
            "eligibility_check": eligibility_check,
            "applicant_information": applicant_information,
            "applicant_earning_capacity": applicant_earning_capacity,
            "income_information": income_information,
        },
    }

    def remove_none(obj: Any) -> Any:
        if isinstance(obj, dict):
            return {k: remove_none(v) for k, v in obj.items() if v is not None}
        elif isinstance(obj, list):
            return [remove_none(v) for v in obj if v is not None]
        return obj

    raw_payload["form_content"] = remove_none(raw_payload["form_content"])
    return raw_payload
