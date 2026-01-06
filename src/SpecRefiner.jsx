import { useState, useRef, useEffect } from 'react';
import { Download, RotateCcw, Sparkles, CheckCircle2 } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

import {
    ChatInput,
    LoginForm,
    MarkdownRenderer,
    MessageList,
    ProjectInput
} from './components';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const SYSTEM_PROMPT = `Tu es l'IA de Philippe, un expert en conception de produits SaaS.
Ton ton est décontracté mais pro (tutoiement par défaut).
Tu fais des phrases courtes.
Tu sautes des lignes souvent pour aérer le texte.

Ton rôle est d'interviewer l'utilisateur pour comprendre son projet.

IMPORTANT :
- L'utilisateur n'est pas forcément technique.
- Pose des questions simples, orientées business.
- UNE seule question par message.
- Demande si on peut se tutoyer au début si ce n'est pas clair, ou tutoie directement si l'utilisateur l'a fait.

THÈMES À EXPLORER (en langage simple) :
- Qui sont les utilisateurs ? Leurs profils, leurs habitudes
- Quels problèmes concrets cette app résout ?
- Comment ça se passe AUJOURD'HUI sans l'app ?
- Le parcours utilisateur idéal, étape par étape
- Ce qu'on voit sur chaque écran, les actions possibles
- Les cas particuliers ("et si l'utilisateur fait X ?")
- Ce qui est vraiment prioritaire vs "nice to have"
- Les intégrations avec d'autres outils existants
- Le volume d'utilisateurs attendu
- Les contraintes business (budget, délais, équipe)

RÈGLES :
- UNE seule question par message
- Langage simple et accessible, JAMAIS de jargon technique
- Pose des questions concrètes avec des exemples
- N'hésite pas à demander des exemples visuels ou des documents existants si cela peut aider la compréhension (l'utilisateur peut uploader des fichiers)
- Propose des options quand c'est utile
- Creuse les détails importants pour l'expérience utilisateur

Quand tu as assez d'informations, réponds avec exactement "[SPEC_COMPLETE]" suivi de la spécification finale complète en markdown bien structuré.`;

