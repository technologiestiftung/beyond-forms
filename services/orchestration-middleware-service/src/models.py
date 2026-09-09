from typing import Optional
import datetime
import decimal
import enum
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AbilityToWorkType(str, enum.Enum):
    FULLY_ABLE = "Fully able"
    TEMPORARILY_DISABLED = "Temporarily disabled"
    PERMANENTLY_DISABLED = "Permanently disabled"


class AccomodationType(str, enum.Enum):
    RENTAL_APARTMENT = "Rental Apartment"
    OWN_HOME = "Own Home"
    CONDOMINIUM = "Condominium"
    RELATIVE = "Relative"
    SHARED_HOUSEHOLD = "Shared Household"


class AssociationType(str, enum.Enum):
    SPOUSE = "Spouse"
    REGISTERED_PARTNER = "Registered Partner"
    COHABITING_PARTNER = "Cohabiting Partner"
    CHILD = "Child"
    PARENT = "Parent"
    OTHER_RELATIVE = "Other Relative"
    OTHER = "Other"


class AssetTypeType(str, enum.Enum):
    SAVINGS_AND_CASH = "Savings and Cash"
    SECURITIES = "Securities"
    VALUABLES = "Valuables"
    GIFTED_ASSETS = "Gifted Assets"
    MOTOR_VEHICLE = "Motor Vehicle"
    REAL_ESTATE = "Real Estate"
    SUBSIDISED_PRIVATE_PENSION = "Subsidised Private Pension"
    TRANSFER_CONTRACT_CLAIMS = "Transfer Contract Claims"
    OTHER_ASSETS = "Other Assets"


class BenefitClaimKindType(str, enum.Enum):
    PENDING_APPLICATION = "Pending Application"
    EXPECTED_ONE_TIME_PAYMENT = "Expected One-Time Payment"


class CareLevelType(str, enum.Enum):
    PFLEGEGRAD_1 = "Pflegegrad 1"
    PFLEGEGRAD_2 = "Pflegegrad 2"
    PFLEGEGRAD_3 = "Pflegegrad 3"
    PFLEGEGRAD_4 = "Pflegegrad 4"
    PFLEGEGRAD_5 = "Pflegegrad 5"


