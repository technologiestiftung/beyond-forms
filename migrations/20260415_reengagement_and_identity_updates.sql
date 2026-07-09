-- Add authentik_id column to users table to allow robust lookup via JWT 'sub'
ALTER TABLE users ADD COLUMN IF NOT EXISTS authentik_id VARCHAR(255) UNIQUE;

-- Add fcm_token column to users table for push notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(512);

-- Add last_reminded_at column to user_applications table to preserve telemetry
ALTER TABLE user_applications ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;
