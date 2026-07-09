-- Create tutorial_status_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tutorial_status_type') THEN
        CREATE TYPE tutorial_status_type AS ENUM ('in_progress', 'completed');
    END IF;
END
$$;

-- Create cms_tutorials table
CREATE TABLE IF NOT EXISTS cms_tutorials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    title JSONB NOT NULL DEFAULT '{}'::jsonb,
    content JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_tutorial_states table
CREATE TABLE IF NOT EXISTS user_tutorial_states (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tutorial_id UUID NOT NULL REFERENCES cms_tutorials(id) ON DELETE CASCADE,
    status tutorial_status_type NOT NULL DEFAULT 'in_progress',
    current_step VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, tutorial_id)
);
