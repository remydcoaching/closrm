# Spec — Equipe Multi-Utilisateurs (Admin / Setter / Closer)

> **Date :** 2026-04-09
> **Auteur :** Pierre
> **Statut :** Spec ecrite, EN ATTENTE DE VALIDATION avant implementation
> **Criticite :** HAUTE — touche l'auth, les RLS policies, et la securite des donnees

---

## Objectif

Permettre a un coach (admin) d'inviter des membres dans son workspace avec des roles specifiques (setter, closer). Chaque role a des permissions limitees. L'admin controle tout.

---

## Roles

### Admin (dirigeant)
- Acces complet a tout le CRM
- Peut inviter/suspendre/supprimer des membres
- Peut configurer les parametres, integrations, automations
- Peut voir toutes les stats financieres
- Peut assigner des leads/calls a des setters/closers

### Setter
- Voit les leads qui lui sont assignes (pas tous)
- Peut passer des appels, logger les resultats
- Peut changer le statut d'un lead (nouveau → setting_planifie → closing_planifie)
- Peut voir les conversations Instagram des leads assignes
- Ne voit PAS les stats financieres (CA, cash, marge)
- Ne voit PAS les parametres/integrations
- Ne peut PAS supprimer de leads
- Ne peut PAS gerer l'equipe

### Closer
- Voit les leads en statut closing_planifie qui lui sont assignes
- Peut faire des appels de closing, logger les resultats
- Peut passer un lead en "clos" (avec montant du deal)
- Peut voir les conversations Instagram des leads assignes
- Voit ses propres stats de closing (mais pas celles des autres)
- Ne voit PAS les parametres/integrations
- Ne peut PAS gerer l'equipe

---

## Architecture technique

### Nouvelle table : `workspace_members`

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'closer' CHECK (role IN ('admin', 'setter', 'closer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  permissions JSONB DEFAULT '{}'::jsonb,
  invited_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
```

### Nouvelle colonne sur `leads` : `assigned_to`

```sql
ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES auth.users(id);
```

Permet d'assigner un lead a un setter ou closer specifique.

### Nouvelle colonne sur `calls` : `assigned_to`

```sql
ALTER TABLE calls ADD COLUMN assigned_to UUID REFERENCES auth.users(id);
```

### Migration des users existants

Tous les users actuels deviennent "admin" de leur workspace :
```sql
INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at)
SELECT workspace_id, id, 'admin', 'active', created_at FROM users;
```

---

## RLS Policies (CRITIQUE)

### Principe
- **Ancien pattern** : `workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())`
- **Nouveau pattern** : `workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active')`

### Policies par role

**Leads :**
- Admin : voit tous les leads du workspace
- Setter : voit uniquement les leads WHERE `assigned_to = auth.uid()` OU `assigned_to IS NULL`
- Closer : voit uniquement les leads WHERE `assigned_to = auth.uid()` AND status IN ('closing_planifie', 'no_show_closing', 'clos')

**Calls, Follow-ups, Bookings :**
- Admin : tout
- Setter/Closer : uniquement ceux lies a leurs leads assignes

**Workflows, Emails, Integrations, Parametres :**
- Admin uniquement

**Stats/Publicites :**
- Admin : tout
- Setter/Closer : stats filtrees sur leurs leads

---

## Flow d'invitation

1. Admin va dans **Parametres > Equipe**
2. Clique "Inviter un membre"
3. Remplit : email, nom, role (setter/closer)
4. ClosRM cree :
   - Un compte Supabase Auth (email + mot de passe genere)
   - Une row dans `users`
   - Une row dans `workspace_members` (status: 'invited')
5. Email envoye au membre avec ses identifiants
6. Le membre se connecte → status passe a 'active'
7. Il voit uniquement ce que son role permet

### Alternative simple (V1)
L'admin entre email + mot de passe directement. Pas d'email d'invitation. Il donne les credentials au membre en main propre ou par message. Plus simple a implementer.

---

## Pages / UI

### Parametres > Equipe (`/parametres/equipe`)
- Liste des membres : nom, email, role (badge), statut, date d'ajout
- Bouton "Inviter un membre"
- Actions par membre : changer le role, suspendre, supprimer
- Section "Permissions" par role (toggles)

