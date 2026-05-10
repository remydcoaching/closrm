-- Permet d'override la couleur d'un booking individuel.
-- Avant : la couleur était dérivée du calendar (ou du fallback bleu pour
-- "is_personal"). Désormais l'utilisateur peut choisir une couleur custom
-- au moment de créer/modifier un RDV — utile pour distinguer un cas
-- particulier dans une grille dense.
--
-- NULL = pas d'override → on retombe sur la logique calendar/personal
-- existante côté `bookingToAgendaEvent`.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS color text;
