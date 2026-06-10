-- Permet de distinguer un événement "occupé" (bloque les réservations
-- publiques) d'un événement "disponible" (affiché sur l'agenda côté coach
-- mais ne masque pas le créneau côté page de booking).
--
-- Cas d'usage : le coach pose un bloc "Horaires de travail 13h-20h" sur sa
-- semaine pour visualiser, mais veut quand même que les leads puissent
-- réserver dedans.
--
-- DEFAULT TRUE = comportement actuel préservé. Tous les bookings existants
-- continuent de bloquer les réservations comme avant.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS blocks_availability boolean NOT NULL DEFAULT true;

-- Index partiel : la grosse majorité des lignes auront blocks_availability=true.
-- On indexe juste les exceptions pour accélérer les jointures éventuelles.
CREATE INDEX IF NOT EXISTS idx_bookings_blocks_availability_false
  ON public.bookings (workspace_id, scheduled_at)
  WHERE blocks_availability = false;
