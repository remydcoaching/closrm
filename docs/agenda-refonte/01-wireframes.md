# Agenda — Wireframes Phase 1

> ASCII bas-fi des 3 vues (week, day, month) + side panel + sidebar gauche.
> Ce qui compte ici : **disposition, hiérarchie, densité**. Pas les couleurs, pas les pixels exacts.

---

## Layout général (toutes vues, desktop ≥1280px)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ AGENDA  Mai 2026             [<] [Aujourd'hui] [>]    [Jour|Semaine|Mois]  [+]   │
├─────────────────┬────────────────────────────────────────────┬───────────────────┤
│ MINI-CAL        │                                            │ DETAIL PANEL      │
│ ┌─────────────┐ │                                            │ (visible si       │
│ │ Mai 2026  ↕│ │                                            │  event selected)  │
│ │ L M M J V S D│                                            │                   │
│ │  1 2 3 4 5  │ │             MAIN VIEW AREA                 │ [titre]           │
│ │ 6 7 8 9 ●12│ │  (week / day / month — voir ci-dessous)    │ [horaires]        │
│ │ 13 ........ │ │                                            │ [lead infos]      │
│ └─────────────┘ │                                            │ [actions]         │
│                 │                                            │                   │
│ MES CALENDRIERS │                                            │                   │
│ ☑ ● Setting     │                                            │                   │
│ ☑ ● Closing     │                                            │                   │
│ ☑ ● Discovery   │                                            │                   │
│ ☑   Personnel   │                                            │                   │
│                 │                                            │                   │
│ FILTRES         │                                            │                   │
│ ☑ Confirmés     │                                            │                   │
│ ☐ Annulés       │                                            │                   │
│ ☐ No-show       │                                            │                   │
│                 │                                            │                   │
│ [Templates ↗]   │                                            │ [Fermer]          │
│ [Importer ↗]    │                                            │                   │
└─────────────────┴────────────────────────────────────────────┴───────────────────┘
   240px              flex (≥800px)                                380px
```

**Notes** :
- La **sidebar gauche 240px remplace le `FilterPanel` flottant actuel** — toujours visible, pas un overlay.
- Le **side panel droit 380px** s'ouvre sur sélection d'event (push le contenu, pas overlay) sur desktop. Sheet bottom sur mobile.
- Le bouton `+` (Nouveau RDV) est dans la toolbar, et déclenche aussi `c` au clavier.
- Recherche globale `Cmd+K` (V2, hors scope cette refonte).

---

## Vue SEMAINE (cœur du module)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│       │ Lun 28 │ Mar 29 │ Mer 30 │ Jeu 1  │ Ven 2  │ Sam 3  │ Dim 4         │
│       │        │        │        │ ⚪TODAY│        │        │               │
├───────┼────────┼────────┼────────┼────────┼────────┼────────┼───────────────┤
│ Toute │ ▓▓▓Off ▓▓▓ │       │       │       │       │       │       │       │
│ jour  │       │       │       │       │       │       │       │              │
├───────┼────────┼────────┼────────┼────────┼────────┼────────┼───────────────┤
│ 08:00 │       │       │       │       │       │       │       │              │
│ 08:30 │       │       │       │ │■■■■│       │       │       │              │
│ 09:00 │ │■■■│ │       │       │ │Léa│       │       │       │              │
│ 09:30 │ │Mat│ │       │       │ │09:30│      │       │       │              │
│ 10:00 │       │       │       │ ────────  ← NOW LINE 2px primary             │
│ 10:30 │       │       │ │■■■│ │       │       │       │       │              │
│ 11:00 │       │       │ │Tom│ │       │       │       │       │              │
│ 11:30 │       │       │       │       │       │       │       │              │
│ 12:00 │       │       │       │       │       │       │       │              │
│ 12:30 │       │       │       │       │       │       │       │              │
│ 13:00 │       │       │       │       │       │       │       │              │
│ 13:30 │       │       │       │       │       │       │       │              │
│ 14:00 │ │■◢│■■│       │       │       │       │       │       │              │
│ 14:30 │ │A│B │       │       │       │       │       │       │ ← conflit 50/50│
│ 15:00 │ │ │  │       │       │       │       │       │       │              │
│ 15:30 │       │       │       │       │       │       │       │              │
│ 16:00 │       │       │       │       │       │       │       │              │
│ ...   │       │       │       │       │       │       │       │              │
└───────┴────────┴────────┴────────┴────────┴────────┴────────┴───────────────┘
   60px      flex                                                              

LÉGENDE EVENT CARD :
┌────────────────────────┐
│┃Léa Martin            │ ← barre gauche 3px (color full opacity)
│┃09:30 — 10:00         │ ← fond fill 10% opacity de la couleur
│┃Setting · Visio        │ ← title bold 13px / time 11px tabular-nums / sub 11px @ 60%
└────────────────────────┘
```

