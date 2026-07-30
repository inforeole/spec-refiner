import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock du client Supabase et du getter de token de session.
const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
    supabase: { rpc: (...args) => rpc(...args) },
    isSupabaseConfigured: () => true,
}));

let sessionToken = 'sess-123';
vi.mock('../lib/apiClient', () => ({
    getSessionToken: () => sessionToken,
}));

import {
    checkIsAdmin,
    createUser,
    deleteUser,
    listUsers,
    resetUserProject
} from '../services/userService';

describe('userService — autorisation admin par token de session (post fuite VITE_ADMIN_TOKEN)', () => {
    beforeEach(() => {
        rpc.mockReset();
        sessionToken = 'sess-123';
    });

    it('checkIsAdmin: true quand is_session_admin renvoie true', async () => {
        rpc.mockResolvedValue({ data: true, error: null });
        expect(await checkIsAdmin()).toBe(true);
        expect(rpc).toHaveBeenCalledWith('is_session_admin', { p_session_token: 'sess-123' });
    });

    it('checkIsAdmin: false sans token de session (ne tape pas le serveur)', async () => {
        sessionToken = null;
        expect(await checkIsAdmin()).toBe(false);
        expect(rpc).not.toHaveBeenCalled();
    });

    it('checkIsAdmin: false si le RPC renvoie une erreur', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
        expect(await checkIsAdmin()).toBe(false);
    });

    it('createUser: transmet p_session_token (jamais admin_token) et réussit', async () => {
        rpc.mockResolvedValue({ data: 'new-id', error: null });
        const res = await createUser('New@X.io', 'Str0ng!Passw0rd');
        expect(rpc).toHaveBeenCalledWith(
            'admin_create_user',
            expect.objectContaining({ p_session_token: 'sess-123', user_email: 'new@x.io' })
        );
        // aucun argument admin_token ne doit être transmis
        expect(rpc.mock.calls[0][1]).not.toHaveProperty('admin_token');
        expect(res.user).toEqual({ id: 'new-id', email: 'new@x.io' });
    });

    it('createUser: Unauthorized -> message "Accès réservé aux administrateurs"', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'Unauthorized' } });
        const res = await createUser('New@X.io', 'Str0ng!Passw0rd');
        expect(res.user).toBe(null);
        expect(res.error).toBe('Accès réservé aux administrateurs');
    });

    it('listUsers: sans token -> erreur session expirée, pas d\'appel serveur', async () => {
        sessionToken = null;
        const res = await listUsers();
        expect(res.error).toMatch(/Session expirée/);
        expect(rpc).not.toHaveBeenCalled();
    });

    it('deleteUser: transmet p_session_token + target_user_id', async () => {
        rpc.mockResolvedValue({ error: null });
        const res = await deleteUser('victim-id');
        expect(rpc).toHaveBeenCalledWith('admin_delete_user', {
            p_session_token: 'sess-123',
            target_user_id: 'victim-id',
        });
        expect(res.success).toBe(true);
    });

    it('resets only the named user through the admin RPC', async () => {
        rpc.mockResolvedValue({
            data: [{ role: 'user', content: 'Ancien projet' }],
            error: null
        });

        const result = await resetUserProject('user-2');

        expect(rpc).toHaveBeenCalledWith('admin_reset_user_project', {
            p_session_token: 'sess-123',
            p_target_user_id: 'user-2'
        });
        expect(result.messages).toHaveLength(1);
    });
});
