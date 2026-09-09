CREATE TYPE income_type AS ENUM (
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
    'Other Income'
);

CREATE TYPE expense_type AS ENUM (
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

CREATE TYPE asset_type AS ENUM (
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

CREATE TYPE benefit_claim_kind AS ENUM (
    'Pending Application',
    'Expected One-Time Payment'
);

CREATE TYPE care_level_type AS ENUM (
    'Pflegegrad 1',
    'Pflegegrad 2',
    'Pflegegrad 3',
    'Pflegegrad 4',
    'Pflegegrad 5'
);


-- 1. associated_persons: the Personenziffer 2 column ------------------------------------

ALTER TABLE associated_persons
    -- Identity document (Personenziffer 2, Seite 1)
    ADD COLUMN is_german_citizen BOOLEAN,
    ADD COLUMN id_document_issuing_authority VARCHAR(255),
    ADD COLUMN id_document_valid_until DATE,

    -- Guardianship / Betreuung und Beistandschaft
    ADD COLUMN has_guardian BOOLEAN,
    ADD COLUMN has_custodian BOOLEAN,

    -- Displaced-person status, Ausweis A/B/C
    ADD COLUMN displaced_status displaced_status_type,
    ADD COLUMN displaced_issued_on DATE,
    ADD COLUMN displaced_issued_by VARCHAR(255),

    -- Previously received benefits
    ADD COLUMN has_received_previous_benefits BOOLEAN,
    ADD COLUMN previous_benefits_authority VARCHAR(255),
    ADD COLUMN previous_benefits_period VARCHAR(255),
    ADD COLUMN previous_benefits_ref_no VARCHAR(255),

    -- Schwerbehindertenausweis
    ADD COLUMN has_disability_id BOOLEAN,
    ADD COLUMN disability_valid_until DATE,
    ADD COLUMN merkzeichen disability_merkzeichen_type,
    ADD COLUMN disability_application_pending BOOLEAN,

    -- Sozialversicherung
    ADD COLUMN social_security_type social_security_type_type,
    ADD COLUMN health_insurance_provider VARCHAR(255),
    ADD COLUMN health_insurance_status health_insurance_status_type,
    ADD COLUMN pension_insurance_provider VARCHAR(255),
    ADD COLUMN pension_insurance_no VARCHAR(255),

    -- Pflegebedürftigkeit
    ADD COLUMN is_care_dependent BOOLEAN,
    ADD COLUMN care_level care_level_type,

    -- Stationäre Einrichtung
    ADD COLUMN has_inpatient_facility_accommodation BOOLEAN,
    ADD COLUMN inpatient_facility_assigned_from DATE,
    ADD COLUMN inpatient_facility_assigned_until DATE,
    ADD COLUMN inpatient_facility_last_residence VARCHAR(255),

    -- Erwerbsminderung
    ADD COLUMN has_permanent_reduction_in_earning_capacity BOOLEAN,
    ADD COLUMN reduced_work_capacity_is_permanent BOOLEAN,
    ADD COLUMN reduced_work_capacity_start_date DATE,
    ADD COLUMN reduced_work_capacity_end_date DATE,
    ADD COLUMN reduced_work_capacity_reason TEXT,

    -- Erwerbstätigkeit und Ausbildung
    ADD COLUMN can_work_at_least_3h_daily BOOLEAN,
    ADD COLUMN work_scope_and_type VARCHAR(255),
    ADD COLUMN employer_name VARCHAR(255),
    ADD COLUMN is_student_or_trainee BOOLEAN,
    ADD COLUMN education_or_study_subject VARCHAR(255),
    ADD COLUMN employment_office_customer_number VARCHAR(255),
    ADD COLUMN commute_distance_km NUMERIC(10,2),

    -- Ausschlussgründe und Unterhaltspflichtige
    ADD COLUMN has_applied_for_sgb2_benefits BOOLEAN,
    ADD COLUMN has_applied_for_asylum_benefits BOOLEAN,
    ADD COLUMN has_child_with_substantial_income BOOLEAN,
    ADD COLUMN have_parents_substantial_joint_income BOOLEAN,

    ADD CONSTRAINT associated_persons_work_capacity_period
        CHECK (
            reduced_work_capacity_start_date IS NULL
            OR reduced_work_capacity_end_date IS NULL
            OR reduced_work_capacity_end_date >= reduced_work_capacity_start_date
        ),
    ADD CONSTRAINT associated_persons_facility_period
        CHECK (
            inpatient_facility_assigned_from IS NULL
            OR inpatient_facility_assigned_until IS NULL
            OR inpatient_facility_assigned_until >= inpatient_facility_assigned_from
        );


-- 2. users: applicant-side gaps ---------------------------------------------------------

ALTER TABLE users
    -- Wohnsitz-Historie
    ADD COLUMN apartment_floor_location VARCHAR(255),
    ADD COLUMN resident_in_berlin_since DATE,
    ADD COLUMN resident_in_district_since DATE,
    ADD COLUMN previous_address VARCHAR(255),

    -- Mietverhältnis
    ADD COLUMN rent_arrears_period VARCHAR(255),
    ADD COLUMN rent_arrears_amount money_nonneg,
    ADD COLUMN tenancy_terminated_on DATE,
    ADD COLUMN sublet_unrentable_reason VARCHAR(255),

    -- Pflege / Einrichtung
    ADD COLUMN inpatient_facility_assigned_until DATE,
    ADD COLUMN care_level care_level_type,

    -- Erwerbstätigkeit und Ausbildung
    ADD COLUMN can_work_at_least_3h_daily BOOLEAN,
    ADD COLUMN work_scope_and_type VARCHAR(255),
    ADD COLUMN employer_name VARCHAR(255),
    ADD COLUMN education_or_study_subject VARCHAR(255),
    ADD COLUMN employment_office_customer_number VARCHAR(255),
    ADD COLUMN commute_distance_km NUMERIC(10,2),

    -- Unterhaltspflichtige Angehörige
    ADD COLUMN has_child_with_substantial_income BOOLEAN,
    ADD COLUMN have_parents_substantial_joint_income BOOLEAN,

    ADD CONSTRAINT users_facility_period
        CHECK (
            inpatient_facility_move_in_date IS NULL
            OR inpatient_facility_assigned_until IS NULL
            OR inpatient_facility_assigned_until >= inpatient_facility_move_in_date
        );


-- 3. Entry tables for the repeating grids ------------------------------------------------

-- `person_id IS NULL` means the applicant, so one table covers a form column per person
-- without the applicant needing a phantom associated_persons row.
CREATE TABLE income_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    person_id UUID REFERENCES associated_persons(id) ON DELETE CASCADE,
    income_type income_type NOT NULL,
    monthly_amount money_nonneg,
    awarding_office VARCHAR(255),
    reference_no VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX income_entries_applicant_type_idx
    ON income_entries (user_id, income_type) WHERE person_id IS NULL;
CREATE UNIQUE INDEX income_entries_person_type_idx
    ON income_entries (person_id, income_type) WHERE person_id IS NOT NULL;
CREATE INDEX income_entries_user_id_idx ON income_entries (user_id);

CREATE TRIGGER trg_income_entries_updated_at
    BEFORE UPDATE ON income_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE expense_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    person_id UUID REFERENCES associated_persons(id) ON DELETE CASCADE,
    expense_type expense_type NOT NULL,
    monthly_amount money_nonneg,
    note VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX expense_entries_applicant_type_idx
    ON expense_entries (user_id, expense_type) WHERE person_id IS NULL;
CREATE UNIQUE INDEX expense_entries_person_type_idx
    ON expense_entries (person_id, expense_type) WHERE person_id IS NOT NULL;
CREATE INDEX expense_entries_user_id_idx ON expense_entries (user_id);

CREATE TRIGGER trg_expense_entries_updated_at
    BEFORE UPDATE ON expense_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TABLE asset_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    person_id UUID REFERENCES associated_persons(id) ON DELETE CASCADE,
    asset_type asset_type NOT NULL,
    amount money_nonneg,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX asset_entries_applicant_type_idx
    ON asset_entries (user_id, asset_type) WHERE person_id IS NULL;
CREATE UNIQUE INDEX asset_entries_person_type_idx
    ON asset_entries (person_id, asset_type) WHERE person_id IS NOT NULL;
CREATE INDEX asset_entries_user_id_idx ON asset_entries (user_id);

CREATE TRIGGER trg_asset_entries_updated_at
    BEFORE UPDATE ON asset_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Unlike the three above, this grid is a free list rather than one row per fixed type
-- (the form prints three blank rows for pending applications and two for expected lump
-- sums), so `sort_order` decides which form row a record lands in and there is no unique
-- constraint on the type.
CREATE TABLE benefit_claim_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    person_id UUID REFERENCES associated_persons(id) ON DELETE CASCADE,
    claim_kind benefit_claim_kind NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,

    benefit_type VARCHAR(255),
    event_date DATE,
    amount money_nonneg,
    office_reference VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX benefit_claim_entries_lookup_idx
    ON benefit_claim_entries (user_id, claim_kind, sort_order);

CREATE TRIGGER trg_benefit_claim_entries_updated_at
    BEFORE UPDATE ON benefit_claim_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
