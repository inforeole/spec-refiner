# Routage des modèles OpenRouter

## Objectif

Réduire le coût des résumés de fichiers sans dégrader la qualité de l’entretien ni de la spécification finale.

## Routage retenu

Les résumés utilisent `anthropic/claude-haiku-4.5`.
L’entretien et la génération de spécification utilisent `anthropic/claude-sonnet-4.6`.
Le client transmet uniquement un type de tâche parmi `summary` et `interview`.
L’Edge Function conserve l’autorité sur le modèle réellement envoyé à OpenRouter.
Une requête sans type reste compatible avec les anciens clients et utilise `interview`.
Une valeur inconnue est refusée avec un HTTP 400.

## Limites serveur

Les résumés restent plafonnés à 256 tokens de sortie.
L’entretien reste plafonné à 8192 tokens de sortie.
Le plafond demandé par le client est toujours réduit au plafond de la tâche.
Le rate limit, l’authentification de session, la taille maximale du corps et le délai amont restent inchangés.

## Flux

`summaryService` envoie `task: "summary"`.
`apiService` envoie `task: "interview"`.
La spécification finale passe déjà par `apiService` et utilise donc Sonnet 4.6.
L’Edge Function résout le modèle et le plafond à partir d’une table de routage pure et testable.

## Erreurs et compatibilité

Une tâche invalide ne déclenche aucun appel OpenRouter.
Les erreurs OpenRouter continuent d’être relayées sans modification.
Le déploiement de l’Edge Function peut précéder celui du frontend grâce au défaut `interview`.

## Validation

Les tests unitaires couvrent les deux routes, le défaut compatible, le refus d’une valeur inconnue et les corps envoyés par les deux services clients.
La validation de production appelle le proxy avec une session temporaire explicitement autorisée ou avec un compte de test existant.
Les logs OpenRouter doivent montrer Haiku 4.5 pour un résumé et Sonnet 4.6 pour l’entretien.
