# TODO — Déploiement du proxy sécurité (fin de la fuite de clés API)

> Statut au **2026-07-01** : fix **codé, testé, commité** (`1aa5758`) mais **PAS déployé**.
> En prod, l'app tourne encore avec l'ancien bundle (clé OpenRouter révoquée) → l'IA
> est HS jusqu'au déploiement. Reprendre ici quand l'appli redevient nécessaire.

## Contexte
Les clés `VITE_OPENROUTER_API_KEY` et `VITE_INWORLD_API_KEY` étaient injectées en
clair dans le bundle front (préfixe `VITE_` → publiques). Une clé OpenRouter a été
exfiltrée et pillée (Claude Opus 4.8 + tool_calls + contextes ~400k tokens) le
2026-07-01. Clé OpenRouter **révoquée** par Phil le même jour.

## Fait (commit `1aa5758`)
- `supabase/functions/openrouter/` (chat + résumés) et `supabase/functions/inworld/`
  (TTS) : Edge Functions qui détiennent les clés côté serveur. **Modèle et
  max_tokens imposés serveur** → une session volée ne peut plus lancer d'Opus ni
  de gros contextes.
- `supabase/migrations/002_api_proxy_auth.sql` : table `specrefiner_auth_tokens`,
  `login_user_secure` émet un token de session, `verify_session_token`
  (service_role) le valide dans les functions, `logout_session` l'invalide.
- Front réécrit : `src/lib/apiClient.js` (URL + en-têtes authentifiés),
  `apiService`/`summaryService`/`ttsService` sans clé, `userService`+`useAuth`
  gèrent le token, `constants` nettoyé (plus de MODEL/URL/TTS_CONFIG côté client).
- Test `apiService` réécrit (vert), lint vert, zéro régression.

## Prérequis (Phil)
1. **Créer une nouvelle clé OpenRouter** (l'ancienne est révoquée) et la mettre
   dans **Infisical**, projet `spec-refiner`, sous le nom `OPENROUTER_API_KEY`
   (**sans** préfixe `VITE_`).
2. La clé Inworld existe déjà dans Infisical (`VITE_INWORLD_API_KEY`) → réutilisée
   comme secret serveur `INWORLD_API_KEY`.

## Étapes de déploiement (dans l'ordre)
Depuis `~/dv/spec-refiner`, faire `eval "$(fnm env)"` d'abord. CLI Supabase 2.98.2 présent.

1. **Link** (si pas déjà fait) : `supabase link --project-ref xsmtfilcpmubfpraykwb`
2. **Migration DDL** (accès postgres requis, la clé anon ne suffit pas) :
   appliquer `supabase/migrations/002_api_proxy_auth.sql` (SQL Editor du
   dashboard, ou `supabase db push`).
   > Note : une migration `003_admin_via_session.sql` (auth admin par token de
   > session, construite **sur** la 002) est développée dans une session
   > parallèle. Si elle est présente au déploiement, l'appliquer aussi.
3. **Secrets des functions** (valeurs depuis Infisical, jamais en clair sur disque) :
   `supabase secrets set OPENROUTER_API_KEY=<...> INWORLD_API_KEY=<...>`
4. **Deploy** : `supabase functions deploy openrouter inworld`
5. **Retirer les clés du front** :
   - Infisical (env `dev`) : supprimer `VITE_OPENROUTER_API_KEY`, `VITE_INWORLD_API_KEY`
   - Vercel (prod) : supprimer les mêmes variables
   - Conserver `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (publiques par design, protégées par RLS)
6. **Redeploy front** Vercel (nouveau bundle sans clés).
7. **Test e2e en prod** : login (compte réel) → 1 échange d'interview (vérifie
   l'appel `…/functions/v1/openrouter`) → lecture TTS (vérifie
   `…/functions/v1/inworld`) → génération de spec.

## Vérifs de sécurité post-déploiement
- Bundle prod (Network / view-source) : **plus aucune** clé OpenRouter ou Inworld.
- Appel du proxy **sans** `X-Session-Token` valide → **401**.
- Logs OpenRouter : uniquement `anthropic/claude-sonnet-4`, jamais d'Opus.

## Dette de sécu séparée (hors de ce fix)
`VITE_APP_PASSWORD` et `VITE_ADMIN_TOKEN` sont **aussi** exposés dans le bundle
(auth « maison » faible). À renforcer plus tard : ne pas exposer l'admin token
côté client, envisager une vraie auth. Non traité ici.
