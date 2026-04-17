# Spec A-010 — Linktree interne (liens trackables par lead)

**Date :** 2026-04-17
**Auteur :** Pierre
**Statut :** Validé (brainstorming)
**Tâche liée :** A-010 dans `ameliorations.md`

---

## Contexte

Le coach envoie des lead magnets (masterclass YouTube, ebook PDF, podcast, etc.) via DM Instagram à ses leads. Actuellement :

- La liste des lead magnets est stockée dans un **JSON blob** (`ai_coach_briefs.lead_magnets`), utilisée uniquement par l'Assistant IA.
- Aucun tracking : impossible de savoir qui a cliqué sur quoi, ni quel contenu convertit le mieux.

**Objectif :** système de liens courts trackables, un lien unique par paire (lead × contenu), avec analytics par contenu et par lead. L'IA doit pouvoir remplacer automatiquement les URLs brutes par le lien trackable du lead dans les messages suggérés.

---

## Décisions clés (brainstorming)

| Point | Choix | Raison |
|---|---|---|
| Identification du lead | **Lien unique par (contenu × lead)** | Fiable 100%, pas de fingerprinting, pas de cookies. |
| Deep link app native | **Redirection HTTP 302 classique** | Les Universal Links iOS / App Links Android gèrent l'ouverture native automatiquement. Pas de code custom. |
| Source des contenus | **Migration vers table structurée** `lead_magnets` | Le JSON actuel est limite pour l'IA, la table donne tracking + stats + platform. |
| Durée de vie | **Purge auto non-cliqués à 90j** (cron quotidien) | Évite l'accumulation de rows inutiles. |
| Automatisation IA | **V1 : suggestion copier-coller. V2 : envoi auto via workflow** (T-021 post-validation Meta) | Architecture identique, même API appelée par humain ou workflow. |
| Analytics | **2 vues : page globale + widget fiche lead** | Les deux angles utiles pour le coach. |
| Extension future | Colonne `platform` sur `lead_magnets` | Prépare le module Social Analytics YouTube/TikTok (T-033). |

---

## Architecture

### 1. Schéma DB

Migration : `supabase/migrations/029_lead_magnets.sql`

```sql
-- Table des contenus
CREATE TABLE lead_magnets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  platform text NOT NULL DEFAULT 'other'
    CHECK (platform IN ('youtube','tiktok','instagram','podcast','blog','pdf','other')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_magnets_workspace ON lead_magnets(workspace_id);

-- Table des liens trackables (1 par paire lead × magnet)
CREATE TABLE tracked_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_magnet_id uuid NOT NULL REFERENCES lead_magnets(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  short_code text NOT NULL UNIQUE,          -- 6 chars base62
  clicks_count int NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  last_clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(lead_magnet_id, lead_id)
);

CREATE INDEX idx_tracked_links_short_code ON tracked_links(short_code);
CREATE INDEX idx_tracked_links_lead ON tracked_links(lead_id);
CREATE INDEX idx_tracked_links_magnet ON tracked_links(lead_magnet_id);

-- RLS
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;

-- Policies workspace-scoped (CRUD pour membres du workspace)
-- (détail des 4 policies par table : SELECT, INSERT, UPDATE, DELETE)

-- Migration du JSON existant
-- Pour chaque ai_coach_briefs.lead_magnets non null :
--   parser le JSON → créer 1 row par item dans lead_magnets (platform = 'other')
-- Puis DROP COLUMN ai_coach_briefs.lead_magnets
```

### 2. API routes

