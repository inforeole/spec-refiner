import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSession } from '../hooks/useSession';

// Mock services
vi.mock('../services/sessionService', () => ({
    loadSession: vi.fn(),
    saveSession: vi.fn(),
    clearSession: vi.fn(),
    checkSupabaseConnection: vi.fn()
}));

vi.mock('../services/imageService', () => ({
    deleteImage: vi.fn(),
    isStorageUrl: vi.fn((url) => url.startsWith('https://'))
}));

import { loadSession, saveSession, clearSession, checkSupabaseConnection } from '../services/sessionService';
import { deleteImage } from '../services/imageService';

describe('useSession', () => {
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

            const { result } = renderHook(() => useSession());

            expect(result.current.isLoading).toBe(true);

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });
        });

        it('crée une session avec message de bienvenue si pas de données', async () => {
            loadSession.mockResolvedValue({ data: null, error: null });

            const { result } = renderHook(() => useSession());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.messages).toHaveLength(1);
            expect(result.current.messages[0].role).toBe('assistant');
            expect(result.current.phase).toBe('interview');
            expect(result.current.questionCount).toBe(0);
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

            const { result } = renderHook(() => useSession());

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

            const { result } = renderHook(() => useSession());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.connectionError).toBe('Connection failed');
        });
    });

    describe('updateMessages', () => {
        it('met à jour les messages avec une fonction', async () => {
            const { result } = renderHook(() => useSession());

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
            const { result } = renderHook(() => useSession());

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
            const { result } = renderHook(() => useSession());

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
            const { result } = renderHook(() => useSession());

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
            const { result } = renderHook(() => useSession());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            act(() => {
                result.current.updateFinalSpec('# Spec finale');
            });

            expect(result.current.finalSpec).toBe('# Spec finale');
            expect(saveSession).toHaveBeenCalledWith(
                expect.objectContaining({ finalSpec: '# Spec finale' }),
                true
            );
        });
    });

    describe('resetSession', () => {
        it('supprime les images Storage avant reset', async () => {
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

            const { result } = renderHook(() => useSession());

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.resetSession();
            });

            // Vérifie que seule l'image Storage a été supprimée
            expect(deleteImage).toHaveBeenCalledTimes(1);
            expect(deleteImage).toHaveBeenCalledWith('https://storage.example.com/image1.jpg');
            expect(clearSession).toHaveBeenCalled();
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

            const { result } = renderHook(() => useSession());

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
    });
});
