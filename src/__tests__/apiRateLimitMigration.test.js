import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
    join(
        process.cwd(),
        'supabase/migrations/20260729201527_fix_api_rate_limit_conflict.sql'
    ),
    'utf8'
);

describe('migration de correction du rate limiter', () => {
    it('cible la contrainte primaire sans ambiguïté avec le paramètre de sortie', () => {
        expect(migration).toContain(
            'ON CONFLICT ON CONSTRAINT specrefiner_api_rate_limits_pkey'
        );
        expect(migration).not.toContain('ON CONFLICT (user_id, endpoint)');
    });

    it('durcit le search_path et qualifie les objets publics', () => {
        expect(migration).toContain("SET search_path = ''");
        expect(migration).toContain('public.specrefiner_auth_tokens');
        expect(migration).toContain('public.specrefiner_api_rate_limits');
    });
});
