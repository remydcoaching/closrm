-- Permet d'envoyer un broadcast sans passer par un template.
-- Le coach compose directement le HTML + text dans le form de création de
-- campagne. Si body_html est présent (et pas template_id), le send route
-- l'utilise directement.

ALTER TABLE email_broadcasts
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS body_text TEXT;
