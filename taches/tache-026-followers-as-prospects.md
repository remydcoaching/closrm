# Tâche 026 — Vision V2 : Followers Instagram comme prospects (ManyChat-like)

> **Statut :** ⬜ Non démarré — fiche à valider avec Rémy/Pierre avant ouverture
> **Développeur :** Rémy
> **Date de création :** 2026-04-07
> **Branche Git prévue :** `feature/remy-followers-as-prospects`

---

## Objectif

Étendre le pipeline ClosRM pour traiter les **followers Instagram acquis via Follow Ads** comme des prospects à part entière du CRM, à la manière de ManyChat. L'objectif est de fermer la boucle entre les Follow Ads (livrées en T-025) et le pipeline de leads, pour que la dépense pub Awareness ait un ROI mesurable côté CRM.

Suite directe de la classification Leadform/Follow Ads (T-025) : on a aujourd'hui les KPIs des Follow Ads mais aucun prospect concret en sortie côté pipeline.

---

## Périmètre

### Ce qui est inclus dans cette tâche

- **Détection des nouveaux followers IG**
  - Polling de la liste des followers via l'API Instagram Graph (ou webhook si disponible)
  - Diff avec le snapshot précédent → identification des nouveaux followers
  - Stockage dans une nouvelle table `ig_followers` (workspace_id, ig_user_id, username, followed_at, source_attribution)

- **Création automatique de leads**
  - Pour chaque nouveau follower détecté → création d'un lead avec `source: 'follow_ads'`
  - Champs minimaux : `first_name` (depuis username IG), `tags: ['ig_follower']`
  - Lien `lead.ig_user_id` ↔ `ig_followers.ig_user_id`

- **Attribution follower → campagne source**
  - Lorsqu'un follower est gagné pendant qu'une campagne Follow Ads tourne, associer la campagne courante (`meta_campaign_id` du lead)
  - Heuristique : meilleure correspondance temporelle entre `followed_at` et campagnes Follow Ads actives, pondérée par dépense
  - Permet de calculer un vrai CPL (coût par follower → coût par lead) côté Follow Ads

- **Workflow d'automations DM**
  - Nouveau trigger workflow : `new_ig_follower` (déjà préparé en T-014/T-021 via `new_follower`)
  - DM de bienvenue automatique
  - Séquence de qualification (questions : objectif, niveau, urgence)
  - Détection d'intent dans les réponses → conversion en `lead.status: 'setting_planifie'`

- **UI**
  - Vue "Followers" dans le module Réseaux Sociaux (filtrable, avec lien vers la fiche lead créée)
  - Indicateur de santé "follower → lead conversion rate" sur le dashboard Follow Ads
  - Badge dédié sur les leads issus de followers (déjà couvert par `source: 'follow_ads'` + tag `ig_follower`)

### Ce qui est explicitement exclu

- Multi-comptes Instagram par workspace → fiche séparée si besoin
- Détection des unfollows / churn de followers → V2.1
- Scoring automatique des followers (chaud/froid) basé sur leur activité IG → V2.1
- Re-targeting custom audiences via Meta API → V2.1

---

## Fichiers concernés (prévisionnel)

### Fichiers à créer
| Fichier | Description |
|---------|-------------|
| `supabase/migrations/0XX_ig_followers.sql` | Table `ig_followers` + index + RLS |
| `src/lib/instagram/followers.ts` | Polling + diff + détection nouveaux followers |
| `src/lib/instagram/attribution.ts` | Algorithme d'attribution follower → campagne Follow Ads |
| `src/app/api/cron/instagram-followers/route.ts` | Cron horaire de polling |
| `src/app/api/instagram/followers/route.ts` | API CRUD followers |
| `src/app/(dashboard)/social/followers/page.tsx` | Vue dédiée followers |
| `src/lib/workflows/triggers/new-ig-follower.ts` | Trigger workflow |

### Fichiers à modifier
| Fichier | Nature |
|---------|--------|
| `src/types/index.ts` | Type `IgFollower` + extension `Lead` (`ig_user_id`) |
| `src/lib/workflows/templates.ts` | Templates "DM de bienvenue", "Qualification IG follower" |
| `src/app/(dashboard)/acquisition/publicites/ads-overview-tab.tsx` | KPI "Followers acquis" + "Followers → leads qualifiés" sur la section Follow Ads |
| `supabase/schema.sql` | Reflet de la migration |

---

## Tâches liées

| Relation | Tâche | Description |
|----------|-------|-------------|
| Dépend de | T-013 | Intégration Meta Ads (OAuth) |
| Dépend de | T-017 | Module Publicités (dashboard Meta) |
| Dépend de | T-023 | Module Instagram de Pierre (compte IG connecté, snapshots) |
| Dépend de | T-025 | Classification Follow Ads (typage des campagnes Awareness) |
| Liée à | T-014 | Workflows / Automations (trigger `new_follower` déjà prévu) |
| Liée à | T-021 | Instagram Automations (Pierre — comment_keyword) |

---

## Notes techniques

### Source du lien follower → campagne
L'API Instagram Graph **ne dit pas explicitement** d'où vient un follower (organique vs Follow Ad). On doit donc faire de l'**attribution probabiliste** :

1. Récupérer toutes les Follow Ads actives au moment du follow (`status: ACTIVE`, `objective: OUTCOME_AWARENESS|REACH`)
2. Pondérer par dépense quotidienne / impressions de la veille
3. Si une seule campagne tourne → attribution directe
4. Sinon → attribution proportionnelle (ou choisir la mieux ciblée par audience)

À documenter clairement dans l'UI : "attribution estimée, pas garantie".

### Polling vs webhook
- **Webhook IG :** ne notifie pas les nouveaux followers (limitation Meta documentée)
- **Polling :** seule option viable. Cron horaire avec diff sur la liste `/me/followers`
- Limite API : 200 calls/heure → OK pour la majorité des coachs (followers < 100k)

### Coordination avec Pierre (T-021/T-023)
- T-023 a déjà créé `ig_accounts`, `ig_snapshots`, `ig_conversations`. Cette fiche s'appuie dessus
- Le trigger workflow `new_follower` est déjà déclaré dans `WorkflowTriggerType` (types/index.ts:119)
- Vérifier avec Pierre que son module IG ne fait pas déjà du polling de followers (sinon factoriser)

---

## Résultat final

_À remplir à la fin de la tâche._

---

## Améliorations identifiées pendant cette tâche

_À remplir au fil de l'eau._
