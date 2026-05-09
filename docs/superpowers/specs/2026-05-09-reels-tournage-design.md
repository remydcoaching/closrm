# Reels — Plan de tournage par lieu — Design

**Date** : 2026-05-09
**Auteur** : Pierre (via brainstorming Claude)
**Module** : Acquisition > Réseaux Sociaux > Reels
**Status** : draft — à valider

---

## Contexte & problème

Quand Pierre (et plus largement les coachs ClosRM) écrit 5 à 20 reels en série, chaque reel contient typiquement 5-10 phrases courtes. **Chaque phrase est filmée à un endroit physique différent** (poulie, banc plat, sol, devant le miroir, etc.).

Au tournage, le coach doit aller à un lieu, dire les phrases qui s'y rapportent, puis se déplacer. Sans préparation, il oublie des phrases, perd du temps en allers-retours, et finit par re-filmer.

**Aujourd'hui** : aucun outil dans ClosRM ne lie une phrase à un lieu. Le coach gère ça mentalement ou sur papier.

**Aussi** : un même lieu (ex: la poulie) est utilisé par plusieurs reels différents. Un système naïf qui groupe par reel rate l'optimisation logistique.

## Objectif

Construire **une feature optionnelle, isolée derrière un bouton, qui ne touche à RIEN dans l'existant**. Elle ajoute une étape de préparation entre l'écriture (phase 1) et la publication (phase actuelle), permettant au coach de :

1. Découper son script en phrases atomiques
2. Assigner un **lieu de tournage** à chaque phrase
3. Le jour J, voir une vue **groupée par lieu cross-reels** pour minimiser les déplacements et ne rien oublier

## Contrainte non-négociable

> **Aucune modification du flow existant.** Si l'utilisateur ne clique jamais le bouton "📋 Préparer mon tournage", absolument rien ne change dans son ClosRM. La feature vit en parallèle, derrière un seul bouton.

Concrètement :
- `social_posts` table : on n'ajoute **aucune colonne**. Tout va dans une nouvelle table.
- Composer / Calendar / Publication / Cron : intacts.
- L'écriture du script reste une `textarea` libre, comme aujourd'hui.

## Approche retenue : workflow en 3 phases

### Phase 1 — Rédaction libre *(existant, inchangé)*

Le coach ouvre une fiche reel ClosRM, remplit titre + hook + script (blob `TEXT` libre). Save auto. **Zéro friction, comportement actuel**.

Le seul ajout visible : un bouton **"📋 Préparer mon tournage"** sur la fiche reel et sur la liste des reels (`/acquisition/reseaux-sociaux?platform=youtube&tab=videos` ou `?tab=reels` selon emplacement futur).

### Phase 2 — Préparer mon tournage *(nouveau, derrière le bouton)*

