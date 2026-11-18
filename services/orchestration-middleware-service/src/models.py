from typing import Optional
import datetime
import decimal
from enum import StrEnum
import uuid

from sqlalchemy import BigInteger, CHAR, CheckConstraint, Enum, FetchedValue, Index, NUMERIC, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import DOMAIN, JSONB
from sqlmodel import Field, Relationship, SQLModel

ISO_COUNTRY = DOMAIN('iso_country', CHAR(2), constraint_name='iso_country_check', check="VALUE ~ '^[A-Z]{2}$'", create_type=False)
MONEY_NONNEG = DOMAIN('money_nonneg', NUMERIC(10, 2), constraint_name='money_nonneg_check', check='VALUE >= 0', create_type=False)


def pg_enum(enum_cls: type[StrEnum], name: str) -> Enum:
    return Enum(enum_cls, values_callable=lambda cls: [member.value for member in cls], name=name)


class AbilityToWorkType(StrEnum):
    FULLY_ABLE = 'Fully able'
    TEMPORARILY_DISABLED = 'Temporarily disabled'
    PERMANENTLY_DISABLED = 'Permanently disabled'


class AccomodationType(StrEnum):
    RENTAL_APARTMENT = 'Rental Apartment'
    OWN_HOME = 'Own Home'
    CONDOMINIUM = 'Condominium'
    RELATIVE = 'Relative'
    SHARED_HOUSEHOLD = 'Shared Household'


class AssetType(StrEnum):
    SAVINGS_AND_CASH = 'Savings and Cash'
    SECURITIES = 'Securities'
    VALUABLES = 'Valuables'
    GIFTED_ASSETS = 'Gifted Assets'
    MOTOR_VEHICLE = 'Motor Vehicle'
    REAL_ESTATE = 'Real Estate'
    SUBSIDISED_PRIVATE_PENSION = 'Subsidised Private Pension'
    TRANSFER_CONTRACT_CLAIMS = 'Transfer Contract Claims'
    OTHER_ASSETS = 'Other Assets'


class AssociationType(StrEnum):
    SPOUSE = 'Spouse'
    REGISTERED_PARTNER = 'Registered Partner'
    COHABITING_PARTNER = 'Cohabiting Partner'
    CHILD = 'Child'
    PARENT = 'Parent'
    OTHER_RELATIVE = 'Other Relative'
    OTHER = 'Other'


class BenefitClaimKind(StrEnum):
    PENDING_APPLICATION = 'Pending Application'
    EXPECTED_ONE_TIME_PAYMENT = 'Expected One-Time Payment'


class CareLevelType(StrEnum):
    PFLEGEGRAD_1 = 'Pflegegrad 1'
    PFLEGEGRAD_2 = 'Pflegegrad 2'
    PFLEGEGRAD_3 = 'Pflegegrad 3'
    PFLEGEGRAD_4 = 'Pflegegrad 4'
    PFLEGEGRAD_5 = 'Pflegegrad 5'


class ChatMessageRoleType(StrEnum):
    USER = 'user'
    ASSISTANT = 'assistant'
    SYSTEM = 'system'
    TOOL = 'tool'


class ConversationStatusType(StrEnum):
    IN_PROGRESS = 'in_progress'
    CLOSED = 'closed'


class DisabilityMerkzeichenType(StrEnum):
    G = 'G'
    AG = 'aG'
    H = 'H'
    B = 'B'
    BL = 'Bl'
    GL = 'Gl'
    TBL = 'TBl'
    RF = 'RF'
    _1_KL = '1 Kl'
    EB = 'EB'
    VB = 'VB'
    T = 'T'


class DisplacedStatusType(StrEnum):
    NONE = 'none'
    EXPELLEE__RESETTLER_ = 'Expellee (Resettler)'
    DISPLACED_PERSON__RESETTLER_ = 'Displaced Person (Resettler)'
    LATE_RESETTLER = 'Late Resettler'
    SPOUSE_OR_DESCENDANT_OF_A_LATE_RESETTLER = 'Spouse or Descendant of a Late Resettler'
    SOVIET_ZONE_REFUGEE = 'Soviet Zone Refugee'


class DocumentStatusType(StrEnum):
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    READY_FOR_REVIEW = 'ready_for_review'
    VERIFIED = 'verified'


