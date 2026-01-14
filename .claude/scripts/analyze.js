#!/usr/bin/env node
/**
 * Post-mortem Analysis Script
 * Analyzes prompts, errors, and git history to identify patterns and learnings
 *
 * Note: Uses execSync with hardcoded commands only (no user input) - safe from injection
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOGS_DIR = join(__dirname, '..', 'logs');
const REPORT_FILE = join(__dirname, '..', 'report.md');

// Parse JSONL file
function parseJsonl(filepath) {
  if (!existsSync(filepath)) return [];
  try {
    return readFileSync(filepath, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Get git history analysis (hardcoded commands only - no user input)
function analyzeGitHistory() {
  try {
    // Safe: command is hardcoded, no user input
    const log = execSync(
      'git log --oneline --since="30 days ago" 2>/dev/null || git log --oneline -100',
      { encoding: 'utf-8', cwd: join(__dirname, '../..') }
    );

    const commits = log.trim().split('\n').filter(Boolean);
    const patterns = {
      fixes: commits.filter(c => /\bfix/i.test(c)),
      features: commits.filter(c => /\b(feat|add|implement)/i.test(c)),
      refactors: commits.filter(c => /\b(refactor|clean|improve)/i.test(c)),
      docs: commits.filter(c => /\b(doc|readme|comment)/i.test(c)),
      reverts: commits.filter(c => /\brevert/i.test(c)),
    };

    return { total: commits.length, patterns, commits };
  } catch {
    return { total: 0, patterns: {}, commits: [] };
  }
}

// Categorize prompts
function categorizePrompts(prompts) {
  const categories = {
    bugs: [],
    features: [],
    questions: [],
    refactoring: [],
    other: []
  };

  for (const p of prompts) {
    const text = (p.prompt || '').toLowerCase();
    if (/\b(bug|fix|error|crash|broken|marche pas|fonctionne pas)\b/.test(text)) {
      categories.bugs.push(p);
    } else if (/\b(add|create|implement|ajoute|crée|nouveau)\b/.test(text)) {
      categories.features.push(p);
    } else if (/\?|comment|pourquoi|what|how|why|est-ce que|c'est quoi/.test(text)) {
      categories.questions.push(p);
    } else if (/\b(refactor|clean|simplif|améliore)\b/.test(text)) {
      categories.refactoring.push(p);
    } else {
      categories.other.push(p);
    }
  }

  return categories;
}

// Find repeated patterns (similar prompts)
function findRepeatedPatterns(prompts) {
  const patterns = {};

  for (const p of prompts) {
    // Extract key words (simplified)
    const words = (p.prompt || '')
      .toLowerCase()
      .replace(/[^a-zàâäéèêëïîôùûü\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4);

    for (const word of words) {
      patterns[word] = (patterns[word] || 0) + 1;
    }
  }

  return Object.entries(patterns)
    .filter(([, count]) => count > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

// Generate insights
function generateInsights(prompts, errors, git) {
  const insights = [];

  // Fix ratio analysis
  if (git.patterns.fixes?.length > git.patterns.features?.length) {
    insights.push({
      type: 'warning',
      message: `Plus de fixes (${git.patterns.fixes.length}) que de features (${git.patterns.features.length}) - possible dette technique`
    });
  }

  // Revert analysis
  if (git.patterns.reverts?.length > 2) {
    insights.push({
      type: 'warning',
      message: `${git.patterns.reverts.length} reverts détectés - revoir le process de review`
    });
  }

  // Error frequency
  if (errors.length > prompts.length * 0.3) {
    insights.push({
      type: 'critical',
      message: `Taux d'erreur élevé: ${errors.length} erreurs pour ${prompts.length} prompts`
    });
  }

  // Prompt categories
  const categories = categorizePrompts(prompts);
  if (categories.bugs.length > categories.features.length) {
    insights.push({
      type: 'info',
      message: `Session orientée debug: ${categories.bugs.length} demandes de fix vs ${categories.features.length} features`
    });
  }

  return insights;
}

// Generate recommendations for CLAUDE.md
function generateRecommendations(prompts, errors) {
  const recommendations = [];
  const categories = categorizePrompts(prompts);
  const repeated = findRepeatedPatterns(prompts);

  // Check for repeated questions about same topics
  for (const [word, count] of repeated) {
    if (count > 3) {
      recommendations.push(`Documenter "${word}" dans CLAUDE.md (mentionné ${count} fois)`);
    }
  }

  // Check error patterns
  const errorTools = {};
  for (const e of errors) {
    errorTools[e.tool] = (errorTools[e.tool] || 0) + 1;
  }

  for (const [tool, count] of Object.entries(errorTools)) {
    if (count > 2) {
      recommendations.push(`Revoir l'utilisation de ${tool} (${count} erreurs)`);
    }
  }

  return recommendations;
}

// Main
function main() {
  console.log('🔍 Analyse post-mortem en cours...\n');

  // Load data
  const prompts = parseJsonl(join(LOGS_DIR, 'prompts.jsonl'));
  const errors = parseJsonl(join(LOGS_DIR, 'errors.jsonl'));
  const git = analyzeGitHistory();

  console.log(`📊 Données chargées:`);
  console.log(`   - ${prompts.length} prompts`);
  console.log(`   - ${errors.length} erreurs`);
  console.log(`   - ${git.total} commits\n`);

  // Analysis
  const categories = categorizePrompts(prompts);
  const repeated = findRepeatedPatterns(prompts);
  const insights = generateInsights(prompts, errors, git);
  const recommendations = generateRecommendations(prompts, errors);

  // Generate report
  const report = `# Rapport Post-Mortem

*Généré le ${new Date().toISOString().split('T')[0]}*

## Résumé

| Métrique | Valeur |
|----------|--------|
| Prompts analysés | ${prompts.length} |
| Erreurs détectées | ${errors.length} |
| Commits (30j) | ${git.total} |
| Ratio fix/feature | ${git.patterns.fixes?.length || 0}/${git.patterns.features?.length || 0} |

## Répartition des Prompts

- 🐛 Bugs/Fixes: ${categories.bugs.length}
- ✨ Features: ${categories.features.length}
- ❓ Questions: ${categories.questions.length}
- 🔧 Refactoring: ${categories.refactoring.length}
- 📝 Autres: ${categories.other.length}

## Mots-clés Fréquents

${repeated.slice(0, 10).map(([word, count]) => `- **${word}**: ${count} fois`).join('\n') || '*Pas assez de données*'}

## Insights

${insights.map(i => {
  const icon = i.type === 'critical' ? '🚨' : i.type === 'warning' ? '⚠️' : 'ℹ️';
  return `${icon} ${i.message}`;
}).join('\n') || '*Aucun insight notable*'}

## Recommandations pour CLAUDE.md

${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') || '*Aucune recommandation*'}

## Commits Récents (Fixes)

${git.patterns.fixes?.slice(0, 10).map(c => `- ${c}`).join('\n') || '*Aucun fix récent*'}

---

*Rapport généré automatiquement par le script d'analyse post-mortem*
`;

  writeFileSync(REPORT_FILE, report);
  console.log(`✅ Rapport généré: ${REPORT_FILE}\n`);
  console.log(report);
}

main();
