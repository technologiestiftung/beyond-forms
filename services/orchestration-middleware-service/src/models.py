from typing import Optional
import datetime
import decimal
import enum
import uuid

from sqlalchemy import BigInteger, Boolean, CHAR, CheckConstraint, Column, Date, DateTime, Enum, ForeignKeyConstraint, Index, Integer, NUMERIC, Numeric, PrimaryKeyConstraint, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import DOMAIN, JSONB
from sqlmodel import Field, Relationship, SQLModel

ISO_COUNTRY = DOMAIN('iso_country', CHAR(2), constraint_name='iso_country_check', check="VALUE ~ '^[A-Z]{2}$'", create_type=False)
MONEY_NONNEG = DOMAIN('money_nonneg', NUMERIC(10, 2), constraint_name='money_nonneg_check', check='VALUE >= 0', create_type=False)

class AbilityToWorkType(str, enum.Enum):
    FULLY_ABLE = 'Fully able'
    TEMPORARILY_DISABLED = 'Temporarily disabled'
    PERMANENTLY_DISABLED = 'Permanently disabled'


class AccomodationType(str, enum.Enum):
    RENTAL_APARTMENT = 'Rental Apartment'
    OWN_HOME = 'Own Home'
    CONDOMINIUM = 'Condominium'
    RELATIVE = 'Relative'
    SHARED_HOUSEHOLD = 'Shared Household'


class AssetType(str, enum.Enum):
    SAVINGS_AND_CASH = 'Savings and Cash'
    SECURITIES = 'Securities'
    VALUABLES = 'Valuables'
    GIFTED_ASSETS = 'Gifted Assets'
    MOTOR_VEHICLE = 'Motor Vehicle'
    REAL_ESTATE = 'Real Estate'
    SUBSIDISED_PRIVATE_PENSION = 'Subsidised Private Pension'
    TRANSFER_CONTRACT_CLAIMS = 'Transfer Contract Claims'
    OTHER_ASSETS = 'Other Assets'


class AssociationType(str, enum.Enum):
    SPOUSE = 'Spouse'
    REGISTERED_PARTNER = 'Registered Partner'
    COHABITING_PARTNER = 'Cohabiting Partner'
    CHILD = 'Child'
    PARENT = 'Parent'
    OTHER_RELATIVE = 'Other Relative'
    OTHER = 'Other'


class BenefitClaimKind(str, enum.Enum):
    PENDING_APPLICATION = 'Pending Application'
    EXPECTED_ONE_TIME_PAYMENT = 'Expected One-Time Payment'


class CareLevelType(str, enum.Enum):
    PFLEGEGRAD_1 = 'Pflegegrad 1'
    PFLEGEGRAD_2 = 'Pflegegrad 2'
    PFLEGEGRAD_3 = 'Pflegegrad 3'
    PFLEGEGRAD_4 = 'Pflegegrad 4'
    PFLEGEGRAD_5 = 'Pflegegrad 5'


class ChatMessageRoleType(str, enum.Enum):
    USER = 'user'
    ASSISTANT = 'assistant'
    SYSTEM = 'system'
    TOOL = 'tool'


class ConversationStatusType(str, enum.Enum):
    IN_PROGRESS = 'in_progress'
    CLOSED = 'closed'


class DisabilityMerkzeichenType(str, enum.Enum):
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


class DisplacedStatusType(str, enum.Enum):
    NONE = 'none'
    EXPELLEE__RESETTLER_ = 'Expellee (Resettler)'
    DISPLACED_PERSON__RESETTLER_ = 'Displaced Person (Resettler)'
    LATE_RESETTLER = 'Late Resettler'
    SPOUSE_OR_DESCENDANT_OF_A_LATE_RESETTLER = 'Spouse or Descendant of a Late Resettler'
    SOVIET_ZONE_REFUGEE = 'Soviet Zone Refugee'


class DocumentStatusType(str, enum.Enum):
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    READY_FOR_REVIEW = 'ready_for_review'
    VERIFIED = 'verified'


class ExpenseType(str, enum.Enum):
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


class GenderType(str, enum.Enum):
    MALE = 'Male'
    FEMALE = 'Female'
    DIVERSE = 'Diverse'


class HealthInsuranceStatusType(str, enum.Enum):
    COMPULSORY_INSURANCE = 'Compulsory Insurance'
    VOLUNTARY_INSURANCE = 'Voluntary Insurance'
    FAMILY_INSURANCE = 'Family Insurance'
    PRIVATE_INSURANCE = 'Private Insurance'
    CARE_BY_HEALTH_FUNDS_UNDER___264_SGB_V = 'Care by Health Funds under § 264 SGB V'


class IncomeType(str, enum.Enum):
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


class MaritalStatusType(str, enum.Enum):
    SINGLE = 'Single'
    MARRIED = 'Married'
    COHABITING = 'Cohabiting'
    PERMANENTLY_SEPARATED = 'Permanently Separated'
    REGISTERED_CIVIL_PARTNERSHIP = 'Registered Civil Partnership'
    DIVORCED = 'Divorced'
    WIDOWED = 'Widowed'


class SocialSecurityTypeType(str, enum.Enum):
    NONE = 'None'
    PENSION_INSURANCE = 'Pension Insurance'
    LONG_TERM_CARE_INSURANCE = 'Long-term Care Insurance'


class StatusType(str, enum.Enum):
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'
    SUBMITTED = 'submitted'


class TenancyStatusType(str, enum.Enum):
    MAIN_TENANT = 'Main Tenant'
    SUBTENANT = 'Subtenant'


class TutorialStatusType(str, enum.Enum):
    IN_PROGRESS = 'in_progress'
    COMPLETED = 'completed'


class BerlinAddresses(SQLModel, table=True):
    __tablename__ = 'berlin_addresses'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='berlin_addresses_pkey'),
        Index('idx_berlin_addresses_lookup', 'plz', 'street', 'hnr')
    )

    id: int = Field(sa_column=Column('id', BigInteger, primary_key=True, autoincrement=True))
    plz: str = Field(sa_column=Column('plz', Text, nullable=False))
    street: str = Field(sa_column=Column('street', Text, nullable=False))
    hnr: str = Field(sa_column=Column('hnr', Text, nullable=False))
    bez_name: str = Field(sa_column=Column('bez_name', Text, nullable=False))


