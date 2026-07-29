-- ============================================================================
-- MIGRATION 002: Session tokens for authenticating the server-side API proxy
-- ============================================================================
-- Contexte: les clés API tierces (OpenRouter, Inworld) étaient exposées dans le
-- bundle front (préfixe VITE_). Elles passent désormais par des Edge Functions
-- qui détiennent les clés côté serveur. Pour éviter que ces proxies soient des
-- relais ouverts, chaque appel doit présenter un token de session émis au login.
--
-- Cette migration:
-- 1. Crée la table specrefiner_auth_tokens (RLS: aucun accès direct)
-- 2. Fait émettre un token par login_user_secure (rétro-compatible: colonnes
--    existantes conservées, session_token ajouté en fin de sortie)
-- 3. Ajoute verify_session_token (utilisée par les Edge Functions, service_role)
-- 4. Ajoute logout_session (invalidation côté serveur)
-- ============================================================================

-- ============================================================================
-- PART 1: TABLE DES TOKENS DE SESSION
-- ============================================================================
CREATE TABLE IF NOT EXISTS specrefiner_auth_tokens (
    token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES specrefiner_users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON specrefiner_auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON specrefiner_auth_tokens(expires_at);

-- RLS: aucun accès direct au client, tout passe par des RPC SECURITY DEFINER
ALTER TABLE specrefiner_auth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct access to auth tokens" ON specrefiner_auth_tokens;
CREATE POLICY "No direct access to auth tokens"
ON specrefiner_auth_tokens
FOR ALL
USING (false);

-- ============================================================================
-- PART 2: LOGIN AVEC ÉMISSION DE TOKEN (rétro-compatible)
-- ============================================================================
-- La signature de sortie ajoute session_token en dernier. Les anciens clients
-- qui lisent user_id / user_email_out continuent de fonctionner.
DROP FUNCTION IF EXISTS login_user_secure(text, text);

CREATE OR REPLACE FUNCTION login_user_secure(user_email text, user_password text)
RETURNS TABLE(user_id uuid, user_email_out text, session_token uuid)
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql
AS $$
DECLARE
    found_user RECORD;
    new_token uuid;
BEGIN
    -- Trouver l'utilisateur par email
    SELECT id, email, password_hash
    INTO found_user
    FROM specrefiner_users
    WHERE email = lower(trim(user_email));

    -- Utilisateur introuvable: sortie vide (erreur générique anti-énumération)
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Vérifier le mot de passe via pgcrypto
    IF found_user.password_hash = crypt(user_password, found_user.password_hash) THEN
        -- Hygiène opportuniste: purger les tokens expirés de cet utilisateur
        DELETE FROM specrefiner_auth_tokens
        WHERE specrefiner_auth_tokens.user_id = found_user.id
          AND expires_at <= now();

        -- Émettre un nouveau token de session
        INSERT INTO specrefiner_auth_tokens (user_id)
        VALUES (found_user.id)
        RETURNING token INTO new_token;

        RETURN QUERY SELECT found_user.id, found_user.email::text, new_token;
    END IF;

    -- Mot de passe invalide: sortie vide
    RETURN;
END;
$$;

-- ============================================================================
-- PART 3: VÉRIFICATION DE TOKEN (appelée par les Edge Functions)
-- ============================================================================
-- Retourne l'user_id si le token existe et n'est pas expiré, sinon NULL.
CREATE OR REPLACE FUNCTION verify_session_token(p_token uuid)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    found_user_id uuid;
BEGIN
    IF p_token IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT t.user_id INTO found_user_id
    FROM specrefiner_auth_tokens t
    WHERE t.token = p_token
      AND t.expires_at > now();

    RETURN found_user_id; -- NULL si non trouvé / expiré
END;
$$;

-- Moindre privilège: seule la service_role (Edge Functions) peut vérifier un token.
REVOKE ALL ON FUNCTION verify_session_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION verify_session_token(uuid) FROM anon;
REVOKE ALL ON FUNCTION verify_session_token(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION verify_session_token(uuid) TO service_role;

-- ============================================================================
-- PART 4: LOGOUT (invalidation côté serveur)
-- ============================================================================
CREATE OR REPLACE FUNCTION logout_session(p_token uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM specrefiner_auth_tokens WHERE token = p_token;
    RETURN TRUE;
END;
$$;

COMMENT ON TABLE specrefiner_auth_tokens IS 'Tokens de session opaques pour authentifier les Edge Functions proxy (OpenRouter, Inworld)';
COMMENT ON FUNCTION login_user_secure IS 'Login sécurisé + émission d''un token de session (jamais password_hash)';
COMMENT ON FUNCTION verify_session_token IS 'Valide un token de session (service_role uniquement) - utilisée par les Edge Functions proxy';
COMMENT ON FUNCTION logout_session IS 'Invalide un token de session côté serveur';
