/**
 * Hook combining TTS functionality with message-based auto-scroll and auto-play
 * Wraps useTTS and adds message-aware behavior
 */

import { useRef, useEffect } from 'react';
import { useTTS } from './useTTS';

export function useTTSMessage(messages) {
    const {
        isPlaying: isPlayingAudio,
        isLoading: isLoadingAudio,
        playingMessageId,
        autoPlayEnabled,
        play: playAudio,
        toggleAutoPlay,
        preloadAudio
    } = useTTS();

    const messagesEndRef = useRef(null);
    const lastMessageCountRef = useRef(messages.length);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Preload and auto-play TTS for new assistant messages
    useEffect(() => {
        // Reset ref if messages were cleared (new session)
        if (messages.length < lastMessageCountRef.current) {
            lastMessageCountRef.current = messages.length;
            return;
        }

        if (messages.length === 0) return;

        // Check if a new message was added
        if (messages.length > lastMessageCountRef.current) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'assistant') {
                const messageId = messages.length - 1;
                // Preload audio in background
                preloadAudio(lastMessage.content, messageId);
                // Auto-play if enabled
                if (autoPlayEnabled) {
                    playAudio(lastMessage.content, messageId);
                }
            }
        }
        lastMessageCountRef.current = messages.length;
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
