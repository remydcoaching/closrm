-- Add booking horizon: maximum number of days in the future a prospect can book.
-- NULL = no limit.
ALTER TABLE booking_calendars
ADD COLUMN max_advance_days integer;

ALTER TABLE booking_calendars
ADD CONSTRAINT booking_calendars_max_advance_days_check
CHECK (max_advance_days IS NULL OR max_advance_days > 0);
