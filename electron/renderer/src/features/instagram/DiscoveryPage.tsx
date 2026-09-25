// "Ciblage" (renamed from "Instagram Discovery" per product feedback) —
// triggers a real Hiker scan via the EXISTING POST /api/instagram/discovery
// (src/app/api/instagram/discovery/route.ts), no new Hiker pipeline. A scan
// only OBSERVES who reacted to the analyzed account's content — it no
// longer creates a lead for everyone automatically (see persist-profiles.ts
// server-side). Clicking a run opens its list of observed profiles
// (CiblageRunPage.tsx), where a specific profile can be converted into a
// lead via "Cibler". Every run stays in history ("gardées en backup").
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { Input } from '../../design-system/Input'
import { Button } from '../../design-system/Button'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import type { DiscoveryRun, DiscoveryResponse } from './types'
import './instagram.css'
import { TableCard } from '../../design-system/TableCard'
import { StatCard } from '../../design-system/StatCard'
import { useInstagramAccount } from '../../lib/instagram-account'

function statusLabel(status: DiscoveryRun['status']): string {
  return { RUNNING: 'En cours', SUCCESS: 'Terminé', PARTIAL: 'Partiel', FAILED: 'Échoué' }[status]
}

function statusTone(status: DiscoveryRun['status']): string {
  return { RUNNING: 'info', SUCCESS: 'success', PARTIAL: 'warning', FAILED: 'danger' }[status]
}

export function DiscoveryPage() {
  const navigate = useNavigate()
  const { account } = useInstagramAccount()
  const [username, setUsername] = useState(account?.username ?? '')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DiscoveryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runs, setRuns] = useState<DiscoveryRun[] | null>(null)
  const [runsError, setRunsError] = useState<string | null>(null)

  async function loadRuns() {
    try {
      const res = await api.get<{ runs: DiscoveryRun[] }>('/api/instagram/discovery')
      setRuns(res.runs)
    } catch (err) {
      setRunsError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    loadRuns()
  }, [])

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.post<DiscoveryResponse>('/api/instagram/discovery', { instagramUsername: username.trim() })
      setResult(res)
      await loadRuns()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <h1>Analyse (ciblage)</h1>
          <p>Analysez votre compte (ou n'importe quel compte public) : qui a aimé ou commenté ses contenus, qui vous suit, qui est déjà lead — puis ciblez. Chaque analyse reste disponible dans l'historique.</p>
        </div>
      </div>

      <form className="ig-discovery-form" onSubmit={handleAnalyze}>
        <Input
          placeholder="Nom d'utilisateur Instagram (sans @)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={running}
        />
        <Button type="submit" variant="primary" disabled={running || !username.trim()}>
          {running ? 'Analyse en cours…' : 'Analyser maintenant'}
        </Button>
      </form>

      {error && <ErrorState message={error} />}

      {result && (
        <div className="ig-discovery-result">
          <div className={`ig-discovery-status ig-discovery-status--${statusTone(result.status)}`}>
            {statusLabel(result.status)}
            {result.stoppedReason && result.stoppedReason !== 'completed' && ` — ${result.stoppedReason}`}
          </div>
          <div className="ds-stat-grid">
            <Stat label="Profils observés" value={result.stats.uniqueUsers} />
            <Stat label="Déjà des leads" value={result.persisted.alreadyLeadsCount} />
            <Stat label="Interactions" value={result.stats.totalInteractions} />
            <Stat label="Followers" value={result.stats.followersFetched} />
            <Stat label="Contenus analysés" value={result.stats.contentsAnalyzedForInteractions} />
          </div>
          {result.warnings.length > 0 && (
            <div className="ig-discovery-warnings">
              {result.warnings.map((w, i) => (
                <p key={i}>⚠ {w}</p>
              ))}
            </div>
          )}
          <Button variant="secondary" onClick={() => navigate(`/instagram/discovery/${result.runId}`)} style={{ marginTop: 12 }}>
            Voir les profils à cibler →
          </Button>
        </div>
      )}

      <div className="ig-page-section">
        <h2>Historique des analyses</h2>
        {runs === null && !runsError && <LoadingState label="Chargement de l'historique…" />}
        {runsError && <ErrorState message={runsError} onRetry={loadRuns} />}
        {runs && runs.length === 0 && <EmptyState title="Aucune analyse" description="Lancez votre première analyse ci-dessus." />}
        {runs && runs.length > 0 && (
          <TableCard>
            <table className="ds-table">
            <thead>
              <tr>
                <th>Compte</th>
                <th>Statut</th>
                <th>Profils</th>
                <th>Interactions</th>
                <th>Lancée le</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="ds-row-clickable" onClick={() => navigate(`/instagram/discovery/${run.id}`)}>
                  <td>@{run.instagram_username}</td>
                  <td>
                    <span className={`ig-discovery-status ig-discovery-status--${statusTone(run.status)}`}>{statusLabel(run.status)}</span>
                  </td>
                  <td className="ds-num-cell ds-num">{run.users_found}</td>
                  <td className="ds-num-cell ds-num">{run.interactions_found}</td>
                  <td>{new Date(run.started_at).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </TableCard>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <StatCard label={label} value={value} />
}
