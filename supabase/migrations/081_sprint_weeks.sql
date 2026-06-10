CREATE TABLE sprint_weeks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  title      text NOT NULL,
  start_date date NOT NULL,
  end_date   date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sprint_day_kpis (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id        uuid REFERENCES sprint_weeks(id) ON DELETE CASCADE NOT NULL,
  date             date NOT NULL,
  ca_close         numeric DEFAULT 0,
  calls_booked     int DEFAULT 0,
  calls_done       int DEFAULT 0,
  dms_sent         int DEFAULT 0,
  reels_published  int DEFAULT 0,
  leads_ads        int DEFAULT 0,
  cpl              numeric DEFAULT 0,
  notes            text DEFAULT '',
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(sprint_id, date)
);

-- Sprint focus 1-6 juin 2026
INSERT INTO sprint_weeks (slug, title, start_date, end_date)
VALUES ('focus-juin-2026', 'Sprint Focus — 1 au 6 Juin 2026', '2026-06-01', '2026-06-06');
