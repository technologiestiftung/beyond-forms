"""baseline

Schema and tutorial seed data produced by the SQL files in /migrations
(20260216 through 20261029), dumped with pg_dump. Databases that already ran
those files are stamped with `alembic stamp head`, not upgraded.

Revision ID: 61799c06a530
Revises:
Create Date: 2026-11-13 16:03:57.145272

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '61799c06a530'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMA = r"""
CREATE TYPE public.ability_to_work_type AS ENUM (
    'Fully able',
    'Temporarily disabled',
    'Permanently disabled'
);

CREATE TYPE public.accomodation_type AS ENUM (
    'Rental Apartment',
    'Own Home',
    'Condominium',
    'Relative',
    'Shared Household'
);

CREATE TYPE public.asset_type AS ENUM (
    'Savings and Cash',
    'Securities',
    'Valuables',
    'Gifted Assets',
    'Motor Vehicle',
    'Real Estate',
    'Subsidised Private Pension',
    'Transfer Contract Claims',
    'Other Assets'
);

CREATE TYPE public.association_type AS ENUM (
    'Spouse',
    'Registered Partner',
    'Cohabiting Partner',
    'Child',
    'Parent',
    'Other Relative',
    'Other'
);

CREATE TYPE public.benefit_claim_kind AS ENUM (
    'Pending Application',
    'Expected One-Time Payment'
);

CREATE TYPE public.care_level_type AS ENUM (
    'Pflegegrad 1',
    'Pflegegrad 2',
    'Pflegegrad 3',
    'Pflegegrad 4',
    'Pflegegrad 5'
);

CREATE TYPE public.chat_message_role_type AS ENUM (
    'user',
    'assistant',
    'system',
    'tool'
);

CREATE TYPE public.conversation_status_type AS ENUM (
    'in_progress',
    'closed'
);

CREATE TYPE public.disability_merkzeichen_type AS ENUM (
    'G',
    'aG',
    'H',
    'B',
    'Bl',
    'Gl',
    'TBl',
    'RF',
    '1 Kl',
    'EB',
    'VB',
    'T'
);

CREATE TYPE public.displaced_status_type AS ENUM (
    'none',
    'Expellee (Resettler)',
    'Displaced Person (Resettler)',
    'Late Resettler',
    'Spouse or Descendant of a Late Resettler',
    'Soviet Zone Refugee'
);

CREATE TYPE public.document_status_type AS ENUM (
    'processing',
    'completed',
    'failed',
    'ready_for_review',
    'verified'
);

CREATE TYPE public.expense_type AS ENUM (
    'Income Tax',
    'Health Insurance',
    'Care Insurance',
    'Unemployment Insurance',
    'Pension Insurance',
    'Church Tax',
    'Accident Insurance',
    'Retirement Provision',
    'Household Contents Insurance',
    'Funeral Insurance',
    'Life Insurance',
    'Liability Insurance',
    'Work Equipment',
    'Professional Association Fees',
    'Double Household',
    'Commute Public Transport',
    'Commute Car',
    'Commute Small Car',
    'Commute Motorcycle',
    'Commute Moped',
    'Commute Other'
);

CREATE TYPE public.gender_type AS ENUM (
    'Male',
    'Female',
    'Diverse'
);

CREATE TYPE public.health_insurance_status_type AS ENUM (
    'Compulsory Insurance',
    'Voluntary Insurance',
    'Family Insurance',
    'Private Insurance',
    'Care by Health Funds under § 264 SGB V'
);

CREATE TYPE public.income_type AS ENUM (
    'Employment',
    'Health Insurance Benefits',
    'Business',
    'Agriculture and Forestry',
    'Other Self-Employment',
    'Rental and Leasing',
    'Housing Benefit',
    'Pension',
    'Social Assistance',
    'Basic Security Benefits',
    'Asylum Seeker Benefits',
    'Federal War Victims Relief',
    'Equalisation of Burdens',
    'Employment Agency Benefits',
    'Child Benefit',
    'Child Benefit Supplement',
    'Parental Allowance',
    'Education Grant',
    'Alimony',
    'Alimony Advance',
    'Private Monetary Claims',
    'Tax Refund',
    'Capital Income',
    'Other Income',
    'Old-Age Pension',
    'Reduced Earning Capacity Pension',
    'Survivor Pension'
);

