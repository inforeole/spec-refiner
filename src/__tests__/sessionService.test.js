import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, isSupabaseConfiguredMock } = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    isSupabaseConfiguredMock: vi.fn(() => true)
}));

vi.mock('../lib/supabase', () => ({
    supabase: { rpc: rpcMock },
    isSupabaseConfigured: isSupabaseConfiguredMock
}));

vi.mock('../config/constants', () => ({
    TIMEOUTS: {
        SAVE_DEBOUNCE: 10,
        SUPABASE_RPC: 25
    }
}));

import {
    checkSupabaseConnection,
    loadSession,
    saveSession
} from '../services/sessionService';

describe('sessionService sécurisé par token', () => {
    const sessionToken = '11111111-1111-4111-8111-111111111111';

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        isSupabaseConfiguredMock.mockReturnValue(true);
        rpcMock.mockResolvedValue({ data: [], error: null });
    });

    it('charge la session via la RPC v3 sans identifiant utilisateur', async () => {
        await loadSession(sessionToken);

        expect(rpcMock).toHaveBeenCalledWith('load_user_session_v3', {
            p_session_token: sessionToken
        });
    });

    it('sauvegarde immédiatement via la RPC v3 avec le modèle guidé', async () => {
        const data = {
            messages: [{ role: 'user', content: 'Bonjour' }],
            phase: 'interview',
            questionCount: 2,
            finalSpec: null,
            isModificationMode: false,
            messageCountAtLastSpec: 0,
            specModel: { schemaVersion: 1, capabilities: [] }
        };

        await saveSession(sessionToken, data, true);

        expect(rpcMock).toHaveBeenCalledWith('save_user_session_v3', {
            p_session_token: sessionToken,
            p_messages: data.messages,
            p_phase: 'interview',
            p_question_count: 2,
            p_final_spec: null,
            p_is_modification_mode: false,
            p_message_count_at_last_spec: 0,
            p_spec_model: expect.objectContaining({
                schemaVersion: 1,
                capabilities: [],
                themes: expect.arrayContaining([
                    expect.objectContaining({ id: 'scope', status: 'to_explore' })
                ])
            })
        });
    });

    it('normalise le modèle guidé chargé', async () => {
        rpcMock.mockResolvedValue({
            data: [{
                messages: [],
                phase: 'interview',
                question_count: 0,
                spec_model: { capabilities: null }
            }],
            error: null
        });

        const result = await loadSession(sessionToken);

        expect(result.data.specModel.schemaVersion).toBe(1);
        expect(result.data.specModel.capabilities).toEqual([]);
    });

    it('vérifie la connexion avec le token courant', async () => {
        await checkSupabaseConnection(sessionToken);

        expect(rpcMock).toHaveBeenCalledWith('load_user_session_v3', {
            p_session_token: sessionToken
        });
    });

    it('interrompt une RPC Supabase qui dépasse le délai maximal', async () => {
        vi.useFakeTimers();
        const abortSignalMock = vi.fn(() => new Promise(() => {}));
        rpcMock.mockReturnValue({ abortSignal: abortSignalMock });

        const connectionPromise = checkSupabaseConnection(sessionToken);
        await vi.advanceTimersByTimeAsync(25);

        await expect(connectionPromise).resolves.toEqual({
            connected: false,
            error: 'Connexion impossible: Délai Supabase dépassé'
        });
        expect(abortSignalMock.mock.calls[0][0].aborted).toBe(true);
    });

    it('refuse toute opération sans token', async () => {
        const loadResult = await loadSession(null);
        const saveResult = await saveSession(null, { messages: [] }, true);

        expect(loadResult.error).toBe('Token de session requis');
        expect(saveResult.error).toBe('Token de session requis');
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('retourne le résultat réel de la sauvegarde différée', async () => {
        vi.useFakeTimers();
        rpcMock.mockResolvedValue({
            data: null,
            error: { message: 'réseau indisponible' }
        });

        const savePromise = saveSession(sessionToken, {
            messages: [],
            phase: 'interview',
            questionCount: 0
        });

        await vi.advanceTimersByTimeAsync(10);

        await expect(savePromise).resolves.toEqual({
            success: false,
            error: 'Erreur de sauvegarde: réseau indisponible'
        });
    });

    it('sérialise deux sauvegardes pour éviter qu’une ancienne écrase la nouvelle', async () => {
        vi.useFakeTimers();
        let resolveFirstSave;
        rpcMock
            .mockImplementationOnce(() => new Promise(resolve => {
                resolveFirstSave = resolve;
            }))
            .mockResolvedValueOnce({ data: true, error: null });

        const firstSave = saveSession(sessionToken, {
            messages: [],
            phase: 'interview',
            questionCount: 1
        });
        await vi.advanceTimersByTimeAsync(10);

        const secondSave = saveSession(sessionToken, {
            messages: [],
            phase: 'interview',
            questionCount: 2
        });
        await vi.advanceTimersByTimeAsync(10);

        expect(rpcMock).toHaveBeenCalledTimes(1);

        resolveFirstSave({ data: true, error: null });
        await firstSave;
        await vi.advanceTimersByTimeAsync(0);

        expect(rpcMock).toHaveBeenCalledTimes(2);
        await expect(secondSave).resolves.toEqual({ success: true, error: null });
    });
});
