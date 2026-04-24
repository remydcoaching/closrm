-- Design system email v2 : permet aux templates et broadcasts de
-- sélectionner un preset (classique, impact, ocean, etc.) et d'override
-- certaines valeurs (couleurs, font, boutons).
--
-- Les templates existants (preset_id NULL) continuent d'être rendus via le
-- compiler legacy (compiler.ts) — zéro régression.

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS preset_id TEXT,
  ADD COLUMN IF NOT EXISTS preset_override JSONB DEFAULT '{}'::jsonb;

ALTER TABLE email_broadcasts
  ADD COLUMN IF NOT EXISTS preset_id TEXT,
  ADD COLUMN IF NOT EXISTS preset_override JSONB DEFAULT '{}'::jsonb;

-- Index léger pour les futures requêtes stats "par preset"
CREATE INDEX IF NOT EXISTS idx_email_templates_preset ON email_templates(preset_id) WHERE preset_id IS NOT NULL;