class CmsTutorials(SQLModel, table=True):
    __tablename__ = 'cms_tutorials'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='cms_tutorials_pkey'),
        UniqueConstraint('slug', name='cms_tutorials_slug_key')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    slug: str = Field(sa_column=Column('slug', String(255), nullable=False))
    sort_order: int = Field(sa_column=Column('sort_order', Integer, nullable=False, server_default=text('0')))
    title: object = Field(sa_column=Column('title', JSONB, nullable=False, server_default=text("'{}'::jsonb")))
    content: object = Field(sa_column=Column('content', JSONB, nullable=False, server_default=text("'[]'::jsonb")))
    subtitle: object = Field(sa_column=Column('subtitle', JSONB, nullable=False, server_default=text("'{}'::jsonb")))
    created_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))

    user_tutorial_states: list['UserTutorialStates'] = Relationship(back_populates='tutorial')


class Migrations(SQLModel, table=True):
    __table_args__ = (
        PrimaryKeyConstraint('id', name='migrations_pkey'),
        UniqueConstraint('filename', name='migrations_filename_key')
    )

    id: int = Field(sa_column=Column('id', Integer, primary_key=True, autoincrement=True))
    filename: str = Field(sa_column=Column('filename', String(255), nullable=False))
    status: str = Field(sa_column=Column('status', String(50), nullable=False))
    applied_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('applied_at', DateTime, server_default=text('CURRENT_TIMESTAMP')))


class UploadedFiles(SQLModel, table=True):
    __tablename__ = 'uploaded_files'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='uploaded_files_pkey'),
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    name: str = Field(sa_column=Column('name', String(255), nullable=False))
    object_name: str = Field(sa_column=Column('object_name', String(1024), nullable=False))
    bucket_name: str = Field(sa_column=Column('bucket_name', String(1024), nullable=False))
    created_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))

    user_documents: list['UserDocuments'] = Relationship(back_populates='fk_file')


