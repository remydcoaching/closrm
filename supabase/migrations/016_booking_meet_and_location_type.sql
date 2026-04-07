-- Migration 016: Add location_type to booking_locations + meet_url to bookings

-- Type de lieu : présentiel ou en ligne
ALTER TABLE booking_locations ADD COLUMN location_type TEXT NOT NULL DEFAULT 'in_person'
  CHECK (location_type IN ('in_person', 'online'));

-- Lien Google Meet sur les bookings
ALTER TABLE bookings ADD COLUMN meet_url TEXT;
