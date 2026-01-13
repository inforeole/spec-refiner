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
VITE_APP_PASSWORD=...                 # Admin password (pour /admin)
VITE_SUPABASE_URL=https://xxx.supabase.co  # Supabase project URL
VITE_SUPABASE_ANON_KEY=eyJ...              # Supabase anon/public key
```

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

## Code Conventions

- All UI text and AI prompts are in French
- No testing framework configured
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
