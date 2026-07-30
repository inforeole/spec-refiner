import { describe, expect, it } from 'vitest';
import {
    applySpecUpdates,
    createEmptySpecModel,
    normalizeSpecModel
} from '../domain/specModel';

describe('specModel', () => {
    it('creates an isolated empty model with the seven guidance themes', () => {
        const first = createEmptySpecModel();
        const second = createEmptySpecModel();

        expect(first.schemaVersion).toBe(1);
        expect(first.themes).toHaveLength(7);
        first.themes[0].status = 'complete';
        expect(second.themes[0].status).toBe('to_explore');
    });

    it('merges updates by stable identifier without duplicating records', () => {
        const initial = createEmptySpecModel();
        const first = applySpecUpdates(initial, {
            capabilities: [{
                id: 'auth',
                name: 'Authentification',
                priority: 'required',
                sourceIds: ['message-2']
            }]
        });
        const second = applySpecUpdates(first, {
            capabilities: [{
                id: 'auth',
                name: 'Connexion utilisateur',
                priority: 'required',
                sourceIds: ['message-2', 'message-5']
            }]
        });

        expect(second.capabilities).toHaveLength(1);
        expect(second.capabilities[0].name).toBe('Connexion utilisateur');
        expect(second.capabilities[0].sourceIds).toEqual(['message-2', 'message-5']);
    });

    it('preserves records omitted from a later update', () => {
        const model = applySpecUpdates(createEmptySpecModel(), {
            capabilities: [
                { id: 'auth', name: 'Connexion', sourceIds: [] },
                { id: 'export', name: 'Export', sourceIds: [] }
            ]
        });

        const updated = applySpecUpdates(model, {
            capabilities: [{ id: 'auth', name: 'Authentification', sourceIds: [] }]
        });

        expect(updated.capabilities.map(item => item.id)).toEqual(['auth', 'export']);
    });

    it('rejects updates above product limits', () => {
        const updates = {
            capabilities: Array.from({ length: 9 }, (_, index) => ({
                id: `capability-${index}`,
                name: `Capability ${index}`,
                priority: 'required',
                sourceIds: []
            }))
        };

        expect(() => applySpecUpdates(createEmptySpecModel(), updates))
            .toThrow('Le lot dépasse 8 capacités');
    });

    it('normalizes malformed persisted data to a safe model', () => {
        const normalized = normalizeSpecModel({
            schemaVersion: 99,
            capabilities: null,
            decisions: [{ id: 'x', status: 'invalid' }]
        });

        expect(normalized.schemaVersion).toBe(1);
        expect(normalized.capabilities).toEqual([]);
        expect(normalized.decisions[0].status).toBe('unknown');
        expect(normalized.themes).toHaveLength(7);
    });
});
