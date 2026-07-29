import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20260729194159_secure_session_rpcs.sql'
);
const migration = readFileSync(migrationPath, 'utf8');

describe('migration des RPC de session sécurisées', () => {
    it('déduit le propriétaire depuis un token non expiré', () => {
        expect(migration).toContain('resolve_specrefiner_session_user');
        expect(migration).toContain('t.token = p_session_token');
        expect(migration).toContain('t.expires_at > now()');
        expect(migration).toContain("RAISE EXCEPTION 'Unauthorized'");
    });

    it('n’accepte aucun user_id dans les signatures v2', () => {
        const v2Definitions = migration.match(
            /CREATE OR REPLACE FUNCTION public\.(?:load|save|clear)_user_session_v2[\s\S]*?\$\$;/g
        );

        expect(v2Definitions).toHaveLength(3);
        for (const definition of v2Definitions) {
            const signature = definition.slice(0, definition.indexOf('RETURNS'));
            expect(signature).not.toContain('p_user_id');
            expect(signature).toContain('p_session_token uuid');
        }
    });

    it('fixe le search_path de chaque fonction SECURITY DEFINER', () => {
        const definerFunctionCount = migration.match(/SECURITY DEFINER/g)?.length ?? 0;
        const fixedSearchPathCount = migration.match(/SET search_path = ''/g)?.length ?? 0;

        expect(definerFunctionCount).toBe(4);
        expect(fixedSearchPathCount).toBe(definerFunctionCount);
    });

    it('expose les RPC v2 au rôle anon et garde le helper interne', () => {
        expect(migration).toContain(
            'GRANT EXECUTE ON FUNCTION public.load_user_session_v2(uuid) TO anon'
        );
        expect(migration).toContain(
            'GRANT EXECUTE ON FUNCTION public.clear_user_session_v2(uuid) TO anon'
        );
        expect(migration).toContain(
            'REVOKE ALL ON FUNCTION public.resolve_specrefiner_session_user(uuid) FROM anon'
        );
    });

    it('révoque la création directe de comptes', () => {
        expect(migration).toContain(
            'REVOKE ALL ON FUNCTION public.create_user(text, text) FROM PUBLIC'
        );
        expect(migration).toContain(
            'REVOKE ALL ON FUNCTION public.create_user(text, text) FROM anon'
        );
        expect(migration).toContain(
            'REVOKE ALL ON FUNCTION public.create_user(text, text) FROM authenticated'
        );
    });
});