class ChatMessageRoleType(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class ConversationStatusType(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"


class DisabilityMerkzeichenType(str, enum.Enum):
    G = "G"
    AG = "aG"
    H = "H"
    B = "B"
    BL = "Bl"
    GL = "Gl"
    TBL = "TBl"
    RF = "RF"
    _1_KL = "1 Kl"
    EB = "EB"
    VB = "VB"
    T = "T"


class DisplacedStatusType(str, enum.Enum):
    EXPELLEE__RESETTLER_ = "Expellee (Resettler)"
    DISPLACED_PERSON__RESETTLER_ = "Displaced Person (Resettler)"
    LATE_RESETTLER = "Late Resettler"
    SPOUSE_OR_DESCENDANT_OF_A_LATE_RESETTLER = "Spouse or Descendant of a Late Resettler"
    SOVIET_ZONE_REFUGEE = "Soviet Zone Refugee"


class DocumentStatusType(str, enum.Enum):
    PROCESSING = "processing"
    READY_FOR_REVIEW = "ready_for_review"
    COMPLETED = "completed"
    FAILED = "failed"
    VERIFIED = "verified"


class ExpenseTypeType(str, enum.Enum):
    INCOME_TAX = "Income Tax"
    HEALTH_INSURANCE = "Health Insurance"
    CARE_INSURANCE = "Care Insurance"
    UNEMPLOYMENT_INSURANCE = "Unemployment Insurance"
    PENSION_INSURANCE = "Pension Insurance"
    CHURCH_TAX = "Church Tax"
    ACCIDENT_INSURANCE = "Accident Insurance"
    RETIREMENT_PROVISION = "Retirement Provision"
    HOUSEHOLD_CONTENTS_INSURANCE = "Household Contents Insurance"
    FUNERAL_INSURANCE = "Funeral Insurance"
    LIFE_INSURANCE = "Life Insurance"
    LIABILITY_INSURANCE = "Liability Insurance"
    WORK_EQUIPMENT = "Work Equipment"
    PROFESSIONAL_ASSOCIATION_FEES = "Professional Association Fees"
    DOUBLE_HOUSEHOLD = "Double Household"
    COMMUTE_PUBLIC_TRANSPORT = "Commute Public Transport"
    COMMUTE_CAR = "Commute Car"
    COMMUTE_SMALL_CAR = "Commute Small Car"
    COMMUTE_MOTORCYCLE = "Commute Motorcycle"
    COMMUTE_MOPED = "Commute Moped"
    COMMUTE_OTHER = "Commute Other"


class GenderType(str, enum.Enum):
    MALE = "Male"
    FEMALE = "Female"
    DIVERSE = "Diverse"


class HealthInsuranceStatusType(str, enum.Enum):
    COMPULSORY_INSURANCE = "Compulsory Insurance"
    VOLUNTARY_INSURANCE = "Voluntary Insurance"
    FAMILY_INSURANCE = "Family Insurance"
    PRIVATE_INSURANCE = "Private Insurance"
    CARE_BY_HEALTH_FUNDS_UNDER___264_SGB_V = "Care by Health Funds under § 264 SGB V"


class IncomeTypeType(str, enum.Enum):
    EMPLOYMENT = "Employment"
    HEALTH_INSURANCE_BENEFITS = "Health Insurance Benefits"
    BUSINESS = "Business"
    AGRICULTURE_AND_FORESTRY = "Agriculture and Forestry"
    OTHER_SELF_EMPLOYMENT = "Other Self-Employment"
    RENTAL_AND_LEASING = "Rental and Leasing"
    HOUSING_BENEFIT = "Housing Benefit"
    PENSION = "Pension"
    SOCIAL_ASSISTANCE = "Social Assistance"
    BASIC_SECURITY_BENEFITS = "Basic Security Benefits"
    ASYLUM_SEEKER_BENEFITS = "Asylum Seeker Benefits"
    FEDERAL_WAR_VICTIMS_RELIEF = "Federal War Victims Relief"
    EQUALISATION_OF_BURDENS = "Equalisation of Burdens"
    EMPLOYMENT_AGENCY_BENEFITS = "Employment Agency Benefits"
    CHILD_BENEFIT = "Child Benefit"
    CHILD_BENEFIT_SUPPLEMENT = "Child Benefit Supplement"
    PARENTAL_ALLOWANCE = "Parental Allowance"
    EDUCATION_GRANT = "Education Grant"
    ALIMONY = "Alimony"
    ALIMONY_ADVANCE = "Alimony Advance"
    PRIVATE_MONETARY_CLAIMS = "Private Monetary Claims"
    TAX_REFUND = "Tax Refund"
    CAPITAL_INCOME = "Capital Income"
    OTHER_INCOME = "Other Income"


INCOME_TYPE_DE = {
    IncomeTypeType.EMPLOYMENT: "Nichtselbstständige Tätigkeit",
    IncomeTypeType.HEALTH_INSURANCE_BENEFITS: "Leistungen der Krankenkasse",
    IncomeTypeType.BUSINESS: "Gewerbebetrieb",
    IncomeTypeType.AGRICULTURE_AND_FORESTRY: "Land- und Forstwirtschaft",
    IncomeTypeType.OTHER_SELF_EMPLOYMENT: "Sonstige selbstständige Tätigkeit",
    IncomeTypeType.RENTAL_AND_LEASING: "Vermietung und Verpachtung",
    IncomeTypeType.HOUSING_BENEFIT: "Wohngeld/Lastenzuschuss",
    IncomeTypeType.PENSION: "Rente/Pension",
    IncomeTypeType.SOCIAL_ASSISTANCE: "Sozialhilfeleistungen",
    IncomeTypeType.BASIC_SECURITY_BENEFITS: "Grundsicherungsleistungen",
    IncomeTypeType.ASYLUM_SEEKER_BENEFITS: "Asylbewerberleistungen",
    IncomeTypeType.FEDERAL_WAR_VICTIMS_RELIEF: "Leistungen nach dem Bundesversorgungsgesetz",
    IncomeTypeType.EQUALISATION_OF_BURDENS: "Leistungen des Lastenausgleichsamtes",
    IncomeTypeType.EMPLOYMENT_AGENCY_BENEFITS: "Leistungen der Agentur für Arbeit",
    IncomeTypeType.CHILD_BENEFIT: "Kindergeld",
    IncomeTypeType.CHILD_BENEFIT_SUPPLEMENT: "Kinderzuschlag",
    IncomeTypeType.PARENTAL_ALLOWANCE: "Elterngeld",
    IncomeTypeType.EDUCATION_GRANT: "Ausbildungsförderung",
    IncomeTypeType.ALIMONY: "Unterhalt",
    IncomeTypeType.ALIMONY_ADVANCE: "Unterhaltsvorschuss",
    IncomeTypeType.PRIVATE_MONETARY_CLAIMS: "Privatrechtliche geldwerte Ansprüche",
    IncomeTypeType.TAX_REFUND: "Steuererstattung",
    IncomeTypeType.CAPITAL_INCOME: "Kapitalerträge",
    IncomeTypeType.OTHER_INCOME: "Sonstige Einkünfte",
}


class MaritalStatusType(str, enum.Enum):
    SINGLE = "Single"
    MARRIED = "Married"
    COHABITING = "Cohabiting"
    PERMANENTLY_SEPARATED = "Permanently Separated"
    REGISTERED_CIVIL_PARTNERSHIP = "Registered Civil Partnership"
    DIVORCED = "Divorced"
    WIDOWED = "Widowed"


# German labels for enums that forms print as free text rather than a checkbox row.
MARITAL_STATUS_DE = {
    MaritalStatusType.SINGLE: "ledig",
    MaritalStatusType.MARRIED: "verheiratet",
    MaritalStatusType.COHABITING: "in eheähnlicher Gemeinschaft",
    MaritalStatusType.PERMANENTLY_SEPARATED: "dauernd getrennt lebend",
    MaritalStatusType.REGISTERED_CIVIL_PARTNERSHIP: "eingetragene Lebenspartnerschaft",
    MaritalStatusType.DIVORCED: "geschieden",
    MaritalStatusType.WIDOWED: "verwitwet",
}

# Only the codes the personas and forms have actually needed; anything else falls back to
# the raw ISO code rather than a guessed adjective.
NATIONALITY_DE = {
    "DE": "deutsch",
    "AT": "österreichisch",
    "CH": "schweizerisch",
    "FR": "französisch",
    "IT": "italienisch",
    "PL": "polnisch",
    "TR": "türkisch",
}


class SocialSecurityTypeType(str, enum.Enum):
    NONE = "None"
    PENSION_INSURANCE = "Pension Insurance"
    LONG_TERM_CARE_INSURANCE = "Long-term Care Insurance"


class StatusType(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SUBMITTED = "submitted"


class TenancyStatusType(str, enum.Enum):
    MAIN_TENANT = "Main Tenant"
    SUBTENANT = "Subtenant"


class TutorialStatusType(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class CmsTutorials(Base):
    __tablename__ = "cms_tutorials"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="cms_tutorials_pkey"),
        UniqueConstraint("slug", name="cms_tutorials_slug_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    title: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    subtitle: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))

    user_tutorial_states: Mapped[list["UserTutorialStates"]] = relationship(
        "UserTutorialStates", back_populates="tutorial"
    )


class Migrations(Base):
    __tablename__ = "migrations"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="migrations_pkey"),
        UniqueConstraint("filename", name="migrations_filename_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    applied_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class BerlinAddress(Base):
    __tablename__ = "berlin_addresses"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="berlin_addresses_pkey"),
        Index("idx_berlin_addresses_lookup", "plz", "street", "hnr"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plz: Mapped[str] = mapped_column(String(10), nullable=False)
    street: Mapped[str] = mapped_column(String(255), nullable=False)
    hnr: Mapped[str] = mapped_column(String(20), nullable=False)
    bez_name: Mapped[str] = mapped_column(String(255), nullable=False)


class UploadedFiles(Base):
    __tablename__ = "uploaded_files"
    __table_args__ = (PrimaryKeyConstraint("id", name="uploaded_files_pkey"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    object_name: Mapped[str] = mapped_column(String(1024), nullable=False)
    bucket_name: Mapped[str] = mapped_column(String(1024), nullable=False)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))

    user_documents: Mapped[list["UserDocuments"]] = relationship("UserDocuments", back_populates="fk_file")


class Users(Base):
    __tablename__ = "users"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="users_pkey"),
        UniqueConstraint("authentik_id", name="users_authentik_id_key"),
        UniqueConstraint("phone_number", name="users_phone_number_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("now()"))
    first_name: Mapped[Optional[str]] = mapped_column(String(255))
    last_name: Mapped[Optional[str]] = mapped_column(String(255))
    date_of_birth: Mapped[Optional[datetime.date]] = mapped_column(Date)
    place_of_birth: Mapped[Optional[str]] = mapped_column(String(255))
    legal_gender: Mapped[Optional[GenderType]] = mapped_column(
        Enum(GenderType, values_callable=lambda cls: [member.value for member in cls], name="gender_type")
    )
    marital_status: Mapped[Optional[MaritalStatusType]] = mapped_column(
        Enum(
            MaritalStatusType, values_callable=lambda cls: [member.value for member in cls], name="marital_status_type"
        )
    )
    married_since: Mapped[Optional[datetime.date]] = mapped_column(Date)
    is_german_citizen: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_resident_in_germany: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_guardian: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_custodian: Mapped[Optional[bool]] = mapped_column(Boolean)
    displaced_status: Mapped[Optional[DisplacedStatusType]] = mapped_column(
        Enum(
            DisplacedStatusType,
            values_callable=lambda cls: [member.value for member in cls],
            name="displaced_status_type",
        )
    )
    displaced_issued_on: Mapped[Optional[datetime.date]] = mapped_column(Date)
    displaced_issued_by: Mapped[Optional[str]] = mapped_column(String(255))
    social_security_type: Mapped[Optional[SocialSecurityTypeType]] = mapped_column(
        Enum(
            SocialSecurityTypeType,
            values_callable=lambda cls: [member.value for member in cls],
            name="social_security_type_type",
        )
    )
    health_insurance_provider: Mapped[Optional[str]] = mapped_column(String(255))
    health_insurance_status: Mapped[Optional[HealthInsuranceStatusType]] = mapped_column(
        Enum(
            HealthInsuranceStatusType,
            values_callable=lambda cls: [member.value for member in cls],
            name="health_insurance_status_type",
        )
    )
    pension_insurance_provider: Mapped[Optional[str]] = mapped_column(String(255))
    pension_insurance_no: Mapped[Optional[str]] = mapped_column(String(255))
    has_received_previous_benefits: Mapped[Optional[bool]] = mapped_column(Boolean)
    previous_benefits_authority: Mapped[Optional[str]] = mapped_column(String(255))
    previous_benefits_period: Mapped[Optional[str]] = mapped_column(String(255))
    previous_benefits_ref_no: Mapped[Optional[str]] = mapped_column(String(255))
    has_applied_for_asylum_benefits: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_currently_employed: Mapped[Optional[bool]] = mapped_column(Boolean)
    ability_to_work: Mapped[Optional[AbilityToWorkType]] = mapped_column(
        Enum(
            AbilityToWorkType, values_callable=lambda cls: [member.value for member in cls], name="ability_to_work_type"
        )
    )
    has_permanent_reduction_in_earning_capacity: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_inpatient_facility_accommodation: Mapped[Optional[bool]] = mapped_column(Boolean)
    gave_away_assets_last_10_years: Mapped[Optional[bool]] = mapped_column(Boolean)
    gross_negligence_last_10_years: Mapped[Optional[bool]] = mapped_column(Boolean)
    accomodation_type: Mapped[Optional[AccomodationType]] = mapped_column(
        Enum(AccomodationType, values_callable=lambda cls: [member.value for member in cls], name="accomodation_type")
    )
    tenancy_status: Mapped[Optional[TenancyStatusType]] = mapped_column(
        Enum(
            TenancyStatusType, values_callable=lambda cls: [member.value for member in cls], name="tenancy_status_type"
        )
    )
    rent_total: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    hot_water_costs: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    heating_costs: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    cable_tv_costs: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    number_of_rooms: Mapped[Optional[int]] = mapped_column(Integer)
    living_area: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    sublet_room_count: Mapped[Optional[int]] = mapped_column(Integer)
    sublet_rent_income: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    rent_paid_until: Mapped[Optional[datetime.date]] = mapped_column(Date)
    landlord_name: Mapped[Optional[str]] = mapped_column(String(255))
    landlord_address: Mapped[Optional[str]] = mapped_column(String(255))
    main_tenant_name: Mapped[Optional[str]] = mapped_column(String(255))
    heating_type: Mapped[Optional[str]] = mapped_column(String(255))
    free_housing_right_holder: Mapped[Optional[str]] = mapped_column(String(255))
    persons_in_household_count: Mapped[Optional[int]] = mapped_column(Integer)
    bank_name: Mapped[Optional[str]] = mapped_column(String(255))
    account_holder: Mapped[Optional[str]] = mapped_column(String(255))
    iban: Mapped[Optional[str]] = mapped_column(String(50))
    has_disability_id: Mapped[Optional[bool]] = mapped_column(Boolean)
    disability_valid_until: Mapped[Optional[datetime.date]] = mapped_column(Date)
    merkzeichen: Mapped[Optional[DisabilityMerkzeichenType]] = mapped_column(
        Enum(
            DisabilityMerkzeichenType,
            values_callable=lambda cls: [member.value for member in cls],
            name="disability_merkzeichen_type",
        )
    )
    disability_application_pending: Mapped[Optional[bool]] = mapped_column(Boolean)
    monthly_income: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    has_assets: Mapped[Optional[bool]] = mapped_column(Boolean)
    assets_description: Mapped[Optional[str]] = mapped_column(Text)
    has_costly_medical_nutrition: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_care_dependent: Mapped[Optional[bool]] = mapped_column(Boolean)
    inpatient_facility_move_in_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    inpatient_facility_last_residence: Mapped[Optional[str]] = mapped_column(String(255))
    reduced_work_capacity_start_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    reduced_work_capacity_end_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    reduced_work_capacity_reason: Mapped[Optional[str]] = mapped_column(Text)
    phone_number: Mapped[Optional[str]] = mapped_column(String(32))
    nationality: Mapped[Optional[str]] = mapped_column(String(255))
    second_nationality: Mapped[Optional[str]] = mapped_column(String(255))
    authentik_id: Mapped[Optional[str]] = mapped_column(String(255))
    fcm_token: Mapped[Optional[str]] = mapped_column(String(512))
    street: Mapped[Optional[str]] = mapped_column(String(255))
    house_number: Mapped[Optional[str]] = mapped_column(String(20))
    zip_code: Mapped[Optional[str]] = mapped_column(String(10))
    city: Mapped[Optional[str]] = mapped_column(String(255))
    state: Mapped[Optional[str]] = mapped_column(String(255))
    district: Mapped[Optional[str]] = mapped_column(String(255))
    birth_name: Mapped[Optional[str]] = mapped_column(String(255))
    residence_status: Mapped[Optional[str]] = mapped_column(String(255))
    identification_numbers: Mapped[Optional[str]] = mapped_column(String(255))
    tax_id: Mapped[Optional[str]] = mapped_column(String(255))
    license_plate: Mapped[Optional[str]] = mapped_column(String(20))
    vehicle_make: Mapped[Optional[str]] = mapped_column(String(255))
    vehicle_year: Mapped[Optional[str]] = mapped_column(String(4))
    bic: Mapped[Optional[str]] = mapped_column(String(11))
    has_applied_for_benefits_awaiting_decision: Mapped[Optional[bool]] = mapped_column(Boolean)
    benefits_awaiting_decision_type: Mapped[Optional[str]] = mapped_column(String(255))
    benefits_awaiting_decision_application_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    benefits_awaiting_decision_office: Mapped[Optional[str]] = mapped_column(String(255))
    benefits_awaiting_decision_reference: Mapped[Optional[str]] = mapped_column(String(255))
    are_one_time_payments_expected: Mapped[Optional[bool]] = mapped_column(Boolean)
    one_time_payments_expected_type: Mapped[Optional[str]] = mapped_column(String(255))
    one_time_payments_expected_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    one_time_payments_expected_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    is_student_or_trainee: Mapped[Optional[bool]] = mapped_column(Boolean)
    professional_expenses: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    has_childcare_expenses: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_subsidized_housing: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_other_residence: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_secondary_residence: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_garage_costs: Mapped[Optional[bool]] = mapped_column(Boolean)
    garage_costs: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    has_household_energy_costs: Mapped[Optional[bool]] = mapped_column(Boolean)
    household_energy_costs: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    is_living_area_used_commercially: Mapped[Optional[bool]] = mapped_column(Boolean)
    commercially_used_area_sqm: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    is_victim_of_national_socialist_persecution: Mapped[Optional[bool]] = mapped_column(Boolean)
    apartment_floor_location: Mapped[Optional[str]] = mapped_column(String(255))
    resident_in_berlin_since: Mapped[Optional[datetime.date]] = mapped_column(Date)
    resident_in_district_since: Mapped[Optional[datetime.date]] = mapped_column(Date)
    previous_address: Mapped[Optional[str]] = mapped_column(String(255))
    rent_arrears_period: Mapped[Optional[str]] = mapped_column(String(255))
    rent_arrears_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    tenancy_terminated_on: Mapped[Optional[datetime.date]] = mapped_column(Date)
    sublet_unrentable_reason: Mapped[Optional[str]] = mapped_column(String(255))
    inpatient_facility_assigned_until: Mapped[Optional[datetime.date]] = mapped_column(Date)
    care_level: Mapped[Optional[CareLevelType]] = mapped_column(
        Enum(CareLevelType, values_callable=lambda cls: [member.value for member in cls], name="care_level_type")
    )
    can_work_at_least_3h_daily: Mapped[Optional[bool]] = mapped_column(Boolean)
    work_scope_and_type: Mapped[Optional[str]] = mapped_column(String(255))
    employer_name: Mapped[Optional[str]] = mapped_column(String(255))
    education_or_study_subject: Mapped[Optional[str]] = mapped_column(String(255))
    employment_office_customer_number: Mapped[Optional[str]] = mapped_column(String(255))
    commute_distance_km: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    has_child_with_substantial_income: Mapped[Optional[bool]] = mapped_column(Boolean)
    have_parents_substantial_joint_income: Mapped[Optional[bool]] = mapped_column(Boolean)
    monthly_expenses_total: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))

    # Wohngeld and Bewohnerparkausweis yes/no questions. Nullable: NULL means not asked.
    is_wohngeld_first_application: Mapped[Optional[bool]] = mapped_column(Boolean)
    receives_wohngeld_for_other_dwelling: Mapped[Optional[bool]] = mapped_column(Boolean)
    household_member_died_recently: Mapped[Optional[bool]] = mapped_column(Boolean)
    household_size_will_change: Mapped[Optional[bool]] = mapped_column(Boolean)
    receives_other_transfer_benefits: Mapped[Optional[bool]] = mapped_column(Boolean)
    pays_child_or_spousal_support: Mapped[Optional[bool]] = mapped_column(Boolean)
    receives_support_from_others: Mapped[Optional[bool]] = mapped_column(Boolean)
    expects_future_income_change: Mapped[Optional[bool]] = mapped_column(Boolean)
    assets_exceed_wohngeld_threshold: Mapped[Optional[bool]] = mapped_column(Boolean)
    related_to_landlord: Mapped[Optional[bool]] = mapped_column(Boolean)
    service_costs_included_in_rent: Mapped[Optional[bool]] = mapped_column(Boolean)
    rent_paid_partly_by_third_party: Mapped[Optional[bool]] = mapped_column(Boolean)
    receives_rent_contribution_from_others: Mapped[Optional[bool]] = mapped_column(Boolean)
    expects_rent_change: Mapped[Optional[bool]] = mapped_column(Boolean)
    wohngeld_payment_to_applicant: Mapped[Optional[bool]] = mapped_column(Boolean)
    consents_to_bank_statement_retention: Mapped[Optional[bool]] = mapped_column(Boolean)
    consents_to_registry_verification: Mapped[Optional[bool]] = mapped_column(Boolean)

    conversations: Mapped[list["Conversations"]] = relationship(
        "Conversations", back_populates="fk_user", cascade="all, delete-orphan"
    )
    user_applications: Mapped[list["UserApplications"]] = relationship(
        "UserApplications", back_populates="fk_user", cascade="all, delete-orphan"
    )
    user_tutorial_states: Mapped[list["UserTutorialStates"]] = relationship(
        "UserTutorialStates", back_populates="user", cascade="all, delete-orphan"
    )
    user_documents: Mapped[list["UserDocuments"]] = relationship(
        "UserDocuments", back_populates="fk_user", cascade="all, delete-orphan"
    )
    associated_persons: Mapped[list["AssociatedPersons"]] = relationship(
        "AssociatedPersons",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="AssociatedPersons.sort_order",
    )
    income_entries: Mapped[list["IncomeEntries"]] = relationship(
        "IncomeEntries", back_populates="user", cascade="all, delete-orphan"
    )
    expense_entries: Mapped[list["ExpenseEntries"]] = relationship(
        "ExpenseEntries", back_populates="user", cascade="all, delete-orphan"
    )
    asset_entries: Mapped[list["AssetEntries"]] = relationship(
        "AssetEntries", back_populates="user", cascade="all, delete-orphan"
    )
    benefit_claim_entries: Mapped[list["BenefitClaimEntries"]] = relationship(
        "BenefitClaimEntries",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="BenefitClaimEntries.sort_order",
    )


class AssociatedPersons(Base):
    """A separated spouse matters to several forms without being a household member,
    hence `association_type` and `lives_in_household` being independent."""

    __tablename__ = "associated_persons"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="associated_persons_user_id_fkey"),
        PrimaryKeyConstraint("id", name="associated_persons_pkey"),
        Index("associated_persons_user_id_idx", "user_id", "sort_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    association_type: Mapped[AssociationType] = mapped_column(
        Enum(AssociationType, values_callable=lambda cls: [member.value for member in cls], name="association_type"),
        nullable=False,
    )
    lives_in_household: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    # Forms have fixed person slots (Person 1..8), so the order must be stable.
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    first_name: Mapped[Optional[str]] = mapped_column(String(255))
    last_name: Mapped[Optional[str]] = mapped_column(String(255))
    birth_name: Mapped[Optional[str]] = mapped_column(String(255))
    date_of_birth: Mapped[Optional[datetime.date]] = mapped_column(Date)
    place_of_birth: Mapped[Optional[str]] = mapped_column(String(255))
    legal_gender: Mapped[Optional[GenderType]] = mapped_column(
        Enum(GenderType, values_callable=lambda cls: [member.value for member in cls], name="gender_type")
    )
    marital_status: Mapped[Optional[MaritalStatusType]] = mapped_column(
        Enum(
            MaritalStatusType, values_callable=lambda cls: [member.value for member in cls], name="marital_status_type"
        )
    )
    nationality: Mapped[Optional[str]] = mapped_column(String(2))
    second_nationality: Mapped[Optional[str]] = mapped_column(String(2))
    # Printed verbatim on the forms; no enum to map onto.
    relationship_to_applicant: Mapped[Optional[str]] = mapped_column(String(255))
    employment_status: Mapped[Optional[str]] = mapped_column(String(255))
    monthly_income: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    monthly_pension_income: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    has_own_income: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_alimony_obligated: Mapped[Optional[bool]] = mapped_column(Boolean)
    is_german_citizen: Mapped[Optional[bool]] = mapped_column(Boolean)
    id_document_issuing_authority: Mapped[Optional[str]] = mapped_column(String(255))
    id_document_valid_until: Mapped[Optional[datetime.date]] = mapped_column(Date)
    has_guardian: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_custodian: Mapped[Optional[bool]] = mapped_column(Boolean)
    displaced_status: Mapped[Optional[DisplacedStatusType]] = mapped_column(
        Enum(DisplacedStatusType, values_callable=lambda cls: [member.value for member in cls], name="displaced_status_type")
    )
    displaced_issued_on: Mapped[Optional[datetime.date]] = mapped_column(Date)
    displaced_issued_by: Mapped[Optional[str]] = mapped_column(String(255))
    has_received_previous_benefits: Mapped[Optional[bool]] = mapped_column(Boolean)
    previous_benefits_authority: Mapped[Optional[str]] = mapped_column(String(255))
    previous_benefits_period: Mapped[Optional[str]] = mapped_column(String(255))
    previous_benefits_ref_no: Mapped[Optional[str]] = mapped_column(String(255))
    has_disability_id: Mapped[Optional[bool]] = mapped_column(Boolean)
    disability_valid_until: Mapped[Optional[datetime.date]] = mapped_column(Date)
    merkzeichen: Mapped[Optional[DisabilityMerkzeichenType]] = mapped_column(
        Enum(DisabilityMerkzeichenType, values_callable=lambda cls: [member.value for member in cls], name="disability_merkzeichen_type")
    )
    disability_application_pending: Mapped[Optional[bool]] = mapped_column(Boolean)
    social_security_type: Mapped[Optional[SocialSecurityTypeType]] = mapped_column(
        Enum(SocialSecurityTypeType, values_callable=lambda cls: [member.value for member in cls], name="social_security_type_type")
    )
    health_insurance_provider: Mapped[Optional[str]] = mapped_column(String(255))
    health_insurance_status: Mapped[Optional[HealthInsuranceStatusType]] = mapped_column(
        Enum(HealthInsuranceStatusType, values_callable=lambda cls: [member.value for member in cls], name="health_insurance_status_type")
    )
    pension_insurance_provider: Mapped[Optional[str]] = mapped_column(String(255))
    pension_insurance_no: Mapped[Optional[str]] = mapped_column(String(255))
    is_care_dependent: Mapped[Optional[bool]] = mapped_column(Boolean)
    care_level: Mapped[Optional[CareLevelType]] = mapped_column(
        Enum(CareLevelType, values_callable=lambda cls: [member.value for member in cls], name="care_level_type")
    )
    has_inpatient_facility_accommodation: Mapped[Optional[bool]] = mapped_column(Boolean)
    inpatient_facility_assigned_from: Mapped[Optional[datetime.date]] = mapped_column(Date)
    inpatient_facility_assigned_until: Mapped[Optional[datetime.date]] = mapped_column(Date)
    inpatient_facility_last_residence: Mapped[Optional[str]] = mapped_column(String(255))
    has_permanent_reduction_in_earning_capacity: Mapped[Optional[bool]] = mapped_column(Boolean)
    reduced_work_capacity_is_permanent: Mapped[Optional[bool]] = mapped_column(Boolean)
    reduced_work_capacity_start_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    reduced_work_capacity_end_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    reduced_work_capacity_reason: Mapped[Optional[str]] = mapped_column(Text)
    can_work_at_least_3h_daily: Mapped[Optional[bool]] = mapped_column(Boolean)
    work_scope_and_type: Mapped[Optional[str]] = mapped_column(String(255))
    employer_name: Mapped[Optional[str]] = mapped_column(String(255))
    is_student_or_trainee: Mapped[Optional[bool]] = mapped_column(Boolean)
    education_or_study_subject: Mapped[Optional[str]] = mapped_column(String(255))
    employment_office_customer_number: Mapped[Optional[str]] = mapped_column(String(255))
    commute_distance_km: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    has_applied_for_sgb2_benefits: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_applied_for_asylum_benefits: Mapped[Optional[bool]] = mapped_column(Boolean)
    has_child_with_substantial_income: Mapped[Optional[bool]] = mapped_column(Boolean)
    have_parents_substantial_joint_income: Mapped[Optional[bool]] = mapped_column(Boolean)
    monthly_expenses_total: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("now()"))

    user: Mapped["Users"] = relationship("Users", back_populates="associated_persons")
    income_entries: Mapped[list["IncomeEntries"]] = relationship(
        "IncomeEntries", back_populates="person", cascade="all, delete-orphan"
    )
    expense_entries: Mapped[list["ExpenseEntries"]] = relationship(
        "ExpenseEntries", back_populates="person", cascade="all, delete-orphan"
    )
    asset_entries: Mapped[list["AssetEntries"]] = relationship(
        "AssetEntries", back_populates="person", cascade="all, delete-orphan"
    )
    benefit_claim_entries: Mapped[list["BenefitClaimEntries"]] = relationship(
        "BenefitClaimEntries",
        back_populates="person",
        cascade="all, delete-orphan",
        order_by="BenefitClaimEntries.sort_order",
    )


