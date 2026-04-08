-- Add purpose column to booking_calendars
ALTER TABLE booking_calendars
ADD COLUMN purpose text NOT NULL DEFAULT 'other'
CHECK (purpose IN ('setting', 'closing', 'other'));
