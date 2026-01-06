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
