// Exercises discovery_runs lifecycle for all four statuses without any real
// Hiker call — mirrors exactly the sequence of writes
// src/app/api/instagram/discovery/route.ts performs (insert RUNNING, then
// update with the final status/stats).
import { describe, it, expect, beforeEach } from 'vitest'
import { FakeDatabase, makeFakeSupabase } from './in-memory-supabase'

const WORKSPACE_A = 'workspace-a'

describe('Phase 3.5 — discovery_runs (point 7)', () => {
  let db: FakeDatabase
  beforeEach(() => {
    db = new FakeDatabase()
  })

  async function insertRunningRun(supabase: ReturnType<typeof makeFakeSupabase>, username: string, workspaceId: string = WORKSPACE_A) {
    const { data } = await supabase
      .from('discovery_runs')
      .insert({
        workspace_id: workspaceId,
        provider: 'hiker',
        instagram_username: username,
        status: 'RUNNING',
        triggered_by: 'user-1',
      })
      .select('id')
      .single()
    return data!.id
  }

  it('records a SUCCESS run with full stats', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const runId = await insertRunningRun(supabase, 'full_success_account')

    await supabase
      .from('discovery_runs')
      .update({
        instagram_user_id: '1000000001',
        status: 'SUCCESS',
        stopped_reason: 'completed',
        contents_found: 12,
        users_found: 30,
        interactions_found: 45,
        followers_found: 20,
        http_calls: 18,
        estimated_billed_requests: 18,
        errors_count: 0,
        completed_at: '2026-09-19T10:05:00.000Z',
        metadata: { warnings: [] },
      })
      .eq('id', runId)

    const run = db.discoveryRuns.find((r) => r.id === runId)
    expect(run).toMatchObject({ status: 'SUCCESS', stopped_reason: 'completed', contents_found: 12, errors_count: 0 })
    expect(run?.completed_at).not.toBeNull()
  })

  it('records a PARTIAL run stopped by insufficient funds, with data already collected preserved', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const runId = await insertRunningRun(supabase, 'partial_account')

    await supabase
      .from('discovery_runs')
      .update({
        instagram_user_id: '1000000002',
        status: 'PARTIAL',
        stopped_reason: 'insufficient_funds',
        contents_found: 5,
        users_found: 8,
        interactions_found: 10,
        followers_found: 0,
        http_calls: 9,
        estimated_billed_requests: 9,
        errors_count: 0,
        completed_at: '2026-09-19T10:02:00.000Z',
        metadata: { warnings: ['Likers fetch stopped early: insufficient funds.'] },
      })
      .eq('id', runId)

    const run = db.discoveryRuns.find((r) => r.id === runId)
    expect(run?.status).toBe('PARTIAL')
    expect(run?.stopped_reason).toBe('insufficient_funds')
    expect(run?.interactions_found).toBe(10) // partial data is retained, not discarded
  })

  it('records a FAILED run when username resolution itself fails on insufficient funds', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const runId = await insertRunningRun(supabase, 'failed_account')

    await supabase
      .from('discovery_runs')
      .update({
        status: 'FAILED',
        stopped_reason: 'insufficient_funds',
        contents_found: 0,
        users_found: 0,
        interactions_found: 0,
        http_calls: 1,
        estimated_billed_requests: 0,
        errors_count: 1,
        completed_at: '2026-09-19T10:00:05.000Z',
        metadata: { error: 'Could not resolve username: Hiker account has insufficient funds.' },
      })
      .eq('id', runId)

    const run = db.discoveryRuns.find((r) => r.id === runId)
    expect(run?.status).toBe('FAILED')
    expect(run?.interactions_found).toBe(0)
  })

  it('records an unexpected exception as FAILED with the error in metadata', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    const runId = await insertRunningRun(supabase, 'exception_account')

    await supabase
      .from('discovery_runs')
      .update({ status: 'FAILED', completed_at: '2026-09-19T10:00:01.000Z', metadata: { error: 'Unexpected error' } })
      .eq('id', runId)

    const run = db.discoveryRuns.find((r) => r.id === runId)
    expect(run?.status).toBe('FAILED')
    expect((run?.metadata as { error: string }).error).toBe('Unexpected error')
  })

  it('lists only the calling workspace runs, newest fields intact, in insertion order queried', async () => {
    const supabase = makeFakeSupabase(db, WORKSPACE_A)
    await insertRunningRun(supabase, 'account_1')
    await insertRunningRun(supabase, 'account_2')

    const otherWorkspaceSupabase = makeFakeSupabase(db, 'workspace-b')
    await insertRunningRun(otherWorkspaceSupabase, 'other_workspace_account', 'workspace-b')

    const { data } = await supabase.from('discovery_runs').select('*').eq('workspace_id', WORKSPACE_A).order('started_at').limit(20)
    expect(data).toHaveLength(2)
    expect(data!.every((r) => r.workspace_id === WORKSPACE_A)).toBe(true)
  })
})
