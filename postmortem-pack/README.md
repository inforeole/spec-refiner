# Claude Code Post-Mortem System

Système de logging et d'analyse automatique pour capitaliser sur vos sessions Claude Code.

## Installation

```bash
# Dans votre projet
curl -sO https://raw.githubusercontent.com/VOTRE_REPO/main/postmortem-pack/install.sh && bash install.sh
```

Ou copier le dossier et lancer :
```bash
bash install.sh
```

## Usage

```bash
npm run postmortem
```

## Ce que ça fait

1. **Log automatique** de tous vos prompts (hook Claude Code)
2. **Analyse** des patterns et erreurs récurrentes
3. **Rapport** avec :
   - Ratio bugs/features
   - Mots-clés fréquents (sujets à documenter)
   - Recommandations pour améliorer votre CLAUDE.md

## Structure créée

```
.claude/
  settings.json       # Config des hooks
  scripts/
    log-prompt.sh     # Capture les prompts
    analyze.js        # Génère le rapport
  logs/
    prompts.jsonl     # Historique (gitignore)
  report.md           # Dernier rapport (gitignore)
```

## Prérequis

- Node.js
- Python 3 (pour l'échappement JSON)
- Git (optionnel, pour le contexte des commits)
