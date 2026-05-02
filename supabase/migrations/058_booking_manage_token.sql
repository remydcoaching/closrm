-- Add a public manage token for each booking. Used in confirmation emails so
-- prospects can cancel/reschedule without authenticating.
ALTER TABLE bookings
ADD COLUMN manage_token uuid DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX idx_bookings_manage_token ON bookings (manage_token);
