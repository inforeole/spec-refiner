-- ============================================================================
-- MIGRATION 003: Autorisation admin via token de session + flag is_admin
-- ============================================================================
-- Contexte: l'accès admin reposait sur DEUX secrets présents en clair dans le
-- bundle front (préfixe VITE_), tous deux exfiltrés dans le bundle Vercel pillé
-- le 2026-07-01:
--   - VITE_ADMIN_TOKEN  : secret partagé passé aux RPC admin_* et comparé à
--     specrefiner_config.admin_token. Présent dans le bundle => pillable.
--   - VITE_APP_PASSWORD : mot de passe "gate" admin comparé COTE CLIENT dans
--     AdminPage.jsx => contournable trivialement + présent dans le bundle.
--
-- Cette migration bascule l'autorisation admin sur le mécanisme déjà en place
-- (token de session opaque émis au login, table specrefiner_auth_tokens) + un
-- flag is_admin par utilisateur. Plus aucun secret admin côté client:
--   1. Ajoute specrefiner_users.is_admin
--   2. Promeut l'admin initial (compte le plus ancien) si aucun admin
--   3. assert_session_admin(token) — helper interne (lève si non-admin)
--   4. is_session_admin(token) — booléen non-levant pour gater l'UI admin
--   5. Réécrit admin_create_user / admin_list_users / admin_delete_user pour
--      prendre p_session_token (uuid) au lieu de admin_token (text)
--   6. Supprime l'ancien secret partagé (config admin_token)
-- ============================================================================

-- ============================================================================
-- PART 1: FLAG ADMIN
-- ============================================================================
ALTER TABLE specrefiner_users
    ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ============================================================================
-- PART 2: PROMOTION DE L'ADMIN INITIAL
-- ============================================================================
-- Filet anti-lockout: si personne n'est admin, promouvoir le compte le plus
-- ancien (le "fondateur"). Idempotent: ne fait rien si un admin existe déjà.
-- Pour promouvoir un autre compte:
--   UPDATE specrefiner_users SET is_admin = true WHERE email = 'x@y.z';
UPDATE specrefiner_users
SET is_admin = true
WHERE id = (SELECT id FROM specrefiner_users ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM specrefiner_users WHERE is_admin = true);

-- ============================================================================
-- PART 3: HELPER INTERNE — assert_session_admin
-- ============================================================================
-- Résout un token de session -> user_id, exige is_admin, lève sinon.
-- SECURITY DEFINER: lit auth_tokens / users malgré la RLS deny-all.
-- Non exposée au client (REVOKE): appelée uniquement par les RPC admin.
CREATE OR REPLACE FUNCTION assert_session_admin(p_session_token uuid)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
BEGIN
    IF p_session_token IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT t.user_id INTO v_user_id
    FROM specrefiner_auth_tokens t
    WHERE t.token = p_session_token
      AND t.expires_at > now();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT u.is_admin INTO v_is_admin
    FROM specrefiner_users u
    WHERE u.id = v_user_id;

    IF NOT COALESCE(v_is_admin, false) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION assert_session_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION assert_session_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION assert_session_admin(uuid) FROM authenticated;

-- ============================================================================
-- PART 4: is_session_admin — booléen pour gater l'UI admin (non-levant)
-- ============================================================================
CREATE OR REPLACE FUNCTION is_session_admin(p_session_token uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id uuid;
    v_is_admin boolean;
BEGIN
    IF p_session_token IS NULL THEN
        RETURN false;
    END IF;

    SELECT t.user_id INTO v_user_id
    FROM specrefiner_auth_tokens t
    WHERE t.token = p_session_token
      AND t.expires_at > now();

    IF v_user_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT u.is_admin INTO v_is_admin
    FROM specrefiner_users u
    WHERE u.id = v_user_id;

    RETURN COALESCE(v_is_admin, false);
END;
$$;

-- ============================================================================
-- PART 5: RÉÉCRITURE DES RPC ADMIN (session token au lieu d'admin_token)
-- ============================================================================
-- Le type du 1er argument change (text -> uuid) => ce sont de nouvelles
-- signatures. On DROP explicitement les anciennes pour ne pas laisser deux
-- versions coexister (l'ancienne resterait vulnérable via admin_token).
DROP FUNCTION IF EXISTS admin_create_user(text, text, text);
DROP FUNCTION IF EXISTS admin_list_users(text);
DROP FUNCTION IF EXISTS admin_delete_user(text, uuid);

-- Admin: créer un utilisateur
CREATE OR REPLACE FUNCTION admin_create_user(
    p_session_token uuid,
    user_email text,
    user_password text
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    new_user_id uuid;
BEGIN
    PERFORM assert_session_admin(p_session_token);
    SELECT create_user(user_email, user_password) INTO new_user_id;
    RETURN new_user_id;
END;
$$;

-- Admin: lister les utilisateurs (jamais password_hash)
CREATE OR REPLACE FUNCTION admin_list_users(p_session_token uuid)
RETURNS TABLE(id uuid, email text, created_at timestamptz)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM assert_session_admin(p_session_token);
    RETURN QUERY
    SELECT u.id, u.email::text, u.created_at
    FROM specrefiner_users u
    ORDER BY u.created_at DESC;
END;
$$;

-- Admin: supprimer un utilisateur
CREATE OR REPLACE FUNCTION admin_delete_user(p_session_token uuid, target_user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_admin_id uuid;
BEGIN
    v_admin_id := assert_session_admin(p_session_token);

    -- Filet anti-lockout: un admin ne peut pas supprimer son propre compte
    IF target_user_id = v_admin_id THEN
        RAISE EXCEPTION 'Un administrateur ne peut pas supprimer son propre compte';
    END IF;

    DELETE FROM specrefiner_auth_tokens WHERE user_id = target_user_id;
    DELETE FROM specrefiner_sessions WHERE user_id = target_user_id;
    DELETE FROM specrefiner_users WHERE id = target_user_id;
    RETURN TRUE;
END;
$$;

-- ============================================================================
-- PART 6: SUPPRESSION DE L'ANCIEN SECRET PARTAGÉ
-- ============================================================================
DELETE FROM specrefiner_config WHERE key = 'admin_token';

COMMENT ON FUNCTION assert_session_admin IS 'Interne: résout un token de session en user_id admin, lève Unauthorized sinon';
COMMENT ON FUNCTION is_session_admin IS 'Retourne true si le token de session appartient à un utilisateur is_admin';
COMMENT ON FUNCTION admin_create_user IS 'Admin only - autorisé par token de session + is_admin (plus d''admin_token)';
COMMENT ON FUNCTION admin_list_users IS 'Admin only - autorisé par token de session + is_admin (plus d''admin_token)';
COMMENT ON FUNCTION admin_delete_user IS 'Admin only - autorisé par token de session + is_admin (plus d''admin_token)';
