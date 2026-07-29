# Sécurité, fiabilité et CI

## Contexte

La revue a confirmé que plusieurs fonctions Supabase `SECURITY DEFINER` sont exécutables sans authentification applicative.

Elle a aussi révélé des régressions dans la génération finale, la persistance de session, le cache TTS et les pièces jointes.

La suite de tests est actuellement rouge à cause de tests et de mocks devenus obsolètes.

Le dépôt ne contient aucun workflow GitHub Actions et la branche principale n'est pas protégée.

## Objectifs

- Restaurer une suite de tests fiable sans modifier le comportement pendant cette première étape.
- Ajouter des RPC de session qui déduisent l'utilisateur depuis son token de session.
- Bloquer la création publique de comptes via l'ancienne RPC `create_user`.
- Refuser une spécification finale vide ou dépourvue du marqueur attendu.
- Ne considérer une session comme sauvegardée qu'après confirmation de Supabase.
- Isoler le cache TTS entre les utilisateurs et les contenus.
- Préserver le texte et l'identité des pièces jointes.
- Ajouter une CI GitHub reproductible avec Bun.

## Hors périmètre

- Migration vers Supabase Auth.
- Refonte globale de `SpecRefiner`.
- Optimisation générale du bundle.
- Déploiement en production.
- Application de migrations sur la base de production.
- Activation de la protection de branche GitHub.

## Conception

### RPC de session

Les nouvelles fonctions `load_user_session_v2`, `save_user_session_v2` et `clear_user_session_v2` prennent uniquement un token de session.

Une fonction interne résout l'utilisateur correspondant au token et refuse les tokens inconnus ou expirés.

Les nouvelles fonctions utilisent `SECURITY DEFINER`, un `search_path` fixe et des références de tables qualifiées.

Le rôle `anon` conserve uniquement le droit d'appeler ces points d'entrée contrôlés.

Les anciennes RPC de session restent temporairement disponibles pour permettre un déploiement client progressif.

Une migration séparée révoquera leurs droits seulement après validation du client déployé.

L'ancienne fonction `create_user` perd immédiatement ses droits pour `PUBLIC`, `anon` et `authenticated`.

### Persistance

Le hook de session reçoit le token associé à l'utilisateur courant.

Chaque chargement, sauvegarde et suppression appelle les RPC v2 avec ce token.

Une sauvegarde ne met à jour la référence locale de dernière valeur qu'après succès.

Une erreur reste observable et une modification suivante peut déclencher une nouvelle tentative.

### Spécification finale

Une réponse finale doit contenir le marqueur `[SPEC_COMPLETE]` suivi d'un document qui commence par un titre Markdown H1.

La même validation est utilisée pour la fin spontanée de l'entretien et pour la demande explicite de génération.

### TTS

Une entrée audio est indexée par une identité de contenu et non par la seule position du message.

Le cache et les lectures en cours sont invalidés lors d'un changement d'utilisateur ou d'une réinitialisation.

### Pièces jointes

Le texte extrait est conservé dans la structure utilisée par l'aperçu.

La clé interne d'une pièce jointe ne dépend pas uniquement du nom du fichier.

### CI

Le workflow GitHub Actions utilise Bun et exécute l'installation figée, ESLint, Vitest et le build Vite sans secrets de production.

La protection de branche reste une action GitHub distincte qui nécessite une validation explicite.

## Validation

Chaque correction de comportement commence par un test rouge ciblé.

La validation finale couvre la suite Vitest complète, ESLint et un build Vite de production avec des valeurs publiques factices.

Les migrations sont vérifiées localement si l'environnement Supabase local est disponible.

La production ne sera ni modifiée ni déployée dans ce lot.
