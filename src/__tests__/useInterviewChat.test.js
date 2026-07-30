import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInterviewChat } from '../hooks/useInterviewChat';

// Mock dependencies
vi.mock('../services/apiService', () => ({
    callAPIWithRetry: vi.fn()
}));

vi.mock('../services/imageService', () => ({
    uploadImage: vi.fn()
}));

vi.mock('../services/summaryService', () => ({
    generateFileSummary: vi.fn().mockResolvedValue('Résumé du fichier')
}));

vi.mock('../prompts/systemPrompt', () => ({
    getSystemPrompt: vi.fn(() => 'System prompt de test')
}));

vi.mock('../config/constants', () => ({
    MARKERS: { SPEC_COMPLETE: '[SPEC_COMPLETE]' }
}));

import { callAPIWithRetry } from '../services/apiService';
import { uploadImage } from '../services/imageService';

describe('useInterviewChat', () => {
    let mockSessionHook;
    let createVersion;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSessionHook = {
            messages: [],
            updateMessages: vi.fn((fn) => {
                if (typeof fn === 'function') {
                    mockSessionHook.messages = fn(mockSessionHook.messages);
                }
            }),
            updatePhase: vi.fn(),
            updateQuestionCount: vi.fn(),
            updateFinalSpec: vi.fn(),
            specModel: {
                schemaVersion: 1,
                capabilities: [],
                requirements: [],
                decisions: [],
                themes: []
            },
            updateSpecModel: vi.fn(),
            isModificationMode: false,
            exitModificationMode: vi.fn(),
            updateMessageCountAtLastSpec: vi.fn()
        };
        createVersion = vi.fn().mockResolvedValue({
            version: {
                id: 'version-1',
                content: '# Cahier des Charges\n\nLe document',
                generated_at: '2026-07-30T13:42:00Z'
            },
            error: null
        });

        // Default mock implementations
        callAPIWithRetry.mockResolvedValue({
            response: {
                assistantMessage: 'Réponse de test',
                updates: {}
            },
            isValid: true
        });

        uploadImage.mockResolvedValue({ url: 'https://storage.example.com/image.png' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('état initial', () => {
        it('isLoading est false par défaut', () => {
            const { result } = renderHook(() => useInterviewChat(mockSessionHook));
            expect(result.current.isLoading).toBe(false);
        });

        it('retourne les fonctions nécessaires', () => {
            const { result } = renderHook(() => useInterviewChat(mockSessionHook));
            expect(typeof result.current.sendMessage).toBe('function');
            expect(typeof result.current.requestFinalSpec).toBe('function');
            expect(typeof result.current.abortRequest).toBe('function');
        });
    });

    describe('sendMessage', () => {
        it('ne fait rien si message vide et pas de fichiers', async () => {
            const { result } = renderHook(() => useInterviewChat(mockSessionHook));

            let success;
            await act(async () => {
                success = await result.current.sendMessage('   ', []);
            });

            expect(success).toBe(false);
            expect(callAPIWithRetry).not.toHaveBeenCalled();
        });

        it('envoie un message texte simple', async () => {
            const { result } = renderHook(() => useInterviewChat(mockSessionHook));

            await act(async () => {
                await result.current.sendMessage('Mon message', []);
            });

            expect(callAPIWithRetry).toHaveBeenCalled();
            expect(mockSessionHook.updateMessages).toHaveBeenCalled();
            expect(mockSessionHook.updateQuestionCount).toHaveBeenCalled();
        });

        it('gère les fichiers texte', async () => {
            const { result } = renderHook(() => useInterviewChat(mockSessionHook));
            const processedFiles = [
                { type: 'text', name: 'doc.txt', content: 'Contenu du fichier' }
            ];

            await act(async () => {
                await result.current.sendMessage('Message avec fichier', processedFiles);
            });

            expect(callAPIWithRetry).toHaveBeenCalled();
            const callArgs = callAPIWithRetry.mock.calls[0][0];
            expect(callArgs.messages[1].content[0].text).toContain('Documents attachés');
            expect(callArgs.messages[1].content[0].text).toContain('doc.txt');
        });

        it('upload les images vers Supabase', async () => {
            const { result } = renderHook(() => useInterviewChat(mockSessionHook));
            const processedFiles = [
                { type: 'image', name: 'image.png', content: 'data:image/png;base64,xxx' }
            ];

            await act(async () => {
                await result.current.sendMessage('Message avec image', processedFiles);
            });

            expect(uploadImage).toHaveBeenCalledWith('data:image/png;base64,xxx', 'image.png');
        });

        it('fallback base64 si upload échoue', async () => {
            uploadImage.mockResolvedValue({ url: null, error: 'Upload failed' });
            const { result } = renderHook(() => useInterviewChat(mockSessionHook));
            const processedFiles = [
                { type: 'image', name: 'image.png', content: 'data:image/png;base64,xxx' }
            ];

            await act(async () => {
                await result.current.sendMessage('Message', processedFiles);
            });

            expect(callAPIWithRetry).toHaveBeenCalled();
            const callArgs = callAPIWithRetry.mock.calls[0][0];
            const imageContent = callArgs.messages[1].content.find(c => c.type === 'image_url');
            expect(imageContent.image_url.url).toBe('data:image/png;base64,xxx');
        });

        it('fusionne les mises à jour structurées et affiche seulement le message', async () => {
            callAPIWithRetry.mockResolvedValue({
                response: {
                    assistantMessage: '[AUDIO]Parlons du périmètre.[/AUDIO]\n\nQuel est le résultat essentiel ?',
                    updates: {
                        capabilities: [{
                            id: 'passport',
                            name: 'Passeport',
                            priority: 'required',
                            sourceIds: ['message-1']
                        }]
                    }
                },
                isValid: true
            });

            const { result } = renderHook(() => useInterviewChat(mockSessionHook));

            await act(async () => {
                await result.current.sendMessage('Créer un passeport', []);
            });

            expect(mockSessionHook.updateSpecModel).toHaveBeenCalled();
            expect(mockSessionHook.messages.at(-1).content)
                .toContain('Quel est le résultat essentiel ?');
            expect(mockSessionHook.messages.at(-1).content)
                .not.toContain('capabilities');
        });

        it('gère les réponses invalides', async () => {
            callAPIWithRetry.mockResolvedValue({
                response: 'Réponse incohérente',
                isValid: false
            });

            const { result } = renderHook(() => useInterviewChat(mockSessionHook));

            let success;
            await act(async () => {
                success = await result.current.sendMessage('Test', []);
            });

            expect(success).toBe(false);
            // Vérifie qu'un message d'erreur a été ajouté
            expect(mockSessionHook.updateMessages).toHaveBeenCalled();
        });

        it('gère les erreurs API', async () => {
            callAPIWithRetry.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useInterviewChat(mockSessionHook));

            let success;
            await act(async () => {
                success = await result.current.sendMessage('Test', []);
            });

            expect(success).toBe(false);
            expect(result.current.isLoading).toBe(false);
        });

        it('ignore les erreurs AbortError', async () => {
            const abortError = new Error('Aborted');
            abortError.name = 'AbortError';
            callAPIWithRetry.mockRejectedValue(abortError);

            const { result } = renderHook(() => useInterviewChat(mockSessionHook));

            await act(async () => {
                await result.current.sendMessage('Test', []);
            });

            // Pas de message d'erreur ajouté pour AbortError
            const errorMessages = mockSessionHook.messages.filter(m =>
                m.content && m.content.includes('Erreur')
            );
            expect(errorMessages).toHaveLength(0);
        });
    });

    describe('requestFinalSpec', () => {
        it('demande la génération du spec', async () => {
            callAPIWithRetry.mockResolvedValue({
                response: {
                    markdown: '# Cahier des Charges\n\nLe spec final'
                },
                isValid: true
            });

            const { result } = renderHook(() => useInterviewChat(
                mockSessionHook,
                { createVersion }
            ));

            await act(async () => {
                await result.current.requestFinalSpec();
            });

            expect(mockSessionHook.updateFinalSpec).toHaveBeenCalledWith('# Cahier des Charges\n\nLe spec final');
            expect(mockSessionHook.updatePhase).toHaveBeenCalledWith('complete');
            expect(createVersion).toHaveBeenCalledWith({
                content: '# Cahier des Charges\n\nLe spec final',
                sourceMessageCount: 0
            });
        });

        it('gère les réponses invalides', async () => {
            callAPIWithRetry.mockResolvedValue({
                response: 'Invalid',
                isValid: false
            });

            const { result } = renderHook(() => useInterviewChat(
                mockSessionHook,
                { createVersion }
            ));

            let success;
            await act(async () => {
                success = await result.current.requestFinalSpec();
            });

            expect(success).toBe(false);
            expect(result.current.errorMessage).toContain('incohérente');
        });

        it('refuse une réponse structurée sans document', async () => {
            callAPIWithRetry.mockResolvedValue({
                response: {},
                isValid: true
            });

            const { result } = renderHook(() => useInterviewChat(
                mockSessionHook,
                { createVersion }
            ));

            let success;
            await act(async () => {
                success = await result.current.requestFinalSpec();
            });

            expect(success).toBe(false);
            expect(mockSessionHook.updateFinalSpec).not.toHaveBeenCalled();
            expect(mockSessionHook.updatePhase).not.toHaveBeenCalledWith('complete');
            expect(result.current.errorMessage).toContain('vide');
        });

        it('does not show completion until the version is stored', async () => {
            callAPIWithRetry.mockResolvedValue({
                response: {
                    markdown: '# Cahier des Charges\n\nLe spec final'
                },
                isValid: true
            });
            createVersion.mockResolvedValue({
                version: null,
                error: 'Erreur de sauvegarde'
            });

            const { result } = renderHook(() => useInterviewChat(
                mockSessionHook,
                { createVersion }
            ));

            let success;
            await act(async () => {
                success = await result.current.requestFinalSpec();
            });

            expect(success).toBe(false);
            expect(mockSessionHook.updateFinalSpec).not.toHaveBeenCalled();
            expect(mockSessionHook.updatePhase).not.toHaveBeenCalledWith('complete');
            expect(result.current.errorMessage).toContain('Erreur de sauvegarde');
        });
    });

    describe('abortRequest', () => {
        it('réinitialise isLoading', async () => {
            // Simuler une requête lente
            callAPIWithRetry.mockImplementation(() => new Promise(resolve => {
                setTimeout(() => resolve({ response: 'test', isValid: true }), 1000);
            }));

            const { result } = renderHook(() => useInterviewChat(mockSessionHook));

            // Démarrer une requête
            act(() => {
                result.current.sendMessage('Test', []);
            });

            // Annuler immédiatement
            act(() => {
                result.current.abortRequest();
            });

            expect(result.current.isLoading).toBe(false);
        });
    });
});
