-- Push notifications — table des tokens Expo enregistrés par device.
-- Multi-device safe (un user peut avoir iPhone + iPad + Android), uniqueness
-- sur le token lui-même. Permet d'envoyer un push à un user en groupant
-- tous ses tokens actifs.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  -- Format Expo : "ExponentPushToken[xxx...]" (~150 chars)
  token        text NOT NULL UNIQUE,
  platform     text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx
  ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS push_tokens_workspace_id_idx
  ON public.push_tokens(workspace_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.push_tokens_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS push_tokens_updated_at ON public.push_tokens;
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.push_tokens_set_updated_at();

-- RLS : un user ne voit/touche que SES propres tokens (multi-device).
-- Le service role bypasse RLS pour l'envoi de pushs côté serveur.
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_owner_select
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY push_tokens_owner_insert
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_tokens_owner_update
  ON public.push_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_tokens_owner_delete
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);
