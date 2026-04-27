-- ═════════════════════════════════════════════════════════
-- Migration 052: Project Management (Kanban interne)
-- ═════════════════════════════════════════════════════════
-- Tables internes pour le suivi du projet ClosRM par Pierre
-- et Rémy. Pas de RLS — accès uniquement via slug secret côté
-- API serveur. Tables sous public avec préfixe pm_ pour rester
-- accessibles via PostgREST sans config schema supplémentaire.
-- ═════════════════════════════════════════════════════════

-- ─── Boards ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Tasks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      uuid NOT NULL REFERENCES public.pm_boards(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  assignee      text CHECK (assignee IN ('pierre', 'remy', 'both') OR assignee IS NULL),
  status        text NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  priority      text NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pm_tasks_board_status_position
  ON public.pm_tasks(board_id, status, position);

CREATE INDEX IF NOT EXISTS idx_pm_tasks_assignee
  ON public.pm_tasks(board_id, assignee);

-- ─── Trigger updated_at + completed_at ──────────────────
CREATE OR REPLACE FUNCTION public.pm_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pm_tasks_updated_at ON public.pm_tasks;
CREATE TRIGGER pm_tasks_updated_at
  BEFORE UPDATE ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.pm_set_updated_at();

-- ─── RLS désactivé (accès via service role uniquement) ──
ALTER TABLE public.pm_boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_tasks  DISABLE ROW LEVEL SECURITY;

-- ─── Board initial ──────────────────────────────────────
-- Slug : d522e1b9e19e4f9d74022000966e5099
-- URL : /projet/d522e1b9e19e4f9d74022000966e5099
INSERT INTO public.pm_boards (slug, name)
VALUES ('d522e1b9e19e4f9d74022000966e5099', 'ClosRM — Suivi projet')
ON CONFLICT (slug) DO NOTHING;
