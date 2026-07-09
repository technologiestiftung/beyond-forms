-- Merge all 1:1 user tables into the main users table

-- Add columns from user_legal_status
ALTER TABLE users
    ADD COLUMN legal_gender gender_type,
    ADD COLUMN marital_status marital_status_type,
    ADD COLUMN married_since DATE,
    ADD COLUMN is_german_citizen BOOLEAN,
    ADD COLUMN is_resident_in_germany BOOLEAN,
    ADD COLUMN has_guardian BOOLEAN,
    ADD COLUMN has_custodian BOOLEAN,
    ADD COLUMN displaced_status displaced_status_type,
    ADD COLUMN displaced_issued_on DATE,
    ADD COLUMN displaced_issued_by VARCHAR(255);

-- Add columns from user_social_security
ALTER TABLE users
    ADD COLUMN social_security_type social_security_type_type,
    ADD COLUMN health_insurance_provider VARCHAR(255),
    ADD COLUMN health_insurance_status health_insurance_status_type,
    ADD COLUMN pension_insurance_provider VARCHAR(255),
    ADD COLUMN pension_insurance_no VARCHAR(255),
    ADD COLUMN has_received_previous_benefits BOOLEAN,
    ADD COLUMN previous_benefits_authority VARCHAR(255),
    ADD COLUMN previous_benefits_period VARCHAR(255),
    ADD COLUMN previous_benefits_ref_no VARCHAR(255),
    ADD COLUMN has_applied_for_asylum_benefits BOOLEAN;

-- Add columns from user_work_capacity
ALTER TABLE users
    ADD COLUMN is_currently_employed BOOLEAN,
    ADD COLUMN ability_to_work ability_to_work_type,
    ADD COLUMN has_permanent_reduction_in_earning_capacity BOOLEAN,
    ADD COLUMN has_inpatient_facility_accommodation BOOLEAN;

-- Add columns from user_financial_compliance
ALTER TABLE users
    ADD COLUMN gave_away_assets_last_10_years BOOLEAN,
    ADD COLUMN gross_negligence_last_10_years BOOLEAN;

-- Add columns from user_accomodation
ALTER TABLE users
    ADD COLUMN accomodation_type accomodation_type,
    ADD COLUMN tenancy_status tenancy_status_type,
    ADD COLUMN rent_total DECIMAL(10, 2),
    ADD COLUMN hot_water_costs DECIMAL(10, 2),
    ADD COLUMN heating_costs DECIMAL(10, 2),
    ADD COLUMN cable_tv_costs DECIMAL(10, 2),
    ADD COLUMN number_of_rooms INT,
    ADD COLUMN living_area DECIMAL(10, 2),
    ADD COLUMN persons_in_household_count INT;

-- Add columns from user_bank_details
ALTER TABLE users
    ADD COLUMN bank_name VARCHAR(255),
    ADD COLUMN account_holder VARCHAR(255),
    ADD COLUMN iban VARCHAR(50);

-- Add columns from user_disability_status
ALTER TABLE users
    ADD COLUMN has_disability_id BOOLEAN,
    ADD COLUMN disability_valid_until DATE,
    ADD COLUMN merkzeichen disability_merkzeichen_type,
    ADD COLUMN disability_application_pending BOOLEAN;

-- Drop the 1:1 tables
DROP TABLE IF EXISTS user_legal_status CASCADE;
DROP TABLE IF EXISTS user_social_security CASCADE;
DROP TABLE IF EXISTS user_work_capacity CASCADE;
DROP TABLE IF EXISTS user_financial_compliance CASCADE;
DROP TABLE IF EXISTS user_accomodation CASCADE;
DROP TABLE IF EXISTS user_bank_details CASCADE;
DROP TABLE IF EXISTS user_disability_status CASCADE;

-- Drop forms tables
DROP TABLE IF EXISTS basic_income_form CASCADE;
DROP SCHEMA IF EXISTS forms CASCADE;
DROP TABLE IF EXISTS form_applications CASCADE;

-- Add user_applications table
CREATE TABLE user_applications (
    application_id UUID PRIMARY KEY,
    fk_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    form_type VARCHAR(255) NOT NULL, -- e.g. 'basic_income'
    status status_type DEFAULT 'in_progress',
    form_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_user_applications_updated_at
    BEFORE UPDATE ON user_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Add user_documents table
CREATE TABLE user_documents (
    document_id UUID PRIMARY KEY,
    fk_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fk_application_id UUID NOT NULL REFERENCES user_applications(application_id) ON DELETE CASCADE,
    file_url VARCHAR(255) NOT NULL,
    document_type VARCHAR(255) NOT NULL,
    confidence_score DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_user_documents_updated_at
    BEFORE UPDATE ON user_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
