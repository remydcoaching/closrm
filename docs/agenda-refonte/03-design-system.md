# Agenda — Mini design system

> Tokens et règles de rendu. Source unique de vérité pour les phases 3-7.

---

## Couleurs

```css
:root {
  /* Background */
  --agenda-bg: var(--bg-primary);              /* #0A0A0A */
  --agenda-surface: var(--bg-secondary);       /* #141414 */
  --agenda-surface-elevated: var(--bg-elevated);

  /* Grid */
  --agenda-grid-line: rgba(255, 255, 255, 0.08);
  --agenda-grid-line-strong: rgba(255, 255, 255, 0.12);
  --agenda-today-tint: rgba(255, 255, 255, 0.02);

  /* Now indicator */
  --agenda-now-color: var(--color-primary);    /* #E53E3E */
  --agenda-now-thickness: 2px;

  /* Texte */
  --agenda-text-primary: var(--text-primary);          /* 100% */
  --agenda-text-secondary: var(--text-secondary);      /* ~70% */
  --agenda-text-muted: var(--text-tertiary);           /* ~50% */
  --agenda-text-faint: rgba(255, 255, 255, 0.35);
}
```

**Règle : aucune couleur hardcodée hors de ces variables.**
Exception unique : la couleur d'un calendar (`booking_calendars.color`) qui est userland.

---

## Event card

```
┌─────────────────────┐
│┃ Léa Martin         │
│┃ 09:30 — 10:00      │
│┃ Setting · Visio    │
└─────────────────────┘
```

**Background** : `color-mix(in srgb, ${calColor} 10%, transparent)` (10% opacity)
**Bordure gauche** : 3px solid `${calColor}` (full opacity)
**Border radius** : 4px (jamais 8px+)
**Padding** : 4px 6px (long), 2px 6px (short ≤30min)
**Box-shadow** : aucune
**Hover** : `opacity: 0.85` + curseur pointer

### Typo

| Élément | Taille | Weight | Couleur |
|---|---|---|---|
| Title (lead name ou booking title) | 13px (long) / 11px (short) | 600 | `--text-primary` |
| Time `09:30 — 10:00` | 11px | 500 | `--text-secondary` |
| Sub (calendar name · location) | 11px | 400 | `--text-tertiary` (60% opacity) |

**Toujours** : `font-variant-numeric: tabular-nums` sur les heures.

### Variantes

- **Short ≤30min** : layout `flex-row` `align-items: center` `gap: 6`. Title + time sur une seule ligne. `min-width: 0` + `flex: 1` sur le title pour ellipsis correcte (cf. fix Phase 0).
- **Long >30min** : layout `flex-column`. Title sur ligne 1, time ligne 2, sub ligne 3 si présent.
- **Conflit (overlap)** : largeur partagée 50/50 (ou 1/n pour n events overlap), pas d'absolute overlay. Chaque event a son `left` et `width` calculés.
- **All-day** : bandeau horizontal 24px en haut, fond uni `${calColor}26`, pas de barre gauche.

---

## Grid

- Slot height : `32px` par 30min (= 64px/heure)
- Plage horaire visible par défaut : 7h-22h (15h × 64 = 960px). Scroll si plus.
- Gutter horaires (gauche) : 56px, fond `--agenda-bg`, sticky horizontal en mobile (Week scroll).
- Header colonnes : sticky top, fond `--agenda-bg`, border-bottom 1px `--agenda-grid-line-strong`
- Bordures cellules : `border-right` et `border-bottom` 1px `--agenda-grid-line`
- Heures pleines (8:00, 9:00, ...) : border-bottom légèrement plus marqué `--agenda-grid-line-strong`

### Today's column / today's day

- Background `--agenda-today-tint` (très léger)
- Numéro de jour en `--color-primary` bold
- **Pas de fill saturé** (anti-pattern Outlook/Google legacy)

### Now indicator

- Ligne horizontale `2px solid var(--color-primary)` qui traverse uniquement la colonne du jour courant (week view) ou la full-width (day view)
- Point rouge 8px circle dans la gutter à gauche, aligné sur la ligne
- Update toutes les 60s via `setInterval` dans le composant week/day
- Si `now` hors plage horaire visible (ex 23h45) : pas de ligne, pas de scroll auto

---

## Sidebar gauche (240px)

- Fond `--bg-secondary`
- Border right 1px `--border-secondary`
- Padding 16px

### Mini-cal
- Header : "Mai 2026" + flèches nav 16px lucide
- Grid 7 cols, cellules 28×28
- Today : background `--color-primary` 20%, texte `--color-primary`
- Selected : background `--text-primary` 8%
- Days hors mois courant : `opacity 0.3`
- Click un jour → navigue agenda + view passe en day si shift+click

### Cal list
- Section title : 11px uppercase letter-spacing 0.5 `--text-tertiary`
- Rows : 28px height, padding-x 4px, hover background `--bg-hover`
- Checkbox custom 14×14 carré radius 3px, color = cal color quand checked
- Label 13px `--text-primary`

---

## Side panel droit (380px)

- Fond `--bg-secondary`
- Border left 1px `--border-secondary`
- Header : 56px height, border-bottom, X en haut à droite
- Sections séparées par border-top 1px `--agenda-grid-line`
- Boutons d'action en bottom, sticky

---

## Toolbar (top)

- Height 56px, border-bottom 1px `--agenda-grid-line-strong`
- Padding 12px 20px
- Layout : title + nav (← Today →) à gauche / view tabs centre / actions droite

### View tabs (Day/Week/Month)
- Pill group avec fond `--bg-elevated`, padding 3, gap 2
- Tab active : fond `--border-secondary`, weight 600
- Tab inactive : transparent, color secondary

---

## Mobile breakpoint

- ≤768px : sidebar devient drawer accessible via ☰ en toolbar
- ≤768px : side panel devient sheet bottom 60% height
- ≤768px : default view = day (week scroll horizontal possible mais cramé)
- ≤480px : tabs Day/Week/Month → icônes seules

---

## Anti-règles (à ne jamais faire)

- ❌ Pas de `box-shadow` sur dark mode
- ❌ Pas de `border: 1px solid #444` ou `border-gray-700` — toujours `rgba(255,255,255,0.08-0.12)`
- ❌ Pas de gradient sur events
- ❌ Pas de fill saturé 100% sur les events (sauf all-day, et encore avec opacity réduite)
- ❌ Pas de border-radius >6px
- ❌ Pas de classe Tailwind dynamique `bg-${color}-500` (purge cassée — cf. CLAUDE.md global)
- ❌ Pas de `position: absolute` empilé sans `z-index` explicite issu de `Z_AGENDA`