class Conversations(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        ForeignKeyConstraint(["fk_user_id"], ["users.id"], ondelete="CASCADE", name="conversations_fk_user_id_fkey"),
        PrimaryKeyConstraint("id", name="conversations_pkey"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    fk_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[ConversationStatusType] = mapped_column(
        Enum(
            ConversationStatusType,
            values_callable=lambda cls: [member.value for member in cls],
            name="conversation_status_type",
        ),
        nullable=False,
        server_default=text("'in_progress'::conversation_status_type"),
    )
    application_type: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))

    fk_user: Mapped["Users"] = relationship("Users", back_populates="conversations")
    conversation_messages: Mapped[list["ConversationMessages"]] = relationship(
        "ConversationMessages", back_populates="fk_conversation", cascade="all, delete-orphan"
    )


class UserApplications(Base):
    __tablename__ = "user_applications"
    __table_args__ = (
        ForeignKeyConstraint(
            ["fk_user_id"], ["users.id"], ondelete="CASCADE", name="user_applications_fk_user_id_fkey"
        ),
        PrimaryKeyConstraint("application_id", name="user_applications_pkey"),
    )

    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    fk_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    form_type: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[Optional[StatusType]] = mapped_column(
        Enum(StatusType, values_callable=lambda cls: [member.value for member in cls], name="status_type"),
        server_default=text("'in_progress'::status_type"),
    )
    form_data: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))
    last_reminded_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

    fk_user: Mapped["Users"] = relationship("Users", back_populates="user_applications")
    user_documents: Mapped[list["UserDocuments"]] = relationship(
        "UserDocuments", back_populates="fk_application", cascade="all, delete-orphan"
    )


