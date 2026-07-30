import { AlertCircle, LogOut } from 'lucide-react';

import { LoginForm, InterviewPhase, CompletePhase } from './components';
import { downloadAsWord } from './utils/wordExport';
import { useSession } from './hooks/useSession';
import { useDragDrop } from './hooks/useDragDrop';
import { useAuth } from './hooks/useAuth';
import { useChatInput } from './hooks/useChatInput';
import { useInterviewChat } from './hooks/useInterviewChat';
import { useTTSMessage } from './hooks/useTTSMessage';
import { useMessageFlow } from './hooks/useMessageFlow';
import { useSpecVersions } from './hooks/useSpecVersions';
import { buildSpecFilename } from './utils/specVersionFormat';

export default function SpecRefiner() {
    // ==================== Hooks ====================

    const {
        user,
        isAuthenticated,
        emailInput,
        setEmailInput,
        passwordInput,
        setPasswordInput,
        authError,
        isLoading: isAuthLoading,
        handleLogin,
        logout
    } = useAuth();

    const sessionHook = useSession(user?.id, user?.sessionToken);
    const {
        messages,
        phase,
        questionCount,
        finalSpec,
        messageCountAtLastSpec,
        isLoading: isSessionLoading,
        connectionError,
        saveError,
        updatePhase
    } = sessionHook;
    const {
        versions,
        selectedVersion,
        selectVersion,
        error: versionError
    } = useSpecVersions(user?.sessionToken);

    const {
        inputMessage,
        setInputMessage,
        chatFiles,
        isProcessingFiles,
        handleFileSelect,
        removeFile,
        clearInput,
        addFiles,
        processCurrentFiles,
        validationDialog,
        handleValidationAction,
        handleValidationCancel
    } = useChatInput(user?.id);

    const { isLoading, isRegenerating, errorMessage, clearError, sendMessage, requestFinalSpec, abortRequest } = useInterviewChat(sessionHook);

    // Calculer si nouvelles modifications depuis la dernière génération
    const hasNewMessagesSinceSpec = messages.length > messageCountAtLastSpec;

    const { isDragging, dragHandlers } = useDragDrop({
        onDrop: addFiles,
        disabled: isLoading
    });

    const {
        messagesEndRef,
        playingMessageId,
        isPlayingAudio,
        isLoadingAudio,
        autoPlayEnabled,
        playAudio,
        toggleAutoPlay
    } = useTTSMessage(messages, user?.id, isSessionLoading);

    const { handleSendMessage } = useMessageFlow({
        chatInput: { inputMessage, chatFiles, clearInput, processCurrentFiles },
        interviewChat: { isLoading, sendMessage }
    });

    // ==================== Handlers ====================

    const downloadSpec = () => {
        const content = selectedVersion?.content || finalSpec;
        const generatedAt = selectedVersion?.generated_at || null;
        const filename = generatedAt
            ? buildSpecFilename(generatedAt)
            : 'specifications.docx';
        downloadAsWord(content, filename, generatedAt);
    };

    const regenerate = async () => {
        // Régénérer = refaire le document de specs à partir de la conversation existante
        // PAS un reset ! On garde tout l'historique.
        await requestFinalSpec();
    };

    const requestModifications = () => {
        // Activer explicitement le mode modification AVANT d'ajouter le message
        sessionHook.enterModificationMode();
        // Retour à l'interview avec un message demandant les modifications
        // apiContent contient des instructions supplémentaires pour l'IA
        sessionHook.updateMessages(prev => [...prev, {
            role: 'assistant',
            content: '📝 Tu souhaites apporter des modifications aux spécifications. Dis-moi ce que tu voudrais changer ou préciser !',
            apiContent: `📝 L'utilisateur souhaite apporter des modifications aux spécifications déjà générées.

INSTRUCTIONS IMPORTANTES :
- Tu es maintenant en mode CONVERSATION pour discuter des modifications
- NE GÉNÈRE PAS [SPEC_COMPLETE] - les specs existent déjà
- Pose des questions pour comprendre ce que l'utilisateur veut modifier
- Continue la discussion normalement jusqu'à ce que l'utilisateur demande explicitement de "régénérer" ou "mettre à jour" les specs
- Quand l'utilisateur sera prêt, il cliquera sur le bouton "Régénérer les specs"

Dis-moi ce que tu voudrais changer ou préciser !`
        }]);
        updatePhase('interview');
    };

    const handleLogout = () => {
        if (confirm('Voulez-vous vous déconnecter ?')) {
            abortRequest();
            clearInput(); // Clean up pending files before logout
            logout();
        }
    };

    // ==================== Render ====================

    if (!isAuthenticated) {
        return (
            <LoginForm
                onSubmit={handleLogin}
                error={authError}
                email={emailInput}
                onEmailChange={setEmailInput}
                password={passwordInput}
                onPasswordChange={setPasswordInput}
                isLoading={isAuthLoading}
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

    // User header component
    const UserHeader = () => (
        <div className="fixed top-0 right-0 p-4 z-50 flex items-center gap-3">
            {(saveError || versionError) && (
                <span role="alert" className="text-red-300 text-sm">
                    {saveError ? 'Session non sauvegardée' : 'Historique indisponible'}
                </span>
            )}
            <span className="text-slate-400 text-sm">{user?.email}</span>
            <button
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Se déconnecter"
            >
                <LogOut className="w-4 h-4" />
            </button>
        </div>
    );

    if (phase === 'interview') {
        return (
            <>
                <UserHeader />
                <InterviewPhase
                    // Session data
                    messages={messages}
                    questionCount={questionCount}
                    finalSpec={finalSpec}
                    // Loading states
                    isLoading={isLoading}
                    isRegenerating={isRegenerating}
                    isProcessingFiles={isProcessingFiles}
                    // Error handling
                    errorMessage={errorMessage}
                    onClearError={clearError}
                    // Visibility flags
                    hasNewMessagesSinceSpec={hasNewMessagesSinceSpec}
                    // Drag & drop
                    isDragging={isDragging}
                    dragHandlers={dragHandlers}
                    // Chat input
                    inputMessage={inputMessage}
                    setInputMessage={setInputMessage}
                    chatFiles={chatFiles}
                    // Handlers
                    onSendMessage={handleSendMessage}
                    onRequestSpec={requestFinalSpec}
                    onFileSelect={handleFileSelect}
                    onFileRemove={removeFile}
                    onViewSpec={() => updatePhase('complete')}
                    // File validation dialog
                    validationDialog={validationDialog}
                    onValidationAction={handleValidationAction}
                    onValidationCancel={handleValidationCancel}
                    // TTS
                    onPlayAudio={playAudio}
                    playingMessageId={playingMessageId}
                    isPlayingAudio={isPlayingAudio}
                    isLoadingAudio={isLoadingAudio}
                    autoPlayEnabled={autoPlayEnabled}
                    onToggleAutoPlay={toggleAutoPlay}
                    // Refs
                    messagesEndRef={messagesEndRef}
                />
            </>
        );
    }

    // Phase: complete
    return (
        <>
            <UserHeader />
            <CompletePhase
                finalSpec={selectedVersion?.content || finalSpec}
                generatedAt={selectedVersion?.generated_at || null}
                versions={versions}
                selectedVersionId={selectedVersion?.id || null}
                onSelectVersion={selectVersion}
                isCurrentVersion={!selectedVersion || selectedVersion.id === versions[0]?.id}
                isRegenerating={isRegenerating}
                hasNewMessagesSinceSpec={hasNewMessagesSinceSpec}
                onBackToInterview={() => updatePhase('interview')}
                onRegenerate={regenerate}
                onDownload={downloadSpec}
                onRequestModifications={requestModifications}
            />
        </>
    );
}
