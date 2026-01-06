import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const MessageList = forwardRef(function MessageList({ messages, isLoading }, ref) {
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
                                <MarkdownRenderer content={msg.content} />
                            ) : (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
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