class UserTutorialStates(Base):
    __tablename__ = "user_tutorial_states"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tutorial_id"], ["cms_tutorials.id"], ondelete="CASCADE", name="user_tutorial_states_tutorial_id_fkey"
        ),
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="user_tutorial_states_user_id_fkey"),
        PrimaryKeyConstraint("user_id", "tutorial_id", name="user_tutorial_states_pkey"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    tutorial_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    status: Mapped[TutorialStatusType] = mapped_column(
        Enum(
            TutorialStatusType,
            values_callable=lambda cls: [member.value for member in cls],
            name="tutorial_status_type",
        ),
        nullable=False,
        server_default=text("'in_progress'::tutorial_status_type"),
    )
    current_step: Mapped[Optional[str]] = mapped_column(String(255))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))

    tutorial: Mapped["CmsTutorials"] = relationship("CmsTutorials", back_populates="user_tutorial_states")
    user: Mapped["Users"] = relationship("Users", back_populates="user_tutorial_states")


class ConversationMessages(Base):
    __tablename__ = "conversation_messages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["fk_conversation_id"],
            ["conversations.id"],
            ondelete="CASCADE",
            name="conversation_messages_fk_conversation_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="conversation_messages_pkey"),
        Index("idx_messages_conversation_created", "fk_conversation_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    fk_conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    message_role: Mapped[ChatMessageRoleType] = mapped_column(
        Enum(
            ChatMessageRoleType,
            values_callable=lambda cls: [member.value for member in cls],
            name="chat_message_role_type",
        ),
        nullable=False,
    )
    content: Mapped[Optional[str]] = mapped_column(Text)
    message_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))

    fk_conversation: Mapped["Conversations"] = relationship("Conversations", back_populates="conversation_messages")


