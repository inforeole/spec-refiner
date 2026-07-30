# Guided Single Spec Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transformer l’entretien libre en une spécification métier guidée, bornée et traçable, avec un projet unique et six versions horodatées.

**Architecture:** Le travail est livré en deux incréments testables.
Le premier incrément sécurise le projet unique, la persistance transactionnelle des versions et leur téléchargement horodaté.
Le second incrément ajoute un modèle fonctionnel structuré alimenté par les sorties JSON Schema de Sonnet 4.6, puis affiche une progression qualitative dans le bandeau détaillé validé.

**Tech Stack:** React 18, Vite 5, Vitest, Supabase PostgreSQL, RPC `SECURITY DEFINER`, Supabase Edge Functions, OpenRouter, Claude Sonnet 4.6, Tailwind CSS et `docx`.

## Global Constraints

Un compte correspond à un seul projet.
Un projet correspond à un seul lot.
Un lot correspond à une seule spécification logique.
Les six versions les plus récentes sont conservées.
Les anciennes versions sont consultables et téléchargeables, mais elles ne sont pas restaurables.
Chaque version reçoit un `timestamptz` PostgreSQL immuable.
Le nom Word suit `specifications-YYYY-MM-DD-HHmm.docx` en heure de Paris.
Le client ne peut ni créer un autre projet, ni ouvrir un autre lot, ni réinitialiser sa session.
La progression utilise des thèmes et des décisions manquantes, jamais un pourcentage.
La variante visuelle retenue est le bandeau détaillé au-dessus de la conversation.
L’usage sur ordinateur est prioritaire et le mobile reste fonctionnel.
Le modèle interne accepte au maximum huit capacités et quarante exigences.
Une génération incomplète porte le libellé `Générer une version de travail`.
Une génération sans blocage porte le libellé `Générer la spec`.
Le CLI OpenSpec n’est pas intégré.
Le dossier Brice n’entre ni dans le produit, ni dans les fixtures, ni dans les tests.
Les migrations sont écrites et testées localement, mais ne sont pas appliquées en production sans validation distincte.
Chaque `fetch` externe conserve un délai maximal explicite.
Toutes les commandes utilisent Bun.

---

## File Map

### Domain model

- Create `src/domain/specModel.js` for the schema defaults, normalization and deterministic merge of AI updates.
- Create `src/domain/specReadiness.js` for limits, theme states, blocking decisions and generation labels.
- Test `src/__tests__/specModel.test.js`.
- Test `src/__tests__/specReadiness.test.js`.

### Database and RPCs

- Create `supabase/migrations/20260730180000_guided_spec_versions.sql`.
- Extend `src/__tests__/secureSessionMigration.test.js`.
- Create `src/__tests__/guidedSpecMigration.test.js`.

### Persistence

- Create `src/services/specVersionService.js`.
- Create `src/hooks/useSpecVersions.js`.
- Modify `src/services/sessionService.js` to use session RPCs v3 and persist `specModel`.
- Modify `src/hooks/useSession.js` to expose `specModel` and remove the client reset path.
- Test `src/__tests__/specVersionService.test.js`.
- Modify `src/__tests__/sessionService.test.js`.
- Modify `src/__tests__/useSession.test.js`.

### AI contracts

- Create `supabase/functions/openrouter/structuredOutputs.ts`.
- Modify `supabase/functions/openrouter/modelRouting.ts`.
- Modify `supabase/functions/openrouter/index.ts`.
- Modify `src/services/apiService.js`.
- Modify `src/prompts/systemPrompt.js`.
- Modify `src/hooks/useInterviewChat.js`.
- Modify `src/utils/responseValidation.js`.
- Modify `src/__tests__/openRouterModelRouting.test.js`.
- Modify `src/__tests__/apiService.test.js`.
- Modify `src/__tests__/useInterviewChat.test.js`.
- Modify `src/__tests__/responseValidation.test.js`.

### User interface

- Create `src/components/InterviewProgress.jsx`.
- Create `src/components/SpecVersionSelector.jsx`.
- Create `src/components/SingleProjectNotice.jsx`.
- Modify `src/components/InterviewPhase.jsx`.
- Modify `src/components/CompletePhase.jsx`.
- Modify `src/components/index.js`.
- Modify `src/components/ChatInput.jsx`.
- Modify `src/SpecRefiner.jsx`.
- Create `src/__tests__/InterviewProgress.test.jsx`.
- Create `src/__tests__/SpecVersionSelector.test.jsx`.
- Modify `src/__tests__/SpecRefiner.test.jsx`.

### Administration

