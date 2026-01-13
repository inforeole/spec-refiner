/**
 * User authentication and management service
 * Uses pgcrypto for password hashing via Supabase RPC functions
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Login user with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: {id: string, email: string} | null, error: string | null}>}
 */
export async function loginUser(email, password) {
    if (!isSupabaseConfigured()) {
        return { user: null, error: 'Supabase non configuré' };
    }

    try {
        // Get user by email
        const { data: userData, error: fetchError } = await supabase
            .from('specrefiner_users')
            .select('id, email, password_hash')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return { user: null, error: 'Email ou mot de passe incorrect' };
            }
            throw fetchError;
        }

        // Verify password using RPC function
        const { data: isValid, error: verifyError } = await supabase.rpc('verify_password', {
            input_password: password,
            stored_hash: userData.password_hash
        });

        if (verifyError) throw verifyError;

        if (!isValid) {
            return { user: null, error: 'Email ou mot de passe incorrect' };
        }

        return {
            user: { id: userData.id, email: userData.email },
            error: null
        };
    } catch (e) {
        console.error('Login failed:', e);
        return { user: null, error: `Erreur de connexion: ${e.message}` };
    }
}

/**
 * Create a new user (admin only)
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: {id: string, email: string} | null, error: string | null}>}
 */
export async function createUser(email, password) {
    if (!isSupabaseConfigured()) {
        return { user: null, error: 'Supabase non configuré' };
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail || !password) {
        return { user: null, error: 'Email et mot de passe requis' };
    }

    if (password.length < 6) {
        return { user: null, error: 'Le mot de passe doit faire au moins 6 caractères' };
    }

    try {
        // Create user via RPC (handles password hashing server-side)
        const { data: userId, error: createError } = await supabase.rpc('create_user', {
            user_email: normalizedEmail,
            user_password: password
        });

        if (createError) {
            if (createError.message?.includes('duplicate') || createError.message?.includes('unique')) {
                return { user: null, error: 'Cet email existe déjà' };
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
 * @returns {Promise<{users: Array<{id: string, email: string, created_at: string}>, error: string | null}>}
 */
export async function listUsers() {
    if (!isSupabaseConfigured()) {
        return { users: [], error: 'Supabase non configuré' };
    }

    try {
        const { data, error } = await supabase
            .from('specrefiner_users')
            .select('id, email, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { users: data || [], error: null };
    } catch (e) {
        console.error('List users failed:', e);
        return { users: [], error: `Erreur: ${e.message}` };
    }
}

/**
 * Delete a user (admin only)
 * @param {string} userId
 * @returns {Promise<{success: boolean, error: string | null}>}
 */
export async function deleteUser(userId) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    try {
        const { error } = await supabase
            .from('specrefiner_users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        return { success: true, error: null };
    } catch (e) {
        console.error('Delete user failed:', e);
        return { success: false, error: `Erreur de suppression: ${e.message}` };
    }
}