Page dédiée `/acquisition/reels/tournage` ou modale plein écran (à trancher en plan d'implémentation).

**Layout en liste compacte** (validé suite au brainstorming, scale > kanban à 20 reels) :

```
┌─ Toolbar ────────────────────────────────────────────────┐
│ [✨ Suggérer auto (IA)]  [+ Lieu]  [↻ Vider]   28/200 placées │
└──────────────────────────────────────────────────────────┘
┌─ Filtres ────────────────────────────────────────────────┐
│  [Toutes] [🔴 Non placées] [✓ Placées]   [🔎 Rechercher…]  │
└──────────────────────────────────────────────────────────┘

┌─ Reel · Dos large en 3 exos          5/6 placées  ████░  ┐
│  ☐  Le truc qui change tout c'est…   [🏋️ Poulie ▾]      │
│  ☐  Vraiment lentement, genre 4 sec  [✨ Poulie (IA) ▾]  │
│  ☐  Tu vois la barre, tu la fixes…   [🛏️ Banc plat ▾]   │
│  ☐  Là tu vas sentir le brûler…       [🏋️ Poulie ▾]      │
│  ☐  La position de départ c'est…      [🟫 Sol ▾]         │
│  ☐  Et tu vois ton dos s'élargir…     [Choisir un lieu ▾]│
└──────────────────────────────────────────────────────────┘
┌─ Reel · Pull-over technique          3/3 placées  █████  ┐
│  ...                                                       │
└──────────────────────────────────────────────────────────┘
```

**Caractéristiques** :

- **Découpage automatique du script** : split par `\n` (retour à la ligne). Une ligne non vide = une phrase. Si le coach veut fusionner 2 phrases, il édite directement le texte de la phrase. Si il veut séparer, il scinde manuellement (ajoute une nouvelle phrase). Pas d'IA pour le découpage en V1 — KISS.
- **Dropdown lieu** sur chaque ligne avec :
  - Filtre/recherche dans les lieux existants
  - Création à la volée d'un nouveau lieu (clic "Créer 'Plage'")
  - Suggestion IA visible si non encore appliquée (`✨ Poulie (IA)`)
  - Action "Retirer le lieu" pour vider
- **Sélection multiple** : checkbox sur chaque ligne. Une floating bar apparaît avec "Assigner les N sélectionnées à [lieu]". Permet d'assigner 30 phrases à "Poulie" en 2 clics.
- **Filtres** : "Toutes / Non placées / Placées" + recherche texte. Permet de focus sur les 20% à corriger après l'IA.
- **Groupement par reel** avec progress bar (combien de phrases placées). Collapse/expand de chaque groupe.
- **Bouton "✨ Suggérer auto (IA)"** : envoie toutes les phrases non placées à Claude Haiku via le proxy IA ClosRM existant. L'IA propose un lieu pour chaque, retourné en JSON. Le coach valide globalement (clic) ou phrase par phrase (dropdown).

**IA — détails** :
- Modèle : Claude Haiku (latence < 2s, coût négligeable, ~1 cent par batch de 200 phrases)
- Prompt : "Voici les lieux disponibles : [liste]. Pour chaque phrase, choisis le lieu le plus probable basé sur les indices contextuels. Retourne JSON `{phraseId: location}`."
- Erreur de parsing → on retombe sur "manuel" sans crash
- L'utilisateur peut TOUJOURS override la suggestion IA

**Data** :
- Tout est stocké dans une nouvelle table `reel_shots`. Voir section Data Model.

### Phase 3 — Jour J *(nouveau, derrière un bouton)*

Page dédiée `/acquisition/reels/tournage/jour-j` (mobile-first, pour être consultée pendant le tournage avec le tel posé sur un trépied).

```
┌────────────────────────────────────┐
│  LIEU ACTUEL · 1/4                 │
│  🏋️ Poulie                          │
│  12 shots · 4 reels                 │
├────────────────────────────────────┤
│  Reel · Dos large en 3 exos         │
│  ┌──────────────────────────────┐  │
│  │ « Le truc qui change tout… » │  │
│  │ [✓ Tournée]      [Skip]       │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ « Là tu vas sentir le brûler »│  │
│  │ [✓ Tournée]      [Skip]       │  │
│  └──────────────────────────────┘  │
│                                     │
│  Reel · Pull-over technique         │
│  ┌──────────────────────────────┐  │
│  │ « La vraie technique : bras…»│  │
│  │ [✓ Tournée]      [Skip]       │  │
│  └──────────────────────────────┘  │
│                                     │
│  ...                                │
├────────────────────────────────────┤
│  ← Précédent      Banc plat (8) →  │
└────────────────────────────────────┘
```

**Caractéristiques** :
- Affiche **un seul lieu à la fois** (le plus chargé en premier par défaut, navigable manuellement)
- **Phrases regroupées par reel** dans le lieu actuel pour le contexte ("là je suis sur le reel 'Dos large', cette phrase vient après celle-là dans le montage")
- **Phrases en gros** (lisible à 1m de l'écran posé)
- **"✓ Tournée"** : marque `done=true`, anim de sortie, suivant remonte
- **"Skip"** : ne change pas le statut, juste un signal visuel (pas filmée aujourd'hui)
- **Footer navigation** : précédent / suivant entre lieux, label montre le prochain lieu et son nombre de shots

**Quand tous les shots d'un lieu sont tournés** : le lieu disparaît de la liste, on passe au suivant.

## Data Model

### Nouvelle table `reel_shots`

```sql
CREATE TABLE reel_shots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  position INT NOT NULL,                       -- ordre dans le reel (0, 1, 2, ...)
  text TEXT NOT NULL,                          -- la phrase
  location TEXT,                               -- lieu de tournage (texte libre)
  done BOOLEAN NOT NULL DEFAULT false,
  ai_suggested_location TEXT,                  -- proposition IA (audit + override)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (social_post_id, position)
);

CREATE INDEX idx_reel_shots_workspace ON reel_shots(workspace_id);
CREATE INDEX idx_reel_shots_post ON reel_shots(social_post_id, position);
CREATE INDEX idx_reel_shots_location_todo
  ON reel_shots(workspace_id, location)
  WHERE done = false AND location IS NOT NULL;

-- RLS
ALTER TABLE reel_shots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reel_shots_workspace" ON reel_shots FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Trigger updated_at
CREATE TRIGGER reel_shots_updated_at
  BEFORE UPDATE ON reel_shots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Pourquoi table dédiée et pas JSONB sur `social_posts` ?

- **Query principale** : "tous les shots non tournés à la poulie cross-reels" → une simple `WHERE workspace_id = ? AND location = ? AND done = false`. Avec JSONB, ça nécessite `jsonb_path_query` qui est plus lent et moins indexable proprement.
- **Évolution** : si on veut ajouter "prises multiples" ou "estimation temps" plus tard, c'est trivial sur table dédiée.
- **Coût migration** : aucune colonne sur `social_posts`. Conformément à la contrainte non-négociable.

### Pas de table `locations`

Les lieux sont du **texte libre** sur `reel_shots.location`. La liste des lieux disponibles est dérivée à la volée : `SELECT DISTINCT location FROM reel_shots WHERE workspace_id = ? AND location IS NOT NULL`. Aucune fragmentation typo possible si on fournit un autocomplete sur cette liste.

Si on a besoin un jour de propriétés par lieu (ordre préféré, photo, etc.) → table `locations` créée à ce moment.

## API Routes

```
GET  /api/reel-shots?social_post_id=X      → liste les shots d'un reel
GET  /api/reel-shots/by-location           → tous les shots groupés par lieu (workspace_id implicite)
GET  /api/reel-shots/locations             → liste DISTINCT location (autocomplete)
POST /api/reel-shots                       → crée un shot { social_post_id, text, position, location? }
POST /api/reel-shots/sync                  → sync depuis le script (split + diff + upsert)
PATCH /api/reel-shots/:id                  → update text, location ou done
PATCH /api/reel-shots/batch                → update plusieurs shots d'un coup { ids: [...], location: 'X' | done: true }
DELETE /api/reel-shots/:id

POST /api/reel-shots/ai-suggest            → batch IA via proxy ClosRM
```

`/sync` mérite une explication : quand le coach a édité son script depuis l'écriture, on veut une "synchronisation" douce. L'algorithme :
1. Split le `social_posts.script` actuel par `\n`
2. Compare avec les `reel_shots` existants par position
3. Si phrase identique → on garde
4. Si phrase différente → on update le texte (mais on garde location et done)
5. Si nouvelle phrase → INSERT
6. Si phrase en moins → DELETE (ou archive ?)

À trancher en plan d'implémentation : delete dur ou soft delete pour ne rien perdre.

## UI / Routes

```
/acquisition/reels/                       → index des reels (existant ou ajouté)
/acquisition/reels/[id]/tournage/prep     → Phase 2 (1 reel)
/acquisition/reels/tournage/prep          → Phase 2 (multi-reels, sélection préalable)
/acquisition/reels/tournage/jour-j        → Phase 3 (mobile)
```

Le bouton "📋 Préparer mon tournage" est ajouté :
1. Sur la fiche reel individuelle
2. Sur la liste des reels (action en bulk : sélectionner plusieurs, "Préparer le tournage")

## Scope V1 (ce qu'on livre)

✅ Inclus :
- Bouton "📋 Préparer mon tournage" sur fiche reel + liste
- Page Phase 2 : liste compacte par reel, dropdown lieu, sélection multiple, filtres, recherche
- Bouton "✨ Suggérer auto (IA)" via Claude Haiku
- Page Phase 3 mobile : vue par lieu, navigation entre lieux, mark done / skip
- Migration SQL pour `reel_shots`
- API routes minimales

❌ V2 (hors scope) :
- **Concept "session de tournage"** (sélectionner X reels pour aujourd'hui, suivre une session). Pour V1, le coach gère ça mentalement ou via des filtres ad hoc.
- **Réordonnancement manuel des lieux** (drag-drop pour optimiser le parcours physique)
- **Estimation temps de tournage** par lieu
- **Prises multiples** par phrase (1 phrase = 3 prises, retake)
- **Réécriture/punchline IA** ("améliore cette phrase")
- **Génération de hooks IA**
- **Suggestion d'ordre optimal** dans le reel (cuts dynamiques entre lieux)

## Risques & ouvertures

1. **Le coach n'utilise jamais la feature** → pas grave, contrainte non-négociable respectée, zéro impact sur l'existant.
2. **L'IA suggestion est mauvaise** → le coach peut TOUJOURS override en 1 clic. Et le bouton est optionnel.
3. **Le script est édité après assignation** → géré par `/api/reel-shots/sync` qui préserve location + done.
4. **20+ reels = 200+ phrases** → la liste compacte + filtres + IA + batch action gèrent. Test à valider sur le proto v4 dispo dans `.superpowers/brainstorm/`.
5. **Mobile UX phase 3** → à prototyper au tournage réel pour valider la lisibilité.

## Lien vers les protos

Protos HTML interactifs (localStorage, pas de backend) générés pendant le brainstorming, dispos dans `.superpowers/brainstorm/67538-1778356570/content/` :
- `proto-v1.html` — première itération avec syntaxe `[Lieu]` (abandonné)
- `proto-v2.html` — dropdown par phrase (abandonné, kanban ne scale pas)
- `proto-v3-phases.html` — 3 phases avec kanban prep
- `proto-v4-list.html` — **direction validée** : liste compacte qui scale à 20 reels

## Décisions en suspens (à trancher en plan d'implémentation)

- **Page dédiée vs modale** pour Phase 2 — page dédiée probablement (espace, partage URL).
- **Sync script ↔ shots** : delete dur ou soft delete des phrases supprimées.
- **Bouton "Préparer" sur la liste** : où exactement (composer ? sidebar ? action bulk ?).
- **Couplage `social_posts.content_kind`** : la feature s'applique-t-elle aux 3 types (post / story / reel) ou uniquement reel ? V1 = uniquement `content_kind = 'reel'`.
- **Persistance du tournage par session** : si le coach ferme l'app au milieu de Phase 3, il revient dessus comment ? Reprise auto sur le dernier lieu non terminé.
