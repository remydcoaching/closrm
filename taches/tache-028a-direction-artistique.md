# Tâche 028a — Direction artistique Funnels v2 (presets + effets + design tokens)

> **Statut :** ⬜ Non démarré
> **Développeur :** Rémy
> **Sous-tâche de :** [T-028](tache-028-funnels-v2.md)
> **Branche Git prévue :** `feature/remy-funnels-v2-direction-artistique`
> **Date de planification :** 2026-04-07

---

## Objectif

Construire le **design system visuel** de Funnels v2 : un catalogue de 20 presets de couleurs + 15 effets visuels réutilisables, exposés comme CSS modules / CSS variables, et utilisables ensuite par les blocs (T-028c) et le builder (T-028b).

À la fin de cette tâche, on doit pouvoir :
- Importer un preset par son ID et appliquer toutes ses CSS vars sur un container
- Activer/désactiver chaque effet toggleable indépendamment
- Voir le rendu en sandbox isolée (page de preview interne)

---

## Périmètre

### Inclus

- **Catalogue de 20 presets** typés `FunnelPreset` avec : `id`, `name`, `style: 'light' | 'dark'`, `primary`, `heroBg`, `sectionBg`, `footerBg`. Liste finale identique au mockup [mockups/t028a-preview.html](../mockups/t028a-preview.html) lignes 374-395.
- **Helpers couleur** : `hexToRgb`, `lighten`, `darken`, `getComputedTextColors(style)` (calculs identiques au mockup).
- **15 effets visuels** packagés en CSS modules (1 fichier par effet) ou CSS classes utilitaires sous le namespace `.fnl-*` :

  | Code | Nom | Catégorie | Default |
  |---|---|---|---|
  | **E1** | Shimmer texte | 🎛️ Toggle | ON |
  | **E2** | Hero glow (`::before`/`::after` radial) | 🎛️ Toggle | ON |
  | **E3** | Button shine animé | 🎛️ Toggle | ON |
  | **E4** | Colored shadow boutons | 🔒 Forcé | — |
  | **E5** | Badge pulse (dot animation) | 🔒 Forcé | — |
  | **E6** | Lightbox images témoignages | 🔒 Forcé | — |
  | **E7** | Count-up animé (chiffres clés) | 🎛️ Toggle | ON |
  | **E8** | Reveal au scroll (fade-in-up) | 🎛️ Toggle | ON |
  | **E9** | Marquee logo bar | 🎛️ Toggle | OFF |
  | **E10** | Countdown timer (urgence) | 🎛️ Toggle | OFF |
  | **E11** | Avant/Après slider (drag) | 🎛️ Toggle | OFF |
  | **E12** | Noise overlay (texture grain SVG) | 🎛️ Toggle | ON |
  | **E13** | Parallax léger sur fond hero | 🎛️ Toggle | OFF |
  | **E14** | Cursor glow desktop | 🎛️ Toggle | OFF |
  | **E15** | Sticky CTA mobile | 🎛️ Toggle | ON |
  | **(bonus)** | Hover transitions boutons + images | 🔒 Forcé | — |

  Soit **5 effets forcés** (toujours actifs) + **10 effets toggleables** au global.

- **Design tokens via CSS vars** sous un container `.fnl-root` :
  ```css
  --fnl-primary, --fnl-primary-light, --fnl-primary-dark, --fnl-primary-rgb,
  --fnl-hero-bg, --fnl-section-bg, --fnl-footer-bg,
  --fnl-text, --fnl-text-secondary
  ```

- **Page sandbox interne** : route `/dev/funnels-sandbox` (en dev only) qui réplique le mockup HTML mais en composant React, pour tester chaque preset et chaque toggle d'effet en live. Cette page sera la **preview** utilisée par T-028b plus tard.

- **Override de couleur post-preset** : helper `applyPresetWithOverride(preset, override?: { primary?: string })` qui permet à un user de tweaker la couleur principale d'un preset choisi.

### Exclus (autres sous-tâches)

- ❌ Migration des blocs existants ([HeroBlock, VideoBlock, FormBlock, ...]) → **T-028c**
- ❌ Sidebar du builder avec sélecteur de presets / toggles d'effets → **T-028b**
- ❌ Persistance des choix preset+effets en base (table funnels) → **T-028b**
- ❌ Drag & drop / undo-redo / inspector → **T-028b**
- ❌ Templates pré-faits par niche → reportée hors V1

---

## Fichiers concernés

### Fichiers à créer (estimation)

