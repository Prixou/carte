# Carte — ouverture de boosters Pokémon

Application web pour ouvrir des boosters de **toutes les extensions Pokémon TCG** (176 extensions, des premiers boosters de 1999 jusqu'à la série *Méga-Évolution*) et construire sa collection.

## Lancer

```bash
npm start      # http://localhost:8080
npm test       # tests du moteur de tirage
```

Aucune dépendance, aucune étape de build : ce sont des fichiers statiques (modules ES). Le dossier peut être publié tel quel (GitHub Pages, Netlify…). Une connexion internet est nécessaire : les données et les images sont chargées à la demande.

## Fonctionnalités

- Liste des extensions groupées par série, avec recherche, filtre par série / type et tri par date.
- Ouverture animée : on déchire le booster, puis on retourne les cartes une à une (clic, Espace, Entrée ou →), ou « Tout révéler ». La meilleure carte sort en dernier.
- Cartes inclinables en 3D avec reflet holo, halo selon la rareté, badge « Nouvelle », zoom sur chaque carte.
- Collection sauvegardée dans le navigateur (`localStorage`) : classeur par extension (cartes possédées / manquantes), statistiques, meilleure carte tirée.

## Composition des boosters

Les taux sont des approximations, pas les taux officiels.

| Époque | Cartes | Contenu |
| --- | --- | --- |
| jusqu'en 2002 | 11 | 6 communes, 3 peu communes, 1 énergie, 1 rare (holo possible) |
| 2003 – 2022 | 10 | 5 communes, 3 peu communes, 1 reverse, 1 rare ou mieux |
| 2023 et après (Écarlate/Violet, Méga-Évolution) | 10 | 4 communes, 3 peu communes, 1 reverse, 1 rare ou mieux, 1 emplacement « chasse » (environ 28 % de chances d'une Illustration Rare, Illustration Spéciale, Hyper Rare…, sinon une reverse) |
| Promos, McDonald's, galeries, coffrets (51 extensions sans vrai booster) | 5 | « Pochette » : 5 cartes distinctes pondérées par rareté |

Un booster ne contient jamais deux fois la même carte. La logique est dans `js/pack.js` (pure, testée dans `test/`).

## Données

Les extensions et les cartes viennent du dépôt communautaire [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data) (JSON statiques servis par `raw.githubusercontent.com`) ; les images sont celles référencées dans ces données. Les noms de cartes sont donc en anglais. Les nouvelles extensions apparaissent automatiquement quand ce dépôt est mis à jour.

Projet de fan non officiel. Pokémon et les noms de cartes sont des marques de Nintendo, Creatures Inc. et GAME FREAK inc.
