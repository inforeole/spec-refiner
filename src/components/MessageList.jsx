import { forwardRef, useMemo } from 'react';
import { Loader2, Volume2, Pause, Loader } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import MessageFilePreview from './MessageFilePreview';
import { parseFileMarkers, extractImageUrls } from '../services/parseFileMarkers';

/**
 * Composant pour afficher le contenu d'un message utilisateur avec fichiers
 */
function UserMessageContent({ content, apiContent }) {
    const { cleanContent, files } = useMemo(
        () => parseFileMarkers(content),
        [content]
    );

    const images = useMemo(
        () => extractImageUrls(apiContent),
        [apiContent]
    );

    return (
        <>
            {cleanContent && (
                <div className="whitespace-pre-wrap">{cleanContent}</div>
            )}
            <MessageFilePreview textFiles={files} images={images} />
        </>
    );
}

const MessageList = forwardRef(function MessageList({
    messages,
    isLoading,
    onPlayAudio,
    playingMessageId,
    isPlayingAudio,
    isLoadingAudio
}, ref) {
    return (
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
                            {msg.role === 'assistant' ? (
                                <>
                                    <MarkdownRenderer content={msg.content} />
                                    {onPlayAudio && (
                                        <button
                                            onClick={() => onPlayAudio(msg.content, idx)}
                                            className="mt-2 p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-violet-400 transition-colors"
                                            title={playingMessageId === idx ? 'Arrêter' : 'Écouter'}
                                        >
                                            {isLoadingAudio && playingMessageId === idx ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : isPlayingAudio && playingMessageId === idx ? (
                                                <Pause className="w-4 h-4" />
                                            ) : (
                                                <Volume2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <UserMessageContent content={msg.content} apiContent={msg.apiContent} />
                            )}
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
                <div ref={ref} />
            </div>
        </div>
    );
});

export default MessageList;