class ExpenseType(StrEnum):
    INCOME_TAX = 'Income Tax'
    HEALTH_INSURANCE = 'Health Insurance'
    CARE_INSURANCE = 'Care Insurance'
    UNEMPLOYMENT_INSURANCE = 'Unemployment Insurance'
    PENSION_INSURANCE = 'Pension Insurance'
    CHURCH_TAX = 'Church Tax'
    ACCIDENT_INSURANCE = 'Accident Insurance'
    RETIREMENT_PROVISION = 'Retirement Provision'
    HOUSEHOLD_CONTENTS_INSURANCE = 'Household Contents Insurance'
    FUNERAL_INSURANCE = 'Funeral Insurance'
    LIFE_INSURANCE = 'Life Insurance'
    LIABILITY_INSURANCE = 'Liability Insurance'
    WORK_EQUIPMENT = 'Work Equipment'
    PROFESSIONAL_ASSOCIATION_FEES = 'Professional Association Fees'
    DOUBLE_HOUSEHOLD = 'Double Household'
    COMMUTE_PUBLIC_TRANSPORT = 'Commute Public Transport'
    COMMUTE_CAR = 'Commute Car'
    COMMUTE_SMALL_CAR = 'Commute Small Car'
    COMMUTE_MOTORCYCLE = 'Commute Motorcycle'
    COMMUTE_MOPED = 'Commute Moped'
    COMMUTE_OTHER = 'Commute Other'


class GenderType(StrEnum):
    MALE = 'Male'
    FEMALE = 'Female'
    DIVERSE = 'Diverse'


class HealthInsuranceStatusType(StrEnum):
    COMPULSORY_INSURANCE = 'Compulsory Insurance'
    VOLUNTARY_INSURANCE = 'Voluntary Insurance'
    FAMILY_INSURANCE = 'Family Insurance'
    PRIVATE_INSURANCE = 'Private Insurance'
    CARE_BY_HEALTH_FUNDS_UNDER___264_SGB_V = 'Care by Health Funds under § 264 SGB V'


class IncomeType(StrEnum):
    EMPLOYMENT = 'Employment'
    HEALTH_INSURANCE_BENEFITS = 'Health Insurance Benefits'
    BUSINESS = 'Business'
    AGRICULTURE_AND_FORESTRY = 'Agriculture and Forestry'
    OTHER_SELF_EMPLOYMENT = 'Other Self-Employment'
    RENTAL_AND_LEASING = 'Rental and Leasing'
    HOUSING_BENEFIT = 'Housing Benefit'
    PENSION = 'Pension'
    SOCIAL_ASSISTANCE = 'Social Assistance'
    BASIC_SECURITY_BENEFITS = 'Basic Security Benefits'
    ASYLUM_SEEKER_BENEFITS = 'Asylum Seeker Benefits'
    FEDERAL_WAR_VICTIMS_RELIEF = 'Federal War Victims Relief'
    EQUALISATION_OF_BURDENS = 'Equalisation of Burdens'
    EMPLOYMENT_AGENCY_BENEFITS = 'Employment Agency Benefits'
    CHILD_BENEFIT = 'Child Benefit'
    CHILD_BENEFIT_SUPPLEMENT = 'Child Benefit Supplement'
    PARENTAL_ALLOWANCE = 'Parental Allowance'
    EDUCATION_GRANT = 'Education Grant'
    ALIMONY = 'Alimony'
    ALIMONY_ADVANCE = 'Alimony Advance'
    PRIVATE_MONETARY_CLAIMS = 'Private Monetary Claims'
    TAX_REFUND = 'Tax Refund'
    CAPITAL_INCOME = 'Capital Income'
    OTHER_INCOME = 'Other Income'
    OLD_AGE_PENSION = 'Old-Age Pension'
    REDUCED_EARNING_CAPACITY_PENSION = 'Reduced Earning Capacity Pension'
    SURVIVOR_PENSION = 'Survivor Pension'


class MaritalStatusType(StrEnum):
    SINGLE = 'Single'
    MARRIED = 'Married'
    COHABITING = 'Cohabiting'
    PERMANENTLY_SEPARATED = 'Permanently Separated'
    REGISTERED_CIVIL_PARTNERSHIP = 'Registered Civil Partnership'
    DIVORCED = 'Divorced'
    WIDOWED = 'Widowed'


class SocialSecurityTypeType(StrEnum):
    NONE = 'None'
    PENSION_INSURANCE = 'Pension Insurance'
    LONG_TERM_CARE_INSURANCE = 'Long-term Care Insurance'


class StatusType(StrEnum):
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    SUBMITTED = 'submitted'


class TenancyStatusType(StrEnum):
    MAIN_TENANT = 'Main Tenant'
    SUBTENANT = 'Subtenant'


class TutorialStatusType(StrEnum):
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'


class BerlinAddresses(SQLModel, table=True):
    __tablename__ = 'berlin_addresses'
    __table_args__ = (
        Index('idx_berlin_addresses_lookup', 'plz', 'street', 'hnr'),
    )

    id: int = Field(primary_key=True, sa_type=BigInteger)
    plz: str = Field(sa_type=Text)
    street: str = Field(sa_type=Text)
    hnr: str = Field(sa_type=Text)
    bez_name: str = Field(sa_type=Text)


