-- Migration to ensure phone_number column in users table is unique.
-- This constraint is required by the ON CONFLICT (phone_number) specification in the auth-service.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_phone_number_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);
    END IF;
END;
$$;
