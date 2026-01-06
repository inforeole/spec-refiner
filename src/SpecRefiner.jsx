import React, { useState, useRef, useEffect } from 'react';
import { FileText, Send, Loader2, Download, RotateCcw, Sparkles, CheckCircle2, Upload, X, File as FileIcon, Image as ImageIcon } from 'lucide-react';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

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

// Simple Markdown renderer component
function MarkdownRenderer({ content }) {
    const renderMarkdown = (text) => {
        const lines = text.split('\n');
        const elements = [];
        let inList = false;
        let listItems = [];
        let listType = 'ul';

        const processInlineStyles = (line) => {
            // Bold
            line = line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
            // Italic
            line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
            // Code
            line = line.replace(/`(.+?)`/g, '<code class="bg-slate-700 px-1.5 py-0.5 rounded text-violet-300 text-sm">$1</code>');
            return line;
        };

        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={elements.length} className="space-y-2 my-4 ml-4">
                        {listItems.map((item, i) => (
                            <li key={i} className="flex gap-2 text-slate-300">
                                <span className="text-violet-400 mt-1">•</span>
                                <span dangerouslySetInnerHTML={{ __html: processInlineStyles(item) }} />
                            </li>
                        ))}
                    </ul>
                );
                listItems = [];
                inList = false;
            }
        };

        lines.forEach((line, index) => {
            // Headers
            if (line.startsWith('### ')) {
                flushList();
                elements.push(
                    <h3 key={index} className="text-lg font-semibold text-violet-300 mt-6 mb-3">
                        {line.slice(4)}
                    </h3>
                );
            } else if (line.startsWith('## ')) {
                flushList();
                elements.push(
                    <h2 key={index} className="text-xl font-bold text-white mt-8 mb-4 pb-2 border-b border-slate-700">
                        {line.slice(3)}
                    </h2>
                );
            } else if (line.startsWith('# ')) {
                flushList();
                elements.push(
                    <h1 key={index} className="text-2xl font-bold text-white mb-6">
                        {line.slice(2)}
                    </h1>
                );
            }
            // Bullet list
            else if (line.match(/^[-*] /)) {
                if (!inList) {
                    inList = true;
                }
                listItems.push(line.slice(2));
            }
            // Numbered list
            else if (line.match(/^\d+\. /)) {
                if (!inList) {
                    inList = true;
                }
                listItems.push(line.replace(/^\d+\. /, ''));
            }
            // Horizontal rule
            else if (line.match(/^---+$/)) {
                flushList();
                elements.push(<hr key={index} className="border-slate-700 my-6" />);
            }
            // Empty line
            else if (line.trim() === '') {
                flushList();
            }
            // Regular paragraph
            else {
                flushList();
                elements.push(
                    <p
                        key={index}
                        className="text-slate-300 my-3 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: processInlineStyles(line) }}
                    />
                );
            }
        });

        flushList();
        return elements;
    };

    return <div>{renderMarkdown(content)}</div>;
}