class UserDocuments(Base):
    __tablename__ = "user_documents"
    __table_args__ = (
        ForeignKeyConstraint(
            ["fk_application_id"],
            ["user_applications.application_id"],
            ondelete="CASCADE",
            name="user_documents_fk_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["fk_file_id"], ["uploaded_files.id"], ondelete="RESTRICT", name="user_documents_fk_file_id_fkey"
        ),
        ForeignKeyConstraint(["fk_user_id"], ["users.id"], ondelete="CASCADE", name="user_documents_fk_user_id_fkey"),
        PrimaryKeyConstraint("document_id", name="user_documents_pkey"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    fk_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    fk_application_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    document_type: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[DocumentStatusType] = mapped_column(
        Enum(
            DocumentStatusType,
            values_callable=lambda cls: [member.value for member in cls],
            name="document_status_type",
        ),
        nullable=False,
        server_default=text("'processing'::document_status_type"),
    )
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("now()"))
    fk_file_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    user_error_code: Mapped[Optional[str]] = mapped_column(String(255))
    internal_error_log: Mapped[Optional[str]] = mapped_column(Text)

    fk_application: Mapped["UserApplications"] = relationship("UserApplications", back_populates="user_documents")
    fk_file: Mapped[Optional["UploadedFiles"]] = relationship("UploadedFiles", back_populates="user_documents")
    fk_user: Mapped["Users"] = relationship("Users", back_populates="user_documents")


class _MoneyEntry(Base):
    """The shared shape of the Grundsicherung money grids: a row per (person, type),
    where `person_id IS NULL` means the applicant. A grid column per person rather than a
    column per form line is what lets the same rows serve Person 3+ and the other forms;
    the alternative was ~110 scalar columns duplicated onto every person table."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    person_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("now()"))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("now()"))

    @property
    def person_sort_order(self) -> Optional[int]:
        """The owner as the API names it. The entry schemas read a row through
        `from_attributes`, and without this every person's row would serialise as the
        applicant's - handing a caller back a grid it cannot write again."""
        return self.person.sort_order if self.person is not None else None


class IncomeEntries(_MoneyEntry):
    __tablename__ = "income_entries"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="income_entries_user_id_fkey"),
        ForeignKeyConstraint(
            ["person_id"], ["associated_persons.id"], ondelete="CASCADE", name="income_entries_person_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="income_entries_pkey"),
        Index("income_entries_user_id_idx", "user_id"),
        # Partial, because NULLs are never equal in a plain UNIQUE constraint, so the
        # applicant's rows (person_id IS NULL) would not be deduplicated by one.
        Index(
            "income_entries_applicant_type_idx",
            "user_id",
            "income_type",
            unique=True,
            postgresql_where=text("person_id IS NULL"),
        ),
        Index(
            "income_entries_person_type_idx",
            "person_id",
            "income_type",
            unique=True,
            postgresql_where=text("person_id IS NOT NULL"),
        ),
    )

    income_type: Mapped[IncomeTypeType] = mapped_column(
        Enum(IncomeTypeType, values_callable=lambda cls: [member.value for member in cls], name="income_type"),
        nullable=False,
    )
    monthly_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    # One column per row on the form, shared by both person columns.
    awarding_office: Mapped[Optional[str]] = mapped_column(String(255))
    reference_no: Mapped[Optional[str]] = mapped_column(String(255))

    user: Mapped["Users"] = relationship("Users", back_populates="income_entries")
    person: Mapped[Optional["AssociatedPersons"]] = relationship(
        "AssociatedPersons", back_populates="income_entries"
    )