class Users(SQLModel, table=True):
    __table_args__ = (
        CheckConstraint('inpatient_facility_move_in_date IS NULL OR inpatient_facility_assigned_until IS NULL OR inpatient_facility_assigned_until >= inpatient_facility_move_in_date', name='users_facility_period'),
        PrimaryKeyConstraint('id', name='users_pkey'),
        UniqueConstraint('authentik_id', name='users_authentik_id_key'),
        UniqueConstraint('phone_number', name='users_phone_number_key')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    created_at: datetime.datetime = Field(sa_column=Column('created_at', DateTime(True), nullable=False, server_default=text('now()')))
    updated_at: datetime.datetime = Field(sa_column=Column('updated_at', DateTime(True), nullable=False, server_default=text('now()')))
    first_name: Optional[str] = Field(default=None, sa_column=Column('first_name', String(255)))
    last_name: Optional[str] = Field(default=None, sa_column=Column('last_name', String(255)))
    date_of_birth: Optional[datetime.date] = Field(default=None, sa_column=Column('date_of_birth', Date))
    place_of_birth: Optional[str] = Field(default=None, sa_column=Column('place_of_birth', String(255)))
    legal_gender: Optional[GenderType] = Field(default=None, sa_column=Column('legal_gender', Enum(GenderType, values_callable=lambda cls: [member.value for member in cls], name='gender_type')))
    marital_status: Optional[MaritalStatusType] = Field(default=None, sa_column=Column('marital_status', Enum(MaritalStatusType, values_callable=lambda cls: [member.value for member in cls], name='marital_status_type')))
    married_since: Optional[datetime.date] = Field(default=None, sa_column=Column('married_since', Date))
    is_german_citizen: Optional[bool] = Field(default=None, sa_column=Column('is_german_citizen', Boolean))
    is_resident_in_germany: Optional[bool] = Field(default=None, sa_column=Column('is_resident_in_germany', Boolean))
    has_guardian: Optional[bool] = Field(default=None, sa_column=Column('has_guardian', Boolean))
    has_custodian: Optional[bool] = Field(default=None, sa_column=Column('has_custodian', Boolean))
    displaced_status: Optional[DisplacedStatusType] = Field(default=None, sa_column=Column('displaced_status', Enum(DisplacedStatusType, values_callable=lambda cls: [member.value for member in cls], name='displaced_status_type')))
    displaced_issued_on: Optional[datetime.date] = Field(default=None, sa_column=Column('displaced_issued_on', Date))
    displaced_issued_by: Optional[str] = Field(default=None, sa_column=Column('displaced_issued_by', String(255)))
    social_security_type: Optional[SocialSecurityTypeType] = Field(default=None, sa_column=Column('social_security_type', Enum(SocialSecurityTypeType, values_callable=lambda cls: [member.value for member in cls], name='social_security_type_type')))
    health_insurance_provider: Optional[str] = Field(default=None, sa_column=Column('health_insurance_provider', String(255)))
    health_insurance_status: Optional[HealthInsuranceStatusType] = Field(default=None, sa_column=Column('health_insurance_status', Enum(HealthInsuranceStatusType, values_callable=lambda cls: [member.value for member in cls], name='health_insurance_status_type')))
    pension_insurance_provider: Optional[str] = Field(default=None, sa_column=Column('pension_insurance_provider', String(255)))
    pension_insurance_no: Optional[str] = Field(default=None, sa_column=Column('pension_insurance_no', String(255)))
    has_received_previous_benefits: Optional[bool] = Field(default=None, sa_column=Column('has_received_previous_benefits', Boolean))
    previous_benefits_authority: Optional[str] = Field(default=None, sa_column=Column('previous_benefits_authority', String(255)))
    previous_benefits_period: Optional[str] = Field(default=None, sa_column=Column('previous_benefits_period', String(255)))
    previous_benefits_ref_no: Optional[str] = Field(default=None, sa_column=Column('previous_benefits_ref_no', String(255)))
    has_applied_for_asylum_benefits: Optional[bool] = Field(default=None, sa_column=Column('has_applied_for_asylum_benefits', Boolean))
    is_currently_employed: Optional[bool] = Field(default=None, sa_column=Column('is_currently_employed', Boolean))
    ability_to_work: Optional[AbilityToWorkType] = Field(default=None, sa_column=Column('ability_to_work', Enum(AbilityToWorkType, values_callable=lambda cls: [member.value for member in cls], name='ability_to_work_type')))
    has_permanent_reduction_in_earning_capacity: Optional[bool] = Field(default=None, sa_column=Column('has_permanent_reduction_in_earning_capacity', Boolean))
    has_inpatient_facility_accommodation: Optional[bool] = Field(default=None, sa_column=Column('has_inpatient_facility_accommodation', Boolean))
    gave_away_assets_last_10_years: Optional[bool] = Field(default=None, sa_column=Column('gave_away_assets_last_10_years', Boolean))
    gross_negligence_last_10_years: Optional[bool] = Field(default=None, sa_column=Column('gross_negligence_last_10_years', Boolean))
    accomodation_type: Optional[AccomodationType] = Field(default=None, sa_column=Column('accomodation_type', Enum(AccomodationType, values_callable=lambda cls: [member.value for member in cls], name='accomodation_type')))
    tenancy_status: Optional[TenancyStatusType] = Field(default=None, sa_column=Column('tenancy_status', Enum(TenancyStatusType, values_callable=lambda cls: [member.value for member in cls], name='tenancy_status_type')))
    rent_total: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('rent_total', Numeric(10, 2)))
    hot_water_costs: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('hot_water_costs', Numeric(10, 2)))
    heating_costs: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('heating_costs', Numeric(10, 2)))
    cable_tv_costs: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('cable_tv_costs', Numeric(10, 2)))
    number_of_rooms: Optional[int] = Field(default=None, sa_column=Column('number_of_rooms', Integer))
    living_area: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('living_area', Numeric(10, 2)))
    persons_in_household_count: Optional[int] = Field(default=None, sa_column=Column('persons_in_household_count', Integer))
    bank_name: Optional[str] = Field(default=None, sa_column=Column('bank_name', String(255)))
    account_holder: Optional[str] = Field(default=None, sa_column=Column('account_holder', String(255)))
    iban: Optional[str] = Field(default=None, sa_column=Column('iban', String(50)))
    has_disability_id: Optional[bool] = Field(default=None, sa_column=Column('has_disability_id', Boolean))
    disability_valid_until: Optional[datetime.date] = Field(default=None, sa_column=Column('disability_valid_until', Date))
    merkzeichen: Optional[DisabilityMerkzeichenType] = Field(default=None, sa_column=Column('merkzeichen', Enum(DisabilityMerkzeichenType, values_callable=lambda cls: [member.value for member in cls], name='disability_merkzeichen_type')))
    disability_application_pending: Optional[bool] = Field(default=None, sa_column=Column('disability_application_pending', Boolean))
    phone_number: Optional[str] = Field(default=None, sa_column=Column('phone_number', String(32)))
    nationality: Optional[str] = Field(default=None, sa_column=Column('nationality', String(255)))
    second_nationality: Optional[str] = Field(default=None, sa_column=Column('second_nationality', String(255)))
    authentik_id: Optional[str] = Field(default=None, sa_column=Column('authentik_id', String(255)))
    fcm_token: Optional[str] = Field(default=None, sa_column=Column('fcm_token', String(512)))
    street: Optional[str] = Field(default=None, sa_column=Column('street', String(255)))
    house_number: Optional[str] = Field(default=None, sa_column=Column('house_number', String(20)))
    zip_code: Optional[str] = Field(default=None, sa_column=Column('zip_code', String(10)))
    city: Optional[str] = Field(default=None, sa_column=Column('city', String(255)))
    state: Optional[str] = Field(default=None, sa_column=Column('state', String(255)))
    birth_name: Optional[str] = Field(default=None, sa_column=Column('birth_name', String(255)))
    residence_status: Optional[str] = Field(default=None, sa_column=Column('residence_status', String(255)))
    identification_numbers: Optional[str] = Field(default=None, sa_column=Column('identification_numbers', String(255)))
    tax_id: Optional[str] = Field(default=None, sa_column=Column('tax_id', String(255)))
    district: Optional[str] = Field(default=None, sa_column=Column('district', String(255)))
    monthly_income: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('monthly_income', Numeric(10, 2)))
    has_assets: Optional[bool] = Field(default=None, sa_column=Column('has_assets', Boolean))
    assets_description: Optional[str] = Field(default=None, sa_column=Column('assets_description', Text))
    has_costly_medical_nutrition: Optional[bool] = Field(default=None, sa_column=Column('has_costly_medical_nutrition', Boolean))
    has_applied_for_benefits_awaiting_decision: Optional[bool] = Field(default=None, sa_column=Column('has_applied_for_benefits_awaiting_decision', Boolean))
    benefits_awaiting_decision_type: Optional[str] = Field(default=None, sa_column=Column('benefits_awaiting_decision_type', String(255), server_default=text('NULL::character varying')))
    benefits_awaiting_decision_application_date: Optional[datetime.date] = Field(default=None, sa_column=Column('benefits_awaiting_decision_application_date', Date))
    benefits_awaiting_decision_office: Optional[str] = Field(default=None, sa_column=Column('benefits_awaiting_decision_office', String(255), server_default=text('NULL::character varying')))
    benefits_awaiting_decision_reference: Optional[str] = Field(default=None, sa_column=Column('benefits_awaiting_decision_reference', String(255), server_default=text('NULL::character varying')))
    are_one_time_payments_expected: Optional[bool] = Field(default=None, sa_column=Column('are_one_time_payments_expected', Boolean))
    one_time_payments_expected_type: Optional[str] = Field(default=None, sa_column=Column('one_time_payments_expected_type', String(255), server_default=text('NULL::character varying')))
    one_time_payments_expected_amount: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('one_time_payments_expected_amount', Numeric(10, 2), server_default=text('NULL::numeric')))
    one_time_payments_expected_date: Optional[datetime.date] = Field(default=None, sa_column=Column('one_time_payments_expected_date', Date))
    bic: Optional[str] = Field(default=None, sa_column=Column('bic', String(11), server_default=text('NULL::character varying')))
    sublet_room_count: Optional[int] = Field(default=None, sa_column=Column('sublet_room_count', Integer))
    sublet_rent_income: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('sublet_rent_income', Numeric(10, 2), server_default=text('NULL::numeric')))
    rent_paid_until: Optional[datetime.date] = Field(default=None, sa_column=Column('rent_paid_until', Date))
    landlord_name: Optional[str] = Field(default=None, sa_column=Column('landlord_name', String(255), server_default=text('NULL::character varying')))
    heating_type: Optional[str] = Field(default=None, sa_column=Column('heating_type', String(255), server_default=text('NULL::character varying')))
    free_housing_right_holder: Optional[str] = Field(default=None, sa_column=Column('free_housing_right_holder', String(255), server_default=text('NULL::character varying')))
    is_care_dependent: Optional[bool] = Field(default=None, sa_column=Column('is_care_dependent', Boolean))
    inpatient_facility_move_in_date: Optional[datetime.date] = Field(default=None, sa_column=Column('inpatient_facility_move_in_date', Date))
    inpatient_facility_last_residence: Optional[str] = Field(default=None, sa_column=Column('inpatient_facility_last_residence', String(255)))
    reduced_work_capacity_start_date: Optional[datetime.date] = Field(default=None, sa_column=Column('reduced_work_capacity_start_date', Date))
    reduced_work_capacity_end_date: Optional[datetime.date] = Field(default=None, sa_column=Column('reduced_work_capacity_end_date', Date))
    reduced_work_capacity_reason: Optional[str] = Field(default=None, sa_column=Column('reduced_work_capacity_reason', Text))
    email: Optional[str] = Field(default=None, sa_column=Column('email', String(255)))
    license_plate: Optional[str] = Field(default=None, sa_column=Column('license_plate', String(20)))
    is_student_or_trainee: Optional[bool] = Field(default=None, sa_column=Column('is_student_or_trainee', Boolean))
    professional_expenses: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('professional_expenses', Numeric(10, 2)))
    has_childcare_expenses: Optional[bool] = Field(default=None, sa_column=Column('has_childcare_expenses', Boolean))
    is_subsidized_housing: Optional[bool] = Field(default=None, sa_column=Column('is_subsidized_housing', Boolean))
    has_other_residence: Optional[bool] = Field(default=None, sa_column=Column('has_other_residence', Boolean))
    has_secondary_residence: Optional[bool] = Field(default=None, sa_column=Column('has_secondary_residence', Boolean))
    has_garage_costs: Optional[bool] = Field(default=None, sa_column=Column('has_garage_costs', Boolean))
    garage_costs: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('garage_costs', Numeric(10, 2)))
    has_household_energy_costs: Optional[bool] = Field(default=None, sa_column=Column('has_household_energy_costs', Boolean))
    household_energy_costs: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('household_energy_costs', Numeric(10, 2)))
    is_living_area_used_commercially: Optional[bool] = Field(default=None, sa_column=Column('is_living_area_used_commercially', Boolean))
    commercially_used_area_sqm: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('commercially_used_area_sqm', Numeric(10, 2)))
    is_victim_of_national_socialist_persecution: Optional[bool] = Field(default=None, sa_column=Column('is_victim_of_national_socialist_persecution', Boolean))
    is_wohngeld_first_application: Optional[bool] = Field(default=None, sa_column=Column('is_wohngeld_first_application', Boolean))
    receives_wohngeld_for_other_dwelling: Optional[bool] = Field(default=None, sa_column=Column('receives_wohngeld_for_other_dwelling', Boolean))
    household_member_died_recently: Optional[bool] = Field(default=None, sa_column=Column('household_member_died_recently', Boolean))
    household_size_will_change: Optional[bool] = Field(default=None, sa_column=Column('household_size_will_change', Boolean))
    receives_other_transfer_benefits: Optional[bool] = Field(default=None, sa_column=Column('receives_other_transfer_benefits', Boolean))
    pays_child_or_spousal_support: Optional[bool] = Field(default=None, sa_column=Column('pays_child_or_spousal_support', Boolean))
    receives_support_from_others: Optional[bool] = Field(default=None, sa_column=Column('receives_support_from_others', Boolean))
    expects_future_income_change: Optional[bool] = Field(default=None, sa_column=Column('expects_future_income_change', Boolean))
    assets_exceed_wohngeld_threshold: Optional[bool] = Field(default=None, sa_column=Column('assets_exceed_wohngeld_threshold', Boolean))
    related_to_landlord: Optional[bool] = Field(default=None, sa_column=Column('related_to_landlord', Boolean))
    service_costs_included_in_rent: Optional[bool] = Field(default=None, sa_column=Column('service_costs_included_in_rent', Boolean))
    rent_paid_partly_by_third_party: Optional[bool] = Field(default=None, sa_column=Column('rent_paid_partly_by_third_party', Boolean))
    receives_rent_contribution_from_others: Optional[bool] = Field(default=None, sa_column=Column('receives_rent_contribution_from_others', Boolean))
    expects_rent_change: Optional[bool] = Field(default=None, sa_column=Column('expects_rent_change', Boolean))
    wohngeld_payment_to_applicant: Optional[bool] = Field(default=None, sa_column=Column('wohngeld_payment_to_applicant', Boolean))
    consents_to_bank_statement_retention: Optional[bool] = Field(default=None, sa_column=Column('consents_to_bank_statement_retention', Boolean))
    consents_to_registry_verification: Optional[bool] = Field(default=None, sa_column=Column('consents_to_registry_verification', Boolean))
    demo_seed_fixture_hash: Optional[str] = Field(default=None, sa_column=Column('demo_seed_fixture_hash', String(64)))
    apartment_floor_location: Optional[str] = Field(default=None, sa_column=Column('apartment_floor_location', String(255)))
    resident_in_berlin_since: Optional[datetime.date] = Field(default=None, sa_column=Column('resident_in_berlin_since', Date))
    resident_in_district_since: Optional[datetime.date] = Field(default=None, sa_column=Column('resident_in_district_since', Date))
    previous_address: Optional[str] = Field(default=None, sa_column=Column('previous_address', String(255)))
    rent_arrears_period: Optional[str] = Field(default=None, sa_column=Column('rent_arrears_period', String(255)))
    rent_arrears_amount: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('rent_arrears_amount', MONEY_NONNEG))
    tenancy_terminated_on: Optional[datetime.date] = Field(default=None, sa_column=Column('tenancy_terminated_on', Date))
    sublet_unrentable_reason: Optional[str] = Field(default=None, sa_column=Column('sublet_unrentable_reason', String(255)))
    inpatient_facility_assigned_until: Optional[datetime.date] = Field(default=None, sa_column=Column('inpatient_facility_assigned_until', Date))
    care_level: Optional[CareLevelType] = Field(default=None, sa_column=Column('care_level', Enum(CareLevelType, values_callable=lambda cls: [member.value for member in cls], name='care_level_type')))
    can_work_at_least_3h_daily: Optional[bool] = Field(default=None, sa_column=Column('can_work_at_least_3h_daily', Boolean))
    work_scope_and_type: Optional[str] = Field(default=None, sa_column=Column('work_scope_and_type', String(255)))
    employer_name: Optional[str] = Field(default=None, sa_column=Column('employer_name', String(255)))
    education_or_study_subject: Optional[str] = Field(default=None, sa_column=Column('education_or_study_subject', String(255)))
    employment_office_customer_number: Optional[str] = Field(default=None, sa_column=Column('employment_office_customer_number', String(255)))
    commute_distance_km: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('commute_distance_km', Numeric(10, 2)))
    has_child_with_substantial_income: Optional[bool] = Field(default=None, sa_column=Column('has_child_with_substantial_income', Boolean))
    have_parents_substantial_joint_income: Optional[bool] = Field(default=None, sa_column=Column('have_parents_substantial_joint_income', Boolean))
    monthly_expenses_total: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('monthly_expenses_total', MONEY_NONNEG))
    landlord_address: Optional[str] = Field(default=None, sa_column=Column('landlord_address', String(255)))
    main_tenant_name: Optional[str] = Field(default=None, sa_column=Column('main_tenant_name', String(255)))
    vehicle_make: Optional[str] = Field(default=None, sa_column=Column('vehicle_make', String(255)))
    vehicle_year: Optional[str] = Field(default=None, sa_column=Column('vehicle_year', String(4)))
    azr_number: Optional[str] = Field(default=None, sa_column=Column('azr_number', String(12)))
    has_unavoidable_special_need: Optional[bool] = Field(default=None, sa_column=Column('has_unavoidable_special_need', Boolean))
    was_self_employed_last_5_years: Optional[bool] = Field(default=None, sa_column=Column('was_self_employed_last_5_years', Boolean))
    received_wage_replacement_last_5_years: Optional[bool] = Field(default=None, sa_column=Column('received_wage_replacement_last_5_years', Boolean))
    did_military_or_voluntary_service_last_5_years: Optional[bool] = Field(default=None, sa_column=Column('did_military_or_voluntary_service_last_5_years', Boolean))
    cared_for_relatives_last_5_years: Optional[bool] = Field(default=None, sa_column=Column('cared_for_relatives_last_5_years', Boolean))

    associated_persons: list['AssociatedPersons'] = Relationship(back_populates='user')
    conversations: list['Conversations'] = Relationship(back_populates='fk_user')
    user_applications: list['UserApplications'] = Relationship(back_populates='fk_user')
    user_tutorial_states: list['UserTutorialStates'] = Relationship(back_populates='user')
    asset_entries: list['AssetEntries'] = Relationship(back_populates='user')
    benefit_claim_entries: list['BenefitClaimEntries'] = Relationship(back_populates='user')
    expense_entries: list['ExpenseEntries'] = Relationship(back_populates='user')
    income_entries: list['IncomeEntries'] = Relationship(back_populates='user')
    user_documents: list['UserDocuments'] = Relationship(back_populates='fk_user')