| Fichier | Description |
|---|---|
| `src/lib/funnels/presets.ts` | Catalogue typé des 20 presets + helpers `lighten/darken/hexToRgb` |
| `src/lib/funnels/types.ts` | Types `FunnelPreset`, `FunnelEffectId`, `FunnelEffectsConfig` |
| `src/lib/funnels/effects-defaults.ts` | Config par défaut des 10 effets toggleables (ON/OFF) |
| `src/lib/funnels/apply-preset.ts` | Helper d'application CSS vars + override couleur |
| `src/styles/funnels/tokens.css` | Définition des CSS vars `--fnl-*` sur `.fnl-root` |
| `src/styles/funnels/effects/e1-shimmer.css` | E1 |
| `src/styles/funnels/effects/e2-hero-glow.css` | E2 |
| `src/styles/funnels/effects/e3-button-shine.css` | E3 |
| `src/styles/funnels/effects/e4-colored-shadow.css` | E4 (forcé) |
| `src/styles/funnels/effects/e5-badge-pulse.css` | E5 (forcé) |
| `src/styles/funnels/effects/e6-lightbox.css` | E6 (forcé) |
| `src/styles/funnels/effects/e7-count-up.css` + `.ts` | E7 (CSS + petit hook IntersectionObserver) |
| `src/styles/funnels/effects/e8-reveal-scroll.css` + `.ts` | E8 |
| `src/styles/funnels/effects/e9-marquee.css` | E9 |
| `src/styles/funnels/effects/e10-countdown.css` + `.tsx` | E10 (composant React Countdown) |
| `src/styles/funnels/effects/e11-before-after.css` + `.tsx` | E11 |
| `src/styles/funnels/effects/e12-noise.css` | E12 |
| `src/styles/funnels/effects/e13-parallax.css` + `.ts` | E13 |
| `src/styles/funnels/effects/e14-cursor-glow.css` + `.ts` | E14 |
| `src/styles/funnels/effects/e15-sticky-cta.css` | E15 |
| `src/styles/funnels/effects/index.ts` | Barrel export + map id → CSS class |
| `src/app/dev/funnels-sandbox/page.tsx` | Page sandbox de test (dev only) |

### Fichiers à consulter (sans modification)

| Fichier | Raison |
|---|---|
| [mockups/t028a-preview.html](../mockups/t028a-preview.html) | Source de vérité — ports de TOUS les CSS effects + presets |
| [Prompt — Tunnel de vente.pdf](../Prompt — Tunnel de vente.pdf) | Réf détails effets (timings animations, valeurs box-shadow, etc.) |
| `src/types/index.ts` | Types `FunnelBlockConfig` existants à compléter (sans casser) |
| `src/components/funnels/blocks/*` | Lecture seule pour comprendre l'API existante (modifs en T-028c) |

---

## Phases d'exécution

### Phase 1 — Audit (avant tout code)
- Lire les 12 blocs existants dans [src/components/funnels/blocks/](../src/components/funnels/blocks/)
- Lister les écarts de chaque bloc vs mockup + PDF (rapport "écarts par bloc")
- Identifier les CSS classes / propriétés à conserver vs à dégager

### Phase 2 — Catalogue presets + design tokens
- Créer `presets.ts`, `types.ts`, `tokens.css`, `apply-preset.ts`
- Tester l'application sur un container vide via la sandbox

### Phase 3 — Effets forcés (E4, E5, E6, hover)
- Implémenter les 5 effets non négociables
- Tester sur un bouton/image/badge isolés dans la sandbox

### Phase 4 — Effets toggleables ON par défaut (E1, E2, E3, E7, E8, E12, E15)
- Les plus importants visuellement
- Vérifier qu'on peut les désactiver via `effects-defaults.ts`

### Phase 5 — Effets toggleables OFF par défaut (E9, E10, E11, E13, E14)
- Plus avancés / niche
- Bien vérifier les performances (E13 parallax, E14 cursor glow = potentiels problèmes mobile)

### Phase 6 — Page sandbox complète
- Reproduire la structure du mockup HTML en React
- Sélecteur de preset (dropdown ou cards) + toggles d'effets (checkboxes)
- Override couleur principale via color picker

### Phase 7 — Validation Rémy
- Démo de la sandbox
- Ajustements presets/effets si besoin
- Tag livraison T-028a → on enchaîne T-028c

---

## Tâches liées

| Relation | Tâche | Description |
|---|---|---|
| Sous-tâche de | [T-028](tache-028-funnels-v2.md) | Tâche parente |
| Bloque | [T-028c](tache-028c-blocks-migration.md) | T-028c utilise les CSS modules de T-028a |
| Bloque | [T-028b](tache-028b-builder-ux.md) | T-028b utilise les presets + effets en sidebar |

