import { AlertTriangle, X } from 'lucide-react';

/**
 * Dialogue modal pour la validation des fichiers volumineux
 * @param {Object} props
 * @param {boolean} props.isOpen - Afficher le dialogue
 * @param {'file-too-large' | 'text-too-large' | 'image-too-large'} props.type - Type de validation
 * @param {string} props.fileName - Nom du fichier
 * @param {string} props.fileSize - Taille du fichier formatée
 * @param {string} [props.extractedSize] - Taille du contenu extrait (pour text-too-large)
 * @param {() => void} props.onAction - Action principale (tronquer/redimensionner)
 * @param {() => void} props.onCancel - Annuler (choisir autre fichier)
 */
export default function FileValidationDialog({
    isOpen,
    type,
    fileName,
    fileSize,
    extractedSize,
    onAction,
    onCancel
}) {
    if (!isOpen) return null;

    const config = {
        'file-too-large': {
            title: 'Fichier trop volumineux',
            message: `Le fichier "${fileName}" dépasse la limite de 5 MB (${fileSize}).`,
            actionLabel: null, // Pas d'action, juste annuler
            cancelLabel: 'Choisir un autre fichier'
        },
        'text-too-large': {
            title: 'Document volumineux',
            message: `Le document "${fileName}" contient beaucoup de texte (${extractedSize}). Seul le début sera analysé pour rester dans les limites de l'IA.`,
            actionLabel: 'Lire le début',
            cancelLabel: 'Choisir un autre fichier'
        },
        'image-too-large': {
            title: 'Image volumineuse',
            message: `L'image "${fileName}" est volumineuse (${fileSize}). Elle sera redimensionnée pour l'analyse.`,
            actionLabel: 'Redimensionner',
            cancelLabel: 'Choisir une autre image'
        }
    };

    const { title, message, actionLabel, cancelLabel } = config[type] || config['file-too-large'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-xl">
                {/* Close button */}
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>

                {/* Content */}
                <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
                <p className="text-slate-400 mb-6">{message}</p>

                {/* Actions */}
                <div className="flex flex-col-reverse sm:flex-row gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    {actionLabel && (
                        <button
                            onClick={onAction}
                            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-medium py-2.5 px-4 rounded-xl transition-colors"
                        >
                            {actionLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