class CmsTutorialsBase(SQLModel):
    slug: str = Field(max_length=255)
    sort_order: int = Field(default=0, sa_column_kwargs={'server_default': text('0')})
    title: object = Field(default_factory=dict, sa_type=JSONB, sa_column_kwargs={'server_default': text("'{}'::jsonb")})
    content: object = Field(default_factory=list, sa_type=JSONB, sa_column_kwargs={'server_default': text("'[]'::jsonb")})
    subtitle: object = Field(default_factory=dict, sa_type=JSONB, sa_column_kwargs={'server_default': text("'{}'::jsonb")})


class CmsTutorialsPublic(CmsTutorialsBase):
    id: uuid.UUID


class CmsTutorials(CmsTutorialsBase, table=True):
    __tablename__ = 'cms_tutorials'
    __table_args__ = (
        UniqueConstraint('slug', name='cms_tutorials_slug_key'),
    )

    id: uuid.UUID = Field(primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    created_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()')})

    user_tutorial_states: list['UserTutorialStates'] = Relationship(back_populates='tutorial', passive_deletes='all')


class UploadedFiles(SQLModel, table=True):
    __tablename__ = 'uploaded_files'

    id: uuid.UUID = Field(primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    name: str = Field(max_length=255)
    object_name: str = Field(max_length=1024)
    bucket_name: str = Field(max_length=1024)
    created_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})

    user_documents: list['UserDocuments'] = Relationship(back_populates='fk_file')


