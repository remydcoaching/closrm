# Template Questionnaire HTML interactif

## Quand utiliser
Quand l'utilisateur demande une checklist, un questionnaire, ou un formulaire de test a remplir.

## Instructions pour Claude

1. Creer un fichier HTML dans `docs/` avec un nom descriptif (ex: `checklist-nom-du-sujet.html`)
2. Utiliser le template ci-dessous en adaptant uniquement la variable `data` (sections + items)
3. Ouvrir le fichier automatiquement avec `open <chemin>`
4. Dire a l'utilisateur de cliquer "Copier le rapport" une fois termine et de coller le resultat

## Regles du template
- Dark theme (#0a0a0f background)
- Boutons OK (vert) et KO (rouge) par item
- Champ note qui s'ouvre automatiquement sur un KO
- Badge par section : A tester / En cours / OK / KO
- Compteurs globaux OK / KO / A tester
- Bouton "Copier le rapport" qui genere un rapport markdown dans le presse-papier
- Construction DOM via `createEl()` (pas de innerHTML)
- Pas de dependance externe

## Structure de la variable data

```javascript
const data = [
  {
    id: 1,
    title: "Titre de la section",
    items: [
      "Premier point a verifier",
      "Deuxieme point a verifier"
    ]
  },
  {
    id: 2,
    title: "Autre section",
    items: [
      "Point A",
      "Point B",
      "Point C"
    ]
  }
];
```

## Fichier de reference
Copier la structure complete depuis `docs/checklist-bugs-athlete.html` et adapter uniquement :
- Le `<title>` de la page
- Le `<h1>` et le `.subtitle`
- La variable `data` avec les nouvelles sections/items
- Le titre dans `exportResults()` ("Rapport Test X — ")
