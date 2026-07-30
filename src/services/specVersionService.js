import { rpcWithTimeout } from './supabaseRpc';

export async function listSpecVersions(sessionToken) {
    if (!sessionToken) {
        return { versions: [], error: 'Token de session requis' };
    }

    try {
        const { data, error } = await rpcWithTimeout('list_spec_versions', {
            p_session_token: sessionToken
        });
        if (error) {
            return { versions: [], error: error.message };
        }
        return { versions: (data || []).slice(0, 6), error: null };
    } catch (error) {
        return { versions: [], error: `Erreur de chargement: ${error.message}` };
    }
}

export async function createSpecVersion(sessionToken, {
    requestId,
    content,
    sourceMessageCount
}) {
    if (!sessionToken) {
        return { version: null, error: 'Token de session requis' };
    }

    try {
        const { data, error } = await rpcWithTimeout('create_spec_version', {
            p_session_token: sessionToken,
            p_request_id: requestId,
            p_content: content,
            p_source_message_count: sourceMessageCount
        });
        if (error) {
            return { version: null, error: error.message };
        }
        return { version: data?.[0] ?? data ?? null, error: null };
    } catch (error) {
        return { version: null, error: `Erreur de sauvegarde: ${error.message}` };
    }
}