class UsersBase(SQLModel):
    first_name: str | None = Field(default=None, max_length=255)
    last_name: str | None = Field(default=None, max_length=255)
    date_of_birth: datetime.date | None = None
    place_of_birth: str | None = Field(default=None, max_length=255)
    legal_gender: GenderType | None = Field(default=None, sa_type=pg_enum(GenderType, 'gender_type'))
    marital_status: MaritalStatusType | None = Field(default=None, sa_type=pg_enum(MaritalStatusType, 'marital_status_type'))
    married_since: datetime.date | None = None
    is_german_citizen: bool | None = None
    is_resident_in_germany: bool | None = None
    has_guardian: bool | None = None
    has_custodian: bool | None = None
    displaced_status: DisplacedStatusType | None = Field(default=None, sa_type=pg_enum(DisplacedStatusType, 'displaced_status_type'))
    displaced_issued_on: datetime.date | None = None
    displaced_issued_by: str | None = Field(default=None, max_length=255)
    social_security_type: SocialSecurityTypeType | None = Field(default=None, sa_type=pg_enum(SocialSecurityTypeType, 'social_security_type_type'))
    health_insurance_provider: str | None = Field(default=None, max_length=255)
    health_insurance_status: HealthInsuranceStatusType | None = Field(default=None, sa_type=pg_enum(HealthInsuranceStatusType, 'health_insurance_status_type'))
    pension_insurance_provider: str | None = Field(default=None, max_length=255)
    pension_insurance_no: str | None = Field(default=None, max_length=255)
    has_received_previous_benefits: bool | None = None
    previous_benefits_authority: str | None = Field(default=None, max_length=255)
    previous_benefits_period: str | None = Field(default=None, max_length=255)
    previous_benefits_ref_no: str | None = Field(default=None, max_length=255)
    has_applied_for_asylum_benefits: bool | None = None
    is_currently_employed: bool | None = None
    ability_to_work: AbilityToWorkType | None = Field(default=None, sa_type=pg_enum(AbilityToWorkType, 'ability_to_work_type'))
    has_permanent_reduction_in_earning_capacity: bool | None = None
    has_inpatient_facility_accommodation: bool | None = None
    gave_away_assets_last_10_years: bool | None = None
    gross_negligence_last_10_years: bool | None = None
    accomodation_type: AccomodationType | None = Field(default=None, sa_type=pg_enum(AccomodationType, 'accomodation_type'))
    tenancy_status: TenancyStatusType | None = Field(default=None, sa_type=pg_enum(TenancyStatusType, 'tenancy_status_type'))
    rent_total: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    hot_water_costs: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    heating_costs: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    cable_tv_costs: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    number_of_rooms: int | None = None
    living_area: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    persons_in_household_count: int | None = None
    bank_name: str | None = Field(default=None, max_length=255)
    account_holder: str | None = Field(default=None, max_length=255)
    iban: str | None = Field(default=None, max_length=50)
    has_disability_id: bool | None = None
    disability_valid_until: datetime.date | None = None
    merkzeichen: DisabilityMerkzeichenType | None = Field(default=None, sa_type=pg_enum(DisabilityMerkzeichenType, 'disability_merkzeichen_type'))
    disability_application_pending: bool | None = None
    phone_number: str | None = Field(default=None, max_length=32)
    nationality: str | None = Field(default=None, max_length=255)
    second_nationality: str | None = Field(default=None, max_length=255)
    street: str | None = Field(default=None, max_length=255)
    house_number: str | None = Field(default=None, max_length=20)
    zip_code: str | None = Field(default=None, max_length=10)
    city: str | None = Field(default=None, max_length=255)
    state: str | None = Field(default=None, max_length=255)
    birth_name: str | None = Field(default=None, max_length=255)
    residence_status: str | None = Field(default=None, max_length=255)
    identification_numbers: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=255)
    district: str | None = Field(default=None, max_length=255)
    monthly_income: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    has_assets: bool | None = None
    assets_description: str | None = Field(default=None, sa_type=Text)
    has_costly_medical_nutrition: bool | None = None
    has_applied_for_benefits_awaiting_decision: bool | None = None
    benefits_awaiting_decision_type: str | None = Field(default=None, max_length=255)
    benefits_awaiting_decision_application_date: datetime.date | None = None
    benefits_awaiting_decision_office: str | None = Field(default=None, max_length=255)
    benefits_awaiting_decision_reference: str | None = Field(default=None, max_length=255)
    are_one_time_payments_expected: bool | None = None
    one_time_payments_expected_type: str | None = Field(default=None, max_length=255)
    one_time_payments_expected_amount: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    one_time_payments_expected_date: datetime.date | None = None
    bic: str | None = Field(default=None, max_length=11)
    sublet_room_count: int | None = None
    sublet_rent_income: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    rent_paid_until: datetime.date | None = None
    landlord_name: str | None = Field(default=None, max_length=255)
    heating_type: str | None = Field(default=None, max_length=255)
    free_housing_right_holder: str | None = Field(default=None, max_length=255)
    is_care_dependent: bool | None = None
    inpatient_facility_move_in_date: datetime.date | None = None
    inpatient_facility_last_residence: str | None = Field(default=None, max_length=255)
    reduced_work_capacity_start_date: datetime.date | None = None
    reduced_work_capacity_end_date: datetime.date | None = None
    reduced_work_capacity_reason: str | None = Field(default=None, sa_type=Text)
    email: str | None = Field(default=None, max_length=255)
    license_plate: str | None = Field(default=None, max_length=20)
    is_student_or_trainee: bool | None = None
    professional_expenses: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    has_childcare_expenses: bool | None = None
    is_subsidized_housing: bool | None = None
    has_other_residence: bool | None = None
    has_secondary_residence: bool | None = None
    has_garage_costs: bool | None = None
    garage_costs: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    has_household_energy_costs: bool | None = None
    household_energy_costs: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    is_living_area_used_commercially: bool | None = None
    commercially_used_area_sqm: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    is_victim_of_national_socialist_persecution: bool | None = None
    is_wohngeld_first_application: bool | None = None
    receives_wohngeld_for_other_dwelling: bool | None = None
    household_member_died_recently: bool | None = None
    household_size_will_change: bool | None = None
    receives_other_transfer_benefits: bool | None = None
    pays_child_or_spousal_support: bool | None = None
    receives_support_from_others: bool | None = None
    expects_future_income_change: bool | None = None
    assets_exceed_wohngeld_threshold: bool | None = None
    related_to_landlord: bool | None = None
    service_costs_included_in_rent: bool | None = None
    rent_paid_partly_by_third_party: bool | None = None
    receives_rent_contribution_from_others: bool | None = None
    expects_rent_change: bool | None = None
    wohngeld_payment_to_applicant: bool | None = None
    consents_to_bank_statement_retention: bool | None = None
    consents_to_registry_verification: bool | None = None
    apartment_floor_location: str | None = Field(default=None, max_length=255)
    resident_in_berlin_since: datetime.date | None = None
    resident_in_district_since: datetime.date | None = None
    previous_address: str | None = Field(default=None, max_length=255)
    rent_arrears_period: str | None = Field(default=None, max_length=255)
    rent_arrears_amount: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    tenancy_terminated_on: datetime.date | None = None
    sublet_unrentable_reason: str | None = Field(default=None, max_length=255)
    inpatient_facility_assigned_until: datetime.date | None = None
    care_level: CareLevelType | None = Field(default=None, sa_type=pg_enum(CareLevelType, 'care_level_type'))
    can_work_at_least_3h_daily: bool | None = None
    work_scope_and_type: str | None = Field(default=None, max_length=255)
    employer_name: str | None = Field(default=None, max_length=255)
    education_or_study_subject: str | None = Field(default=None, max_length=255)
    employment_office_customer_number: str | None = Field(default=None, max_length=255)
    commute_distance_km: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    has_child_with_substantial_income: bool | None = None
    have_parents_substantial_joint_income: bool | None = None
    monthly_expenses_total: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    landlord_address: str | None = Field(default=None, max_length=255)
    main_tenant_name: str | None = Field(default=None, max_length=255)
    vehicle_make: str | None = Field(default=None, max_length=255)
    vehicle_year: str | None = Field(default=None, max_length=4)
    azr_number: str | None = Field(default=None, max_length=12)
    has_unavoidable_special_need: bool | None = None
    was_self_employed_last_5_years: bool | None = None
    received_wage_replacement_last_5_years: bool | None = None
    did_military_or_voluntary_service_last_5_years: bool | None = None
    cared_for_relatives_last_5_years: bool | None = None


