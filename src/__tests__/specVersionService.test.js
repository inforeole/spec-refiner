import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
    rpcMock: vi.fn()
}));

vi.mock('../services/supabaseRpc', () => ({
    rpcWithTimeout: rpcMock
}));

import {
    createSpecVersion,
    listSpecVersions
} from '../services/specVersionService';

describe('specVersionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates a version with an idempotency key and source count', async () => {
        rpcMock.mockResolvedValue({
            data: [{
                id: 'version-1',
                content: '# Cahier des charges',
                generated_at: '2026-07-30T13:42:00Z'
            }],
            error: null
        });

        const result = await createSpecVersion('session-token', {
            requestId: '11111111-1111-4111-8111-111111111111',
            content: '# Cahier des charges',
            sourceMessageCount: 14
        });

        expect(rpcMock).toHaveBeenCalledWith('create_spec_version', {
            p_session_token: 'session-token',
            p_request_id: '11111111-1111-4111-8111-111111111111',
            p_content: '# Cahier des charges',
            p_source_message_count: 14
        });
        expect(result.version.id).toBe('version-1');
    });

    it('loads at most six immutable versions', async () => {
        rpcMock.mockResolvedValue({
            data: Array.from({ length: 7 }, (_, index) => ({
                id: `version-${index}`,
                content: `# Version ${index}`,
                generated_at: `2026-07-${30 - index}T10:00:00Z`
            })),
            error: null
        });

        const result = await listSpecVersions('session-token');

        expect(rpcMock).toHaveBeenCalledWith('list_spec_versions', {
            p_session_token: 'session-token'
        });
        expect(result.versions).toHaveLength(6);
    });

    it('surfaces remote creation errors', async () => {
        rpcMock.mockResolvedValue({
            data: null,
            error: { message: 'écriture impossible' }
        });

        await expect(createSpecVersion('session-token', {
            requestId: 'request',
            content: '# Spec',
            sourceMessageCount: 1
        })).resolves.toEqual({
            version: null,
            error: 'écriture impossible'
        });
    });
});
