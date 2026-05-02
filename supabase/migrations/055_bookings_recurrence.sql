-- Migration 055: Recurring bookings
--
-- Ajoute une colonne `recurrence_group_id` (UUID nullable) sur `bookings`
-- pour grouper les occurrences d'une série récurrente. Tous les bookings
-- créés depuis une même règle de récurrence partagent ce group_id, ce qui
-- permet ensuite à l'API DELETE de supporter `?scope=this|future|all`.
--
-- Additif et non-destructif : aucune donnée existante n'est modifiée.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID;

-- Index pour les filtres par série (DELETE scope=future|all utilise
-- `WHERE recurrence_group_id = $1 AND scheduled_at >= $2`).
CREATE INDEX IF NOT EXISTS idx_bookings_recurrence_group
  ON bookings (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
