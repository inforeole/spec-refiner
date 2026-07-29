-- Corrige l'ambiguïté entre le paramètre de sortie user_id et la colonne
-- homonyme dans la clause ON CONFLICT du rate limiter.
CREATE OR REPLACE FUNCTION public.consume_specrefiner_api_rate_limit(
    p_token uuid,
    p_endpoint text,
    p_limit integer,
    p_window_seconds integer
)
RETURNS TABLE(user_id uuid, allowed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_request_count integer;
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
        RAISE EXCEPTION 'Invalid rate limit'
            USING ERRCODE = '22023';
    END IF;

    IF p_window_seconds IS NULL
        OR p_window_seconds < 1
        OR p_window_seconds > 86400
    THEN
        RAISE EXCEPTION 'Invalid rate limit window'
            USING ERRCODE = '22023';
    END IF;

    IF p_endpoint IS NULL OR p_endpoint NOT IN ('openrouter', 'inworld') THEN
        RAISE EXCEPTION 'Invalid rate limit endpoint'
            USING ERRCODE = '22023';
    END IF;

    SELECT token.user_id
    INTO v_user_id
    FROM public.specrefiner_auth_tokens AS token
    WHERE token.token = p_token
      AND token.expires_at > now();

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.specrefiner_api_rate_limits AS rate_limit (
        user_id,
        endpoint,
        window_started_at,
        request_count
    )
    VALUES (
        v_user_id,
        p_endpoint,
        now(),
        1
    )
    ON CONFLICT ON CONSTRAINT specrefiner_api_rate_limits_pkey
    DO UPDATE SET
        window_started_at = CASE
            WHEN rate_limit.window_started_at
                <= now() - make_interval(secs => p_window_seconds)
            THEN now()
            ELSE rate_limit.window_started_at
        END,
        request_count = CASE
            WHEN rate_limit.window_started_at
                <= now() - make_interval(secs => p_window_seconds)
            THEN 1
            ELSE rate_limit.request_count + 1
        END
    RETURNING rate_limit.request_count
    INTO v_request_count;

    RETURN QUERY
    SELECT v_user_id, v_request_count <= p_limit;
END;
$$;

REVOKE ALL
ON FUNCTION public.consume_specrefiner_api_rate_limit(uuid, text, integer, integer)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.consume_specrefiner_api_rate_limit(uuid, text, integer, integer)
FROM anon;

REVOKE ALL
ON FUNCTION public.consume_specrefiner_api_rate_limit(uuid, text, integer, integer)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION public.consume_specrefiner_api_rate_limit(uuid, text, integer, integer)
TO service_role;

COMMENT ON FUNCTION public.consume_specrefiner_api_rate_limit(
    uuid,
    text,
    integer,
    integer
)
IS 'Valide un token de session et consomme atomiquement son quota de proxy IA';
