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
npm install          # Install dependencies
npm run dev          # Start dev server (Vite, port 5173)
npm run build        # Production build to dist/
npm run lint         # ESLint (strict: --max-warnings 0)
npm run preview      # Preview production build
```

## Environment Setup

Create `.env` with:
```
VITE_OPENROUTER_API_KEY=sk-or-v1-...  # OpenRouter API key
VITE_APP_PASSWORD=...                 # Admin password (pour /admin UI)
VITE_ADMIN_TOKEN=...                  # Admin token for secure RPCs (server-side validation)
VITE_SUPABASE_URL=https://xxx.supabase.co  # Supabase project URL
VITE_SUPABASE_ANON_KEY=eyJ...              # Supabase anon/public key
```

**Important**: `VITE_ADMIN_TOKEN` doit correspondre à `app.admin_token` dans Supabase (voir Security Setup).

## Architecture

**Single-Page React Application** with quatre phases utilisateur:
1. **Auth** - Login email/password (multi-users via Supabase)
2. **Input** - Project description + file uploads
3. **Interview** - Multi-turn Claude conversation
4. **Complete** - Specification display/download

**Authentification Multi-Users (Supabase):**
- Table `specrefiner_users` : id, email, password_hash, created_at
- Hashage via pgcrypto (fonctions RPC `create_user`, `verify_password`)
- Page admin `/admin` : création/suppression d'utilisateurs (protégée par `VITE_APP_PASSWORD`)

**Security Architecture (Row Level Security):**
- RLS activé sur `specrefiner_users` et `specrefiner_sessions`
- Toutes les opérations passent par des RPCs `SECURITY DEFINER`
- Pas d'accès direct aux tables depuis le client
- RPCs sécurisées : `login_user_secure`, `load_user_session`, `save_user_session`, `clear_user_session`
- RPCs admin : `admin_create_user`, `admin_list_users`, `admin_delete_user` (requièrent `admin_token`)

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

OpenRouter API with Claude 3.5 Sonnet:
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Model: `anthropic/claude-3.5-sonnet`
- Interview conducted in French with one question at a time
- Spec generation triggered by `[SPEC_COMPLETE]` marker in response

## File Processing

Supports: Images (base64), PDF (text extraction), DOCX (text extraction), TXT, MD

## Deployment

Vercel-ready. Push to GitHub and import, or use `vercel` CLI.

## Security Setup (Supabase)

**IMPORTANT** : La migration de sécurité a été appliquée. En cas de nouveau déploiement :

1. **Exécuter la migration SQL** dans Supabase SQL Editor :
   ```
   supabase/migrations/001_security_hardening.sql
   ```

2. **Le token admin est stocké** dans la table `specrefiner_config` (protégée par RLS).
   Pour changer le token :
   ```sql
   -- Via une fonction SECURITY DEFINER ou directement en tant que postgres
   UPDATE specrefiner_config SET value = 'nouveau-token' WHERE key = 'admin_token';
   ```

3. **Token actuel** dans `.env` : `VITE_ADMIN_TOKEN` doit correspondre à la valeur en BDD.

**Politique de mot de passe** : 12+ caractères, majuscule, minuscule, chiffre, caractère spécial.

## Code Conventions

- All UI text and AI prompts are in French
- Vitest pour les tests (`npm run test`)
- ESLint strict mode (zero warnings allowed)
- ES modules only (`"type": "module"`)

## UI Testing with Chrome

Après toute modification d'interface (composants React, styles, interactions), tu DOIS tester visuellement avec Chrome :

1. **Démarrer le serveur dev** (si pas déjà lancé) :
   ```bash
   npm run dev  # Lance sur http://localhost:5173
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

**Compte de test** : Utiliser `debug@test.com` avec le mot de passe `VITE_APP_PASSWORD` du `.env` pour les tests visuels.

**Note** : Le mot de passe admin est dans `VITE_APP_PASSWORD` du `.env` (pour la page /admin).

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
