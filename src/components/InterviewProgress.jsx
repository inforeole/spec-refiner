const STATUS_STYLES = {
    complete: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    blocked: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
    incomplete: 'border-slate-600 bg-slate-800 text-slate-300',
    to_explore: 'border-slate-700 bg-slate-900/70 text-slate-400'
};

const STATUS_LABELS = {
    complete: 'Complet',
    blocked: 'À décider',
    incomplete: 'À préciser',
    to_explore: 'À explorer'
};

export default function InterviewProgress({ themes, missingDecisionCount }) {
    return (
        <section
            aria-label="Avancement du cadrage"
            className="border-b border-slate-700 bg-slate-900/70 px-4 py-3"
        >
            <div className="mx-auto max-w-3xl">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">
                        Cadrage du projet
                    </p>
                    <p className={`text-sm ${
                        missingDecisionCount > 0 ? 'text-amber-300' : 'text-emerald-300'
                    }`}>
                        {missingDecisionCount > 0
                            ? `${missingDecisionCount} décision${missingDecisionCount > 1 ? 's' : ''} manquante${missingDecisionCount > 1 ? 's' : ''}`
                            : 'Aucune décision bloquante'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {themes.map(theme => (
                        <span
                            key={theme.id}
                            className={`rounded-full border px-3 py-1 text-xs ${
                                STATUS_STYLES[theme.status] || STATUS_STYLES.to_explore
                            }`}
                        >
                            {theme.label}
                            <span className="sr-only">
                                {`: ${STATUS_LABELS[theme.status] || STATUS_LABELS.to_explore}`}
                            </span>
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}
