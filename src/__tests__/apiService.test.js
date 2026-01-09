import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock des modules AVANT l'import
vi.mock('../config/constants', () => ({
    API_CONFIG: {
        MODEL: 'test-model',
        MAX_TOKENS: 1000,
        MAX_RETRIES: 2,
        OPENROUTER_URL: 'https://api.test.com/chat'
    }
}));

vi.mock('../utils/responseValidation', () => ({
    isValidResponse: vi.fn()
}));

// L'import après les mocks
import { callOpenRouterAPI, callAPIWithRetry } from '../services/apiService';
import { isValidResponse } from '../utils/responseValidation';

describe('apiService', () => {
    const mockMessages = [
        { role: 'system', content: 'Tu es un assistant' },
        { role: 'user', content: 'Bonjour' }
    ];

    beforeEach(() => {
        // Reset fetch mock
        global.fetch = vi.fn();

        // Reset isValidResponse mock
        isValidResponse.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('callOpenRouterAPI', () => {
        // Note: Tester l'absence de clé API est difficile avec import.meta.env
        // car il est évalué au moment de l'import. On teste les autres cas.

        it('appelle fetch avec les bons paramètres', async () => {
            const mockResponse = {
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: 'Réponse test' } }]
                })
            };
            global.fetch.mockResolvedValue(mockResponse);

            await callOpenRouterAPI({ messages: mockMessages });

            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.test.com/chat',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    }),
                    body: expect.any(String)
                })
            );

            const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
            expect(callBody.model).toBe('test-model');
            expect(callBody.max_tokens).toBe(1000);
            expect(callBody.messages).toEqual(mockMessages);
        });

        it('retourne le contenu de la réponse', async () => {
            const mockResponse = {
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: 'Bonjour, je suis là pour t\'aider !' } }]
                })
            };
            global.fetch.mockResolvedValue(mockResponse);

            const result = await callOpenRouterAPI({ messages: mockMessages });

            expect(result).toBe('Bonjour, je suis là pour t\'aider !');
        });

        it('lance une erreur si la réponse n\'est pas ok', async () => {
            const mockResponse = {
                ok: false,
                json: () => Promise.resolve({
                    error: { message: 'Rate limit exceeded' }
                })
            };
            global.fetch.mockResolvedValue(mockResponse);

            await expect(callOpenRouterAPI({ messages: mockMessages }))
                .rejects.toThrow('Rate limit exceeded');
        });

        it('lance une erreur générique si pas de message d\'erreur', async () => {
            const mockResponse = {
                ok: false,
                json: () => Promise.resolve({})
            };
            global.fetch.mockResolvedValue(mockResponse);

            await expect(callOpenRouterAPI({ messages: mockMessages }))
                .rejects.toThrow('API request failed');
        });

        it('passe le signal d\'abort à fetch', async () => {
            const controller = new AbortController();
            const mockResponse = {
                ok: true,
                json: () => Promise.resolve({
                    choices: [{ message: { content: 'Test' } }]
                })
            };
            global.fetch.mockResolvedValue(mockResponse);

            await callOpenRouterAPI({ messages: mockMessages, signal: controller.signal });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    signal: controller.signal
                })
            );
        });
    });

    describe('callAPIWithRetry', () => {
        const createSuccessResponse = (content) => ({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content } }]
            })
        });

        it('retourne la réponse si elle est valide du premier coup', async () => {
            global.fetch.mockResolvedValue(createSuccessResponse('Réponse valide'));
            isValidResponse.mockReturnValue(true);

            const result = await callAPIWithRetry({ messages: mockMessages });

            expect(result).toEqual({
                response: 'Réponse valide',
                isValid: true
            });
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('retry si la réponse est invalide', async () => {
            global.fetch
                .mockResolvedValueOnce(createSuccessResponse('Réponse garbage'))
                .mockResolvedValueOnce(createSuccessResponse('Réponse valide'));

            isValidResponse
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true)
                .mockReturnValue(true);

            const result = await callAPIWithRetry({ messages: mockMessages });

            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(result.response).toBe('Réponse valide');
            expect(result.isValid).toBe(true);
        });

        it('s\'arrête après maxRetries tentatives', async () => {
            global.fetch.mockResolvedValue(createSuccessResponse('Toujours invalide'));
            isValidResponse.mockReturnValue(false);

            const result = await callAPIWithRetry({ messages: mockMessages, maxRetries: 2 });

            // 1 appel initial + 2 retries = 3 appels
            expect(global.fetch).toHaveBeenCalledTimes(3);
            expect(result.response).toBe('Toujours invalide');
            expect(result.isValid).toBe(false);
        });

        it('utilise le maxRetries par défaut de la config', async () => {
            global.fetch.mockResolvedValue(createSuccessResponse('Invalid'));
            isValidResponse.mockReturnValue(false);

            await callAPIWithRetry({ messages: mockMessages });

            // MAX_RETRIES = 2 dans le mock, donc 1 + 2 = 3 appels
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('log un warning à chaque retry', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            global.fetch.mockResolvedValue(createSuccessResponse('Invalid'));
            isValidResponse.mockReturnValue(false);

            await callAPIWithRetry({ messages: mockMessages, maxRetries: 2 });

            expect(consoleSpy).toHaveBeenCalledTimes(2);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('tentative 1/2'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('tentative 2/2'));

            consoleSpy.mockRestore();
        });
    });
});