CREATE DOMAIN public.iso_country AS character(2)
	CONSTRAINT iso_country_check CHECK ((VALUE ~ '^[A-Z]{2}$'::text));

CREATE TYPE public.marital_status_type AS ENUM (
    'Single',
    'Married',
    'Cohabiting',
    'Permanently Separated',
    'Registered Civil Partnership',
    'Divorced',
    'Widowed'
);

CREATE DOMAIN public.money_nonneg AS numeric(10,2)
	CONSTRAINT money_nonneg_check CHECK ((VALUE >= (0)::numeric));

CREATE TYPE public.social_security_type_type AS ENUM (
    'None',
    'Pension Insurance',
    'Long-term Care Insurance'
);

CREATE TYPE public.status_type AS ENUM (
    'in_progress',
    'completed',
    'submitted'
);

CREATE TYPE public.tenancy_status_type AS ENUM (
    'Main Tenant',
    'Subtenant'
);

CREATE TYPE public.tutorial_status_type AS ENUM (
    'in_progress',
    'completed'
);

CREATE FUNCTION public.prevent_message_on_closed_conversation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM conversations
                WHERE id = NEW.fk_conversation_id  AND status = 'closed'
            ) THEN
                RAISE EXCEPTION check_violation USING MESSAGE = 'Cannot add messages to a closed conversation';
            END IF;
            RETURN NEW;
        END;
    $$;

