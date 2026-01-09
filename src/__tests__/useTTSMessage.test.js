import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTTSMessage } from '../hooks/useTTSMessage';

// Mock useTTS
const mockPlayAudio = vi.fn();
const mockPreloadAudio = vi.fn();
const mockToggleAutoPlay = vi.fn();

vi.mock('../hooks/useTTS', () => ({
    useTTS: vi.fn(() => ({
        isPlaying: false,
        isLoading: false,
        playingMessageId: null,
        autoPlayEnabled: false,
        play: mockPlayAudio,
        toggleAutoPlay: mockToggleAutoPlay,
        preloadAudio: mockPreloadAudio
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
            preloadAudio: mockPreloadAudio
        });
    });

    describe('preload audio', () => {
        it('preloads audio on new assistant message', () => {
            const initialMessages = [];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            const newMessages = [
                { role: 'assistant', content: 'Bonjour!' }
            ];
            rerender({ messages: newMessages });

            expect(mockPreloadAudio).toHaveBeenCalledWith('Bonjour!', 0);
        });

        it('does not preload for user messages', () => {
            const initialMessages = [];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            const newMessages = [
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
                preloadAudio: mockPreloadAudio
            });

            const initialMessages = [];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            const newMessages = [
                { role: 'assistant', content: 'Bonjour!' }
            ];
            rerender({ messages: newMessages });

            expect(mockPlayAudio).toHaveBeenCalledWith('Bonjour!', 0);
        });

        it('does not auto-play when disabled', () => {
            useTTS.mockReturnValue({
                isPlaying: false,
                isLoading: false,
                playingMessageId: null,
                autoPlayEnabled: false,
                play: mockPlayAudio,
                toggleAutoPlay: mockToggleAutoPlay,
                preloadAudio: mockPreloadAudio
            });

            const initialMessages = [];
            const { rerender } = renderHook(
                ({ messages }) => useTTSMessage(messages),
                { initialProps: { messages: initialMessages } }
            );

            const newMessages = [
                { role: 'assistant', content: 'Bonjour!' }
            ];
            rerender({ messages: newMessages });

            expect(mockPlayAudio).not.toHaveBeenCalled();
        });
    });

    describe('session reset', () => {
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
            const newMessages = [
                { role: 'assistant', content: 'Nouveau message' }
            ];
            rerender({ messages: newMessages });

            // Should preload for the new message after reset
            expect(mockPreloadAudio).toHaveBeenCalledWith('Nouveau message', 0);
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
