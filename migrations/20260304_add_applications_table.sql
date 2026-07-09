-- Bank Details
CREATE TABLE user_bank_details (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(255),
    account_holder VARCHAR(255),
    iban VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE disability_merkzeichen_type AS ENUM (
        'G', -- gehbehindert
        'aG', -- außergewöhnlich behindert
        'H', -- hilflos
        'B', -- Begleitperson
        'Bl', -- blind
        'Gl', -- gehörlos
        'TBl', -- taubblind
        'RF', -- Rundfunk/Fernsehen - Befreiung GEZ
        '1 Kl', -- 1. Klasse
        'EB', -- entschädigungsberechtigt
        'VB', -- versorgungsberechtigt
        'T' -- teilnahmeberechtigt am Sonderfahrdienst (Berlin)
    );

CREATE TYPE status_type AS ENUM (
    'in_progress',
    'completed',
    'submitted'
);

-- Disability Info
CREATE TABLE user_disability_status (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    has_disability_id BOOLEAN,
    valid_until DATE,
    merkzeichen disability_merkzeichen_type,
    application_pending BOOLEAN,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE form_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    form_type VARCHAR(255) NOT NULL, -- e.g. 'basic_income'
    status status_type DEFAULT 'in_progress',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE basic_income_form (
    application_id UUID PRIMARY KEY REFERENCES form_applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_date DATE DEFAULT CURRENT_DATE,
    form_data JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Triggers for updated_at
CREATE TRIGGER trg_user_bank_details_updated_at
    BEFORE UPDATE ON user_bank_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_disability_status_updated_at
    BEFORE UPDATE ON user_disability_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_form_applications_updated_at
    BEFORE UPDATE ON form_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_basic_income_form_updated_at
    BEFORE UPDATE ON basic_income_form
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
