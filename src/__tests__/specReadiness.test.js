import { describe, expect, it } from 'vitest';
import { createEmptySpecModel } from '../domain/specModel';
import { evaluateSpecReadiness } from '../domain/specReadiness';

describe('specReadiness', () => {
    it('uses qualitative status and never returns a percentage', () => {
        const readiness = evaluateSpecReadiness(createEmptySpecModel());

        expect(readiness).toEqual(expect.objectContaining({
            generationKind: 'working',
            label: 'Générer une version de travail'
        }));
        expect(readiness).not.toHaveProperty('percentage');
    });

    it('blocks ready status when a confirmed requirement has no scenario', () => {
        const model = createEmptySpecModel();
        model.requirements.push({
            id: 'REQ-001',
            capabilityId: 'auth',
            title: 'Connexion',
            description: 'Un utilisateur se connecte',
            priority: 'required',
            status: 'confirmed',
            acceptanceCriteria: ['Le compte existe'],
            scenarios: [],
            sourceIds: ['message-3']
        });

        expect(evaluateSpecReadiness(model).blockingReasons)
            .toContain('REQ-001 ne possède aucun scénario');
    });

    it('is ready only when themes, decisions and required requirements are complete', () => {
        const model = createEmptySpecModel();
        model.themes = model.themes.map(theme => ({ ...theme, status: 'complete' }));
        model.decisions.push({ id: 'hosting', status: 'confirmed' });
        model.requirements.push({
            id: 'REQ-001',
            priority: 'required',
            status: 'confirmed',
            acceptanceCriteria: ['Le compte existe'],
            scenarios: [{ given: 'un compte', when: 'connexion', then: 'accès' }]
        });

        expect(evaluateSpecReadiness(model)).toEqual(expect.objectContaining({
            generationKind: 'ready',
            label: 'Générer la spec',
            missingDecisionCount: 0,
            blockingReasons: []
        }));
    });
});
