// A stateful in-memory Supabase-shaped mock, built to honestly stand in for
// a real Postgres instance in this session — Docker was not available to run
// `supabase start` locally, so migrations 102/097 could not be exercised
// against a real engine. This mock enforces the SAME dedup rules the real
// unique indexes enforce (workspace scoping, leads.workspace_id+instagram_user_id
// uniqueness, instagram_interactions expression-index dedup), so tests here
// validate the application-level logic faithfully, but this is NOT a
// substitute for running the actual migrations against Postgres — see
// PHASE_3_5_REPORT.md for that caveat spelled out explicitly.
//
// RLS is simulated too: every table row carries workspace_id, and this mock
// refuses cross-workspace reads/writes the same way a real RLS policy would,
// scoped to the workspaceId the mock is constructed with.

export interface FakeLead {
  id: string
  workspace_id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  status: string
  source: string
  instagram_handle: string | null
  instagram_user_id: string | null
}

export interface FakeInteraction {
  id: string
  workspace_id: string
  lead_id: string
  interaction_type: string
  instagram_user_id: string | null
  instagram_username: string
  full_name: string | null
  profile_url: string | null
  source_post_id: string | null
  source_post_url: string | null
  source_provider: string | null
  first_seen_at: string
  last_seen_at: string
  metadata: unknown
}