class ExpenseEntries(_MoneyEntry):
    __tablename__ = "expense_entries"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="expense_entries_user_id_fkey"),
        ForeignKeyConstraint(
            ["person_id"], ["associated_persons.id"], ondelete="CASCADE", name="expense_entries_person_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="expense_entries_pkey"),
        Index("expense_entries_user_id_idx", "user_id"),
        # Partial, because NULLs are never equal in a plain UNIQUE constraint, so the
        # applicant's rows (person_id IS NULL) would not be deduplicated by one.
        Index(
            "expense_entries_applicant_type_idx",
            "user_id",
            "expense_type",
            unique=True,
            postgresql_where=text("person_id IS NULL"),
        ),
        Index(
            "expense_entries_person_type_idx",
            "person_id",
            "expense_type",
            unique=True,
            postgresql_where=text("person_id IS NOT NULL"),
        ),
    )

    expense_type: Mapped[ExpenseTypeType] = mapped_column(
        Enum(ExpenseTypeType, values_callable=lambda cls: [member.value for member in cls], name="expense_type"),
        nullable=False,
    )
    monthly_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    note: Mapped[Optional[str]] = mapped_column(String(255))

    user: Mapped["Users"] = relationship("Users", back_populates="expense_entries")
    person: Mapped[Optional["AssociatedPersons"]] = relationship(
        "AssociatedPersons", back_populates="expense_entries"
    )


