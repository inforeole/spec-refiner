/**
 * Hook combining TTS functionality with message-based auto-scroll and auto-play
 * Wraps useTTS and adds message-aware behavior
 */

import { useRef, useEffect } from 'react';
import { useTTS } from './useTTS';

/**
 * @param {Array} messages - Chat messages
 * @param {string|null} userId - Current user ID for cleanup on user change
 */
export function useTTSMessage(messages, userId) {
    const {
        isPlaying: isPlayingAudio,
        isLoading: isLoadingAudio,
        playingMessageId,
        autoPlayEnabled,
        play: playAudio,
        toggleAutoPlay,
        preloadAudio
    } = useTTS(userId);

    const messagesEndRef = useRef(null);
    // Initialize to 0 to properly detect the first message
    const lastMessageCountRef = useRef(0);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Preload and auto-play TTS for new assistant messages
    // Note: Message 0 (welcome) is never played - TTS starts from message 1+
    useEffect(() => {
        const prevCount = lastMessageCountRef.current;
        const currCount = messages.length;

        // No messages yet or only welcome message
        if (currCount <= 1) {
            lastMessageCountRef.current = currCount;
            return;
        }

        // No new messages
        if (currCount === prevCount) {
            return;
        }

        // Messages were cleared (session reset) - sync ref
        if (currCount < prevCount) {
            lastMessageCountRef.current = currCount;
            return;
        }

        // New messages detected (currCount > prevCount)
        // Only play if this is a genuinely new message (not session restore)
        if (prevCount > 0) {
            const lastMessage = messages[currCount - 1];
            if (lastMessage.role === 'assistant') {
                const messageId = currCount - 1;
                preloadAudio(lastMessage.content, messageId);
                if (autoPlayEnabled) {
                    playAudio(lastMessage.content, messageId);
                }
            }
        }

        lastMessageCountRef.current = currCount;
    }, [messages, autoPlayEnabled, playAudio, preloadAudio]);

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
