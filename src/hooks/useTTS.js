/**
 * React hook for text-to-speech functionality
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { synthesizeSpeech } from '../services/ttsService';

const STORAGE_KEY = 'spec-refiner-tts-autoplay';

/**
 * @param {string|null} userId - Current user ID, used to cleanup cache on user change
 */
export function useTTS(userId) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playingMessageId, setPlayingMessageId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [ttsAvailable] = useState(true);
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(() => {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    });

    const audioRef = useRef(new Audio());
    const abortControllerRef = useRef(null);
    const audioCacheRef = useRef(new Map());

    // Cleanup on unmount
    useEffect(() => {
        const audio = audioRef.current;
        const audioCache = audioCacheRef.current;
        return () => {
            audio.pause();
            audio.src = '';
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            // Revoke all cached blob URLs to free memory
            audioCache.forEach(url => URL.revokeObjectURL(url));
            audioCache.clear();
        };
    }, []);

    // Cleanup when userId changes (prevents audio mixing between users)
    useEffect(() => {
        // Stop any playing audio
        audioRef.current.pause();
        audioRef.current.src = '';
        setIsPlaying(false);
        setPlayingMessageId(null);
        setIsLoading(false);

        // Abort pending requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // Clear audio cache (message indexes are not unique across users)
        audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
        audioCacheRef.current.clear();
    }, [userId]);

    // Setup audio event listeners
    useEffect(() => {
        const audio = audioRef.current;

        const handleEnded = () => {
            setIsPlaying(false);
            setPlayingMessageId(null);
        };

        const handleError = () => {
            setIsPlaying(false);
            setPlayingMessageId(null);
            setIsLoading(false);
        };

        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);

        return () => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
        };
    }, []);

    // Preload audio in background and cache it
    const preloadAudio = useCallback(async (text, messageId) => {
        if (audioCacheRef.current.has(messageId)) return;

        const { audio, error } = await synthesizeSpeech(text);
        if (error) {
            console.error('TTS preload error:', error);
            // Don't disable TTS on preload errors - manual play may still work
            return;
        }

        if (audio) {
            const url = URL.createObjectURL(audio);
            audioCacheRef.current.set(messageId, url);
        }
    }, []);

    const play = useCallback(async (text, messageId) => {
        // If already playing this message, stop it
        if (playingMessageId === messageId && isPlaying) {
            audioRef.current.pause();
            audioRef.current.src = '';
            setIsPlaying(false);
            setPlayingMessageId(null);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            return;
        }

        // Stop any current playback
        audioRef.current.pause();
        audioRef.current.src = '';

        // Cancel any pending request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        setPlayingMessageId(messageId);

        // Check cache first - if available, play instantly
        const cachedUrl = audioCacheRef.current.get(messageId);
        if (cachedUrl) {
            audioRef.current.src = cachedUrl;
            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (playError) {
                // NotAllowedError = browser blocked autoplay (no user interaction yet)
                if (playError.name !== 'NotAllowedError') {
                    console.error('Audio play error (cached):', playError);
                }
                setPlayingMessageId(null);
            }
            return;
        }

        // Not in cache - generate, cache, then play
        setIsLoading(true);
        abortControllerRef.current = new AbortController();

        const { audio, error } = await synthesizeSpeech(text, abortControllerRef.current.signal);

        setIsLoading(false);

        if (error) {
            console.error('TTS error:', error);
            // Don't disable TTS permanently - just fail this attempt
            setPlayingMessageId(null);
            return;
        }

        if (audio) {
            const url = URL.createObjectURL(audio);
            audioCacheRef.current.set(messageId, url);
            audioRef.current.src = url;

            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (playError) {
                // NotAllowedError = browser blocked autoplay (no user interaction yet)
                // This is expected for auto-play, manual play will work after interaction
                if (playError.name !== 'NotAllowedError') {
                    console.error('Audio play error:', playError);
                }
                setPlayingMessageId(null);
            }
        } else {
            setPlayingMessageId(null);
        }
    }, [playingMessageId, isPlaying]);

    const stop = useCallback(() => {
        audioRef.current.pause();
        audioRef.current.src = '';
        setIsPlaying(false);
        setPlayingMessageId(null);

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    const toggleAutoPlay = useCallback(() => {
        setAutoPlayEnabled(prev => {
            const newValue = !prev;
            localStorage.setItem(STORAGE_KEY, String(newValue));
            return newValue;
        });
    }, []);

    return {
        isPlaying,
        isLoading,
        playingMessageId,
        autoPlayEnabled,
        ttsAvailable,
        play,
        stop,
        toggleAutoPlay,
        preloadAudio
    };
}
