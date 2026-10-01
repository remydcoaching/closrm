// Sessions DM — desktop port of the mobile Session DM flow (same backend:
// POST/GET /api/dm-sessions, PATCH /api/dm-sessions/:id/items/:itemId,
// buildPriorityQueue). Desktop replaces the mobile's full-screen swipe-
// through with a page showing one profile at a time plus a progress bar —
// same actions (Relancé / À archiver / Passer / Prospect a répondu), same
// message template resolution, same categories.
import { useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api-client'
import { getCached, revalidate, swrGet } from '../../lib/query-cache'
import { Avatar } from '../../design-system/Avatar'
import { Button } from '../../design-system/Button'
import { Input } from '../../design-system/Input'
import { LoadingState, ErrorState } from '../../design-system/States'
import { CATEGORY_LABEL } from './types'
import type { DmSessionDetail, DmSessionSummary, DmSessionItemOutcome } from './types'
import './dm-sessions.css'

function openInstagram(handle: string | null) {
  if (!handle) return
  window.open(`https://instagram.com/${handle}`, '_blank', 'noopener,noreferrer')
}

export function SessionsDmPage() {
  const [existingSession, setExistingSession] = useState<DmSessionSummary | null | undefined>(undefined)
  const [session, setSession] = useState<DmSessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  // Config form state
  const [targetCount, setTargetCount] = useState('20')
  const [staleThresholdDays, setStaleThresholdDays] = useState('30')
  const [relanceEnRetard, setRelanceEnRetard] = useState(true)
  const [premierContact, setPremierContact] = useState(true)
  const [jamaisRecontacte, setJamaisRecontacte] = useState(true)

  async function checkExisting() {
    try {
      // Last known session at once, then the fresh one.
      const res = await swrGet<{ data: DmSessionSummary | null }>('/api/dm-sessions', (r) => {
        setExistingSession(r.data)
        if (r.data) {
          const cached = getCached<{ data: DmSessionDetail }>(`/api/dm-sessions/${r.data.id}`)
          if (cached) setSession(cached.data.data)
        }
      })
      if (res.data) await loadSession(res.data.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
      setExistingSession(null)
    }
  }

  async function loadSession(sessionId: string) {
    try {
      const res = await revalidate<{ data: DmSessionDetail }>(`/api/dm-sessions/${sessionId}`)
      setSession(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    }
  }

  useEffect(() => {
    checkExisting()
  }, [])

  async function startSession() {
    setStarting(true)
    setError(null)
    try {
      const res = await api.post<{ data: { id: string } }>('/api/dm-sessions', {
        target_count: Number(targetCount),
        stale_threshold_days: Number(staleThresholdDays),
        relance_en_retard: relanceEnRetard,
        premier_contact: premierContact,
        jamais_recontacte: jamaisRecontacte,
      })
      await loadSession(res.data.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
    } finally {
      setStarting(false)
    }
  }

  async function abandonSession() {
    if (!session) return
    if (!confirm('Arrêter la session ? Les profils déjà traités restent enregistrés.')) return
    await api.patch(`/api/dm-sessions/${session.id}`, { status: 'abandoned' })
    setSession(null)
    setExistingSession(null)
  }

  if (existingSession === undefined) return <LoadingState label="Chargement…" />
  if (error && !session) return <ErrorState message={error} onRetry={checkExisting} />

  if (session) {
    const currentItem = session.items.find((i) => i.outcome === null) ?? null
    const doneCount = session.items.filter((i) => i.outcome !== null).length

    if (!currentItem) {
      return (
        <div className="dm-page dm-page--center">
          <h1>Session terminée 🎉</h1>
          <p>{doneCount} profil{doneCount > 1 ? 's' : ''} traité{doneCount > 1 ? 's' : ''}.</p>
          <Button
            variant="primary"
            onClick={() => {
              setSession(null)
              setExistingSession(null)
            }}
          >
            Nouvelle session
          </Button>
        </div>
      )
    }

    return <SessionItemView session={session} item={currentItem} doneCount={doneCount} onUpdated={() => loadSession(session.id)} onAbandon={abandonSession} />
  }

  return (
    <div className="dm-page">
      <div className="ig-page-header">
        <div>
          <h1>Sessions DM</h1>
          <p>Traitez vos leads à relancer un par un, avec le bon message au bon moment.</p>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      <div className="dm-config-card">
        <h2>Nouvelle session</h2>
        <label className="dm-config-label">Nombre de profils</label>
        <Input type="number" min="1" max="200" value={targetCount} onChange={(e) => setTargetCount(e.target.value)} />
        <label className="dm-config-label">Considérer comme "ancien lead" après (jours)</label>
        <Input type="number" min="1" value={staleThresholdDays} onChange={(e) => setStaleThresholdDays(e.target.value)} />
        <div className="dm-config-checkboxes">
          <label className="dm-config-checkbox">
            <input type="checkbox" checked disabled />
            Relances du jour (toujours incluses)
          </label>
          <label className="dm-config-checkbox">
            <input type="checkbox" checked={relanceEnRetard} onChange={(e) => setRelanceEnRetard(e.target.checked)} />
            Relances en retard
          </label>
          <label className="dm-config-checkbox">
            <input type="checkbox" checked={premierContact} onChange={(e) => setPremierContact(e.target.checked)} />
            Premiers contacts / engagement Instagram
          </label>
          <label className="dm-config-checkbox">
            <input type="checkbox" checked={jamaisRecontacte} onChange={(e) => setJamaisRecontacte(e.target.checked)} />
            Jamais recontactés
          </label>
        </div>
        <Button variant="primary" onClick={startSession} disabled={starting}>
          {starting ? 'Démarrage…' : 'Démarrer la session'}
        </Button>
      </div>
    </div>
  )
}

function SessionItemView({
  session,
  item,
  doneCount,
  onUpdated,
  onAbandon,
}: {
  session: DmSessionDetail
  item: DmSessionDetail['items'][number]
  doneCount: number
  onUpdated: () => void
  onAbandon: () => void
}) {
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState<DmSessionItemOutcome | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showDelayPicker, setShowDelayPicker] = useState(false)

  const lead = item.lead
  const template = item.template
  const fullName = `${lead.first_name} ${lead.last_name}`.trim() || 'Lead'
  const total = session.items.length
  const position = session.items.findIndex((i) => i.id === item.id) + 1

  async function copyMessage() {
    if (!template) return
    await navigator.clipboard.writeText(template.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function submit(outcome: DmSessionItemOutcome, delayDays?: number) {
    setSubmitError(null)
    setSubmitting(outcome)
    try {
      await api.patch(`/api/dm-sessions/${session.id}/items/${item.id}`, {
        outcome,
        ...(note ? { note } : {}),
        ...(delayDays ? { delay_days: delayDays } : {}),
      })
      setNote('')
      setShowDelayPicker(false)
      onUpdated()
    } catch {
      setSubmitError("Impossible d'enregistrer l'action. Réessaie.")
    } finally {
      setSubmitting(null)
    }
  }

  const hasTransitions = (template?.transitions.length ?? 0) > 0

  return (
    <div className="dm-page">
      <div className="dm-session-topbar">
        <div className="dm-progress-info">
          <span>Profil {position} / {total}</span>
          <span>{doneCount} traités</span>
        </div>
        <button className="lead-detail-back" onClick={onAbandon}>
          Arrêter
        </button>
      </div>
      <div className="dm-progress-bar">
        <div className="dm-progress-bar-fill" style={{ width: `${total > 0 ? (doneCount / total) * 100 : 0}%` }} />
      </div>

      <div className="dm-session-body">
        <div className="dm-session-header">
          <Avatar name={fullName} size={52} />
          <div>
            <div className="lead-detail-name">{fullName}</div>
            {lead.instagram_handle && <div className="lead-detail-instagram">@{lead.instagram_handle}</div>}
            <span className="dm-category-badge">{CATEGORY_LABEL[item.category]}</span>
          </div>
        </div>

        {template ? (
          <div className="dm-template-card">
            <div className="dm-template-label">{template.label}</div>
            <p className="dm-template-text">{template.text}</p>
            <div className="dm-template-actions">
              <Button variant="secondary" onClick={copyMessage}>
                {copied ? '✓ Copié' : 'Copier'}
              </Button>
              <Button variant="secondary" disabled={!lead.instagram_handle} onClick={() => openInstagram(lead.instagram_handle)}>
                Ouvrir Instagram
              </Button>
            </div>
          </div>
        ) : (
          <div className="dm-template-card">
            <p className="lead-detail-empty">Aucun message à afficher pour ce profil — process introuvable ou désactivé.</p>
          </div>
        )}

        <Input placeholder="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} />

        {submitError && <p className="dm-error">{submitError}</p>}
      </div>

      <div className="dm-session-footer">
        {hasTransitions && (
          <div className="dm-transitions">
            <span className="dm-transitions-label">Si le prospect a réagi :</span>
            <div className="dm-transitions-chips">
              {template!.transitions.map((tr) => (
                <button key={tr.outcome_label} className="dm-transition-chip" disabled={submitting !== null} onClick={() => submit('replied')}>
                  {tr.outcome_label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showDelayPicker ? (
          <div className="dm-delay-picker">
            <span>Relancer dans :</span>
            {(template?.relance_step_options.length
              ? template.relance_step_options.map((o) => ({ label: o.title, days: o.delay_days ?? 3 }))
              : [
                  { label: '1 jour', days: 1 },
                  { label: '3 jours', days: 3 },
                  { label: '7 jours', days: 7 },
                ]
            ).map((opt) => (
              <button key={opt.label} className="dm-delay-option" disabled={submitting !== null} onClick={() => submit('relaunched', opt.days)}>
                {opt.label}
              </button>
            ))}
            <button className="lead-detail-back" onClick={() => setShowDelayPicker(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <div className="dm-session-buttons">
            <Button variant="primary" disabled={submitting !== null} onClick={() => setShowDelayPicker(true)}>
              {submitting === 'relaunched' ? '…' : 'Relancé'}
            </Button>
            <Button variant="secondary" disabled={submitting !== null} onClick={() => submit('archived')}>
              {submitting === 'archived' ? '…' : 'À archiver'}
            </Button>
          </div>
        )}
        <button className="dm-skip" disabled={submitting !== null} onClick={() => submit('skipped')}>
          Passer pour l'instant
        </button>
      </div>
    </div>
  )
}
