# Spec client guidée et bornée

## Objectif

Permettre à un client non technique de fournir à Phil les informations métier nécessaires pour démarrer le développement.
L’application doit guider les décisions sans demander au client d’écrire une spécification technique.
Le livrable doit rendre visibles les inconnues et les contradictions au lieu de produire une fausse complétude.
Le produit doit empêcher la création de projets et de spécifications sans limite.

## Règles produit

Un compte correspond à un seul projet.
Un projet correspond à un seul lot.
Un lot correspond à une seule spécification logique.
La spécification reste modifiable après sa génération.
Une régénération crée une nouvelle version de la même spécification.
Les six versions les plus récentes sont conservées.
Les anciennes versions sont consultables et téléchargeables, mais elles ne sont pas restaurables.
Le dossier Brice a servi de matière pour valider le besoin et ne fait pas partie du produit ni de ses données de test.

## Utilisateurs

Le client connaît son métier mais ne connaît pas nécessairement le développement logiciel.
Phil utilise la spécification pour cadrer les choix techniques et lancer le développement.
L’application distingue donc les décisions métier du client des décisions techniques réservées à Phil.

## Principe inspiré d’OpenSpec

OpenSpec sépare l’intention, le comportement attendu, la conception technique et les tâches d’implémentation.
Spec Refiner reprend cette séparation comme modèle interne sans exposer son vocabulaire au client.
Le client travaille uniquement sur l’intention, le périmètre, les parcours, les règles métier et les cas particuliers.
La conception technique et les tâches ne sont jamais inventées à partir de réponses non techniques.

Le modèle interne contient les blocs suivants.

- L’intention décrit le problème, la cible et le résultat attendu.
- Le périmètre décrit ce qui est inclus et ce qui est explicitement exclu.
- Les capacités regroupent les comportements cohérents du produit.
- Les exigences décrivent les comportements attendus.
- Les scénarios décrivent les cas nominaux et les cas limites.
- Le registre des décisions distingue les décisions confirmées, les hypothèses, les contradictions et les inconnues.
- Les sources relient chaque exigence importante à une réponse ou à un document du client.

## Parcours client

### Démarrage

Un nouveau compte commence directement dans son unique projet.
L’application demande une description simple du besoin et accepte les documents de référence.
Elle explique que le client répond à des questions métier et que Phil prend ensuite en charge la conception technique.

### Définition du lot

L’application détecte les projets contenant plusieurs produits, populations ou parcours indépendants.
Elle propose un découpage lorsqu’un périmètre dépasse la capacité d’un seul lot.
Le client choisit un seul lot avant de poursuivre.
Les éléments écartés sont résumés dans une liste hors périmètre sans être détaillés.
Le client ne peut pas ouvrir un second lot dans son compte.

### Entretien guidé

Chaque question correspond à une information manquante du modèle interne.
Les questions utilisent un langage métier, des exemples et des options lorsque cela facilite la décision.
Le client peut répondre qu’il ne sait pas.
Une réponse inconnue devient une décision à prendre par Phil ou un blocage métier selon sa nature.
Le nombre d’échanges n’est plus utilisé comme indicateur de complétude.

### Progression

L’interface présente une progression par thème.
Les thèmes minimaux sont le périmètre, les utilisateurs, le parcours principal, les règles métier, les données, les cas particuliers et les dépendances externes.
Chaque thème possède un état parmi `à explorer`, `incomplet`, `complet` et `bloqué`.
Une synthèse explique les informations manquantes sans exposer le modèle OpenSpec.

### Génération

Le client peut générer une version de travail même si des informations non bloquantes manquent.
Le bouton indique `Générer une version de travail` lorsque le dossier contient encore des inconnues.
Le bouton indique `Générer la spec` lorsque les contrôles métier sont satisfaits.
Une contradiction bloquante empêche la déclaration `prête pour le développement`.
Le document utilise `[À DÉFINIR]` pour une information manquante et nomme la décision attendue.

## Garde-fous anti-slop

