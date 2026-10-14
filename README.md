# Daily N — site prêt pour GitHub Pages

Défi Pokémon quotidien jouable dans le navigateur : six Pokémon tirés pour la journée affrontent l'équipe de N. Le combat utilise **Pokémon Showdown génération V** intégré au site ; ce n'est pas la ROM DS originale. La sauvegarde et les statistiques restent dans le navigateur de chaque joueur (`localStorage`) : il n'y a ni compte, ni serveur, ni classement partagé.

## Mettre en ligne avec GitHub Pages

1. Créer un **nouveau dépôt public** sur GitHub et y envoyer **le contenu de ce dossier** (`Daily-N-GitHub`), y compris `docs/` et `.gitignore`. `docs/index.html` est déjà le site compilé : ne sélectionner ni `src/` ni `dist/` comme source de publication.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Deploy from a branch**. Choisir la branche principale (`main`, ou son nom réel), le dossier **`/docs`**, puis **Save**.
3. Attendre la publication ; l'adresse du site apparaît ensuite en haut de la page **Settings → Pages**. Pour un dépôt de projet, elle ressemble à `https://VOTRE-NOM.github.io/NOM-DU-DEPOT/`.

Il n'est pas nécessaire d'installer Node.js sur GitHub : `docs/` contient le site statique prêt à publier. Le nom du dépôt peut être choisi librement, car les chemins des fichiers compilés sont relatifs.

## Modifier le site plus tard

Installer Node.js (version 22 ou plus récente), puis dans ce dossier :

```sh
npm ci
npm test
npm run dev
```

Pour mettre à jour **à la fois le code et les fichiers publiés** :

```sh
npm run pages
```

Puis envoyer les fichiers modifiés, **notamment `docs/`**, au même dépôt. `npm run pages` reconstruit `dist/`, remplace `docs/` et crée `.nojekyll` ; ne pas modifier `docs/` à la main. `node_modules/` et `dist/` sont exclus du dépôt.

## Notes

- Une adresse GitHub Pages utilise un autre stockage local que `localhost` : les anciennes parties et statistiques locales ne sont pas transférées automatiquement.
- Les sprites Pokémon et certaines polices sont chargés depuis des services externes : leur affichage nécessite une connexion Internet. Le sprite de N est fourni localement dans `public/assets/n-trainer.png`.
- Ce projet amateur n'est pas affilié à Nintendo, The Pokémon Company, GAME FREAK ou Creatures. Les personnages et visuels Pokémon appartiennent à leurs ayants droit. Le moteur provient de `@pkmn/sim` (Pokémon Showdown) ; les sprites Pokémon distants proviennent des ressources PokeAPI.
