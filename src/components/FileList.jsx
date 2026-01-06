import { X, File as FileIcon, Image as ImageIcon } from 'lucide-react';

export default function FileList({ files, onRemove, compact = false }) {
    if (files.length === 0) return null;

    if (compact) {
        return (
            <div className="flex flex-wrap gap-2">
                {files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-600">
                        {file.type.startsWith('image/') ? (
                            <ImageIcon className="w-3 h-3 text-violet-400" />
                        ) : (
                            <FileIcon className="w-3 h-3 text-blue-400" />
                        )}
                        <span className="text-xs text-slate-300 max-w-[150px] truncate">{file.name}</span>
                        <button
                            onClick={() => onRemove(idx)}
                            className="text-slate-400 hover:text-red-400 ml-1"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    return (
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
                        onClick={() => onRemove(idx)}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
