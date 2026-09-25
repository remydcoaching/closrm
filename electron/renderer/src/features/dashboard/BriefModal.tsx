// Pre-call AI brief — same call as the web's PreCallBriefModal:
// POST /api/dashboard/brief { lead_id, booking_id } → { brief, cached }.
import { useEffect, useState } from 'react'
import { ApiError } from '../../lib/api-client'
import { Button } from '../../design-system/Button'
import { LoadingState } from '../../design-system/States'
import { generateBrief, type CallBrief } from './dashboard-api'
import '../leads/lead-create-modal.css'
import './dashboard.css'

export function BriefModal({ leadId, bookingId, leadName, onClose }: { leadId: string; bookingId: string | null; leadName: string; onClose: () => void }) {
  const [brief, setBrief] = useState<CallBrief | null>(null)
  const [cached, setCached] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    generateBrief(leadId, bookingId)
      .then((res) => {
        if (cancelled) return
        setBrief(res.brief)
        setCached(res.cached)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Génération impossible')
      })
    return () => {
      cancelled = true
    }
  }, [leadId, bookingId])

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal dash-brief-modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          ✨ Brief pré-call · {leadName}
          {cached && <span className="ds-muted dash-brief-cached"> (cache)</span>}
        </h2>
        {error ? (
          <p className="lead-create-error">{error}</p>
        ) : !brief ? (
          <LoadingState label="Génération en cours…" />
        ) : (
          <div className="dash-brief">
            <BriefSection title="Résumé" items={brief.summary} />
            <BriefSection title="Questions d'ouverture" items={brief.questions} />
            <BriefSection title="Risques / objections" items={brief.risks} />
          </div>
        )}
        <div className="lead-create-actions">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  )
}

function BriefSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="dash-eyebrow">{title}</div>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}