export interface FakeDiscoveryRun {
  id: string
  workspace_id: string
  provider: string
  instagram_username: string
  instagram_user_id: string | null
  status: string
  stopped_reason: string | null
  contents_found: number
  users_found: number
  interactions_found: number
  followers_found: number
  http_calls: number
  estimated_billed_requests: number
  errors_count: number
  started_at: string
  completed_at: string | null
  metadata: unknown
  triggered_by: string | null
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export class FakeDatabase {
  leads: FakeLead[] = []
  interactions: FakeInteraction[] = []
  discoveryRuns: FakeDiscoveryRun[] = []

  reset() {
    this.leads = []
    this.interactions = []
    this.discoveryRuns = []
  }
}

// Enforces the same uniqueness rule as migration 092's
// leads_workspace_ig_user_id_uq: (workspace_id, instagram_user_id) unique
// when instagram_user_id is not null.
function assertLeadUniqueness(db: FakeDatabase, lead: FakeLead) {
  if (lead.instagram_user_id == null) return
  const dup = db.leads.find(
    (l) => l.id !== lead.id && l.workspace_id === lead.workspace_id && l.instagram_user_id === lead.instagram_user_id,
  )
  if (dup) throw new Error(`duplicate key value violates unique constraint "leads_workspace_ig_user_id_uq"`)
}

// Enforces the same uniqueness rule as migration 092's
// instagram_interactions_dedup_uq expression index.
function dedupKeyFor(row: FakeInteraction): string {
  const identity = row.instagram_user_id ?? row.instagram_username
  return [row.workspace_id, row.lead_id, row.interaction_type, row.source_post_id ?? '', identity].join('::')
}

function assertInteractionUniqueness(db: FakeDatabase, row: FakeInteraction) {
  const key = dedupKeyFor(row)
  const dup = db.interactions.find((r) => r.id !== row.id && dedupKeyFor(r) === key)
  if (dup) throw new Error(`duplicate key value violates unique constraint "instagram_interactions_dedup_uq"`)
}

/**
 * Builds a Supabase-shaped client scoped to one workspace, honestly
 * simulating RLS: any query for a different workspace_id sees no rows,
 * exactly like a real RLS policy filtering on `workspace_id in (select
 * user_workspace_ids())` would when the caller belongs to only one workspace.
 */
export function makeFakeSupabase(db: FakeDatabase, callerWorkspaceId: string) {
  function leadsTable() {
    return {
      select: (_columns?: string) => ({
        eq: (col: string, val: unknown) => {
          const filters: Array<[string, unknown]> = [[col, val]]
          const chain = {
            eq: (col2: string, val2: unknown) => {
              filters.push([col2, val2])
              return chain
            },
            maybeSingle: async () => {
              const row = db.leads.find((l) => {
                if (l.workspace_id !== callerWorkspaceId) return false
                return filters.every(([c, v]) => (l as unknown as Record<string, unknown>)[c] === v)
              })
              return { data: row ? { id: row.id } : null, error: null }
            },
          }
          return chain
        },
      }),
      insert: (payload: Partial<FakeLead>) => ({
        select: (_columns?: string) => ({
          single: async () => {
            if (payload.workspace_id !== callerWorkspaceId) {
              return { data: null, error: { message: 'new row violates row-level security policy' } }
            }
            const row: FakeLead = {
              id: nextId('lead'),
              workspace_id: payload.workspace_id!,
              first_name: payload.first_name ?? '',
              last_name: payload.last_name ?? '',
              phone: payload.phone ?? '',
              email: payload.email ?? null,
              status: payload.status ?? 'nouveau',
              source: payload.source ?? 'instagram_engagement',
              instagram_handle: payload.instagram_handle ?? null,
              instagram_user_id: payload.instagram_user_id ?? null,
            }
            try {
              assertLeadUniqueness(db, row)
            } catch (e) {
              return { data: null, error: { message: e instanceof Error ? e.message : String(e) } }
            }
            db.leads.push(row)
            return { data: { id: row.id }, error: null }
          },
        }),
      }),
    }
  }

  function interactionsTable() {
    return {
      select: (_columns?: string) => ({
        eq: (col: string, val: unknown) => {
          const filters: Array<[string, unknown]> = [[col, val]]
          const chain = {
            eq: (col2: string, val2: unknown) => {
              filters.push([col2, val2])
              return chain
            },
            or: (orExpr: string) => {
              // Mirrors `.or('instagram_user_id.eq.X,instagram_username.eq.X')`
              // used by persist.ts — parse the two eq() clauses it always sends.
              const clauses = orExpr.split(',').map((c) => {
                const [field, , value] = c.split('.')
                return { field, value }
              })
              return {
                maybeSingle: async () => {
                  const row = db.interactions.find((r) => {
                    if (r.workspace_id !== callerWorkspaceId) return false
                    const baseMatch = filters.every(([c, v]) => (r as unknown as Record<string, unknown>)[c] === v)
                    if (!baseMatch) return false
                    return clauses.some(({ field, value }) => (r as unknown as Record<string, unknown>)[field] === value)
                  })
                  return { data: row ? { id: row.id } : null, error: null }
                },
              }
            },
          }
          return chain
        },
      }),
      insert: async (payload: Partial<FakeInteraction>) => {
        if (payload.workspace_id !== callerWorkspaceId) {
          return { error: { message: 'new row violates row-level security policy' } }
        }
        const row: FakeInteraction = {
          id: nextId('interaction'),
          workspace_id: payload.workspace_id!,
          lead_id: payload.lead_id!,
          interaction_type: payload.interaction_type!,
          instagram_user_id: payload.instagram_user_id ?? null,
          instagram_username: payload.instagram_username!,
          full_name: payload.full_name ?? null,
          profile_url: payload.profile_url ?? null,
          source_post_id: payload.source_post_id ?? null,
          source_post_url: payload.source_post_url ?? null,
          source_provider: payload.source_provider ?? null,
          first_seen_at: new Date().toISOString(),
          last_seen_at: (payload.last_seen_at as string) ?? new Date().toISOString(),
          metadata: payload.metadata ?? null,
        }
        try {
          assertInteractionUniqueness(db, row)
        } catch (e) {
          return { error: { message: e instanceof Error ? e.message : String(e) } }
        }
        db.interactions.push(row)
        return { error: null }
      },
      update: (patch: Partial<FakeInteraction>) => ({
        eq: async (col: string, val: unknown) => {
          const row = db.interactions.find((r) => (r as unknown as Record<string, unknown>)[col] === val && r.workspace_id === callerWorkspaceId)
          if (!row) return { error: { message: 'not found' } }
          Object.assign(row, patch)
          return { error: null }
        },
      }),
    }
  }

  function discoveryRunsTable() {
    return {
      insert: (payload: Partial<FakeDiscoveryRun>) => ({
        select: (_columns?: string) => ({
          single: async () => {
            if (payload.workspace_id !== callerWorkspaceId) {
              return { data: null, error: { message: 'new row violates row-level security policy' } }
            }
            const row: FakeDiscoveryRun = {
              id: nextId('run'),
              workspace_id: payload.workspace_id!,
              provider: payload.provider ?? 'hiker',
              instagram_username: payload.instagram_username!,
              instagram_user_id: payload.instagram_user_id ?? null,
              status: payload.status ?? 'RUNNING',
              stopped_reason: payload.stopped_reason ?? null,
              contents_found: payload.contents_found ?? 0,
              users_found: payload.users_found ?? 0,
              interactions_found: payload.interactions_found ?? 0,
              followers_found: payload.followers_found ?? 0,
              http_calls: payload.http_calls ?? 0,
              estimated_billed_requests: payload.estimated_billed_requests ?? 0,
              errors_count: payload.errors_count ?? 0,
              started_at: new Date().toISOString(),
              completed_at: payload.completed_at ?? null,
              metadata: payload.metadata ?? null,
              triggered_by: payload.triggered_by ?? null,
            }
            db.discoveryRuns.push(row)
            return { data: { id: row.id }, error: null }
          },
        }),
      }),
      update: (patch: Partial<FakeDiscoveryRun>) => ({
        eq: async (col: string, val: unknown) => {
          const row = db.discoveryRuns.find((r) => (r as unknown as Record<string, unknown>)[col] === val && r.workspace_id === callerWorkspaceId)
          if (!row) return { error: { message: 'not found' } }
          Object.assign(row, patch)
          return { error: null }
        },
      }),
      select: (_columns?: string) => ({
        eq: (col: string, val: unknown) => ({
          order: (_col?: string, _opts?: { ascending?: boolean }) => ({
            limit: async (_n?: number) => {
              const rows = db.discoveryRuns.filter(
                (r) => r.workspace_id === callerWorkspaceId && (r as unknown as Record<string, unknown>)[col] === val,
              )
              return { data: rows, error: null }
            },
          }),
        }),
      }),
    }
  }

  function from(table: 'leads'): ReturnType<typeof leadsTable>
  function from(table: 'instagram_interactions'): ReturnType<typeof interactionsTable>
  function from(table: 'discovery_runs'): ReturnType<typeof discoveryRunsTable>
  function from(table: string) {
    if (table === 'leads') return leadsTable()
    if (table === 'instagram_interactions') return interactionsTable()
    if (table === 'discovery_runs') return discoveryRunsTable()
    throw new Error(`Unexpected table in fake Supabase: ${table}`)
  }

  return { from }
}
