# Voix Inworld Mini

## Objectif

Remplacer la configuration TTS obsolète de Spec Refiner par la voix Inworld déjà validée dans Videogen.

Le rendu doit utiliser le modèle `inworld-tts-1.5-mini`, la voix `default-o-lizv8yves-5uhgzcrjog__ok` et un débit de `0.8`.

## Périmètre

Le changement concerne uniquement l'Edge Function Supabase `inworld`.

Le client continue d'envoyer `{ text }` et de recevoir la réponse Inworld contenant `audioContent`.

Le nom public de l'Edge Function et le secret serveur `INWORLD_API_KEY` restent inchangés.

## Contrat

Chaque requête envoyée à Inworld contient le texte borné à 1 000 caractères, la voix `__ok`, le modèle `inworld-tts-1.5-mini`, un encodage MP3, un débit de `0.8` et une température de `1.0`.

La configuration et la construction du corps de requête vivent dans un module pur afin de permettre un test unitaire sans appeler Inworld.

## Sécurité

La clé Inworld reste exclusivement dans les secrets Supabase.

L'authentification de session, la limite de débit, la limite de taille et le timeout amont restent inchangés.

## Validation

Un test unitaire vérifie le contrat exact envoyé à Inworld.

La suite Vitest, le lint et le build doivent réussir.

Avant toute mise en production, l'Edge Function doit être déployée avec le secret `INWORLD_API_KEY` présent, puis testée par le chemin utilisateur réel.
