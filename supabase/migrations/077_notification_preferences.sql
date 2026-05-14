-- Préférences push notifications par user.
-- Chaque user du workspace peut activer/désactiver indépendamment chaque
-- type d'event. Si pas de row pour un (user, type) → considéré comme
-- enabled par défaut (cf helper sendPushToCoach côté serveur).

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- Liste des types : new_lead, booking_created, closing_assigned,
  -- call_reminder_h1, no_show, deal_won, dm_reply, followup_due
  type         text NOT NULL,
  enabled      boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS notif_prefs_user_id_idx
  ON public.notification_preferences(user_id);

-- updated_at trigger (réutilise la fn de push_tokens)
CREATE OR REPLACE FUNCTION public.notif_prefs_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notif_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.notif_prefs_set_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_prefs_owner_select
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY notif_prefs_owner_insert
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY notif_prefs_owner_update
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY notif_prefs_owner_delete
  ON public.notification_preferences FOR DELETE
  USING (auth.uid() = user_id);
