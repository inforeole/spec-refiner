# Spec Refiner

Application française d'entretien guidé qui transforme une idée de projet en cahier des charges structuré.

## Prérequis

- Bun 1.3.14.
- Accès au projet Infisical `spec-refiner` pour le développement local.
- Un projet Supabase avec les migrations du dossier `supabase/migrations/`.

## Installation

```bash
bun install --frozen-lockfile
bun run dev
```

`bun run dev` injecte la configuration locale avec Infisical.

Aucun fichier `.env` contenant des secrets ne doit être commité.

## Configuration

Le navigateur reçoit uniquement les deux valeurs publiques nécessaires au client Supabase:

```env
VITE_SUPABASE_URL=https://<projet>.supabase.co
VITE_SUPABASE_ANON_KEY=<clé-anon-publique>
```

Les clés OpenRouter et Inworld restent dans les secrets serveur des Edge Functions Supabase.

Aucun mot de passe applicatif ou token administrateur ne doit utiliser le préfixe `VITE_`.

## Validation

```bash
bun run lint
bun run test
bun run build:ci
```

GitHub Actions exécute ces contrôles sur chaque pull request et chaque push vers `main`.

## Déploiement

Le déploiement de sécurité suit cet ordre:

1. Appliquer les migrations Supabase dans l'ordre.
2. Déployer les Edge Functions nécessaires.
3. Déployer le client Vite.
4. Vérifier les parcours de connexion, session, entretien, génération et réinitialisation.

La migration `20260729194159_secure_session_rpcs.sql` doit être appliquée avant le client qui appelle les RPC de session v2.
La migration `20260729201527_fix_api_rate_limit_conflict.sql` corrige le rate limiter des proxies IA et doit être appliquée après celle-ci.

Les anciennes RPC de session doivent être révoquées dans une migration séparée seulement après validation du client v2 en production.

La procédure détaillée et les contraintes de production vivent dans `AGENTS.md` et `DEPLOYMENT-TODO.md`.
