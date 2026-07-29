/**
 * Hook combining TTS functionality with message-based auto-scroll and auto-play
 * Wraps useTTS and adds message-aware behavior
 */

import { useRef, useEffect } from 'react';
import { useTTS } from './useTTS';

/**
 * @param {Array} messages - Chat messages
 * @param {string|null} userId - Current user ID for cleanup on user change
 * @param {boolean} isSessionLoading - Whether the current user's history is loading
 */
export function useTTSMessage(messages, userId, isSessionLoading = false) {
    const {
        isPlaying: isPlayingAudio,
        isLoading: isLoadingAudio,
        playingMessageId,
        autoPlayEnabled,
        play: playAudio,
        toggleAutoPlay,
        preloadAudio,
        reset: resetAudio
    } = useTTS(userId);

    const messagesEndRef = useRef(null);
    // Initialize to 0 to properly detect the first message
    const lastMessageCountRef = useRef(0);
    const lastUserIdRef = useRef(userId);
    const awaitingSessionRestoreRef = useRef(false);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Preload and auto-play TTS for new assistant messages
    // Note: Message 0 (welcome) is never played - TTS starts from message 1+
    useEffect(() => {
        const prevCount = lastMessageCountRef.current;
        const currCount = messages.length;

        if (lastUserIdRef.current !== userId) {
            lastUserIdRef.current = userId;
            awaitingSessionRestoreRef.current = true;
            lastMessageCountRef.current = currCount;
            return;
        }

        if (awaitingSessionRestoreRef.current) {
            lastMessageCountRef.current = currCount;
            if (!isSessionLoading) {
                awaitingSessionRestoreRef.current = false;
            }
            return;
        }

        if (isSessionLoading) {
            lastMessageCountRef.current = currCount;
            return;
        }

        // Messages were cleared (session reset) - sync ref and clear TTS state
        if (currCount < prevCount) {
            resetAudio();
            lastMessageCountRef.current = currCount;
            return;
        }

        // No messages yet or only welcome message
        if (currCount <= 1) {
            lastMessageCountRef.current = currCount;
            return;
        }

        // No new messages
        if (currCount === prevCount) {
            return;
        }

        // New messages detected (currCount > prevCount)
        // Only play if this is a genuinely new message (not session restore)
        if (prevCount > 0) {
            const lastMessage = messages[currCount - 1];
            if (lastMessage.role === 'assistant') {
                const messageId = currCount - 1;
                if (autoPlayEnabled) {
                    playAudio(lastMessage.content, messageId);
                } else {
                    preloadAudio(lastMessage.content, messageId);
                }
            }
        }

        lastMessageCountRef.current = currCount;
    }, [
        messages,
        userId,
        isSessionLoading,
        autoPlayEnabled,
        playAudio,
        preloadAudio,
        resetAudio
    ]);

    return {
        messagesEndRef,
        playingMessageId,
        isPlayingAudio,
        isLoadingAudio,
        autoPlayEnabled,
        playAudio,
        toggleAutoPlay
    };
}