---

## Notes techniques (décisions prises pendant l'implémentation)

- **CSS pur scopé `.fnl-root` plutôt que CSS modules ou Tailwind** : Tailwind v4 utilise `@theme inline` dans `src/app/globals.css` avec ses propres `--color-*` (couleurs CRM). Pour éviter la collision et garder la possibilité d'isoler le design system funnels, on a opté pour des CSS files classiques importés directement dans la sandbox/blocs. Toutes les classes sont préfixées `.fnl-*` et scopées sous `.fnl-root` pour ne pas polluer le reste de l'app.
- **Stratégie d'activation des effets** : chaque effet toggleable correspond à une classe `fx-eX-name` ajoutée sur le `.fnl-root`. Le CSS de l'effet cible `.fnl-root.fx-eX-name .selecteur { ... }` pour ne s'appliquer que quand la classe est présente. Les effets forcés sont systématiquement inclus via `apply-preset.ts → getEffectsClassNames()`.
- **Override de couleur étendu à 4 champs** (validé par Rémy le 2026-04-07) : initialement prévu sur la couleur principale uniquement, on a étendu à `primary` + `heroBg` + `sectionBg` + `footerBg` à la demande de Rémy. Ajout d'un toggle "Lier les fonds 🔗" dans la sandbox qui propage la valeur aux 3 fonds en un clic. UX à porter à l'identique dans T-028b.
- **Risque contraste** : avec 4 couleurs overridables, possibilité de mauvais contraste texte/fond. À T-028b prévoir un avertissement WCAG AA via `luminance()` (déjà dans `color-utils.ts`).
- **Performance E12 noise overlay** : data-URI SVG inline, pas de requête HTTP.
- **Performance E13/E14** : désactivés automatiquement sur mobile (`max-width: 768px`) et `prefers-reduced-motion: reduce`, à la fois côté CSS (media queries) ET côté JS (les hooks `useParallax`/`useCursorGlow` skip leurs listeners).
- **`prefers-reduced-motion`** : géré sur tous les effets animés (E1 shimmer, E3 button shine, E5 badge pulse, E8 reveal scroll, E9 marquee).
- **Composants React vs CSS pur** : E7 count-up, E8 reveal scroll, E10 countdown, E11 before/after nécessitent du JS (IntersectionObserver, setInterval, drag events, RAF), donc accompagnés de composants/hooks dédiés. E1, E2, E3, E4, E5, E9, E12, E15 sont 100% CSS.
- **Tag dynamique de Reveal.tsx** : on utilise `as: 'div' | 'section' | 'article' | 'span'` mais TS ne peut pas typer correctement le `ref` polymorphique. Solution gardée simple : pas de ref forwardée vers le parent (le ref est interne au composant), donc pas besoin de `forwardRef` ni de ts-expect-error.
- **Bug builder existant** non touché conformément à la règle T-028 : `src/components/funnels/FunnelBuilder.tsx` et associés ont des erreurs de lint préexistantes, ignorées intentionnellement (sera refondu en T-028b).

---

## Résultat final

✅ **Phases 1-7 terminées le 2026-04-07.**

### Fichiers créés (24 nouveaux)

**Domain layer (`src/lib/funnels/`) — 5 fichiers**
| Fichier | Rôle |
|---|---|
| `design-types.ts` | Types `FunnelPreset`, `FunnelEffectId`, `FORCED_EFFECTS`, `TOGGLEABLE_EFFECTS`, `FunnelEffectsConfig`, `FunnelPresetOverride` (4 champs), `FunnelEffectMeta` |
| `color-utils.ts` | `hexToRgb`, `lighten`, `darken`, `luminance` (avec validation hex stricte) |
| `presets.ts` | Catalogue des **20 presets** + `getPresetById`, `getPresetByIdOrDefault`, `DEFAULT_PRESET_ID` |
| `effects-defaults.ts` | `DEFAULT_EFFECTS` (mapping ON/OFF) + `EFFECT_META` (labels FR pour la sidebar) + `mergeEffectsConfig` (force les 3 effets non négociables à `true`) |
| `apply-preset.ts` | `getPresetCssVars` (override 4 champs), `applyPresetToElement`, `getEffectsClassNames` |

