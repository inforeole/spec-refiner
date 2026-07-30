import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InterviewProgress } from '../components';

describe('InterviewProgress', () => {
    it('shows themes and missing decisions without a percentage', () => {
        render(
            <InterviewProgress
                themes={[
                    { id: 'scope', label: 'Périmètre', status: 'complete' },
                    { id: 'rules', label: 'Règles métier', status: 'blocked' }
                ]}
                missingDecisionCount={2}
            />
        );

        expect(screen.getByText('Périmètre')).toBeTruthy();
        expect(screen.getByText('Règles métier')).toBeTruthy();
        expect(screen.getByText('2 décisions manquantes')).toBeTruthy();
        expect(screen.queryByText(/%/)).toBeNull();
        expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('shows when no decision is blocking', () => {
        render(
            <InterviewProgress
                themes={[]}
                missingDecisionCount={0}
            />
        );

        expect(screen.getByText('Aucune décision bloquante')).toBeTruthy();
    });
});
