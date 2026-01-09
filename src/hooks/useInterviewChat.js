import { useState, useRef, useCallback } from 'react';
import { callAPIWithRetry } from '../services/apiService';
import { uploadImage } from '../services/imageService';
import { MARKERS } from '../config/constants';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt';

/**
 * Hook pour gérer la logique de conversation avec l'API
 * @param {Object} sessionHook - Retour du hook useSession
 * @returns {Object} États et handlers pour le chat
 */
export function useInterviewChat(sessionHook) {
    const {
        messages,
        updateMessages,
        updatePhase,
        updateQuestionCount,
        updateFinalSpec
    } = sessionHook;

    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef(null);

    /**
     * Construit l'historique de conversation pour l'API
     */
    const buildConversationHistory = useCallback((additionalMessage = null) => {
        const history = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.map(m => ({
                role: m.role,
                content: m.apiContent || m.content
            }))
        ];
        if (additionalMessage) {
            history.push(additionalMessage);
        }
        return history;
    }, [messages]);

    /**
     * Appelle l'API avec un AbortController
     */
    const callAPI = useCallback(async (conversationHistory) => {
        abortControllerRef.current = new AbortController();
        return callAPIWithRetry({
            messages: conversationHistory,
            signal: abortControllerRef.current.signal
        });
    }, []);

    /**
     * Gère la complétion du spec
     */
    const handleSpecComplete = useCallback((response) => {
        const specContent = response.replace(MARKERS.SPEC_COMPLETE, '').trim();
        updateFinalSpec(specContent);
        updatePhase('complete');
    }, [updateFinalSpec, updatePhase]);

    /**
     * Envoie un message avec fichiers optionnels
     * @param {string} messageText - Texte du message
     * @param {Array} processedFiles - Fichiers déjà traités par processFiles()
     * @returns {Promise<boolean>} true si succès
     */
    const sendMessage = useCallback(async (messageText, processedFiles = []) => {
        if ((!messageText.trim() && processedFiles.length === 0) || isLoading) {
            return false;
        }

        setIsLoading(true);

        try {
            let apiContent = [];

            if (processedFiles.length > 0) {
                let textContent = messageText;

                const textFiles = processedFiles.filter(f => f.type === 'text');
                if (textFiles.length > 0) {
                    textContent += '\n\nDocuments attachés :';
                    textFiles.forEach(f => {
                        textContent += `\n\n--- ${f.name} ---\n${f.content}`;
                    });
                }

                if (textContent.trim()) {
                    apiContent.push({ type: 'text', text: textContent });
                }

                // Upload images to Supabase Storage for persistence
                const imageFiles = processedFiles.filter(f => f.type === 'image');
                for (const f of imageFiles) {
                    const { url, error } = await uploadImage(f.content, f.name);
                    if (url) {
                        apiContent.push({
                            type: 'image_url',
                            image_url: { url }
                        });
                    } else {
                        console.warn('Image upload failed:', error);
                        apiContent.push({
                            type: 'image_url',
                            image_url: { url: f.content }
                        });
                    }
                }
            } else {
                apiContent = messageText;
            }

            const fileCount = processedFiles.length;
            const displayContent = messageText + (fileCount > 0 ? `\n\n[${fileCount} fichier(s) joint(s)]` : '');

            updateMessages(prev => [...prev, {
                role: 'user',
                content: displayContent,
                apiContent: apiContent
            }]);

            const conversationHistory = buildConversationHistory({ role: 'user', content: apiContent });
            const { response, isValid } = await callAPI(conversationHistory);

            if (!isValid) {
                console.error('Réponse API invalide après retries:', response);
                updateMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '⚠️ Oups ! J\'ai eu un problème technique et ma réponse était incohérente. Peux-tu reformuler ta dernière réponse ou cliquer sur le bouton "Générer les specs" si tu penses qu\'on a assez d\'informations ?'
                }]);
                setIsLoading(false);
                return false;
            }

            if (response.includes(MARKERS.SPEC_COMPLETE)) {
                handleSpecComplete(response);
            } else {
                updateMessages(prev => [...prev, { role: 'assistant', content: response }]);
                updateQuestionCount(prev => prev + 1);
            }

            setIsLoading(false);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                return false;
            }
            console.error(error);
            updateMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur: ${error.message}` }]);
            setIsLoading(false);
            return false;
        }
    }, [isLoading, buildConversationHistory, callAPI, updateMessages, handleSpecComplete, updateQuestionCount]);

    /**
     * Demande la génération du spec final
     */
    const requestFinalSpec = useCallback(async () => {
        setIsLoading(true);

        const conversationHistory = buildConversationHistory({
            role: 'user',
            content: 'Génère maintenant la spécification finale complète avec toutes les informations recueillies. IMPORTANT: Commence le document par 2 phrases qui résument clairement l\'objectif du projet et le problème qu\'il résout. Réponds avec [SPEC_COMPLETE] suivi du document.'
        });

        try {
            const { response, isValid } = await callAPI(conversationHistory);

            if (!isValid) {
                alert('La génération des spécifications a échoué (réponse incohérente). Veuillez réessayer.');
                setIsLoading(false);
                return false;
            }

            handleSpecComplete(response);
            setIsLoading(false);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                return false;
            }
            alert(`Erreur: ${error.message}`);
            setIsLoading(false);
            return false;
        }
    }, [buildConversationHistory, callAPI, handleSpecComplete]);

    /**
     * Annule la requête en cours
     */
    const abortRequest = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
    }, []);

    return {
        isLoading,
        sendMessage,
        requestFinalSpec,
        abortRequest
    };
}
