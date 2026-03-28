# Séparation des modules — Pierre & Rémy

> **Objectif :** Zéro dépendance entre les deux développeurs.
> Chacun possède ses modules de A à Z (API routes + frontend + composants).
> Personne n'attend l'autre pour avancer.

---

## Principe fondamental

**Chaque dev est autonome sur ses modules.** Il code l'API, les composants, la page — tout.
Les seuls fichiers partagés sont :
- `src/types/index.ts` (déjà fait, ne bouge plus)
- `src/lib/utils.ts` (déjà fait, ne bouge plus)
- `src/lib/supabase/*` (déjà fait, ne bouge plus)
- `supabase/schema.sql` (déjà fait, ne bouge plus)
- `src/components/layout/*` (sidebar, shell — déjà fait)

**Règle : ne jamais toucher aux fichiers de l'autre sans accord.**

---

## Répartition des modules

### Pierre — Modules

| Module | Périmètre (API + Frontend) |
|--------|---------------------------|
| **Auth** | Finaliser login/register, reset password, hook `useUser()`, helper `getWorkspaceId()` |
| **Closing** | API `/api/calls` + page closing (onglets, calendrier, actions) |
| **Follow-ups** | API `/api/follow-ups` + page follow-ups (tableau, filtres, modale) |
| **Automations** | API `/api/automations` + page automations (builder trigger/action) |
| **Notifications** | WhatsApp + Telegram (clients + API routes) |
| **Paramètres Réglages** | API `/api/user/profile` + `/api/workspaces` + page réglages |
| **Paramètres Intégrations** | Page intégrations (cards connexion/déconnexion) |
| **Intégration Meta Ads** | OAuth Meta, webhook `/api/webhooks/meta`, client Meta API |

### Rémy — Modules

| Module | Périmètre (API + Frontend) |
|--------|---------------------------|
| **Dashboard** | Page d'accueil avec KPIs, prochains appels, follow-ups en retard |
| **Leads** | API `/api/leads` + page liste leads + fiche lead détaillée |
| **Statistiques** | API `/api/leads/stats` + page stats (graphiques, funnel, KPIs) |
| **Base de données** | Page vue globale contacts, recherche, export CSV |
| **Intégration Google Agenda** | OAuth Google, sync RDV bidirectionnel |
| **Publicités** | Page dashboard Meta Ads (stats campagnes) |

---

## Fichiers par développeur

### Dossiers de Pierre (ne pas toucher si tu es Rémy)

```
src/app/(auth)/reset-password/          ← Pierre
src/app/(dashboard)/closing/            ← Pierre
src/app/(dashboard)/follow-ups/         ← Pierre
src/app/(dashboard)/acquisition/automations/  ← Pierre
src/app/(dashboard)/parametres/         ← Pierre
src/app/api/calls/                      ← Pierre
src/app/api/follow-ups/                 ← Pierre
src/app/api/automations/               ← Pierre
src/app/api/notifications/             ← Pierre
src/app/api/user/                      ← Pierre
src/app/api/workspaces/                ← Pierre
src/components/closing/                 ← Pierre
src/components/follow-ups/              ← Pierre
src/components/automations/             ← Pierre
src/components/settings/                ← Pierre
src/hooks/use-user.ts                   ← Pierre
src/lib/supabase/get-workspace.ts       ← Pierre
src/lib/whatsapp/                       ← Pierre
src/lib/telegram/                       ← Pierre
```

### Dossiers de Rémy (ne pas toucher si tu es Pierre)

```
src/app/(dashboard)/dashboard/          ← Rémy
src/app/(dashboard)/leads/              ← Rémy
src/app/(dashboard)/statistiques/       ← Rémy
src/app/(dashboard)/base-de-donnees/    ← Rémy
src/app/(dashboard)/acquisition/publicites/  ← Rémy
src/app/api/leads/                      ← Rémy
src/app/api/webhooks/meta/              ← Rémy
src/app/api/integrations/meta/          ← Rémy
src/app/api/integrations/google/        ← Rémy
src/components/dashboard/               ← Rémy
src/components/leads/                   ← Rémy
src/components/stats/                   ← Rémy
src/lib/meta/                           ← Rémy
src/lib/google/                         ← Rémy
```

### Fichiers partagés (ne modifier qu'en accord)

```
src/types/index.ts                      ← Partagé (stable, ne bouge pas)
src/lib/utils.ts                        ← Partagé (stable)
src/lib/supabase/*                      ← Partagé (stable)
src/components/layout/*                 ← Partagé (stable)
src/app/layout.tsx                      ← Partagé (stable)
src/app/globals.css                     ← Partagé (stable)
supabase/schema.sql                     ← Partagé (stable)
```

---

## Garde-fous Base de données & API

### Principe : tout le monde lit, chacun écrit chez soi

Le client Supabase est partagé. Les deux devs peuvent requêter **toutes** les tables directement (pas besoin de passer par l'API de l'autre). La RLS Supabase isole les données par workspace, donc aucun risque de conflit de données.

### Droits de lecture (SELECT)

