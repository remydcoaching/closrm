-- Migration 051: Enable RLS on billing_plans
-- billing_plans is a reference table (read-only for clients).
-- Without RLS, anyone with the project URL can mutate it via the public API.

ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read billing plans"
  ON billing_plans FOR SELECT
  USING (true);
