import { FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import FileList from './FileList';
import { useDragDrop } from '../hooks/useDragDrop';

export default function ProjectInput({
    value,
    onChange,
    files,
    onFileSelect,
    onFileRemove,
    onSubmit,
    isLoading
}) {
    const { isDragging, dragHandlers } = useDragDrop({
        onDrop: (droppedFiles) => onFileSelect({ target: { files: droppedFiles } }),
        disabled: isLoading
    });

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative"
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

            <div className="w-full max-w-3xl">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-600 rounded-2xl mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Vous avez dit spécifications ?<br />En avant !</h1>
                    <p className="text-slate-400 mb-6">Transformez vos idées en spécifications claires</p>

                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 text-left max-w-2xl mx-auto">
                        <p className="text-slate-300 text-sm leading-relaxed mb-3">
                            👋 Salut ! Je suis l&apos;assistant IA de Philippe, spécialisé en conception de produits SaaS.
                        </p>
                        <p className="text-slate-300 text-sm leading-relaxed mb-3">
                            Je vais te guider à travers une série de questions pour transformer ton idée en spécifications claires et exploitables. Ça prend environ 10-15 minutes.
                        </p>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            💡 <span className="text-violet-400">À tout moment</span>, tu peux répondre dans la zone de texte ou m&apos;envoyer des fichiers (images, PDF, documents) pour illustrer ton projet.
                        </p>
                    </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                        Étape 1 : Cadre Global
                    </label>
                    <textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Décrivez le cadre global de votre projet : contexte, objectifs, cible... C'est la base de travail pour l'IA."
                        className="w-full h-48 bg-slate-900/50 border border-slate-600 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none mb-4"
                    />

                    {/* File Upload Area */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <label
                                htmlFor="file-upload"
                                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 text-sm transition-colors"
                            >
                                <Upload className="w-4 h-4" />
                                Ajouter des documents de référence globaux (Images, PDF, Docx)
                            </label>
                            <input
                                id="file-upload"
                                type="file"
                                multiple
                                accept=".png,.jpg,.jpeg,.pdf,.docx,.txt,.md"
                                onChange={onFileSelect}
                                className="hidden"
                            />
                            <span className="text-slate-500 text-xs">Max 10MB par fichier</span>
                        </div>

                        <FileList files={files} onRemove={onFileRemove} />
                    </div>

                    <button
                        onClick={onSubmit}
                        disabled={(!value.trim() && files.length === 0) || isLoading}
                        className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Analyse des fichiers...
                            </>
                        ) : (
                            <>
                                <FileText className="w-5 h-5" />
                                Commencer
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
