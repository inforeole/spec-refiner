# TODO - Finalisation du déploiement sécurité

> Statut au **2026-07-29** : migrations, Edge Functions et frontend déployés.
> Les proxies refusent les requêtes sans session avec un HTTP 401.
> La connexion publique fonctionne et le bundle de production ne contient plus les clés tierces.
> L’IA et le TTS resteront indisponibles tant que les nouvelles clés serveur ne sont pas ajoutées.

## Contexte

Les clés OpenRouter et Inworld étaient injectées en clair dans le bundle frontend.
Une clé OpenRouter a été exfiltrée et utilisée abusivement le 2026-07-01.
Les anciennes clés OpenRouter et Inworld ont été révoquées.

## Fait

- Les Edge Functions `openrouter` et `inworld` détiennent les clés côté serveur.
- Le modèle, la taille des requêtes, le nombre de tokens et les délais sont bornés côté serveur.
- Les migrations 001, 002, 003 et 20260729150938 sont appliquées au projet `xsmtfilcpmubfpraykwb`.
- `login_user_secure` émet un token de session opaque.
- L’accès admin utilise le token de session et le flag `is_admin`.
- Le rate limit est atomique par utilisateur et par proxy.
- Les deux Edge Functions sont déployées avec `verify_jwt=false`.
- Les deux fonctions valident le token de session côté serveur.
- Les deux fonctions renvoient HTTP 401 sans token de session.
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont configurées dans Vercel.
- Le frontend sécurisé est déployé sur `https://spec.inforeole.fr`.
- Le RPC de connexion répond HTTP 200 avec la clé publique actuellement servie.
- Une tentative avec un compte fictif renvoie `Email ou mot de passe incorrect` et non `Invalid API key`.
- Les tests de sécurité, le lint et le build Vercel local passent.
- Le bundle servi est identique au bundle construit et ne contient aucune clé OpenRouter ni endpoint tiers direct.

## Actions manuelles requises

1. Créer une nouvelle clé OpenRouter limitée au besoin de Spec Refiner.
2. Créer une nouvelle clé standard Inworld et copier la signature Basic en Base64.
3. Ajouter les deux valeurs dans les secrets Edge Functions Supabase sous les noms `OPENROUTER_API_KEY` et `INWORLD_API_KEY`.
4. Ajouter les mêmes secrets dans Infisical, projet `spec-refiner`, sans préfixe `VITE_`.
5. Ne jamais coller ces clés dans une conversation, un commit ou une variable Vite.

## Étapes restantes

1. Configurer les deux secrets serveur.
2. Tester en production avec un compte réel un échange d’interview, une lecture TTS et une génération de spécification.
3. Vérifier dans les logs OpenRouter que seul le modèle autorisé est utilisé.
4. Supprimer dans Infisical les anciennes variables `VITE_OPENROUTER_API_KEY`, `VITE_INWORLD_API_KEY`, `VITE_ADMIN_TOKEN` et `VITE_APP_PASSWORD` si elles existent encore.

## Vérifications de sécurité post-déploiement

- Le bundle de production ne contient aucune clé OpenRouter ou Inworld.
- Un appel du proxy sans `X-Session-Token` valide renvoie HTTP 401.
- Les logs OpenRouter montrent uniquement `anthropic/claude-sonnet-4`.

## Dette de sécurité séparée

L’audit Supabase signale que les anciennes RPC `load_user_session`, `save_user_session` et `clear_user_session` autorisent encore l’accès par simple identifiant utilisateur.
Elles doivent être migrées vers le token de session avant de considérer l’autorisation applicative comme complète.
Les alertes sur les tables `pm_*` appartiennent à ProspectMiner et ne doivent pas être corrigées depuis ce dépôt.
