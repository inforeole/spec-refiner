import { useState, useRef, useEffect } from 'react';
import { Download, RotateCcw, RefreshCw, Sparkles, CheckCircle2, Upload, AlertCircle, MessageCircle } from 'lucide-react';

import {
    ChatInput,
    LoginForm,
    MarkdownRenderer,
    MessageList
} from './components';
import { processFiles } from './utils/fileProcessing';
import { downloadAsWord } from './utils/wordExport';
import { useSession } from './hooks/useSession';
import { useDragDrop } from './hooks/useDragDrop';
import { uploadImage } from './services/imageService';
import { isValidResponse } from './utils/responseValidation';
import { API_CONFIG, INTERVIEW_CONFIG, MARKERS } from './config/constants';
import { SYSTEM_PROMPT } from './prompts/systemPrompt';

export default function SpecRefiner() {
    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState(false);

    // Session state from Supabase
    const {
        messages,
        phase,
        questionCount,
        finalSpec,
        isLoading: isSessionLoading,
        connectionError,
        updateMessages,
        updatePhase,
        updateQuestionCount,
        updateFinalSpec,
        resetSession
    } = useSession();

    // Local UI state
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatFiles, setChatFiles] = useState([]);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);

    // Drag & drop
    const { isDragging, dragHandlers } = useDragDrop({
        onDrop: (files) => setChatFiles(prev => [...prev, ...files]),
        disabled: isLoading
    });

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Check auth on mount
    useEffect(() => {
        const sessionAuth = sessionStorage.getItem('spec-refiner-auth');
        if (sessionAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ==================== Handlers ====================

    const handleLogin = (e) => {
        e.preventDefault();
        // Strip quotes and trim in case .env has quoted value
        const correctPassword = (import.meta.env.VITE_APP_PASSWORD || '')
            .replace(/^["']|["']$/g, '')
            .trim();
        if (passwordInput === correctPassword) {
            setIsAuthenticated(true);
            setAuthError(false);
            sessionStorage.setItem('spec-refiner-auth', 'true');
        } else {
            setAuthError(true);
        }
    };

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files || e.dataTransfer?.files || []);
        setChatFiles(prev => [...prev, ...selectedFiles]);
    };

    const removeFile = (index) => {
        setChatFiles(prev => prev.filter((_, i) => i !== index));
    };

    // ==================== API ====================

    const callAPI = async (conversationHistory) => {
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('Clé API manquante. Ajoutez VITE_OPENROUTER_API_KEY dans le fichier .env');
        }

        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Spec Refiner',
            },
            body: JSON.stringify({
                model: API_CONFIG.MODEL,
                max_tokens: API_CONFIG.MAX_TOKENS,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...conversationHistory
                ]
            }),
            signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    };

    const callAPIWithRetry = async (conversationHistory, maxRetries = API_CONFIG.MAX_RETRIES) => {
        let response = await callAPI(conversationHistory);
        let retryCount = 0;

        while (!isValidResponse(response) && retryCount < maxRetries) {
            console.warn(`Réponse incohérente détectée (tentative ${retryCount + 1}/${maxRetries}), nouvelle tentative...`);
            retryCount++;
            response = await callAPI(conversationHistory);
        }

        return { response, isValid: isValidResponse(response) };
    };

    const buildConversationHistory = (additionalMessage = null) => {
        const history = messages.map(m => ({
            role: m.role,
            content: m.apiContent || m.content
        }));
        if (additionalMessage) {
            history.push(additionalMessage);
        }
        return history;
    };

    const handleSpecComplete = (response) => {
        const specContent = response.replace(MARKERS.SPEC_COMPLETE, '').trim();
        updateFinalSpec(specContent);
        updatePhase('complete');
    };

    // ==================== Chat Logic ====================

    const sendMessage = async () => {
        if ((!inputMessage.trim() && chatFiles.length === 0) || isLoading) return;

        const userMessage = inputMessage;
        const currentChatFiles = [...chatFiles];

        setInputMessage('');
        setChatFiles([]);
        setIsLoading(true);

        try {
            let apiContent = [];

            if (currentChatFiles.length > 0) {
                setIsProcessingFiles(true);
                const processedFiles = await processFiles(currentChatFiles);
                setIsProcessingFiles(false);

                let textContent = userMessage;

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
                        // Use Storage URL (persisted)
                        apiContent.push({
                            type: 'image_url',
                            image_url: { url }
                        });
                    } else {
                        // Fallback to base64 if upload fails (not persisted)
                        console.warn('Image upload failed:', error);
                        apiContent.push({
                            type: 'image_url',
                            image_url: { url: f.content }
                        });
                    }
                }
            } else {
                apiContent = userMessage; // Simple string for text-only messages
            }

            const displayContent = userMessage + (currentChatFiles.length > 0 ? `\n\n[${currentChatFiles.length} fichier(s) joint(s)]` : '');

            // Store both display content and API content
            updateMessages(prev => [...prev, {
                role: 'user',
                content: displayContent,
                apiContent: apiContent
            }]);

            const conversationHistory = buildConversationHistory({ role: 'user', content: apiContent });
            const { response, isValid } = await callAPIWithRetry(conversationHistory);

            if (!isValid) {
                console.error('Réponse API invalide après retries:', response);
                updateMessages(prev => [...prev, {
                    role: 'assistant',
                    content: '⚠️ Oups ! J\'ai eu un problème technique et ma réponse était incohérente. Peux-tu reformuler ta dernière réponse ou cliquer sur le bouton "Générer les specs" si tu penses qu\'on a assez d\'informations ?'
                }]);
                setIsLoading(false);
                setIsProcessingFiles(false);
                return;
            }

            if (response.includes(MARKERS.SPEC_COMPLETE)) {
                handleSpecComplete(response);
            } else {
                updateMessages(prev => [...prev, { role: 'assistant', content: response }]);
                updateQuestionCount(prev => prev + 1);
            }
        } catch (error) {
            // Ignore abort errors (user reset)
            if (error.name === 'AbortError') {
                return;
            }
            console.error(error);
            updateMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur: ${error.message}` }]);
        }

        setIsLoading(false);
        setIsProcessingFiles(false);
    };

    const requestFinalSpec = async () => {
        setIsLoading(true);

        const conversationHistory = buildConversationHistory({
            role: 'user',
            content: 'Génère maintenant la spécification finale complète avec toutes les informations recueillies. IMPORTANT: Commence le document par 2 phrases qui résument clairement l\'objectif du projet et le problème qu\'il résout. Réponds avec [SPEC_COMPLETE] suivi du document.'
        });

        try {
            const { response, isValid } = await callAPIWithRetry(conversationHistory);

            if (!isValid) {
                alert('La génération des spécifications a échoué (réponse incohérente). Veuillez réessayer.');
                setIsLoading(false);
                return;
            }

            handleSpecComplete(response);
        } catch (error) {
            if (error.name === 'AbortError') return;
            alert(`Erreur: ${error.message}`);
        }

        setIsLoading(false);
    };

    const downloadSpec = () => {
        downloadAsWord(finalSpec, 'specifications.docx');
    };

    const resetWithConfirmation = async (confirmMessage) => {
        if (!confirm(confirmMessage)) return;

        // Abort any ongoing API request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        // Reset session in Supabase
        await resetSession();

        // Reset local UI state
        setChatFiles([]);
        setInputMessage('');
        setIsLoading(false);
        setIsProcessingFiles(false);
    };

    const reset = () => resetWithConfirmation('Voulez-vous vraiment recommencer ? Tout l\'historique sera effacé.');
    const regenerate = () => resetWithConfirmation('Voulez-vous vraiment régénérer ? La spécification actuelle, les documents et l\'historique seront supprimés.');

    // ==================== Render ====================

    if (!isAuthenticated) {
        return (
            <LoginForm
                onSubmit={handleLogin}
                error={authError}
                value={passwordInput}
                onChange={setPasswordInput}
            />
        );
    }

    // Show loading while session is being restored from Supabase
    if (isSessionLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-lg">Chargement de la session...</p>
                </div>
            </div>
        );
    }

    // Show error if Supabase connection failed
    if (connectionError) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-slate-800/50 backdrop-blur border border-red-500/50 rounded-2xl p-8 max-w-md text-center">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-white mb-2">Erreur de connexion</h1>
                    <p className="text-slate-400 mb-4">{connectionError}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-violet-600 hover:bg-violet-500 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                        Réessayer
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'interview') {
        return (
            <div
                className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col relative"
                {...dragHandlers}
            >
                {/* Drag overlay */}
                {isDragging && (
                    <div className="absolute inset-0 bg-violet-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-slate-800 border-2 border-dashed border-violet-500 rounded-2xl p-12 text-center">
                            <Upload className="w-16 h-16 text-violet-400 mx-auto mb-4" />
                            <p className="text-white text-xl font-medium">Dépose tes fichiers ici</p>
                            <p className="text-slate-400 text-sm mt-2">Images, PDF, Word, texte...</p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700 px-4 py-3">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-white font-semibold">Spec Refiner</h1>
                                <p className="text-slate-400 text-sm">
                                    {questionCount === 0 ? 'Prêt à démarrer' : `${questionCount} échange${questionCount > 1 ? 's' : ''}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {finalSpec && (
                                <button
                                    onClick={() => updatePhase('complete')}
                                    className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Voir les specs
                                </button>
                            )}
                            {questionCount >= INTERVIEW_CONFIG.MIN_QUESTIONS_BEFORE_SPEC && !finalSpec && (
                                <button
                                    onClick={requestFinalSpec}
                                    disabled={isLoading}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Générer les specs
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <MessageList
                    messages={messages}
                    isLoading={isLoading}
                    ref={messagesEndRef}
                />

                <ChatInput
                    value={inputMessage}
                    onChange={setInputMessage}
                    onSubmit={sendMessage}
                    files={chatFiles}
                    onFileSelect={handleFileSelect}
                    onFileRemove={removeFile}
                    disabled={isLoading || isProcessingFiles}
                    isProcessingFiles={isProcessingFiles}
                />

                {/* Footer */}
                <div className="py-3 flex justify-center border-t border-slate-800">
                    <button
                        onClick={reset}
                        className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Recommencer un nouveau projet
                    </button>
                </div>
            </div>
        );
    }

    // Phase: complete
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Spécifications finales</h1>
                            <p className="text-slate-400">Prêtes pour le développement</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => updatePhase('interview')}
                            className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                            title="Voir l'historique de la conversation"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Historique
                        </button>
                        <button
                            onClick={downloadSpec}
                            className="bg-violet-600 hover:bg-violet-500 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Spécifications
                        </button>
                    </div>
                </div>

                {/* Spec content */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
                    {/* Date and regenerate button */}
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
                        <p className="text-slate-400 text-sm">
                            Généré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <button
                            onClick={regenerate}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                            title="Régénérer les spécifications"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Régénérer
                        </button>
                    </div>
                    <MarkdownRenderer content={finalSpec} />
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-center">
                    <button
                        onClick={reset}
                        className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Recommencer un nouveau projet
                    </button>
                </div>
            </div>
        </div>
    );
}
