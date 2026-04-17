-- Kanban view support: top-N-per-status RPC + indexes
-- Migration 030 — depends on 022 (closed_at column), 023 (assigned_to), 028 (scripte status)

CREATE INDEX IF NOT EXISTS idx_leads_workspace_status_created
  ON leads (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_workspace_updated
  ON leads (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_workspace_closed
  ON leads (workspace_id, closed_at DESC) WHERE closed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION leads_grouped_by_status(
  p_workspace_id uuid,
  p_limit        int    DEFAULT 25,
  p_date_from    timestamptz DEFAULT NULL,
  p_date_to      timestamptz DEFAULT NULL,
  p_date_field   text   DEFAULT 'created_at',
  p_sources      text[] DEFAULT NULL,
  p_assigned_to  uuid   DEFAULT NULL,
  p_search       text   DEFAULT NULL,
  p_role         text   DEFAULT NULL,
  p_user_id      uuid   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_date_field NOT IN ('created_at','updated_at','closed_at') THEN
    RAISE EXCEPTION 'invalid p_date_field: %', p_date_field;
  END IF;

  WITH filtered AS (
    SELECT l.*,
           ROW_NUMBER() OVER (PARTITION BY l.status ORDER BY l.created_at DESC) AS rn
    FROM leads l
    WHERE l.workspace_id = p_workspace_id
      AND (p_sources     IS NULL OR l.source      = ANY(p_sources))
      AND (p_assigned_to IS NULL OR l.assigned_to = p_assigned_to)
      AND (
        p_date_from IS NULL OR
        (p_date_field = 'created_at' AND l.created_at >= p_date_from) OR
        (p_date_field = 'updated_at' AND l.updated_at >= p_date_from) OR
        (p_date_field = 'closed_at'  AND l.closed_at  >= p_date_from)
      )
      AND (
        p_date_to IS NULL OR
        (p_date_field = 'created_at' AND l.created_at <= p_date_to) OR
        (p_date_field = 'updated_at' AND l.updated_at <= p_date_to) OR
        (p_date_field = 'closed_at'  AND l.closed_at  <= p_date_to)
      )
      AND (
        p_search IS NULL OR
        l.first_name ILIKE '%' || p_search || '%' OR
        l.last_name  ILIKE '%' || p_search || '%' OR
        l.email      ILIKE '%' || p_search || '%' OR
        l.phone      ILIKE '%' || p_search || '%'
      )
      AND (
        p_role IS NULL OR p_role = 'admin' OR
        (p_role = 'setter' AND (l.assigned_to = p_user_id OR l.assigned_to IS NULL)) OR
        (p_role = 'closer' AND l.assigned_to = p_user_id
         AND l.status IN ('closing_planifie','no_show_closing','clos'))
      )
  ),
  per_status AS (
    SELECT status,
           COUNT(*) AS status_total,
           COALESCE(
             jsonb_agg(to_jsonb(filtered) - 'rn' ORDER BY created_at DESC)
               FILTER (WHERE rn <= p_limit),
             '[]'::jsonb
           ) AS leads
    FROM filtered
    GROUP BY status
  )
  SELECT jsonb_object_agg(
    status,
    jsonb_build_object('total', status_total, 'leads', leads)
  )
  INTO result
  FROM per_status;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION leads_grouped_by_status(
  uuid, int, timestamptz, timestamptz, text, text[], uuid, text, text, uuid
) TO authenticated;
