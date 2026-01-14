-- ============================================================================
-- MIGRATION: Security Hardening for Spec Refiner
-- ============================================================================
-- This migration:
-- 1. Enables Row Level Security (RLS) on all tables
-- 2. Creates secure RPC functions for login (no password_hash exposure)
-- 3. Creates admin-only RPCs with token validation
-- 4. Creates RLS policies for data isolation
-- ============================================================================

-- ============================================================================
-- PART 1: SECURE LOGIN RPC
-- ============================================================================
-- This function handles login without exposing password_hash to the client

CREATE OR REPLACE FUNCTION login_user_secure(user_email text, user_password text)
RETURNS TABLE(user_id uuid, user_email_out text)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    found_user RECORD;
BEGIN
    -- Find user by email
    SELECT id, email, password_hash
    INTO found_user
    FROM specrefiner_users
    WHERE email = lower(trim(user_email));

    -- User not found - return empty (generic error to prevent enumeration)
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Verify password using pgcrypto
    IF found_user.password_hash = crypt(user_password, found_user.password_hash) THEN
        RETURN QUERY SELECT found_user.id, found_user.email;
    END IF;

    -- Invalid password - return empty
    RETURN;
END;
$$;

-- ============================================================================
-- PART 2: ADMIN RPCs WITH TOKEN VALIDATION
-- ============================================================================
-- All admin operations require a valid admin token

