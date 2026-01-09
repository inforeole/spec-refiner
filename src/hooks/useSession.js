/**
 * React hook for session management with Supabase persistence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSession, saveSession, clearSession, checkSupabaseConnection } from '../services/sessionService';

const WELCOME_MESSAGE = `Salut ! 👋 Je suis l'assistant IA de Phil ([inforeole.fr](https://inforeole.fr)), et je vais t'aider à affiner ton cahier des charges.

Décris-moi ton projet en quelques phrases : quel problème veux-tu résoudre ? Pour qui ? Quelles sont les fonctionnalités principales que tu imagines ?

Tu peux aussi joindre des fichiers (images, PDF, documents) si tu as déjà des maquettes ou des documents de référence.`;

export function useSession() {
    const [sessionData, setSessionData] = useState({
        messages: [],
        phase: 'interview',
        questionCount: 0,
        finalSpec: null
    });
    const [isLoading, setIsLoading] = useState(true);
    const [connectionError, setConnectionError] = useState(null);
    const hasInitialized = useRef(false);
    const lastSavedData = useRef(null);

    // Load session on mount
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        async function init() {
            setIsLoading(true);

            // Check connection first
            const { connected, error: connError } = await checkSupabaseConnection();
            if (!connected) {
                setConnectionError(connError);
                setIsLoading(false);
                return;
            }

            // Load existing session
            const { data, error } = await loadSession();

            if (error) {
                setConnectionError(error);
                setIsLoading(false);
                return;
            }

            if (data && data.messages && data.messages.length > 0) {
                setSessionData(data);
                lastSavedData.current = data;
            } else {
                // New session with welcome message
                const initialData = {
                    messages: [{ role: 'assistant', content: WELCOME_MESSAGE }],
                    phase: 'interview',
                    questionCount: 0,
                    finalSpec: null
                };
                setSessionData(initialData);
                // Save initial session
                await saveSession(initialData, true);
                lastSavedData.current = initialData;
            }

            setIsLoading(false);
        }

        init();
    }, []);

    // Auto-save on data changes (after initial load)
    useEffect(() => {
        if (isLoading || connectionError) return;

        // Skip if data hasn't actually changed
        if (lastSavedData.current &&
            JSON.stringify(lastSavedData.current) === JSON.stringify(sessionData)) {
            return;
        }

        lastSavedData.current = sessionData;
        saveSession(sessionData);
    }, [sessionData, isLoading, connectionError]);

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

    const updateFinalSpec = useCallback((finalSpec) => {
        setSessionData(prev => {
            const newData = { ...prev, finalSpec };
            // Immediate save for critical data
            saveSession(newData, true);
            lastSavedData.current = newData;
            return newData;
        });
    }, []);

    const resetSession = useCallback(async () => {
        const result = await clearSession();
        if (result.error) {
            console.error('Failed to clear session:', result.error);
        }

        const initialData = {
            messages: [{ role: 'assistant', content: WELCOME_MESSAGE }],
            phase: 'interview',
            questionCount: 0,
            finalSpec: null
        };
        setSessionData(initialData);
        await saveSession(initialData, true);
        lastSavedData.current = initialData;
    }, []);

    return {
        ...sessionData,
        isLoading,
        connectionError,
        updateMessages,
        updatePhase,
        updateQuestionCount,
        updateFinalSpec,
        resetSession
    };
}
