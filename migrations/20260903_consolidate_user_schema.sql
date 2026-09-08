-- Created as `SELECT *`, which Postgres expands at CREATE VIEW time, so it froze at the
-- seven columns `users` had then. Nothing queried it; form_service derives the values now.
DROP VIEW IF EXISTS users_age_view;

-- Shape constraints, enforced whichever writer runs. Only rules repeated across columns
-- get a domain; one-offs use a plain CHECK
CREATE DOMAIN iso_country AS CHAR(2) CHECK (VALUE ~ '^[A-Z]{2}$');
CREATE DOMAIN money_nonneg AS NUMERIC(10,2) CHECK (VALUE >= 0);

-- Replaces users.household_members (JSONB) 
CREATE TYPE association_type AS ENUM (
    'Spouse',
    'Registered Partner',
    'Cohabiting Partner',
    'Child',
    'Parent',
    'Other Relative',
    'Other'
);

CREATE TABLE associated_persons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    association_type association_type NOT NULL,
    lives_in_household BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,

    first_name VARCHAR(255),
    last_name VARCHAR(255),
    birth_name VARCHAR(255),
    date_of_birth DATE,
    place_of_birth VARCHAR(255),
    legal_gender gender_type,
    marital_status marital_status_type,
    nationality iso_country,
    second_nationality iso_country,
    relationship_to_applicant VARCHAR(255),
    employment_status VARCHAR(255),
    monthly_income money_nonneg,
    monthly_pension_income money_nonneg,
    has_own_income BOOLEAN,
    is_alimony_obligated BOOLEAN,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT associated_persons_dob_plausible
        CHECK (date_of_birth IS NULL OR date_of_birth BETWEEN '1900-01-01' AND CURRENT_DATE)
);

CREATE INDEX associated_persons_user_id_idx ON associated_persons (user_id, sort_order);

CREATE TRIGGER trg_associated_persons_updated_at
    BEFORE UPDATE ON associated_persons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE users DROP COLUMN IF EXISTS household_members;

ALTER TABLE users
    ADD COLUMN is_wohngeld_first_application BOOLEAN,
    ADD COLUMN receives_wohngeld_for_other_dwelling BOOLEAN,
    ADD COLUMN household_member_died_recently BOOLEAN,
    ADD COLUMN household_size_will_change BOOLEAN,
    ADD COLUMN receives_other_transfer_benefits BOOLEAN,
    ADD COLUMN pays_child_or_spousal_support BOOLEAN,
    ADD COLUMN receives_support_from_others BOOLEAN,
    ADD COLUMN expects_future_income_change BOOLEAN,
    ADD COLUMN assets_exceed_wohngeld_threshold BOOLEAN,
    ADD COLUMN related_to_landlord BOOLEAN,
    ADD COLUMN service_costs_included_in_rent BOOLEAN,
    ADD COLUMN rent_paid_partly_by_third_party BOOLEAN,
    ADD COLUMN receives_rent_contribution_from_others BOOLEAN,
    ADD COLUMN expects_rent_change BOOLEAN,
    ADD COLUMN wohngeld_payment_to_applicant BOOLEAN,
    ADD COLUMN consents_to_bank_statement_retention BOOLEAN,
    ADD COLUMN consents_to_registry_verification BOOLEAN;
