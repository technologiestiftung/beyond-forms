-- Migration: Add missing income, assets, and bank fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_applied_for_benefits_awaiting_decision BOOLEAN DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS benefits_awaiting_decision_type VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS benefits_awaiting_decision_application_date DATE DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS benefits_awaiting_decision_office VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS benefits_awaiting_decision_reference VARCHAR(255) DEFAULT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS are_one_time_payments_expected BOOLEAN DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS one_time_payments_expected_type VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS one_time_payments_expected_amount NUMERIC(10, 2) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS one_time_payments_expected_date DATE DEFAULT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS bic VARCHAR(11) DEFAULT NULL;