class AssociatedPersons(SQLModel, table=True):
    __tablename__ = 'associated_persons'
    __table_args__ = (
        CheckConstraint("date_of_birth IS NULL OR date_of_birth >= '1900-01-01'::date AND date_of_birth <= CURRENT_DATE", name='associated_persons_dob_plausible'),
        CheckConstraint('inpatient_facility_assigned_from IS NULL OR inpatient_facility_assigned_until IS NULL OR inpatient_facility_assigned_until >= inpatient_facility_assigned_from', name='associated_persons_facility_period'),
        CheckConstraint('reduced_work_capacity_start_date IS NULL OR reduced_work_capacity_end_date IS NULL OR reduced_work_capacity_end_date >= reduced_work_capacity_start_date', name='associated_persons_work_capacity_period'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='associated_persons_user_id_fkey'),
        PrimaryKeyConstraint('id', name='associated_persons_pkey'),
        Index('associated_persons_user_id_idx', 'user_id', 'sort_order')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    user_id: uuid.UUID = Field(sa_column=Column('user_id', Uuid, nullable=False))
    association_type: AssociationType = Field(sa_column=Column('association_type', Enum(AssociationType, values_callable=lambda cls: [member.value for member in cls], name='association_type'), nullable=False))
    lives_in_household: bool = Field(sa_column=Column('lives_in_household', Boolean, nullable=False, server_default=text('true')))
    sort_order: int = Field(sa_column=Column('sort_order', Integer, nullable=False, server_default=text('0')))
    created_at: datetime.datetime = Field(sa_column=Column('created_at', DateTime(True), nullable=False, server_default=text('now()')))
    updated_at: datetime.datetime = Field(sa_column=Column('updated_at', DateTime(True), nullable=False, server_default=text('now()')))
    first_name: Optional[str] = Field(default=None, sa_column=Column('first_name', String(255)))
    last_name: Optional[str] = Field(default=None, sa_column=Column('last_name', String(255)))
    birth_name: Optional[str] = Field(default=None, sa_column=Column('birth_name', String(255)))
    date_of_birth: Optional[datetime.date] = Field(default=None, sa_column=Column('date_of_birth', Date))
    place_of_birth: Optional[str] = Field(default=None, sa_column=Column('place_of_birth', String(255)))
    legal_gender: Optional[GenderType] = Field(default=None, sa_column=Column('legal_gender', Enum(GenderType, values_callable=lambda cls: [member.value for member in cls], name='gender_type')))
    marital_status: Optional[MaritalStatusType] = Field(default=None, sa_column=Column('marital_status', Enum(MaritalStatusType, values_callable=lambda cls: [member.value for member in cls], name='marital_status_type')))
    nationality: Optional[str] = Field(default=None, sa_column=Column('nationality', ISO_COUNTRY))
    second_nationality: Optional[str] = Field(default=None, sa_column=Column('second_nationality', ISO_COUNTRY))
    relationship_to_applicant: Optional[str] = Field(default=None, sa_column=Column('relationship_to_applicant', String(255)))
    employment_status: Optional[str] = Field(default=None, sa_column=Column('employment_status', String(255)))
    monthly_income: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('monthly_income', MONEY_NONNEG))
    monthly_pension_income: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('monthly_pension_income', MONEY_NONNEG))
    has_own_income: Optional[bool] = Field(default=None, sa_column=Column('has_own_income', Boolean))
    is_alimony_obligated: Optional[bool] = Field(default=None, sa_column=Column('is_alimony_obligated', Boolean))
    is_german_citizen: Optional[bool] = Field(default=None, sa_column=Column('is_german_citizen', Boolean))
    id_document_issuing_authority: Optional[str] = Field(default=None, sa_column=Column('id_document_issuing_authority', String(255)))
    id_document_valid_until: Optional[datetime.date] = Field(default=None, sa_column=Column('id_document_valid_until', Date))
    has_guardian: Optional[bool] = Field(default=None, sa_column=Column('has_guardian', Boolean))
    has_custodian: Optional[bool] = Field(default=None, sa_column=Column('has_custodian', Boolean))
    displaced_status: Optional[DisplacedStatusType] = Field(default=None, sa_column=Column('displaced_status', Enum(DisplacedStatusType, values_callable=lambda cls: [member.value for member in cls], name='displaced_status_type')))
    displaced_issued_on: Optional[datetime.date] = Field(default=None, sa_column=Column('displaced_issued_on', Date))
    displaced_issued_by: Optional[str] = Field(default=None, sa_column=Column('displaced_issued_by', String(255)))
    has_received_previous_benefits: Optional[bool] = Field(default=None, sa_column=Column('has_received_previous_benefits', Boolean))
    previous_benefits_authority: Optional[str] = Field(default=None, sa_column=Column('previous_benefits_authority', String(255)))
    previous_benefits_period: Optional[str] = Field(default=None, sa_column=Column('previous_benefits_period', String(255)))
    previous_benefits_ref_no: Optional[str] = Field(default=None, sa_column=Column('previous_benefits_ref_no', String(255)))
    has_disability_id: Optional[bool] = Field(default=None, sa_column=Column('has_disability_id', Boolean))
    disability_valid_until: Optional[datetime.date] = Field(default=None, sa_column=Column('disability_valid_until', Date))
    merkzeichen: Optional[DisabilityMerkzeichenType] = Field(default=None, sa_column=Column('merkzeichen', Enum(DisabilityMerkzeichenType, values_callable=lambda cls: [member.value for member in cls], name='disability_merkzeichen_type')))
    disability_application_pending: Optional[bool] = Field(default=None, sa_column=Column('disability_application_pending', Boolean))
    social_security_type: Optional[SocialSecurityTypeType] = Field(default=None, sa_column=Column('social_security_type', Enum(SocialSecurityTypeType, values_callable=lambda cls: [member.value for member in cls], name='social_security_type_type')))
    health_insurance_provider: Optional[str] = Field(default=None, sa_column=Column('health_insurance_provider', String(255)))
    health_insurance_status: Optional[HealthInsuranceStatusType] = Field(default=None, sa_column=Column('health_insurance_status', Enum(HealthInsuranceStatusType, values_callable=lambda cls: [member.value for member in cls], name='health_insurance_status_type')))
    pension_insurance_provider: Optional[str] = Field(default=None, sa_column=Column('pension_insurance_provider', String(255)))
    pension_insurance_no: Optional[str] = Field(default=None, sa_column=Column('pension_insurance_no', String(255)))
    is_care_dependent: Optional[bool] = Field(default=None, sa_column=Column('is_care_dependent', Boolean))
    care_level: Optional[CareLevelType] = Field(default=None, sa_column=Column('care_level', Enum(CareLevelType, values_callable=lambda cls: [member.value for member in cls], name='care_level_type')))
    has_inpatient_facility_accommodation: Optional[bool] = Field(default=None, sa_column=Column('has_inpatient_facility_accommodation', Boolean))
    inpatient_facility_assigned_from: Optional[datetime.date] = Field(default=None, sa_column=Column('inpatient_facility_assigned_from', Date))
    inpatient_facility_assigned_until: Optional[datetime.date] = Field(default=None, sa_column=Column('inpatient_facility_assigned_until', Date))
    inpatient_facility_last_residence: Optional[str] = Field(default=None, sa_column=Column('inpatient_facility_last_residence', String(255)))
    has_permanent_reduction_in_earning_capacity: Optional[bool] = Field(default=None, sa_column=Column('has_permanent_reduction_in_earning_capacity', Boolean))
    reduced_work_capacity_is_permanent: Optional[bool] = Field(default=None, sa_column=Column('reduced_work_capacity_is_permanent', Boolean))
    reduced_work_capacity_start_date: Optional[datetime.date] = Field(default=None, sa_column=Column('reduced_work_capacity_start_date', Date))
    reduced_work_capacity_end_date: Optional[datetime.date] = Field(default=None, sa_column=Column('reduced_work_capacity_end_date', Date))
    reduced_work_capacity_reason: Optional[str] = Field(default=None, sa_column=Column('reduced_work_capacity_reason', Text))
    can_work_at_least_3h_daily: Optional[bool] = Field(default=None, sa_column=Column('can_work_at_least_3h_daily', Boolean))
    work_scope_and_type: Optional[str] = Field(default=None, sa_column=Column('work_scope_and_type', String(255)))
    employer_name: Optional[str] = Field(default=None, sa_column=Column('employer_name', String(255)))
    is_student_or_trainee: Optional[bool] = Field(default=None, sa_column=Column('is_student_or_trainee', Boolean))
    education_or_study_subject: Optional[str] = Field(default=None, sa_column=Column('education_or_study_subject', String(255)))
    employment_office_customer_number: Optional[str] = Field(default=None, sa_column=Column('employment_office_customer_number', String(255)))
    commute_distance_km: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('commute_distance_km', Numeric(10, 2)))
    has_applied_for_sgb2_benefits: Optional[bool] = Field(default=None, sa_column=Column('has_applied_for_sgb2_benefits', Boolean))
    has_applied_for_asylum_benefits: Optional[bool] = Field(default=None, sa_column=Column('has_applied_for_asylum_benefits', Boolean))
    has_child_with_substantial_income: Optional[bool] = Field(default=None, sa_column=Column('has_child_with_substantial_income', Boolean))
    have_parents_substantial_joint_income: Optional[bool] = Field(default=None, sa_column=Column('have_parents_substantial_joint_income', Boolean))
    monthly_expenses_total: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('monthly_expenses_total', MONEY_NONNEG))

    user: 'Users' = Relationship(back_populates='associated_persons')
    asset_entries: list['AssetEntries'] = Relationship(back_populates='person')
    benefit_claim_entries: list['BenefitClaimEntries'] = Relationship(back_populates='person')
    expense_entries: list['ExpenseEntries'] = Relationship(back_populates='person')
    income_entries: list['IncomeEntries'] = Relationship(back_populates='person')