| Route | Méthode | Description |
|---|---|---|
| `/api/lead-magnets` | GET | Liste workspace-scoped |
| `/api/lead-magnets` | POST | Créer (`title`, `url`, `platform`) |
| `/api/lead-magnets/[id]` | PATCH | Éditer |
| `/api/lead-magnets/[id]` | DELETE | Supprimer (cascade sur tracked_links) |
| `/api/lead-magnets/[id]/track-for-lead` | POST | Idempotent. Body `{ lead_id }` → `{ short_code, full_url }` |
| `/api/lead-magnets/[id]/stats` | GET | `{ total_clicks, unique_leads, top_leads[], clicks_timeline }` |
| `/api/leads/[id]/clicks` | GET | Historique clics d'un lead |
| `/c/[code]` | GET | **Route publique**. Fetch → increment → 302 redirect. |
| `/api/cron/purge-tracked-links` | GET | Cron Vercel quotidien |

**Détails `POST /api/lead-magnets/[id]/track-for-lead` :**
1. Vérifier que `lead_magnet_id` et `lead_id` appartiennent au même workspace que le user.
2. `SELECT ... WHERE lead_magnet_id=? AND lead_id=?` → si existe, renvoyer.
3. Sinon : générer `short_code` (6 chars base62, retry sur collision), INSERT, renvoyer.

**Détails `/c/[code]` :**
1. `SELECT tracked_links + lead_magnets.url WHERE short_code=?`
2. Si rien → redirect homepage.
3. Rate limit : ne pas incrementer si la même IP+UA a cliqué il y a <10s (dedup via Redis ou cache en mémoire — pour V1 accepter la duplication mineure).
4. `UPDATE tracked_links SET clicks_count += 1, last_clicked_at=NOW(), first_clicked_at=COALESCE(first_clicked_at, NOW())`
5. `return NextResponse.redirect(lead_magnet.url, 302)`

**Génération short_code :**
- Alphabet : `[a-zA-Z0-9]` (62 chars), longueur 6 → ~56 × 10⁹ combinaisons.
- `crypto.randomBytes(8).toString('base64')` slicé à 6 chars.
- En cas de collision (contrainte UNIQUE violée), retry max 3 fois puis erreur.

### 3. Intégration IA

**Problème :** l'IA doit inclure des URLs de lead magnets dans les messages qu'elle suggère, mais ces URLs doivent être les liens trackables du lead en cours — pas l'URL brute.

**Solution (post-process) :**

- `src/lib/ai/brief.ts` : charger les lead_magnets depuis la table (plus depuis le JSON).
- Le prompt IA reçoit la liste `{ title, url }` réelle.
- L'IA génère le message avec les URLs réelles.
- **Post-process** dans `src/lib/ai/prompts.ts` (ou helper dédié `replaceLeadMagnetUrls`) :
  1. Parser le message généré.
  2. Pour chaque URL de lead_magnet détectée (match exact sur `lead_magnets.url`) : appeler `POST /api/lead-magnets/[id]/track-for-lead` avec le `lead_id` du contexte.
  3. Remplacer l'URL par `https://<app_url>/c/<short_code>`.
- L'IA reste agnostique, le remplacement est transparent.

**Edge case :** si un lead magnet n'est pas dans la table (IA hallucine une URL), on laisse telle quelle.

### 4. UI

**A) Page `/acquisition/lead-magnets`** (nouvelle)

Tableau : titre, plateforme (badge + icône), clics totaux, leads uniques, actions (éditer/supprimer).
Click sur row → drawer latéral : timeline clics (Recharts), top leads, boutons éditer/supprimer.
Bouton "+ Nouveau contenu" → modale (title, url, platform dropdown).

**B) Widget fiche lead** (`LeadMagnetsWidget.tsx`)

Intégré dans `LeadSidePanel.tsx` et `/leads/[id]/page.tsx`.
Liste des lead_magnets du workspace. Pour chacun :
- Icône plateforme + titre
- Bouton "📋 Copier lien" → appel API + copy-to-clipboard + toast
- Sous-ligne : `X clics · dernier il y a Yh` ou `pas encore cliqué`

**C) Refactor `Paramètres > Assistant IA` étape 5**

