import { AlertCircle } from 'lucide-react';

import { LoginForm, InterviewPhase, CompletePhase } from './components';
import { downloadAsWord } from './utils/wordExport';
import { useSession } from './hooks/useSession';
import { useDragDrop } from './hooks/useDragDrop';
import { useAuth } from './hooks/useAuth';
import { useChatInput } from './hooks/useChatInput';
import { useInterviewChat } from './hooks/useInterviewChat';
import { useTTSMessage } from './hooks/useTTSMessage';

export default function SpecRefiner() {
    // ==================== Hooks ====================

    const { isAuthenticated, passwordInput, setPasswordInput, authError, handleLogin } = useAuth();

    const sessionHook = useSession();
    const {
        messages,
        phase,
        questionCount,
        finalSpec,
        isLoading: isSessionLoading,
        connectionError,
        updatePhase,
        resetSession
    } = sessionHook;

    const {
        inputMessage,
        setInputMessage,
        chatFiles,
        isProcessingFiles,
        handleFileSelect,
        removeFile,
        clearInput,
        addFiles,
        processCurrentFiles
    } = useChatInput();

    const { isLoading, sendMessage, requestFinalSpec, abortRequest } = useInterviewChat(sessionHook);

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
    } = useTTSMessage(messages);

    // ==================== Handlers ====================

    const handleSendMessage = async () => {
        if ((!inputMessage.trim() && chatFiles.length === 0) || isLoading) return;

        const messageText = inputMessage;
        const currentFiles = [...chatFiles];

        clearInput();

        const processedFiles = currentFiles.length > 0
            ? await processCurrentFiles(currentFiles)
            : [];

        await sendMessage(messageText, processedFiles);
    };

    const downloadSpec = () => {
        downloadAsWord(finalSpec, 'specifications.docx');
    };

    const resetWithConfirmation = async (confirmMessage) => {
        if (!confirm(confirmMessage)) return;

        abortRequest();
        await resetSession();
        clearInput();
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
            <InterviewPhase
                // Session data
                messages={messages}
                questionCount={questionCount}
                finalSpec={finalSpec}
                // Loading states
                isLoading={isLoading}
                isProcessingFiles={isProcessingFiles}
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
                onReset={reset}
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
        );
    }

    // Phase: complete
    return (
        <CompletePhase
            finalSpec={finalSpec}
            onBackToInterview={() => updatePhase('interview')}
            onRegenerate={regenerate}
            onDownload={downloadSpec}
            onReset={reset}
        />
    );
}
