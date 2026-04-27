-- Harmonise les policies RLS de email_suppressions avec les autres tables
-- email (024_rls_workspace_members.sql) qui utilisent user_workspace_ids().
--
-- Problème corrigé : la policy précédente lisait uniquement workspace_members,
-- alors que les autres tables email acceptent aussi les workspaces où l'user
-- apparaît dans `users` (legacy). Résultat : certains coachs voyaient leur
-- liste de bounces vide alors qu'ils voyaient bien leurs templates/broadcasts.

DROP POLICY IF EXISTS "email_suppressions_select" ON email_suppressions;

CREATE POLICY "email_suppressions_access" ON email_suppressions FOR SELECT
  USING (
    workspace_id IS NULL
    OR workspace_id IN (SELECT user_workspace_ids())
  );

-- INSERT/DELETE restent réservés au service role (webhooks SES + API
-- /unsubscribe + /api/emails/suppressions/[id]). Pas de policy user.
