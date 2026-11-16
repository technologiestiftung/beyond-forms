from typing import Optional, List

from pydantic import model_validator, BaseModel

from app.domain.field_types import NonEmptyString, PastDate, PositiveInteger, CareDependencyLevel, PostalAddress
from app.domain.global_enums import (
    CoercedGender,
    CoercedCountry,
    CountryCode,
    HealthInsuranceStatus,
    SocialSecurityStatus,
    MaritalStatus,
    HouseholdMember,
    AccommodationType,
    IncomeType,
    AssetType,
)
from app.domain.registry import register_form


@register_form("user_information")
class UserInformation(BaseModel):
    first_name: NonEmptyString
    last_name: NonEmptyString
    middle_name: Optional[str] = None
    birth_date: PastDate
    gender: CoercedGender
    nationality: CoercedCountry
    city_of_birth: NonEmptyString
    country_of_birth: CoercedCountry


@register_form("parking_permit")
class ParkingPermitForm(BaseModel):
    vehicle_license_plate: str
    permit_zone: str


@register_form("basic_income")
class BasicIncomeForm(BaseModel):
    is_currently_employed: bool
    current_income: Optional[float]

    @model_validator(mode="after")
    def validate_income_field(self) -> "BasicIncomeForm":
        if self.is_currently_employed and not self.current_income:
            raise ValueError("User is currently employed but no income given.")
        return self


@register_form("insurance_details")
class InsuranceDetails(BaseModel):
    health_insurance_status: HealthInsuranceStatus
    health_insurance_provider: NonEmptyString
    pension_insurance_provider: NonEmptyString
    pension_insurance_number: NonEmptyString
    social_security_status: SocialSecurityStatus


@register_form("financial_profile")
class FinancialProfile(BaseModel):
    non_self_employed_income: float
    health_insurance_benefits: float
    commercial_operation_income: float
    pension_income: float
    social_benefits_income: float
    alimony_income: float

    savings_amount: float
    securities_amount: float

    @model_validator(mode="after")
    def ensure_at_least_one_income_source_if_required(self) -> "FinancialProfile":
        # Example logic: if this profile belongs to a primary applicant,
        # maybe we require at least one field to be non-None.
        return self


@register_form("accommodation_details")
class AccommodationDetails(BaseModel):
    accommodation_type: NonEmptyString
    is_main_tenant: bool

    total_monthly_rent: float
    heating_cost_advance: float

    living_area_square_meters: PositiveInteger
    number_of_rooms: PositiveInteger
    has_central_heating: bool

    # ToDo: landlord name needed in specific format?
    landlord_name: NonEmptyString
    landlord_address: PostalAddress

    @model_validator(mode="after")
    def ensure_landlord_info_if_tenant(self) -> "AccommodationDetails":
        if self.is_main_tenant and not self.landlord_name:
            raise ValueError("Landlord name is required for main tenants.")
        return self


@register_form("elderly_disabled_welfare")
class ElderlyDisabledWelfareForm(BaseModel):
    applicant_identity: UserInformation
    applicant_insurance: InsuranceDetails
    applicant_finances: FinancialProfile

    partner: Optional[UserInformation] = None
    partner_finances: Optional[FinancialProfile] = None

    accommodation: AccommodationDetails
    other_household_members: Optional[List[UserInformation]] = None

    # Specific Benefit History Logic
    has_received_benefits_before: bool
    previous_benefits_end_date: Optional[PastDate] = None
    previous_benefits_authority: Optional[str] = None

    # Medical/Special Needs
    care_dependency_level: Optional[CareDependencyLevel] = None
    has_costly_medical_nutrition: bool = None

    @model_validator(mode="after")
    def validate_benefit_history(self) -> "ElderlyDisabledWelfareForm":
        if self.has_received_benefits_before and not self.previous_benefits_end_date:
            raise ValueError("Previous benefit end date is required if benefits were received before.")
        return self

    @model_validator(mode="after")
    def validate_partner_consistency(self) -> "ElderlyDisabledWelfareForm":
        if self.partner and not self.partner_finances:
            raise ValueError("Financial information is required if a partner is listed.")
        return self


# --- Sub-Models ---
@register_form("eligibility_information")
class EligibilityInformation(BaseModel):
    applicant_primary_residence_country: CountryCode
    applicant_age: int
    applicant_work_capacity_at_least_3h_daily: bool


@register_form("family_and_household_information")
class FamilyAndHouseholdInformation(BaseModel):
    applicant_marital_status: MaritalStatus
    does_applicant_live_with_other_people: bool
    people_living_in_household_with_applicant: set[HouseholdMember]
    applicant_accommodation_type: AccommodationType


@register_form("monetary_information")
class MonetaryInformation(BaseModel):
    applicant_monthly_income_type: set[IncomeType]
    does_applicant_have_any_savings_properties_or_items_of_high_value: bool
    applicant_assets_type: set[AssetType]

    @model_validator(mode="after")
    def validate_declared_assets(self) -> "MonetaryInformation":
        if (
            self.does_applicant_have_any_savings_properties_or_items_of_high_value
            and len(self.applicant_assets_type) == 0
        ):
            raise AssertionError("Applicant declared to have savings but did not specify any assets.")
        return self


@register_form("health_extra_needs")
class HealthExtraNeeds(BaseModel):
    does_applicant_have_pass_for_severely_disabled: bool
    does_applicant_have_costly_nutrition_for_medical_reasons: bool


@register_form("document_attachments")
class DocumentAttachments(BaseModel):
    personal_id: bool
    income_statements: Optional[bool] = None


@register_form("test_welfare_form")
class TestWelfareFormSchema(BaseModel):
    eligibility_information: EligibilityInformation
    family_and_household_information: FamilyAndHouseholdInformation
    monetary_information: MonetaryInformation
    health_extra_needs: HealthExtraNeeds
