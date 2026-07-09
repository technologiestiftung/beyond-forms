-- Migration to add raw_data, status, and error telemetry columns to user_documents

CREATE TYPE document_status_type AS ENUM ('processing', 'completed', 'failed');

ALTER TABLE user_documents
    ADD COLUMN status document_status_type NOT NULL DEFAULT 'processing',
    ADD COLUMN raw_data JSONB,
    ADD COLUMN user_error_code VARCHAR(255),
    ADD COLUMN internal_error_log TEXT;
