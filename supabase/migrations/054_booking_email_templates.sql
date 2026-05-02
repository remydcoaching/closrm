-- Migration 054 : Booking calendars peuvent référencer un email_template
-- pour personnaliser la confirmation et le rappel email envoyés.
--
-- Comportement :
--   - Si confirmation_template_id IS NULL → fallback sur le HTML hardcodé
--   - Si reminder_email_template_id IS NULL → fallback sur le wrapper
--     <p>{message}</p> actuel (channel=email uniquement)
--
-- ON DELETE SET NULL : supprimer un template ne casse pas le calendrier,
-- il retombe simplement sur le fallback hardcodé.

ALTER TABLE booking_calendars
  ADD COLUMN IF NOT EXISTS confirmation_template_id UUID
    REFERENCES email_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_email_template_id UUID
    REFERENCES email_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_booking_calendars_confirmation_template
  ON booking_calendars(confirmation_template_id)
  WHERE confirmation_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_calendars_reminder_email_template
  ON booking_calendars(reminder_email_template_id)
  WHERE reminder_email_template_id IS NOT NULL;