- Modify `src/services/userService.js`.
- Modify `src/components/AdminPage.jsx`.
- Modify `src/__tests__/userService.admin.test.js`.
- Create `src/__tests__/AdminPage.test.jsx`.

### Export and documentation

- Create `src/utils/specVersionFormat.js`.
- Modify `src/utils/wordExport.js`.
- Modify `src/__tests__/wordExport.test.js`.
- Modify `AGENTS.md`.

---

## Increment 1: One project and six immutable versions

### Task 1: Add the transactional version store

**Files:**

- Create: `supabase/migrations/20260730180000_guided_spec_versions.sql`
- Create: `src/__tests__/guidedSpecMigration.test.js`
- Modify: `src/__tests__/secureSessionMigration.test.js`

**Interfaces:**

- Produces: `load_user_session_v3(uuid)`.
- Produces: `save_user_session_v3(uuid, jsonb, text, integer, text, boolean, integer, jsonb)`.
- Produces: `create_spec_version(uuid, uuid, text, integer)`.
- Produces: `list_spec_versions(uuid)`.
- Produces: `admin_reset_user_project(uuid, uuid)`.
- Revokes: client execution of `clear_user_session_v2(uuid)`.

- [ ] **Step 1: Write the failing migration contract tests**

```js
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
});
```

- [ ] **Step 2: Run the migration test and verify the missing file failure**

Run: `bun run test -- src/__tests__/guidedSpecMigration.test.js`

Expected: FAIL because `20260730180000_guided_spec_versions.sql` does not exist.

- [ ] **Step 3: Write the migration**

The migration must implement this table shape.

```sql
ALTER TABLE public.specrefiner_sessions
    ADD COLUMN IF NOT EXISTS spec_model jsonb NOT NULL
    DEFAULT '{"schemaVersion":1}'::jsonb;

CREATE TABLE public.specrefiner_spec_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.specrefiner_users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    content text NOT NULL CHECK (length(btrim(content)) > 0),
    source_message_count integer NOT NULL CHECK (source_message_count >= 0),
    generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (user_id, request_id)
);

CREATE INDEX specrefiner_spec_versions_user_generated_idx
ON public.specrefiner_spec_versions(user_id, generated_at DESC, id DESC);

ALTER TABLE public.specrefiner_spec_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.specrefiner_spec_versions FROM PUBLIC, anon, authenticated;
```

`create_spec_version` must resolve the owner from `p_session_token`.
It must return an existing row when `(user_id, request_id)` already exists.
It must insert the version, update `specrefiner_sessions.final_spec`, and delete rows ranked after the first six.
All operations must execute in the same PostgreSQL transaction provided by the function call.
`list_spec_versions` must return at most six rows ordered by `generated_at DESC, id DESC`.
`admin_reset_user_project` must return the old `messages` JSONB before deleting the session and versions.
`load_user_session_v3` and `save_user_session_v3` must preserve the v2 fields and add `spec_model`.
Existing non-empty `final_spec` values must be inserted once with a deterministic migration `request_id` derived from `user_id`.

- [ ] **Step 4: Run the migration contract tests**

Run: `bun run test -- src/__tests__/guidedSpecMigration.test.js src/__tests__/secureSessionMigration.test.js`

Expected: PASS.

- [ ] **Step 5: Check SQL formatting and forbidden grants**

Run: `rg -n "GRANT .*specrefiner_spec_versions|clear_user_session_v2" supabase/migrations/20260730180000_guided_spec_versions.sql`

Expected: no direct table grant and no `GRANT EXECUTE` for `clear_user_session_v2`.

- [ ] **Step 6: Commit the migration**

```bash
git add supabase/migrations/20260730180000_guided_spec_versions.sql src/__tests__/guidedSpecMigration.test.js src/__tests__/secureSessionMigration.test.js
git commit -m "feat(data): versionner les spécifications"
```

### Task 2: Add session v3 and version services

**Files:**

- Create: `src/services/specVersionService.js`
- Create: `src/hooks/useSpecVersions.js`
- Create: `src/__tests__/specVersionService.test.js`
- Modify: `src/services/sessionService.js`
- Modify: `src/hooks/useSession.js`
- Modify: `src/__tests__/sessionService.test.js`
- Modify: `src/__tests__/useSession.test.js`

**Interfaces:**

- Consumes: `load_user_session_v3`, `save_user_session_v3`, `create_spec_version` and `list_spec_versions`.
- Produces: `listSpecVersions(sessionToken)`.
- Produces: `createSpecVersion(sessionToken, { requestId, content, sourceMessageCount })`.
- Produces: `useSpecVersions(sessionToken)` with `{ versions, selectedVersion, selectVersion, createVersion, refreshVersions, isLoading, error }`.
- Produces: `useSession(...).specModel`.

