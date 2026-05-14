# Réseaux sociaux — refonte allégée

**Date** : 2026-05-06
**Auteur** : Pierre + Rémy (alignés en appel) via Claude Code brainstorming
**Cible** : `/acquisition/reseaux-sociaux` + `SlotDetailDrawer` + suppression `/montage`
**Supersede** : `2026-05-05-slot-drawer-progressive-design.md` (la refonte accordéon implémentée hier reste insuffisante en perçu utilisateur)

---

## Problème

Trois constats convergents :

1. **Page `/montage` redondante** — un kanban dédié au monteur avec sa propre interface (1244 lignes) qui duplique en simplifié ce que fait déjà `/acquisition/reseaux-sociaux`. Le monteur n'a pas besoin d'une page séparée : il accédera à la même page que le coach.

2. **Le `SlotDetailDrawer` reste trop lourd** malgré la refonte accordéon de la veille :
   - Layout 2 colonnes : moitié droite vide ("Aucun media à prévisualiser") sur 50 % d'écran quand pas de média.
   - 4 accordéons (Brief / Montage / Publication / Discussion) empilés verticalement dans une seule colonne de gauche → scrolling vertical permanent.
   - États vides affichés frontalement : "Aucun monteur dans ce workspace", "Aucune prestation", "Non payé / Marquer payé" tous visibles même quand il n'y a rien à gérer.
   - Header verbeux : pills (pillar + content_kind) puis titre puis cartes Date/Statut sur 3 lignes.
   - Performance : 2516 lignes dans un seul fichier ; polling 20 s permanent ; fetch complet du slot et metadata vidéo en synchrone à l'ouverture → "Chargement…" perceptible.

3. **Pas de gestion en masse** — créer 7 posts via la Trame, puis vouloir tout supprimer si erreur, demande aujourd'hui 7 clics individuels. Aucun groupement par "import" en DB.

L'objectif global : une page où ouvrir un post est **instantané**, où on voit **une seule étape à la fois** (celle qui me concerne), et où je peux supprimer **plusieurs posts d'un coup**.

## Non-objectifs

- Toucher au workflow de publication backend (cron, queues, Meta Graph API).
- Modifier les enums `production_status` / `status` ou leur sémantique.
- Refondre les pages inbox/analytics Instagram/YouTube (les 3 onglets plateforme en haut sont **conservés**).
- Toucher à la trame mensuelle (`content_trame_generations`).

---

## Solution — vue d'ensemble

| Élément | Avant | Après |
|---|---|---|
| Page `/montage` | Kanban dédié monteur | **Supprimée** — monteur va sur `/acquisition/reseaux-sociaux` |
| Vue par défaut | Board | **Calendrier** (toggle persisté en localStorage) |
| Drawer layout | 2 colonnes (gauche accordéons, droite preview) | **1 colonne**, preview média intégrée dans l'étape Montage uniquement |
| Drawer organisation | 4 accordéons empilés (Brief / Montage / Publication / Discussion) | **Stepper 3 étapes** (Brief · Montage · Publication) + **Discussion en footer permanent collapsé** |
| Étape ouverte par défaut | Calculée selon `production_status` (accordéon) | Identique mais **une seule étape rendue à la fois** |
| Vue monteur | Page `/montage` séparée | Identique au coach (même page, même drawer) ; bulk delete masqué pour le monteur |
| Sélection multiple | Aucune | **Checkboxes sur cards** + bouton "Supprimer N" |
| Historique imports | Aucun | **Page dédiée** — liste des batchs (Trame, multi-création) + bouton "Supprimer ce batch" |

---

## Détail UI — drawer redessiné

### Header compact (1 ligne)

```
[VIRAL] [REEL] · TEST ACCROCHE / HOOK · Lun. 4 Mai · À monter        [×]
```

- Pills pillar + content_kind à gauche (small, inline).
- Titre éditable au clic.
- Date prévue + statut en pills à droite, cliquables pour édition rapide.
- Bouton fermer aligné à droite.
- **Suppression** des cartes "Date prévue" et "Statut" qui doublaient l'info plus bas (déjà supprimées dans la refonte du 2026-05-05, à confirmer).

### Stepper horizontal (sous le header)

```
   ●─────●─────●
  Brief  Montage  Publication
   ✓      ●        ○
```

États visuels du rond :
- **Rempli vert** (`✓`) : l'étape est "complète" selon des critères data déterministes (voir plus bas).
- **Actif violet** (`●`) : étape actuellement affichée.
- **Vide gris** (`○`) : étape pas encore atteinte.

Cliquable : tu peux sauter à n'importe quelle étape, même non atteinte (navigation libre, pas de blocage).

