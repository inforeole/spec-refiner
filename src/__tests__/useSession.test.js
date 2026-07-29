import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSession } from '../hooks/useSession';

// Mock services
vi.mock('../services/sessionService', () => ({
    loadSession: vi.fn(),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    checkSupabaseConnection: vi.fn(),
    cancelPendingSaves: vi.fn()
}));

vi.mock('../services/imageService', () => ({
    deleteImage: vi.fn(),
    isStorageUrl: vi.fn((url) => url.startsWith('https://'))
}));

import { loadSession, saveSession, clearSession, checkSupabaseConnection } from '../services/sessionService';
import { deleteImage } from '../services/imageService';

describe('useSession', () => {
    const userId = '11111111-1111-4111-8111-111111111111';
    const sessionToken = '22222222-2222-4222-8222-222222222222';

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mocks for successful connection
        checkSupabaseConnection.mockResolvedValue({ connected: true, error: null });
        loadSession.mockResolvedValue({ data: null, error: null });
        saveSession.mockResolvedValue({ success: true, error: null });
        clearSession.mockResolvedValue({ success: true, error: null });
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

    describe('resetSession', () => {
        it('supprime les images Storage après la sauvegarde du reset', async () => {
            const messagesWithImages = [
                {
                    role: 'user',
                    content: 'Voici une image',
                    apiContent: [
                        { type: 'text', text: 'Voici une image' },
                        { type: 'image_url', image_url: { url: 'https://storage.example.com/image1.jpg' } },
                        { type: 'image_url', image_url: { url: 'data:image/png;base64,xxx' } } // base64, pas Storage
                    ]
                }
            ];
            loadSession.mockResolvedValue({
                data: { messages: messagesWithImages, phase: 'interview', questionCount: 0, finalSpec: null },
                error: null
            });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.resetSession();
            });

            // Vérifie que seule l'image Storage a été supprimée
            expect(deleteImage).toHaveBeenCalledTimes(1);
            expect(deleteImage).toHaveBeenCalledWith('https://storage.example.com/image1.jpg');
            expect(clearSession).not.toHaveBeenCalled();
        });

        it('réinitialise avec le message de bienvenue', async () => {
            loadSession.mockResolvedValue({
                data: {
                    messages: [{ role: 'user', content: 'old' }],
                    phase: 'complete',
                    questionCount: 10,
                    finalSpec: 'old spec'
                },
                error: null
            });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.resetSession();
            });

            expect(result.current.messages).toHaveLength(1);
            expect(result.current.messages[0].role).toBe('assistant');
            expect(result.current.phase).toBe('interview');
            expect(result.current.questionCount).toBe(0);
            expect(result.current.finalSpec).toBe(null);
        });

        it('expose l’échec de sauvegarde de la session réinitialisée', async () => {
            loadSession.mockResolvedValue({
                data: {
                    messages: [{ role: 'user', content: 'old' }],
                    phase: 'complete',
                    questionCount: 10,
                    finalSpec: 'old spec'
                },
                error: null
            });
            saveSession.mockResolvedValueOnce({
                success: false,
                error: 'Reset non sauvegardé'
            });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.resetSession();
            });

            expect(result.current.saveError).toBe('Reset non sauvegardé');
        });

        it('conserve les images si le reset distant échoue complètement', async () => {
            loadSession.mockResolvedValue({
                data: {
                    messages: [{
                        role: 'user',
                        content: 'Image',
                        apiContent: [{
                            type: 'image_url',
                            image_url: {
                                url: 'https://storage.example.com/image.jpg'
                            }
                        }]
                    }],
                    phase: 'interview',
                    questionCount: 1,
                    finalSpec: null
                },
                error: null
            });
            saveSession.mockResolvedValueOnce({
                success: false,
                error: 'Sauvegarde impossible'
            });

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.resetSession();
            });

            expect(deleteImage).not.toHaveBeenCalled();
            expect(clearSession).not.toHaveBeenCalled();
        });

        it('ignore le résultat tardif d’un reset après un changement d’utilisateur', async () => {
            const secondUserId = '33333333-3333-4333-8333-333333333333';
            const secondToken = '44444444-4444-4444-8444-444444444444';
            let resolveFirstReset;

            loadSession.mockImplementation(token => Promise.resolve({
                data: {
                    messages: [{
                        role: 'assistant',
                        content: token === sessionToken ? 'Session A' : 'Session B'
                    }],
                    phase: 'interview',
                    questionCount: token === sessionToken ? 1 : 2,
                    finalSpec: null
                },
                error: null
            }));
            saveSession.mockImplementationOnce(() => new Promise(resolve => {
                resolveFirstReset = resolve;
            }));

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
                expect(result.current.messages[0]?.content).toBe('Session A');
            });

            let resetPromise;
            act(() => {
                resetPromise = result.current.resetSession();
            });

            rerender({
                activeUserId: secondUserId,
                activeToken: secondToken
            });

            await waitFor(() => {
                expect(result.current.messages[0]?.content).toBe('Session B');
            });

            await act(async () => {
                resolveFirstReset({
                    success: false,
                    error: 'Ancien reset en échec'
                });
                await resetPromise;
            });

            expect(result.current.messages[0]?.content).toBe('Session B');
            expect(result.current.saveError).toBe(null);
        });

        it('efface une erreur de reset quand une sauvegarde plus récente réussit', async () => {
            let resolveReset;
            let resolveNewerSave;

            loadSession.mockResolvedValue({
                data: {
                    messages: [{ role: 'assistant', content: 'Session active' }],
                    phase: 'interview',
                    questionCount: 1,
                    finalSpec: null
                },
                error: null
            });
            saveSession
                .mockImplementationOnce(() => new Promise(resolve => {
                    resolveReset = resolve;
                }))
                .mockImplementationOnce(() => new Promise(resolve => {
                    resolveNewerSave = resolve;
                }));

            const { result } = renderHook(() => useSession(userId, sessionToken));

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            let resetPromise;
            act(() => {
                resetPromise = result.current.resetSession();
            });
            act(() => {
                result.current.updateMessages(prev => [
                    ...prev,
                    { role: 'user', content: 'Nouvelle donnée' }
                ]);
            });

            await waitFor(() => {
                expect(saveSession).toHaveBeenCalledTimes(2);
            });

            await act(async () => {
                resolveReset({
                    success: false,
                    error: 'Ancien reset en échec'
                });
                await resetPromise;
            });
            expect(result.current.saveError).toBe('Ancien reset en échec');

            await act(async () => {
                resolveNewerSave({ success: true, error: null });
            });

            expect(result.current.saveError).toBe(null);
        });
    });
});
