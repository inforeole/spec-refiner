import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSession } from '../hooks/useSession';

// Mock services
vi.mock('../services/sessionService', () => ({
    loadSession: vi.fn(),
    saveSession: vi.fn(),
    checkSupabaseConnection: vi.fn(),
    cancelPendingSaves: vi.fn()
}));

import { loadSession, saveSession, checkSupabaseConnection } from '../services/sessionService';

describe('useSession', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const sessionToken = '22222222-2222-4222-8222-222222222222';

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks for successful connection
        checkSupabaseConnection.mockResolvedValue({ connected: true, error: null });
        loadSession.mockResolvedValue({ data: null, error: null });
        saveSession.mockResolvedValue({ success: true, error: null });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initialisation', () => {
        it('affiche isLoading pendant le chargement', async () => {
            // Slow connection check
            checkSupabaseConnection.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve({ connected: true, error: null }), 100))
            );

            const { result } = renderHook(() => useSession(userId, sessionToken));

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
        });

        it('crée une session avec message de bienvenue si pas de données', async () => {
            loadSession.mockResolvedValue({ data: null, error: null });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.messages).toHaveLength(1);
            expect(result.current.messages[0].role).toBe('assistant');
            expect(result.current.phase).toBe('interview');
            expect(result.current.questionCount).toBe(0);
            expect(result.current.specModel.schemaVersion).toBe(1);
            expect(result.current.resetSession).toBeUndefined();
            expect(checkSupabaseConnection).toHaveBeenCalledWith(sessionToken);
            expect(loadSession).toHaveBeenCalledWith(sessionToken);
            expect(saveSession).toHaveBeenCalledWith(sessionToken, expect.any(Object), true);
        });

        it('charge les données existantes', async () => {
            const existingData = {
                messages: [
                    { role: 'assistant', content: 'Bienvenue' },
                    { role: 'user', content: 'Mon projet' }
                ],
                phase: 'interview',
                questionCount: 5,
                finalSpec: null
            };
            loadSession.mockResolvedValue({ data: existingData, error: null });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.messages).toHaveLength(2);
            expect(result.current.questionCount).toBe(5);
        });

        it('gère les erreurs de connexion', async () => {
            checkSupabaseConnection.mockResolvedValue({
                connected: false,
                error: 'Connection failed'
            });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.connectionError).toBe('Connection failed');
        });

        it('ignore un chargement tardif de l’utilisateur précédent', async () => {
            let resolveFirstLoad;
            const secondUserId = '33333333-3333-4333-8333-333333333333';
            const secondToken = '44444444-4444-4444-8444-444444444444';

            loadSession.mockImplementation(token => {
                if (token === sessionToken) {
                    return new Promise(resolve => {
                        resolveFirstLoad = resolve;
                    });
                }

                return Promise.resolve({
                    data: {
                        messages: [{ role: 'assistant', content: 'Session B' }],
                        phase: 'interview',
                        questionCount: 2,
                        finalSpec: null
                    },
                    error: null
                });
            });

            const { result, rerender } = renderHook(
                ({ activeUserId, activeToken }) => useSession(activeUserId, activeToken),
                {
                    initialProps: {
                        activeUserId: userId,
                        activeToken: sessionToken
                    }
                }
            );

            await waitFor(() => {
                expect(loadSession).toHaveBeenCalledWith(sessionToken);
            });

            rerender({
                activeUserId: secondUserId,
                activeToken: secondToken
            });

            await waitFor(() => {
                expect(result.current.messages[0]?.content).toBe('Session B');
            });

            await act(async () => {
                resolveFirstLoad({
                    data: {
                        messages: [{ role: 'assistant', content: 'Session A' }],
                        phase: 'complete',
                        questionCount: 99,
                        finalSpec: 'Privé A'
                    },
                    error: null
                });
                await Promise.resolve();
            });

            expect(result.current.messages[0]?.content).toBe('Session B');
            expect(result.current.finalSpec).toBe(null);
        });
    });

    describe('updateMessages', () => {
        it('met à jour les messages avec une fonction', async () => {
            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updateMessages(prev => [
                    ...prev,
                    { role: 'user', content: 'test' }
                ]);
            });

            expect(result.current.messages).toHaveLength(2);
            expect(result.current.messages[1].content).toBe('test');
        });

        it('met à jour les messages avec un tableau', async () => {
            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const newMessages = [{ role: 'user', content: 'direct' }];
            act(() => {
                result.current.updateMessages(newMessages);
            });

            expect(result.current.messages).toEqual(newMessages);
        });
    });

    describe('updatePhase', () => {
        it('met à jour la phase', async () => {
            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updatePhase('complete');
            });

            expect(result.current.phase).toBe('complete');
        });
    });

    describe('updateQuestionCount', () => {
        it('incrémente le compteur', async () => {
            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updateQuestionCount(prev => prev + 1);
            });

            expect(result.current.questionCount).toBe(1);
        });
    });

    describe('updateFinalSpec', () => {
        it('sauvegarde immédiatement', async () => {
            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updateFinalSpec('# Spec finale');
            });

            await waitFor(() => {
                expect(result.current.finalSpec).toBe('# Spec finale');
                expect(saveSession).toHaveBeenCalledWith(
                    sessionToken,
                    expect.objectContaining({ finalSpec: '# Spec finale' }),
                    true
                );
            });
        });

        it('expose un échec de sauvegarde immédiate', async () => {
            loadSession.mockResolvedValue({
                data: {
                    messages: [{ role: 'assistant', content: 'Bienvenue' }],
                    phase: 'interview',
                    questionCount: 1,
                    finalSpec: null,
                    isModificationMode: false,
                    messageCountAtLastSpec: 0
                },
                error: null
            });
            saveSession.mockResolvedValueOnce({
                success: false,
                error: 'Échec critique'
            });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updateFinalSpec('# Spec finale');
            });

            await waitFor(() => {
                expect(result.current.saveError).toBe('Échec critique');
            });
        });
    });

    describe('erreurs de sauvegarde', () => {
        it('expose un échec puis l’efface après une sauvegarde réussie', async () => {
            loadSession.mockResolvedValue({
                data: {
                    messages: [{ role: 'assistant', content: 'Bienvenue' }],
                    phase: 'interview',
                    questionCount: 1,
                    finalSpec: null,
                    isModificationMode: false,
                    messageCountAtLastSpec: 0
                },
                error: null
            });
            saveSession.mockResolvedValueOnce({
                success: false,
                error: 'Erreur de sauvegarde'
            });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updatePhase('complete');
            });

            await waitFor(() => {
                expect(result.current.saveError).toBe('Erreur de sauvegarde');
            });

            saveSession.mockResolvedValueOnce({ success: true, error: null });
            act(() => {
                result.current.updateQuestionCount(2);
            });

            await waitFor(() => {
                expect(result.current.saveError).toBe(null);
            });
        });
    });

});
