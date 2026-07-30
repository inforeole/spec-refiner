export function evaluateSpecReadiness(model) {
    const themes = Array.isArray(model?.themes) ? model.themes : [];
    const decisions = Array.isArray(model?.decisions) ? model.decisions : [];
    const requirements = Array.isArray(model?.requirements) ? model.requirements : [];
    const blockingReasons = [];

    for (const theme of themes) {
        if (theme.status !== 'complete') {
            blockingReasons.push(`${theme.label} reste à préciser`);
        }
    }

    for (const decision of decisions) {
        if (decision.status === 'unknown' || decision.status === 'contradiction') {
            blockingReasons.push(`${decision.label || decision.id} reste à décider`);
        }
    }

    for (const requirement of requirements) {
        if (requirement.priority !== 'required' || requirement.status !== 'confirmed') {
            continue;
        }
        if (!Array.isArray(requirement.scenarios) || requirement.scenarios.length === 0) {
            blockingReasons.push(`${requirement.id} ne possède aucun scénario`);
        }
        if (!Array.isArray(requirement.acceptanceCriteria) ||
            requirement.acceptanceCriteria.length === 0) {
            blockingReasons.push(`${requirement.id} ne possède aucun critère d’acceptation`);
        }
    }

    const missingDecisionCount = decisions.filter(decision =>
        decision.status === 'unknown' || decision.status === 'contradiction'
    ).length;
    const generationKind = blockingReasons.length === 0 && themes.length > 0
        ? 'ready'
        : 'working';

    return {
        themes,
        missingDecisionCount,
        blockingReasons,
        generationKind,
        label: generationKind === 'ready'
            ? 'Générer la spec'
            : 'Générer une version de travail'
    };
}
