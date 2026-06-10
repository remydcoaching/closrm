-- Ajoute un thème de fond (sombre/clair) configurable pour la page publique
-- de réservation. Le coach peut choisir si sa page de booking s'affiche en
-- fond sombre (par défaut, cohérent avec le CRM) ou en fond clair.
--
-- La couleur principale (champ `color`) reste séparée et s'applique aux
-- boutons / accents quel que soit le thème.

ALTER TABLE public.booking_calendars
  ADD COLUMN IF NOT EXISTS background_theme text NOT NULL DEFAULT 'dark'
  CHECK (background_theme IN ('dark', 'light'));
