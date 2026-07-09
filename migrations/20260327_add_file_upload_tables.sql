-- Migration to add file upload tables

CREATE TABLE uploaded_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    object_name VARCHAR(1024) NOT NULL,
    bucket_name VARCHAR(1024) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_uploaded_files_updated_at
    BEFORE UPDATE ON uploaded_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update user_documents to reference uploaded_files
ALTER TABLE user_documents
    DROP COLUMN file_url,
    ADD COLUMN fk_file_id UUID REFERENCES uploaded_files(id) ON DELETE RESTRICT;

ALTER TABLE users
    ADD COLUMN phone_number VARCHAR(32) UNIQUE;
