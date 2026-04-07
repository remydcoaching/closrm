# Séparation des modules — Pierre & Rémy

> **Objectif :** Zéro dépendance entre les deux développeurs.
> Chacun possède ses modules de A à Z (API routes + frontend + composants).
> Personne n'attend l'autre pour avancer.
>
> Dernière mise à jour : 2026-04-07 (post-T-025/A-007, ouverture T-027 → T-031)

---

## Principe fondamental

**Chaque dev est autonome sur ses modules.** Il code l'API, les composants, la
page — tout. Les écritures croisées sont autorisées uniquement dans les cas
listés en bas de ce fichier (logique métier transverse).

---

## Répartition des modules — État au 2026-04-07

### Pierre — Modules

| Module | Statut | Tâche |
|--------|--------|-------|
| Auth (login, register, reset, middleware) | ✅ Terminé | T-002 |
| Landing page + refonte visuelle | ✅ Terminé | T-002 |
| Closing (API + page + actions) | ✅ Terminé | T-007 |
| Follow-ups (API + page) | ✅ Terminé | T-008 |
| Automations / Workflows v1 (13 actions, branching) | ✅ Terminé | T-014 |
| Notifications WhatsApp / Telegram | ✅ Terminé | T-016 |
| Paramètres Réglages (profil, workspace, branding) | ✅ Terminé | T-018 |
| Paramètres Intégrations | ✅ Terminé | T-019 |
| Module Emails (séquences + broadcast) | ✅ Terminé | T-020 |
| Module Calendrier / Booking + Google Calendar sync | ✅ Terminé | T-022 |
| Module Réseaux Sociaux (Instagram) + DMs + Commentaires | ✅ Terminé | T-023, T-024 |
| Audit Instagram + Performance (Server Components, 90 PRs) | ✅ Terminé | T-024 |
| Funnels v1 (builder initial) | ✅ Terminé | T-023 |
| Dark/Light Mode + Branding dynamique | ✅ Terminé | — |
| Instagram Automations (`comment_keyword`) | ⬜ Non démarré | T-021 |
| **Lead++ (workflow inline + pseudo IG + chaîne + Messages)** ⚠️ touche module Leads de Rémy | ⬜ Non démarré | **T-027** |
| **Automations v2** (nouveaux triggers/actions, observability) | ⬜ Non démarré | **T-029** |
| **Booking → auto Google Meet** (en ligne) | ⬜ Non démarré | **T-030** |

### Rémy — Modules

| Module | Statut | Tâche |
|--------|--------|-------|
| Setup projet (Next.js + Supabase + layout) | ✅ Terminé | — |
| Module Leads (liste + fiche + filtres) | ✅ Terminé | T-004 |
| Dashboard d'accueil | ✅ Terminé | T-003 |
| Module Statistiques | ✅ Terminé | T-011 |
| Base de données (vue globale + export CSV) | ✅ Terminé | T-012 |
| Intégration Meta Ads (OAuth + webhook) | ✅ Terminé | T-013 |
| Module Publicités (dashboard Meta Ads) | ✅ Terminé | T-017 |
| Follow Ads classification + KPIs santé | ✅ Terminé | T-025 |
| Source `follow_ads` + channel `instagram_dm` | ✅ Terminé | A-007 |
| Followers-as-prospects (V2) | ❌ Abandonné | T-026 |
| **Funnels v2** (refonte builder + analytics + templates) | ⬜ Non démarré | **T-028** |
| **Import portefeuille leads** (CSV + alternatives) | ⬜ Non démarré | **T-031** |

> ℹ️ T-027 (Lead++) initialement prévue pour Rémy a été **réassignée à Pierre**
> le 2026-04-07. Cette tâche touche au module Leads (territoire de Rémy) :
> c'est une exception assumée car Pierre maîtrise déjà le module Instagram et
> le moteur Workflows. Coordination obligatoire avec Rémy avant tout push.

---

## Dossiers par développeur

### Dossiers de Pierre (ne pas toucher si tu es Rémy)

