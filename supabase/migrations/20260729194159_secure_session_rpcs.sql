-- ============================================================================
-- MIGRATION: RPC de session liées au token authentifié
-- ============================================================================
-- Les anciennes RPC acceptent un user_id arbitraire fourni par le client.
-- Les RPC v2 résolvent toujours le propriétaire depuis le token de session.
-- Les anciennes signatures restent temporairement disponibles pour permettre
-- un déploiement progressif du client, puis seront révoquées séparément.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_specrefiner_session_user(
    p_session_token uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    IF p_session_token IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT t.user_id
    INTO v_user_id
    FROM public.specrefiner_auth_tokens AS t
    WHERE t.token = p_session_token
      AND t.expires_at > now();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_specrefiner_session_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_specrefiner_session_user(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_specrefiner_session_user(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.load_user_session_v2(
    p_session_token uuid
)
RETURNS TABLE(
    messages jsonb,
    phase text,
    question_count integer,
    final_spec text,
    is_modification_mode boolean,
    message_count_at_last_spec integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := public.resolve_specrefiner_session_user(p_session_token);

    RETURN QUERY
    SELECT
        s.messages,
        s.phase,
        s.question_count,
        s.final_spec,
        s.is_modification_mode,
        s.message_count_at_last_spec
    FROM public.specrefiner_sessions AS s
    WHERE s.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.load_user_session_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.load_user_session_v2(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.load_user_session_v2(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.load_user_session_v2(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.save_user_session_v2(
    p_session_token uuid,
    p_messages jsonb,
    p_phase text,
    p_question_count integer,
    p_final_spec text,
    p_is_modification_mode boolean,
    p_message_count_at_last_spec integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := public.resolve_specrefiner_session_user(p_session_token);

    INSERT INTO public.specrefiner_sessions (
        user_id,
        messages,
        phase,
        question_count,
        final_spec,
        is_modification_mode,
        message_count_at_last_spec
    )
    VALUES (
        v_user_id,
        p_messages,
        p_phase,
        p_question_count,
        p_final_spec,
        p_is_modification_mode,
        p_message_count_at_last_spec
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        messages = EXCLUDED.messages,
        phase = EXCLUDED.phase,
        question_count = EXCLUDED.question_count,
        final_spec = EXCLUDED.final_spec,
        is_modification_mode = EXCLUDED.is_modification_mode,
        message_count_at_last_spec = EXCLUDED.message_count_at_last_spec,
        updated_at = now();

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_session_v2(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_user_session_v2(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
) FROM anon;
REVOKE ALL ON FUNCTION public.save_user_session_v2(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_session_v2(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
) TO anon;

CREATE OR REPLACE FUNCTION public.clear_user_session_v2(
    p_session_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := public.resolve_specrefiner_session_user(p_session_token);

    DELETE FROM public.specrefiner_sessions
    WHERE user_id = v_user_id;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_user_session_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_user_session_v2(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.clear_user_session_v2(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.clear_user_session_v2(uuid) TO anon;

-- Cette fonction ne doit être appelée que par admin_create_user.
REVOKE ALL ON FUNCTION public.create_user(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_user(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_user(text, text) FROM authenticated;

COMMENT ON FUNCTION public.resolve_specrefiner_session_user(uuid)
IS 'Interne: résout un token de session valide en user_id';

COMMENT ON FUNCTION public.load_user_session_v2(uuid)
IS 'Charge uniquement la session associée au token fourni';

COMMENT ON FUNCTION public.save_user_session_v2(uuid, jsonb, text, integer, text, boolean, integer)
IS 'Sauvegarde uniquement la session associée au token fourni';

COMMENT ON FUNCTION public.clear_user_session_v2(uuid)
IS 'Supprime uniquement la session associée au token fourni';
