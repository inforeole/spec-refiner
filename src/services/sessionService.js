/**
 * Session persistence service for Supabase
 * Handles all session data storage operations per user
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { TIMEOUTS } from '../config/constants';

// Debounce helper for auto-save (per user)
const saveTimeouts = new Map();

/**
 * Cancel any pending debounced saves for a user
 * Call this when user changes to prevent race conditions
 * @param {string} userId - The user's UUID
 */
export function cancelPendingSaves(userId) {
    if (saveTimeouts.has(userId)) {
        clearTimeout(saveTimeouts.get(userId));
        saveTimeouts.delete(userId);
    }
}

/**
 * Filter messages for storage
 * - Keep text content
 * - Keep Storage URLs (already uploaded images)
 * - Remove base64 images (fallback if upload failed)
 */
function filterMessagesForStorage(messages) {
    return messages.map(m => {
        if (!m.apiContent) return m;
        if (Array.isArray(m.apiContent)) {
            // Keep text and storage URLs, filter out base64
            const filtered = m.apiContent.filter(c => {
                if (c.type === 'text') return true;
                if (c.type === 'image_url' && c.image_url?.url) {
                    // Keep if it's a Storage URL, not base64
                    return !c.image_url.url.startsWith('data:');
                }
                return false;
            });

            if (filtered.length === 0) {
                return { ...m, apiContent: undefined };
            }
            if (filtered.length === 1 && filtered[0].type === 'text') {
                return { ...m, apiContent: filtered[0].text };
            }
            return { ...m, apiContent: filtered };
        }
        return m;
    });
}

/**
 * Load session from Supabase for a specific user
 * @param {string} userId - The user's UUID
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function loadSession(userId) {
    if (!isSupabaseConfigured()) {
        return { data: null, error: 'Supabase non configuré. Vérifiez les variables d\'environnement.' };
    }

    if (!userId) {
        return { data: null, error: 'User ID requis' };
    }

    try {
        const { data, error } = await supabase
            .from('specrefiner_sessions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            // PGRST116 = no rows found, not an error for us
            if (error.code === 'PGRST116') {
                return { data: null, error: null };
            }
            throw error;
        }

        return {
            data: {
                messages: data.messages || [],
                phase: data.phase || 'interview',
                questionCount: data.question_count || 0,
                finalSpec: data.final_spec || null,
                isModificationMode: data.is_modification_mode || false,
                messageCountAtLastSpec: data.message_count_at_last_spec || 0
            },
            error: null
        };
    } catch (e) {
        console.error('Supabase load failed:', e);
        return { data: null, error: `Erreur de connexion Supabase: ${e.message}` };
    }
}

/**
 * Save session to Supabase for a specific user
 * @param {string} userId - The user's UUID
 * @param {Object} data - Session data to save
 * @param {boolean} immediate - If true, save immediately without debounce
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function saveSession(userId, data, immediate = false) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    if (!userId) {
        return { success: false, error: 'User ID requis' };
    }

    const doSave = async () => {
        try {
            const { error } = await supabase
                .from('specrefiner_sessions')
                .upsert({
                    user_id: userId,
                    messages: filterMessagesForStorage(data.messages || []),
                    phase: data.phase,
                    question_count: data.questionCount,
                    final_spec: data.finalSpec,
                    is_modification_mode: data.isModificationMode || false,
                    message_count_at_last_spec: data.messageCountAtLastSpec || 0
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;
            return { success: true, error: null };
        } catch (e) {
            console.error('Supabase save failed:', e);
            return { success: false, error: `Erreur de sauvegarde: ${e.message}` };
        }
    };

    if (immediate) {
        return doSave();
    }

    // Debounced save per user - returns immediately, saves in background
    if (saveTimeouts.has(userId)) {
        clearTimeout(saveTimeouts.get(userId));
    }
    saveTimeouts.set(userId, setTimeout(() => {
        doSave().catch(console.error);
        saveTimeouts.delete(userId);
    }, TIMEOUTS.SAVE_DEBOUNCE));

    return { success: true, error: null };
}

/**
 * Clear/reset session data for a specific user
 * @param {string} userId - The user's UUID
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function clearSession(userId) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    if (!userId) {
        return { success: false, error: 'User ID requis' };
    }

    try {
        const { error } = await supabase
            .from('specrefiner_sessions')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;
        return { success: true, error: null };
    } catch (e) {
        console.error('Supabase delete failed:', e);
        return { success: false, error: `Erreur de suppression: ${e.message}` };
    }
}

/**
 * Check if Supabase is available and working
 * @returns {Promise<{connected: boolean, error: string|null}>}
 */
export async function checkSupabaseConnection() {
    if (!isSupabaseConfigured()) {
        return { connected: false, error: 'Variables d\'environnement Supabase manquantes (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)' };
    }

    try {
        const { error } = await supabase
            .from('specrefiner_sessions')
            .select('id')
            .limit(1);

        if (error) throw error;
        return { connected: true, error: null };
    } catch (e) {
        return { connected: false, error: `Connexion impossible: ${e.message}` };
    }
}
