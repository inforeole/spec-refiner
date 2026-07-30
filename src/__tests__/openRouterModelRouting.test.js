import { describe, expect, it } from 'vitest';
import { resolveModelRoute } from '../../supabase/functions/openrouter/modelRouting.ts';

describe('resolveModelRoute', () => {
    it('route les résumés vers Haiku avec un plafond réduit', () => {
        expect(resolveModelRoute('summary')).toEqual({
            task: 'summary',
            model: 'anthropic/claude-haiku-4.5',
            maxTokensCap: 256
        });
    });

    it('route l’entretien vers Sonnet 4.6', () => {
        expect(resolveModelRoute('interview')).toEqual({
            task: 'interview',
            model: 'anthropic/claude-sonnet-4.6',
            maxTokensCap: 8192
        });
    });

    it('utilise l’entretien par défaut pour les anciens clients', () => {
        expect(resolveModelRoute(undefined)?.task).toBe('interview');
    });

    it('refuse une tâche inconnue', () => {
        expect(resolveModelRoute('other')).toBeNull();
    });
});
