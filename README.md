# Places Explorer — JHB · DBN · CPT

Explorateur de lieux (restaurants, cafés, galeries, attractions) avec **score voyageur**
et **recherche multi-critères**. Les données sont lues depuis `src/assets/data/` —
aucun chargement de fichier nécessaire.

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production dans dist/
```

## Ajouter vos données

Remplacez le contenu des 3 fichiers par vos exports complets (mêmes structures que
les exemples fournis) :

```
src/assets/data/jhb.json   → Johannesburg
src/assets/data/dbn.json   → Durban
src/assets/data/cpt.json   → Cape Town
```

Structure attendue : `{ "Zone, Province": { "Catégorie": [ lieux... ] } }` où chaque
lieu contient `name`, `address`, `types`, `global_rating`, `total_ratings_count`,
`price_level`, `price_range`, `reviews_last_12_months`.

## Critères de recherche (combinables)

- **Zone** et **catégorie**
- **Recherche texte** sur le nom et les types (ex : "pizza", "indien")
- **Note minimale** (4.5 à 4.8★) et **nombre d'avis minimal** (fiabilité)
- **Niveau de prix** (€/€€/€€€) et **budget max** en ZAR
- **🏆 Crème de la crème** : score voyageur ≥ 72
- Toggles **Service salué**, **Bonne ambiance**, **Qualité-prix** (détectés dans les avis)
- **Tri** : score voyageur, note, nombre d'avis, prix croissant

## Score voyageur (0–100)

| Critère | Poids | Détail |
|---|---|---|
| Note fiabilisée | 40 | Moyenne bayésienne (m=50, C=4.2) : neutralise les 5★ à 1 avis |
| Avis récents | 25 | Moyenne + volume des 12 derniers mois |
| Signaux qualitatifs | 25 | Mots-clés service/ambiance/qualité-prix, pénalité par avis ≤ 2★ |
| Accessibilité prix | 10 | Bonus si fourchette basse |

Réglages dans `src/lib/score.js` : `CREME_THRESHOLD` (seuil du badge) et `m`
(sévérité vis-à-vis des lieux peu notés).

## Arborescence

```
src/
├── App.jsx                    # Onglets JHB/DBN/CPT + import des données
├── assets/data/*.json         # Vos données (une ville par fichier)
├── lib/
│   ├── score.js               # Score voyageur + cache
│   └── format.js              # Helpers d'affichage
└── components/
    ├── CityView.jsx           # Barre de critères + grille de résultats
    ├── PlaceCard.jsx          # Carte d'un lieu (infos prioritaires)
    ├── DetailsModal.jsx       # Popup détails + décomposition du score
    └── Shared.jsx             # Étoiles, badges types, prix
```