- [ ] **Step 1: Write failing service tests**

```js
it('creates a version with an idempotency key and source count', async () => {
    rpcMock.mockResolvedValue({
        data: [{
            id: 'version-1',
            content: '# Cahier des charges',
            generated_at: '2026-07-30T13:42:00Z'
        }],
        error: null
    });

    await createSpecVersion('session-token', {
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
});

it('loads at most six immutable versions', async () => {
    rpcMock.mockResolvedValue({ data: Array.from({ length: 6 }, (_, index) => ({
        id: `version-${index}`,
        content: `# Version ${index}`,
        generated_at: `2026-07-3${index}T10:00:00Z`
    })), error: null });

    const result = await listSpecVersions('session-token');

    expect(result.versions).toHaveLength(6);
});
```

- [ ] **Step 2: Run tests and verify missing exports**

Run: `bun run test -- src/__tests__/specVersionService.test.js src/__tests__/sessionService.test.js`

Expected: FAIL because the new service and v3 RPC names are absent.

- [ ] **Step 3: Implement `specVersionService`**

```js
export async function createSpecVersion(sessionToken, {
    requestId,
    content,
    sourceMessageCount
}) {
    const { data, error } = await rpcWithTimeout('create_spec_version', {
        p_session_token: sessionToken,
        p_request_id: requestId,
        p_content: content,
        p_source_message_count: sourceMessageCount
    });

    if (error) {
        return { version: null, error: error.message };
    }

    return { version: data?.[0] ?? data ?? null, error: null };
}
```

Share the existing timeout helper by exporting `rpcWithTimeout` from `sessionService.js` or moving it to `src/services/supabaseRpc.js`.
Prefer the focused `supabaseRpc.js` extraction if both session and version services need the helper.

- [ ] **Step 4: Switch session persistence to v3**

`loadSession` must call `load_user_session_v3`.
`saveSession` must call `save_user_session_v3`.
Both functions must map `spec_model` to `specModel`.
The initial session must use `createEmptySpecModel()` rather than an untyped object.
Remove the `resetSession` callback from `useSession`.
Remove the unused `clearSession` export from `sessionService.js`.

- [ ] **Step 5: Implement `useSpecVersions`**

The hook must select the newest version after load or creation.
Selecting an old version must not alter the current session.
`createVersion` must call `crypto.randomUUID()` once and reuse that value for any retry of the same user action.

- [ ] **Step 6: Run focused tests**

Run: `bun run test -- src/__tests__/specVersionService.test.js src/__tests__/sessionService.test.js src/__tests__/useSession.test.js`

Expected: PASS.

- [ ] **Step 7: Commit persistence**

```bash
git add src/services/supabaseRpc.js src/services/specVersionService.js src/hooks/useSpecVersions.js src/services/sessionService.js src/hooks/useSession.js src/__tests__/specVersionService.test.js src/__tests__/sessionService.test.js src/__tests__/useSession.test.js
git commit -m "feat(spec): persister six versions immuables"
```

### Task 3: Add stable timestamp formatting and Word exports

**Files:**

- Create: `src/utils/specVersionFormat.js`
- Modify: `src/utils/wordExport.js`
- Modify: `src/__tests__/wordExport.test.js`

**Interfaces:**

- Produces: `formatSpecTimestamp(isoTimestamp)`.
- Produces: `buildSpecFilename(isoTimestamp)`.
- Changes: `downloadAsWord(markdownContent, filename, generatedAt)`.

- [ ] **Step 1: Write failing timestamp tests**

```js
it('formats the stored instant in Europe Paris', () => {
    expect(formatSpecTimestamp('2026-07-30T13:42:00Z')).toEqual({
        date: '30 juillet 2026',
        time: '15:42',
        label: '30 juillet 2026 à 15:42'
    });
});

