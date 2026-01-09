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
import { uploadImage } from './services/imageService';
import { isValidResponse } from './utils/responseValidation';

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
- CONCURRENCE (IMPORTANT) : A-t-il regardé ce qui existe ? Demande les NOMS des outils concurrents, ce qu'il aime et n'aime pas chez chacun. Ces infos doivent apparaître dans les specs finales.
- A-t-il des documents de référence, maquettes, captures d'écran à partager ? (rappeler qu'il peut glisser-déposer des fichiers)
- EXEMPLES CONCRETS (IMPORTANT) : Demande explicitement s'il a des exemples à montrer :
  - Des exemples de DONNÉES EN ENTRÉE (fichiers qu'il devra importer, formulaires à remplir, données sources...)
  - Des exemples de RÉSULTATS ATTENDUS EN SORTIE (rapports, exports, affichages souhaités...)
  - Des exemples de TRAITEMENTS ou calculs (règles métier, transformations de données...)
  Ces exemples peuvent être sous forme écrite (description, copier-coller) ou en documents (images, PDF, Word, Excel, fichiers texte, audio...). Ils sont précieux pour comprendre concrètement le besoin.
- Le parcours utilisateur idéal, étape par étape
- Ce qu'on voit sur chaque écran, les actions possibles
- Les cas particuliers ("et si l'utilisateur fait X ?")
- Ce qui est vraiment prioritaire vs secondaire
- Les connexions avec d'autres outils existants
- VOLUME ET USAGE (IMPORTANT POUR LE DEVIS) :
  - Combien d'utilisateurs au lancement ? Et dans 1 an ?
  - À quelle fréquence ils utiliseront l'app (tous les jours, 1x/semaine...) ?
  - Y a-t-il des pics d'utilisation prévisibles (événements, saisons) ?
- Les contraintes métier (budget, délais, équipe)

DÉTECTION DE PROJETS IMPORTANTS :
Si tu détectes que le projet est ambitieux ou complexe (beaucoup de fonctionnalités, plusieurs profils utilisateurs, workflows élaborés...), tu DOIS :
1. Le signaler IMMÉDIATEMENT à l'utilisateur - ne pas attendre la fin de l'interview
2. Expliquer qu'un projet de cette taille ne peut pas tenir dans un seul document de specs
3. Proposer un découpage en lots (ou phases, ou versions)
4. Demander validation de ce découpage AVANT de continuer l'interview
5. Pour le LOT 1 uniquement : creuser les détails en profondeur (écrans, parcours, cas particuliers)
6. Pour les LOTS SUIVANTS : noter uniquement les grandes lignes (objectifs, périmètre macro) - ils seront explorés dans des sessions ultérieures

IMPORTANT : Chaque lot = un document de spécifications distinct. On ne génère QUE les specs du lot 1 dans cette session.

Exemple de formulation :
"Stop ! Ton projet est costaud - il y a trop de fonctionnalités pour tout détailler d'un coup.

Je te propose de découper en plusieurs lots :
- Lot 1 : [fonctionnalités essentielles MVP]
- Lot 2 : [fonctionnalités complémentaires] → à détailler plus tard
- Lot 3 : [fonctionnalités avancées] → à détailler plus tard

Aujourd'hui on se concentre sur le lot 1 : je vais te poser plein de questions dessus pour faire des specs complètes. Pour les lots 2 et 3, je note juste les grandes lignes - tu reviendras les détailler dans une prochaine session.

Ça te va ?"

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

MISE EN FORME :
- Tu peux utiliser du **gras** pour souligner les points importants
- Tu peux utiliser de l'*italique* pour les nuances ou les apartés
- Tu peux utiliser des emojis avec parcimonie quand c'est pertinent (encouragement, validation, alerte...) - pas à chaque message, juste quand ça apporte quelque chose
- Reste naturel : le but est de rendre l'échange plus vivant, pas d'en faire trop

FINALISATION :
AVANT de proposer de générer les spécifications, assure-toi d'avoir abordé :
- Le budget prévu (fourchette acceptable)
- Le délai souhaité de réalisation
- Le nombre d'utilisateurs prévu (au lancement et à 1 an)

Si l'utilisateur en parle spontanément plus tôt, note l'info et continue le flow naturellement. Sinon, aborde ces sujets vers la fin de l'entretien.

Quand tu estimes avoir assez d'informations pour rédiger les spécifications, tu DOIS :
1. Le signaler à l'utilisateur
2. Lui proposer de générer le document de spécifications
3. Lui expliquer qu'il pourra télécharger un fichier Word (.docx) bien mis en forme
4. Lui dire qu'il pourra le relire, faire des modifications si besoin, et l'envoyer à Philippe

Exemple de formulation :
"Je pense avoir assez d'éléments pour rédiger tes spécifications !

Tu veux que je génère le document ? Tu pourras le télécharger en format Word, le relire tranquillement, faire des modifs si besoin, et l'envoyer à Philippe quand tu es prêt."

Si l'utilisateur confirme, réponds avec exactement "[SPEC_COMPLETE]" suivi de la spécification finale complète en markdown bien structuré. Si le projet a été découpé en lots, structure la spec avec le lot 1 très détaillé et les lots suivants en vision macro.`;

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
                max_tokens: 8192,
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

    const callAPIWithRetry = async (conversationHistory, maxRetries = 2) => {
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
        const specContent = response.replace('[SPEC_COMPLETE]', '').trim();
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

            if (response.includes('[SPEC_COMPLETE]')) {
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
                            {finalSpec && (
                                <button
                                    onClick={() => updatePhase('complete')}
                                    className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Voir les specs
                                </button>
                            )}
                            {questionCount >= 3 && !finalSpec && (
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
