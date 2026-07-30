# OpenRouter Model Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Utiliser Haiku 4.5 pour les résumés et Sonnet 4.6 pour l’entretien et la spécification finale.

**Architecture:** Le client transmet un type de tâche fermé.
Une fonction pure côté Supabase résout le modèle et le plafond autorisés.
L’Edge Function ignore toute sélection de modèle libre venant du client.

**Tech Stack:** React 18, Vitest 4, Supabase Edge Functions, TypeScript, Bun.

## Global Constraints

Les résumés utilisent `anthropic/claude-haiku-4.5`.
L’entretien et la spécification utilisent `anthropic/claude-sonnet-4.6`.
Une requête sans tâche utilise `interview` pour la compatibilité de déploiement.
Une tâche inconnue renvoie HTTP 400 avant tout appel OpenRouter.
Le client ne peut jamais fournir directement un modèle.

---

### Task 1: Résolution serveur du modèle

**Files:**
- Create: `supabase/functions/openrouter/modelRouting.ts`
- Create: `src/__tests__/openRouterModelRouting.test.js`

**Interfaces:**
- Consumes: une valeur `task` inconnue.
- Produces: `resolveModelRoute(task)` qui renvoie `{ task, model, maxTokensCap }` ou `null`.

- [ ] **Step 1: Write the failing test**

```js
import { resolveModelRoute } from '../../supabase/functions/openrouter/modelRouting.ts';

expect(resolveModelRoute('summary')).toEqual({
    task: 'summary',
    model: 'anthropic/claude-haiku-4.5',
    maxTokensCap: 256
});
expect(resolveModelRoute('interview').model).toBe('anthropic/claude-sonnet-4.6');
expect(resolveModelRoute(undefined).task).toBe('interview');
expect(resolveModelRoute('other')).toBeNull();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/__tests__/openRouterModelRouting.test.js`
Expected: FAIL car `modelRouting.ts` n’existe pas.

- [ ] **Step 3: Write minimal implementation**

```ts
const ROUTES = {
  summary: {
    task: "summary",
    model: "anthropic/claude-haiku-4.5",
    maxTokensCap: 256,
  },
  interview: {
    task: "interview",
    model: "anthropic/claude-sonnet-4.6",
    maxTokensCap: 8192,
  },
} as const;

export function resolveModelRoute(task: unknown) {
  if (task === undefined) return ROUTES.interview;
  if (task === "summary" || task === "interview") return ROUTES[task];
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/__tests__/openRouterModelRouting.test.js`
Expected: PASS.

### Task 2: Contrats clients explicites

**Files:**
- Modify: `src/services/apiService.js`
- Modify: `src/services/summaryService.js`
- Modify: `src/__tests__/apiService.test.js`
- Create: `src/__tests__/summaryService.test.js`

**Interfaces:**
- Consumes: les messages actuels.
- Produces: `task: "interview"` depuis `apiService` et `task: "summary"` depuis `summaryService`.

- [ ] **Step 1: Write the failing client tests**

```js
expect(JSON.parse(fetch.mock.calls[0][1].body).task).toBe('interview');
expect(JSON.parse(fetch.mock.calls[0][1].body).task).toBe('summary');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/__tests__/apiService.test.js src/__tests__/summaryService.test.js`
Expected: FAIL car les corps ne contiennent pas encore `task`.

- [ ] **Step 3: Add the minimal request fields**

```js
body: JSON.stringify({
    task: 'interview',
    messages,
    maxTokens: API_CONFIG.MAX_TOKENS,
})
```

```js
body: JSON.stringify({
    task: 'summary',
    maxTokens: 50,
    messages,
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/__tests__/apiService.test.js src/__tests__/summaryService.test.js`
Expected: PASS.

### Task 3: Intégration Edge Function et livraison

**Files:**
- Modify: `supabase/functions/openrouter/index.ts`
- Modify: `AGENTS.md`
- Modify: `DEPLOYMENT-TODO.md`

**Interfaces:**
- Consumes: `task`, `messages` et `maxTokens`.
- Produces: un appel OpenRouter avec le modèle et le plafond résolus côté serveur.

- [ ] **Step 1: Integrate the resolver**

```ts
const route = resolveModelRoute(payload.task);
if (!route) {
  return jsonResponse({ error: { message: "Type de tâche invalide" } }, 400);
}
const cap = Math.min(requestedMaxTokens, route.maxTokensCap);
const body = JSON.stringify({
  model: route.model,
  max_tokens: cap,
  messages,
});
```

- [ ] **Step 2: Run complete local verification**

Run: `bun run test && bun run lint && bun run build:ci`
Expected: 0 test failure, 0 lint warning, build exit 0.

- [ ] **Step 3: Deploy the Edge Function**

Run: `supabase functions deploy openrouter --project-ref xsmtfilcpmubfpraykwb --use-api`
Expected: deployment success with `verify_jwt=false` read from `supabase/config.toml`.

- [ ] **Step 4: Verify production routing**

Invoke the production proxy through a valid application session for `summary` and `interview`.
Expected: HTTP 200 for both calls.
Confirm in OpenRouter activity that the dedicated key used Haiku 4.5 and Sonnet 4.6.

- [ ] **Step 5: Commit and deliver**

Stage every changed path explicitly.
Push `codex/route-openrouter-models`, create a ready PR, wait for CI, merge into `main`, then verify `https://spec.inforeole.fr`.