class Conversations(SQLModel, table=True):
    __table_args__ = (
        ForeignKeyConstraint(['fk_user_id'], ['users.id'], ondelete='CASCADE', name='conversations_fk_user_id_fkey'),
        PrimaryKeyConstraint('id', name='conversations_pkey')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    fk_user_id: uuid.UUID = Field(sa_column=Column('fk_user_id', Uuid, nullable=False))
    status: ConversationStatusType = Field(sa_column=Column('status', Enum(ConversationStatusType, values_callable=lambda cls: [member.value for member in cls], name='conversation_status_type'), nullable=False, server_default=text("'in_progress'::conversation_status_type")))
    application_type: Optional[str] = Field(default=None, sa_column=Column('application_type', String(255)))
    created_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))

    fk_user: 'Users' = Relationship(back_populates='conversations')
    conversation_messages: list['ConversationMessages'] = Relationship(back_populates='fk_conversation')


class UserApplications(SQLModel, table=True):
    __tablename__ = 'user_applications'
    __table_args__ = (
        ForeignKeyConstraint(['fk_user_id'], ['users.id'], ondelete='CASCADE', name='user_applications_fk_user_id_fkey'),
        PrimaryKeyConstraint('application_id', name='user_applications_pkey')
    )

    application_id: uuid.UUID = Field(sa_column=Column('application_id', Uuid, primary_key=True))
    fk_user_id: uuid.UUID = Field(sa_column=Column('fk_user_id', Uuid, nullable=False))
    form_type: str = Field(sa_column=Column('form_type', String(255), nullable=False))
    status: Optional[StatusType] = Field(default=None, sa_column=Column('status', Enum(StatusType, values_callable=lambda cls: [member.value for member in cls], name='status_type'), server_default=text("'in_progress'::status_type")))
    form_data: Optional[object] = Field(default=None, sa_column=Column('form_data', JSONB, server_default=text("'{}'::jsonb")))
    created_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    last_reminded_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('last_reminded_at', DateTime(True)))

    fk_user: 'Users' = Relationship(back_populates='user_applications')
    user_documents: list['UserDocuments'] = Relationship(back_populates='fk_application')


