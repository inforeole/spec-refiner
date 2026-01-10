import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatInput } from '../hooks/useChatInput';

// Mock processFiles
vi.mock('../utils/fileProcessing', () => ({
    processFiles: vi.fn().mockResolvedValue([
        { type: 'text', name: 'test.txt', content: 'contenu' }
    ])
}));

describe('useChatInput', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('état initial', () => {
        it('inputMessage est vide par défaut', () => {
            const { result } = renderHook(() => useChatInput());
            expect(result.current.inputMessage).toBe('');
        });

        it('chatFiles est un tableau vide par défaut', () => {
            const { result } = renderHook(() => useChatInput());
            expect(result.current.chatFiles).toEqual([]);
        });

        it('isProcessingFiles est false par défaut', () => {
            const { result } = renderHook(() => useChatInput());
            expect(result.current.isProcessingFiles).toBe(false);
        });
    });

    describe('setInputMessage', () => {
        it('met à jour inputMessage', () => {
            const { result } = renderHook(() => useChatInput());

            act(() => {
                result.current.setInputMessage('nouveau message');
            });

            expect(result.current.inputMessage).toBe('nouveau message');
        });
    });

    describe('handleFileSelect', () => {
        it('ajoute des fichiers depuis input.files', () => {
            const { result } = renderHook(() => useChatInput());
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            act(() => {
                result.current.handleFileSelect({ target: { files: [file] } });
            });

            expect(result.current.chatFiles).toHaveLength(1);
            expect(result.current.chatFiles[0].name).toBe('test.txt');
        });

        it('ajoute des fichiers depuis dataTransfer', () => {
            const { result } = renderHook(() => useChatInput());
            const file = new File(['content'], 'dropped.pdf', { type: 'application/pdf' });

            act(() => {
                result.current.handleFileSelect({ dataTransfer: { files: [file] } });
            });

            expect(result.current.chatFiles).toHaveLength(1);
            expect(result.current.chatFiles[0].name).toBe('dropped.pdf');
        });

        it('remplace le fichier existant (limité à 1 fichier)', () => {
            const { result } = renderHook(() => useChatInput());
            const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
            const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });

            act(() => {
                result.current.handleFileSelect({ target: { files: [file1] } });
            });
            act(() => {
                result.current.handleFileSelect({ target: { files: [file2] } });
            });

            expect(result.current.chatFiles).toHaveLength(1);
            expect(result.current.chatFiles[0].name).toBe('file2.txt');
        });
    });

    describe('removeFile', () => {
        it('supprime le fichier unique', () => {
            const { result } = renderHook(() => useChatInput());
            const file = new File(['content'], 'file.txt', { type: 'text/plain' });

            act(() => {
                result.current.handleFileSelect({ target: { files: [file] } });
            });
            expect(result.current.chatFiles).toHaveLength(1);

            act(() => {
                result.current.removeFile();
            });

            expect(result.current.chatFiles).toHaveLength(0);
        });
    });

    describe('clearInput', () => {
        it('réinitialise message et fichiers', () => {
            const { result } = renderHook(() => useChatInput());
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });

            act(() => {
                result.current.setInputMessage('test message');
                result.current.handleFileSelect({ target: { files: [file] } });
            });

            expect(result.current.inputMessage).toBe('test message');
            expect(result.current.chatFiles).toHaveLength(1);

            act(() => {
                result.current.clearInput();
            });

            expect(result.current.inputMessage).toBe('');
            expect(result.current.chatFiles).toEqual([]);
        });
    });

    describe('addFiles', () => {
        it('ajoute le premier fichier seulement (limité à 1)', () => {
            const { result } = renderHook(() => useChatInput());
            const files = [
                new File(['content1'], 'file1.txt', { type: 'text/plain' }),
                new File(['content2'], 'file2.txt', { type: 'text/plain' })
            ];

            act(() => {
                result.current.addFiles(files);
            });

            expect(result.current.chatFiles).toHaveLength(1);
            expect(result.current.chatFiles[0].name).toBe('file1.txt');
        });
    });

    describe('processCurrentFiles', () => {
        it('traite les fichiers et gère le loading state', async () => {
            const { result } = renderHook(() => useChatInput());
            const files = [new File(['content'], 'test.txt', { type: 'text/plain' })];

            let processingStatesDuringCall = [];
            const promise = act(async () => {
                processingStatesDuringCall.push(result.current.isProcessingFiles);
                const processed = await result.current.processCurrentFiles(files);
                return processed;
            });

            const processed = await promise;

            expect(processed).toEqual([{ type: 'text', name: 'test.txt', content: 'contenu' }]);
            expect(result.current.isProcessingFiles).toBe(false);
        });
    });
});