it('builds the filename from the stored generation instant', () => {
    expect(buildSpecFilename('2026-07-30T13:42:00Z'))
        .toBe('specifications-2026-07-30-1542.docx');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun run test -- src/__tests__/wordExport.test.js`

Expected: FAIL because `formatSpecTimestamp` and `buildSpecFilename` do not exist.

- [ ] **Step 3: Implement deterministic formatting**

Use `Intl.DateTimeFormat` with `timeZone: 'Europe/Paris'`.
Use `formatToParts` for the filename instead of parsing a localized string.
Pass the stored timestamp into the Word document.
Remove all `new Date()` calls that claim to represent generation time.

- [ ] **Step 4: Verify Word content**

Extend the existing ZIP inspection test to assert the stored text `Généré le 30 juillet 2026 à 15:42`.
Assert that two downloads of the same version use the same filename.

- [ ] **Step 5: Run focused tests**

Run: `bun run test -- src/__tests__/wordExport.test.js`

Expected: PASS.

- [ ] **Step 6: Commit export formatting**

```bash
git add src/utils/specVersionFormat.js src/utils/wordExport.js src/__tests__/wordExport.test.js
git commit -m "feat(export): horodater les versions Word"
```

### Task 4: Implement the version history and remove client reset

**Files:**

- Create: `src/components/SpecVersionSelector.jsx`
- Create: `src/components/SingleProjectNotice.jsx`
- Create: `src/__tests__/SpecVersionSelector.test.jsx`
- Modify: `src/components/CompletePhase.jsx`
- Modify: `src/components/InterviewPhase.jsx`
- Modify: `src/components/index.js`
- Modify: `src/SpecRefiner.jsx`
- Modify: `src/__tests__/SpecRefiner.test.jsx`

**Interfaces:**

- Consumes: `useSpecVersions(sessionToken)`.
- Consumes: `formatSpecTimestamp`.
- Produces: `SpecVersionSelector({ versions, selectedVersionId, onSelect })`.
- Produces: `SingleProjectNotice()`.

- [ ] **Step 1: Write failing interface tests**

```jsx
it('shows six timestamped versions without restore action', () => {
    render(
        <SpecVersionSelector
            versions={versions}
            selectedVersionId="version-2"
            onSelect={vi.fn()}
        />
    );

    expect(screen.getAllByRole('option')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /restaurer/i })).toBeNull();
});

