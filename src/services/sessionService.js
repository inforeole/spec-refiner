/**
 * Session persistence service for Supabase
 * Uses secure RPC functions - all access goes through SECURITY DEFINER RPCs
 */

import { isSupabaseConfigured } from '../lib/supabase';
import { TIMEOUTS } from '../config/constants';
import { normalizeSpecModel } from '../domain/specModel';
import { rpcWithTimeout } from './supabaseRpc';

// Debounce helper for auto-save (per authenticated session)
const saveTimeouts = new Map();
const saveQueues = new Map();

function enqueueSave(sessionToken, saveOperation) {
    const previousSave = saveQueues.get(sessionToken) || Promise.resolve();
    const currentSave = previousSave
        .catch(() => undefined)
        .then(saveOperation);

    saveQueues.set(sessionToken, currentSave);
    currentSave.finally(() => {
        if (saveQueues.get(sessionToken) === currentSave) {
            saveQueues.delete(sessionToken);
        }
    });

    return currentSave;
}

/**
 * Cancel any pending debounced saves for a session
 * Call this when user changes to prevent race conditions
 * @param {string} sessionToken - The authenticated session token
 */
export function cancelPendingSaves(sessionToken) {
    if (saveTimeouts.has(sessionToken)) {
        const pendingSave = saveTimeouts.get(sessionToken);
        clearTimeout(pendingSave.timeoutId);
        pendingSave.resolve({
            success: false,
            error: null,
            cancelled: true
        });
        saveTimeouts.delete(sessionToken);
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
 * Uses secure RPC function
 * @param {string} sessionToken - The authenticated session token
 * @returns {Promise<{data: Object|null, error: string|null}>}
 */
export async function loadSession(sessionToken) {
    if (!isSupabaseConfigured()) {
        return { data: null, error: 'Supabase non configuré. Vérifiez les variables d\'environnement.' };
    }

    if (!sessionToken) {
        return { data: null, error: 'Token de session requis' };
    }

    try {
        const { data, error } = await rpcWithTimeout('load_user_session_v3', {
            p_session_token: sessionToken
        });

        if (error) throw error;

        // RPC returns empty array if no session found
        if (!data || data.length === 0) {
            return { data: null, error: null };
        }

        const sessionData = data[0];
        return {
            data: {
                messages: sessionData.messages || [],
                phase: sessionData.phase || 'interview',
                questionCount: sessionData.question_count || 0,
                finalSpec: sessionData.final_spec || null,
                isModificationMode: sessionData.is_modification_mode || false,
                messageCountAtLastSpec: sessionData.message_count_at_last_spec || 0,
                specModel: normalizeSpecModel(sessionData.spec_model)
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
 * Uses secure RPC function
 * @param {string} sessionToken - The authenticated session token
 * @param {Object} data - Session data to save
 * @param {boolean} immediate - If true, save immediately without debounce
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function saveSession(sessionToken, data, immediate = false) {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase non configuré' };
    }

    if (!sessionToken) {
        return { success: false, error: 'Token de session requis' };
    }

    const doSave = async () => {
        try {
            const { error } = await rpcWithTimeout('save_user_session_v3', {
                p_session_token: sessionToken,
                p_messages: filterMessagesForStorage(data.messages || []),
                p_phase: data.phase,
                p_question_count: data.questionCount,
                p_final_spec: data.finalSpec,
                p_is_modification_mode: data.isModificationMode || false,
                p_message_count_at_last_spec: data.messageCountAtLastSpec || 0,
                p_spec_model: normalizeSpecModel(data.specModel)
            });

            if (error) throw error;
            return { success: true, error: null };
        } catch (e) {
            console.error('Supabase save failed:', e);
            return { success: false, error: `Erreur de sauvegarde: ${e.message}` };
        }
    };

    if (immediate) {
        cancelPendingSaves(sessionToken);
        return enqueueSave(sessionToken, doSave);
    }

    // Debounced save per session - resolves with the real remote result
    cancelPendingSaves(sessionToken);

    return new Promise(resolve => {
        const pendingSave = { timeoutId: null, resolve };
        pendingSave.timeoutId = setTimeout(async () => {
            if (saveTimeouts.get(sessionToken) === pendingSave) {
                saveTimeouts.delete(sessionToken);
            }
            try {
                resolve(await enqueueSave(sessionToken, doSave));
            } catch (error) {
                resolve({
                    success: false,
                    error: `Erreur de sauvegarde: ${error.message}`
                });
            }
        }, TIMEOUTS.SAVE_DEBOUNCE);

        saveTimeouts.set(sessionToken, pendingSave);
    });
}

/**
 * Check if Supabase is available and working
 * Uses a lightweight RPC call
 * @returns {Promise<{connected: boolean, error: string|null}>}
 */
export async function checkSupabaseConnection(sessionToken) {
    if (!isSupabaseConfigured()) {
        return { connected: false, error: 'Variables d\'environnement Supabase manquantes (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)' };
    }

    if (!sessionToken) {
        return { connected: false, error: 'Token de session requis' };
    }

    try {
        const { error } = await rpcWithTimeout('load_user_session_v3', {
            p_session_token: sessionToken
        });

        // Even if the query returns no rows, the connection is valid
        if (error && !error.message.includes('No rows')) {
            throw error;
        }
        return { connected: true, error: null };
    } catch (e) {
        return { connected: false, error: `Connexion impossible: ${e.message}` };
    }
}