class UsersCreate(UsersBase):
    pass


class UsersPublic(UsersBase):
    id: uuid.UUID


class UsersUpdate(UsersBase):
    pass


class Users(UsersBase, table=True):
    __table_args__ = (
        CheckConstraint('inpatient_facility_move_in_date IS NULL OR inpatient_facility_assigned_until IS NULL OR inpatient_facility_assigned_until >= inpatient_facility_move_in_date', name='users_facility_period'),
        UniqueConstraint('authentik_id', name='users_authentik_id_key'),
        UniqueConstraint('phone_number', name='users_phone_number_key')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    created_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})
    authentik_id: str | None = Field(default=None, max_length=255)
    fcm_token: str | None = Field(default=None, max_length=512)
    demo_seed_fixture_hash: str | None = Field(default=None, max_length=64)
    
    conversations: list['Conversations'] = Relationship(back_populates='fk_user', passive_deletes='all')
    user_applications: list['UserApplications'] = Relationship(back_populates='fk_user', passive_deletes='all')
    user_tutorial_states: list['UserTutorialStates'] = Relationship(back_populates='user', passive_deletes='all')
    associated_persons: list['AssociatedPersons'] = Relationship(back_populates='user', passive_deletes='all')
    asset_entries: list['AssetEntries'] = Relationship(back_populates='user', passive_deletes='all')
    benefit_claim_entries: list['BenefitClaimEntries'] = Relationship(back_populates='user', passive_deletes='all')
    expense_entries: list['ExpenseEntries'] = Relationship(back_populates='user', passive_deletes='all')
    income_entries: list['IncomeEntries'] = Relationship(back_populates='user', passive_deletes='all')
    user_documents: list['UserDocuments'] = Relationship(back_populates='fk_user', passive_deletes='all')


class AssociatedPersonsBase(SQLModel):
    association_type: AssociationType = Field(sa_type=pg_enum(AssociationType, 'association_type'))
    lives_in_household: bool = Field(default=True, sa_column_kwargs={'server_default': text('true')})
    sort_order: int = Field(default=0, sa_column_kwargs={'server_default': text('0')})
    first_name: str | None = Field(default=None, max_length=255)
    last_name: str | None = Field(default=None, max_length=255)
    birth_name: str | None = Field(default=None, max_length=255)
    date_of_birth: datetime.date | None = None
    place_of_birth: str | None = Field(default=None, max_length=255)
    legal_gender: GenderType | None = Field(default=None, sa_type=pg_enum(GenderType, 'gender_type'))
    marital_status: MaritalStatusType | None = Field(default=None, sa_type=pg_enum(MaritalStatusType, 'marital_status_type'))
    nationality: str | None = Field(default=None, sa_type=ISO_COUNTRY)
    second_nationality: str | None = Field(default=None, sa_type=ISO_COUNTRY)
    relationship_to_applicant: str | None = Field(default=None, max_length=255)
    employment_status: str | None = Field(default=None, max_length=255)
    monthly_income: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    monthly_pension_income: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    has_own_income: bool | None = None
    is_alimony_obligated: bool | None = None
    is_german_citizen: bool | None = None
    id_document_issuing_authority: str | None = Field(default=None, max_length=255)
    id_document_valid_until: datetime.date | None = None
    has_guardian: bool | None = None
    has_custodian: bool | None = None
    displaced_status: DisplacedStatusType | None = Field(default=None, sa_type=pg_enum(DisplacedStatusType, 'displaced_status_type'))
    displaced_issued_on: datetime.date | None = None
    displaced_issued_by: str | None = Field(default=None, max_length=255)
    has_received_previous_benefits: bool | None = None
    previous_benefits_authority: str | None = Field(default=None, max_length=255)
    previous_benefits_period: str | None = Field(default=None, max_length=255)
    previous_benefits_ref_no: str | None = Field(default=None, max_length=255)
    has_disability_id: bool | None = None
    disability_valid_until: datetime.date | None = None
    merkzeichen: DisabilityMerkzeichenType | None = Field(default=None, sa_type=pg_enum(DisabilityMerkzeichenType, 'disability_merkzeichen_type'))
    disability_application_pending: bool | None = None
    social_security_type: SocialSecurityTypeType | None = Field(default=None, sa_type=pg_enum(SocialSecurityTypeType, 'social_security_type_type'))
    health_insurance_provider: str | None = Field(default=None, max_length=255)
    health_insurance_status: HealthInsuranceStatusType | None = Field(default=None, sa_type=pg_enum(HealthInsuranceStatusType, 'health_insurance_status_type'))
    pension_insurance_provider: str | None = Field(default=None, max_length=255)
    pension_insurance_no: str | None = Field(default=None, max_length=255)
    is_care_dependent: bool | None = None
    care_level: CareLevelType | None = Field(default=None, sa_type=pg_enum(CareLevelType, 'care_level_type'))
    has_inpatient_facility_accommodation: bool | None = None
    inpatient_facility_assigned_from: datetime.date | None = None
    inpatient_facility_assigned_until: datetime.date | None = None
    inpatient_facility_last_residence: str | None = Field(default=None, max_length=255)
    has_permanent_reduction_in_earning_capacity: bool | None = None
    reduced_work_capacity_is_permanent: bool | None = None
    reduced_work_capacity_start_date: datetime.date | None = None
    reduced_work_capacity_end_date: datetime.date | None = None
    reduced_work_capacity_reason: str | None = Field(default=None, sa_type=Text)
    can_work_at_least_3h_daily: bool | None = None
    work_scope_and_type: str | None = Field(default=None, max_length=255)
    employer_name: str | None = Field(default=None, max_length=255)
    is_student_or_trainee: bool | None = None
    education_or_study_subject: str | None = Field(default=None, max_length=255)
    employment_office_customer_number: str | None = Field(default=None, max_length=255)
    commute_distance_km: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)
    has_applied_for_sgb2_benefits: bool | None = None
    has_applied_for_asylum_benefits: bool | None = None
    has_child_with_substantial_income: bool | None = None
    have_parents_substantial_joint_income: bool | None = None
    monthly_expenses_total: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)


