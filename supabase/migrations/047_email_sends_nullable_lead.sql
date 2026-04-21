-- Permet de logger les envois email qui n'ont pas de lead associé :
--   - booking_confirmation (destinataire pas toujours dans leads)
--   - direct_message (participant email existe, lead_id optionnel)
--   - sequence (lead_id reste requis en pratique mais flexibilité bienvenue)
--
-- Sans cette modif, impossible de tracker les bounces/complaints/opens sur
-- ces flows car l'insert email_sends plantait sur NOT NULL lead_id.

ALTER TABLE email_sends
  ALTER COLUMN lead_id DROP NOT NULL;

-- Ajoute une colonne source pour savoir d'où vient l'envoi (analytics)
ALTER TABLE email_sends
  ADD COLUMN IF NOT EXISTS source TEXT CHECK (
    source IN (
      'broadcast',
      'workflow',
      'sequence',
      'booking_reminder',
      'booking_confirmation',
      'direct_message',
      'manual'
    )
  );
