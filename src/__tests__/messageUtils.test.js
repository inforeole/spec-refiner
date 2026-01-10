import { describe, it, expect, vi } from 'vitest';
import { extractStorageImageUrls } from '../utils/messageUtils';

// Mock imageService
vi.mock('../services/imageService', () => ({
    isStorageUrl: vi.fn((url) => url.startsWith('https://'))
}));

describe('messageUtils', () => {
    describe('extractStorageImageUrls', () => {
        it('extrait les URLs Storage des messages', () => {
            const messages = [
                {
                    role: 'user',
                    content: 'Image',
                    apiContent: [
                        { type: 'text', text: 'Image' },
                        { type: 'image_url', image_url: { url: 'https://storage.example.com/img1.jpg' } }
                    ]
                }
            ];

            const urls = extractStorageImageUrls(messages);

            expect(urls).toEqual(['https://storage.example.com/img1.jpg']);
        });

        it('filtre les URLs base64', () => {
            const messages = [
                {
                    role: 'user',
                    content: 'Image',
                    apiContent: [
                        { type: 'image_url', image_url: { url: 'data:image/png;base64,xxx' } },
                        { type: 'image_url', image_url: { url: 'https://storage.example.com/img.jpg' } }
                    ]
                }
            ];

            const urls = extractStorageImageUrls(messages);

            expect(urls).toHaveLength(1);
            expect(urls[0]).toBe('https://storage.example.com/img.jpg');
        });

        it('gère les messages sans apiContent', () => {
            const messages = [
                { role: 'assistant', content: 'Bonjour' },
                { role: 'user', content: 'Salut' }
            ];

            const urls = extractStorageImageUrls(messages);

            expect(urls).toEqual([]);
        });

        it('gère apiContent non-tableau', () => {
            const messages = [
                { role: 'user', content: 'Test', apiContent: 'string content' }
            ];

            const urls = extractStorageImageUrls(messages);

            expect(urls).toEqual([]);
        });

        it('extrait plusieurs URLs de plusieurs messages', () => {
            const messages = [
                {
                    role: 'user',
                    apiContent: [
                        { type: 'image_url', image_url: { url: 'https://example.com/img1.jpg' } },
                        { type: 'image_url', image_url: { url: 'https://example.com/img2.jpg' } }
                    ]
                },
                {
                    role: 'user',
                    apiContent: [
                        { type: 'image_url', image_url: { url: 'https://example.com/img3.jpg' } }
                    ]
                }
            ];

            const urls = extractStorageImageUrls(messages);

            expect(urls).toHaveLength(3);
        });

        it('gère les entrées image_url sans url', () => {
            const messages = [
                {
                    role: 'user',
                    apiContent: [
                        { type: 'image_url', image_url: {} },
                        { type: 'image_url' }
                    ]
                }
            ];

            const urls = extractStorageImageUrls(messages);

            expect(urls).toEqual([]);
        });
    });
});