class AssociatedPersonsPublic(AssociatedPersonsBase):
    id: uuid.UUID


class AssociatedPersonsUpdate(AssociatedPersonsBase):
    association_type: AssociationType | None = None
    lives_in_household: bool | None = None
    sort_order: int | None = None


class AssociatedPersons(AssociatedPersonsBase, table=True):
    __tablename__ = 'associated_persons'
    __table_args__ = (
        CheckConstraint("date_of_birth IS NULL OR date_of_birth >= '1900-01-01'::date AND date_of_birth <= CURRENT_DATE", name='associated_persons_dob_plausible'),
        CheckConstraint('inpatient_facility_assigned_from IS NULL OR inpatient_facility_assigned_until IS NULL OR inpatient_facility_assigned_until >= inpatient_facility_assigned_from', name='associated_persons_facility_period'),
        CheckConstraint('reduced_work_capacity_start_date IS NULL OR reduced_work_capacity_end_date IS NULL OR reduced_work_capacity_end_date >= reduced_work_capacity_start_date', name='associated_persons_work_capacity_period'),
        Index('associated_persons_user_id_idx', 'user_id', 'sort_order')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    user_id: uuid.UUID = Field(foreign_key='users.id', ondelete='CASCADE')
    
    created_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})
    

    user: 'Users' = Relationship(back_populates='associated_persons')
    asset_entries: list['AssetEntries'] = Relationship(back_populates='person', passive_deletes='all')
    benefit_claim_entries: list['BenefitClaimEntries'] = Relationship(back_populates='person', passive_deletes='all')
    expense_entries: list['ExpenseEntries'] = Relationship(back_populates='person', passive_deletes='all')
    income_entries: list['IncomeEntries'] = Relationship(back_populates='person', passive_deletes='all')


class ConversationsBase(SQLModel):
    status: ConversationStatusType = Field(default=ConversationStatusType.IN_PROGRESS, sa_type=pg_enum(ConversationStatusType, 'conversation_status_type'), sa_column_kwargs={'server_default': text("'in_progress'::conversation_status_type")})
    application_type: str | None = Field(default=None, max_length=255)

class ConversationsPublic(ConversationsBase):
    pass


class Conversations(ConversationsBase, table=True):
    id: uuid.UUID = Field(primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    fk_user_id: uuid.UUID = Field(foreign_key='users.id', ondelete='CASCADE')
    
    created_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})

    fk_user: 'Users' = Relationship(back_populates='conversations')
    conversation_messages: list['ConversationMessages'] = Relationship(back_populates='fk_conversation', passive_deletes='all')


class UserApplications(SQLModel, table=True):
    __tablename__ = 'user_applications'

    application_id: uuid.UUID = Field(primary_key=True)
    fk_user_id: uuid.UUID = Field(foreign_key='users.id', ondelete='CASCADE')
    form_type: str = Field(max_length=255)
    status: StatusType | None = Field(default=None, sa_type=pg_enum(StatusType, 'status_type'), sa_column_kwargs={'server_default': text("'in_progress'::status_type")})
    form_data: object | None = Field(default=None, sa_type=JSONB, sa_column_kwargs={'server_default': text("'{}'::jsonb")})
    created_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})
    last_reminded_at: datetime.datetime | None = None

    fk_user: 'Users' = Relationship(back_populates='user_applications')
    user_documents: list['UserDocuments'] = Relationship(back_populates='fk_application', passive_deletes='all')


