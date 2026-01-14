/**
 * User authentication and management service
 * Uses secure RPC functions - never exposes password_hash to client
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { validateEmail, validatePassword, sanitizeEmail } from '../utils/validation';

/**
 * Get admin token from environment
 * @returns {string|null}
 */
function getAdminToken() {
    const token = import.meta.env.VITE_ADMIN_TOKEN;
    return token ? token.replace(/^["']|["']$/g, '').trim() : null;
}

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
            user: { id: userData.user_id, email: userData.user_email_out },
            error: null
        };
    } catch (e) {
        console.error('Login failed:', e);
        return { user: null, error: `Erreur de connexion: ${e.message}` };
    }
}

/**
 * Create a new user (admin only)
 * Requires valid admin token
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
    const adminToken = getAdminToken();

    if (!adminToken) {
        return { user: null, error: 'Token admin non configuré (VITE_ADMIN_TOKEN)' };
    }

    try {
        // Use admin RPC with token validation
        const { data: userId, error: createError } = await supabase.rpc('admin_create_user', {
            admin_token: adminToken,
            user_email: normalizedEmail,
            user_password: password
        });

        if (createError) {
            if (createError.message?.includes('duplicate') || createError.message?.includes('unique')) {
                return { user: null, error: 'Cet email existe déjà' };
            }
            if (createError.message?.includes('Unauthorized')) {
                return { user: null, error: 'Token admin invalide' };
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
 * Requires valid admin token
 * @returns {Promise<{users: Array<{id: string, email: string, created_at: string}>, error: string | null}>}
 */
export async function listUsers() {
    if (!isSupabaseConfigured()) {
        return { users: [], error: 'Supabase non configuré' };
    }

    const adminToken = getAdminToken();

    if (!adminToken) {
        return { users: [], error: 'Token admin non configuré (VITE_ADMIN_TOKEN)' };
    }

    try {
        const { data, error } = await supabase.rpc('admin_list_users', {
            admin_token: adminToken
        });

        if (error) {
            if (error.message?.includes('Unauthorized')) {
                return { users: [], error: 'Token admin invalide' };
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
 * Requires valid admin token
 * @param {string} userId
 * @returns {Promise<{success: boolean, error: string | null}>}
 */
export async function deleteUser(userId) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    const adminToken = getAdminToken();

    if (!adminToken) {
        return { success: false, error: 'Token admin non configuré (VITE_ADMIN_TOKEN)' };
    }

    try {
        const { error } = await supabase.rpc('admin_delete_user', {
            admin_token: adminToken,
            target_user_id: userId
        });

        if (error) {
            if (error.message?.includes('Unauthorized')) {
                return { success: false, error: 'Token admin invalide' };
            }
            throw error;
        }

        return { success: true, error: null };
    } catch (e) {
        console.error('Delete user failed:', e);
        return { success: false, error: `Erreur de suppression: ${e.message}` };
    }
}
