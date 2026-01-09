/**
 * Session persistence service for Supabase
 * Handles all session data storage operations
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SESSION_KEY = 'default';

// Debounce helper for auto-save
let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 1000;

/**
 * Filter messages for storage (remove large base64 images to save space)
 */
function filterMessagesForStorage(messages) {
    return messages.map(m => {
        if (!m.apiContent) return m;
        if (Array.isArray(m.apiContent)) {
            const textOnly = m.apiContent.filter(c => c.type === 'text');
            if (textOnly.length === 1) {
                return { ...m, apiContent: textOnly[0].text };
            } else if (textOnly.length > 1) {
                return { ...m, apiContent: textOnly };
            }
            return { ...m, apiContent: undefined };
        }
        return m;
    });
}

/**
 * Load session from Supabase
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function loadSession() {
    if (!isSupabaseConfigured()) {
        return { data: null, error: 'Supabase non configuré. Vérifiez les variables d\'environnement.' };
    }

    try {
        const { data, error } = await supabase
            .from('specrefiner_sessions')
            .select('*')
            .eq('session_key', SESSION_KEY)
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
                finalSpec: data.final_spec || null
            },
            error: null
        };
    } catch (e) {
        console.error('Supabase load failed:', e);
        return { data: null, error: `Erreur de connexion Supabase: ${e.message}` };
    }
}

/**
 * Save session to Supabase
 * @param {Object} data - Session data to save
 * @param {boolean} immediate - If true, save immediately without debounce
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function saveSession(data, immediate = false) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    const doSave = async () => {
        try {
            const { error } = await supabase
                .from('specrefiner_sessions')
                .upsert({
                    session_key: SESSION_KEY,
                    messages: filterMessagesForStorage(data.messages || []),
                    phase: data.phase,
                    question_count: data.questionCount,
                    final_spec: data.finalSpec
                }, {
                    onConflict: 'session_key'
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

    // Debounced save - returns immediately, saves in background
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
        doSave().catch(console.error);
    }, SAVE_DEBOUNCE_MS);

    return { success: true, error: null };
}

/**
 * Clear/reset session data
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function clearSession() {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    try {
        const { error } = await supabase
            .from('specrefiner_sessions')
            .delete()
            .eq('session_key', SESSION_KEY);

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
