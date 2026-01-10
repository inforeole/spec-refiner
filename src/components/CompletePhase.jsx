import { Download, RotateCcw, RefreshCw, CheckCircle2, MessageCircle, Edit3 } from 'lucide-react';
import { MarkdownRenderer } from './index';

/**
 * Phase de complétion - affichage du spec final
 */
export default function CompletePhase({
    finalSpec,
    isRegenerating,
    hasNewMessagesSinceSpec,
    onBackToInterview,
    onRegenerate,
    onDownload,
    onReset,
    onRequestModifications
}) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Spécifications finales</h1>
                            <p className="text-slate-400">Prêtes pour le développement</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onBackToInterview}
                            className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                            title="Voir l'interview"
                        >
                            <MessageCircle className="w-4 h-4" />
                            Interview
                        </button>
                        <button
                            onClick={onDownload}
                            className="bg-violet-600 hover:bg-violet-500 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            Spécifications
                        </button>
                    </div>
                </div>

                {/* Spec content */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8">
                    {/* Date and regenerate button */}
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700">
                        <p className="text-slate-400 text-sm">
                            Généré le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {hasNewMessagesSinceSpec && (
                            <button
                                onClick={onRegenerate}
                                disabled={isRegenerating}
                                className={`${isRegenerating ? 'bg-emerald-800 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500'} text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2`}
                                title="Régénérer les spécifications"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                                {isRegenerating ? 'Régénération...' : 'Régénérer'}
                            </button>
                        )}
                    </div>
                    <MarkdownRenderer content={finalSpec} />
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={onDownload}
                        className="bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Download className="w-5 h-5" />
                        Télécharger les specs
                    </button>
                    <button
                        onClick={onRequestModifications}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Edit3 className="w-5 h-5" />
                        Apporter des modifications
                    </button>
                </div>

                {/* Footer - séparé pour action dangereuse */}
                <div className="mt-8 pt-4 border-t border-slate-700 flex justify-center">
                    <button
                        onClick={onReset}
                        className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-2 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Recommencer un nouveau projet
                    </button>
                </div>
            </div>
        </div>
    );
}
