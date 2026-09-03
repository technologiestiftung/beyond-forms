from datetime import date
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, Any, Dict
import decimal
import uuid

from src.models import (
    AssociationType,
    GenderType,
    MaritalStatusType,
    DisplacedStatusType,
    SocialSecurityTypeType,
    HealthInsuranceStatusType,
    AbilityToWorkType,
    AccomodationType,
    TenancyStatusType,
    DisabilityMerkzeichenType,
    TutorialStatusType,
)


class AssociatedPersonSchema(BaseModel):
    """One row of `associated_persons`, replacing the untyped `household_members` dicts."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    association_type: AssociationType = Field(description="What this person is to the applicant")
    lives_in_household: bool = Field(
        True,
        description=(
            "Whether this person lives in the applicant's household. A spouse living "
            "elsewhere still belongs here with false rather than being omitted."
        ),
    )
    sort_order: int = Field(0, description="Position in the fixed person slots of a form (0-based)")

    first_name: Optional[str] = Field(None, max_length=255)
    last_name: Optional[str] = Field(None, max_length=255)
    birth_name: Optional[str] = Field(None, max_length=255)
    date_of_birth: Optional[date] = None
    place_of_birth: Optional[str] = Field(None, max_length=255)
    legal_gender: Optional[GenderType] = None
    marital_status: Optional[MaritalStatusType] = None
    nationality: Optional[str] = Field(None, pattern=r"^[A-Z]{2}$", description="ISO 3166-1 alpha-2 country code")
    second_nationality: Optional[str] = Field(None, pattern=r"^[A-Z]{2}$")
    relationship_to_applicant: Optional[str] = Field(
        None,
        max_length=255,
        description="How the person is related, as it should be printed on a form (e.g. 'Ehefrau')",
    )
    employment_status: Optional[str] = Field(None, max_length=255)
    monthly_income: Optional[decimal.Decimal] = Field(None, ge=0)
    monthly_pension_income: Optional[decimal.Decimal] = Field(None, ge=0)
    has_own_income: Optional[bool] = None
    is_alimony_obligated: Optional[bool] = None

    @field_validator("date_of_birth")
    @classmethod
    def _date_of_birth_is_plausible(cls, value: Optional[date]) -> Optional[date]:
        """Mirrors the `associated_persons_dob_plausible` CHECK. Without it a typo'd
        year reaches Postgres and surfaces as an unhandled IntegrityError (a 500)
        instead of a field-level 422."""
        if value is not None and not (date(1900, 1, 1) <= value <= date.today()):
            raise ValueError("must be between 1900-01-01 and today")
        return value


class UserProfileValidationSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    place_of_birth: Optional[str] = None
    legal_gender: Optional[str] = None
    is_german_citizen: Optional[bool] = None
    nationality: Optional[str] = None
    second_nationality: Optional[str] = None
    marital_status: Optional[str] = None
    street: Optional[str] = None
    house_number: Optional[str] = None
    zip_code: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    birth_name: Optional[str] = None
    residence_status: Optional[str] = None
    identification_numbers: Optional[str] = None
    tax_id: Optional[str] = None

    # Household fields
    persons_in_household_count: Optional[int] = None
    marital_status: Optional[str] = None
    married_since: Optional[date] = None
    has_guardian: Optional[bool] = None
    has_custodian: Optional[bool] = None
    displaced_status: Optional[str] = None
    displaced_issued_on: Optional[date] = None
    displaced_issued_by: Optional[str] = None
    social_security_type: Optional[str] = None
    health_insurance_provider: Optional[str] = None
    health_insurance_status: Optional[str] = None
    has_applied_for_asylum_benefits: Optional[bool] = None

    # Housing fields
    accomodation_type: Optional[str] = None
    tenancy_status: Optional[str] = None
    rent_total: Optional[decimal.Decimal] = None
    heating_costs: Optional[decimal.Decimal] = None
    living_area: Optional[decimal.Decimal] = None
    number_of_rooms: Optional[int] = None
    sublet_room_count: Optional[int] = None
    sublet_rent_income: Optional[decimal.Decimal] = None
    rent_paid_until: Optional[date] = None
    landlord_name: Optional[str] = None
    heating_type: Optional[str] = None
    free_housing_right_holder: Optional[str] = None
    hot_water_costs: Optional[decimal.Decimal] = None
    cable_tv_costs: Optional[decimal.Decimal] = None
    is_subsidized_housing: Optional[bool] = None
    has_other_residence: Optional[bool] = None
    has_secondary_residence: Optional[bool] = None
    has_garage_costs: Optional[bool] = None
    garage_costs: Optional[decimal.Decimal] = None
    has_household_energy_costs: Optional[bool] = None
    household_energy_costs: Optional[decimal.Decimal] = None
    is_living_area_used_commercially: Optional[bool] = None
    commercially_used_area_sqm: Optional[decimal.Decimal] = None

    # Financial and Asset fields
    monthly_income: Optional[decimal.Decimal] = Field(None, ge=0)
    has_assets: Optional[bool] = None
    assets_description: Optional[str] = Field(None, max_length=1000)
    income_sources: Optional[list[str]] = None
    assets_types: Optional[list[str]] = None
    associated_persons: Optional[list[AssociatedPersonSchema]] = None
    is_student_or_trainee: Optional[bool] = None
    professional_expenses: Optional[decimal.Decimal] = None
    has_childcare_expenses: Optional[bool] = None
    is_victim_of_national_socialist_persecution: Optional[bool] = None

    # Wohngeld and Bewohnerparkausweis yes/no questions. Nullable: NULL means not asked.
    is_wohngeld_first_application: Optional[bool] = None
    receives_wohngeld_for_other_dwelling: Optional[bool] = None
    household_member_died_recently: Optional[bool] = None
    household_size_will_change: Optional[bool] = None
    receives_other_transfer_benefits: Optional[bool] = None
    pays_child_or_spousal_support: Optional[bool] = None
    receives_support_from_others: Optional[bool] = None
    expects_future_income_change: Optional[bool] = None
    assets_exceed_wohngeld_threshold: Optional[bool] = None
    related_to_landlord: Optional[bool] = None
    service_costs_included_in_rent: Optional[bool] = None
    rent_paid_partly_by_third_party: Optional[bool] = None
    receives_rent_contribution_from_others: Optional[bool] = None
    expects_rent_change: Optional[bool] = None
    wohngeld_payment_to_applicant: Optional[bool] = None
    consents_to_bank_statement_retention: Optional[bool] = None
    consents_to_registry_verification: Optional[bool] = None
    email: Optional[str] = None

    # Health fields
    has_disability_id: Optional[bool] = None
    disability_valid_until: Optional[date] = None
    merkzeichen: Optional[str] = None
    has_costly_medical_nutrition: Optional[bool] = None
    is_care_dependent: Optional[bool] = None
    inpatient_facility_move_in_date: Optional[date] = None
    inpatient_facility_last_residence: Optional[str] = None
    reduced_work_capacity_start_date: Optional[date] = None
    reduced_work_capacity_end_date: Optional[date] = None
    reduced_work_capacity_reason: Optional[str] = None
    bic: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    iban: Optional[str] = None
    has_applied_for_benefits_awaiting_decision: Optional[bool] = None
    benefits_awaiting_decision_type: Optional[str] = None
    benefits_awaiting_decision_application_date: Optional[date] = None
    benefits_awaiting_decision_office: Optional[str] = None
    benefits_awaiting_decision_reference: Optional[str] = None
    are_one_time_payments_expected: Optional[bool] = None
    one_time_payments_expected_type: Optional[str] = None
    one_time_payments_expected_amount: Optional[decimal.Decimal] = None
    one_time_payments_expected_date: Optional[date] = None

    # E-Checker Sync fields
    is_resident_in_germany: Optional[bool] = None
    has_permanent_reduction_in_earning_capacity: Optional[bool] = None
    ability_to_work: Optional[str] = None

    # Control parameter
    validate_entire_form: Optional[bool] = None

    @field_validator("iban", mode="before")
    @classmethod
    def clean_iban(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            return "".join(v.split()).upper()
        return v

    @field_validator("bic", mode="before")
    @classmethod
    def clean_bic(cls, v: Optional[str]) -> Optional[str]:
        if isinstance(v, str):
            return "".join(v.split()).upper()
        return v


class UserInformationUpdateSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    first_name: Optional[str] = Field(None, description="The user's first name")
    last_name: Optional[str] = Field(None, description="The user's last name")
    date_of_birth: Optional[date] = Field(None, description="Date of birth")
    place_of_birth: Optional[str] = Field(None, description="Place of birth")
    legal_gender: Optional[GenderType] = Field(None, description="Legal gender")
    marital_status: Optional[MaritalStatusType] = Field(None, description="Marital status")
    married_since: Optional[date] = Field(None, description="Married since date")
    is_german_citizen: Optional[bool] = Field(None, description="Is German citizen")
    is_resident_in_germany: Optional[bool] = Field(None, description="Is resident in Germany")
    has_guardian: Optional[bool] = Field(None, description="Has guardian")
    has_custodian: Optional[bool] = Field(None, description="Has custodian")
    displaced_status: Optional[DisplacedStatusType] = Field(None, description="Displaced status")
    displaced_issued_on: Optional[date] = Field(None, description="Displaced status issued on")
    displaced_issued_by: Optional[str] = Field(None, description="Displaced status issued by")
    social_security_type: Optional[SocialSecurityTypeType] = Field(None, description="Social security type")
    health_insurance_provider: Optional[str] = Field(None, description="Health insurance provider")
    health_insurance_status: Optional[HealthInsuranceStatusType] = Field(None, description="Health insurance status")
    pension_insurance_provider: Optional[str] = Field(None, description="Pension insurance provider")
    pension_insurance_no: Optional[str] = Field(None, description="Pension insurance number")
    has_received_previous_benefits: Optional[bool] = Field(None, description="Has received previous benefits")
    previous_benefits_authority: Optional[str] = Field(None, description="Previous benefits authority")
    previous_benefits_period: Optional[str] = Field(None, description="Previous benefits period")
    previous_benefits_ref_no: Optional[str] = Field(None, description="Previous benefits reference number")
    has_applied_for_asylum_benefits: Optional[bool] = Field(None, description="Has applied for asylum benefits")
    is_currently_employed: Optional[bool] = Field(None, description="Is currently employed")
    ability_to_work: Optional[AbilityToWorkType] = Field(None, description="Ability to work status")
    has_permanent_reduction_in_earning_capacity: Optional[bool] = Field(
        None, description="Has permanent reduction in earning capacity"
    )
    has_inpatient_facility_accommodation: Optional[bool] = Field(
        None, description="Has inpatient facility accommodation"
    )
    gave_away_assets_last_10_years: Optional[bool] = Field(None, description="Gave away assets in the last 10 years")
    gross_negligence_last_10_years: Optional[bool] = Field(None, description="Gross negligence in the last 10 years")
    accomodation_type: Optional[AccomodationType] = Field(None, description="Accommodation type")
    tenancy_status: Optional[TenancyStatusType] = Field(None, description="Tenancy status")
    rent_total: Optional[decimal.Decimal] = Field(None, description="Total rent costs")
    hot_water_costs: Optional[decimal.Decimal] = Field(None, description="Hot water costs")
    heating_costs: Optional[decimal.Decimal] = Field(None, description="Heating costs")
    cable_tv_costs: Optional[decimal.Decimal] = Field(None, description="Cable TV costs")
    number_of_rooms: Optional[int] = Field(None, description="Number of rooms")
    living_area: Optional[decimal.Decimal] = Field(None, description="Living area in square meters")
    sublet_room_count: Optional[int] = Field(None, description="Number of rooms sublet")
    sublet_rent_income: Optional[decimal.Decimal] = Field(None, description="Rent income from subletting")
    rent_paid_until: Optional[date] = Field(None, description="Rent paid until date")
    landlord_name: Optional[str] = Field(None, description="Landlord name")
    heating_type: Optional[str] = Field(None, description="Heating system type")
    free_housing_right_holder: Optional[str] = Field(None, description="Name of housing right provider")
    is_subsidized_housing: Optional[bool] = Field(None, description="Whether the housing is publicly subsidized")
    has_other_residence: Optional[bool] = Field(None, description="Has another residence besides this one")
    has_secondary_residence: Optional[bool] = Field(None, description="Has a secondary residence")
    has_garage_costs: Optional[bool] = Field(None, description="Has garage/parking costs included in rent")
    garage_costs: Optional[decimal.Decimal] = Field(None, description="Monthly garage/parking costs")
    has_household_energy_costs: Optional[bool] = Field(None, description="Has household energy costs included in rent")
    household_energy_costs: Optional[decimal.Decimal] = Field(None, description="Monthly household energy costs")
    is_living_area_used_commercially: Optional[bool] = Field(
        None, description="Whether part of the living area is used commercially"
    )
    commercially_used_area_sqm: Optional[decimal.Decimal] = Field(
        None, description="Commercially used area in square meters"
    )
    is_student_or_trainee: Optional[bool] = Field(None, description="Is a student or trainee")
    professional_expenses: Optional[decimal.Decimal] = Field(None, description="Monthly work-related expenses")
    has_childcare_expenses: Optional[bool] = Field(None, description="Has childcare expenses")
    is_victim_of_national_socialist_persecution: Optional[bool] = Field(
        None, description="Victim of National Socialist persecution (BEG)"
    )
    is_wohngeld_first_application: Optional[bool] = Field(
        None, description="Whether this is a first Wohngeld application (false = continuation application)"
    )
    receives_wohngeld_for_other_dwelling: Optional[bool] = Field(
        None, description="Whether the user already receives Wohngeld for another dwelling"
    )
    household_member_died_recently: Optional[bool] = Field(
        None, description="Whether a household member died within the last 12 months"
    )
    household_size_will_change: Optional[bool] = Field(
        None, description="Whether the number of people in the household is about to change"
    )
    receives_other_transfer_benefits: Optional[bool] = Field(
        None, description="Whether the user receives other transfer benefits (e.g. Buergergeld, Grundsicherung)"
    )
    pays_child_or_spousal_support: Optional[bool] = Field(
        None, description="Whether the user pays child or spousal support"
    )
    receives_support_from_others: Optional[bool] = Field(
        None, description="Whether the user receives maintenance or support payments from other people"
    )
    expects_future_income_change: Optional[bool] = Field(
        None, description="Whether the user expects their income to change in the next 12 months"
    )
    assets_exceed_wohngeld_threshold: Optional[bool] = Field(
        None, description="Whether the household's assets exceed the Wohngeld threshold"
    )
    related_to_landlord: Optional[bool] = Field(
        None, description="Whether the user is related to or married to the landlord"
    )
    service_costs_included_in_rent: Optional[bool] = Field(
        None, description="Whether service charges are included in the stated rent"
    )
    rent_paid_partly_by_third_party: Optional[bool] = Field(
        None, description="Whether part of the rent is paid by a third party"
    )
    receives_rent_contribution_from_others: Optional[bool] = Field(
        None, description="Whether other people contribute to the rent"
    )
    expects_rent_change: Optional[bool] = Field(
        None, description="Whether the user expects the rent to change in the next 12 months"
    )
    wohngeld_payment_to_applicant: Optional[bool] = Field(
        None, description="Whether Wohngeld should be paid to the applicant rather than the landlord"
    )
    consents_to_bank_statement_retention: Optional[bool] = Field(
        None, description="Whether the user consents to the authority retaining bank statements"
    )
    consents_to_registry_verification: Optional[bool] = Field(
        None, description="Whether the user consents to verification against the residents' registry"
    )
    email: Optional[str] = Field(None, description="Email address")
    persons_in_household_count: Optional[int] = Field(None, description="Number of persons in household")
    bank_name: Optional[str] = Field(None, description="Bank name")
    account_holder: Optional[str] = Field(None, description="Account holder name")
    iban: Optional[str] = Field(None, description="IBAN")
    has_disability_id: Optional[bool] = Field(None, description="Has disability ID")
    disability_valid_until: Optional[date] = Field(None, description="Disability ID valid until")
    merkzeichen: Optional[DisabilityMerkzeichenType] = Field(None, description="Disability Merkzeichen (mark)")
    disability_application_pending: Optional[bool] = Field(None, description="Disability application pending")
    monthly_income: Optional[decimal.Decimal] = Field(None, ge=0, description="The user's monthly net income")
    has_assets: Optional[bool] = Field(None, description="Whether the user possesses assets, real estate, or valuables")
    assets_description: Optional[str] = Field(None, max_length=1000, description="A description of the user's assets")
    income_sources: Optional[list[str]] = Field(None, description="List of the user's monthly income source categories")
    assets_types: Optional[list[str]] = Field(None, description="List of the user's asset types")
    associated_persons: Optional[list[AssociatedPersonSchema]] = Field(
        None,
        description=(
            "Everyone besides the applicant who bears on the application: household "
            "members, plus a spouse or partner even if they live elsewhere. Replaces the "
            "whole list on write, so send every person, not just the new one."
        ),
    )
    has_costly_medical_nutrition: Optional[bool] = Field(
        None, description="Whether the user requires a costly medical nutrition diet"
    )
    is_care_dependent: Optional[bool] = Field(None, description="Whether the user is care dependent")
    inpatient_facility_move_in_date: Optional[date] = Field(None, description="Move in date to inpatient facility")
    inpatient_facility_last_residence: Optional[str] = Field(None, description="Last primary residence address")
    reduced_work_capacity_start_date: Optional[date] = Field(None, description="Start date of reduced work capacity")
    reduced_work_capacity_end_date: Optional[date] = Field(None, description="End date of reduced work capacity")
    reduced_work_capacity_reason: Optional[str] = Field(None, description="Reason of reduced work capacity")
    bic: Optional[str] = Field(
        None, pattern=r"^[a-zA-Z]{6}[a-zA-Z0-9]{2}([a-zA-Z0-9]{3})?$", description="Bank Identifier Code (BIC)"
    )
    has_applied_for_benefits_awaiting_decision: Optional[bool] = Field(
        None, description="Whether the user has applied for benefits and is awaiting decision"
    )
    benefits_awaiting_decision_type: Optional[str] = Field(
        None, description="Type of social benefits awaiting decision"
    )
    benefits_awaiting_decision_application_date: Optional[date] = Field(
        None, description="Application date for benefits awaiting decision"
    )
    benefits_awaiting_decision_office: Optional[str] = Field(
        None, description="Office deciding on pending benefits application"
    )
    benefits_awaiting_decision_reference: Optional[str] = Field(
        None, description="Reference number of pending benefits application"
    )
    are_one_time_payments_expected: Optional[bool] = Field(
        None, description="Whether any significant one-time payments are expected"
    )
    one_time_payments_expected_type: Optional[str] = Field(None, description="Type of expected one-time payment")
    one_time_payments_expected_amount: Optional[decimal.Decimal] = Field(
        None, ge=0, description="Expected amount of one-time payment"
    )
    one_time_payments_expected_date: Optional[date] = Field(None, description="Expected date of one-time payment")
    phone_number: Optional[str] = Field(None, description="Phone number")
    street: Optional[str] = Field(None, description="Street name")
    house_number: Optional[str] = Field(None, description="House number")
    zip_code: Optional[str] = Field(None, description="Postal code (PLZ)")
    city: Optional[str] = Field(None, description="City")
    state: Optional[str] = Field(None, description="State or federal state")
    license_plate: Optional[str] = Field(None, max_length=20, description="Vehicle license plate")


class ChatMessageResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    message_role: str
    content: Optional[str] = None
    message_metadata: Optional[Dict[str, Any]] = None


class ConversationResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    status: str


class ConversationDetailResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    status: str
    messages: list[ChatMessageResponseSchema]


class TutorialStepContent(BaseModel):
    title: str
    text: str


class TutorialStep(BaseModel):
    step_id: str
    image: Optional[str] = None
    content: Dict[str, TutorialStepContent]


class TutorialProgressResponse(BaseModel):
    status: str
    current_step: Optional[str] = None


class TutorialResponseSchema(BaseModel):
    id: uuid.UUID
    slug: str
    title: Dict[str, str]
    subtitle: Dict[str, str] = Field(default_factory=dict)
    progress: TutorialProgressResponse
    steps: list[TutorialStep] = Field(..., alias="content", validation_alias="content", serialization_alias="steps")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TutorialProgressUpdatePayload(BaseModel):
    tutorial_id: uuid.UUID
    status: TutorialStatusType
    current_step: Optional[str] = None