Le `LeadMagnetEditor` actuel (JSON) est **supprimé**. L'étape 5 devient un écran explicatif :
> "Les lead magnets sont gérés dans Acquisition > Lead Magnets. [Aller à la page →]"

**D) Sidebar**

Ajouter entrée "Lead Magnets" sous section Acquisition, entre Automations et Publicités.

### 5. Cron de purge

- Route : `src/app/api/cron/purge-tracked-links/route.ts`
- Déclaration dans `vercel.json` : schedule `0 3 * * *` (3h du matin)
- Query : `DELETE FROM tracked_links WHERE clicks_count = 0 AND created_at < NOW() - INTERVAL '90 days'`
- Auth : `CRON_SECRET` header

---

## Error handling

| Cas | Traitement |
|---|---|
| Short code collision | Retry génération (max 3×) |
| Lead supprimé | Cascade sur tracked_links |
| Lead magnet supprimé | Cascade sur tracked_links |
| Short code inconnu (`/c/xxx` invalide) | Redirect homepage (302) |
| URL lead magnet invalide (scheme manquant) | Validation API : regex `^https?://` |
| Rate limit bot sur `/c/[code]` | Dedup IP+UA fenêtre 10s (V1 accepter dup mineure) |
| Appel `track-for-lead` cross-workspace | 403 Forbidden |

---

## Tests

- **API CRUD** : unit tests sur chaque route (success + permission + validation).
- **Idempotence track-for-lead** : 2× appel → même short_code.
- **Redirect `/c/[code]`** : 302 OK, clicks_count incrémenté, first/last_clicked_at cohérents.
- **Migration** : fixture JSON avec 3 items → 3 rows créées, colonne droppée.
- **IA post-process** : message "Voici https://yt/xxx" → message "Voici https://app/c/ab12".
- **RLS** : requêtes cross-workspace → 0 rows.
- **Cron purge** : fixture avec 2 tracked_links (1 jeune cliquée, 1 vieille non cliquée) → seule la 2e est supprimée.

---

## Fichiers impactés

### Nouveaux fichiers

- `supabase/migrations/029_lead_magnets.sql`
- `src/app/api/lead-magnets/route.ts`
- `src/app/api/lead-magnets/[id]/route.ts`
- `src/app/api/lead-magnets/[id]/track-for-lead/route.ts`
- `src/app/api/lead-magnets/[id]/stats/route.ts`
- `src/app/api/leads/[id]/clicks/route.ts`
- `src/app/c/[code]/route.ts`
- `src/app/api/cron/purge-tracked-links/route.ts`
- `src/app/(dashboard)/acquisition/lead-magnets/page.tsx`
- `src/app/(dashboard)/acquisition/lead-magnets/lead-magnets-client.tsx`
- `src/components/leads/LeadMagnetsWidget.tsx`
- `src/lib/lead-magnets/shortcode.ts` (générateur)

### Fichiers modifiés

- `src/lib/ai/brief.ts` — charger lead_magnets depuis la table
- `src/lib/ai/prompts.ts` — post-process URLs
- `src/components/ai/LeadMagnetEditor.tsx` — supprimé
- `src/app/(dashboard)/parametres/assistant-ia/ai-settings-client.tsx` — étape 5 simplifiée
- `src/components/shared/LeadSidePanel.tsx` — intégrer widget
- `src/app/(dashboard)/leads/[id]/page.tsx` — intégrer widget
- `src/components/layout/Sidebar.tsx` — nouvelle entrée
- `src/types/index.ts` — types `LeadMagnet`, `TrackedLink`, `Platform`
- `vercel.json` — déclaration cron

---

## Hors scope (non traité dans A-010)

- **Envoi auto des DMs** via workflow (dépend T-021, post-validation API Meta)
- **Module Social Analytics YouTube/TikTok** (T-033 — backlog)
- **UTM / attribution source publicitaire** au-delà du lead
- **A/B test de contenus** (comparer 2 variantes de lead magnet)