**CSS — 9 fichiers d'effets + 2 fondations**
| Fichier | Effet / Rôle |
|---|---|
| `src/styles/funnels/tokens.css` | CSS vars `--fnl-*` par défaut (fallback Ocean) |
| `src/styles/funnels/base.css` | Reset + import Poppins + classes `.fnl-btn`, `.fnl-headline`, `.fnl-hook`, `.fnl-hero`, `.fnl-section`, `.fnl-footer` + hover transitions |
| `effects/e1-shimmer.css` | Shimmer texte (toggleable, ON) |
| `effects/e2-hero-glow.css` | Glow radial sur hero (toggleable, ON) |
| `effects/e3-button-shine.css` | Reflet animé sur boutons (toggleable, ON) |
| `effects/e4-colored-shadow.css` | Ombre colorée (forcé) |
| `effects/e5-badge-pulse.css` | Badge pulsant (forcé) |
| `effects/e6-lightbox.css` | Lightbox (forcé) |
| `effects/e7-count-up.css` | Typo + tabular-nums pour compteurs animés (toggleable, ON) |
| `effects/e8-reveal-scroll.css` | Fade-in-up au scroll (toggleable, ON) |
| `effects/e9-marquee.css` | Bandeau logos défilant (toggleable, OFF) |
| `effects/e10-countdown.css` | Compte à rebours JJ:HH:MM:SS (toggleable, OFF) |
| `effects/e11-before-after.css` | Slider avant/après (toggleable, OFF) |
| `effects/e12-noise.css` | Texture grain SVG (toggleable, ON) |
| `effects/e13-parallax.css` | Parallax léger sur hero (toggleable, OFF) |
| `effects/e14-cursor-glow.css` | Halo curseur (toggleable, OFF) |
| `effects/e15-sticky-cta.css` | CTA sticky mobile (toggleable, ON) |

**Composants React (`src/components/funnels/v2/`) — 6 fichiers**
| Fichier | Rôle |
|---|---|
| `Lightbox.tsx` | Composant + hook `useLightbox` (E6) |
| `CountUp.tsx` | Compteur animé via IntersectionObserver + RAF (E7) |
| `Reveal.tsx` | Wrapper fade-in-up via IntersectionObserver, supporte `delay` pour staggering (E8) |
| `Countdown.tsx` | Compte à rebours JJ:HH:MM:SS, gestion expiration (E10) |
| `BeforeAfter.tsx` | Slider draggable via pointer events unifiés souris/tactile (E11) |
| `use-parallax.ts` | Hook parallax avec auto-disable mobile / reduced-motion (E13) |
| `use-cursor-glow.ts` | Hook cursor glow avec auto-disable tactile / reduced-motion (E14) |

**Sandbox de test — 1 fichier**
- `src/app/dev/funnels-sandbox/page.tsx` : page de dev qui teste tous les presets + tous les effets en live, avec sélecteur de preset, 4 color pickers d'override, toggle "lier les fonds", panneau de 15 toggles d'effets, et démos visuelles complètes (hero, compteurs, témoignages, countdown, before/after, marquee logos, footer + sticky CTA mobile).

### Validation

- ✅ `npm run lint` : 0 erreur / 0 warning sur les fichiers livrés (les 35 erreurs pré-existantes du repo restent, conformes à la règle "ne pas fixer l'ancien builder")
- ✅ `npm run build` : `Compiled successfully` + route `/dev/funnels-sandbox` listée comme `○` (statique)
- ✅ Validation visuelle Rémy le 2026-04-07 sur les Phases 2-3-4 (presets + override + effets forcés), Phase 5 (7 effets ON), et Phase 6 (5 effets OFF)

### Décisions structurantes documentées

- Fiche T-028b : MAJ du périmètre sidebar avec les 4 color pickers + toggle "lier les fonds" + warning contraste WCAG
- Fiche T-028c : MAJ avec décision "BookingBlock + FormBlock = redesign visuel only, label À venir"
- `ameliorations.md` : 3 entrées créées (`A-028a-01` Booking branchement T-022, `A-028a-02` FormBlock submission, `A-028a-03` brand tokens partagés avec emails)

---

## Améliorations identifiées pendant cette tâche

- **A-028a-01** : Brancher BookingBlock sur le module Calendriers interne (T-022) — voir `ameliorations.md`
- **A-028a-02** : Persister les submissions FormBlock + créer un lead + rediriger — voir `ameliorations.md`
- **A-028a-03** : Renommer `--fnl-*` en `--brand-*` pour partager les design tokens avec le module Email (T-020) — voir `ameliorations.md`
- **(idée future)** : Avertissement de contraste WCAG AA dans le builder T-028b si le coach choisit des fonds incompatibles avec le `style: light/dark` du preset
- **(idée future)** : Permettre au coach de créer ses propres presets (Cmd+S sur un override custom) et les partager entre ses funnels