class UserTutorialStates(SQLModel, table=True):
    __tablename__ = 'user_tutorial_states'
    __table_args__ = (
        ForeignKeyConstraint(['tutorial_id'], ['cms_tutorials.id'], ondelete='CASCADE', name='user_tutorial_states_tutorial_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='user_tutorial_states_user_id_fkey'),
        PrimaryKeyConstraint('user_id', 'tutorial_id', name='user_tutorial_states_pkey')
    )

    user_id: uuid.UUID = Field(sa_column=Column('user_id', Uuid, primary_key=True))
    tutorial_id: uuid.UUID = Field(sa_column=Column('tutorial_id', Uuid, primary_key=True))
    status: TutorialStatusType = Field(sa_column=Column('status', Enum(TutorialStatusType, values_callable=lambda cls: [member.value for member in cls], name='tutorial_status_type'), nullable=False, server_default=text("'in_progress'::tutorial_status_type")))
    current_step: Optional[str] = Field(default=None, sa_column=Column('current_step', String(255)))
    updated_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))

    tutorial: 'CmsTutorials' = Relationship(back_populates='user_tutorial_states')
    user: 'Users' = Relationship(back_populates='user_tutorial_states')


class AssetEntries(SQLModel, table=True):
    __tablename__ = 'asset_entries'
    __table_args__ = (
        ForeignKeyConstraint(['person_id'], ['associated_persons.id'], ondelete='CASCADE', name='asset_entries_person_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='asset_entries_user_id_fkey'),
        PrimaryKeyConstraint('id', name='asset_entries_pkey'),
        Index('asset_entries_applicant_type_idx', 'user_id', 'asset_type', postgresql_where='(person_id IS NULL)', unique=True),
        Index('asset_entries_person_type_idx', 'person_id', 'asset_type', postgresql_where='(person_id IS NOT NULL)', unique=True),
        Index('asset_entries_user_id_idx', 'user_id')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    user_id: uuid.UUID = Field(sa_column=Column('user_id', Uuid, nullable=False))
    asset_type: AssetType = Field(sa_column=Column('asset_type', Enum(AssetType, values_callable=lambda cls: [member.value for member in cls], name='asset_type'), nullable=False))
    created_at: datetime.datetime = Field(sa_column=Column('created_at', DateTime(True), nullable=False, server_default=text('now()')))
    updated_at: datetime.datetime = Field(sa_column=Column('updated_at', DateTime(True), nullable=False, server_default=text('now()')))
    person_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('person_id', Uuid))
    amount: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('amount', MONEY_NONNEG))
    description: Optional[str] = Field(default=None, sa_column=Column('description', Text))

    person: Optional['AssociatedPersons'] = Relationship(back_populates='asset_entries')
    user: 'Users' = Relationship(back_populates='asset_entries')