Un seul lot est détaillé.
Un lot contient au maximum huit capacités principales.
Un lot contient au maximum quarante exigences.
Chaque exigence prioritaire possède au moins un scénario et un critère d’acceptation.
Chaque exigence importante possède une source identifiable.
Chaque fonctionnalité future reste limitée à une ligne dans le hors périmètre.
Une contradiction est résolue ou signalée explicitement.
Une réponse du modèle ne peut pas transformer une hypothèse en décision confirmée.
Le corps principal du document vise un maximum de vingt-cinq pages.
Le dépassement d’une limite déclenche une proposition de réduction du périmètre au lieu d’allonger automatiquement le document.

## Structure du document produit

### Résumé du lot

Le résumé contient le problème, le résultat attendu, les utilisateurs et les indicateurs de réussite.

### Périmètre

Le périmètre sépare les éléments inclus, exclus et reportés.

### Parcours fonctionnels

Les parcours décrivent les actions de chaque utilisateur dans leur ordre réel.

### Exigences

Chaque exigence possède un identifiant stable.
Chaque exigence contient sa priorité, sa règle métier, ses scénarios, ses cas limites et ses critères d’acceptation.

### Données et dépendances

Cette section recense les données entrantes, les résultats attendus, les services externes, les contraintes de sécurité et les obligations réglementaires connues.

### Registre des décisions

Cette section sépare les décisions confirmées, les hypothèses, les contradictions résolues et les questions encore ouvertes.

### Préparation du développement

Cette section liste les choix techniques réservés à Phil, les preuves de faisabilité nécessaires et les dépendances à valider.
Elle ne propose pas d’architecture non validée.

## Modèle de données

### Session unique

La table `specrefiner_sessions` reste la session de travail unique du compte.
La contrainte existante d’une session par utilisateur matérialise la règle d’un projet unique.
La session conserve la conversation, la phase, le modèle structuré courant et la référence vers la dernière version générée.

Le modèle structuré est stocké en JSONB avec un numéro de schéma.
Il contient les blocs d’intention, de périmètre, de capacités, d’exigences, de scénarios, de décisions, de sources et de progression.
Le numéro de schéma permet une migration explicite si la structure évolue.

### Versions de spécification

Une nouvelle table `specrefiner_spec_versions` conserve les versions générées.
Chaque ligne contient un identifiant, l’utilisateur propriétaire, le contenu Markdown et l’horodatage de génération.
L’horodatage est attribué par PostgreSQL avec un `timestamptz` et ne dépend pas de l’horloge du navigateur.
Le contenu d’une version est immuable.
La création d’une septième version supprime la plus ancienne dans la même transaction.
Le tri utilise l’horodatage décroissant avec l’identifiant comme départage déterministe.

Les versions sont accessibles uniquement par des RPCs `SECURITY DEFINER`.
Les RPCs déduisent l’utilisateur du token de session.
Le client ne transmet jamais un identifiant utilisateur pour lire ou créer une version.
La suppression de l’utilisateur supprime ses versions par cascade.

### Compatibilité

La valeur `final_spec` existante est migrée vers une première version seulement lorsqu’elle contient un document.
Son horodatage initial utilise la date de migration faute d’horodatage historique fiable.
Le frontend accepte temporairement une session sans modèle structuré et initialise alors la version courante du schéma.

## Horodatage et nom de fichier

Chaque version affiche la date et l’heure de génération dans le fuseau `Europe/Paris`.
Le document Word reprend exactement l’horodatage stocké de la version.
Le nom du fichier suit le format `specifications-YYYY-MM-DD-HHmm.docx`.
Le téléchargement d’une ancienne version utilise son propre horodatage.
Un rafraîchissement de la page ou un téléchargement ultérieur ne modifie jamais cet horodatage.

## Historique des six versions

La version la plus récente est sélectionnée par défaut.
L’écran final présente une commande `Versions` avec les six horodatages disponibles.
La sélection d’une ancienne version passe l’écran en lecture seule.
Une ancienne version peut être consultée et téléchargée.
Une ancienne version ne peut être ni restaurée, ni modifiée, ni utilisée comme branche.
Le retour à la version actuelle est toujours visible.

## Blocage du recommencement

Le bouton destructif `Recommencer un nouveau projet` est supprimé.
Il est remplacé par une aide textuelle non destructive.

Le message affiché est le suivant.

> Votre compte est associé à un seul projet.
>
> Vous pouvez continuer à le compléter ou modifier ses spécifications.
>
> Pour changer de projet ou repartir de zéro, envoyez un message à Phil.