export default function SpecRefiner() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [authError, setAuthError] = useState(false);

    // Authentication check logic
    useEffect(() => {
        const sessionAuth = sessionStorage.getItem('spec-refiner-auth');
        if (sessionAuth === 'true') {
            setIsAuthenticated(true);
        }
    }, []);

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

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-md text-center">
                    <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Vous avez dis spécifications !?, en avant !</h1>
                    <p className="text-slate-400 mb-6">Accès sécurisé</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="Mot de passe"
                                className={`w-full bg-slate-900/50 border ${authError ? 'border-red-500' : 'border-slate-600'} rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500`}
                            />
                            {authError && <p className="text-red-400 text-sm mt-2">Mot de passe incorrect</p>}
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 px-6 rounded-xl transition-colors"
                        >
                            Entrer
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const [phase, setPhase] = useState('input');
    const [initialSpecs, setInitialSpecs] = useState('');
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [finalSpec, setFinalSpec] = useState('');
    const [questionCount, setQuestionCount] = useState(0);
    const [files, setFiles] = useState([]);
    const [chatFiles, setChatFiles] = useState([]); // Files for the current chat message
    const [isProcessingFiles, setIsProcessingFiles] = useState(false);
    const messagesEndRef = useRef(null);
    const [hasRestored, setHasRestored] = useState(false);

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
                    // Default to text for other types
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const callAPI = async (conversationHistory) => {
        try {
            const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
            if (!apiKey) {
                throw new Error('Clé API manquante. Ajoutez VITE_OPENROUTER_API_KEY dans le fichier .env');
            }

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.origin, // Optional, for including your app on openrouter.ai rankings.
                    'X-Title': 'Spec Refiner', // Optional. Shows in rankings on openrouter.ai.
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
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    };

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

            // Add text from documents
            const textFiles = processedFiles.filter(f => f.type === 'text');
            if (textFiles.length > 0) {
                textContent += '\n\nDocuments attachés :';
                textFiles.forEach(f => {
                    textContent += `\n\n--- ${f.name} ---\n${f.content}`;
                });
            }

            textContent += '\n\nPose-moi des questions pour bien comprendre mon besoin. Commence par te présenter (IA de Philippe), donne une estimation de temps (environ 10-15 min) et précise que je peux arrêter et reprendre quand je veux car c\'est sauvegardé localement.';

            messageContent.push({ type: 'text', text: textContent });

            // Add images
            const imageFiles = processedFiles.filter(f => f.type === 'image');
            imageFiles.forEach(f => {
                messageContent.push({
                    type: 'image_url',
                    image_url: {
                        url: f.content
                    }
                });
            });

            const firstMessage = {
                role: 'user',
                content: messageContent
            };

            // For local display, we simplify
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

        // Optimistic UI update
        const displayContent = userMessage + (currentChatFiles.length > 0 ? `\n\n[${currentChatFiles.length} fichier(s) joint(s)]` : '');
        setMessages(prev => [...prev, { role: 'user', content: displayContent }]);
        setIsLoading(true);

        try {
            // Process files if any
            let apiMessageContent = [];

            if (currentChatFiles.length > 0) {
                setIsProcessingFiles(true);
                const processedFiles = await processFiles(currentChatFiles);
                setIsProcessingFiles(false);

                let textContent = userMessage;

                // Add text from documents
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

                // Add images
                const imageFiles = processedFiles.filter(f => f.type === 'image');
                imageFiles.forEach(f => {
                    apiMessageContent.push({
                        type: 'image_url',
                        image_url: {
                            url: f.content
                        }
                    });
                });
            } else {
                apiMessageContent.push({ type: 'text', text: userMessage });
            }

            const conversationHistory = [
                // We recreate the initial message structure but careful not to send full file content again to save context/tokens if possible
                // For simplicity here, we assume previous messages were text-only or we rely on the server state which we don't have.
                // Actually, we must reconstruct history.
                // LIMITATION: 'messages' state stores simplified content string for UI.
                // OPTIMIZATION: In a real app we would store full structured messages in state.
                // For this refactor, let's keep it simple: we reconstruct previous messages as text.
                // Future improvement: Store structured messages in state.

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

    // Phase 1: Input initial specs
    if (phase === 'input') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="w-full max-w-3xl">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-600 rounded-2xl mb-4">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-2">Vous avez dis spécifications !?, en avant !</h1>
                        <p className="text-slate-400">Transformez vos idées en spécifications claires</p>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                        <label className="block text-sm font-medium text-slate-300 mb-3">
                            Étape 1 : Cadre Global
                        </label>
                        <textarea
                            value={initialSpecs}
                            onChange={(e) => setInitialSpecs(e.target.value)}
                            placeholder="Décrivez le cadre global de votre projet : contexte, objectifs, cible... C'est la base de travail pour l'IA."
                            className="w-full h-48 bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none mb-4"
                        />

                        {/* File Upload Area */}
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <label
                                    htmlFor="file-upload"
                                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    Ajouter des documents de référence globaux (Images, PDF, Docx)
                                </label>
                                <input
                                    id="file-upload"
                                    type="file"
                                    multiple
                                    accept=".png,.jpg,.jpeg,.pdf,.docx,.txt,.md"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <span className="text-slate-500 text-xs">Max 10MB par fichier</span>
                            </div>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="space-y-2">
                                    {files.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-slate-700/50 px-3 py-2 rounded-lg border border-slate-600/50">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {file.type.startsWith('image/') ? (
                                                    <ImageIcon className="w-4 h-4 text-violet-400 shrink-0" />
                                                ) : (
                                                    <FileIcon className="w-4 h-4 text-blue-400 shrink-0" />
                                                )}
                                                <span className="text-sm text-slate-300 truncate">{file.name}</span>
                                                <span className="text-xs text-slate-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                            </div>
                                            <button
                                                onClick={() => removeFile(idx)}
                                                className="text-slate-400 hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={startInterview}
                            disabled={(!initialSpecs.trim() && files.length === 0) || isProcessingFiles}
                            className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            {isProcessingFiles ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Analyse des fichiers...
                                </>
                            ) : (
                                <>
                                    <FileText className="w-5 h-5" />
                                    Commencer
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Phase 2: Interview
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

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="max-w-3xl mx-auto space-y-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                        ? msg.isInitial
                                            ? 'bg-slate-700 text-slate-300 text-sm'
                                            : 'bg-violet-600 text-white'
                                        : 'bg-slate-800 border border-slate-700 text-slate-100'
                                        }`}
                                >
                                    {msg.isInitial && (
                                        <div className="text-violet-400 text-xs font-medium mb-2">VOTRE IDÉE</div>
                                    )}
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3">
                                    <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input */}
                <div className="bg-slate-800/80 backdrop-blur border-t border-slate-700 p-4">
                    <div className="max-w-3xl mx-auto">
                        {/* Chat File Preview */}
                        {chatFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {chatFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600">
                                        {file.type.startsWith('image/') ? (
                                            <ImageIcon className="w-3 h-3 text-violet-400" />
                                        ) : (
                                            <FileIcon className="w-3 h-3 text-blue-400" />
                                        )}
                                        <span className="text-xs text-slate-300 max-w-[150px] truncate">{file.name}</span>
                                        <button
                                            onClick={() => removeChatFile(idx)}
                                            className="text-slate-400 hover:text-red-400 ml-1"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <label
                                htmlFor="chat-file-upload"
                                className={`p-3 rounded-xl transition-colors cursor-pointer ${isLoading ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'}`}
                            >
                                <Upload className="w-5 h-5" />
                                <input
                                    id="chat-file-upload"
                                    type="file"
                                    multiple
                                    accept=".png,.jpg,.jpeg,.pdf,.docx,.txt,.md"
                                    onChange={handleChatFileSelect}
                                    disabled={isLoading}
                                    className="hidden"
                                />
                            </label>

                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder={isProcessingFiles ? "Traitement des fichiers..." : "Votre réponse..."}
                                disabled={isLoading || isProcessingFiles}
                                className="flex-1 bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={isLoading || (inputMessage.trim() === '' && chatFiles.length === 0) || isProcessingFiles}
                                className="bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors"
                            >
                                {isProcessingFiles ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Phase 3: Complete - with proper markdown rendering
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

                {/* Spec content - with proper markdown rendering */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
                    <MarkdownRenderer content={finalSpec} />
                </div>
            </div>
        </div>
    );
}