it('replaces reset with the single project notice', () => {
    render(<SingleProjectNotice />);

    expect(screen.getByText(/associé à un seul projet/i)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
});
```

- [ ] **Step 2: Run tests and verify missing components**

Run: `bun run test -- src/__tests__/SpecVersionSelector.test.jsx src/__tests__/SpecRefiner.test.jsx`

Expected: FAIL because the components do not exist and reset is still exposed.

- [ ] **Step 3: Implement version selection**

Use a native `<select>` with the latest option marked `actuelle`.
Show `Version archivée en lecture seule` when the selected ID is not the latest ID.
Bind the document content and Word download to the selected version object.
Keep `Apporter des modifications` available only when the current version is selected.

- [ ] **Step 4: Remove the reset path**

Remove `resetWithConfirmation`, `reset`, `resetSession` and every `onReset` prop from client components.
Render `SingleProjectNotice` in the interview and complete footers.
Use this exact text.

```text
Votre compte est associé à un seul projet.
Vous pouvez continuer à le compléter ou modifier ses spécifications.
Pour changer de projet ou repartir de zéro, envoyez un message à Phil.
```

- [ ] **Step 5: Run focused tests**

Run: `bun run test -- src/__tests__/SpecVersionSelector.test.jsx src/__tests__/SpecRefiner.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit the client UI**

```bash
git add src/components/SpecVersionSelector.jsx src/components/SingleProjectNotice.jsx src/components/CompletePhase.jsx src/components/InterviewPhase.jsx src/components/index.js src/SpecRefiner.jsx src/__tests__/SpecVersionSelector.test.jsx src/__tests__/SpecRefiner.test.jsx
git commit -m "feat(ui): afficher l’historique de la spec"
```

## Increment 2: Guided OpenSpec-inspired interview

### Task 5: Add the structured functional model and readiness rules

**Files:**

- Create: `src/domain/specModel.js`
- Create: `src/domain/specReadiness.js`
- Create: `src/__tests__/specModel.test.js`
- Create: `src/__tests__/specReadiness.test.js`

**Interfaces:**

- Produces: `SPEC_MODEL_SCHEMA_VERSION`.
- Produces: `createEmptySpecModel()`.
- Produces: `normalizeSpecModel(input)`.
- Produces: `applySpecUpdates(model, updates)`.
- Produces: `evaluateSpecReadiness(model)`.

- [ ] **Step 1: Write failing reducer tests**

```js
it('merges updates by stable identifier without duplicating records', () => {
    const initial = createEmptySpecModel();
    const first = applySpecUpdates(initial, {
        capabilities: [{
            id: 'auth',
            name: 'Authentification',
            priority: 'required',
            sourceIds: ['message-2']
        }]
    });
    const second = applySpecUpdates(first, {
        capabilities: [{
            id: 'auth',
            name: 'Connexion utilisateur',
            priority: 'required',
            sourceIds: ['message-2', 'message-5']
        }]
    });

    expect(second.capabilities).toHaveLength(1);
    expect(second.capabilities[0].name).toBe('Connexion utilisateur');
    expect(second.capabilities[0].sourceIds).toEqual(['message-2', 'message-5']);
});

it('rejects updates above product limits', () => {
    const updates = {
        capabilities: Array.from({ length: 9 }, (_, index) => ({
            id: `capability-${index}`,
            name: `Capability ${index}`,
            priority: 'required',
            sourceIds: []
        }))
    };

    expect(() => applySpecUpdates(createEmptySpecModel(), updates))
        .toThrow('Le lot dépasse 8 capacités');
});
```

- [ ] **Step 2: Write failing readiness tests**

```js
it('uses qualitative status and never returns a percentage', () => {
    const readiness = evaluateSpecReadiness(createEmptySpecModel());

    expect(readiness).toEqual(expect.objectContaining({
        generationKind: 'working',
        label: 'Générer une version de travail'
    }));
    expect(readiness).not.toHaveProperty('percentage');
});

it('blocks ready status when a confirmed requirement has no scenario', () => {
    const model = createEmptySpecModel();
    model.requirements.push({
        id: 'REQ-001',
        capabilityId: 'auth',
        title: 'Connexion',
        description: 'Un utilisateur se connecte',
        priority: 'required',
        status: 'confirmed',
        acceptanceCriteria: [],
        scenarios: [],
        sourceIds: ['message-3']
    });

    expect(evaluateSpecReadiness(model).blockingReasons)
        .toContain('REQ-001 ne possède aucun scénario');
});
```

- [ ] **Step 3: Run tests and verify missing modules**

Run: `bun run test -- src/__tests__/specModel.test.js src/__tests__/specReadiness.test.js`

Expected: FAIL because the domain modules do not exist.

- [ ] **Step 4: Implement the model**

The state must contain these top-level keys.

```js
export function createEmptySpecModel() {
    return {
        schemaVersion: 1,
        intent: {
            problem: null,
            targetUsers: [],
            expectedOutcome: null,
            successIndicators: []
        },
        scope: {
            lotName: null,
            included: [],
            excluded: []
        },
        capabilities: [],
        requirements: [],
        decisions: [],
        themes: [
            { id: 'scope', label: 'Périmètre', status: 'to_explore', missingDecisionIds: [] },
            { id: 'users', label: 'Utilisateurs', status: 'to_explore', missingDecisionIds: [] },
            { id: 'journey', label: 'Parcours principal', status: 'to_explore', missingDecisionIds: [] },
            { id: 'rules', label: 'Règles métier', status: 'to_explore', missingDecisionIds: [] },
            { id: 'data', label: 'Données', status: 'to_explore', missingDecisionIds: [] },
            { id: 'edge-cases', label: 'Cas particuliers', status: 'to_explore', missingDecisionIds: [] },
            { id: 'dependencies', label: 'Dépendances externes', status: 'to_explore', missingDecisionIds: [] }
        ]
    };
}
```

Allowed decision statuses are `confirmed`, `hypothesis`, `unknown` and `contradiction`.
Allowed theme statuses are `to_explore`, `incomplete`, `complete` and `blocked`.
The reducer must deduplicate `sourceIds`.
The reducer must preserve records omitted from an update.
The reducer must reject more than eight capabilities or forty requirements.

- [ ] **Step 5: Implement readiness**

`ready` requires every theme to be `complete`.
`ready` requires no blocking decision with status `unknown` or `contradiction`.
Every required confirmed requirement must have at least one scenario and one acceptance criterion.
The return value must include `themes`, `missingDecisionCount`, `blockingReasons`, `generationKind` and `label`.
It must not include any percentage.

- [ ] **Step 6: Run focused tests**

Run: `bun run test -- src/__tests__/specModel.test.js src/__tests__/specReadiness.test.js`

Expected: PASS.

- [ ] **Step 7: Commit the domain**

```bash
git add src/domain/specModel.js src/domain/specReadiness.js src/__tests__/specModel.test.js src/__tests__/specReadiness.test.js
git commit -m "feat(spec): structurer le cadrage fonctionnel"
```

### Task 6: Enforce structured OpenRouter outputs

**Files:**

- Create: `supabase/functions/openrouter/structuredOutputs.ts`
- Modify: `supabase/functions/openrouter/modelRouting.ts`
- Modify: `supabase/functions/openrouter/index.ts`
- Modify: `src/services/apiService.js`
- Modify: `src/utils/responseValidation.js`
- Modify: `src/__tests__/openRouterModelRouting.test.js`
- Modify: `src/__tests__/apiService.test.js`
- Modify: `src/__tests__/responseValidation.test.js`

**Interfaces:**

- Produces: task `interview` returning `{ assistantMessage, updates }`.
- Produces: task `spec` returning `{ markdown }`.
- Produces: `getStructuredResponseFormat(task)`.
- Changes: `callOpenRouterAPI({ messages, task, signal })`.

- [ ] **Step 1: Extend route tests**

```js
it('routes final specs through Sonnet with the document cap', () => {
    expect(resolveModelRoute('spec')).toEqual({
        task: 'spec',
        model: 'anthropic/claude-sonnet-4.6',
        maxTokensCap: 8192
    });
});
```

- [ ] **Step 2: Add structured output contract tests**

```js
it('requires strict JSON schema for interview updates', () => {
    const format = getStructuredResponseFormat('interview');

    expect(format.type).toBe('json_schema');
    expect(format.json_schema.strict).toBe(true);
    expect(format.json_schema.schema.required)
        .toEqual(['assistantMessage', 'updates']);
});

it('keeps summaries unstructured', () => {
    expect(getStructuredResponseFormat('summary')).toBeNull();
});
```

- [ ] **Step 3: Run tests and verify failure**

Run: `bun run test -- src/__tests__/openRouterModelRouting.test.js src/__tests__/responseValidation.test.js`

Expected: FAIL because task `spec` and structured response formats do not exist.

- [ ] **Step 4: Implement server-owned schemas**

The client must never submit an arbitrary schema.
`index.ts` must select the schema from `task`.
For `interview` and `spec`, the upstream body must include:

```ts
response_format: getStructuredResponseFormat(route.task),
provider: {
  require_parameters: true,
},
```

The interview schema must require `assistantMessage` and an `updates` object.
Every update collection must be an array and use `additionalProperties: false`.
The spec schema must require a non-empty `markdown` string.
Summary calls must omit `response_format` and `provider`.

- [ ] **Step 5: Parse responses by task**

`callOpenRouterAPI` must parse `choices[0].message.content` as JSON for `interview` and `spec`.
It must return the plain summary string for `summary`.
An invalid JSON payload must throw `Réponse structurée invalide`.
`callAPIWithRetry` must validate the parsed shape according to the task.

- [ ] **Step 6: Run focused tests**

Run: `bun run test -- src/__tests__/openRouterModelRouting.test.js src/__tests__/apiService.test.js src/__tests__/responseValidation.test.js`

Expected: PASS.

- [ ] **Step 7: Commit AI contracts**

```bash
git add supabase/functions/openrouter/structuredOutputs.ts supabase/functions/openrouter/modelRouting.ts supabase/functions/openrouter/index.ts src/services/apiService.js src/utils/responseValidation.js src/__tests__/openRouterModelRouting.test.js src/__tests__/apiService.test.js src/__tests__/responseValidation.test.js
git commit -m "feat(ai): imposer les sorties structurées"
```

### Task 7: Drive the interview and generation from the structured model

**Files:**

- Modify: `src/prompts/systemPrompt.js`
- Modify: `src/hooks/useInterviewChat.js`
- Modify: `src/hooks/useSession.js`
- Modify: `src/services/sessionService.js`
- Modify: `src/__tests__/useInterviewChat.test.js`
- Modify: `src/__tests__/useSession.test.js`

**Interfaces:**

- Consumes: `applySpecUpdates`.
- Consumes: `evaluateSpecReadiness`.
- Consumes: `createSpecVersion`.
- Produces: `updateSpecModel(updater)` from `useSession`.
- Produces: `requestFinalSpec()` that persists a version before showing completion.

- [ ] **Step 1: Write failing interview tests**

```js
it('merges structured updates and displays only the assistant message', async () => {
    callAPIWithRetry.mockResolvedValue({
        response: {
            assistantMessage: '[AUDIO]Parlons du périmètre.[/AUDIO]\\n\\nQuel est le résultat essentiel ?',
            updates: {
                capabilities: [{
                    id: 'passport',
                    name: 'Passeport',
                    priority: 'required',
                    sourceIds: ['message-2']
                }]
            }
        },
        isValid: true
    });

    await result.current.sendMessage('Créer un passeport');

    expect(mockSessionHook.updateSpecModel).toHaveBeenCalled();
    expect(mockSessionHook.messages.at(-1).content)
        .toContain('Quel est le résultat essentiel ?');
    expect(mockSessionHook.messages.at(-1).content)
        .not.toContain('capabilities');
});

it('does not show completion until the version is stored', async () => {
    createSpecVersion.mockResolvedValue({
        version: null,
        error: 'Erreur de sauvegarde'
    });

    await result.current.requestFinalSpec();

    expect(mockSessionHook.updatePhase).not.toHaveBeenCalledWith('complete');
    expect(result.current.errorMessage).toContain('Erreur de sauvegarde');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `bun run test -- src/__tests__/useInterviewChat.test.js src/__tests__/useSession.test.js`

Expected: FAIL because updates are not consumed and versions are not stored atomically.

- [ ] **Step 3: Update the system prompt**

Keep the client-facing tone and one-question rule.
Replace the free-form completeness logic with instructions tied to the seven themes.
Require explicit lot reduction above eight capabilities.
Require every important claim to reference the current message or attached document through a `sourceId`.
Require unknown information to remain `unknown`.
Prohibit technical architecture decisions unless the client explicitly supplied them.

- [ ] **Step 4: Merge updates after each successful interview response**

Use the message index as a stable `sourceId` such as `message-14`.
Call `updateSpecModel(previous => applySpecUpdates(previous, response.updates))`.
Persist the updated model through session v3.
Store only `assistantMessage` in the visible conversation.

- [ ] **Step 5: Generate and persist a version**

Call the API with `task: 'spec'`.
Include the normalized structured model and relevant conversation sources.
Validate `response.markdown`.
Call `createSpecVersion` with one `crypto.randomUUID()` request ID.
Only after RPC success may the hook update the current version, append the success message and switch to `complete`.
On RPC failure, keep the previous version and show a persistent error.

- [ ] **Step 6: Run focused tests**

Run: `bun run test -- src/__tests__/useInterviewChat.test.js src/__tests__/useSession.test.js`

Expected: PASS.

- [ ] **Step 7: Commit interview integration**

```bash
git add src/prompts/systemPrompt.js src/hooks/useInterviewChat.js src/hooks/useSession.js src/services/sessionService.js src/__tests__/useInterviewChat.test.js src/__tests__/useSession.test.js
git commit -m "feat(interview): guider le cadrage par thèmes"
```

### Task 8: Implement the validated detailed progress banner

**Files:**

- Create: `src/components/InterviewProgress.jsx`
- Create: `src/__tests__/InterviewProgress.test.jsx`
- Modify: `src/components/InterviewPhase.jsx`
- Modify: `src/components/ChatInput.jsx`
- Modify: `src/SpecRefiner.jsx`

**Interfaces:**

- Consumes: `evaluateSpecReadiness(specModel)`.
- Produces: `InterviewProgress({ themes, missingDecisionCount })`.
- Changes: generate button label from readiness.

- [ ] **Step 1: Write failing banner tests**

```jsx
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
});
```

- [ ] **Step 2: Run tests and verify missing component**

Run: `bun run test -- src/__tests__/InterviewProgress.test.jsx`

Expected: FAIL because `InterviewProgress` does not exist.

- [ ] **Step 3: Implement the selected variant**

Place the banner between the application header and `MessageList`.
Show one compact badge per theme.
Use emerald for `complete`, slate for `to_explore` and `incomplete`, and amber for `blocked`.
Do not use red for ordinary incompleteness.
Show `Aucune décision bloquante` when the missing count is zero.
Do not render a progress element, fraction or percentage.

- [ ] **Step 4: Replace exchange-count generation**

Remove `MIN_QUESTIONS_BEFORE_SPEC` from the UI decision.
The generation button remains available after the lot has a non-empty name or at least one capability.
Use readiness label `Générer une version de travail` or `Générer la spec`.
Keep the server-side validation authoritative.

- [ ] **Step 5: Run focused tests**

Run: `bun run test -- src/__tests__/InterviewProgress.test.jsx src/__tests__/SpecRefiner.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit the guided UI**