L'étape ouverte par défaut au mount du drawer dépend de `production_status` :

| `production_status` | Étape ouverte |
|---|---|
| `idea`, `to_film` | Brief |
| `filmed`, `edited` | Montage |
| `ready` | Publication |

Quand `slot.status` ∈ {`scheduled`, `published`} → étape Publication ouverte (read-only).

Critères de "rond vert" (auto, pas de bouton) :
- **Brief vert** : `hook` non vide ET (`script` non vide OU `references_urls.length > 0`).
- **Montage vert** : `final_url` non vide.
- **Publication vert** : `enabledPlatforms.length > 0` ET `media_urls.length > 0`.

### Validation hybride — boutons d'action explicite

En bas de chaque étape (dans le contenu de l'étape, pas dans le stepper) :

- **Brief → bouton "Envoyer au montage"** : visible si `production_status` ∈ {`idea`, `to_film`}. Au clic → `production_status = filmed`, notifie le monteur (existing logic), bascule l'étape affichée vers Montage.
- **Montage → bouton "Valider le montage"** : visible si `final_url` rempli ET `production_status = edited`. Au clic → `production_status = ready`, bascule vers Publication.
- **Publication → bouton "Programmer"** existant inchangé.

Le rond vert = état des données. Le bouton = transition explicite. Les deux sont indépendants : tu peux avoir un brief vert sans avoir cliqué "Envoyer au montage" (tu écris encore).

### Contenu Étape Brief (1 colonne)

Champs identiques à aujourd'hui, simplement présentés dans l'unique zone du drawer :
- Hook (textarea + bouton ✨ Générer 5 hooks IA)
- Titre
- Script (textarea + bouton ✨ Générer un script IA)
- Références (liens drag-drop / paste)
- Notes coach

Pas de panneau preview à droite à cette étape.

### Contenu Étape Montage (1 colonne)

Layout repensé pour gérer les états vides :

```
┌────────────────────────────────────────────┐
│ Monteur : [Sélectionner ▾]                 │   ← si null, juste un dropdown vide
│                                             │
│ Lien du rush :                              │
│ https://drive.google.com/...                │
│                                             │
│ Lien du montage final :                     │
│ [+ Uploader] ou coller un lien              │
│                                             │
│ ▼ [Notes du monteur]                       │
│                                             │
│ [Preview vidéo si final_url]                │   ← inline, pas en colonne droite
└────────────────────────────────────────────┘
```

États vides masqués :
- Pas de monteur dans le workspace → on affiche **uniquement** un lien discret "Inviter un monteur →" sous le dropdown ; pas de section "Prestation" ni "Paiement".
- Pas de prestation configurée → section "Prestation" cachée entièrement (option dans Réglages monteurs).
- Pas de média final → pas de zone preview, juste l'input upload.

Bouton "Valider le montage" en bas de l'étape (cf. validation hybride).

### Contenu Étape Publication (1 colonne)

- 3 toggles plateformes (IG / YT / TikTok) en haut.
- Zone média partagée : drop zone + thumbnail si déjà uploadé. **Preview vidéo lazy : créée uniquement quand l'étape Publication est visitée et qu'il y a un média.**
- Tabs plateformes actives (1 visible à la fois).
- Champs spécifiques de la plateforme active (caption IG, titre/description YT, etc.).
- Bouton "Programmer la publication" en bas.

### Footer Discussion permanent

Toujours visible en bas du drawer, sur 1 ligne, **collapsé par défaut** (option "le plus opti") :

```
─────────────────────────────────────────────
 💬 Discussion · 3 messages · @monteur     [▾]
─────────────────────────────────────────────
```

- Compteur des messages (lus + non lus, badge rouge si non lus).
- Au clic → expand vers le haut, affiche les 5 derniers messages + input.
- L'expand est un overlay au-dessus du contenu de l'étape (ne pousse pas le contenu vers le haut).
- Caché entièrement si `monteur_id` est null.

---

## Détail UI — page `/acquisition/reseaux-sociaux`

### Vue par défaut : Calendrier

- Toggle `[Calendrier] [Board]` en haut, **Calendrier sélectionné par défaut** au premier chargement.
- Persistance en `localStorage` (clé `social_planning_view_mode`) — au prochain chargement, on reprend le dernier choix.

### Onglets plateformes (conservés)

`Planning · Instagram · YouTube` reste en haut. **Pas touché**.

### Sélection multiple sur Board et Calendar

- Toggle "Mode sélection" (icône checkbox) à côté du toggle Calendar/Board.
- Activé → checkbox apparaît sur chaque card.
- Clic sur une checkbox → ajoute à la sélection ; bouton "Supprimer (N)" apparaît dans la barre du haut.
- Bouton "Supprimer (N)" → modale de confirmation listant les N posts → **soft-delete** (status `archived`, comme la suppression par batch). Pas de DELETE physique.
- Hors mode sélection → un raccourci `Shift+clic` sur une card l'ajoute à la sélection (active le mode automatiquement).

**Visibilité par rôle** : checkbox + bouton "Mode sélection" affichés uniquement pour les rôles `admin` / `coach` / `setter` / `closer`. Cachés pour `monteur`. Backend RLS bloque le DELETE pour les monteurs en double sécurité.

### Page Historique des imports

Nouvelle route : `/acquisition/reseaux-sociaux/imports`

Contenu :
- Liste des batchs créés, triés du plus récent au plus ancien.
- Colonnes : Date · Source (Trame / Multi-création / Manuel) · Nombre de posts · Statut (active / supprimée) · Action.
- Bouton "Supprimer ce batch" → modale de confirmation → **soft-delete** tous les posts du batch (`social_posts.status = 'archived'`, exclusion automatique des vues board/calendar). Permet l'undo si erreur.
- Bouton "Voir les posts" → ouvre la page principale filtrée sur ce `batch_id`.

Cachée pour les monteurs.

---

## Modèle de données

### Nouvelle colonne `social_posts.batch_id`

```sql
ALTER TABLE social_posts ADD COLUMN batch_id UUID NULL;
CREATE INDEX idx_social_posts_batch ON social_posts(batch_id) WHERE batch_id IS NOT NULL;
```

- `NULL` pour les posts créés un par un (manuel).
- UUID partagé pour tous les posts créés ensemble (Trame, multi-création futur).

### Nouvelle table `social_post_imports`

```sql
CREATE TABLE social_post_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL,           -- 'trame' | 'bulk_create' | 'csv_import'
  posts_count INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_social_post_imports_workspace_created
  ON social_post_imports(workspace_id, created_at DESC);
```

À chaque création multiple, un row dans `social_post_imports` est créé, et son `id` est utilisé comme `batch_id` sur les posts générés.

### Migration des données existantes

- Trame déjà existante : pas de backfill, les anciens posts gardent `batch_id = NULL`. Acceptable car on ne pourra pas supprimer en masse l'historique pré-migration, mais ce n'est pas critique.

### RLS

- `social_posts` : RLS existante inchangée.
- `social_post_imports` : SELECT pour tous les rôles du workspace sauf `monteur` (cohérent avec la page imports cachée pour monteur). DELETE/INSERT pour `admin` / `coach` / `setter` uniquement.

---

## Performance — exigences non négociables

Ces 4 chantiers sont **dans le scope** de cette refonte et obligatoires :

1. **Découpage `SlotDetailDrawer`** — passer de 2516 lignes à 6 fichiers :
   - `SlotDetailDrawer.tsx` — shell + state coordination (~300 lignes)
   - `BriefStep.tsx` (~250 lignes)
   - `MontageStep.tsx` (~300 lignes)
   - `PublicationStep.tsx` (~400 lignes)
   - `DiscussionFooter.tsx` (~200 lignes)
   - `slot-stepper.ts` — utilitaires purs (validation des ronds verts, mapping `production_status` → step, types partagés)

2. **Lazy fetch par étape** — au mount, on fetch uniquement les colonnes nécessaires à l'étape ouverte par défaut. Si l'utilisateur clique sur une autre étape, on fetch les colonnes manquantes à ce moment. Les fetchs cumulent dans le state local du drawer.

3. **Vidéo metadata lazy** — la création d'élément `<video>` synchrone pour lire les métadonnées (durée, type) ne se fait **que** quand l'étape Montage ou Publication est visitée **et** qu'il y a un média. Pas au mount.

4. **Polling unread messages** — supprimer le timer global de 20 s qui tourne en permanence. Remplacer par :
   - Soit un polling actif uniquement quand le drawer est ouvert (timer démarré au mount, clearé au unmount).
   - Soit une subscription Supabase Realtime sur `slot_messages` (préféré si déjà utilisé ailleurs dans le projet).

---

## Suppressions

Fichiers à supprimer :

- `src/app/(dashboard)/montage/page.tsx` (1244 lignes)
- `src/app/(dashboard)/montage/layout.tsx` si existe
- `src/components/social/montage/SlotMontageDrawer.tsx` si existe (le drawer simplifié pour le monteur)
- Le lien "Montage" dans la sidebar (`src/components/layout/Sidebar.tsx` ou équivalent)

Garder :
- `monteur_pricing_tiers` table (utilisée encore pour la facturation, accessible via Réglages)
- `slot_messages` table (utilisée par le footer Discussion)
- Toute la logique RLS / triggers existante sur les rôles monteur

---

## Plan de tests manuels

### Stepper drawer
1. Slot `idea` → drawer ouvre Brief, autres ronds gris.
2. Remplir hook + script → rond Brief devient vert, on reste sur Brief.
3. Cliquer "Envoyer au montage" → bascule sur Montage, `production_status = filmed`.
4. Cliquer rond "Brief" → revient en arrière, contenu Brief affiché, état préservé.
5. Slot `ready` → drawer ouvre Publication directement, ronds Brief + Montage verts.
6. Slot `published` → étape Publication ouverte, tous les inputs disabled.

### Vue calendrier par défaut
7. Premier login → page ouvre en Calendrier.
8. Switcher en Board → recharger → reste en Board.
9. Switcher en Calendrier → recharger → reste en Calendrier.

### Sélection multiple
10. Coach mode sélection → cocher 3 cards → bouton "Supprimer 3" → confirmer → 3 posts supprimés.
11. Shift+clic sur card hors mode sélection → mode sélection activé + card cochée.
12. Monteur connecté → checkboxes invisibles, bouton "Mode sélection" invisible.

### Imports
13. Générer une trame → vérifier qu'un row est créé dans `social_post_imports` et que les posts générés ont le `batch_id`.
14. Page `/acquisition/reseaux-sociaux/imports` → voir l'import récent → cliquer "Supprimer ce batch" → tous les posts du batch supprimés/archivés.
15. Monteur → URL `/imports` → 404 ou redirect.

### Discussion footer
16. Slot avec monteur → footer visible, badge "0 messages" si vide.
17. Footer collapsé → cliquer → expand vers le haut, dernier message visible.
18. Slot sans monteur → footer entièrement caché.

### Performance
19. Ouvrir un slot → mesurer le temps avant que le contenu de l'étape soit visible. Cible : < 200 ms (vs ~800-1200 ms actuel selon perception utilisateur).
20. Ouvrir/fermer 5 drawers à la suite → pas de "Chargement…" visible plus de 100 ms.

---

## Suppression de l'ancienne refonte accordéon

La refonte progressive accordéon du 2026-05-05 reste partiellement utile (elle a déjà nettoyé les doublons header date/statut). On garde ces nettoyages. On remplace uniquement le système accordéon par le stepper + footer.

Concrètement dans le diff :
- `<DrawerSection>` (composant accordéon) → supprimé.
- `briefOpen` / `montageOpen` / `pubOpen` states → remplacés par un seul `activeStep: 'brief' | 'montage' | 'publication'`.
- `getDefaultExpansion(slot)` → renommé `getDefaultStep(slot)` et renvoie un seul step.

---

## Risques

- **Refacto massive du drawer** — 2516 lignes à découper. Risque de régression sur les inputs auto-save et l'AI generation. Mitigé par tests manuels exhaustifs (checklist ci-dessus) + isolation des steps en composants purs.
- **Perte du chat permanent visible** — aujourd'hui le chat s'affiche soit en panneau dédié, soit en accordéon. Le footer collapsé peut être perçu comme "moins visible". Acceptable car la cible explicite est l'allègement.
- **`batch_id` rétroactif** — pas de backfill, donc anciennes trames non groupables. Décision assumée.
- **Suppression de `/montage`** — si un monteur a la page bookmarkée, il aura un 404. Ajouter un redirect serveur de `/montage` → `/acquisition/reseaux-sociaux` pendant 30 jours.
- **Page imports = nouvelle surface** — risque d'oubli RLS. Tests rôle-par-rôle obligatoires.

---

## Ordre d'implémentation suggéré

1. **Phase 1 — Stepper drawer** (le plus impactant UX)
   1. Découper `SlotDetailDrawer` en 5 fichiers
   2. Implémenter le stepper visuel + navigation
   3. Lazy fetch par étape
   4. Lazy vidéo metadata
   5. Discussion footer collapsé
   6. Tests manuels stepper

2. **Phase 2 — Page allégée**
   1. Calendar par défaut + persistance localStorage
   2. Suppression page `/montage` + redirect
   3. Cache du chat global polling 20 s

3. **Phase 3 — Bulk delete**
   1. Migration `batch_id` + table `social_post_imports`
   2. Trame backend → écrit dans `social_post_imports`
   3. UI mode sélection + checkboxes + bouton supprimer N
   4. Page `/imports` + suppression par batch
   5. RLS + tests rôles

Chaque phase est indépendante et déployable seule. La phase 1 délivre 80 % du gain perçu de lourdeur. Phases 2 et 3 peuvent suivre dans des PRs séparées.
