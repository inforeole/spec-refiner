/**
 * Helpers pour appeler les Edge Functions proxy (OpenRouter, Inworld) de façon
 * authentifiée.
 *
 * Les clés API tierces (OpenRouter, Inworld) vivent côté serveur, dans les
 * secrets des Edge Functions — plus jamais dans le bundle front. Le client ne
 * présente que :
 *   - l'anon key Supabase (publique par design, protégée par RLS),
 *   - son token de session applicatif (X-Session-Token), émis au login et
 *     vérifié par la function via verify_session_token.
 */

export const AUTH_STORAGE_KEY = 'spec-refiner-auth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Récupère le token de session de l'utilisateur connecté.
 * @returns {string|null}
 */
export function getSessionToken() {
    try {
        const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.sessionToken ?? null;
    } catch {
        return null;
    }
}

/**
 * URL d'une Edge Function Supabase.
 * @param {string} name - Nom de la function (ex: 'openrouter', 'inworld')
 * @returns {string}
 */
export function functionUrl(name) {
    return `${SUPABASE_URL}/functions/v1/${name}`;
}

/**
 * En-têtes pour un appel authentifié à une Edge Function.
 * @returns {Object}
 * @throws {Error} si aucun token de session (utilisateur non connecté / expiré)
 */
export function functionHeaders() {
    const token = getSessionToken();
    if (!token) {
        throw new Error('Session expirée. Reconnecte-toi pour continuer.');
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'X-Session-Token': token,
    };
}
