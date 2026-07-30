import { formatSpecTimestamp } from '../utils/specVersionFormat';

export default function SpecVersionSelector({
    versions,
    selectedVersionId,
    onSelect
}) {
    if (!versions?.length) {
        return null;
    }

    const isArchived = selectedVersionId !== versions[0].id;

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor="spec-version" className="text-sm font-medium text-slate-300">
                Version affichée
            </label>
            <select
                id="spec-version"
                value={selectedVersionId || versions[0].id}
                onChange={event => onSelect(event.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
            >
                {versions.map((version, index) => (
                    <option key={version.id} value={version.id}>
                        {index === 0 ? 'Actuelle - ' : ''}
                        {formatSpecTimestamp(version.generated_at).label}
                    </option>
                ))}
            </select>
            {isArchived && (
                <p className="text-sm text-amber-300">
                    Version archivée en lecture seule
                </p>
            )}
        </div>
    );
}
