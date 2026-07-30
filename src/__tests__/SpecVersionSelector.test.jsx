import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    SingleProjectNotice,
    SpecVersionSelector
} from '../components';

const versions = Array.from({ length: 6 }, (_, index) => ({
    id: `version-${index + 1}`,
    content: `# Version ${index + 1}`,
    generated_at: `2026-07-${30 - index}T13:42:00Z`
}));

describe('SpecVersionSelector', () => {
    it('shows six timestamped versions without restore action', () => {
        render(
            <SpecVersionSelector
                versions={versions}
                selectedVersionId="version-2"
                onSelect={vi.fn()}
            />
        );

        expect(screen.getAllByRole('option')).toHaveLength(6);
        expect(screen.getByRole('option', { name: /actuelle/i })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /restaurer/i })).toBeNull();
    });

    it('selects a version by its immutable identifier', () => {
        const onSelect = vi.fn();
        render(
            <SpecVersionSelector
                versions={versions}
                selectedVersionId="version-1"
                onSelect={onSelect}
            />
        );

        fireEvent.change(screen.getByLabelText('Version affichée'), {
            target: { value: 'version-4' }
        });

        expect(onSelect).toHaveBeenCalledWith('version-4');
    });

    it('marks an archived version as read only', () => {
        render(
            <SpecVersionSelector
                versions={versions}
                selectedVersionId="version-2"
                onSelect={vi.fn()}
            />
        );

        expect(screen.getByText('Version archivée en lecture seule')).toBeTruthy();
    });
});

describe('SingleProjectNotice', () => {
    it('replaces reset with the single project notice', () => {
        render(<SingleProjectNotice />);

        expect(screen.getByText(/associé à un seul projet/i)).toBeTruthy();
        expect(screen.getByText(/envoyez un message à Phil/i)).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
    });
});