CREATE FUNCTION public.recompute_monthly_expenses_total(p_user_id uuid, p_person_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_person_id IS NULL THEN
        IF p_user_id IS NULL THEN
            RETURN;
        END IF;
        PERFORM 1 FROM users WHERE id = p_user_id FOR NO KEY UPDATE;
        UPDATE users AS u
        SET monthly_expenses_total = totals.sum_amount
        FROM (
            SELECT COALESCE(SUM(monthly_amount), 0) AS sum_amount
            FROM expense_entries
            WHERE user_id = p_user_id AND person_id IS NULL
        ) AS totals
        WHERE u.id = p_user_id
          AND u.monthly_expenses_total IS DISTINCT FROM totals.sum_amount;
    ELSE
        UPDATE associated_persons AS p
        SET monthly_expenses_total = totals.sum_amount
        FROM (
            SELECT COALESCE(SUM(monthly_amount), 0) AS sum_amount
            FROM expense_entries
            WHERE person_id = p_person_id
        ) AS totals
        WHERE p.id = p_person_id
          AND p.monthly_expenses_total IS DISTINCT FROM totals.sum_amount;
    END IF;
END;
$$;

CREATE FUNCTION public.refresh_monthly_expenses_total() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM recompute_monthly_expenses_total(OLD.user_id, OLD.person_id);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM recompute_monthly_expenses_total(NEW.user_id, NEW.person_id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW IS DISTINCT FROM OLD THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TABLE public.asset_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    person_id uuid,
    asset_type public.asset_type NOT NULL,
    amount public.money_nonneg,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.associated_persons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    association_type public.association_type NOT NULL,
    lives_in_household boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    first_name character varying(255),
    last_name character varying(255),
    birth_name character varying(255),
    date_of_birth date,
    place_of_birth character varying(255),
    legal_gender public.gender_type,
    marital_status public.marital_status_type,
    nationality public.iso_country,
    second_nationality public.iso_country,
    relationship_to_applicant character varying(255),
    employment_status character varying(255),
    monthly_income public.money_nonneg,
    monthly_pension_income public.money_nonneg,
    has_own_income boolean,
    is_alimony_obligated boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_german_citizen boolean,
    id_document_issuing_authority character varying(255),
    id_document_valid_until date,
    has_guardian boolean,
    has_custodian boolean,
    displaced_status public.displaced_status_type,
    displaced_issued_on date,
    displaced_issued_by character varying(255),
    has_received_previous_benefits boolean,
    previous_benefits_authority character varying(255),
    previous_benefits_period character varying(255),
    previous_benefits_ref_no character varying(255),
    has_disability_id boolean,
    disability_valid_until date,
    merkzeichen public.disability_merkzeichen_type,
    disability_application_pending boolean,
    social_security_type public.social_security_type_type,
    health_insurance_provider character varying(255),
    health_insurance_status public.health_insurance_status_type,
    pension_insurance_provider character varying(255),
    pension_insurance_no character varying(255),
    is_care_dependent boolean,
    care_level public.care_level_type,
    has_inpatient_facility_accommodation boolean,
    inpatient_facility_assigned_from date,
    inpatient_facility_assigned_until date,
    inpatient_facility_last_residence character varying(255),
    has_permanent_reduction_in_earning_capacity boolean,
    reduced_work_capacity_is_permanent boolean,
    reduced_work_capacity_start_date date,
    reduced_work_capacity_end_date date,
    reduced_work_capacity_reason text,
    can_work_at_least_3h_daily boolean,
    work_scope_and_type character varying(255),
    employer_name character varying(255),
    is_student_or_trainee boolean,
    education_or_study_subject character varying(255),
    employment_office_customer_number character varying(255),
    commute_distance_km numeric(10,2),
    has_applied_for_sgb2_benefits boolean,
    has_applied_for_asylum_benefits boolean,
    has_child_with_substantial_income boolean,
    have_parents_substantial_joint_income boolean,
    monthly_expenses_total public.money_nonneg,
    CONSTRAINT associated_persons_dob_plausible CHECK (((date_of_birth IS NULL) OR ((date_of_birth >= '1900-01-01'::date) AND (date_of_birth <= CURRENT_DATE)))),
    CONSTRAINT associated_persons_facility_period CHECK (((inpatient_facility_assigned_from IS NULL) OR (inpatient_facility_assigned_until IS NULL) OR (inpatient_facility_assigned_until >= inpatient_facility_assigned_from))),
    CONSTRAINT associated_persons_work_capacity_period CHECK (((reduced_work_capacity_start_date IS NULL) OR (reduced_work_capacity_end_date IS NULL) OR (reduced_work_capacity_end_date >= reduced_work_capacity_start_date)))
);

CREATE TABLE public.benefit_claim_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    person_id uuid,
    claim_kind public.benefit_claim_kind NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    benefit_type character varying(255),
    event_date date,
    amount public.money_nonneg,
    office_reference character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.berlin_addresses (
    id bigint NOT NULL,
    plz text NOT NULL,
    street text NOT NULL,
    hnr text NOT NULL,
    bez_name text NOT NULL
);

CREATE SEQUENCE public.berlin_addresses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.berlin_addresses_id_seq OWNED BY public.berlin_addresses.id;

CREATE TABLE public.cms_tutorials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(255) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    title jsonb DEFAULT '{}'::jsonb NOT NULL,
    content jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subtitle jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.conversation_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fk_conversation_id uuid NOT NULL,
    message_role public.chat_message_role_type NOT NULL,
    content text,
    message_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fk_user_id uuid NOT NULL,
    application_type character varying(255),
    status public.conversation_status_type DEFAULT 'in_progress'::public.conversation_status_type NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.expense_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    person_id uuid,
    expense_type public.expense_type NOT NULL,
    monthly_amount public.money_nonneg,
    note character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.income_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    person_id uuid,
    income_type public.income_type NOT NULL,
    monthly_amount public.money_nonneg,
    awarding_office character varying(255),
    reference_no character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.uploaded_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    object_name character varying(1024) NOT NULL,
    bucket_name character varying(1024) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_applications (
    application_id uuid NOT NULL,
    fk_user_id uuid NOT NULL,
    form_type character varying(255) NOT NULL,
    status public.status_type DEFAULT 'in_progress'::public.status_type,
    form_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_reminded_at timestamp with time zone
);

CREATE TABLE public.user_documents (
    document_id uuid DEFAULT gen_random_uuid() NOT NULL,
    fk_user_id uuid NOT NULL,
    fk_application_id uuid NOT NULL,
    document_type character varying(255) NOT NULL,
    confidence_score numeric(10,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    fk_file_id uuid,
    status public.document_status_type DEFAULT 'processing'::public.document_status_type NOT NULL,
    raw_data jsonb,
    user_error_code character varying(255),
    internal_error_log text
);

CREATE TABLE public.user_tutorial_states (
    user_id uuid NOT NULL,
    tutorial_id uuid NOT NULL,
    status public.tutorial_status_type DEFAULT 'in_progress'::public.tutorial_status_type NOT NULL,
    current_step character varying(255),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name character varying(255),
    last_name character varying(255),
    date_of_birth date,
    place_of_birth character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    legal_gender public.gender_type,
    marital_status public.marital_status_type,
    married_since date,
    is_german_citizen boolean,
    is_resident_in_germany boolean,
    has_guardian boolean,
    has_custodian boolean,
    displaced_status public.displaced_status_type,
    displaced_issued_on date,
    displaced_issued_by character varying(255),
    social_security_type public.social_security_type_type,
    health_insurance_provider character varying(255),
    health_insurance_status public.health_insurance_status_type,
    pension_insurance_provider character varying(255),
    pension_insurance_no character varying(255),
    has_received_previous_benefits boolean,
    previous_benefits_authority character varying(255),
    previous_benefits_period character varying(255),
    previous_benefits_ref_no character varying(255),
    has_applied_for_asylum_benefits boolean,
    is_currently_employed boolean,
    ability_to_work public.ability_to_work_type,
    has_permanent_reduction_in_earning_capacity boolean,
    has_inpatient_facility_accommodation boolean,
    gave_away_assets_last_10_years boolean,
    gross_negligence_last_10_years boolean,
    accomodation_type public.accomodation_type,
    tenancy_status public.tenancy_status_type,
    rent_total numeric(10,2),
    hot_water_costs numeric(10,2),
    heating_costs numeric(10,2),
    cable_tv_costs numeric(10,2),
    number_of_rooms integer,
    living_area numeric(10,2),
    persons_in_household_count integer,
    bank_name character varying(255),
    account_holder character varying(255),
    iban character varying(50),
    has_disability_id boolean,
    disability_valid_until date,
    merkzeichen public.disability_merkzeichen_type,
    disability_application_pending boolean,
    phone_number character varying(32),
    nationality character varying(255),
    second_nationality character varying(255),
    authentik_id character varying(255),
    fcm_token character varying(512),
    street character varying(255),
    house_number character varying(20),
    zip_code character varying(10),
    city character varying(255),
    state character varying(255),
    birth_name character varying(255),
    residence_status character varying(255),
    identification_numbers character varying(255),
    tax_id character varying(255),
    district character varying(255),
    monthly_income numeric(10,2),
    has_assets boolean,
    assets_description text,
    has_costly_medical_nutrition boolean,
    has_applied_for_benefits_awaiting_decision boolean,
    benefits_awaiting_decision_type character varying(255) DEFAULT NULL::character varying,
    benefits_awaiting_decision_application_date date,
    benefits_awaiting_decision_office character varying(255) DEFAULT NULL::character varying,
    benefits_awaiting_decision_reference character varying(255) DEFAULT NULL::character varying,
    are_one_time_payments_expected boolean,
    one_time_payments_expected_type character varying(255) DEFAULT NULL::character varying,
    one_time_payments_expected_amount numeric(10,2) DEFAULT NULL::numeric,
    one_time_payments_expected_date date,
    bic character varying(11) DEFAULT NULL::character varying,
    sublet_room_count integer,
    sublet_rent_income numeric(10,2) DEFAULT NULL::numeric,
    rent_paid_until date,
    landlord_name character varying(255) DEFAULT NULL::character varying,
    heating_type character varying(255) DEFAULT NULL::character varying,
    free_housing_right_holder character varying(255) DEFAULT NULL::character varying,
    is_care_dependent boolean,
    inpatient_facility_move_in_date date,
    inpatient_facility_last_residence character varying(255),
    reduced_work_capacity_start_date date,
    reduced_work_capacity_end_date date,
    reduced_work_capacity_reason text,
    email character varying(255),
    license_plate character varying(20),
    is_student_or_trainee boolean,
    professional_expenses numeric(10,2),
    has_childcare_expenses boolean,
    is_subsidized_housing boolean,
    has_other_residence boolean,
    has_secondary_residence boolean,
    has_garage_costs boolean,
    garage_costs numeric(10,2),
    has_household_energy_costs boolean,
    household_energy_costs numeric(10,2),
    is_living_area_used_commercially boolean,
    commercially_used_area_sqm numeric(10,2),
    is_victim_of_national_socialist_persecution boolean,
    is_wohngeld_first_application boolean,
    receives_wohngeld_for_other_dwelling boolean,
    household_member_died_recently boolean,
    household_size_will_change boolean,
    receives_other_transfer_benefits boolean,
    pays_child_or_spousal_support boolean,
    receives_support_from_others boolean,
    expects_future_income_change boolean,
    assets_exceed_wohngeld_threshold boolean,
    related_to_landlord boolean,
    service_costs_included_in_rent boolean,
    rent_paid_partly_by_third_party boolean,
    receives_rent_contribution_from_others boolean,
    expects_rent_change boolean,
    wohngeld_payment_to_applicant boolean,
    consents_to_bank_statement_retention boolean,
    consents_to_registry_verification boolean,
    demo_seed_fixture_hash character varying(64),
    apartment_floor_location character varying(255),
    resident_in_berlin_since date,
    resident_in_district_since date,
    previous_address character varying(255),
    rent_arrears_period character varying(255),
    rent_arrears_amount public.money_nonneg,
    tenancy_terminated_on date,
    sublet_unrentable_reason character varying(255),
    inpatient_facility_assigned_until date,
    care_level public.care_level_type,
    can_work_at_least_3h_daily boolean,
    work_scope_and_type character varying(255),
    employer_name character varying(255),
    education_or_study_subject character varying(255),
    employment_office_customer_number character varying(255),
    commute_distance_km numeric(10,2),
    has_child_with_substantial_income boolean,
    have_parents_substantial_joint_income boolean,
    monthly_expenses_total public.money_nonneg,
    landlord_address character varying(255),
    main_tenant_name character varying(255),
    vehicle_make character varying(255),
    vehicle_year character varying(4),
    has_unavoidable_special_need boolean,
    was_self_employed_last_5_years boolean,
    received_wage_replacement_last_5_years boolean,
    did_military_or_voluntary_service_last_5_years boolean,
    cared_for_relatives_last_5_years boolean,
    azr_number character varying(12),
    CONSTRAINT users_facility_period CHECK (((inpatient_facility_move_in_date IS NULL) OR (inpatient_facility_assigned_until IS NULL) OR (inpatient_facility_assigned_until >= inpatient_facility_move_in_date)))
);

ALTER TABLE ONLY public.berlin_addresses ALTER COLUMN id SET DEFAULT nextval('public.berlin_addresses_id_seq'::regclass);

ALTER TABLE ONLY public.asset_entries
    ADD CONSTRAINT asset_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.associated_persons
    ADD CONSTRAINT associated_persons_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.benefit_claim_entries
    ADD CONSTRAINT benefit_claim_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.berlin_addresses
    ADD CONSTRAINT berlin_addresses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cms_tutorials
    ADD CONSTRAINT cms_tutorials_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cms_tutorials
    ADD CONSTRAINT cms_tutorials_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.income_entries
    ADD CONSTRAINT income_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_applications
    ADD CONSTRAINT user_applications_pkey PRIMARY KEY (application_id);

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_pkey PRIMARY KEY (document_id);

ALTER TABLE ONLY public.user_tutorial_states
    ADD CONSTRAINT user_tutorial_states_pkey PRIMARY KEY (user_id, tutorial_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_authentik_id_key UNIQUE (authentik_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX asset_entries_applicant_type_idx ON public.asset_entries USING btree (user_id, asset_type) WHERE (person_id IS NULL);

CREATE UNIQUE INDEX asset_entries_person_type_idx ON public.asset_entries USING btree (person_id, asset_type) WHERE (person_id IS NOT NULL);

CREATE INDEX asset_entries_user_id_idx ON public.asset_entries USING btree (user_id);

CREATE INDEX associated_persons_user_id_idx ON public.associated_persons USING btree (user_id, sort_order);

CREATE INDEX benefit_claim_entries_lookup_idx ON public.benefit_claim_entries USING btree (user_id, claim_kind, sort_order);

CREATE UNIQUE INDEX expense_entries_applicant_type_idx ON public.expense_entries USING btree (user_id, expense_type) WHERE (person_id IS NULL);

CREATE UNIQUE INDEX expense_entries_person_type_idx ON public.expense_entries USING btree (person_id, expense_type) WHERE (person_id IS NOT NULL);

CREATE INDEX expense_entries_user_id_idx ON public.expense_entries USING btree (user_id);

CREATE INDEX idx_berlin_addresses_lookup ON public.berlin_addresses USING btree (plz, street, hnr);

CREATE INDEX idx_messages_conversation_created ON public.conversation_messages USING btree (fk_conversation_id, created_at);

CREATE UNIQUE INDEX income_entries_applicant_type_idx ON public.income_entries USING btree (user_id, income_type) WHERE (person_id IS NULL);

CREATE UNIQUE INDEX income_entries_person_type_idx ON public.income_entries USING btree (person_id, income_type) WHERE (person_id IS NOT NULL);

CREATE INDEX income_entries_user_id_idx ON public.income_entries USING btree (user_id);

CREATE TRIGGER trg_asset_entries_updated_at BEFORE UPDATE ON public.asset_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_associated_persons_updated_at BEFORE UPDATE ON public.associated_persons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_benefit_claim_entries_updated_at BEFORE UPDATE ON public.benefit_claim_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_conversation_messages_updated_at BEFORE UPDATE ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_expense_entries_refresh_total AFTER INSERT OR DELETE OR UPDATE ON public.expense_entries FOR EACH ROW EXECUTE FUNCTION public.refresh_monthly_expenses_total();

CREATE TRIGGER trg_expense_entries_updated_at BEFORE UPDATE ON public.expense_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_income_entries_updated_at BEFORE UPDATE ON public.income_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_prevent_closed_conversation_message BEFORE INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.prevent_message_on_closed_conversation();

CREATE TRIGGER trg_uploaded_files_updated_at BEFORE UPDATE ON public.uploaded_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_user_applications_updated_at BEFORE UPDATE ON public.user_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_user_documents_updated_at BEFORE UPDATE ON public.user_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE ONLY public.asset_entries
    ADD CONSTRAINT asset_entries_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.associated_persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.asset_entries
    ADD CONSTRAINT asset_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.associated_persons
    ADD CONSTRAINT associated_persons_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.benefit_claim_entries
    ADD CONSTRAINT benefit_claim_entries_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.associated_persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.benefit_claim_entries
    ADD CONSTRAINT benefit_claim_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_fk_conversation_id_fkey FOREIGN KEY (fk_conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_fk_user_id_fkey FOREIGN KEY (fk_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.associated_persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.income_entries
    ADD CONSTRAINT income_entries_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.associated_persons(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.income_entries
    ADD CONSTRAINT income_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_applications
    ADD CONSTRAINT user_applications_fk_user_id_fkey FOREIGN KEY (fk_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_fk_application_id_fkey FOREIGN KEY (fk_application_id) REFERENCES public.user_applications(application_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_fk_file_id_fkey FOREIGN KEY (fk_file_id) REFERENCES public.uploaded_files(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.user_documents
    ADD CONSTRAINT user_documents_fk_user_id_fkey FOREIGN KEY (fk_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_tutorial_states
    ADD CONSTRAINT user_tutorial_states_tutorial_id_fkey FOREIGN KEY (tutorial_id) REFERENCES public.cms_tutorials(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_tutorial_states
    ADD CONSTRAINT user_tutorial_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
"""

SEED = r"""
INSERT INTO public.cms_tutorials (id, slug, sort_order, title, content, created_at, updated_at, subtitle) VALUES ('c8f4a2b1-9e3d-4c7f-a8b6-2d1e0f9c8b7a', 'was-ist-grundsicherung', 10, '{"de": "Was ist Grundsicherung?", "en": "What is basic income?"}', '[{"content": {"de": {"text": "Grundsicherung ist eine finanzielle Unterstützung. Sie kann helfen, wenn Du in der Altersrente bist oder aus gesundheitlichen Gründen nicht mehr arbeiten kannst und Dein Geld für den Lebensunterhalt nicht reicht.\n\nMit Grundsicherung können zum Beispiel Kosten für den Alltag, die Wohnung und das Heizen unterstützt werden.", "title": "Was ist Grundsicherung?"}, "en": {"text": "Basic income is financial support. It can help if you are at retirement age or cannot work for health reasons and your money is not enough for living costs.\n\nWith basic income, support can be provided for daily costs, housing, and heating, for example.", "title": "What is basic income?"}}, "step_id": "step-1"}]', '2026-11-13 15:15:40.078974+00', '2026-11-13 15:15:40.292768+00', '{"de": "Hier findest Du die wichtigsten Infos.", "en": "Here you''ll find the key information."}');
INSERT INTO public.cms_tutorials (id, slug, sort_order, title, content, created_at, updated_at, subtitle) VALUES ('8d8f41b2-c022-4a21-bc53-5d212eef32f1', 'wie-funktioniert-die-applikation', 20, '{"de": "Wie funktioniert die Applikation?", "en": "How does the application work?"}', '[{"image": "tutorial-app-guide-step-1", "content": {"de": {"text": "Vollständige Anträge können schneller von der Verwaltung bearbeitet werden.\n\nKlaros Fortschrittsanzeige zeigt Dir, was Du schon erledigt hast und was noch zu tun ist. So weißt Du jederzeit, wie weit Du bist.", "title": "Schritt-für-Schritt zum Antrag."}, "en": {"text": "Complete applications can be processed faster by the administration.\n\nKlaro''s progress indicator shows you what you have already done and what still needs to be done. So you know at all times how far you are.", "title": "Step-by-step to the application."}}, "step_id": "step-1"}, {"image": "tutorial-app-guide-step-2", "content": {"de": {"text": "Dein Fortschritt wird automatisch gespeichert. So kannst Du Deinen Antragsprozess jederzeit unterbrechen und später fortsetzen.", "title": "Deine Fortschritte werden gespeichert."}, "en": {"text": "Your progress is automatically saved. So you can interrupt your application process at any time and continue later.", "title": "Your progress is saved."}}, "step_id": "step-2"}, {"image": "tutorial-app-guide-step-3", "content": {"de": {"text": "Wenn Du die Daten im Antrag nicht manuell ausfüllen möchtest, kannst Du Klaro stattdessen ein Dokument geben. Klaro analysiert das Dokument, findet für den Antrag relevante Informationen und speichert sie. Diese Funktion findest Du direkt am Anfang Deines Antrags.", "title": "Intelligente Dokumentanalyse"}, "en": {"text": "If you do not want to fill in the data in the application manually, you can give us a document instead. Klaro analyzes the document, finds relevant info and saves it. You can find this at the start of your application.", "title": "Intelligent Document Analysis"}}, "step_id": "step-3"}, {"image": "tutorial-app-guide-step-4", "content": {"de": {"text": "Du brauchst Hilfe beim Ausfüllen des Antrags oder hast eine Frage zu Deinem Sozialhilfe-Anspruch? Der Klaro-Assistent beantwortet Dir Deine Fragen und ist nur einen Klick auf das \"Chat\"-Icon entfernt.", "title": "Dein persönlicher Assistent"}, "en": {"text": "Need help filling out the application or have a question about your basic income entitlement? The Klaro assistant answers your questions and is just a click away on the chat icon.", "title": "Your Personal Assistant"}}, "step_id": "step-4"}]', '2026-11-13 15:15:39.989943+00', '2026-11-13 15:15:40.292768+00', '{"de": "Hier findest Du eine einfache Anleitung.", "en": "Here you''ll find a simple guide."}');
"""


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(SCHEMA)
    op.execute(SEED)


def downgrade() -> None:
    """Downgrade schema."""
    raise NotImplementedError("The baseline cannot be downgraded.")