**Comportements clés** :
- Click slot vide → quick-create inline (input "Untitled" focusé) avec start/end auto
- Drag dans une colonne vide → crée event de la durée draggée
- Click event → side panel droit s'ouvre
- Hover event → tooltip après 400ms (description, lead, location)
- Drag event → reschedule (dnd-kit)
- Today column = background +2% lighter (pas de fill saturé)
- Now line = `border-top: 2px solid var(--color-primary)` qui traverse uniquement la colonne du jour, point rouge à gauche dans la gutter horaires
- All-day banner 24px en haut
- Conflits 50/50 horizontal, jamais d'overlay

---

## Vue JOUR

Identique à week mais une seule colonne (full width). Densité plus grande, slots plus larges.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│       │ Jeudi 1 mai                                                          │
├───────┼──────────────────────────────────────────────────────────────────────┤
│ Toute │ ▓▓▓ Off journée — Férié 1er mai ▓▓▓                                  │
│ jour  │                                                                      │
├───────┼──────────────────────────────────────────────────────────────────────┤
│ 08:00 │                                                                      │
│ 08:30 │ ┃■■■ Léa Martin                                                      │
│ 09:00 │ ┃   08:30 — 09:30                                                    │
│ 09:30 │ ┃   Setting · Google Meet                                            │
│ 10:00 │ ──────────────────────────────────────  ← NOW                        │
│ 10:30 │ ┃■■■ Tom Renard                                                      │
│ 11:00 │ ┃   10:30 — 11:00                                                    │
│ 11:30 │                                                                      │
│ ...   │                                                                      │
└───────┴──────────────────────────────────────────────────────────────────────┘
```

---

## Vue MOIS

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  LUN     MAR     MER     JEU     VEN     SAM     DIM                         │
├────────┬───────┬───────┬───────┬───────┬───────┬───────────────────────────┤
│ 28     │ 29    │ 30    │ 1     │ 2     │ 3     │ 4                          │
│ ●Léa   │ ●Tom  │       │ ●Mat  │       │       │                            │
│ ●Anto  │       │       │ ●Léa  │       │       │                            │
│ +3 ▾   │       │       │ ●Tom  │       │       │                            │
├────────┼───────┼───────┼───────┼───────┼───────┼───────────────────────────┤
│ 5      │ 6     │ 7     │ 8     │ 9     │ 10    │ 11                         │
│        │       │       │       │       │       │                            │
│        │       │       │       │       │       │                            │
└────────┴───────┴───────┴───────┴───────┴───────┴───────────────────────────┘
```

**Comportements** :
- Click sur la cellule (zone vide) → bascule en day view
- Click event mini → side panel
- "+N ▾" → popover qui liste tous les events du jour, ou click → day view
- Today : background +2% lighter, numéro en bold rouge primary

---

## Side Panel (détail event)

```
┌──────────────────────────────────────┐
│ Léa Martin                       [×] │
│ Setting · Confirmé                   │
├──────────────────────────────────────┤
│ 🕐 Jeu 1 mai · 09:30 — 10:00         │
│ 📍 Google Meet                       │
│    [Ouvrir le lien]                  │
│                                      │
│ ── LEAD ────────────────────────     │
│ Léa Martin                           │
│ ✉ lea@coach.fr                      │
│ ☎ +33 6 12 34 56 78                  │
│ [Voir la fiche →]                    │
│                                      │
│ ── NOTES ───────────────────────     │
│ Discovery call. Cherche programme    │
│ remise en forme post-grossesse.      │
│                                      │
│ ── ACTIONS ─────────────────────     │
│ [✓ Marquer terminé]                  │
│ [⨯ Annuler]                          │
│ [→ Reprogrammer]                     │
│ [🗑 Supprimer]                       │
└──────────────────────────────────────┘
```

---

## Mobile (≤768px)

```
┌──────────────────────────────────────┐
│ ☰ AGENDA  Jeu 1 mai          [+]     │
├──────────────────────────────────────┤
│ [Jour|Semaine|Mois]                  │
│  ⚫    ─        ─                     │
├──────────────────────────────────────┤
│  [<]  Jeu 1 mai 2026  [>]            │
│       Aujourd'hui                    │
├──────────────────────────────────────┤
│ ▓▓▓ Off — Férié 1er mai ▓▓▓          │
│                                      │
│ 09:30 ┃ Léa Martin                   │
│       ┃ Setting · Google Meet        │
│ ─── NOW ───                          │
│ 10:30 ┃ Tom Renard                   │
│       ┃ Setting                      │
│                                      │
└──────────────────────────────────────┘

- Sidebar gauche → drawer accessible via ☰
- Side panel détail → sheet bottom (60% hauteur)
- Week view sur mobile = scroll horizontal des 7 colonnes
- Day par défaut sur mobile (plus lisible)
- Swipe gauche/droite = nav entre jours/semaines selon view active
```
