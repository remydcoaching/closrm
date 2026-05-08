-- Add require_confirmation flag to booking calendars
-- When true, bookings created via public pages are set to 'pending' until coach confirms
-- When false (default), bookings are auto-confirmed and email is sent immediately
ALTER TABLE booking_calendars ADD COLUMN IF NOT EXISTS require_confirmation boolean NOT NULL DEFAULT false;
