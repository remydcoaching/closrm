// Ciblage results — lists profiles OBSERVED during one scan (GET
// /api/instagram/discovery/:runId/profiles) with like/comment counts,
// follow status, and whether each is already a lead. "Cibler" (POST
// .../target) converts a specific profile into a real lead on demand —
// this is the only place a Ciblage scan turns into a lead.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { Avatar } from '../../design-system/Avatar'
import { Button } from '../../design-system/Button'
import { LoadingState, ErrorState, EmptyState } from '../../design-system/States'
import type { DiscoveryProfile } from './types'
import './instagram.css'
import { TableCard } from '../../design-system/TableCard'

export function CiblageRunPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<DiscoveryProfile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [targeting, setTargeting] = useState<string | null>(null)

  async function load() {
    if (!runId) return
    setError(null)
    try {
      const res = await api.get<{ data: DiscoveryProfile[] }>(`/api/instagram/discovery/${runId}/profiles?per_page=100`)
      setProfiles(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  async function handleTarget(profile: DiscoveryProfile) {
    if (!runId || profile.matched_lead_id) {
      if (profile.matched_lead_id) navigate(`/leads/${profile.matched_lead_id}`)
      return
    }
    setTargeting(profile.id)
    try {
      const res = await api.post<{ data: { leadId: string } }>(`/api/instagram/discovery/${runId}/profiles/${profile.id}/target`, {})
      setProfiles((prev) => (prev ? prev.map((p) => (p.id === profile.id ? { ...p, matched_lead_id: res.data.leadId } : p)) : prev))
    } finally {
      setTargeting(null)
    }
  }

  return (
    <div className="ig-page">
      <div className="ig-page-header">
        <div>
          <button className="lead-detail-back" onClick={() => navigate('/instagram/discovery')}>
            ← Retour au ciblage
          </button>
          <h1>Profils à cibler</h1>
          <p>Ils ont aimé ou commenté ses contenus, en public.</p>
        </div>
      </div>

      {profiles === null && !error && <LoadingState label="Chargement des profils…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {profiles && profiles.length === 0 && <EmptyState title="Aucun profil observé" description="Ce scan n'a trouvé aucune interaction publique." />}

      {profiles && profiles.length > 0 && (
        <TableCard>
          <table className="ds-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>A fait</th>
              <th>Vous suit</th>
              <th>Déjà un de vos leads</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td>
                  <div className="ig-cell-profile">
                    <Avatar name={profile.full_name || profile.instagram_username} size={26} />
                    <div>
                      <div className="ig-cell-name">
                        {profile.full_name || profile.instagram_username}
                        {profile.is_verified && <span className="lead-detail-verified" title="Compte vérifié">✓</span>}
                      </div>
                      <div className="ds-muted">@{profile.instagram_username}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="ig-did-badges">
                    {profile.likes_count > 0 && (
                      <span className="ig-did-badge" title={`${profile.likes_count} like${profile.likes_count > 1 ? 's' : ''}`}>
                        ♥ {profile.likes_count}
                      </span>
                    )}
                    {profile.comments_count > 0 && (
                      <span className="ig-did-badge" title={`${profile.comments_count} commentaire${profile.comments_count > 1 ? 's' : ''}`}>
                        💬 {profile.comments_count}
                      </span>
                    )}
                    {profile.likes_count === 0 && profile.comments_count === 0 && <span className="ds-muted">—</span>}
                  </div>
                </td>
                <td>
                  <span className={`ig-yesno ${profile.follows_target ? 'ig-yesno--yes' : ''}`}>{profile.follows_target ? 'Oui' : 'Non'}</span>
                </td>
                <td>
                  <span className={`ig-yesno ${profile.matched_lead_id ? 'ig-yesno--yes' : ''}`}>{profile.matched_lead_id ? 'Oui' : 'Non'}</span>
                </td>
                <td>
                  <Button
                    variant={profile.matched_lead_id ? 'secondary' : 'primary'}
                    disabled={targeting === profile.id}
                    onClick={() => handleTarget(profile)}
                  >
                    {targeting === profile.id ? 'Ciblage…' : profile.matched_lead_id ? 'Voir le lead' : 'Cibler'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </TableCard>
      )}
    </div>
  )
}
