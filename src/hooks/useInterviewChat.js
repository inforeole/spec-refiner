import { useCallback, useRef, useState } from 'react';
import { applySpecUpdates } from '../domain/specModel';
import { evaluateSpecReadiness } from '../domain/specReadiness';
import { getSystemPrompt } from '../prompts/systemPrompt';
import { callAPIWithRetry } from '../services/apiService';
import { uploadImage } from '../services/imageService';
import { generateFileSummary } from '../services/summaryService';

function addSourceId(apiContent, sourceId) {
    const prefix = `[Source: ${sourceId}]\n`;
    if (typeof apiContent === 'string') {
        return `${prefix}${apiContent}`;
    }

    const content = [...apiContent];
    const textIndex = content.findIndex(item => item.type === 'text');
    if (textIndex === -1) {
        content.unshift({ type: 'text', text: prefix.trim() });
    } else {
        content[textIndex] = {
            ...content[textIndex],
            text: `${prefix}${content[textIndex].text}`
        };
    }
    return content;
}

function cleanSpecContent(content) {
    const cleaned = content
        .replace(/\[AUDIO\][\s\S]*?\[\/AUDIO\]/gi, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    const titleMatch = cleaned.match(/^#\s+\S.*$/m);
    return titleMatch ? cleaned.slice(titleMatch.index).trim() : cleaned;
}

function isContextLengthError(error) {
    return Boolean(error.message && (
        error.message.includes('maximum context length') ||
        error.message.includes('context_length_exceeded') ||
        error.message.includes('token')
    ));
}

export function useInterviewChat(sessionHook, versionStore = {}) {
    const {
        messages,
        specModel,
        updateMessages,
        updatePhase,
        updateQuestionCount,
        updateFinalSpec,
        updateSpecModel,
        exitModificationMode,
        updateMessageCountAtLastSpec
    } = sessionHook;
    const { createVersion } = versionStore;

    const [isLoading, setIsLoading] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const abortControllerRef = useRef(null);
    const isRegeneratingRef = useRef(false);

    const buildConversationHistory = useCallback((additionalMessage = null) => {
        const history = [
            { role: 'system', content: getSystemPrompt() },
            ...messages.map(message => ({
                role: message.role,
                content: message.apiContent || message.content
            }))
        ];
        if (additionalMessage) {
            history.push(additionalMessage);
        }
        return history;
    }, [messages]);

    const callAPI = useCallback(async (conversationHistory, task) => {
        abortControllerRef.current = new AbortController();
        return callAPIWithRetry({
            messages: conversationHistory,
            task,
            signal: abortControllerRef.current.signal
        });
    }, []);

    const finishStoredVersion = useCallback(markdown => {
        updateMessages(previous => {
            const next = [...previous, {
                role: 'assistant',
                content: '[AUDIO]Le document est prêt.[/AUDIO]\n\n✅ **Une nouvelle version horodatée des spécifications a été enregistrée.**'
            }];
            updateMessageCountAtLastSpec(next.length);
            return next;
        });
        updateFinalSpec(markdown);
        updatePhase('complete');
        exitModificationMode();
    }, [
        exitModificationMode,
        updateFinalSpec,
        updateMessageCountAtLastSpec,
        updateMessages,
        updatePhase
    ]);

    const sendMessage = useCallback(async (messageText, processedFiles = []) => {
        if ((!messageText.trim() && processedFiles.length === 0) || isLoading) {
            return false;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            let apiContent = [];
            if (processedFiles.length > 0) {
                let textContent = messageText;
                const textFiles = processedFiles.filter(file => file.type === 'text');
                if (textFiles.length > 0) {
                    textContent += '\n\nDocuments attachés :';
                    for (const file of textFiles) {
                        textContent += `\n\n--- ${file.name} ---\n${file.content}`;
                    }
                }
                if (textContent.trim()) {
                    apiContent.push({ type: 'text', text: textContent });
                }

                for (const file of processedFiles.filter(item => item.type === 'image')) {
                    const { url, error } = await uploadImage(file.content, file.name);
                    if (!url) {
                        console.warn('Image upload failed:', error);
                    }
                    apiContent.push({
                        type: 'image_url',
                        image_url: { url: url || file.content }
                    });
                }
            } else {
                apiContent = messageText;
            }

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
                        fileSummary = file.name;
                    }
                }
            }

            const displayContent = messageText + (
                fileSummary ? `\n\n[${fileSummary}]` : ''
            );
            const sourceId = `message-${messages.length + 1}`;
            const sourcedApiContent = addSourceId(apiContent, sourceId);

            updateMessages(previous => [...previous, {
                role: 'user',
                content: displayContent,
                apiContent: sourcedApiContent
            }]);

            const conversationHistory = buildConversationHistory({
                role: 'user',
                content: sourcedApiContent
            });
            const { response, isValid } = await callAPI(
                conversationHistory,
                'interview'
            );

            if (!isValid) {
                updateMessages(previous => [...previous, {
                    role: 'assistant',
                    content: '⚠️ Ma réponse était incohérente. Reformule ta dernière réponse pour continuer.'
                }]);
                return false;
            }

            updateSpecModel(previous => applySpecUpdates(previous, response.updates));
            updateMessages(previous => [...previous, {
                role: 'assistant',
                content: response.assistantMessage
            }]);
            updateQuestionCount(previous => previous + 1);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                return false;
            }
            console.error(error);
            if (isContextLengthError(error)) {
                updateMessages(previous => previous.slice(0, -1));
                setErrorMessage(
                    'Le fichier envoyé est trop volumineux. Essaie avec un fichier plus petit ou continue sans fichier.'
                );
            } else {
                setErrorMessage(error.message);
            }
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [
        buildConversationHistory,
        callAPI,
        isLoading,
        messages.length,
        updateMessages,
        updateQuestionCount,
        updateSpecModel
    ]);

    const requestFinalSpec = useCallback(async () => {
        if (isRegeneratingRef.current) {
            return false;
        }
        isRegeneratingRef.current = true;
        setIsRegenerating(true);
        setErrorMessage(null);

        const readiness = evaluateSpecReadiness(specModel);
        const conversationHistory = buildConversationHistory({
            role: 'user',
            content: `Rédige la spécification du lot unique en markdown.
Le modèle fonctionnel ci-dessous est la source de vérité.
Les informations manquantes restent marquées [À DÉFINIR].
État de préparation: ${readiness.generationKind}.
Modèle:
${JSON.stringify(specModel)}`
        });

        try {
            const { response, isValid } = await callAPI(conversationHistory, 'spec');
            if (!isValid) {
                setErrorMessage('La réponse de génération est incohérente.');
                return false;
            }

            const markdown = cleanSpecContent(response?.markdown || '');
            if (!markdown) {
                setErrorMessage('Le document généré est vide.');
                return false;
            }
            if (typeof createVersion !== 'function') {
                setErrorMessage('Le stockage des versions est indisponible.');
                return false;
            }

            const stored = await createVersion({
                content: markdown,
                sourceMessageCount: messages.length
            });
            if (!stored.version) {
                setErrorMessage(stored.error || 'Erreur de sauvegarde de la version');
                return false;
            }

            finishStoredVersion(markdown);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                return false;
            }
            setErrorMessage(
                isContextLengthError(error)
                    ? 'La conversation est trop longue pour générer les spécifications.'
                    : error.message
            );
            return false;
        } finally {
            isRegeneratingRef.current = false;
            setIsRegenerating(false);
        }
    }, [
        buildConversationHistory,
        callAPI,
        createVersion,
        finishStoredVersion,
        messages.length,
        specModel
    ]);

    const abortRequest = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsLoading(false);
        isRegeneratingRef.current = false;
        setIsRegenerating(false);
    }, []);

    const clearError = useCallback(() => setErrorMessage(null), []);

    return {
        isLoading,
        isRegenerating,
        errorMessage,
        clearError,
        sendMessage,
        requestFinalSpec,
        abortRequest
    };
}
