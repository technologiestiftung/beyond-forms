-- This table only contains immutable information about the user
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    date_of_birth DATE,
    place_of_birth VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE VIEW users_age_view AS
SELECT
    *,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))::INT AS age,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18 AS is_adult,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 67 AS has_reached_retirement_age
FROM users;

CREATE TYPE gender_type AS ENUM (
    'Male',
    'Female',
    'Diverse'
);

CREATE TYPE ability_to_work_type AS ENUM (
    'Fully able',
    'Temporarily disabled',
    'Permanently disabled'
);

CREATE TYPE marital_status_type AS ENUM (
    'Single',
    'Married',
    'Cohabiting',
    'Permanently Separated',
    'Registered Civil Partnership',
    'Divorced',
    'Widowed'
);

CREATE TYPE displaced_status_type AS ENUM (
    'Expellee (Resettler)',
    'Displaced Person (Resettler)',
    'Late Resettler',
    'Spouse or Descendant of a Late Resettler',
    'Soviet Zone Refugee'
);

CREATE TABLE user_legal_status (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Gender
    legal_gender gender_type,

    -- Marital
    marital_status marital_status_type,
    married_since DATE,

    -- Citizenship & Residency
    is_german_citizen BOOLEAN,
    is_resident_in_germany BOOLEAN,

    -- Legal Guardianship
    has_guardian BOOLEAN,
    has_custodian BOOLEAN,

    -- Displaced / Refugee Status
    displaced_status displaced_status_type,
    displaced_issued_on DATE,
    displaced_issued_by VARCHAR(255),

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE social_security_type_type AS ENUM (
    'None',
    'Pension Insurance',
    'Long-term Care Insurance'
);

CREATE TYPE health_insurance_status_type AS ENUM (
    'Compulsory Insurance',
    'Voluntary Insurance',
    'Family Insurance',
    'Private Insurance',
    'Care by Health Funds under § 264 SGB V'
);

CREATE TABLE user_social_security (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Insurance
    social_security_type social_security_type_type,
    health_insurance_provider VARCHAR(255),
    health_insurance_status health_insurance_status_type,
    pension_insurance_provider VARCHAR(255),
    pension_insurance_no VARCHAR(255),

    -- Previous Benefits History
    has_received_previous_benefits BOOLEAN,
    previous_benefits_authority VARCHAR(255),
    previous_benefits_period VARCHAR(255),
    previous_benefits_ref_no VARCHAR(255),
    has_applied_for_asylum_benefits BOOLEAN,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_work_capacity (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

    -- Working capability
    is_currently_employed BOOLEAN,
    ability_to_work ability_to_work_type,

    -- Medical context
    has_permanent_reduction_in_earning_capacity BOOLEAN,
    has_inpatient_facility_accommodation BOOLEAN,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_financial_compliance (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    gave_away_assets_last_10_years BOOLEAN,
    gross_negligence_last_10_years BOOLEAN,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE accomodation_type AS ENUM (
    'Rental Apartment',
    'Own Home',
    'Condominium',
    'Relative',
    'Shared Household'
);

CREATE TYPE tenancy_status_type AS ENUM (
    'Main Tenant',
    'Subtenant'
);

CREATE TABLE user_accomodation (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    accomodation_type accomodation_type,
    tenancy_status tenancy_status_type,
    rent_total DECIMAL(10, 2),
    hot_water_costs DECIMAL(10, 2),
    heating_costs DECIMAL(10, 2),
    cable_tv_costs DECIMAL(10, 2),
    number_of_rooms INT,
    living_area DECIMAL(10, 2),
    persons_in_household_count INT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW IS DISTINCT FROM OLD THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_legal_status_updated_at
    BEFORE UPDATE ON user_legal_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_social_security_updated_at
    BEFORE UPDATE ON user_social_security
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_work_capacity_updated_at
    BEFORE UPDATE ON user_work_capacity
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_financial_compliance_updated_at
    BEFORE UPDATE ON user_financial_compliance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_accomodation_updated_at
    BEFORE UPDATE ON user_accomodation
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
