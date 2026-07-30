/**
 * User authentication and management service
 * Uses secure RPC functions - never exposes password_hash to client
 *
 * Autorisation admin: repose sur le token de session (émis au login, vérifié
 * côté serveur) + le flag is_admin. Plus aucun secret admin dans le bundle front
 * (ni VITE_ADMIN_TOKEN, ni VITE_APP_PASSWORD).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getSessionToken } from '../lib/apiClient';
import { validateEmail, validatePassword, sanitizeEmail } from '../utils/validation';

/**
 * Login user with email and password
 * Uses secure RPC that never exposes password_hash
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: {id: string, email: string} | null, error: string | null}>}
 */
export async function loginUser(email, password) {
    if (!isSupabaseConfigured()) {
        return { user: null, error: 'Supabase non configuré' };
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        return { user: null, error: emailValidation.error };
    }

    const normalizedEmail = sanitizeEmail(email);

    try {
        // Use secure login RPC - never returns password_hash
        const { data, error: loginError } = await supabase.rpc('login_user_secure', {
            user_email: normalizedEmail,
            user_password: password
        });

        if (loginError) {
            console.error('Login RPC error:', loginError);
            throw loginError;
        }

        // RPC returns empty array if login failed
        if (!data || data.length === 0) {
            return { user: null, error: 'Email ou mot de passe incorrect' };
        }

        const userData = data[0];
        return {
            user: {
                id: userData.user_id,
                email: userData.user_email_out,
                // Token de session pour authentifier les Edge Functions proxy
                sessionToken: userData.session_token
            },
            error: null
        };
    } catch (e) {
        console.error('Login failed:', e);
        return { user: null, error: `Erreur de connexion: ${e.message}` };
    }
}

/**
 * Invalide le token de session côté serveur (logout).
 * Best-effort: n'échoue pas l'UX si l'appel réseau rate.
 * @param {string} sessionToken
 * @returns {Promise<void>}
 */
export async function logoutSession(sessionToken) {
    if (!isSupabaseConfigured() || !sessionToken) {
        return;
    }
    try {
        await supabase.rpc('logout_session', { p_token: sessionToken });
    } catch (e) {
        console.warn('logout_session failed:', e.message);
    }
}

/**
 * Indique si l'utilisateur connecté est administrateur.
 * Vérifié côté serveur (token de session + flag is_admin), jamais dans le front.
 * @returns {Promise<boolean>}
 */
export async function checkIsAdmin() {
    if (!isSupabaseConfigured()) {
        return false;
    }
    const sessionToken = getSessionToken();
    if (!sessionToken) {
        return false;
    }
    try {
        const { data, error } = await supabase.rpc('is_session_admin', {
            p_session_token: sessionToken
        });
        if (error) {
            console.error('is_session_admin error:', error);
            return false;
        }
        return data === true;
    } catch (e) {
        console.error('checkIsAdmin failed:', e);
        return false;
    }
}

/**
 * Create a new user (admin only)
 * L'autorisation est vérifiée côté serveur via le token de session + is_admin.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: {id: string, email: string} | null, error: string | null}>}
 */
export async function createUser(email, password) {
    if (!isSupabaseConfigured()) {
        return { user: null, error: 'Supabase non configuré' };
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
        return { user: null, error: emailValidation.error };
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        return { user: null, error: passwordValidation.error };
    }

    const normalizedEmail = sanitizeEmail(email);
    const sessionToken = getSessionToken();

    if (!sessionToken) {
        return { user: null, error: 'Session expirée. Reconnecte-toi.' };
    }

    try {
        // RPC admin: autorisation par token de session + is_admin (côté serveur)
        const { data: userId, error: createError } = await supabase.rpc('admin_create_user', {
            p_session_token: sessionToken,
            user_email: normalizedEmail,
            user_password: password
        });

        if (createError) {
            if (createError.message?.includes('duplicate') || createError.message?.includes('unique')) {
                return { user: null, error: 'Cet email existe déjà' };
            }
            if (createError.message?.includes('Unauthorized')) {
                return { user: null, error: 'Accès réservé aux administrateurs' };
            }
            throw createError;
        }

        return {
            user: { id: userId, email: normalizedEmail },
            error: null
        };
    } catch (e) {
        console.error('Create user failed:', e);
        return { user: null, error: `Erreur de création: ${e.message}` };
    }
}

/**
 * List all users (admin only)
 * L'autorisation est vérifiée côté serveur via le token de session + is_admin.
 * @returns {Promise<{users: Array<{id: string, email: string, created_at: string}>, error: string | null}>}
 */
export async function listUsers() {
    if (!isSupabaseConfigured()) {
        return { users: [], error: 'Supabase non configuré' };
    }

    const sessionToken = getSessionToken();

    if (!sessionToken) {
        return { users: [], error: 'Session expirée. Reconnecte-toi.' };
    }

    try {
        const { data, error } = await supabase.rpc('admin_list_users', {
            p_session_token: sessionToken
        });

        if (error) {
            if (error.message?.includes('Unauthorized')) {
                return { users: [], error: 'Accès réservé aux administrateurs' };
            }
            throw error;
        }

        return { users: data || [], error: null };
    } catch (e) {
        console.error('List users failed:', e);
        return { users: [], error: `Erreur: ${e.message}` };
    }
}

/**
 * Delete a user (admin only)
 * L'autorisation est vérifiée côté serveur via le token de session + is_admin.
 * @param {string} userId
 * @returns {Promise<{success: boolean, error: string | null}>}
 */
export async function deleteUser(userId) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    const sessionToken = getSessionToken();

    if (!sessionToken) {
        return { success: false, error: 'Session expirée. Reconnecte-toi.' };
    }

    try {
        const { error } = await supabase.rpc('admin_delete_user', {
            p_session_token: sessionToken,
            target_user_id: userId
        });

        if (error) {
            if (error.message?.includes('Unauthorized')) {
                return { success: false, error: 'Accès réservé aux administrateurs' };
            }
            throw error;
        }

        return { success: true, error: null };
    } catch (e) {
        console.error('Delete user failed:', e);
        return { success: false, error: `Erreur de suppression: ${e.message}` };
    }
}

/**
 * Reset one client's project while keeping the account.
 * The RPC returns the previous messages so referenced images can be cleaned up.
 * @param {string} userId
 * @returns {Promise<{messages: Array, error: string | null}>}
 */
export async function resetUserProject(userId) {
    if (!isSupabaseConfigured()) {
        return { messages: [], error: 'Supabase non configuré' };
    }

    const sessionToken = getSessionToken();
    if (!sessionToken) {
        return { messages: [], error: 'Session expirée. Reconnecte-toi.' };
    }

    try {
        const { data, error } = await supabase.rpc('admin_reset_user_project', {
            p_session_token: sessionToken,
            p_target_user_id: userId
        });
        if (error) {
            if (error.message?.includes('Unauthorized')) {
                return {
                    messages: [],
                    error: 'Accès réservé aux administrateurs'
                };
            }
            throw error;
        }

        const messages = Array.isArray(data?.[0]?.messages)
            ? data[0].messages
            : Array.isArray(data)
                ? data
                : Array.isArray(data?.messages)
                    ? data.messages
                    : [];
        return { messages, error: null };
    } catch (error) {
        console.error('Reset user project failed:', error);
        return {
            messages: [],
            error: `Erreur de réinitialisation: ${error.message}`
        };
    }
}
