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
    const preloadControllersRef = useRef(new Set());
    const audioCacheRef = useRef(new Map());

    const clearAudioResources = useCallback(() => {
        audioRef.current.pause();
        audioRef.current.src = '';

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        preloadControllersRef.current.forEach(controller => controller.abort());
        preloadControllersRef.current.clear();

        audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
        audioCacheRef.current.clear();
    }, []);

    const reset = useCallback(() => {
        clearAudioResources();
        setIsPlaying(false);
        setPlayingMessageId(null);
        setIsLoading(false);
    }, [clearAudioResources]);

    // Cleanup on unmount
    useEffect(() => clearAudioResources, [clearAudioResources]);

    // Cleanup when userId changes (prevents audio mixing between users)
    useEffect(() => {
        reset();
    }, [reset, userId]);

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
    const preloadAudio = useCallback(async (text) => {
        const cacheKey = JSON.stringify([userId, text]);
        if (audioCacheRef.current.has(cacheKey)) return;

        const controller = new AbortController();
        preloadControllersRef.current.add(controller);

        try {
            const { audio, error } = await synthesizeSpeech(text, controller.signal);
            if (controller.signal.aborted) return;

            if (error) {
                console.error('TTS preload error:', error);
                // Don't disable TTS on preload errors - manual play may still work
                return;
            }

            if (audio) {
                const url = URL.createObjectURL(audio);
                audioCacheRef.current.set(cacheKey, url);
            }
        } finally {
            preloadControllersRef.current.delete(controller);
        }
    }, [userId]);

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
        const cacheKey = JSON.stringify([userId, text]);

        // Check cache first - if available, play instantly
        const cachedUrl = audioCacheRef.current.get(cacheKey);
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
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const { audio, error } = await synthesizeSpeech(text, controller.signal);
        if (controller.signal.aborted) return;

        abortControllerRef.current = null;
        setIsLoading(false);

        if (error) {
            console.error('TTS error:', error);
            // Don't disable TTS permanently - just fail this attempt
            setPlayingMessageId(null);
            return;
        }

        if (audio) {
            const url = URL.createObjectURL(audio);
            audioCacheRef.current.set(cacheKey, url);
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
    }, [isPlaying, playingMessageId, userId]);

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
        reset,
        toggleAutoPlay,
        preloadAudio
    };
}
