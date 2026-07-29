# Security, Reliability and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les failles de contrôle d'accès et les bugs de fiabilité confirmés, puis ajouter une CI GitHub reproductible.

**Architecture:** Le client utilise des RPC Supabase v2 fondées sur le token de session et conserve les anciennes RPC uniquement pendant la période de compatibilité.
Les correctifs applicatifs restent localisés dans les services et hooks existants.

**Tech Stack:** React 18, Vite 5, Vitest, Supabase PostgreSQL, GitHub Actions et Bun.

## Global Constraints

- [x] Ne pas toucher à la base de production.
- [x] Ne pas déployer.
- [x] Écrire un test rouge avant chaque correction de comportement.
- [x] Conserver la compatibilité des anciennes RPC pendant le premier déploiement client.
- [x] Utiliser des chemins de stage explicites et des commits cohérents.

---

## Task 1: Stabiliser le socle de tests

- [x] Exclure tous les worktrees du scan Vitest.
- [x] Corriger les mocks obsolètes de `useChatInput`.
- [x] Corriger les mocks obsolètes de `useInterviewChat`.
- [x] Aligner les tests de `useSession` sur le contrat actuel avant refonte.
- [x] Remplacer les tests d'export qui ciblent une fonction supprimée.
- [x] Aligner les scénarios TTS sur le comportement d'accueil documenté.
- [x] Exécuter les cinq fichiers ciblés puis la suite complète.

## Task 2: Sécuriser les RPC Supabase

- [x] Ajouter des tests de contrat client pour les appels de session.
- [x] Générer une migration avec la CLI Supabase.
- [x] Ajouter les RPC v2 qui résolvent l'utilisateur depuis le token.
- [x] Révoquer l'exécution publique de `create_user`.
- [x] Basculer le service et le hook de session vers les RPC v2.
- [x] Vérifier statiquement la migration, l'environnement Supabase local étant indisponible.

## Task 3: Fiabiliser la génération finale

- [x] Ajouter des tests pour une réponse sans marqueur, un marqueur seul et une vraie spécification.
- [x] Centraliser l'extraction et la validation de la spécification finale.
- [x] Utiliser cette validation dans les deux chemins de génération.

## Task 4: Fiabiliser les sauvegardes

- [x] Ajouter un test prouvant qu'une sauvegarde échouée reste à retenter.
- [x] Déplacer la mise à jour de la dernière valeur après le succès Supabase.
- [x] Rendre l'erreur observable sans ajouter d'échec silencieux.

## Task 5: Isoler le TTS

- [x] Ajouter des tests de collision de position et de changement d'utilisateur.
- [x] Indexer le cache par contenu et contexte utilisateur.
- [x] Annuler les préchargements et vider l'état lors d'une réinitialisation.

## Task 6: Corriger les pièces jointes

- [x] Ajouter un test d'aperçu pour un fichier texte.
- [x] Ajouter un test de collision entre deux fichiers de même nom.
- [x] Conserver le texte extrait dans la structure d'affichage.
- [x] Générer une identité interne unique par pièce jointe.

## Task 7: Ajouter la CI et documenter

- [x] Ajouter un script de build sans Infisical pour la CI.
- [x] Ajouter `.github/workflows/ci.yml`.
- [x] Mettre à jour `AGENTS.md` avec le nouveau contrat de session et les commandes Bun.
- [x] Consigner le changement d'infrastructure dans l'inbox prévue.

## Task 8: Vérifier et livrer

- [x] Exécuter ESLint.
- [x] Exécuter toute la suite Vitest.
- [x] Exécuter le build CI.
- [x] Relire le diff et vérifier l'absence de secrets.
- [x] Committer par lots cohérents.
- [ ] Pousser la branche et ouvrir une PR sans la fusionner ni la déployer.