```
src/app/(auth)/                                    ← Pierre
src/app/(dashboard)/closing/                       ← Pierre
src/app/(dashboard)/follow-ups/                    ← Pierre
src/app/(dashboard)/acquisition/automations/       ← Pierre
src/app/(dashboard)/acquisition/emails/            ← Pierre (transféré ex-Rémy le 01/04)
src/app/(dashboard)/calendrier/                    ← Pierre (T-022)
src/app/(dashboard)/social/                        ← Pierre (T-023/T-024)
src/app/(dashboard)/messages/                      ← Pierre (T-023/T-024)
src/app/(dashboard)/parametres/                    ← Pierre
src/app/api/calls/                                 ← Pierre
src/app/api/follow-ups/                            ← Pierre
src/app/api/workflows/                             ← Pierre
src/app/api/notifications/                         ← Pierre
src/app/api/user/                                  ← Pierre
src/app/api/workspaces/                            ← Pierre
src/app/api/instagram/                             ← Pierre
src/app/api/bookings/                              ← Pierre
src/app/api/booking-calendars/                     ← Pierre
src/app/api/booking-locations/                     ← Pierre
src/app/api/emails/                                ← Pierre (séquences + broadcast)
src/app/api/cron/instagram-*/                      ← Pierre
src/app/api/webhooks/resend/                       ← Pierre
src/app/api/public/book/                           ← Pierre (booking public)
src/components/closing/                            ← Pierre
src/components/follow-ups/                         ← Pierre
src/components/automations/                        ← Pierre
src/components/social/                             ← Pierre
src/components/booking/ (ou calendrier/)           ← Pierre
src/components/settings/                           ← Pierre
src/components/emails/                             ← Pierre
src/components/funnels/                            ← Pierre (builder initial — Rémy y touchera en T-028)
src/hooks/use-user.ts                              ← Pierre
src/lib/whatsapp/                                  ← Pierre
src/lib/telegram/                                  ← Pierre
src/lib/instagram/                                 ← Pierre
src/lib/workflows/                                 ← Pierre
src/lib/google/calendar*                           ← Pierre (T-022/T-030)
src/lib/email/                                     ← Pierre
src/lib/funnels/                                   ← Pierre
```

### Dossiers de Rémy (ne pas toucher si tu es Pierre)

```
src/app/(dashboard)/dashboard/                     ← Rémy
src/app/(dashboard)/leads/                         ← Rémy
src/app/(dashboard)/statistiques/                  ← Rémy
src/app/(dashboard)/base-de-donnees/               ← Rémy
src/app/(dashboard)/acquisition/publicites/        ← Rémy
src/app/api/leads/                                 ← Rémy
src/app/api/contacts/                              ← Rémy
src/app/api/webhooks/meta/                         ← Rémy
src/app/api/integrations/meta/                     ← Rémy
src/app/api/meta/                                  ← Rémy
src/components/dashboard/                          ← Rémy
src/components/leads/                              ← Rémy
src/components/database/                           ← Rémy
src/components/stats/                              ← Rémy
src/lib/meta/                                      ← Rémy
src/lib/stats/                                     ← Rémy
src/lib/dashboard/                                 ← Rémy
src/lib/leads/                                     ← Rémy (à créer en T-027/T-031)
```

### Fichiers partagés (ne modifier qu'en accord)

```
src/types/index.ts                                 ← Partagé (modifs OK avec accord)
src/lib/utils.ts                                   ← Partagé
src/lib/supabase/*                                 ← Partagé
src/components/layout/*                            ← Partagé
src/components/shared/*                            ← Partagé
src/app/layout.tsx                                 ← Partagé
src/app/globals.css                                ← Partagé
supabase/schema.sql                                ← Partagé
supabase/migrations/                               ← Partagé (numérotation séquentielle, ne pas écraser celles de l'autre)
```

---

## Garde-fous Base de données & API

### Principe : tout le monde lit, chacun écrit chez soi

Le client Supabase est partagé. Les deux devs peuvent requêter **toutes** les
tables directement (pas besoin de passer par l'API de l'autre). La RLS
Supabase isole les données par workspace.

### Droits d'écriture (INSERT / UPDATE / DELETE)

| Table | Qui écrit principalement | API |
|-------|--------------------------|-----|
| `workspaces`, `users` | Pierre | `/api/workspaces`, `/api/user/*` |
| `leads` | Rémy | `/api/leads`, `/api/leads/import` |
| `calls` | Pierre | `/api/calls` |
| `follow_ups` | Pierre | `/api/follow-ups` |
| `workflows`, `workflow_*` | Pierre | `/api/workflows` |
| `automations` (legacy) | Pierre | `/api/automations` |
| `integrations` | Pierre + Rémy (selon le service) | Routes dédiées par service |
| `bookings`, `booking_calendars`, `booking_locations`, `planning_templates` | Pierre | `/api/bookings`, etc. |
| `email_*` (templates, séquences, broadcasts, sends) | Pierre | `/api/emails/*` |
| `funnels`, `funnel_pages`, `funnel_events` | Pierre (initial) → Rémy en T-028 | `/api/funnels/*` |
| `ig_*` (accounts, conversations, messages, drafts, etc.) | Pierre | `/api/instagram/*` |
| `lead_import_batches` (T-031) | Rémy | `/api/leads/import` |

