import { useState, useRef, useEffect } from 'react';
import { Download, RotateCcw, Sparkles, CheckCircle2, Upload } from 'lucide-react';

import {
    ChatInput,
    LoginForm,
    MarkdownRenderer,
    MessageList
} from './components';
import { processFiles } from './utils/fileProcessing';

// Welcome message shown on first load
const WELCOME_MESSAGE = `👋 Salut ! Je suis l'assistant IA de Philippe, spécialisé en conception de produits SaaS.

Je vais t'aider à transformer ton idée en spécifications claires et exploitables. Ça prend environ 10-15 minutes, et tu peux arrêter et reprendre quand tu veux (c'est sauvegardé).

**Tu peux :**
- Décrire ton projet dans la zone de texte
- Glisser-déposer des fichiers (PDF, images, documents) n'importe où
- Me poser des questions à tout moment

Alors, c'est quoi ton idée d'application ?`;

const SYSTEM_PROMPT = `Tu es l'IA de Philippe, un expert en conception de produits SaaS.
Ton ton est décontracté mais pro (tutoiement par défaut).
Tu fais des phrases courtes.
Tu sautes des lignes souvent pour aérer le texte.

Ton rôle est d'interviewer l'utilisateur pour comprendre son projet.

IMPORTANT :
- L'utilisateur n'est pas forcément technique.
- Pose des questions simples, orientées métier.
- UNE seule question par message.
- Demande si on peut se tutoyer au début si ce n'est pas clair, ou tutoie directement si l'utilisateur l'a fait.

THÈMES À EXPLORER (en langage simple) :
- Qui sont les utilisateurs ? Leurs profils, leurs habitudes
- Quels problèmes concrets cette application résout ?
- Comment ça se passe AUJOURD'HUI sans l'application ?
- Le parcours utilisateur idéal, étape par étape
- Ce qu'on voit sur chaque écran, les actions possibles
- Les cas particuliers ("et si l'utilisateur fait X ?")
- Ce qui est vraiment prioritaire vs secondaire
- Les connexions avec d'autres outils existants
- Le volume d'utilisateurs attendu
- Les contraintes métier (budget, délais, équipe)

DÉTECTION DE PROJETS IMPORTANTS :
Si tu détectes que le projet est ambitieux ou complexe (beaucoup de fonctionnalités, plusieurs profils utilisateurs, workflows élaborés...), tu DOIS :
1. Le signaler clairement à l'utilisateur
2. Proposer un découpage en lots (ou phases, ou versions)
3. Demander validation de ce découpage
4. Pour le LOT 1 : creuser les détails en profondeur (écrans, parcours, cas particuliers)
5. Pour les LOTS SUIVANTS : rester plus macro (grandes fonctionnalités, objectifs) sans entrer dans les détails

Exemple de formulation :
"Ton projet est assez costaud ! Je te propose de le découper en plusieurs lots pour y voir plus clair :
- Lot 1 : [fonctionnalités essentielles]
- Lot 2 : [fonctionnalités complémentaires]
- Lot 3 : [fonctionnalités avancées]

On détaille à fond le lot 1, et on reste plus général sur les autres. Ça te va ?"

RÈGLES DE LANGAGE :
- ÉVITE les anglicismes ! Utilise des termes français :
  - "retour d'information" plutôt que "feedback"
  - "tableau de bord" plutôt que "dashboard"
  - "fil d'actualité" plutôt que "feed"
  - "mise en page" plutôt que "layout"
  - "paramètres" plutôt que "settings"
  - "connexion" plutôt que "login"
  - "inscription" plutôt que "sign up"
  - "déconnexion" plutôt que "logout"
  - "utilisateur" plutôt que "user"
  - "clic" plutôt que "click"
  - "glisser-déposer" plutôt que "drag and drop"
  - "en temps réel" plutôt que "real-time"
  - "notification poussée" plutôt que "push notification"
  - "stockage" plutôt que "storage"
  - "téléverser" plutôt que "uploader"
  - "essentiels" ou "indispensables" plutôt que "must-have"
  - "secondaires" ou "souhaitables" plutôt que "nice to have"
- Langage simple et accessible, JAMAIS de jargon technique

RÈGLES GÉNÉRALES :
- UNE seule question par message
- Pose des questions concrètes avec des exemples
- N'hésite pas à demander des exemples visuels ou des documents existants si cela peut aider la compréhension (l'utilisateur peut téléverser des fichiers)
- Propose des options quand c'est utile
- Creuse les détails importants pour l'expérience utilisateur

Quand tu as assez d'informations, réponds avec exactement "[SPEC_COMPLETE]" suivi de la spécification finale complète en markdown bien structuré. Si le projet a été découpé en lots, structure la spec avec le lot 1 très détaillé et les lots suivants en vision macro.`;