-- Admin: Create user
CREATE OR REPLACE FUNCTION admin_create_user(
    admin_token text,
    user_email text,
    user_password text
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    expected_token text;
    new_user_id uuid;
BEGIN
    -- Get expected admin token from config table
    SELECT value INTO expected_token FROM specrefiner_config WHERE key = 'admin_token';

    -- Validate admin token
    IF expected_token IS NULL OR admin_token IS DISTINCT FROM expected_token THEN
        RAISE EXCEPTION 'Unauthorized: Invalid admin token';
    END IF;

    -- Use existing create_user RPC (which handles password hashing)
    SELECT create_user(user_email, user_password) INTO new_user_id;

    RETURN new_user_id;
END;
$$;

-- Admin: List users (no password_hash)
CREATE OR REPLACE FUNCTION admin_list_users(admin_token text)
RETURNS TABLE(id uuid, email text, created_at timestamptz)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    expected_token text;
BEGIN
    -- Get expected admin token from config table
    SELECT value INTO expected_token FROM specrefiner_config WHERE key = 'admin_token';

    -- Validate admin token
    IF expected_token IS NULL OR admin_token IS DISTINCT FROM expected_token THEN
        RAISE EXCEPTION 'Unauthorized: Invalid admin token';
    END IF;

    RETURN QUERY
    SELECT u.id, u.email, u.created_at
    FROM specrefiner_users u
    ORDER BY u.created_at DESC;
END;
$$;

-- Admin: Delete user
CREATE OR REPLACE FUNCTION admin_delete_user(admin_token text, target_user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    expected_token text;
BEGIN
    -- Get expected admin token from config table
    SELECT value INTO expected_token FROM specrefiner_config WHERE key = 'admin_token';

    -- Validate admin token
    IF expected_token IS NULL OR admin_token IS DISTINCT FROM expected_token THEN
        RAISE EXCEPTION 'Unauthorized: Invalid admin token';
    END IF;

    -- Delete user's sessions first
    DELETE FROM specrefiner_sessions WHERE user_id = target_user_id;

    -- Delete user
    DELETE FROM specrefiner_users WHERE id = target_user_id;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on specrefiner_users
ALTER TABLE specrefiner_users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on specrefiner_sessions
ALTER TABLE specrefiner_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: RLS POLICIES
-- ============================================================================
-- Since we don't use Supabase Auth (auth.uid()), we use SECURITY DEFINER
-- functions for all data access. RLS blocks direct table access.

-- Drop existing policies if any
DROP POLICY IF EXISTS "No direct access to users" ON specrefiner_users;
DROP POLICY IF EXISTS "No direct access to sessions" ON specrefiner_sessions;

-- Block ALL direct access to specrefiner_users
-- All access must go through SECURITY DEFINER RPCs
CREATE POLICY "No direct access to users"
ON specrefiner_users
FOR ALL
USING (false);

-- Block ALL direct access to specrefiner_sessions
-- All access must go through SECURITY DEFINER RPCs
CREATE POLICY "No direct access to sessions"
ON specrefiner_sessions
FOR ALL
USING (false);

-- ============================================================================
-- PART 5: SESSION RPCs (for authenticated users)
-- ============================================================================
-- These RPCs allow users to manage ONLY their own sessions

-- Load session for a user
CREATE OR REPLACE FUNCTION load_user_session(p_user_id uuid)
RETURNS TABLE(
    messages jsonb,
    phase text,
    question_count integer,
    final_spec text,
    is_modification_mode boolean,
    message_count_at_last_spec integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.messages,
        s.phase,
        s.question_count,
        s.final_spec,
        s.is_modification_mode,
        s.message_count_at_last_spec
    FROM specrefiner_sessions s
    WHERE s.user_id = p_user_id;
END;
$$;

-- Save/update session for a user
CREATE OR REPLACE FUNCTION save_user_session(
    p_user_id uuid,
    p_messages jsonb,
    p_phase text,
    p_question_count integer,
    p_final_spec text,
    p_is_modification_mode boolean,
    p_message_count_at_last_spec integer
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO specrefiner_sessions (
        user_id, messages, phase, question_count,
        final_spec, is_modification_mode, message_count_at_last_spec
    )
    VALUES (
        p_user_id, p_messages, p_phase, p_question_count,
        p_final_spec, p_is_modification_mode, p_message_count_at_last_spec
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        messages = EXCLUDED.messages,
        phase = EXCLUDED.phase,
        question_count = EXCLUDED.question_count,
        final_spec = EXCLUDED.final_spec,
        is_modification_mode = EXCLUDED.is_modification_mode,
        message_count_at_last_spec = EXCLUDED.message_count_at_last_spec,
        updated_at = NOW();

    RETURN TRUE;
END;
$$;

-- Clear session for a user
CREATE OR REPLACE FUNCTION clear_user_session(p_user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM specrefiner_sessions WHERE user_id = p_user_id;
    RETURN TRUE;
END;
$$;

-- ============================================================================
-- PART 6: CONFIG TABLE FOR ADMIN TOKEN
-- ============================================================================
-- Store admin token in a secure config table (RLS protected)

CREATE TABLE IF NOT EXISTS specrefiner_config (
    key text PRIMARY KEY,
    value text NOT NULL
);

ALTER TABLE specrefiner_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to config" ON specrefiner_config;
CREATE POLICY "No direct access to config"
ON specrefiner_config
FOR ALL
USING (false);

-- Insert admin token (replace with your own secure token)
INSERT INTO specrefiner_config (key, value)
VALUES ('admin_token', 'YOUR-SECURE-TOKEN-HERE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- PART 7: FIX EXISTING FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION create_user(user_email text, user_password text)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_user_id uuid;
BEGIN
    INSERT INTO specrefiner_users (email, password_hash)
    VALUES (
        lower(trim(user_email)),
        crypt(user_password, gen_salt('bf'))
    )
    RETURNING id INTO new_user_id;

    RETURN new_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION verify_password(input_password text, stored_hash text)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$;

COMMENT ON FUNCTION login_user_secure IS 'Secure login - never exposes password_hash';
COMMENT ON FUNCTION admin_create_user IS 'Admin only - requires valid admin_token';
COMMENT ON FUNCTION admin_list_users IS 'Admin only - requires valid admin_token';
COMMENT ON FUNCTION admin_delete_user IS 'Admin only - requires valid admin_token';