export default function SpecRefiner() {
    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState(false);

    // App state
    const [phase, setPhase] = useState('input');
    const [initialSpecs, setInitialSpecs] = useState('');
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [finalSpec, setFinalSpec] = useState('');
    const [questionCount, setQuestionCount] = useState(0);
    const [files, setFiles] = useState([]);
    const [chatFiles, setChatFiles] = useState([]);
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);
    const [hasRestored, setHasRestored] = useState(false);

    const messagesEndRef = useRef(null);

    // Authentication check on mount
    useEffect(() => {
        const sessionAuth = sessionStorage.getItem('spec-refiner-auth');
        if (sessionAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

    // Load from local storage on mount
    useEffect(() => {
        const savedData = localStorage.getItem('spec-refiner-session');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setInitialSpecs(parsed.initialSpecs || '');
                setMessages(parsed.messages || []);
                setPhase(parsed.phase || 'input');
                setQuestionCount(parsed.questionCount || 0);
            } catch (e) {
                console.error('Failed to parse saved session', e);
            }
        }
        setHasRestored(true);
    }, []);

    // Save to local storage on change
    useEffect(() => {
        if (!hasRestored) return;

        const dataToSave = {
            initialSpecs,
            messages,
            phase,
            questionCount
        };
        localStorage.setItem('spec-refiner-session', JSON.stringify(dataToSave));
    }, [initialSpecs, messages, phase, questionCount, hasRestored]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ==================== Handlers ====================

    const handleLogin = (e) => {
        e.preventDefault();
        const correctPassword = import.meta.env.VITE_APP_PASSWORD;
        if (passwordInput === correctPassword) {
            setIsAuthenticated(true);
            setAuthError(false);
            sessionStorage.setItem('spec-refiner-auth', 'true');
        } else {
            setAuthError(true);
        }
    };

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selectedFiles]);
    };

    const handleChatFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setChatFiles(prev => [...prev, ...selectedFiles]);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeChatFile = (index) => {
        setChatFiles(prev => prev.filter((_, i) => i !== index));
    };

    // ==================== File Processing ====================

    const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const readFileAsArrayBuffer = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const processFiles = async (filesToProcess) => {
        const fileData = [];

        for (const file of filesToProcess) {
            try {
                if (file.type.startsWith('image/')) {
                    const base64 = await readFileAsBase64(file);
                    fileData.push({
                        type: 'image',
                        name: file.name,
                        content: base64
                    });
                } else if (file.type === 'application/pdf') {
                    const arrayBuffer = await readFileAsArrayBuffer(file);
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += `\n--- Page ${i} ---\n${pageText}`;
                    }

                    fileData.push({
                        type: 'text',
                        name: file.name,
                        content: fullText
                    });
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    const arrayBuffer = await readFileAsArrayBuffer(file);
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    fileData.push({
                        type: 'text',
                        name: file.name,
                        content: result.value
                    });
                } else {
                    const text = await readFileAsText(file);
                    fileData.push({
                        type: 'text',
                        name: file.name,
                        content: text
                    });
                }
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                alert(`Erreur lors de la lecture du fichier ${file.name}`);
            }
        }
        return fileData;
    };

    // ==================== API ====================

    const callAPI = async (conversationHistory) => {
        const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('Clé API manquante. Ajoutez VITE_OPENROUTER_API_KEY dans le fichier .env');
        }

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
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    };

    // ==================== Interview Logic ====================

    const startInterview = async () => {
        if (!initialSpecs.trim() && files.length === 0) return;

        setPhase('interview');
        setIsLoading(true);
        setIsProcessingFiles(true);

        try {
            const processedFiles = await processFiles(files);
            setIsProcessingFiles(false);

            let messageContent = [];
            let textContent = `Voici mon idée d'application :\n\n${initialSpecs}`;

            const textFiles = processedFiles.filter(f => f.type === 'text');
            if (textFiles.length > 0) {
                textContent += '\n\nDocuments attachés :';
                textFiles.forEach(f => {
                    textContent += `\n\n--- ${f.name} ---\n${f.content}`;
                });
            }

            textContent += '\n\nPose-moi des questions pour bien comprendre mon besoin. Commence par te présenter (IA de Philippe), donne une estimation de temps (environ 10-15 min) et précise que je peux arrêter et reprendre quand je veux car c\'est sauvegardé localement.';

            messageContent.push({ type: 'text', text: textContent });

            const imageFiles = processedFiles.filter(f => f.type === 'image');
            imageFiles.forEach(f => {
                messageContent.push({
                    type: 'image_url',
                    image_url: { url: f.content }
                });
            });

            const firstMessage = { role: 'user', content: messageContent };
            const displayContent = initialSpecs + (files.length > 0 ? `\n\n[${files.length} fichier(s) joint(s)]` : '');
            setMessages([{ role: 'user', content: displayContent, isInitial: true }]);

            const response = await callAPI([firstMessage]);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
            setQuestionCount(1);
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Erreur: ${error.message}` }]);
        }

        setIsLoading(false);
        setIsProcessingFiles(false);
    };

    const sendMessage = async () => {
        if ((!inputMessage.trim() && chatFiles.length === 0) || isLoading) return;

        const userMessage = inputMessage;
        const currentChatFiles = [...chatFiles];

        setInputMessage('');
        setChatFiles([]);

        const displayContent = userMessage + (currentChatFiles.length > 0 ? `\n\n[${currentChatFiles.length} fichier(s) joint(s)]` : '');
        setMessages(prev => [...prev, { role: 'user', content: displayContent }]);
        setIsLoading(true);

        try {
            let apiMessageContent = [];

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
                    apiMessageContent.push({ type: 'text', text: textContent });
                }

                const imageFiles = processedFiles.filter(f => f.type === 'image');
                imageFiles.forEach(f => {
                    apiMessageContent.push({
                        type: 'image_url',
                        image_url: { url: f.content }
                    });
                });
            } else {
                apiMessageContent.push({ type: 'text', text: userMessage });
            }

            const conversationHistory = [
                { role: 'user', content: `Voici mon idée d'application :\n\n${initialSpecs}\n\n[Contexte global initial]${files.length > 0 ? ' (Fichiers globaux inclus lors du démarrage)' : ''}` },
                ...messages.filter(m => !m.isInitial).map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: apiMessageContent }
            ];

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
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Erreur: ${error.message}` }]);
        }

        setIsLoading(false);
        setIsProcessingFiles(false);
    };

    const requestFinalSpec = async () => {
        setIsLoading(true);

        const conversationHistory = [
            { role: 'user', content: `Voici mon idée d'application :\n\n${initialSpecs}\n\nPose-moi des questions pour bien comprendre mon besoin.` },
            ...messages.filter(m => !m.isInitial).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: 'Génère maintenant la spécification finale complète avec toutes les informations recueillies. Réponds avec [SPEC_COMPLETE] suivi du document.' }
        ];

        try {
            const response = await callAPI(conversationHistory);
            const specContent = response.replace('[SPEC_COMPLETE]', '').trim();
            setFinalSpec(specContent);
            setPhase('complete');
        } catch (error) {
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
            localStorage.removeItem('spec-refiner-session');
            setPhase('input');
            setInitialSpecs('');
            setFiles([]);
            setMessages([]);
            setInputMessage('');
            setFinalSpec('');
            setQuestionCount(0);
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

    if (phase === 'input') {
        return (
            <ProjectInput
                value={initialSpecs}
                onChange={setInitialSpecs}
                files={files}
                onFileSelect={handleFileSelect}
                onFileRemove={removeFile}
                onSubmit={startInterview}
                isLoading={isProcessingFiles}
            />
        );
    }

    if (phase === 'interview') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
                {/* Header */}
                <div className="bg-slate-800/80 backdrop-blur border-b border-slate-700 px-4 py-3">
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-white font-semibold">Interview en cours</h1>
                                <p className="text-slate-400 text-sm">{questionCount} question{questionCount > 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={requestFinalSpec}
                                disabled={isLoading || questionCount < 3}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Générer les specs
                            </button>
                            <button
                                onClick={reset}
                                className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors"
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
                    onFileSelect={handleChatFileSelect}
                    onFileRemove={removeChatFile}
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
