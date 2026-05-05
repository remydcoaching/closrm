-- ═════════════════════════════════════════════════════════════════════
-- 066 — handle_new_user honore is_invited
--
-- Fix bug pré-existant : quand l'API /workspaces/members invite un user,
-- elle pose `user_metadata.is_invited = true` puis appelle
-- auth.admin.createUser. Le trigger handle_new_user fire systématiquement
-- et crée un workspace + users + workspace_members pour le NOUVEAU user.
-- L'API ensuite tente d'INSERT users avec le même id → PK conflict
-- (ou autre side-effect), Supabase Auth renvoie "Database error creating
-- new user".
--
-- Fix : si is_invited=true, le trigger se contente de créer la row users
-- (id seulement, sans workspace) pour respecter la FK auth → public.users,
-- et laisse l'API se débrouiller pour le reste.
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  is_invited boolean;
BEGIN
  is_invited := COALESCE((new.raw_user_meta_data->>'is_invited')::boolean, false);

  IF is_invited THEN
    -- User invité : ne pas créer de workspace.
    -- L'API /api/workspaces/members POST se charge de tout (users + members).
    -- Le trigger ne fait rien, l'API a le contrôle complet.
    RETURN new;
  END IF;

  -- Inscription standard (signup) : créer le workspace + user + admin member
  INSERT INTO workspaces (
    name, owner_id,
    plan_id, subscription_status,
    trial_ends_at, current_period_start, current_period_end
  )
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'Mon workspace') || ' — Workspace',
    new.id,
    'trial',
    'trial',
    now() + interval '14 days',
    now(),
    now() + interval '14 days'
  )
  RETURNING id INTO new_workspace_id;

  INSERT INTO users (id, workspace_id, email, role, full_name)
  VALUES (
    new.id,
    new_workspace_id,
    new.email,
    'coach',
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at)
  VALUES (new_workspace_id, new.id, 'admin', 'active', now());

  RETURN new;
END;
$$;