export default function SpecRefiner() {
    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState(false);

    // App state
    const [phase, setPhase] = useState('interview');
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [finalSpec, setFinalSpec] = useState('');
    const [questionCount, setQuestionCount] = useState(0);
    const [chatFiles, setChatFiles] = useState([]);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);
    const [hasRestored, setHasRestored] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);

    // Check auth on mount
    useEffect(() => {
        const sessionAuth = sessionStorage.getItem('spec-refiner-auth');
        if (sessionAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    // Load from local storage on mount, or show welcome message
    useEffect(() => {
        const savedData = localStorage.getItem('spec-refiner-session');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.messages && parsed.messages.length > 0) {
                    setMessages(parsed.messages);
                    setPhase(parsed.phase || 'interview');
                    setQuestionCount(parsed.questionCount || 0);
                } else {
                    // No saved messages, show welcome
                    setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
                }
            } catch (e) {
                console.error('Failed to parse saved session', e);
                setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
            }
        } else {
            // First visit, show welcome message
            setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
        }
        setHasRestored(true);
    }, []);

    // Save to local storage on change (excluding large image data)
    useEffect(() => {
        if (!hasRestored) return;

        // Filter out base64 images from apiContent to avoid localStorage limits
        const messagesForStorage = messages.map(m => {
            if (!m.apiContent) return m;

            // If apiContent is an array (multimodal), filter out images
            if (Array.isArray(m.apiContent)) {
                const textOnly = m.apiContent.filter(c => c.type === 'text');
                // If only text remains, simplify to just the text string
                if (textOnly.length === 1) {
                    return { ...m, apiContent: textOnly[0].text };
                } else if (textOnly.length > 1) {
                    return { ...m, apiContent: textOnly };
                }
                // No text content, just use display content
                return { ...m, apiContent: undefined };
            }
            return m;
        });

        const dataToSave = {
            messages: messagesForStorage,
            phase,
            questionCount
        };
        localStorage.setItem('spec-refiner-session', JSON.stringify(dataToSave));
    }, [messages, phase, questionCount, hasRestored]);

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

    // Drag & drop handlers for the whole window
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isLoading) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if leaving the main container
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (isLoading) return;

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            setChatFiles(prev => [...prev, ...droppedFiles]);
        }
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
                model: 'anthropic/claude-3.5-sonnet',
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

                const imageFiles = processedFiles.filter(f => f.type === 'image');
                imageFiles.forEach(f => {
                    apiContent.push({
                        type: 'image_url',
                        image_url: { url: f.content }
                    });
                });
            } else {
                apiContent = userMessage; // Simple string for text-only messages
            }

            const displayContent = userMessage + (currentChatFiles.length > 0 ? `\n\n[${currentChatFiles.length} fichier(s) joint(s)]` : '');

            // Store both display content and API content
            setMessages(prev => [...prev, {
                role: 'user',
                content: displayContent,
                apiContent: apiContent
            }]);

            // Build conversation history using apiContent when available
            const conversationHistory = messages.map(m => ({
                role: m.role,
                content: m.apiContent || m.content
            }));
            conversationHistory.push({ role: 'user', content: apiContent });

            const response = await callAPI(conversationHistory);

            if (response.includes('[SPEC_COMPLETE]')) {
                const specContent = response.replace('[SPEC_COMPLETE]', '').trim();
                setFinalSpec(specContent);
                setPhase('complete');
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: response }]);
                setQuestionCount(prev => prev + 1);
            }
        } catch (error) {
            // Ignore abort errors (user reset)
            if (error.name === 'AbortError') {
                return;
            }
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Erreur: ${error.message}` }]);
        }

        setIsLoading(false);
        setIsProcessingFiles(false);
    };

    const requestFinalSpec = async () => {
        setIsLoading(true);

        // Build conversation history using apiContent when available
        const conversationHistory = messages.map(m => ({
            role: m.role,
            content: m.apiContent || m.content
        }));
        conversationHistory.push({
            role: 'user',
            content: 'Génère maintenant la spécification finale complète avec toutes les informations recueillies. Réponds avec [SPEC_COMPLETE] suivi du document.'
        });

        try {
            const response = await callAPI(conversationHistory);
            const specContent = response.replace('[SPEC_COMPLETE]', '').trim();
            setFinalSpec(specContent);
            setPhase('complete');
        } catch (error) {
            // Ignore abort errors (user reset)
            if (error.name === 'AbortError') {
                return;
            }
            alert(`Erreur: ${error.message}`);
        }

        setIsLoading(false);
    };

    const downloadSpec = () => {
        const blob = new Blob([finalSpec], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'specifications.md';
        a.click();
        URL.revokeObjectURL(url);
    };

    const reset = () => {
        if (confirm('Voulez-vous vraiment recommencer ? Tout l\'historique sera effacé.')) {
            // Abort any ongoing API request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

            // Clear storage
            localStorage.removeItem('spec-refiner-session');

            // Reset all state
            setPhase('interview');
            setChatFiles([]);
            setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }]);
            setInputMessage('');
            setFinalSpec('');
            setQuestionCount(0);
            setIsLoading(false);
            setIsProcessingFiles(false);
        }
    };

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

    if (phase === 'interview') {
        return (
            <div
                className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col relative"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
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
                            {questionCount >= 3 && (
                                <button
                                    onClick={requestFinalSpec}
                                    disabled={isLoading}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    Générer les specs
                                </button>
                            )}
                            <button
                                onClick={reset}
                                className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors"
                                title="Recommencer"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
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
                            onClick={downloadSpec}
                            className="bg-violet-600 hover:bg-violet-500 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Télécharger .md
                        </button>
                        <button
                            onClick={reset}
                            className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Spec content */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
                    <MarkdownRenderer content={finalSpec} />
                </div>
            </div>
        </div>
    );
}
