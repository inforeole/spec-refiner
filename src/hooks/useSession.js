/**
 * React hook for session management with Supabase persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSession, saveSession, checkSupabaseConnection, cancelPendingSaves } from '../services/sessionService';
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
 * @param {string|null} sessionToken - The authenticated session token
 */
export function useSession(userId, sessionToken) {
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
    const [saveError, setSaveError] = useState(null);
    const hasInitialized = useRef(false);
    const lastSavedData = useRef(null);
    const currentUserId = useRef(null);
    const currentSessionToken = useRef(null);
    const forceImmediateSave = useRef(false);
    // CRITICAL: Synchronous flag to block auto-save during user switch
    // useState is async and causes race conditions, this ref is synchronous
    const isLoadingRef = useRef(true);

    // Load session when userId changes
    useEffect(() => {
        // Cancel any pending saves from previous user to prevent race conditions
        if (currentSessionToken.current && currentSessionToken.current !== sessionToken) {
            cancelPendingSaves(currentSessionToken.current);
        }

        // Skip if no userId (logged out)
        if (!userId) {
            // Also cancel saves if logging out
            if (currentSessionToken.current) {
                cancelPendingSaves(currentSessionToken.current);
            }
            isLoadingRef.current = false;
            setIsLoading(false);
            return;
        }

        if (!sessionToken) {
            setConnectionError('Session expirée. Reconnecte-toi.');
            isLoadingRef.current = false;
            setIsLoading(false);
            return;
        }

        // Skip if the same authenticated session is already initialized
        if (hasInitialized.current &&
            currentUserId.current === userId &&
            currentSessionToken.current === sessionToken) {
            return;
        }

        // CRITICAL: Block auto-save SYNCHRONOUSLY via ref before anything else
        // useState is async and causes race conditions - ref is synchronous
        isLoadingRef.current = true;
        setIsLoading(true);

        // Reset refs for new user (important: clear lastSavedData to prevent race conditions)
        hasInitialized.current = true;
        currentUserId.current = userId;
        currentSessionToken.current = sessionToken;
        lastSavedData.current = null;
        let active = true;

        const isCurrentSession = () => (
            active &&
            currentUserId.current === userId &&
            currentSessionToken.current === sessionToken
        );

        async function init() {
            setConnectionError(null);
            setSaveError(null);

            // Check connection first
            const { connected, error: connError } = await checkSupabaseConnection(sessionToken);
            if (!isCurrentSession()) return;

            if (!connected) {
                setConnectionError(connError);
                isLoadingRef.current = false;
                setIsLoading(false);
                return;
            }

            // Load existing session
            const { data, error } = await loadSession(sessionToken);
            if (!isCurrentSession()) return;

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
                const saveResult = await saveSession(sessionToken, initialData, true);
                if (!isCurrentSession()) return;

                if (saveResult.success) {
                    lastSavedData.current = initialData;
                } else {
                    setSaveError(saveResult.error);
                }
            }

            isLoadingRef.current = false;
            setIsLoading(false);
        }

        init();
        return () => {
            active = false;
        };
    }, [userId, sessionToken]);

    // Auto-save on data changes (after initial load)
    useEffect(() => {
        // CRITICAL: Check ref first (synchronous) to prevent race condition during user switch
        if (!sessionToken || isLoading || isLoadingRef.current || connectionError) return;

        // Safety: never save if we only have the welcome message (prevents overwriting real data)
        // This can happen during race conditions when switching users
        if (!lastSavedData.current && sessionData.messages.length <= 1) {
            return;
        }

        // Skip if data hasn't actually changed
        if (lastSavedData.current &&
            JSON.stringify(lastSavedData.current) === JSON.stringify(sessionData)) {
            forceImmediateSave.current = false;
            setSaveError(null);
            return;
        }

        let active = true;
        const dataToSave = sessionData;
        const immediate = forceImmediateSave.current;
        forceImmediateSave.current = false;
        setSaveError(null);

        saveSession(sessionToken, dataToSave, immediate).then(result => {
            if (!active || currentSessionToken.current !== sessionToken) {
                return;
            }

            if (result.success) {
                lastSavedData.current = dataToSave;
                setSaveError(null);
                return;
            }

            if (!result.cancelled) {
                console.error('Failed to save session:', result.error);
                setSaveError(result.error);
            }
        });

        return () => {
            active = false;
        };
    }, [sessionToken, sessionData, isLoading, connectionError]);

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
        if (!sessionToken) return;
        forceImmediateSave.current = true;
        setSessionData(prev => ({ ...prev, finalSpec }));
    }, [sessionToken]);

    const resetSession = useCallback(async () => {
        if (!sessionToken) return;

        const resetUserId = currentUserId.current;
        const resetSessionToken = sessionToken;

        // Keep image URLs until the remote session no longer references them
        const imageUrls = extractStorageImageUrls(sessionData.messages);

        const initialData = {
            messages: [{ role: 'assistant', content: getWelcomeMessage() }],
            phase: 'interview',
            questionCount: 0,
            finalSpec: null,
            isModificationMode: false,
            messageCountAtLastSpec: 0
        };
        lastSavedData.current = null;
        setSaveError(null);
        setSessionData(initialData);
        const saveResult = await saveSession(resetSessionToken, initialData, true);
        const isCurrentReset = (
            currentUserId.current === resetUserId &&
            currentSessionToken.current === resetSessionToken
        );

        if (!isCurrentReset) {
            if (saveResult.success && imageUrls.length > 0) {
                await Promise.all(imageUrls.map(url => deleteImage(url)));
            }
            return;
        }

        if (saveResult.success) {
            lastSavedData.current = initialData;
            setSaveError(null);
            if (imageUrls.length > 0) {
                await Promise.all(imageUrls.map(url => deleteImage(url)));
            }
        } else {
            console.error('Failed to save reset session:', saveResult.error);
            setSaveError(saveResult.error);
        }
    }, [sessionToken, sessionData.messages]);

    return {
        ...sessionData,
        isLoading,
        connectionError,
        saveError,
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