class UserTutorialStatesBase(SQLModel):
    status: TutorialStatusType = Field(default=TutorialStatusType.IN_PROGRESS, sa_type=pg_enum(TutorialStatusType, 'tutorial_status_type'), sa_column_kwargs={'server_default': text("'in_progress'::tutorial_status_type")})
    current_step: str | None = Field(default=None, max_length=255)


class UserTutorialStatesPublic(UserTutorialStatesBase):
    user_id: uuid.UUID


class UserTutorialStatesUpdate(UserTutorialStatesBase):
    status: TutorialStatusType | None = None


class UserTutorialStates(UserTutorialStatesBase, table=True):
    __tablename__ = 'user_tutorial_states'

    user_id: uuid.UUID = Field(primary_key=True, foreign_key='users.id', ondelete='CASCADE')
    tutorial_id: uuid.UUID = Field(primary_key=True, foreign_key='cms_tutorials.id', ondelete='CASCADE')
    updated_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()')})

    tutorial: 'CmsTutorials' = Relationship(back_populates='user_tutorial_states')
    user: 'Users' = Relationship(back_populates='user_tutorial_states')


class AssetEntriesBase(SQLModel):
    asset_type: AssetType = Field(sa_type=pg_enum(AssetType, 'asset_type'))


class AssetEntriesPublic(AssetEntriesBase):
    pass


class AssetEntriesUpdate(AssetEntriesBase):
    asset_type: AssetType | None = None


class AssetEntries(AssetEntriesBase, table=True):
    __tablename__ = 'asset_entries'
    __table_args__ = (
        Index('asset_entries_applicant_type_idx', 'user_id', 'asset_type', postgresql_where='(person_id IS NULL)', unique=True),
        Index('asset_entries_person_type_idx', 'person_id', 'asset_type', postgresql_where='(person_id IS NOT NULL)', unique=True),
        Index('asset_entries_user_id_idx', 'user_id')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    user_id: uuid.UUID = Field(foreign_key='users.id', ondelete='CASCADE')
    created_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})
    person_id: uuid.UUID | None = Field(default=None, foreign_key='associated_persons.id', ondelete='CASCADE')
    amount: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    description: str | None = Field(default=None, sa_type=Text)

    person: Optional['AssociatedPersons'] = Relationship(back_populates='asset_entries')
    user: 'Users' = Relationship(back_populates='asset_entries')


class BenefitClaimEntriesBase(SQLModel):
    claim_kind: BenefitClaimKind = Field(sa_type=pg_enum(BenefitClaimKind, 'benefit_claim_kind'))
    sort_order: int = Field(default=0, sa_column_kwargs={'server_default': text('0')})
    benefit_type: str | None = Field(default=None, max_length=255)
    event_date: datetime.date | None = None
    amount: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    office_reference: str | None = Field(default=None, max_length=255)


class BenefitClaimEntriesPublic(BenefitClaimEntriesBase):
    id: uuid.UUID
    user_id: uuid.UUID
    person_id: uuid.UUID | None


class BenefitClaimEntriesUpdate(BenefitClaimEntriesBase):
    claim_kind: BenefitClaimKind | None = None
    sort_order: int | None = None


class BenefitClaimEntries(BenefitClaimEntriesBase, table=True):
    __tablename__ = 'benefit_claim_entries'
    __table_args__ = (
        Index('benefit_claim_entries_lookup_idx', 'user_id', 'claim_kind', 'sort_order'),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    user_id: uuid.UUID = Field(foreign_key='users.id', ondelete='CASCADE')
    created_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})
    person_id: uuid.UUID | None = Field(default=None, foreign_key='associated_persons.id', ondelete='CASCADE')
    benefit_type: str | None = Field(default=None, max_length=255)
    event_date: datetime.date | None = None
    amount: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    office_reference: str | None = Field(default=None, max_length=255)

    person: Optional['AssociatedPersons'] = Relationship(back_populates='benefit_claim_entries')
    user: 'Users' = Relationship(back_populates='benefit_claim_entries')


class ConversationMessagesBase(SQLModel):
    message_role: ChatMessageRoleType = Field(sa_type=pg_enum(ChatMessageRoleType, 'chat_message_role_type'))
    content: str | None = Field(default=None, sa_type=Text)
    message_metadata: object | None = Field(default=None, sa_type=JSONB, sa_column_kwargs={'server_default': text("'{}'::jsonb")})


class ConversationMessagesPublic(ConversationMessagesBase):
    id: uuid.UUID


class ConversationMessages(ConversationMessagesBase, table=True):
    __tablename__ = 'conversation_messages'
    __table_args__ = (
        Index('idx_messages_conversation_created', 'fk_conversation_id', 'created_at'),
    )

    id: uuid.UUID = Field(primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    fk_conversation_id: uuid.UUID = Field(foreign_key='conversations.id', ondelete='CASCADE')
    created_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})

    fk_conversation: 'Conversations' = Relationship(back_populates='conversation_messages')


