-- ============================================================================
-- Guided single-spec sessions and immutable specification versions
-- ============================================================================

ALTER TABLE public.specrefiner_sessions
    ADD COLUMN IF NOT EXISTS spec_model jsonb NOT NULL
    DEFAULT '{"schemaVersion":1}'::jsonb;

CREATE TABLE public.specrefiner_spec_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.specrefiner_users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    content text NOT NULL CHECK (length(btrim(content)) > 0),
    source_message_count integer NOT NULL CHECK (source_message_count >= 0),
    generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, request_id)
);

CREATE INDEX specrefiner_spec_versions_user_generated_idx
ON public.specrefiner_spec_versions(user_id, generated_at DESC, id DESC);

ALTER TABLE public.specrefiner_spec_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specrefiner_spec_versions FROM PUBLIC, anon, authenticated;

INSERT INTO public.specrefiner_spec_versions (
    user_id,
    request_id,
    content,
    source_message_count,
    generated_at
)
SELECT
    s.user_id,
    (
        substr(md5(s.user_id::text || ':legacy-final-spec'), 1, 8) || '-' ||
        substr(md5(s.user_id::text || ':legacy-final-spec'), 9, 4) || '-' ||
        substr(md5(s.user_id::text || ':legacy-final-spec'), 13, 4) || '-' ||
        substr(md5(s.user_id::text || ':legacy-final-spec'), 17, 4) || '-' ||
        substr(md5(s.user_id::text || ':legacy-final-spec'), 21, 12)
    )::uuid,
    s.final_spec,
    jsonb_array_length(COALESCE(s.messages, '[]'::jsonb)),
    COALESCE(s.updated_at, now())
FROM public.specrefiner_sessions AS s
WHERE length(btrim(COALESCE(s.final_spec, ''))) > 0
ON CONFLICT (user_id, request_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.load_user_session_v3(
    p_session_token uuid
)
RETURNS TABLE(
    messages jsonb,
    phase text,
    question_count integer,
    final_spec text,
    is_modification_mode boolean,
    message_count_at_last_spec integer,
    spec_model jsonb
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
        s.message_count_at_last_spec,
        s.spec_model
    FROM public.specrefiner_sessions AS s
    WHERE s.user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_user_session_v3(
    p_session_token uuid,
    p_messages jsonb,
    p_phase text,
    p_question_count integer,
    p_final_spec text,
    p_is_modification_mode boolean,
    p_message_count_at_last_spec integer,
    p_spec_model jsonb
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
        message_count_at_last_spec,
        spec_model
    )
    VALUES (
        v_user_id,
        p_messages,
        p_phase,
        p_question_count,
        p_final_spec,
        p_is_modification_mode,
        p_message_count_at_last_spec,
        COALESCE(p_spec_model, '{"schemaVersion":1}'::jsonb)
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        messages = EXCLUDED.messages,
        phase = EXCLUDED.phase,
        question_count = EXCLUDED.question_count,
        final_spec = EXCLUDED.final_spec,
        is_modification_mode = EXCLUDED.is_modification_mode,
        message_count_at_last_spec = EXCLUDED.message_count_at_last_spec,
        spec_model = EXCLUDED.spec_model,
        updated_at = now();

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_spec_version(
    p_session_token uuid,
    p_request_id uuid,
    p_content text,
    p_source_message_count integer
)
RETURNS TABLE(
    id uuid,
    content text,
    source_message_count integer,
    generated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_version_id uuid;
BEGIN
    v_user_id := public.resolve_specrefiner_session_user(p_session_token);

    SELECT version.id
    INTO v_version_id
    FROM public.specrefiner_spec_versions AS version
    WHERE version.user_id = v_user_id
      AND version.request_id = p_request_id;

    IF v_version_id IS NULL THEN
        INSERT INTO public.specrefiner_spec_versions (
            user_id,
            request_id,
            content,
            source_message_count
        )
        VALUES (
            v_user_id,
            p_request_id,
            p_content,
            p_source_message_count
        )
        RETURNING specrefiner_spec_versions.id INTO v_version_id;

        UPDATE public.specrefiner_sessions AS session
        SET
            final_spec = p_content,
            message_count_at_last_spec = p_source_message_count,
            updated_at = now()
        WHERE session.user_id = v_user_id;

        WITH obsolete_versions AS (
            SELECT version.id
            FROM public.specrefiner_spec_versions AS version
            WHERE version.user_id = v_user_id
            ORDER BY version.generated_at DESC, version.id DESC
            OFFSET 6
        )
        DELETE FROM public.specrefiner_spec_versions AS version
        USING obsolete_versions
        WHERE version.id = obsolete_versions.id;
    END IF;

    RETURN QUERY
    SELECT
        version.id,
        version.content,
        version.source_message_count,
        version.generated_at
    FROM public.specrefiner_spec_versions AS version
    WHERE version.id = v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_spec_versions(
    p_session_token uuid
)
RETURNS TABLE(
    id uuid,
    content text,
    source_message_count integer,
    generated_at timestamptz
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
        version.id,
        version.content,
        version.source_message_count,
        version.generated_at
    FROM public.specrefiner_spec_versions AS version
    WHERE version.user_id = v_user_id
    ORDER BY version.generated_at DESC, version.id DESC
    LIMIT 6;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_user_project(
    p_session_token uuid,
    p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_old_messages jsonb;
BEGIN
    PERFORM public.assert_session_admin(p_session_token);

    SELECT session.messages
    INTO v_old_messages
    FROM public.specrefiner_sessions AS session
    WHERE session.user_id = p_target_user_id;

    DELETE FROM public.specrefiner_spec_versions
    WHERE user_id = p_target_user_id;

    DELETE FROM public.specrefiner_sessions
    WHERE user_id = p_target_user_id;

    RETURN COALESCE(v_old_messages, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.load_user_session_v3(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_user_session_v3(uuid, jsonb, text, integer, text, boolean, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_spec_version(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_spec_versions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reset_user_project(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_user_session_v2(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.load_user_session_v3(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.save_user_session_v3(uuid, jsonb, text, integer, text, boolean, integer, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.create_spec_version(uuid, uuid, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.list_spec_versions(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_project(uuid, uuid) TO anon;

COMMENT ON TABLE public.specrefiner_spec_versions
IS 'Six dernières versions horodatées et immuables de la spécification logique';

COMMENT ON FUNCTION public.admin_reset_user_project(uuid, uuid)
IS 'Admin uniquement: supprime le projet et renvoie les anciens messages pour nettoyer les fichiers';