class BenefitClaimEntries(SQLModel, table=True):
    __tablename__ = 'benefit_claim_entries'
    __table_args__ = (
        ForeignKeyConstraint(['person_id'], ['associated_persons.id'], ondelete='CASCADE', name='benefit_claim_entries_person_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='benefit_claim_entries_user_id_fkey'),
        PrimaryKeyConstraint('id', name='benefit_claim_entries_pkey'),
        Index('benefit_claim_entries_lookup_idx', 'user_id', 'claim_kind', 'sort_order')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    user_id: uuid.UUID = Field(sa_column=Column('user_id', Uuid, nullable=False))
    claim_kind: BenefitClaimKind = Field(sa_column=Column('claim_kind', Enum(BenefitClaimKind, values_callable=lambda cls: [member.value for member in cls], name='benefit_claim_kind'), nullable=False))
    sort_order: int = Field(sa_column=Column('sort_order', Integer, nullable=False, server_default=text('0')))
    created_at: datetime.datetime = Field(sa_column=Column('created_at', DateTime(True), nullable=False, server_default=text('now()')))
    updated_at: datetime.datetime = Field(sa_column=Column('updated_at', DateTime(True), nullable=False, server_default=text('now()')))
    person_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('person_id', Uuid))
    benefit_type: Optional[str] = Field(default=None, sa_column=Column('benefit_type', String(255)))
    event_date: Optional[datetime.date] = Field(default=None, sa_column=Column('event_date', Date))
    amount: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('amount', MONEY_NONNEG))
    office_reference: Optional[str] = Field(default=None, sa_column=Column('office_reference', String(255)))

    person: Optional['AssociatedPersons'] = Relationship(back_populates='benefit_claim_entries')
    user: 'Users' = Relationship(back_populates='benefit_claim_entries')


