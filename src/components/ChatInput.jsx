import { useRef } from 'react';
import { Send, Loader2, Upload } from 'lucide-react';
import FileList from './FileList';

export default function ChatInput({
    value,
    onChange,
    onSubmit,
    files,
    onFileSelect,
    onFileRemove,
    disabled,
    isProcessingFiles
}) {
    const fileInputRef = useRef(null);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    const handlePaste = (e) => {
        if (disabled) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        const pastedFiles = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) pastedFiles.push(file);
            }
        }

        if (pastedFiles.length > 0) {
            e.preventDefault();
            const syntheticEvent = {
                target: { files: pastedFiles }
            };
            onFileSelect(syntheticEvent);
        }
    };

    return (
        <div className="bg-slate-800/80 backdrop-blur border-t border-slate-700 p-4">
            <div className="max-w-3xl mx-auto">
                {/* Chat File Preview */}
                {files.length > 0 && (
                    <div className="mb-3">
                        <FileList files={files} onRemove={onFileRemove} compact />
                    </div>
                )}

                <div className="flex gap-3 items-end">
                    <label
                        htmlFor="chat-file-upload"
                        className={`p-3 rounded-xl transition-colors cursor-pointer self-end ${disabled ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'}`}
                    >
                        <Upload className="w-5 h-5" />
                        <input
                            ref={fileInputRef}
                            id="chat-file-upload"
                            type="file"
                            multiple
                            accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.docx,.txt,.md"
                            onChange={onFileSelect}
                            disabled={disabled}
                            className="hidden"
                        />
                    </label>

                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder={isProcessingFiles ? "Traitement des fichiers..." : "Ta réponse... (ou glisse des fichiers ici)"}
                        disabled={disabled}
                        rows={1}
                        className="flex-1 bg-slate-900/50 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none min-h-[48px] max-h-[200px]"
                        style={{ height: 'auto' }}
                        onInput={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                        }}
                    />
                    <button
                        onClick={onSubmit}
                        disabled={disabled || (value.trim() === '' && files.length === 0)}
                        className="bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors self-end"
                    >
                        {isProcessingFiles ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>

                <p className="text-slate-500 text-xs mt-2 text-center">
                    📎 Ajouter des fichiers • Ctrl+V pour coller • Glisser n&apos;importe où
                </p>
            </div>
        </div>
    );
}
