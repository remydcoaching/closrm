# Plan d'implementation — Module Equipe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> **⚠️ CRITIQUE** : Ce plan touche la securite (RLS). Chaque etape doit etre testee.

**Goal:** Implementer le systeme multi-utilisateurs avec roles (admin/setter/closer)

---

## MIGRATION 023 : Table workspace_members + backfill

**Fichier :** `supabase/migrations/023_workspace_members.sql`

### Etape 1 : Creer la table

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'setter' CHECK (role IN ('admin', 'setter', 'closer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  permissions JSONB DEFAULT '{}'::jsonb,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_wm_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_wm_user ON workspace_members(user_id);
CREATE INDEX idx_wm_role ON workspace_members(workspace_id, role);
```

### Etape 2 : RLS sur workspace_members

```sql
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Chaque membre peut voir les autres membres de son workspace
CREATE POLICY "wm_select" ON workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Seul l'admin peut inserer/modifier/supprimer
CREATE POLICY "wm_admin_manage" ON workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "wm_admin_update" ON workspace_members
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "wm_admin_delete" ON workspace_members
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Etape 3 : BACKFILL — migrer tous les owners existants

```sql
-- CRITIQUE : doit etre fait AVANT de changer les autres policies
INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at)
SELECT w.id, w.owner_id, 'admin', 'active', w.created_at
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm 
  WHERE wm.workspace_id = w.id AND wm.user_id = w.owner_id
);

-- Aussi ajouter les users qui sont dans la table users mais pas encore dans workspace_members
INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at)
SELECT u.workspace_id, u.id, 
  CASE u.role 
    WHEN 'coach' THEN 'admin'
    WHEN 'setter' THEN 'setter'
    WHEN 'closer' THEN 'closer'
    ELSE 'setter'
  END,
  'active', u.created_at
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm 
  WHERE wm.workspace_id = u.workspace_id AND wm.user_id = u.id
);
```

### Etape 4 : Ajouter assigned_to sur leads et calls

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

CREATE INDEX idx_leads_assigned ON leads(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_calls_assigned ON calls(assigned_to) WHERE assigned_to IS NOT NULL;
```

### Etape 5 : Modifier le trigger handle_new_user

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- Creer le workspace
  INSERT INTO workspaces (name, owner_id)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'Mon workspace') || ' — Workspace',
    new.id
  )
  RETURNING id INTO new_workspace_id;

  -- Creer le profil user
  INSERT INTO users (id, workspace_id, email, role, full_name)
  VALUES (
    new.id,
    new_workspace_id,
    new.email,
    'coach',
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );

  -- Creer le workspace_member (admin)
  INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at)
  VALUES (new_workspace_id, new.id, 'admin', 'active', now());

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## MIGRATION 024 : Remplacer TOUTES les RLS policies

**Fichier :** `supabase/migrations/024_rls_workspace_members.sql`

**⚠️ PREREQUIS : Migration 023 doit etre appliquee et verifiee AVANT**

### Fonction helper (evite la repetition)

```sql
-- Helper function pour verifier l'appartenance workspace
CREATE OR REPLACE FUNCTION user_workspace_ids()
RETURNS SETOF UUID AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active'
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Pattern A : Tables directes avec workspace_id (25 tables)

Pour CHAQUE table, le pattern est :
```sql
DROP POLICY IF EXISTS "ancien_nom_policy" ON nom_table;
CREATE POLICY "nom_table_access" ON nom_table
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));
```

Tables :
1. workspaces — special : `id IN (SELECT user_workspace_ids())`
2. users
3. leads
4. calls
5. follow_ups
6. workflows
7. workflow_executions
8. workspace_slugs
9. booking_calendars
10. bookings
11. booking_locations
12. planning_templates
13. funnels
14. funnel_pages
15. funnel_events
16. ig_accounts
17. ig_content_pillars
18. ig_stories
19. story_sequences
20. ig_reels
21. ig_drafts
22. ig_hashtag_groups
23. ig_caption_templates
24. ig_snapshots
25. ig_goals
26. ig_conversations
27. ig_messages
28. ig_comments
29. ai_coach_briefs
30. ai_conversation_outcomes
31. integrations

### Pattern B : Tables chainees (3 tables)

```sql
-- workflow_steps
DROP POLICY IF EXISTS "Workspace workflow_steps" ON workflow_steps;
CREATE POLICY "workflow_steps_access" ON workflow_steps
  FOR ALL USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE workspace_id IN (SELECT user_workspace_ids())
    )
  );

-- workflow_execution_logs
DROP POLICY IF EXISTS "Workspace execution_logs" ON workflow_execution_logs;
CREATE POLICY "execution_logs_access" ON workflow_execution_logs
  FOR ALL USING (
    execution_id IN (
      SELECT id FROM workflow_executions WHERE workspace_id IN (SELECT user_workspace_ids())
    )
  );

-- story_sequence_items
DROP POLICY IF EXISTS "story_sequence_items_workspace" ON story_sequence_items;
CREATE POLICY "story_sequence_items_access" ON story_sequence_items
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM story_sequences WHERE workspace_id IN (SELECT user_workspace_ids())
    )
  );
```

### Pattern C : Tables email (via users.workspace_id)

Meme pattern que A — on remplace par `user_workspace_ids()` :
```sql
-- email_domains, email_templates, email_broadcasts, email_sends, email_sequence_enrollments
DROP POLICY IF EXISTS "email_domains_workspace" ON email_domains;
CREATE POLICY "email_domains_access" ON email_domains
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));
-- (repeter pour chaque table email)
```

### Storage policies

```sql
-- workspace-logos : remplacer owner_id par workspace_members
DROP POLICY IF EXISTS "workspace_logos_owner_insert" ON storage.objects;
CREATE POLICY "workspace_logos_member_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'workspace-logos' AND
    (storage.foldername(name))[1]::uuid IN (SELECT user_workspace_ids())
  );
-- (repeter pour update et delete)
```

---

## TASK 3 : Types TypeScript

**Fichier :** `src/types/index.ts`

```typescript
// Roles
export type WorkspaceRole = 'admin' | 'setter' | 'closer'
export type MemberStatus = 'active' | 'invited' | 'suspended'

// WorkspaceMember
export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  status: MemberStatus
  permissions: Record<string, boolean>
  invited_by: string | null
  invited_at: string
  activated_at: string | null
  created_at: string
}

// Lead enrichi
export interface Lead {
  // ... existant ...
  assigned_to: string | null  // AJOUTER
}

// Call enrichi
export interface Call {
  // ... existant ...
  assigned_to: string | null  // AJOUTER
}
```

---

## TASK 4 : Enrichir getWorkspaceId avec le role

**Fichier :** `src/lib/supabase/get-workspace.ts`

```typescript
export interface WorkspaceContext {
  userId: string
  workspaceId: string
  role: WorkspaceRole  // AJOUTER
}

export async function getWorkspaceId(): Promise<WorkspaceContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch depuis workspace_members au lieu de users
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!member) throw new Error('Not a member of any workspace')

  return { userId: user.id, workspaceId: member.workspace_id, role: member.role as WorkspaceRole }
}
```

---

## TASK 5 : Permissions helper

**Fichier :** `src/lib/permissions.ts` (NOUVEAU)

```typescript
import { WorkspaceRole } from '@/types'

export interface PermissionSet {
  // Leads
  viewAllLeads: boolean
  viewAssignedLeads: boolean
  createLead: boolean
  deleteLead: boolean
  assignLead: boolean
  
  // Calls
  viewAllCalls: boolean
  viewAssignedCalls: boolean
  createCall: boolean
  
  // Closing
  closeDeal: boolean
  viewFinancials: boolean
  
  // Admin
  manageTeam: boolean
  manageSettings: boolean
  manageIntegrations: boolean
  manageAutomations: boolean
  manageEmails: boolean
  manageFunnels: boolean
  
  // Stats
  viewGlobalStats: boolean
  viewPersonalStats: boolean
  
  // IA
  useAiAssistant: boolean
}

const ADMIN_PERMS: PermissionSet = {
  viewAllLeads: true, viewAssignedLeads: true, createLead: true, deleteLead: true, assignLead: true,
  viewAllCalls: true, viewAssignedCalls: true, createCall: true,
  closeDeal: true, viewFinancials: true,
  manageTeam: true, manageSettings: true, manageIntegrations: true, manageAutomations: true, manageEmails: true, manageFunnels: true,
  viewGlobalStats: true, viewPersonalStats: true,
  useAiAssistant: true,
}

const SETTER_PERMS: PermissionSet = {
  viewAllLeads: false, viewAssignedLeads: true, createLead: true, deleteLead: false, assignLead: false,
  viewAllCalls: false, viewAssignedCalls: true, createCall: true,
  closeDeal: false, viewFinancials: false,
  manageTeam: false, manageSettings: false, manageIntegrations: false, manageAutomations: false, manageEmails: false, manageFunnels: false,
  viewGlobalStats: false, viewPersonalStats: true,
  useAiAssistant: true,
}

const CLOSER_PERMS: PermissionSet = {
  viewAllLeads: false, viewAssignedLeads: true, createLead: false, deleteLead: false, assignLead: false,
  viewAllCalls: false, viewAssignedCalls: true, createCall: true,
  closeDeal: true, viewFinancials: false,
  manageTeam: false, manageSettings: false, manageIntegrations: false, manageAutomations: false, manageEmails: false, manageFunnels: false,
  viewGlobalStats: false, viewPersonalStats: true,
  useAiAssistant: true,
}

export function getPermissions(role: WorkspaceRole): PermissionSet {
  switch (role) {
    case 'admin': return ADMIN_PERMS
    case 'setter': return SETTER_PERMS
    case 'closer': return CLOSER_PERMS
  }
}
```

---

## TASK 6 : API Members CRUD

**Fichiers :**
- `src/app/api/workspaces/members/route.ts` — GET (list) + POST (invite)
- `src/app/api/workspaces/members/[userId]/route.ts` — PATCH (role) + DELETE (remove)

### POST /api/workspaces/members (inviter)

1. Verifier que l'appelant est admin (via getWorkspaceId().role)
2. Creer le compte Supabase Auth via `createServiceClient().auth.admin.createUser()`
3. Creer la row dans `users`
4. Creer la row dans `workspace_members` (status: 'active')
5. Retourner les credentials (email + mot de passe) pour que l'admin les donne au membre

### GET /api/workspaces/members

1. Verifier que l'appelant est membre du workspace
2. Retourner tous les membres avec join sur users (full_name, email, avatar)

### PATCH /api/workspaces/members/[userId]

1. Verifier admin
2. Update role ou status

### DELETE /api/workspaces/members/[userId]

1. Verifier admin
2. Empecher de se supprimer soi-meme
3. Delete workspace_member + desactiver le compte Supabase Auth

---

## TASK 7 : Page Equipe UI

**Fichiers :**
- `src/app/(dashboard)/parametres/equipe/page.tsx`
- `src/app/(dashboard)/parametres/equipe/equipe-client.tsx`
- `src/components/team/InviteMemberModal.tsx`

### Page liste
- Liste des membres : avatar, nom, email, role (badge), statut, date
- Bouton "Inviter un membre"
- Menu actions par membre : changer role, suspendre, supprimer

### Modale invitation
- Email du nouveau membre
- Nom complet
- Mot de passe (genere auto avec bouton "copier")
- Role : Setter / Closer (radio)
- Bouton "Inviter"

---

## TASK 8 : Sidebar conditionnel

**Fichier :** `src/components/layout/Sidebar.tsx`

Ajouter le role dans les props et filtrer les items :

```typescript
// Items visibles par role
const ROLE_VISIBILITY: Record<string, WorkspaceRole[]> = {
  '/dashboard': ['admin', 'setter', 'closer'],
  '/agenda': ['admin', 'setter', 'closer'],
  '/leads': ['admin', 'setter', 'closer'],
  '/closing': ['admin', 'setter', 'closer'],
  '/follow-ups': ['admin', 'setter', 'closer'],
  '/statistiques': ['admin'],
  '/base-de-donnees': ['admin'],
  '/acquisition/funnels': ['admin'],
  '/acquisition/automations': ['admin'],
  '/acquisition/emails': ['admin'],
  '/acquisition/reseaux-sociaux': ['admin'],
  '/acquisition/messages': ['admin', 'setter', 'closer'],
  '/acquisition/publicites': ['admin'],
  '/parametres/reglages': ['admin'],
  '/parametres/integrations': ['admin'],
  '/parametres/calendriers': ['admin'],
  '/parametres/equipe': ['admin'],
  '/parametres/assistant-ia': ['admin', 'setter', 'closer'],
}
```

---

## TASK 9 : Dashboard par role

**Fichiers :**
- Modifier `src/app/(dashboard)/dashboard/page.tsx`
- Creer `src/components/dashboard/SetterDashboard.tsx`
- Creer `src/components/dashboard/CloserDashboard.tsx`

Selon le role, afficher un dashboard different (voir spec pour le contenu).

---

## ORDRE D'EXECUTION SAFE

```
1. TASK 3 : Types (safe, pas de breaking change)
2. TASK 5 : Permissions helper (safe, nouveau fichier)
3. MIGRATION 023 : Table + backfill (safe, additive)
4. TASK 4 : getWorkspaceId enrichi (safe si workspace_members backfill OK)
5. MIGRATION 024 : RLS policies (⚠️ CRITIQUE — tester individuellement)
6. TASK 6 : API Members CRUD
7. TASK 7 : Page Equipe UI
8. TASK 8 : Sidebar conditionnel
9. TASK 9 : Dashboard par role
```

**La migration 024 est le point de non-retour.** Tout avant est safe et reversible.

---

## VERIFICATION POST-DEPLOY

### Test 1 : Owner existant
- [ ] Se connecter avec un compte existant → acces normal a tout
- [ ] Verifier que workspace_members a une row admin

### Test 2 : Invitation
- [ ] Admin invite un setter → compte cree, row workspace_members
- [ ] Setter se connecte → voit uniquement ses pages autorisees

### Test 3 : RLS
- [ ] Setter ne peut PAS voir les leads non-assignes (quand le filtrage par role sera en place)
- [ ] Setter ne peut PAS acceder aux parametres
- [ ] Closer ne peut PAS supprimer de leads

### Test 4 : Backward compatibility
- [ ] Tous les coachs solo continuent a fonctionner sans interruption
- [ ] Aucune donnee perdue

---

*Plan genere le 2026-04-09 — ClosRM / Pierre*