class AssetEntries(_MoneyEntry):
    __tablename__ = "asset_entries"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="asset_entries_user_id_fkey"),
        ForeignKeyConstraint(
            ["person_id"], ["associated_persons.id"], ondelete="CASCADE", name="asset_entries_person_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="asset_entries_pkey"),
        Index("asset_entries_user_id_idx", "user_id"),
        # Partial, because NULLs are never equal in a plain UNIQUE constraint, so the
        # applicant's rows (person_id IS NULL) would not be deduplicated by one.
        Index(
            "asset_entries_applicant_type_idx",
            "user_id",
            "asset_type",
            unique=True,
            postgresql_where=text("person_id IS NULL"),
        ),
        Index(
            "asset_entries_person_type_idx",
            "person_id",
            "asset_type",
            unique=True,
            postgresql_where=text("person_id IS NOT NULL"),
        ),
    )

    asset_type: Mapped[AssetTypeType] = mapped_column(
        Enum(AssetTypeType, values_callable=lambda cls: [member.value for member in cls], name="asset_type"),
        nullable=False,
    )
    amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    description: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped["Users"] = relationship("Users", back_populates="asset_entries")
    person: Mapped[Optional["AssociatedPersons"]] = relationship("AssociatedPersons", back_populates="asset_entries")


