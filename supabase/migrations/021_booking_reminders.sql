-- Add reminders config to booking_calendars
ALTER TABLE booking_calendars
ADD COLUMN reminders jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Table for materialized reminder instances
CREATE TABLE booking_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'instagram_dm')),
  message text NOT NULL,
  send_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_booking_reminders_pending ON booking_reminders (send_at)
  WHERE status = 'pending';

CREATE INDEX idx_booking_reminders_booking ON booking_reminders (booking_id);

-- RLS
ALTER TABLE booking_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their workspace booking_reminders"
  ON booking_reminders FOR ALL
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
