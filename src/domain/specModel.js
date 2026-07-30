export const SPEC_MODEL_SCHEMA_VERSION = 1;
export const MAX_CAPABILITIES = 8;
export const MAX_REQUIREMENTS = 40;

const DECISION_STATUSES = new Set([
    'confirmed',
    'hypothesis',
    'unknown',
    'contradiction'
]);
const THEME_STATUSES = new Set([
    'to_explore',
    'incomplete',
    'complete',
    'blocked'
]);

const DEFAULT_THEMES = [
    { id: 'scope', label: 'Périmètre', status: 'to_explore', missingDecisionIds: [] },
    { id: 'users', label: 'Utilisateurs', status: 'to_explore', missingDecisionIds: [] },
    { id: 'journey', label: 'Parcours principal', status: 'to_explore', missingDecisionIds: [] },
    { id: 'rules', label: 'Règles métier', status: 'to_explore', missingDecisionIds: [] },
    { id: 'data', label: 'Données', status: 'to_explore', missingDecisionIds: [] },
    { id: 'edge-cases', label: 'Cas particuliers', status: 'to_explore', missingDecisionIds: [] },
    { id: 'dependencies', label: 'Dépendances externes', status: 'to_explore', missingDecisionIds: [] }
];

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function uniqueStrings(value) {
    return [...new Set(asArray(value).filter(item => typeof item === 'string'))];
}

function normalizeRecord(record) {
    return {
        ...record,
        sourceIds: uniqueStrings(record?.sourceIds)
    };
}

function normalizeDecision(decision) {
    return {
        ...normalizeRecord(decision),
        status: DECISION_STATUSES.has(decision?.status) ? decision.status : 'unknown'
    };
}

function normalizeTheme(theme, fallback) {
    return {
        ...fallback,
        ...theme,
        status: THEME_STATUSES.has(theme?.status) ? theme.status : fallback.status,
        missingDecisionIds: uniqueStrings(theme?.missingDecisionIds)
    };
}

function mergeById(current, updates, normalizer = normalizeRecord) {
    const merged = asArray(current).map(item => normalizer(item));
    const indexes = new Map(merged.map((item, index) => [item.id, index]));

    for (const update of asArray(updates)) {
        if (!update || typeof update.id !== 'string' || update.id.length === 0) {
            continue;
        }

        const index = indexes.get(update.id);
        if (index === undefined) {
            indexes.set(update.id, merged.length);
            merged.push(normalizer(update));
            continue;
        }

        const existing = merged[index];
        merged[index] = normalizer({
            ...existing,
            ...update,
            sourceIds: uniqueStrings([
                ...asArray(existing.sourceIds),
                ...asArray(update.sourceIds)
            ])
        });
    }

    return merged;
}

function compactDelta(value) {
    if (!value || typeof value !== 'object') {
        return {};
    }
    return Object.fromEntries(
        Object.entries(value).filter(([, item]) => (
            item !== null &&
            item !== undefined &&
            (!Array.isArray(item) || item.length > 0)
        ))
    );
}

export function createEmptySpecModel() {
    return {
        schemaVersion: SPEC_MODEL_SCHEMA_VERSION,
        intent: {
            problem: null,
            targetUsers: [],
            expectedOutcome: null,
            successIndicators: []
        },
        scope: {
            lotName: null,
            included: [],
            excluded: []
        },
        capabilities: [],
        requirements: [],
        decisions: [],
        themes: DEFAULT_THEMES.map(theme => ({
            ...theme,
            missingDecisionIds: []
        }))
    };
}

export function normalizeSpecModel(input) {
    const empty = createEmptySpecModel();
    const source = input && typeof input === 'object' ? input : {};
    const themesById = new Map(asArray(source.themes).map(theme => [theme?.id, theme]));

    return {
        schemaVersion: SPEC_MODEL_SCHEMA_VERSION,
        intent: {
            ...empty.intent,
            ...(source.intent && typeof source.intent === 'object' ? source.intent : {}),
            targetUsers: uniqueStrings(source.intent?.targetUsers),
            successIndicators: uniqueStrings(source.intent?.successIndicators)
        },
        scope: {
            ...empty.scope,
            ...(source.scope && typeof source.scope === 'object' ? source.scope : {}),
            included: uniqueStrings(source.scope?.included),
            excluded: uniqueStrings(source.scope?.excluded)
        },
        capabilities: asArray(source.capabilities)
            .slice(0, MAX_CAPABILITIES)
            .map(normalizeRecord),
        requirements: asArray(source.requirements)
            .slice(0, MAX_REQUIREMENTS)
            .map(normalizeRecord),
        decisions: asArray(source.decisions).map(normalizeDecision),
        themes: DEFAULT_THEMES.map(theme => normalizeTheme(themesById.get(theme.id), theme))
    };
}

export function applySpecUpdates(model, updates) {
    const current = normalizeSpecModel(model);
    const incoming = updates && typeof updates === 'object' ? updates : {};
    const capabilities = mergeById(current.capabilities, incoming.capabilities);
    const requirements = mergeById(current.requirements, incoming.requirements);

    if (capabilities.length > MAX_CAPABILITIES) {
        throw new Error('Le lot dépasse 8 capacités');
    }
    if (requirements.length > MAX_REQUIREMENTS) {
        throw new Error('La spécification dépasse 40 exigences');
    }

    const incomingThemes = new Map(asArray(incoming.themes).map(theme => [theme?.id, theme]));

    return normalizeSpecModel({
        ...current,
        intent: {
            ...current.intent,
            ...compactDelta(incoming.intent)
        },
        scope: {
            ...current.scope,
            ...compactDelta(incoming.scope)
        },
        capabilities,
        requirements,
        decisions: mergeById(current.decisions, incoming.decisions, normalizeDecision),
        themes: current.themes.map(theme => normalizeTheme(
            incomingThemes.has(theme.id)
                ? { ...theme, ...incomingThemes.get(theme.id) }
                : theme,
            theme
        ))
    });
}