class ExpenseEntriesBase(SQLModel):
    expense_type: ExpenseType = Field(sa_type=pg_enum(ExpenseType, 'expense_type'))
    monthly_amount: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    note: str | None = Field(default=None, max_length=255)


class ExpenseEntriesPublic(ExpenseEntriesBase):
    id: uuid.UUID
    user_id: uuid.UUID


class ExpenseEntriesUpdate(ExpenseEntriesBase):
    expense_type: ExpenseType | None = None


class ExpenseEntries(ExpenseEntriesBase, table=True):
    __tablename__ = 'expense_entries'
    __table_args__ = (
        Index('expense_entries_applicant_type_idx', 'user_id', 'expense_type', postgresql_where='(person_id IS NULL)', unique=True),
        Index('expense_entries_person_type_idx', 'person_id', 'expense_type', postgresql_where='(person_id IS NOT NULL)', unique=True),
        Index('expense_entries_user_id_idx', 'user_id')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    user_id: uuid.UUID = Field(foreign_key='users.id', ondelete='CASCADE')
    created_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})
    person_id: uuid.UUID | None = Field(default=None, foreign_key='associated_persons.id', ondelete='CASCADE')
    monthly_amount: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    note: str | None = Field(default=None, max_length=255)

    person: Optional['AssociatedPersons'] = Relationship(back_populates='expense_entries')
    user: 'Users' = Relationship(back_populates='expense_entries')


class IncomeEntriesBase(SQLModel):
    income_type: IncomeType = Field(sa_type=pg_enum(IncomeType, 'income_type'))
    monthly_amount: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    awarding_office: str | None = Field(default=None, max_length=255)
    reference_no: str | None = Field(default=None, max_length=255)


class IncomeEntriesPublic(IncomeEntriesBase):
    id: uuid.UUID
    user_id: uuid.UUID
    person_id: uuid.UUID | None


class IncomeEntriesUpdate(IncomeEntriesBase):
    income_type: IncomeType | None = None


class IncomeEntries(IncomeEntriesBase, table=True):
    __tablename__ = 'income_entries'
    __table_args__ = (
        Index('income_entries_applicant_type_idx', 'user_id', 'income_type', postgresql_where='(person_id IS NULL)', unique=True),
        Index('income_entries_person_type_idx', 'person_id', 'income_type', postgresql_where='(person_id IS NOT NULL)', unique=True),
        Index('income_entries_user_id_idx', 'user_id')
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    user_id: uuid.UUID = Field(foreign_key='users.id', ondelete='CASCADE')
    created_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, nullable=False, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})
    person_id: uuid.UUID | None = Field(default=None, foreign_key='associated_persons.id', ondelete='CASCADE')
    monthly_amount: decimal.Decimal | None = Field(default=None, sa_type=MONEY_NONNEG)
    awarding_office: str | None = Field(default=None, max_length=255)
    reference_no: str | None = Field(default=None, max_length=255)

    person: Optional['AssociatedPersons'] = Relationship(back_populates='income_entries')
    user: 'Users' = Relationship(back_populates='income_entries')


class UserDocumentsBase(SQLModel):
    document_type: str = Field(max_length=255)
    status: DocumentStatusType = Field(default=DocumentStatusType.PROCESSING, sa_type=pg_enum(DocumentStatusType, 'document_status_type'), sa_column_kwargs={'server_default': text("'processing'::document_status_type")})
    confidence_score: decimal.Decimal | None = Field(default=None, max_digits=10, decimal_places=2)


class UserDocumentsPublic(UserDocumentsBase):
    document_id: uuid.UUID



class UserDocuments(UserDocumentsBase, table=True):
    __tablename__ = 'user_documents'

    document_id: uuid.UUID = Field(primary_key=True, sa_column_kwargs={'server_default': text('gen_random_uuid()')})
    fk_user_id: uuid.UUID = Field(foreign_key='users.id', ondelete='CASCADE')
    fk_application_id: uuid.UUID = Field(foreign_key='user_applications.application_id', ondelete='CASCADE')
    created_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()')})
    updated_at: datetime.datetime | None = Field(default=None, sa_column_kwargs={'server_default': text('now()'), 'server_onupdate': FetchedValue()})
    fk_file_id: uuid.UUID | None = Field(default=None, foreign_key='uploaded_files.id', ondelete='RESTRICT')
    raw_data: object | None = Field(default=None, sa_type=JSONB)
    user_error_code: str | None = Field(default=None, max_length=255)
    internal_error_log: str | None = Field(default=None, sa_type=Text)

    fk_application: 'UserApplications' = Relationship(back_populates='user_documents')
    fk_file: Optional['UploadedFiles'] = Relationship(back_populates='user_documents')
    fk_user: 'Users' = Relationship(back_populates='user_documents')
