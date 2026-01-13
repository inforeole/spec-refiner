import { File as FileIcon } from 'lucide-react';

/**
 * Affiche les fichiers attachés dans une bulle de message
 * @param {Object} props
 * @param {Array<{ name: string, content: string, type: string }>} props.textFiles - Fichiers texte parsés
 * @param {Array<{ url: string }>} props.images - URLs des images
 */
export default function MessageFilePreview({ textFiles = [], images = [] }) {
    const hasContent = textFiles.length > 0 || images.length > 0;

    if (!hasContent) {
        return null;
    }

    return (
        <div className="mt-3 space-y-2">
            {/* Images */}
            {images.map((img, idx) => (
                <div key={`img-${idx}`} className="mt-2">
                    <img
                        src={img.url}
                        alt="Image attachée"
                        className="max-w-[250px] max-h-[200px] rounded-lg border border-white/20 object-contain"
                        loading="lazy"
                    />
                </div>
            ))}

            {/* Fichiers texte */}
            {textFiles.map((file, idx) => (
                <div
                    key={`file-${idx}`}
                    className="bg-black/20 rounded-lg p-3 border border-white/10"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <FileIcon className="w-4 h-4 text-violet-300 shrink-0" />
                        <span className="text-sm font-medium text-white/90 truncate">
                            {file.name}
                        </span>
                    </div>
                    {file.content && (
                        <div className="text-xs text-white/70 whitespace-pre-wrap line-clamp-6 font-mono bg-black/20 rounded p-2">
                            {file.content.length > 500
                                ? file.content.substring(0, 500) + '...'
                                : file.content}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