```bash
git add src/components/InterviewProgress.jsx src/components/InterviewPhase.jsx src/components/ChatInput.jsx src/SpecRefiner.jsx src/__tests__/InterviewProgress.test.jsx src/__tests__/SpecRefiner.test.jsx
git commit -m "feat(ui): afficher la progression qualitative"
```

### Task 9: Add the explicit admin reset

**Files:**

- Modify: `src/services/userService.js`
- Modify: `src/components/AdminPage.jsx`
- Modify: `src/__tests__/userService.admin.test.js`
- Create: `src/__tests__/AdminPage.test.jsx`

**Interfaces:**

- Consumes: `admin_reset_user_project`.
- Produces: `resetUserProject(userId)`.

- [ ] **Step 1: Write failing admin service test**

```js
it('resets only the named user through the admin RPC', async () => {
    rpcMock.mockResolvedValue({
        data: [{ messages: [] }],
        error: null
    });

    await resetUserProject('user-2');

    expect(rpcMock).toHaveBeenCalledWith('admin_reset_user_project', {
        p_session_token: 'admin-session',
        target_user_id: 'user-2'
    });
});
```

- [ ] **Step 2: Write failing confirmation test**

```jsx
it('requires the exact email before resetting a project', async () => {
    render(<AdminPage />);

    fireEvent.click(await screen.findByRole('button', {
        name: 'Réinitialiser le projet de client@example.com'
    }));

    expect(screen.getByText(/client@example.com/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réinitialiser définitivement' }))
        .toBeDisabled();
});
```