Le message ne contient ni bouton de contact, ni adresse, ni lien.
La seule action proposée est `Retour au projet`.
Le client ne dispose d’aucune RPC de réinitialisation.
La réinitialisation reste une opération administrateur explicite.

## Administration

Phil peut réinitialiser le projet d’un utilisateur depuis l’administration.
L’action supprime la session, les images associées et les versions de spécification.
Cette action est destructive et exige une confirmation nommant le compte ciblé.
La réinitialisation n’est pas exposée au client.

## Contrat de génération

La génération utilise le modèle structuré comme source principale.
La conversation et les documents restent disponibles comme sources de vérification.
Le prompt de génération impose les sections, les identifiants d’exigences et la distinction entre décision, hypothèse et inconnue.
La réponse générée est validée avant sa persistance.
La validation vérifie le marqueur attendu, le titre, la présence du périmètre, les exigences identifiées et le registre des décisions.
Une réponse invalide n’est pas enregistrée comme version.

## Erreurs et concurrence

Une double demande de génération ne crée pas deux versions.
Une clé d’idempotence ou un verrou serveur protège la création de version.
Une erreur de génération conserve la version précédente et le modèle structuré courant.
Une erreur de sauvegarde empêche l’interface d’annoncer que la version est créée.
Une erreur de purge de la septième version annule toute la transaction.
Une ancienne version absente après purge produit un état `Version indisponible` et revient vers la version actuelle.

## Sécurité et données

La migration ne modifie aucune donnée de production pendant son écriture ou ses tests locaux.
Le déploiement de la migration exige une validation explicite distincte.
Les limites existantes de taille, de fréquence et de tokens restent appliquées aux appels IA.
Les documents du client ne sont jamais utilisés comme exemples partagés entre comptes.
Les sources stockées dans le modèle structuré référencent des messages ou documents du même utilisateur.

## Tests

### Tests unitaires

Les tests couvrent le calcul des états de progression.
Les tests couvrent les limites de huit capacités et quarante exigences.
Les tests couvrent la détection des contradictions bloquantes.
Les tests couvrent la validation du document généré.
Les tests couvrent le format de l’horodatage et du nom de fichier.

### Tests de services

Les tests vérifient qu’un token ne peut lire que ses propres versions.
Les tests vérifient la création atomique d’une version.
Les tests vérifient la conservation exacte des six dernières versions.
Les tests vérifient que la septième génération supprime seulement la plus ancienne.
Les tests vérifient qu’une ancienne version ne peut pas être restaurée.
Les tests vérifient que le client ne peut plus appeler la réinitialisation.

### Tests d’interface

Le parcours nominal couvre l’entretien, la génération, la modification et la régénération.
Le parcours vérifie que la première version garde son horodatage après un rafraîchissement.
Le parcours vérifie la consultation et le téléchargement de chacune des six versions.
Le parcours vérifie l’absence de restauration.
Le parcours vérifie le message remplaçant le recommencement.
Le parcours vérifie qu’une ancienne version est clairement en lecture seule.

### Test de non-régression

Un compte existant avec une `final_spec` retrouve son document après migration.
Un compte sans spécification reprend son entretien sans perte de messages.
Le téléchargement Word continue de rendre correctement les titres, listes et tableaux.

## Hors périmètre

La création de plusieurs projets est exclue.
La création de plusieurs lots est exclue.
La restauration ou le branchement d’une ancienne version est exclu.
La collaboration entre plusieurs clients est exclue.
La génération automatique d’une architecture technique est exclue.
La génération automatique de tâches de développement est exclue.
L’intégration directe du CLI OpenSpec est exclue.
L’utilisation du dossier Brice dans les données de production ou les tests est exclue.

## Critères de réussite

Un client non technique peut terminer l’entretien sans vocabulaire de développement.
Phil peut distinguer immédiatement les décisions acquises des inconnues.
Une spécification trop large déclenche un recadrage avant sa génération.
Un compte ne peut conserver qu’un projet, un lot et une spécification logique.
Les six dernières générations restent traçables par leur horodatage réel.
Une ancienne version ne peut pas devenir une branche concurrente.
