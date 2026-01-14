/**
 * React hook for session management with Supabase persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSession, saveSession, clearSession, checkSupabaseConnection } from '../services/sessionService';
import { deleteImage } from '../services/imageService';
import { extractStorageImageUrls } from '../utils/messageUtils';

// Détection mobile (user agent + écran tactile)
const isMobileDevice = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    return mobileRegex.test(userAgent.toLowerCase()) || (isTouchDevice && isSmallScreen);
};

const getWelcomeMessage = () => {
    const baseMessage = `Salut ! Comment tu t'appelles ?`;
    if (isMobileDevice()) {
        return `📱 L'appli fonctionne sur mobile, mais l'expérience est meilleure sur ordinateur.\n\n${baseMessage}`;
    }
    return baseMessage;
};

/**
 * Hook for managing user session
 * @param {string|null} userId - The authenticated user's ID
 */
export function useSession(userId) {
    const [sessionData, setSessionData] = useState({
        messages: [],
        phase: 'interview',
        questionCount: 0,
        finalSpec: null,
        isModificationMode: false,
        messageCountAtLastSpec: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(null);
    const hasInitialized = useRef(false);
    const lastSavedData = useRef(null);
    const currentUserId = useRef(null);
    // CRITICAL: Synchronous flag to block auto-save during user switch
    // useState is async and causes race conditions, this ref is synchronous
    const isLoadingRef = useRef(true);

    // Load session when userId changes
    useEffect(() => {
        // Skip if no userId
        if (!userId) {
            isLoadingRef.current = false;
            setIsLoading(false);
            return;
        }

        // Skip if same userId already initialized
        if (hasInitialized.current && currentUserId.current === userId) {
            return;
        }

        // CRITICAL: Block auto-save SYNCHRONOUSLY via ref before anything else
        // useState is async and causes race conditions - ref is synchronous
        isLoadingRef.current = true;
        setIsLoading(true);

        // Reset refs for new user (important: clear lastSavedData to prevent race conditions)
        hasInitialized.current = true;
        currentUserId.current = userId;
        lastSavedData.current = null;

        async function init() {
            setConnectionError(null);

            // Check connection first
            const { connected, error: connError } = await checkSupabaseConnection();
            if (!connected) {
                setConnectionError(connError);
                isLoadingRef.current = false;
                setIsLoading(false);
                return;
            }

            // Load existing session
            const { data, error } = await loadSession(userId);

            if (error) {
                setConnectionError(error);
                isLoadingRef.current = false;
                setIsLoading(false);
                return;
            }

            if (data && data.messages && data.messages.length > 0) {
                setSessionData(data);
                lastSavedData.current = data;
            } else {
                // New session with welcome message
                const initialData = {
                    messages: [{ role: 'assistant', content: getWelcomeMessage() }],
                    phase: 'interview',
                    questionCount: 0,
                    finalSpec: null,
                    isModificationMode: false,
                    messageCountAtLastSpec: 0
                };
                setSessionData(initialData);
                // Save initial session
                await saveSession(userId, initialData, true);
                lastSavedData.current = initialData;
            }

            isLoadingRef.current = false;
            setIsLoading(false);
        }

        init();
    }, [userId]);

    // Auto-save on data changes (after initial load)
    useEffect(() => {
        // CRITICAL: Check ref first (synchronous) to prevent race condition during user switch
        if (!userId || isLoading || isLoadingRef.current || connectionError) return;

        // Safety: never save if we only have the welcome message (prevents overwriting real data)
        // This can happen during race conditions when switching users
        if (!lastSavedData.current && sessionData.messages.length <= 1) {
            return;
        }

        // Skip if data hasn't actually changed
        if (lastSavedData.current &&
            JSON.stringify(lastSavedData.current) === JSON.stringify(sessionData)) {
            return;
        }

        lastSavedData.current = sessionData;
        saveSession(userId, sessionData);
    }, [userId, sessionData, isLoading, connectionError]);

    // Update functions
    const updateMessages = useCallback((updater) => {
        setSessionData(prev => ({
            ...prev,
            messages: typeof updater === 'function' ? updater(prev.messages) : updater
        }));
    }, []);

    const updatePhase = useCallback((phase) => {
        setSessionData(prev => ({ ...prev, phase }));
    }, []);

    const updateQuestionCount = useCallback((updater) => {
        setSessionData(prev => ({
            ...prev,
            questionCount: typeof updater === 'function' ? updater(prev.questionCount) : updater
        }));
    }, []);

    const enterModificationMode = useCallback(() => {
        setSessionData(prev => ({ ...prev, isModificationMode: true }));
    }, []);

    const exitModificationMode = useCallback(() => {
        setSessionData(prev => ({ ...prev, isModificationMode: false }));
    }, []);

    const updateMessageCountAtLastSpec = useCallback((count) => {
        setSessionData(prev => ({ ...prev, messageCountAtLastSpec: count }));
    }, []);

    const updateFinalSpec = useCallback((finalSpec) => {
        if (!userId) return;
        setSessionData(prev => {
            const newData = { ...prev, finalSpec };
            // Immediate save for critical data
            saveSession(userId, newData, true);
            lastSavedData.current = newData;
            return newData;
        });
    }, [userId]);

    const resetSession = useCallback(async () => {
        if (!userId) return;

        // Extract and delete all images from Storage before clearing session
        const imageUrls = extractStorageImageUrls(sessionData.messages);

        if (imageUrls.length > 0) {
            await Promise.all(imageUrls.map(url => deleteImage(url)));
        }

        const result = await clearSession(userId);
        if (result.error) {
            console.error('Failed to clear session:', result.error);
        }

        const initialData = {
            messages: [{ role: 'assistant', content: getWelcomeMessage() }],
            phase: 'interview',
            questionCount: 0,
            finalSpec: null,
            isModificationMode: false,
            messageCountAtLastSpec: 0
        };
        setSessionData(initialData);
        await saveSession(userId, initialData, true);
        lastSavedData.current = initialData;
    }, [userId, sessionData.messages]);

    return {
        ...sessionData,
        isLoading,
        connectionError,
        updateMessages,
        updatePhase,
        updateQuestionCount,
        updateFinalSpec,
        resetSession,
        enterModificationMode,
        exitModificationMode,
        updateMessageCountAtLastSpec
    };
}