- [ ] **Step 3: Run tests and verify failure**

Run: `bun run test -- src/__tests__/userService.admin.test.js src/__tests__/AdminPage.test.jsx`

Expected: FAIL because reset service and UI do not exist.

- [ ] **Step 4: Implement reset with visible failures**

Add a reset button per non-admin user.
Open a confirmation dialog requiring the exact email.
Call `admin_reset_user_project`.
Extract old storage URLs from the returned messages and call `deleteImage`.
If a storage deletion fails after the database reset, show `Projet réinitialisé, mais certaines images n’ont pas pu être supprimées`.
Never hide this partial failure.

- [ ] **Step 5: Run focused tests**

Run: `bun run test -- src/__tests__/userService.admin.test.js src/__tests__/AdminPage.test.jsx src/__tests__/imageService.test.js`

Expected: PASS.

- [ ] **Step 6: Commit admin reset**

```bash
git add src/services/userService.js src/components/AdminPage.jsx src/__tests__/userService.admin.test.js src/__tests__/AdminPage.test.jsx
git commit -m "feat(admin): réinitialiser un projet client"
```

### Task 10: Document and verify the complete production path

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-07-30-guided-single-spec-design.md`
- Keep: `.lavish/spec-refiner-guided-ui.html` only if it is intentionally committed as the approved visual reference.

**Interfaces:**

- Verifies every interface produced by Tasks 1 through 9.

- [ ] **Step 1: Update project documentation**

Document the single-project rule.
Document `specrefiner_spec_versions`.
Document session RPCs v3 and the revoked client reset.
Document tasks `summary`, `interview` and `spec`.
Document the JSON Schema structured output contract.
Document that production migration and deployment still require explicit validation.

- [ ] **Step 2: Run static checks**

Run: `bun run lint`

Expected: exit code 0 with zero warnings.

- [ ] **Step 3: Run the complete test suite**

Run: `bun run test`

Expected: every Vitest test passes.

- [ ] **Step 4: Run the production build**

Run: `bun run build:ci`

Expected: Vite exits with code 0 and writes `dist/`.

- [ ] **Step 5: Start the application with real local configuration**

Run: `bun run dev`

Expected: Vite serves the application on its reported local URL.

- [ ] **Step 6: Exercise the production user path headlessly**

Use `dev-browser` in headless mode.
Log in with a dedicated test account.
Complete enough interview data to populate at least two themes.
Verify that the detailed banner shows theme states and no percentage.
Generate a version and record its stored timestamp.
Modify the interview and generate six additional versions.
Verify that exactly six versions remain and that the first version was purged.
Select an archived version and verify read-only state.
Download it and verify its filename matches its stored timestamp.
Verify the client has no reset control.

- [ ] **Step 7: Exercise the admin path headlessly**

Log in with a dedicated admin account.
Open `/admin`.
Reset the dedicated test client after typing its exact email.
Log back in as the client.
Verify that the project is empty and the account itself still exists.

- [ ] **Step 8: Verify no production mutation occurred**

Run: `git diff --check`

Expected: no whitespace errors.

Confirm that no migration deployment, Vercel deployment or production data mutation command was executed.

- [ ] **Step 9: Commit documentation and approved prototype**

```bash
git add AGENTS.md docs/superpowers/specs/2026-07-30-guided-single-spec-design.md docs/superpowers/plans/2026-07-30-guided-single-spec.md .lavish/spec-refiner-guided-ui.html
git commit -m "docs(spec): documenter le cadrage guidé"
```

- [ ] **Step 10: Final verification before integration**

Run: `git status --short`

Expected: no tracked modification remains.

Run: `git log --oneline origin/main..HEAD`

Expected: one coherent commit per completed task.
