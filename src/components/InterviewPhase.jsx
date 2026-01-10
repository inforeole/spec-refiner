import { Download, RotateCcw, Sparkles, CheckCircle2, Upload, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { ChatInput, MessageList } from './index';
import { INTERVIEW_CONFIG } from '../config/constants';

/**
 * Phase d'interview - conversation avec l'IA
 */
export default function InterviewPhase({
    // Session data
    messages,
    questionCount,
    finalSpec,
    // Loading states
    isLoading,
    isProcessingFiles,
    // Drag & drop
    isDragging,
    dragHandlers,
    // Chat input
    inputMessage,
    setInputMessage,
    chatFiles,
    // Handlers
    onSendMessage,
    onRequestSpec,
    onFileSelect,
    onFileRemove,
    onViewSpec,
    onReset,
    // TTS
    onPlayAudio,
    playingMessageId,
    isPlayingAudio,
    isLoadingAudio,
    autoPlayEnabled,
    onToggleAutoPlay,
    // Refs
    messagesEndRef
}) {
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
                    <div className="flex gap-2 items-center">
                        {onToggleAutoPlay && (
                            <button
                                onClick={onToggleAutoPlay}
                                className={`p-2 rounded-lg transition-colors ${
                                    autoPlayEnabled
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-slate-700 text-slate-400 hover:text-white'
                                }`}
                                title={autoPlayEnabled ? 'Désactiver la lecture auto' : 'Activer la lecture auto'}
                            >
                                {autoPlayEnabled ? (
                                    <Volume2 className="w-4 h-4" />
                                ) : (
                                    <VolumeX className="w-4 h-4" />
                                )}
                            </button>
                        )}
                        {finalSpec && (
                            <>
                                <button
                                    onClick={onRequestSpec}
                                    disabled={isLoading}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    Régénérer
                                </button>
                                <button
                                    onClick={onViewSpec}
                                    className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Voir les specs
                                </button>
                            </>
                        )}
                        {questionCount >= INTERVIEW_CONFIG.MIN_QUESTIONS_BEFORE_SPEC && !finalSpec && (
                            <button
                                onClick={onRequestSpec}
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
                onPlayAudio={onPlayAudio}
                playingMessageId={playingMessageId}
                isPlayingAudio={isPlayingAudio}
                isLoadingAudio={isLoadingAudio}
            />

            {/* Boutons Régénérer et Voir les specs au-dessus de la zone de saisie */}
            {finalSpec && (
                <div className="py-3 flex justify-center gap-3 border-t border-slate-700 bg-slate-800/80 backdrop-blur">
                    <button
                        onClick={onRequestSpec}
                        disabled={isLoading}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Régénérer les specs
                    </button>
                    <button
                        onClick={onViewSpec}
                        className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Voir les specs
                    </button>
                </div>
            )}

            <ChatInput
                value={inputMessage}
                onChange={setInputMessage}
                onSubmit={onSendMessage}
                files={chatFiles}
                onFileSelect={onFileSelect}
                onFileRemove={onFileRemove}
                disabled={isLoading || isProcessingFiles}
                isProcessingFiles={isProcessingFiles}
                showGenerateButton={questionCount >= INTERVIEW_CONFIG.MIN_QUESTIONS_BEFORE_SPEC && !finalSpec}
                onRequestSpec={onRequestSpec}
            />

            {/* Footer */}
            <div className="py-3 flex justify-center border-t border-slate-800">
                <button
                    onClick={onReset}
                    className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 transition-colors"
                >
                    <RotateCcw className="w-4 h-4" />
                    Recommencer un nouveau projet
                </button>
            </div>
        </div>
    );
}
