-- Limite atomiquement les appels coûteux aux proxies IA par utilisateur.
-- Une seule ligne est conservée par couple utilisateur/endpoint.
CREATE TABLE IF NOT EXISTS specrefiner_api_rate_limits (
    user_id uuid NOT NULL REFERENCES specrefiner_users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    window_started_at timestamptz NOT NULL DEFAULT now(),
    request_count integer NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, endpoint),
    CONSTRAINT specrefiner_api_rate_limits_endpoint_check
        CHECK (endpoint IN ('openrouter', 'inworld')),
    CONSTRAINT specrefiner_api_rate_limits_request_count_check
        CHECK (request_count > 0)
);

ALTER TABLE specrefiner_api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access to API rate limits"
ON specrefiner_api_rate_limits;

CREATE POLICY "No direct access to API rate limits"
ON specrefiner_api_rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

REVOKE ALL ON TABLE specrefiner_api_rate_limits FROM anon;
REVOKE ALL ON TABLE specrefiner_api_rate_limits FROM authenticated;

CREATE OR REPLACE FUNCTION consume_specrefiner_api_rate_limit(
    p_token uuid,
    p_endpoint text,
    p_limit integer,
    p_window_seconds integer
)
RETURNS TABLE(user_id uuid, allowed boolean)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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

    SELECT t.user_id
    INTO v_user_id
    FROM specrefiner_auth_tokens t
    WHERE t.token = p_token
      AND t.expires_at > now();

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO specrefiner_api_rate_limits (
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
    ON CONFLICT (user_id, endpoint)
    DO UPDATE SET
        window_started_at = CASE
            WHEN specrefiner_api_rate_limits.window_started_at
                <= now() - make_interval(secs => p_window_seconds)
            THEN now()
            ELSE specrefiner_api_rate_limits.window_started_at
        END,
        request_count = CASE
            WHEN specrefiner_api_rate_limits.window_started_at
                <= now() - make_interval(secs => p_window_seconds)
            THEN 1
            ELSE specrefiner_api_rate_limits.request_count + 1
        END
    RETURNING specrefiner_api_rate_limits.request_count
    INTO v_request_count;

    RETURN QUERY
    SELECT v_user_id, v_request_count <= p_limit;
END;
$$;

REVOKE ALL
ON FUNCTION consume_specrefiner_api_rate_limit(uuid, text, integer, integer)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION consume_specrefiner_api_rate_limit(uuid, text, integer, integer)
FROM anon;

REVOKE ALL
ON FUNCTION consume_specrefiner_api_rate_limit(uuid, text, integer, integer)
FROM authenticated;

GRANT EXECUTE
ON FUNCTION consume_specrefiner_api_rate_limit(uuid, text, integer, integer)
TO service_role;

COMMENT ON TABLE specrefiner_api_rate_limits IS
    'Compteurs atomiques des proxies IA, une ligne par utilisateur et endpoint';

COMMENT ON FUNCTION consume_specrefiner_api_rate_limit IS
    'Valide un token de session et consomme atomiquement son quota de proxy IA';
