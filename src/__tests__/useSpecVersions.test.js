import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSpecVersionMock, listSpecVersionsMock, randomUUIDMock } = vi.hoisted(() => ({
    createSpecVersionMock: vi.fn(),
    listSpecVersionsMock: vi.fn(),
    randomUUIDMock: vi.fn(() => '11111111-1111-4111-8111-111111111111')
}));

vi.mock('../services/specVersionService', () => ({
    createSpecVersion: createSpecVersionMock,
    listSpecVersions: listSpecVersionsMock
}));

import { useSpecVersions } from '../hooks/useSpecVersions';

describe('useSpecVersions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listSpecVersionsMock.mockResolvedValue({ versions: [], error: null });
        vi.stubGlobal('crypto', { randomUUID: randomUUIDMock });
    });

    it('selects the newest version after loading', async () => {
        listSpecVersionsMock.mockResolvedValue({
            versions: [
                { id: 'new', generated_at: '2026-07-30T12:00:00Z' },
                { id: 'old', generated_at: '2026-07-29T12:00:00Z' }
            ],
            error: null
        });

        const { result } = renderHook(() => useSpecVersions('token'));

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.selectedVersion.id).toBe('new');
    });

    it('creates a version with one request id and selects it', async () => {
        const created = {
            id: 'created',
            content: '# Spec',
            generated_at: '2026-07-30T12:00:00Z'
        };
        createSpecVersionMock.mockResolvedValue({ version: created, error: null });
        const { result } = renderHook(() => useSpecVersions('token'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(async () => {
            await result.current.createVersion({
                content: '# Spec',
                sourceMessageCount: 4
            });
        });

        expect(randomUUIDMock).toHaveBeenCalledTimes(1);
        expect(createSpecVersionMock).toHaveBeenCalledWith('token', {
            requestId: '11111111-1111-4111-8111-111111111111',
            content: '# Spec',
            sourceMessageCount: 4
        });
        expect(result.current.selectedVersion).toEqual(created);
    });

    it('selects an archived version without mutating the list', async () => {
        const versions = [{ id: 'new' }, { id: 'old' }];
        listSpecVersionsMock.mockResolvedValue({ versions, error: null });
        const { result } = renderHook(() => useSpecVersions('token'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.selectVersion('old'));

        expect(result.current.selectedVersion.id).toBe('old');
        expect(result.current.versions).toEqual(versions);
    });
});
