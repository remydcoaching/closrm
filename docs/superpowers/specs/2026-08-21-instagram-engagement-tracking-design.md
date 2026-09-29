# Tracking d'engagement Instagram, pipeline de statuts étendu & funnel de conversion

## Contexte

Inspiré d'une démo du concurrent OnSkill (setter tool Instagram), l'objectif est d'apporter à ClosRM une
vue par lead de l'engagement Instagram (likes, commentaires, DMs) permettant d'identifier chaque jour les
leads les plus chauds à recontacter, avec un historique complet dans la fiche lead.

**Contrainte non négociable** : OnSkill obtient ces données par scraping automatisé (comptes jetables qui se
font bannir en continu), ce qui viole les CGU Meta (taux de suspension documenté 15-30%/an pour
l'automatisation de compte, même en lecture seule). ClosRM ne fera **aucun scraping direct** — la collecte
est entièrement externalisée à **Apify** (service tiers, API officielle), qui assume ce risque de son côté.
ClosRM se contente d'appeler l'API Apify et d'afficher les résultats.

En creusant le sujet, deux chantiers connexes sont apparus :
1. Le pipeline de statuts lead actuel (9 valeurs) ne couvre pas la granularité vue dans la démo (relances
   numérotées, lien de paiement envoyé, reschedule, acompte) — à étendre.
2. Le funnel de conversion actuel (bar chart Recharts à 4 étapes) est visuellement pauvre — remplacé par un
   widget en particules animées (cône 3D, anneaux glowy aux paliers de conversion), dont le design a été
   validé via un handoff externe précis (géométrie, couleurs, physique des particules figées).

Les trois chantiers touchent `leads.status`, d'où leur regroupement dans une seule spec.

---

## 1. Tracking d'engagement Instagram via Apify

### Ce qui existe déjà (réutilisé)
- `leads.instagram_handle` (texte libre, non normalisé) — insuffisant pour un matching fiable, à compléter
- Pattern cron sub-quotidien : pg_cron → `net.http_get` → endpoint Vercel avec `Authorization: Bearer
  CRON_SECRET` (`supabase/migrations/059_pgcron_booking_reminders.sql`, `075_pgcron_social_posts.sql`)
- `integrations` table (`credentials_encrypted`) — accueille le token Apify (`type = 'apify'`)
- `src/components/leads/LeadJourneyBlock.tsx` — timeline à étendre avec de nouveaux types d'event
- `src/app/(dashboard)/follow-ups/follow-ups-client.tsx` — template UI (tabs + badges + actions) pour la
  nouvelle vue "leads chauds"
- `src/lib/leads/identity.ts` (`findExistingLeadId`) — logique de dédup à étendre à `instagram_user_id`

### Ce qui manque, à construire
- Aucune colonne JSON générique sur `integrations` (1 ligne par type/workspace) → les posts surveillés (une
  liste) vont dans une table dédiée, pas dans `integrations`
- Aucun système de scoring n'existe → nouveau, avec poids configurables par workspace
- `leads.source` n'a pas de valeur pour l'engagement Instagram → nouvelle migration

### Schéma SQL

```sql
-- Posts/reels surveillés
create table apify_watched_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  instagram_post_url text not null,
  instagram_post_code text,
  label text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  last_run_id text,
  likers_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Runs Apify (traçabilité + idempotence)
create table apify_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  watched_post_id uuid references apify_watched_posts(id) on delete cascade,
  apify_run_id text not null unique,
  apify_dataset_id text,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed')),
  items_processed int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Événements d'interaction Instagram
create table instagram_interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('like','comment','dm','mention')),
  instagram_user_id text,
  instagram_username text not null,
  full_name text,
  profile_url text,
  source_post_id uuid references apify_watched_posts(id),
  source_post_url text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, lead_id, interaction_type, source_post_id, instagram_user_id)
);

-- Matching lead ↔ compte Instagram
alter table leads add column instagram_user_id text;
create unique index leads_workspace_ig_user_id_uq
  on leads(workspace_id, instagram_user_id) where instagram_user_id is not null;
-- migration séparée : ajouter 'instagram_engagement' au CHECK constraint sur leads.source

-- Scoring configurable par workspace
create table engagement_scoring_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  interaction_type text not null,
  points int not null default 1,
  unique (workspace_id, interaction_type)
);
```

### Flow bout en bout

1. **Paramètres > Intégrations** : ajout Apify (token stocké chiffré dans `integrations.credentials_encrypted`,
   `type='apify'`) + écran "Posts surveillés" (CRUD sur `apify_watched_posts`)
2. **Cron pg_cron** (toutes les 30-60 min) → `POST /api/cron/apify-instagram-likes` (Bearer CRON_SECRET) →
   pour chaque post actif : `POST https://api.apify.com/v2/actors/{actor}/runs` avec `postUrls: [url]`,
   enregistre la ligne dans `apify_runs` (status=pending)
3. **Récupération résultat** : webhook Apify signé (`POST /api/webhooks/apify`, vérification de signature —
   ne pas copier le pattern du webhook Meta existant qui n'en a pas) ou 2e cron qui poll
   `GET /v2/actors/{id}/runs/{runId}` puis `GET /v2/datasets/{datasetId}/items` une fois `SUCCEEDED`
4. **Traitement du dataset** (fonction partagée, appelée par webhook ou poller) :
   - Matching par `instagram_user_id` → sinon `instagram_username` → sinon création d'un nouveau lead
     (`source='instagram_engagement'`)
   - Upsert dans `instagram_interactions` (contrainte unique gère la dédup — si déjà vu, met à jour
     `last_seen_at`)
   - Marque `apify_runs.status='succeeded'`, met à jour `apify_watched_posts.last_checked_at`/`likers_count`
5. **`LeadJourneyBlock`** : requête sur `instagram_interactions` fusionnée avec `funnel_events` dans la
   timeline (nouveaux types d'event `instagram_like`/`instagram_comment`, chacun avec vignette + lien
   "Voir le reel", comme validé dans le design — voir capture de référence "A liké un de tes reels")
6. **Vue "Leads chauds à contacter"** (nouvelle page, calquée sur `follow-ups-client.tsx`) : agrège
   `instagram_interactions` par lead sur une fenêtre glissante (7 jours par défaut), calcule un score via
   `engagement_scoring_rules`, trie décroissant, affiche le détail (ex: "🔥 5 interactions — 3 likes, 1
   commentaire, 1 DM")

### Design UI validé
- **Fiche lead** : bloc score d'engagement (barre de progression) + grille de compteurs (likes/commentaires/
  DMs) + liste "Reels interagis" avec vignettes
- **Timeline** : événements "A liké un de tes reels" / "A commenté un de tes reels" avec extrait du texte,
  date "détecté le X", lien "Voir le reel ↗", plus des repères "Fin de conversation" / "Reprise de
  conversation" dérivés des gaps d'activité

### Hors scope (exclu délibérément)
- Tracking des likes sur du contenu concurrent (nécessiterait un scraping cross-compte, hors de portée légale)
- Toute automatisation de compte Instagram (lecture d'écran, navigateur automatisé) — refusé quelle que
  soit la fréquence ou le compte utilisé

---

## 2. Pipeline de statuts étendu

### Statuts actuels (`leads_status_check`, migration 089)
`nouveau, scripte, setting_planifie, no_show_setting, closing_planifie, no_show_closing, clos, pas_qualifie, dead`

### Nouveaux statuts (remplacent/étendent la liste ci-dessus)
`nouveau, contacte, relance_setting, qualifie, pas_qualifie, lien_envoye, appel_bookee, no_show, reschedule,
r2, r3, relance_closing, acompte, gagne, perdu`

Chaque statut a une icône colorée dédiée (voir mapping couleur validé dans le design — bleu pour les étapes
actives, rouge pour les relances/échecs, vert pour les étapes positives).

### Migration

Les leads existants sont remappés vers la nouvelle liste (pas de coexistence des deux listes) :

| Ancien statut | Nouveau statut |
|---|---|
| `nouveau` | `nouveau` |
| `scripte` | `contacte` |
| `setting_planifie` | `appel_bookee` |
| `no_show_setting` | `no_show` |
| `closing_planifie` | `relance_closing` |
| `no_show_closing` | `no_show` |
| `clos` | `gagne` |
| `pas_qualifie` | `pas_qualifie` |
| `dead` | `perdu` |

Migration en deux temps : `update leads set status = case status when ... end` puis `drop constraint` +
`add constraint leads_status_check` avec la liste des 15 nouvelles valeurs. Faire l'update AVANT de poser
la nouvelle contrainte (sinon les lignes non encore remappées la violent).

### UI
- Nouveau composant `StatusDropdown` sur la fiche lead : liste des statuts avec point coloré + glow subtil,
  statut actif marqué d'un ✓ (voir design validé)

### Impact mobile
Le repo mobile (`mobile/`) référence probablement les anciens statuts (labels affichés, filtres, logique de
l'import Instagram OCR qui crée des leads avec `status: 'nouveau'` — voir
`src/app/api/leads/import-from-screenshots/confirm/route.ts`). À auditer et mettre à jour en même temps que
la migration serveur, pour ne pas laisser l'app mobile afficher/écrire des statuts obsolètes après le
remapping. À vérifier en phase de plan d'implémentation : toute liste de statuts hardcodée côté mobile,
tout composant de sélection de statut, tout filtre par statut.

---

## 3. Funnel de conversion (remplace le bar chart Recharts)

### Design validé (handoff externe, valeurs figées — voir `funnel-standalone.html` de référence)
- **Géométrie** : cône vu de face, `topY=120, botY=760, rTop=330, rBot=34`, paroi courbe
  `rAt(t) = rBot + (rTop-rBot) * (1-t)^1.65`, buffer canvas 900×1000
- **6 étapes** avec mapping sur le pipeline de statuts (validé) :
  | Étape funnel | Statuts inclus |
  |---|---|
  | Leads reçus | tous les leads de la période |
  | Contactés | `contacte`, `relance_setting` |
  | Qualifiés | `qualifie` |
  | Devis envoyés | `lien_envoye`, `appel_bookee` |
  | Négociation | `no_show`, `reschedule`, `r2`, `r3`, `relance_closing` |
  | Signés | `acompte`, `gagne` |

  `pas_qualifie` et `perdu` sont exclus du funnel (sorties de pipeline, pas des étapes de progression).
- **Couleurs par palier** : `#5aa9e6` (leads) → `#e8a33d` (contactés) → `#ef6a45` (qualifiés) → `#e0402a`
  (devis/négociation) → `#4cc38a` (signés)
- **Anneaux glowy** aux 4 paliers de transition (t=0.20/0.40/0.60/0.80), `shadowBlur=30`, double `stroke()`
- **Particules** : N=520, physique de "mortalité" aux paliers pilotée par les vrais taux de conversion
  (`keep[i] = count(étape i+1) / count(étape i)`) — donc la densité de points sous chaque anneau reflète
  visuellement le taux de conversion réel, pas une valeur décorative
- **Thème** : le widget garde son propre style clair (`#f3f2f2`/`#201e1d`/accent `#ec3013`, police Archivo),
  volontairement différent du dark theme ClosRM — décision utilisateur explicite, pas un oubli

### Implémentation
- Nouveau composant `src/components/stats/conversion-funnel.tsx` (canvas 2D + `requestAnimationFrame`,
  aucune nouvelle dépendance — recharts reste utilisé ailleurs mais pas ici)
- `fetchFunnelData` dans `src/lib/stats/queries.ts` étendu de 4 à 6 étapes, requêtant `leads.status` avec le
  mapping ci-dessus (au lieu de la logique actuelle mêlant `leads.status` et `calls.type`)
- Remplace l'appel à `<FunnelChart data={funnelData} />` dans `stats-client.tsx` par le nouveau composant

---

## Vérification (à couvrir dans le plan d'implémentation)
- Migration statuts : vérifier qu'aucun lead existant ne viole la nouvelle contrainte CHECK avant de la poser
- Apify : tester le cycle complet run→webhook/poll→dédup avec un vrai post Instagram et un token Apify de test
- Dédup `instagram_interactions` : vérifier qu'un même liker sur 2 posts ne crée qu'un lead (test de la
  contrainte unique + upsert)
- Funnel : comparer les taux affichés à un calcul manuel sur un jeu de données connu (ex: via SQL direct)
- Revue visuelle du funnel : comparer au pixel près avec `funnel-standalone.html` (référence figée)