### Exceptions autorisées (écritures croisées) — toujours valides

| Qui | Écrit dans | Quand | Quoi |
|-----|-----------|-------|------|
| Pierre | `leads` | Création/résolution call | UPDATE `status`, `call_attempts`, `reached` |
| Pierre | `leads` | Workflow `change_lead_status` / `add_tag` / `add_note` / `set_reached` | UPDATE colonnes métier |
| Rémy | `calls` | Fiche lead — bouton "Planifier RDV" | INSERT |
| Rémy | `follow_ups` | Fiche lead — section follow-ups | INSERT |
| Rémy | `ig_conversations` (T-027) | Création lead avec pseudo IG | UPDATE `lead_id` uniquement (pour lier la conversation au nouveau lead) |

**Règle :** ces écritures croisées sont limitées à des colonnes précises.
Jamais de DELETE ou de modification de structure sur une table qui n'est pas
la sienne.

---

## Garde-fous techniques

1. **Migration SQL** : numérotation séquentielle. Toujours vérifier le
   numéro le plus haut existant avant d'en créer une nouvelle. Annoncer à
   l'autre dev sur Slack avant de pousser une migration qui touche une
   table partagée (`leads`, `follow_ups`, `bookings`).

2. **Pas de CASCADE DELETE croisé** : si Pierre supprime un call, ça ne doit
   pas supprimer le lead. Les FK avec `ON DELETE CASCADE` sont uniquement
   `workspace → tout le reste`.

3. **Toujours filtrer par `workspace_id`** dans toutes les queries Supabase.
   La RLS est un filet, pas une excuse.

4. **Pas de modification des policies RLS** sans accord explicite.

5. **Pas de nouvelle table** sans accord (ouvrir une discussion sur la
   structure avant la migration).

6. **API routes = contrats du frontend de leur module**. Pour lire la table
   d'un autre module, utiliser Supabase directement, pas l'API de l'autre.

7. **Pas de triggers SQL croisés** : la logique transverse est dans le code
   API du dev qui en a besoin, pas dans un trigger SQL invisible.

---

## Coordination active — Tâches en cours nécessitant alignement

| Tâche | Doit aligner avec | Sur quoi |
|-------|-------------------|----------|
| **T-027** (Pierre) ⚠️ | Rémy | Touche le module Leads de Rémy : Pierre doit annoncer toute modif sur `LeadForm.tsx`, `api/leads/route.ts`, `types/index.ts` et la migration `leads.instagram_handle`. Synchroniser pour éviter les conflits avec T-031 (Rémy). |
| **T-029** (Pierre) | Rémy | Trigger `lead_imported` à exposer pour T-031. Action `create_google_meet` pour T-030. |
| **T-030** (Pierre) | — | Auto-suffisant côté Pierre (Google Calendar lib + bookings). |
| **T-031** (Rémy) | Pierre | Fire le trigger `lead_imported` quand T-029 l'aura exposé. **Conflit potentiel avec T-027** (les deux touchent `LeadForm` / migration `leads`) — séquencer ou se coordonner sur les fichiers. |
| **T-028** (Rémy) | Pierre | Refonte du module Funnels initialement créé par Pierre. Valider le périmètre (Rémy refait les blocs / Pierre garde le moteur ?). |

---

## Checklist avant chaque push

- [ ] Je n'ai touché aucun fichier dans les dossiers de l'autre dev (sauf
      écriture croisée listée et accordée)
- [ ] Si j'ai modifié `src/types/index.ts`, `schema.sql`, `globals.css` ou
      `layout.tsx` : c'est en accord avec l'autre dev
- [ ] Mes queries Supabase filtrent toutes par `workspace_id`
- [ ] Si j'ai créé une nouvelle table ou migration : c'est annoncé
- [ ] Mon `.env.local` n'est PAS dans le commit
- [ ] Ma branche respecte `feature/remy-*` ou `feature/pierre-*`

---

*Mis à jour le 2026-04-07 — ClosRM*
