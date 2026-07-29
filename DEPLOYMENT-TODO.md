# TODO - Finalisation du déploiement sécurité

> Statut au **2026-07-29** : migrations, Edge Functions et frontend déployés.
> Les proxies refusent les requêtes sans session avec un HTTP 401.
> La connexion publique fonctionne et le bundle de production ne contient plus les clés tierces.
> L’IA reste indisponible car `OPENROUTER_API_KEY` manque côté serveur.
> `INWORLD_API_KEY` est présent, mais le TTS n'a pas été testé avec un compte réel.

## Contexte

Les clés OpenRouter et Inworld étaient injectées en clair dans le bundle frontend.
Une clé OpenRouter a été exfiltrée et utilisée abusivement le 2026-07-01.
Les anciennes clés OpenRouter et Inworld ont été révoquées.

## Fait

- Les Edge Functions `openrouter` et `inworld` détiennent les clés côté serveur.
- Le modèle, la taille des requêtes, le nombre de tokens et les délais sont bornés côté serveur.
- Les migrations 001, 002, 003, 20260729150938, 20260729194159 et 20260729201527 sont appliquées au projet `xsmtfilcpmubfpraykwb`.
- `login_user_secure` émet un token de session opaque.
- L’accès admin utilise le token de session et le flag `is_admin`.
- Le rate limit est atomique par utilisateur et par proxy.
- Les deux Edge Functions sont déployées avec `verify_jwt=false`.
- Les deux fonctions valident le token de session côté serveur.
- Les deux fonctions renvoient HTTP 401 sans token de session.
- `INWORLD_API_KEY` est configuré dans les secrets Edge Functions.
- `OPENROUTER_API_KEY` manque dans les secrets Edge Functions et dans Infisical.
- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont configurées dans Vercel.
- Le frontend sécurisé est déployé sur `https://spec.inforeole.fr`.
- Le RPC de connexion répond HTTP 200 avec la clé publique actuellement servie.
- Une tentative avec un compte fictif renvoie `Email ou mot de passe incorrect` et non `Invalid API key`.
- Les tests de sécurité, le lint et le build Vercel local passent.
- Le bundle servi est identique au bundle construit et ne contient aucune clé OpenRouter ni endpoint tiers direct.

## Actions manuelles requises

1. Créer une nouvelle clé OpenRouter limitée au besoin de Spec Refiner.
2. Ajouter la valeur dans les secrets Edge Functions Supabase sous le nom `OPENROUTER_API_KEY`.
3. Ajouter le même secret dans Infisical, projet `spec-refiner`, sans préfixe `VITE_`.
4. Ne jamais coller cette clé dans une conversation, un commit ou une variable Vite.

## Étapes restantes

1. Configurer le secret serveur OpenRouter.
2. Tester en production avec un compte réel un échange d’interview, une lecture TTS et une génération de spécification.
3. Vérifier dans les logs OpenRouter que seul le modèle autorisé est utilisé.
4. Supprimer dans Infisical les anciennes variables `VITE_OPENROUTER_API_KEY`, `VITE_INWORLD_API_KEY`, `VITE_ADMIN_TOKEN` et `VITE_APP_PASSWORD` si elles existent encore.

## Vérifications de sécurité post-déploiement

- Le bundle de production ne contient aucune clé OpenRouter ou Inworld.
- Un appel du proxy sans `X-Session-Token` valide renvoie HTTP 401.
- Les logs OpenRouter montrent uniquement `anthropic/claude-sonnet-4`.

## Dette de sécurité fermée

L’audit Supabase signalait que les anciennes RPC `load_user_session`, `save_user_session` et `clear_user_session` autorisaient l’accès par simple identifiant utilisateur.
La migration `20260729194159_secure_session_rpcs.sql` et le client v2 sont déployés depuis le 29 juillet 2026.
La migration `20260729201527_fix_api_rate_limit_conflict.sql` corrige également l'ambiguïté SQL découverte par le lint distant dans le rate limiter.
Le domaine `https://spec.inforeole.fr` sert le bundle v2.
Les RPC v2 refusent les tokens invalides et l'appel direct à `create_user` est interdit au rôle anonyme.
Le test croisé transactionnel crée deux utilisateurs et deux tokens temporaires, valide l'isolation des chargements, sauvegardes et réinitialisations, puis annule toutes les données de test.
La migration `20260729202858_revoke_legacy_session_rpcs.sql` révoque les trois anciennes signatures pour `PUBLIC`, `anon`, `authenticated` et `service_role`.
Les ACL effectives ne conservent que le propriétaire `postgres`.
L'API publique répond HTTP 401 sur l'ancienne RPC et aucun compte temporaire ne subsiste.

Ordre obligatoire:

1. [x] Appliquer `20260729194159_secure_session_rpcs.sql`.
2. [x] Appliquer `20260729201527_fix_api_rate_limit_conflict.sql`.
3. [x] Déployer le client qui appelle les RPC v2.
4. [x] Vérifier en production le chargement, la sauvegarde et la réinitialisation avec deux comptes distincts.
5. [x] Générer avec la CLI Supabase une migration séparée qui révoque `load_user_session(uuid)`, `save_user_session(uuid, jsonb, text, integer, text, boolean, integer)` et `clear_user_session(uuid)`.
6. [x] Appliquer cette migration de révocation.
7. [x] Contrôler les ACL effectives en base avant de fermer cette dette.

Les alertes sur les tables `pm_*` appartiennent à ProspectMiner et ne doivent pas être corrigées depuis ce dépôt.
