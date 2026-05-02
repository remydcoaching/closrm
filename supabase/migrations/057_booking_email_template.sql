-- Email customization per calendar
ALTER TABLE booking_calendars
ADD COLUMN email_template text NOT NULL DEFAULT 'premium'
  CHECK (email_template IN ('premium', 'minimal', 'plain'));

ALTER TABLE booking_calendars
ADD COLUMN email_accent_color text NOT NULL DEFAULT '#E53E3E'
  CHECK (email_accent_color ~ '^#[0-9A-Fa-f]{6}$');
