-- Les RPC v2 liées au token ont été validées avec deux utilisateurs et deux
-- tokens temporaires distincts avant cette révocation.
REVOKE ALL
ON FUNCTION public.load_user_session(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.load_user_session(uuid)
FROM anon;

REVOKE ALL
ON FUNCTION public.load_user_session(uuid)
FROM authenticated;

REVOKE ALL
ON FUNCTION public.load_user_session(uuid)
FROM service_role;

REVOKE ALL
ON FUNCTION public.save_user_session(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.save_user_session(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
)
FROM anon;

REVOKE ALL
ON FUNCTION public.save_user_session(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
)
FROM authenticated;

REVOKE ALL
ON FUNCTION public.save_user_session(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
)
FROM service_role;

REVOKE ALL
ON FUNCTION public.clear_user_session(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.clear_user_session(uuid)
FROM anon;

REVOKE ALL
ON FUNCTION public.clear_user_session(uuid)
FROM authenticated;

REVOKE ALL
ON FUNCTION public.clear_user_session(uuid)
FROM service_role;

COMMENT ON FUNCTION public.load_user_session(uuid)
IS 'Obsolète: exécution révoquée, utiliser load_user_session_v2 avec un token';

COMMENT ON FUNCTION public.save_user_session(
    uuid,
    jsonb,
    text,
    integer,
    text,
    boolean,
    integer
)
IS 'Obsolète: exécution révoquée, utiliser save_user_session_v2 avec un token';

COMMENT ON FUNCTION public.clear_user_session(uuid)
IS 'Obsolète: exécution révoquée, utiliser clear_user_session_v2 avec un token';
