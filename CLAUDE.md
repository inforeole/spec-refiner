# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spec Refiner is a French-language AI-powered SaaS project specification tool. Users describe their project idea, then engage in a guided interview with Claude AI to refine requirements into a complete specification document.

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
VITE_APP_PASSWORD=...                 # Session password
```

## Architecture

**Single-Page React Application** with four phases:
1. **Auth** - Password login (session-based via sessionStorage)
2. **Input** - Project description + file uploads
3. **Interview** - Multi-turn Claude conversation
4. **Complete** - Specification display/download

**Key Files:**
- `src/SpecRefiner.jsx` - Main component (843 lines, handles all phases)
- `src/App.jsx` - Wrapper component
- `src/main.jsx` - React entry point

**State Persistence:**
- `sessionStorage` - Auth state (`spec-refiner-auth`)
- `localStorage` - Session data (`spec-refiner-session`: messages, specs, phase, question count)

## Tech Stack

- React 18 + Vite 5
- Tailwind CSS
- Lucide React (icons)
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

**Note** : Le mot de passe de l'app est dans `VITE_APP_PASSWORD` du `.env`. Si tu dois passer l'auth, utilise cette valeur.
