# Spec Refiner

Application d'aide à la spécification de projets SaaS, propulsée par l'IA (Claude 3.5 Sonnet via OpenRouter).

## Installation

1.  Cloner le repo
2.  `npm install`
3.  Créer un fichier `.env` (voir `.env.example` ou ci-dessous)
4.  `npm run dev`

## Configuration (.env)

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-......
VITE_APP_PASSWORD=Vive2026#
```

## Déploiement sur Vercel (Recommandé)

Le moyen le plus simple de mettre en ligne cette application est d'utiliser [Vercel](https://vercel.com).

### Option 1 : Via l'interface Web (Si le code est sur GitHub)
1.  Poussez votre code sur GitHub.
2.  Allez sur [Vercel](https://vercel.com/new).
3.  Importez votre repo GitHub.
4.  Dans la section "Environment Variables", ajoutez :
    - `VITE_OPENROUTER_API_KEY` : Votre clé API OpenRouter.
    - `VITE_APP_PASSWORD` : `Vive2026#` (ou autre mot de passe de votre choix).
5.  Cliquez sur **Deploy**.

### Option 2 : Via la ligne de commande (Directement depuis votre ordinateur)
1.  Installez Vercel CLI :
    ```bash
    npm i -g vercel
    ```
2.  Dans le dossier du projet, lancez :
    ```bash
    vercel
    ```
3.  Suivez les instructions (répondez `Y` à "Set up and deploy?").
4.  Quand on vous demande de configurer les variables d'environnement, dites `N` si vous voulez le faire plus tard dans l'interface web, ou `Y` pour les entrer maintenant.
    - Important : N'oubliez pas d'ajouter `VITE_OPENROUTER_API_KEY` et `VITE_APP_PASSWORD` dans les réglages du projet sur le tableau de bord Vercel (Settings > Environment Variables) si vous ne l'avez pas fait pendant la commande.
5.  Pour mettre à jour en production :
    ```bash
    vercel --prod
    ```
