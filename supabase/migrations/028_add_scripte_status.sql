ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('nouveau', 'scripte', 'setting_planifie', 'no_show_setting', 'closing_planifie', 'no_show_closing', 'clos', 'dead'));
