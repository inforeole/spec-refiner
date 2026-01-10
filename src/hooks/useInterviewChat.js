import { useState, useRef, useCallback } from 'react';
import { callAPIWithRetry } from '../services/apiService';
import { uploadImage } from '../services/imageService';
import { generateFileSummary } from '../services/summaryService';
import { MARKERS } from '../config/constants';
import { getSystemPrompt } from '../prompts/systemPrompt';

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
        updateFinalSpec,
        isModificationMode,
        exitModificationMode,
        updateMessageCountAtLastSpec
    } = sessionHook;

    const [isLoading, setIsLoading] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const abortControllerRef = useRef(null);

    /**
     * Construit l'historique de conversation pour l'API
     */
    const buildConversationHistory = useCallback((additionalMessage = null) => {
        const history = [
            { role: 'system', content: getSystemPrompt() },
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
     * Nettoie le contenu du spec des blocs audio et autres artefacts
     */
    const cleanSpecContent = (content) => {
        let cleaned = content
            // Supprime les blocs [AUDIO]...[/AUDIO]
            .replace(/\[AUDIO\][\s\S]*?\[\/AUDIO\]/gi, '')
            .trim();

        // Cherche le début réel du document (premier titre markdown # ou "Cahier des charges")
        // L'IA peut ajouter du texte de conversation avant le document
        const titleMatch = cleaned.match(/^(#\s|Cahier des charges)/m);
        if (titleMatch && titleMatch.index > 0) {
            // Garde seulement à partir du titre
            cleaned = cleaned.substring(titleMatch.index);
        }

        // Supprime les lignes vides multiples résultantes
        return cleaned
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };

    /**
     * Gère la complétion du spec
     */
    const handleSpecComplete = useCallback((response) => {
        const rawSpec = response.replace(MARKERS.SPEC_COMPLETE, '').trim();
        const specContent = cleanSpecContent(rawSpec);

        // Ajouter un message à l'historique pour que l'IA sache que les specs ont été générées
        // (important si l'utilisateur revient sur l'interview pour faire des modifications)
        updateMessages(prev => {
            const newMessages = [...prev, {
                role: 'assistant',
                content: '[AUDIO]Voilà, j\'ai généré le document de spécifications ![/AUDIO]\n\n✅ **Les spécifications ont été générées et sont maintenant affichées.**\n\nSi tu veux apporter des modifications, tu pourras revenir me voir.'
            }];
            // Mémoriser le nombre de messages au moment de la génération
            updateMessageCountAtLastSpec(newMessages.length);
            return newMessages;
        });

        updateFinalSpec(specContent);
        updatePhase('complete');
        exitModificationMode();
    }, [updateMessages, updateFinalSpec, updatePhase, exitModificationMode, updateMessageCountAtLastSpec]);

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

            // Generate summary for the attached file (limited to 1 file)
            let fileSummary = null;
            if (processedFiles.length > 0) {
                const file = processedFiles[0];
                if (file.type === 'image') {
                    fileSummary = 'Image';
                } else {
                    try {
                        fileSummary = await generateFileSummary(file.content, file.name);
                    } catch (error) {
                        console.warn('Failed to generate file summary:', error);
                        fileSummary = file.name; // Fallback to filename
                    }
                }
            }

            const displayContent = messageText + (fileSummary ? `\n\n[${fileSummary}]` : '');

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

            // Si l'IA génère [SPEC_COMPLETE] mais qu'on est en mode modification,
            // ignorer le marker et continuer la conversation
            const hasSpecMarker = response.includes(MARKERS.SPEC_COMPLETE);

            if (hasSpecMarker && !isModificationMode) {
                // Première génération de specs
                handleSpecComplete(response);
            } else {
                // Conversation normale OU mode modification (ignorer [SPEC_COMPLETE])
                let cleanResponse = response;
                if (hasSpecMarker && isModificationMode) {
                    // Extraire le texte avant [SPEC_COMPLETE] s'il y en a
                    const beforeMarker = response.split(MARKERS.SPEC_COMPLETE)[0].trim();
                    cleanResponse = beforeMarker || 'C\'est noté ! Dis-moi si tu veux modifier autre chose, ou clique sur "Régénérer les specs" pour mettre à jour le document.';
                }
                updateMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }]);
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
    }, [isLoading, isModificationMode, buildConversationHistory, callAPI, updateMessages, handleSpecComplete, updateQuestionCount]);

    /**
     * Demande la génération du spec final
     */
    const requestFinalSpec = useCallback(async () => {
        setIsRegenerating(true);

        const conversationHistory = buildConversationHistory({
            role: 'user',
            content: `GÉNÉRATION DU DOCUMENT DE SPÉCIFICATIONS

RÈGLES OBLIGATOIRES:
1. Réponds avec [SPEC_COMPLETE] suivi IMMÉDIATEMENT du document markdown
2. Le document DOIT commencer par: # Cahier des Charges
3. Commence par 2 phrases résumant l'objectif du projet et le problème résolu
4. NE POSE AUCUNE QUESTION dans le document - utilise [À DÉFINIR] pour les infos manquantes
5. PAS de bloc [AUDIO] - c'est un document écrit
6. Structure recommandée: Résumé > Contexte > Utilisateurs > Fonctionnalités > Contraintes techniques > Livrables`
        });

        try {
            const { response, isValid } = await callAPI(conversationHistory);

            if (!isValid) {
                alert('La génération des spécifications a échoué (réponse incohérente). Veuillez réessayer.');
                setIsRegenerating(false);
                return false;
            }

            handleSpecComplete(response);
            setIsRegenerating(false);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                return false;
            }
            alert(`Erreur: ${error.message}`);
            setIsRegenerating(false);
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
        setIsRegenerating(false);
    }, []);

    return {
        isLoading,
        isRegenerating,
        sendMessage,
        requestFinalSpec,
        abortRequest
    };
}