### Modale d'invitation
- Email
- Nom complet
- Mot de passe (genere auto ou saisi par l'admin)
- Role (select : Setter / Closer)
- Bouton "Inviter"

### Navigation conditionnelle (Sidebar)
Le sidebar affiche uniquement les items accessibles au role :
- **Admin** : tout
- **Setter** : Dashboard, Leads (assignes), Closing (ses appels), Follow-ups, Messages, Agenda
- **Closer** : Dashboard, Leads (assignes closing), Closing, Follow-ups, Messages, Agenda

Items caches pour setter/closer :
- Statistiques (ou version limitee)
- Base de donnees
- Funnels, Automations, Emails, Reseaux sociaux, Publicites
- Parametres (sauf son profil), Integrations, Calendriers, Assistant IA

---

## Permissions granulaires (V2)

L'admin peut customiser les permissions par role via la page Equipe :

| Permission | Admin | Setter | Closer |
|---|---|---|---|
| Voir tous les leads | ✅ | ❌ | ❌ |
| Voir leads assignes | ✅ | ✅ | ✅ |
| Creer un lead | ✅ | ✅ | ❌ |
| Supprimer un lead | ✅ | ❌ | ❌ |
| Changer statut lead | ✅ | ✅ (partiel) | ✅ (closing) |
| Closer un deal (montant) | ✅ | ❌ | ✅ |
| Voir les stats financieres | ✅ | ❌ | ❌ |
| Voir ses propres stats | ✅ | ✅ | ✅ |
| Gerer les automations | ✅ | ❌ | ❌ |
| Gerer les emails | ✅ | ❌ | ❌ |
| Gerer les integrations | ✅ | ❌ | ❌ |
| Gerer l'equipe | ✅ | ❌ | ❌ |
| Acceder a l'Assistant IA | ✅ | ✅ | ✅ |

---

## Fichiers impactes

### A creer
| Fichier | Description |
|---|---|
| `supabase/migrations/023_team_members.sql` | Table workspace_members + migration users existants + leads.assigned_to |
| `src/app/api/workspaces/[id]/members/route.ts` | GET (list) + POST (invite) members |
| `src/app/api/workspaces/[id]/members/[userId]/route.ts` | PATCH (update role) + DELETE (remove) |
| `src/app/(dashboard)/parametres/equipe/page.tsx` | Page gestion equipe |
| `src/app/(dashboard)/parametres/equipe/equipe-client.tsx` | Client component |
| `src/components/team/InviteMemberModal.tsx` | Modale d'invitation |
| `src/components/team/MemberCard.tsx` | Card membre dans la liste |
| `src/lib/permissions.ts` | Helpers de permissions par role |
| `src/contexts/PermissionsContext.tsx` | Context React pour les permissions |

### A modifier
| Fichier | Modification |
|---|---|
| `src/types/index.ts` | Ajouter WorkspaceMember, Permission types |
| `src/hooks/use-user.ts` | Ajouter role + permissions |
| `src/components/layout/Sidebar.tsx` | Filtrer items par role |
| `src/lib/supabase/get-workspace.ts` | Aussi retourner le role |
| `supabase/schema.sql` | Nouvelles tables + policies |
| Toutes les RLS policies | Changer owner_id → workspace_members |

---

## Risques

1. **RLS Policies** — Si mal configurees, fuite de donnees entre workspaces. Tester CHAQUE policy individuellement.
2. **Backward compatibility** — Les users existants doivent continuer a fonctionner sans interruption.
3. **Performance** — Les policies qui font un JOIN sur workspace_members peuvent etre plus lentes. Ajouter des index.
4. **Supabase Auth** — Creer des comptes programmatiquement necessite la `service_role_key` (pas l'anon key).

---

## Ordre d'implementation suggere

1. Migration SQL (table + index + migration users existants) — safe, pas de breaking change
2. Types + lib permissions — safe
3. API members (CRUD) — safe
4. UI page Equipe + modale invitation — safe
5. Hook useUser enrichi + context permissions — safe
6. Sidebar conditionnel — safe
7. **RLS policies** — CRITIQUE, a faire en dernier avec tests exhaustifs
8. Filtrage par role dans les pages (leads, closing, etc.)

---

*Spec generee le 2026-04-09 — ClosRM / Pierre*
*⚠️ EN ATTENTE DE VALIDATION — ne pas implementer les RLS sans accord explicite*