class ConversationMessages(SQLModel, table=True):
    __tablename__ = 'conversation_messages'
    __table_args__ = (
        ForeignKeyConstraint(['fk_conversation_id'], ['conversations.id'], ondelete='CASCADE', name='conversation_messages_fk_conversation_id_fkey'),
        PrimaryKeyConstraint('id', name='conversation_messages_pkey'),
        Index('idx_messages_conversation_created', 'fk_conversation_id', 'created_at')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    fk_conversation_id: uuid.UUID = Field(sa_column=Column('fk_conversation_id', Uuid, nullable=False))
    message_role: ChatMessageRoleType = Field(sa_column=Column('message_role', Enum(ChatMessageRoleType, values_callable=lambda cls: [member.value for member in cls], name='chat_message_role_type'), nullable=False))
    content: Optional[str] = Field(default=None, sa_column=Column('content', Text))
    message_metadata: Optional[object] = Field(default=None, sa_column=Column('message_metadata', JSONB, server_default=text("'{}'::jsonb")))
    created_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))

    fk_conversation: 'Conversations' = Relationship(back_populates='conversation_messages')


class ExpenseEntries(SQLModel, table=True):
    __tablename__ = 'expense_entries'
    __table_args__ = (
        ForeignKeyConstraint(['person_id'], ['associated_persons.id'], ondelete='CASCADE', name='expense_entries_person_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='expense_entries_user_id_fkey'),
        PrimaryKeyConstraint('id', name='expense_entries_pkey'),
        Index('expense_entries_applicant_type_idx', 'user_id', 'expense_type', postgresql_where='(person_id IS NULL)', unique=True),
        Index('expense_entries_person_type_idx', 'person_id', 'expense_type', postgresql_where='(person_id IS NOT NULL)', unique=True),
        Index('expense_entries_user_id_idx', 'user_id')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    user_id: uuid.UUID = Field(sa_column=Column('user_id', Uuid, nullable=False))
    expense_type: ExpenseType = Field(sa_column=Column('expense_type', Enum(ExpenseType, values_callable=lambda cls: [member.value for member in cls], name='expense_type'), nullable=False))
    created_at: datetime.datetime = Field(sa_column=Column('created_at', DateTime(True), nullable=False, server_default=text('now()')))
    updated_at: datetime.datetime = Field(sa_column=Column('updated_at', DateTime(True), nullable=False, server_default=text('now()')))
    person_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('person_id', Uuid))
    monthly_amount: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('monthly_amount', MONEY_NONNEG))
    note: Optional[str] = Field(default=None, sa_column=Column('note', String(255)))

    person: Optional['AssociatedPersons'] = Relationship(back_populates='expense_entries')
    user: 'Users' = Relationship(back_populates='expense_entries')


class IncomeEntries(SQLModel, table=True):
    __tablename__ = 'income_entries'
    __table_args__ = (
        ForeignKeyConstraint(['person_id'], ['associated_persons.id'], ondelete='CASCADE', name='income_entries_person_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='income_entries_user_id_fkey'),
        PrimaryKeyConstraint('id', name='income_entries_pkey'),
        Index('income_entries_applicant_type_idx', 'user_id', 'income_type', postgresql_where='(person_id IS NULL)', unique=True),
        Index('income_entries_person_type_idx', 'person_id', 'income_type', postgresql_where='(person_id IS NOT NULL)', unique=True),
        Index('income_entries_user_id_idx', 'user_id')
    )

    id: uuid.UUID = Field(sa_column=Column('id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    user_id: uuid.UUID = Field(sa_column=Column('user_id', Uuid, nullable=False))
    income_type: IncomeType = Field(sa_column=Column('income_type', Enum(IncomeType, values_callable=lambda cls: [member.value for member in cls], name='income_type'), nullable=False))
    created_at: datetime.datetime = Field(sa_column=Column('created_at', DateTime(True), nullable=False, server_default=text('now()')))
    updated_at: datetime.datetime = Field(sa_column=Column('updated_at', DateTime(True), nullable=False, server_default=text('now()')))
    person_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('person_id', Uuid))
    monthly_amount: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('monthly_amount', MONEY_NONNEG))
    awarding_office: Optional[str] = Field(default=None, sa_column=Column('awarding_office', String(255)))
    reference_no: Optional[str] = Field(default=None, sa_column=Column('reference_no', String(255)))

    person: Optional['AssociatedPersons'] = Relationship(back_populates='income_entries')
    user: 'Users' = Relationship(back_populates='income_entries')


class UserDocuments(SQLModel, table=True):
    __tablename__ = 'user_documents'
    __table_args__ = (
        ForeignKeyConstraint(['fk_application_id'], ['user_applications.application_id'], ondelete='CASCADE', name='user_documents_fk_application_id_fkey'),
        ForeignKeyConstraint(['fk_file_id'], ['uploaded_files.id'], ondelete='RESTRICT', name='user_documents_fk_file_id_fkey'),
        ForeignKeyConstraint(['fk_user_id'], ['users.id'], ondelete='CASCADE', name='user_documents_fk_user_id_fkey'),
        PrimaryKeyConstraint('document_id', name='user_documents_pkey')
    )

    document_id: uuid.UUID = Field(sa_column=Column('document_id', Uuid, primary_key=True, server_default=text('gen_random_uuid()')))
    fk_user_id: uuid.UUID = Field(sa_column=Column('fk_user_id', Uuid, nullable=False))
    fk_application_id: uuid.UUID = Field(sa_column=Column('fk_application_id', Uuid, nullable=False))
    document_type: str = Field(sa_column=Column('document_type', String(255), nullable=False))
    status: DocumentStatusType = Field(sa_column=Column('status', Enum(DocumentStatusType, values_callable=lambda cls: [member.value for member in cls], name='document_status_type'), nullable=False, server_default=text("'processing'::document_status_type")))
    confidence_score: Optional[decimal.Decimal] = Field(default=None, sa_column=Column('confidence_score', Numeric(10, 2)))
    created_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('created_at', DateTime(True), server_default=text('now()')))
    updated_at: Optional[datetime.datetime] = Field(default=None, sa_column=Column('updated_at', DateTime(True), server_default=text('now()')))
    fk_file_id: Optional[uuid.UUID] = Field(default=None, sa_column=Column('fk_file_id', Uuid))
    raw_data: Optional[object] = Field(default=None, sa_column=Column('raw_data', JSONB))
    user_error_code: Optional[str] = Field(default=None, sa_column=Column('user_error_code', String(255)))
    internal_error_log: Optional[str] = Field(default=None, sa_column=Column('internal_error_log', Text))

    fk_application: 'UserApplications' = Relationship(back_populates='user_documents')
    fk_file: Optional['UploadedFiles'] = Relationship(back_populates='user_documents')
    fk_user: 'Users' = Relationship(back_populates='user_documents')
