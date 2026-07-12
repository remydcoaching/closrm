-- Fix ig_stories metric columns:
-- taps_forward/taps_back were wrongly used to store profile_visits/follows
-- Rename them to their actual content, then add real navigation + interaction columns

ALTER TABLE ig_stories
  RENAME COLUMN taps_forward TO profile_visits;

ALTER TABLE ig_stories
  RENAME COLUMN taps_back TO follows;

ALTER TABLE ig_stories
  ADD COLUMN IF NOT EXISTS taps_forward  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taps_back     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_clicks   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares        integer NOT NULL DEFAULT 0;
