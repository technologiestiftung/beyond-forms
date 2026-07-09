DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_status_type') THEN
        CREATE TYPE conversation_status_type AS ENUM (
            'in_progress',
            'closed'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fk_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    application_type VARCHAR(255),
    status conversation_status_type NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_role_type') THEN
        CREATE TYPE chat_message_role_type AS ENUM (
            'user',
            'assistant',
            'system',
            'tool'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fk_conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_role chat_message_role_type NOT NULL,
    content TEXT NOT NULL,
    message_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_conversation_messages_updated_at
    BEFORE UPDATE ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE OR REPLACE FUNCTION prevent_message_on_closed_conversation()
    RETURNS TRIGGER AS $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM conversations
                WHERE id = NEW.fk_conversation_id  AND status = 'closed'
            ) THEN
                RAISE EXCEPTION check_violation USING MESSAGE = 'Cannot add messages to a closed conversation';
            END IF;
            RETURN NEW;
        END;
    $$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_prevent_closed_conversation_message
    BEFORE INSERT ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION prevent_message_on_closed_conversation();

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON conversation_messages (fk_conversation_id, created_at ASC);
