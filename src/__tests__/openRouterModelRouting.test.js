import { describe, expect, it } from 'vitest';
import { resolveModelRoute } from '../../supabase/functions/openrouter/modelRouting.ts';
import { getStructuredResponseFormat } from '../../supabase/functions/openrouter/structuredOutputs.ts';

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

    it('routes final specs through Sonnet with the document cap', () => {
        expect(resolveModelRoute('spec')).toEqual({
            task: 'spec',
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

describe('structured output contracts', () => {
    it('requires strict JSON schema for interview updates', () => {
        const format = getStructuredResponseFormat('interview');

        expect(format.type).toBe('json_schema');
        expect(format.json_schema.strict).toBe(true);
        expect(format.json_schema.schema.required)
            .toEqual(['assistantMessage', 'updates']);
    });

    it('requires a markdown document for spec generation', () => {
        const format = getStructuredResponseFormat('spec');

        expect(format.json_schema.schema.required).toEqual(['markdown']);
        expect(format.json_schema.schema.properties.markdown.minLength).toBe(1);
    });

    it('keeps summaries unstructured', () => {
        expect(getStructuredResponseFormat('summary')).toBeNull();
    });
});
