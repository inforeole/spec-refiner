# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spec Refiner is a French-language AI-powered SaaS project specification tool. Users describe their project idea, then engage in a guided interview with Claude AI to refine requirements into a complete specification document.

## Règles Obligatoires

**Principes de code :**
- **DRY (Don't Repeat Yourself)** : Avant de coder, vérifier si du code existant peut être réutilisé ou factorisé
- **KISS** : Privilégier les solutions simples
- **Pas d'over-engineering** : Ne pas ajouter de fonctionnalités non demandées
- **Étude d'impact obligatoire** : Avant toute modification, analyser les dépendances et impacts potentiels pour éviter les régressions
- **Ne JAMAIS modifier du code qui fonctionne** sans demander explicitement à l'utilisateur

**Protection des données de production (CRITIQUE) :**
- **INTERDIT SANS VALIDATION EXPLICITE** : Toute requête SQL modifiant la BDD de prod (INSERT, UPDATE, DELETE)
- **INTERDIT SANS VALIDATION EXPLICITE** : Modifier ou supprimer des données utilisateur
- **INTERDIT** : Push force, delete branches sur main
- **INTERDIT** : Modifier les variables d'environnement de prod
- **INTERDIT** : Déployer sans validation explicite

**Commandes autorisées librement :**
- `npm run dev`, `npm run build`, `npm run lint`, `npm install`, `npm run preview`

**Git Workflow :**
- **Branche principale** : `main` (production)
- **Branche de travail** : `dev` (développement)
- **Toujours travailler sur `dev`**, jamais directement sur `main`
- Merger `dev` → `main` uniquement après validation utilisateur via PR

**Documentation :**
- **Après toute modification significative, TOUJOURS mettre à jour ce fichier CLAUDE.md**
- Documenter les nouvelles features, changements d'architecture, nouvelles dépendances

## Build & Development Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server (Vite, port 5173)
bun run build        # Production build to dist/
bun run lint         # ESLint (strict: --max-warnings 0)
bun run preview      # Preview production build
```

## Environment Setup

**Les secrets vivent dans Infisical** (self-hosted, `http://infisical.mesh:8080`), projet `spec-refiner` (workspaceId `398b111e-df73-4d9b-b41c-d92cb6fd7f7f`, env `dev`).
**Aucun `.env` en clair**.
`bun run dev/build/preview` lance `infisical run ... -- vite` pour le développement local.

> ⚠️ **Depuis la fuite du 2026-07-01** : aucun secret ne doit utiliser le préfixe `VITE_`, car Vite l'intègre au bundle public.
> Les clés OpenRouter et Inworld vivent uniquement dans les secrets des Edge Functions.
> L'accès admin repose sur le token de session et `is_admin`.
> Seuls `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, publics par conception et protégés par RLS, restent côté client.

Configuration attendue :
```
VITE_SUPABASE_URL       # Public, front Vite et Vercel
VITE_SUPABASE_ANON_KEY  # Publique, front Vite et Vercel
OPENROUTER_API_KEY      # Secret Edge Function uniquement
INWORLD_API_KEY         # Secret Edge Function uniquement
```

- Régénérer un `.env` local au besoin : `infisical export --domain http://infisical.mesh:8080 --env dev > .env` (ne pas commiter, `.env` est gitignored).
- Modifier/rotater un secret : le faire dans Infisical (UI ou API REST, cf. `~/.claude/recipes/infisical-api.md`), pas en local.
- **Admin** : l'accès `/admin` et les RPC admin exigent un compte `is_admin` (vérifié serveur via le token de session, migration 003). Plus de `VITE_ADMIN_TOKEN` ni `app.admin_token`.

## Compte & Projet Supabase

- **Projet Supabase** : `shared-projects` — ref `xsmtfilcpmubfpraykwb` (`https://xsmtfilcpmubfpraykwb.supabase.co`)
- **Compte de login dashboard** : `prestainforeole+1@gmail.com`
- **Projet PARTAGÉ avec `prospectminer`** (même DB). Isolation par préfixe de tables : `specrefiner_*` (spec-refiner) vs `pm_*` (prospectminer). Ne jamais supposer que la DB est dédiée à spec-refiner.
- La clé anon a déjà été rotatée une fois (fév. 2026) : si `Invalid API key`, reprendre la clé valide depuis `~/dv/prospectminer/.env.local` (même projet) ou le dashboard.
- Pour rejouer la migration de sécurité : accès DDL requis (SQL Editor du dashboard ou connection string Postgres), la clé anon ne suffit pas.

## Architecture

**Single-Page React Application** with quatre phases utilisateur:
1. **Auth** - Login email/password (multi-users via Supabase)
2. **Input** - Project description + file uploads
3. **Interview** - Multi-turn Claude conversation
4. **Complete** - Specification display/download

**Authentification Multi-Users (Supabase):**
- Table `specrefiner_users` : id, email, password_hash, created_at
- Hashage via pgcrypto (fonctions RPC `create_user`, `verify_password`)
- Page admin `/admin` : création/suppression d'utilisateurs (réservée aux comptes `is_admin`, vérifié serveur via le token de session ; migration 003)

**Security Architecture (Row Level Security):**
- RLS activé sur `specrefiner_users` et `specrefiner_sessions`
- Toutes les opérations passent par des RPCs `SECURITY DEFINER`
- Pas d'accès direct aux tables depuis le client
- RPCs sécurisées : `login_user_secure`, `load_user_session`, `save_user_session`, `clear_user_session`
- RPCs admin : `admin_create_user`, `admin_list_users`, `admin_delete_user` (exigent `p_session_token` d'un compte `is_admin` ; helpers `assert_session_admin` / `is_session_admin`)
- Les proxies IA exigent un token de session, imposent le modèle et les plafonds, limitent la taille des requêtes et appliquent un rate limit atomique par utilisateur.
- La vérification JWT plateforme des Edge Functions est désactivée, car l'authentification applicative est effectuée côté serveur par `consume_specrefiner_api_rate_limit`.

**Key Files:**
- `src/SpecRefiner.jsx` - Main component (handles all phases)
- `src/App.jsx` - Router (/, /admin)
- `src/components/AdminPage.jsx` - Gestion des utilisateurs
- `src/hooks/useAuth.js` - Hook d'authentification
- `src/services/userService.js` - CRUD utilisateurs Supabase
- `src/lib/supabase.js` - Client Supabase

**State Persistence:**
- `sessionStorage` - Auth state (`spec-refiner-auth` : user object JSON)
- `localStorage` - Session data par user (`spec-refiner-session-{userId}`: messages, specs, phase)

## Tech Stack

- React 18 + Vite 5
- Tailwind CSS
- Lucide React (icons)
- **Supabase** (auth multi-users, PostgreSQL)
- mammoth (DOCX extraction)
- pdfjs-dist (PDF extraction)

## API Integration

OpenRouter API avec Claude Sonnet 4 :
- Endpoint front : `${VITE_SUPABASE_URL}/functions/v1/openrouter`
- Endpoint amont : `https://openrouter.ai/api/v1/chat/completions`, appelé uniquement par l'Edge Function
- Modèle imposé côté serveur : `anthropic/claude-sonnet-4`
- Limites serveur : 8 192 tokens de sortie, requête de 256 Ko, 20 appels par minute et par utilisateur
- Interview conducted in French with one question at a time
- Spec generation triggered by `[SPEC_COMPLETE]` marker in response

## File Processing

Supports: Images (base64), PDF (text extraction), DOCX (text extraction), TXT, MD

## Deployment

Vercel utilise Bun avec `bun install --frozen-lockfile` et `bun x vite build`.
La production publique est `https://spec.inforeole.fr`.

## Security Setup (Supabase)

**IMPORTANT** : appliquer les migrations Supabase dans l'ordre avant le front.

1. `001_security_hardening.sql`
2. `002_api_proxy_auth.sql`
3. `003_admin_via_session.sql`
4. `20260729150938_api_proxy_rate_limit.sql`

Déployer ensuite les Edge Functions `openrouter` et `inworld` avec leurs secrets serveur.
Ne jamais recréer `specrefiner_config.admin_token`, `VITE_ADMIN_TOKEN`, `VITE_APP_PASSWORD`, `VITE_OPENROUTER_API_KEY` ou `VITE_INWORLD_API_KEY`.

**Politique de mot de passe** : 12+ caractères, majuscule, minuscule, chiffre, caractère spécial.

## Code Conventions

- All UI text and AI prompts are in French
- Vitest pour les tests (`bun run test`)
- ESLint strict mode (zero warnings allowed)
- ES modules only (`"type": "module"`)

## UI Testing with Chrome

Après toute modification d'interface (composants React, styles, interactions), tu DOIS tester visuellement avec Chrome :

1. **Démarrer le serveur dev** (si pas déjà lancé) :
   ```bash
   bun run dev  # Lance sur http://localhost:5173
   ```

2. **Tester avec les outils Chrome MCP** :
   - `tabs_context_mcp` → obtenir le contexte des onglets
   - `tabs_create_mcp` → créer un nouvel onglet
   - `navigate` → aller sur http://localhost:5173
   - `computer` avec `action: "screenshot"` → capturer l'état actuel
   - `read_page` → lire l'arbre d'accessibilité
   - `find` → trouver des éléments spécifiques
   - `computer` avec `action: "left_click"` → tester les interactions

3. **Vérifications minimales** :
   - Screenshot de l'état initial
   - Vérifier que les éléments modifiés sont visibles
   - Tester les interactions ajoutées/modifiées (clics, formulaires)
   - Screenshot après interaction pour confirmer le comportement

4. **En cas d'erreur** :
   - `read_console_messages` → vérifier les erreurs JS
   - Corriger et re-tester

**Compte de test** : utiliser un compte dédié dont le mot de passe est géré hors du bundle client.
La page `/admin` exige un compte `is_admin` authentifié et un token de session valide.

## Post-Mortem & Capitalisation

Système automatique de logging et d'analyse pour améliorer les pratiques de développement.

**Structure :**
```
.claude/
  settings.json       # Hooks de logging
  scripts/
    log-prompt.sh     # Log les prompts utilisateur
    log-error.sh      # Log les erreurs
    analyze.js        # Script d'analyse post-mortem
  logs/
    prompts.jsonl     # Historique des prompts (ignoré par git)
    errors.jsonl      # Historique des erreurs (ignoré par git)
  report.md           # Dernier rapport généré (ignoré par git)
```

**Utilisation :**
```bash
npm run postmortem   # Génère un rapport d'analyse
```

**Le rapport inclut :**
- Répartition des prompts (bugs, features, questions, refactoring)
- Mots-clés fréquents (sujets récurrents)
- Ratio fix/feature dans les commits
- Recommandations pour améliorer CLAUDE.md
- Insights sur les patterns détectés

**Logging automatique :**
- Chaque prompt est loggé avec timestamp, branche git et hash de commit
- Les erreurs des outils sont capturées automatiquement
- Les logs ne sont PAS committés (dans .gitignore)
