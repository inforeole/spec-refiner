import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTTSMessage } from '../hooks/useTTSMessage';

// Mock useTTS
const mockPlayAudio = vi.fn();
const mockPreloadAudio = vi.fn();
const mockResetAudio = vi.fn();
const mockToggleAutoPlay = vi.fn();

vi.mock('../hooks/useTTS', () => ({
    useTTS: vi.fn(() => ({
        isPlaying: false,
        isLoading: false,
        playingMessageId: null,
        autoPlayEnabled: false,
        play: mockPlayAudio,
        toggleAutoPlay: mockToggleAutoPlay,
        preloadAudio: mockPreloadAudio,
        reset: mockResetAudio
    }))
}));

// Import the mock to control it
import { useTTS } from '../hooks/useTTS';

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();

describe('useTTSMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock to default state
        useTTS.mockReturnValue({
            isPlaying: false,
            isLoading: false,
            playingMessageId: null,
            autoPlayEnabled: false,
            play: mockPlayAudio,
            toggleAutoPlay: mockToggleAutoPlay,
            preloadAudio: mockPreloadAudio,
            reset: mockResetAudio
        });
    });

    describe('preload audio', () => {
        it('preloads audio on new assistant message', () => {
            const initialMessages = [
                { role: 'assistant', content: 'Bienvenue' },
                { role: 'user', content: 'Mon projet' }
            ];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            const newMessages = [
                ...initialMessages,
                { role: 'assistant', content: 'Bonjour!' }
            ];
            rerender({ messages: newMessages });

            expect(mockPreloadAudio).toHaveBeenCalledWith('Bonjour!', 2);
        });

        it('does not preload for user messages', () => {
            const initialMessages = [
                { role: 'assistant', content: 'Bienvenue' }
            ];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            const newMessages = [
                ...initialMessages,
                { role: 'user', content: 'Mon projet' }
            ];
            rerender({ messages: newMessages });

            expect(mockPreloadAudio).not.toHaveBeenCalled();
        });
    });

    describe('auto-play', () => {
        it('auto-plays when enabled', () => {
            useTTS.mockReturnValue({
                isPlaying: false,
                isLoading: false,
                playingMessageId: null,
                autoPlayEnabled: true,
                play: mockPlayAudio,
                toggleAutoPlay: mockToggleAutoPlay,
                preloadAudio: mockPreloadAudio,
                reset: mockResetAudio
            });

            const initialMessages = [
                { role: 'assistant', content: 'Bienvenue' },
                { role: 'user', content: 'Mon projet' }
            ];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            const newMessages = [
                ...initialMessages,
                { role: 'assistant', content: 'Bonjour!' }
            ];
            rerender({ messages: newMessages });

            expect(mockPlayAudio).toHaveBeenCalledWith('Bonjour!', 2);
            expect(mockPreloadAudio).not.toHaveBeenCalled();
        });

        it('does not auto-play when disabled', () => {
            useTTS.mockReturnValue({
                isPlaying: false,
                isLoading: false,
                playingMessageId: null,
                autoPlayEnabled: false,
                play: mockPlayAudio,
                toggleAutoPlay: mockToggleAutoPlay,
                preloadAudio: mockPreloadAudio,
                reset: mockResetAudio
            });

            const initialMessages = [
                { role: 'assistant', content: 'Bienvenue' },
                { role: 'user', content: 'Mon projet' }
            ];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            const newMessages = [
                ...initialMessages,
                { role: 'assistant', content: 'Bonjour!' }
            ];
            rerender({ messages: newMessages });

            expect(mockPlayAudio).not.toHaveBeenCalled();
        });
    });

    describe('session reset', () => {
        it('clears TTS state when messages are cleared', () => {
            const initialMessages = [
                { role: 'assistant', content: 'Message 1' },
                { role: 'user', content: 'Message 2' }
            ];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages, 'user-1'),
                { initialProps: { messages: initialMessages } }
            );

            rerender({ messages: [] });

            expect(mockResetAudio).toHaveBeenCalledOnce();
        });

        it('resets tracking on session clear', () => {
            const initialMessages = [
                { role: 'assistant', content: 'Message 1' },
                { role: 'user', content: 'Message 2' }
            ];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            // Clear messages (session reset)
            rerender({ messages: [] });

            // Add new message after reset
            vi.clearAllMocks();
            const welcomeMessages = [
                { role: 'assistant', content: 'Bienvenue' }
            ];
            rerender({ messages: welcomeMessages });

            const userMessages = [
                ...welcomeMessages,
                { role: 'user', content: 'Nouveau projet' }
            ];
            rerender({ messages: userMessages });

            rerender({
                messages: [
                    ...userMessages,
                    { role: 'assistant', content: 'Nouveau message' }
                ]
            });

            // Should preload for the new message after reset
            expect(mockPreloadAudio).toHaveBeenCalledWith('Nouveau message', 2);
        });
    });

    describe('changement d’utilisateur', () => {
        it('ne lit pas l’historique restauré du nouvel utilisateur', () => {
            const firstMessages = [
                { role: 'assistant', content: 'Bienvenue A' },
                { role: 'user', content: 'Projet A' }
            ];
            const { rerender } = renderHook(
                ({ messages, userId, isSessionLoading }) => (
                    useTTSMessage(messages, userId, isSessionLoading)
                ),
                {
                    initialProps: {
                        messages: firstMessages,
                        userId: 'user-a',
                        isSessionLoading: false
                    }
                }
            );

            vi.clearAllMocks();
            rerender({
                userId: 'user-b',
                messages: firstMessages,
                isSessionLoading: false
            });
            rerender({
                userId: 'user-b',
                messages: firstMessages,
                isSessionLoading: true
            });
            rerender({
                userId: 'user-b',
                isSessionLoading: false,
                messages: [
                    { role: 'assistant', content: 'Bienvenue B' },
                    { role: 'user', content: 'Projet B' },
                    { role: 'assistant', content: 'Historique B' }
                ]
            });

            expect(mockPreloadAudio).not.toHaveBeenCalled();
            expect(mockPlayAudio).not.toHaveBeenCalled();
        });
    });

    describe('auto-scroll', () => {
        it('scrolls to bottom on new message', () => {
            const { result, rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: [] } }
            );

            // Set up the ref with mock scrollIntoView
            act(() => {
                result.current.messagesEndRef.current = {
                    scrollIntoView: mockScrollIntoView
                };
            });

            const newMessages = [
                { role: 'user', content: 'Test' }
            ];
            rerender({ messages: newMessages });

            expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
        });
    });

    describe('return values', () => {
        it('returns all expected properties', () => {
            const { result } = renderHook(() => useTTSMessage([]));

            expect(result.current).toHaveProperty('messagesEndRef');
            expect(result.current).toHaveProperty('playingMessageId');
            expect(result.current).toHaveProperty('isPlayingAudio');
            expect(result.current).toHaveProperty('isLoadingAudio');
            expect(result.current).toHaveProperty('autoPlayEnabled');
            expect(result.current).toHaveProperty('playAudio');
            expect(result.current).toHaveProperty('toggleAutoPlay');
        });
    });
});
