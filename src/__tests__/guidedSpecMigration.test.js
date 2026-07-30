import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
    path.resolve('supabase/migrations/20260730180000_guided_spec_versions.sql'),
    'utf8'
);

describe('guided spec migration', () => {
    it('creates immutable versions and limits them transactionally to six', () => {
        expect(migration).toContain('CREATE TABLE public.specrefiner_spec_versions');
        expect(migration).toContain('UNIQUE (user_id, request_id)');
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_spec_version');
        expect(migration).toMatch(/OFFSET 6[\s\S]*DELETE FROM public\.specrefiner_spec_versions/);
    });

    it('removes the client reset capability', () => {
        expect(migration).toContain(
            'REVOKE EXECUTE ON FUNCTION public.clear_user_session_v2(uuid) FROM anon'
        );
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.admin_reset_user_project');
    });

    it('derives every user from an authenticated token', () => {
        expect(migration).toContain(
            'public.resolve_specrefiner_session_user(p_session_token)'
        );
        expect(migration).toContain('public.assert_session_admin(p_session_token)');
    });

    it('keeps the guided model in v3 session RPCs', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.load_user_session_v3');
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.save_user_session_v3');
        expect(migration).toContain('spec_model jsonb');
    });

    it('identifies admin accounts so their projects cannot be reset from the list', () => {
        expect(migration).toContain('CREATE FUNCTION public.admin_list_users');
        expect(migration).toMatch(/RETURNS TABLE\([\s\S]*is_admin boolean/);
    });
});
