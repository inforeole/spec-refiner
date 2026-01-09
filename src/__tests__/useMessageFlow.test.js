import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageFlow } from '../hooks/useMessageFlow';

describe('useMessageFlow', () => {
    let mockClearInput;
    let mockProcessCurrentFiles;
    let mockSendMessage;

    const createMocks = (overrides = {}) => {
        mockClearInput = vi.fn();
        mockProcessCurrentFiles = vi.fn().mockResolvedValue([
            { type: 'text', name: 'file.txt', content: 'processed' }
        ]);
        mockSendMessage = vi.fn().mockResolvedValue(undefined);

        return {
            chatInput: {
                inputMessage: '',
                chatFiles: [],
                clearInput: mockClearInput,
                processCurrentFiles: mockProcessCurrentFiles,
                ...overrides.chatInput
            },
            interviewChat: {
                isLoading: false,
                sendMessage: mockSendMessage,
                ...overrides.interviewChat
            }
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validation', () => {
        it('does nothing if empty message and no files', async () => {
            const mocks = createMocks({
                chatInput: { inputMessage: '', chatFiles: [] }
            });

            const { result } = renderHook(() => useMessageFlow(mocks));

            await act(async () => {
                await result.current.handleSendMessage();
            });

            expect(mockClearInput).not.toHaveBeenCalled();
            expect(mockSendMessage).not.toHaveBeenCalled();
        });

        it('does nothing if only whitespace', async () => {
            const mocks = createMocks({
                chatInput: { inputMessage: '   ', chatFiles: [] }
            });

            const { result } = renderHook(() => useMessageFlow(mocks));

            await act(async () => {
                await result.current.handleSendMessage();
            });

            expect(mockClearInput).not.toHaveBeenCalled();
            expect(mockSendMessage).not.toHaveBeenCalled();
        });

        it('does nothing if loading', async () => {
            const mocks = createMocks({
                chatInput: { inputMessage: 'Test message' },
                interviewChat: { isLoading: true }
            });

            const { result } = renderHook(() => useMessageFlow(mocks));

            await act(async () => {
                await result.current.handleSendMessage();
            });

            expect(mockClearInput).not.toHaveBeenCalled();
            expect(mockSendMessage).not.toHaveBeenCalled();
        });
    });

    describe('message flow', () => {
        it('clears input before processing', async () => {
            const mocks = createMocks({
                chatInput: { inputMessage: 'Test message' }
            });

            const { result } = renderHook(() => useMessageFlow(mocks));

            let clearInputCalledFirst = false;
            mockClearInput.mockImplementation(() => {
                if (!mockSendMessage.mock.calls.length) {
                    clearInputCalledFirst = true;
                }
            });

            await act(async () => {
                await result.current.handleSendMessage();
            });

            expect(clearInputCalledFirst).toBe(true);
        });

        it('processes files before sending', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const mocks = createMocks({
                chatInput: { inputMessage: 'Test', chatFiles: [file] }
            });

            const { result } = renderHook(() => useMessageFlow(mocks));

            await act(async () => {
                await result.current.handleSendMessage();
            });

            expect(mockProcessCurrentFiles).toHaveBeenCalledWith([file]);
            expect(mockSendMessage).toHaveBeenCalledWith('Test', [
                { type: 'text', name: 'file.txt', content: 'processed' }
            ]);
        });

        it('sends message with processed files', async () => {
            const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
            const customProcessFiles = vi.fn().mockResolvedValue([
                { type: 'document', name: 'doc.pdf', content: 'PDF content' }
            ]);

            const mocks = createMocks({
                chatInput: {
                    inputMessage: 'Voici mon doc',
                    chatFiles: [file],
                    processCurrentFiles: customProcessFiles
                }
            });

            const { result } = renderHook(() => useMessageFlow(mocks));

            await act(async () => {
                await result.current.handleSendMessage();
            });

            expect(mockSendMessage).toHaveBeenCalledWith('Voici mon doc', [
                { type: 'document', name: 'doc.pdf', content: 'PDF content' }
            ]);
        });

        it('sends without files if none provided', async () => {
            const mocks = createMocks({
                chatInput: { inputMessage: 'Message sans fichier', chatFiles: [] }
            });

            const { result } = renderHook(() => useMessageFlow(mocks));

            await act(async () => {
                await result.current.handleSendMessage();
            });

            expect(mockProcessCurrentFiles).not.toHaveBeenCalled();
            expect(mockSendMessage).toHaveBeenCalledWith('Message sans fichier', []);
        });

        it('allows sending with only files (no text)', async () => {
            const file = new File(['image'], 'photo.png', { type: 'image/png' });
            const mocks = createMocks({
                chatInput: { inputMessage: '', chatFiles: [file] }
            });

            const { result } = renderHook(() => useMessageFlow(mocks));

            await act(async () => {
                await result.current.handleSendMessage();
            });

            expect(mockClearInput).toHaveBeenCalled();
            expect(mockSendMessage).toHaveBeenCalled();
        });
    });
});