| Table | Pierre | Rémy |
|-------|--------|------|
| `workspaces` | ✅ Lit | ✅ Lit |
| `users` | ✅ Lit | ✅ Lit |
| `leads` | ✅ Lit (pour afficher le nom du lead dans Closing, Follow-ups, etc.) | ✅ Lit + écrit (c'est son module) |
| `calls` | ✅ Lit + écrit (c'est son module) | ✅ Lit (pour afficher l'historique dans la fiche lead, dashboard, stats) |
| `follow_ups` | ✅ Lit + écrit (c'est son module) | ✅ Lit (pour afficher dans dashboard, fiche lead) |
| `automations` | ✅ Lit + écrit (c'est son module) | ✅ Lit (si besoin) |
| `integrations` | ✅ Lit + écrit (Meta Ads, page intégrations) | ✅ Lit + écrit (Google Agenda) |

**Règle :** tout le monde peut SELECT sur toutes les tables. C'est normal et nécessaire.

### Droits d'écriture (INSERT / UPDATE / DELETE)

| Table | Qui écrit | Via quelle API |
|-------|-----------|----------------|
| `workspaces` | Pierre (réglages) | `/api/workspaces` |
| `users` | Pierre (profil) | `/api/user/profile` |
| `leads` | Rémy (CRUD leads) | `/api/leads` |
| `leads` (statut uniquement) | Pierre (changement auto quand un call est créé/résolu) | `/api/calls` — voir exceptions ci-dessous |
| `calls` | Pierre | `/api/calls` |
| `follow_ups` | Pierre | `/api/follow-ups` |
| `automations` | Pierre | `/api/automations` |
| `integrations` | Pierre (Meta, WhatsApp, Telegram, page intégrations) + Rémy (Google) | Chacun sa route |

### Exceptions autorisées (écritures croisées)

Ces cas sont **normaux** et **autorisés** — c'est de la logique métier, pas un conflit :

| Qui | Écrit dans quelle table | Quand | Quoi exactement |
|-----|------------------------|-------|-----------------|
| **Pierre** | `leads` | Création d'un call via `/api/calls` | UPDATE `leads.status` uniquement (ex: `nouveau` → `setting_planifie`) |
| **Pierre** | `leads` | Résultat d'un call (outcome) | UPDATE `leads.status` (ex: `closing_planifie` → `clos` ou `no_show_closing`) |
| **Pierre** | `leads` | Bouton "Appeler" dans Closing | UPDATE `leads.call_attempts` (+1) et `leads.reached` |
| **Pierre** | `leads` | Automation `change_lead_status` | UPDATE `leads.status` |
| **Rémy** | `calls` | Fiche lead — bouton "Planifier RDV" | INSERT dans `calls` (crée un appel depuis la fiche lead) |
| **Rémy** | `follow_ups` | Fiche lead — section follow-ups | INSERT dans `follow_ups` (crée un follow-up depuis la fiche lead) |

**Règle : ces écritures croisées sont limitées à des colonnes précises. Ne jamais faire de DELETE ou de modification de structure sur une table qui n'est pas la sienne.**

### Garde-fous techniques

1. **Jamais d'ALTER TABLE sans accord des deux devs** — le schéma SQL est gelé. Si un dev a besoin d'une nouvelle colonne, il en parle d'abord.

2. **Jamais de CASCADE DELETE sur les tables de l'autre** — si Pierre supprime un call, ça ne doit pas supprimer le lead. Les foreign keys avec `ON DELETE CASCADE` sont uniquement workspace → tout le reste (déjà en place).

3. **Toujours passer par `getWorkspaceId()`** — chaque query doit filtrer par `workspace_id`. Ne jamais faire de query sans ce filtre (la RLS est un filet de sécurité, pas une excuse pour ne pas filtrer).

4. **Ne jamais modifier les policies RLS** sans accord — elles sont la dernière ligne de défense pour l'isolation des données.

5. **Ne jamais créer de nouvelle table** sans accord des deux devs — le schéma est défini, si on a besoin d'une table en plus on en discute d'abord.

6. **Les API routes sont des contrats** — si Rémy crée `/api/leads` avec un certain format de réponse et que Pierre a besoin de lire des leads, Pierre utilise `supabase.from('leads').select(...)` directement, PAS l'API de Rémy. Les API routes servent au frontend de leur propre module, pas à l'autre dev.

7. **Pas de triggers SQL croisés** — si Pierre a besoin qu'un événement dans `calls` déclenche quelque chose dans `leads`, il le fait dans son code API, pas via un trigger SQL qui pourrait surprendre Rémy.

---

## Seul point de coordination nécessaire

Pierre crée en premier `src/hooks/use-user.ts` et `src/lib/supabase/get-workspace.ts` car les deux devs en auront besoin dans leurs API routes. **Ce sont les 2 seuls fichiers que Pierre doit push avant que Rémy commence ses API.**

Alternativement, Rémy peut créer ses propres helpers en attendant et les remplacer ensuite.

---

## Checklist avant de push

- [ ] Je n'ai touché aucun fichier dans les dossiers de l'autre dev
- [ ] Je n'ai pas modifié `src/types/index.ts`, `schema.sql`, `globals.css` ou `layout.tsx` sans accord
- [ ] Mes queries Supabase filtrent toutes par `workspace_id`
- [ ] Je n'ai pas ajouté de nouvelle table ou colonne sans accord
- [ ] Si j'ai fait une écriture croisée (dans une table de l'autre), c'est dans la liste des exceptions autorisées
- [ ] Mon `.env.local` n'est PAS dans le commit

---

*Créé le 2026-03-27 — ClosRM*