class BenefitClaimEntries(_MoneyEntry):
    """A free list rather than one row per fixed type: the form prints three blank rows
    for benefits still being decided and two for expected lump sums, so `sort_order`
    decides which row a record lands in."""

    __tablename__ = "benefit_claim_entries"
    __table_args__ = (
        ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="benefit_claim_entries_user_id_fkey"),
        ForeignKeyConstraint(
            ["person_id"], ["associated_persons.id"], ondelete="CASCADE", name="benefit_claim_entries_person_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="benefit_claim_entries_pkey"),
        Index("benefit_claim_entries_lookup_idx", "user_id", "claim_kind", "sort_order"),
    )

    claim_kind: Mapped[BenefitClaimKindType] = mapped_column(
        Enum(
            BenefitClaimKindType,
            values_callable=lambda cls: [member.value for member in cls],
            name="benefit_claim_kind",
        ),
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    benefit_type: Mapped[Optional[str]] = mapped_column(String(255))
    # Antragsdatum for a pending application, expected payment date for a lump sum.
    event_date: Mapped[Optional[datetime.date]] = mapped_column(Date)
    amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2))
    office_reference: Mapped[Optional[str]] = mapped_column(String(255))

    user: Mapped["Users"] = relationship("Users", back_populates="benefit_claim_entries")
    person: Mapped[Optional["AssociatedPersons"]] = relationship(
        "AssociatedPersons", back_populates="benefit_claim_entries"
    )

