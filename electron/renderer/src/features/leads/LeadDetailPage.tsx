// Full-page lead detail — replaces the split-view side panel per explicit
// feedback: clicking a lead must open its own dedicated page (route
// /leads/:id), not a docked panel. Same web contract as before (PATCH
// /api/leads/:id, POST /api/calls/log-attempt, DELETE /api/leads/:id) —
// only the layout changed. Reproduces the web's single Leads page with an
// internal Lead / Relance / Closing selector (leads-client.tsx keeps these
// three views in one page rather than three separate routes) instead of
// the earlier separate Pipeline/Relances/Deals pages.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../lib/api-client'
import { Avatar } from '../../design-system/Avatar'
import { Button } from '../../design-system/Button'
import { Input, Textarea } from '../../design-system/Input'
import { StatusSelect } from '../../design-system/StatusSelect'
import { StatusPill } from '../../design-system/StatusPill'
import { Tabs } from '../../design-system/Tabs'
import { TagList } from '../../design-system/TagList'
import { ActivityTimeline } from '../../design-system/ActivityTimeline'
import { LoadingState, ErrorState } from '../../design-system/States'
import { ScoreGauge } from '../../design-system/ScoreGauge'
import { StatusPill as ChipPill } from '../../design-system/StatusPill'
import { Drawer } from '../../design-system/Drawer'
import { STATUS_CONFIG, statusEntry, sourceEntry, displayName, relativeTime, callOutcomeLabel, followUpStatusLabel, followUpChannelLabel, callTypeLabel } from './status'
import { buildActivity } from './build-activity'
import { purchasePotential, PURCHASE_POTENTIAL_LABEL, PURCHASE_POTENTIAL_COLOR } from './purchase-potential'
import type { Lead, LeadWithRelations, LeadJourney, EngagementScore } from './types'
import './lead-detail.css'

interface InstagramSignal {
  follows_target: boolean
  likes_count: number
  comments_count: number
  created_at: string
}

type TabKey = 'infos' | 'activite' | 'relance' | 'closing'

export function LeadDetailPage() {
  const { id: leadId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<LeadWithRelations | null>(null)
  const [journey, setJourney] = useState<LeadJourney | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('infos')
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [notesValue, setNotesValue] = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [logging, setLogging] = useState(false)
  const [score, setScore] = useState<EngagementScore | null>(null)
  const [showScoreDrawer, setShowScoreDrawer] = useState(false)
  const [instagramSignal, setInstagramSignal] = useState<InstagramSignal | null>(null)
  const [newFollowUpReason, setNewFollowUpReason] = useState('')
  const [newFollowUpDate, setNewFollowUpDate] = useState('')
  const [newFollowUpChannel, setNewFollowUpChannel] = useState<'whatsapp' | 'email' | 'instagram_dm' | 'manuel'>('manuel')
  const [creatingFollowUp, setCreatingFollowUp] = useState(false)
  const [dealAmount, setDealAmount] = useState('')
  const [dealCashCollected, setDealCashCollected] = useState('')
  const [dealInstallments, setDealInstallments] = useState('1')
  const [savingDeal, setSavingDeal] = useState(false)

  useEffect(() => {
    if (!leadId) return
    setLead(null)
    setJourney(null)
    setError(null)
    setTab('infos')
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  async function load() {
    if (!leadId) return
    try {
      const res = await api.get<{ data: LeadWithRelations }>(`/api/leads/${leadId}`)
      setLead(res.data)
      setNotesValue(res.data.notes ?? '')
      setNotesDirty(false)
      setDealAmount(res.data.deal_amount != null ? String(res.data.deal_amount) : '')
      setDealCashCollected(String(res.data.cash_collected ?? 0))
      setDealInstallments(String(res.data.deal_installments ?? 1))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erreur inconnue')
      return
    }
    try {
      const res = await api.get<{ data: LeadJourney }>(`/api/leads/${leadId}/journey`)
      setJourney(res.data)
    } catch {
      setJourney(null)
    }
    try {
      const res = await api.get<{ data: EngagementScore }>(`/api/leads/${leadId}/score`)
      setScore(res.data)
    } catch {
      setScore(null)
    }
    try {
      const res = await api.get<{ data: InstagramSignal | null }>(`/api/leads/${leadId}/instagram-signal`)
      setInstagramSignal(res.data)
    } catch {
      setInstagramSignal(null)
    }
  }

  async function patch(payload: Partial<Lead>) {
    if (!lead || !leadId) return
    const res = await api.patch<{ data: Lead }>(`/api/leads/${leadId}`, payload)
    setLead((prev) => (prev ? { ...prev, ...res.data } : prev))
  }

  function startEdit(field: string, value: string) {
    setEditingField(field)
    setEditValue(value)
  }

  async function saveEdit(field: keyof Lead) {
    setEditingField(null)
    await patch({ [field]: editValue } as Partial<Lead>)
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      await patch({ notes: notesValue })
      setNotesDirty(false)
    } finally {
      setSavingNotes(false)
    }
  }

  async function addTag(tag: string) {
    if (!lead) return
    await patch({ tags: [...lead.tags, tag] })
  }

  async function removeTag(tag: string) {
    if (!lead) return
    await patch({ tags: lead.tags.filter((t) => t !== tag) })
  }

  async function logCallAttempt(reached: boolean) {
    if (!leadId) return
    setLogging(true)
    try {
      await api.post('/api/calls/log-attempt', { lead_id: leadId, reached })
      await load()
    } finally {
      setLogging(false)
    }
  }

  async function handleDelete() {
    if (!leadId) return
    if (!confirm('Supprimer définitivement ce lead et toutes ses données (appels, follow-ups, notes) ? Cette action est irréversible.')) return
    await api.delete(`/api/leads/${leadId}`)
    navigate('/leads')
  }

  // Same POST /api/follow-ups the web's AddFollowUpModal uses.
  async function createFollowUp(e: React.FormEvent) {
    e.preventDefault()
    if (!leadId || !newFollowUpReason.trim() || !newFollowUpDate) return
    setCreatingFollowUp(true)
    try {
      await api.post('/api/follow-ups', {
        lead_id: leadId,
        reason: newFollowUpReason.trim(),
        scheduled_at: new Date(newFollowUpDate).toISOString(),
        channel: newFollowUpChannel,
      })
      setNewFollowUpReason('')
      setNewFollowUpDate('')
      await load()
    } finally {
      setCreatingFollowUp(false)
    }
  }

  async function markFollowUpDone(followUpId: string) {
    await api.patch(`/api/follow-ups/${followUpId}`, { status: 'fait' })
    await load()
  }

  // Same POST /api/deals the web's ClosingModal uses — marks the lead
  // 'clos' server-side (see src/app/api/deals/route.ts), not duplicated here.
  async function closeDeal(e: React.FormEvent) {
    e.preventDefault()
    if (!leadId) return
    const amount = Number(dealAmount)
    if (!Number.isFinite(amount) || amount < 0) return
    setSavingDeal(true)
    try {
      await api.post('/api/deals', {
        lead_id: leadId,
        amount,
        cash_collected: Number(dealCashCollected) || 0,
        installments: Number(dealInstallments) || 1,
      })
      await load()
    } finally {
      setSavingDeal(false)
    }
  }

  if (error) {
    return (
      <div className="lead-detail-page">
        <ErrorState message={error} onRetry={load} />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="lead-detail-page">
        <LoadingState label="Chargement du lead…" />
      </div>
    )
  }

  const status = statusEntry(lead.status)
  const source = sourceEntry(lead.source)
  const name = displayName(lead.first_name, lead.last_name, lead.instagram_handle ?? 'Sans nom')
  const activity = buildActivity(lead.calls, lead.follow_ups, journey?.events ?? [])
  const hasAttribution = Boolean(
    lead.meta_campaign_id || lead.meta_adset_id || lead.meta_ad_id || journey?.attribution.first_touch.value,
  )
  const hasInstagramProfile = Boolean(lead.instagram_profile_synced_at)
  const pendingFollowUps = lead.follow_ups.filter((f) => f.status === 'en_attente')
  const potential = purchasePotential(lead, score)
  const lastGesture = activity[0] ?? null

  return (
    <div className="lead-detail-page">
      <div className="lead-detail-page-topbar">
        <button className="lead-detail-back" onClick={() => navigate('/leads')}>
          ← Retour aux leads
        </button>
      </div>

      <div className="lead-detail-header">
        {lead.instagram_profile_pic_url ? (
          <img className="lead-detail-avatar-img" src={lead.instagram_profile_pic_url} alt={name} width={56} height={56} />
        ) : (
          <Avatar name={name} size={56} />
        )}
        <div className="lead-detail-header-info">
          <div className="lead-detail-name">
            {name}
            {lead.instagram_is_verified && (
              <span className="lead-detail-verified" title="Compte Instagram vérifié">
                ✓
              </span>
            )}
          </div>
          {lead.instagram_handle && (
            <a className="lead-detail-instagram" href={`https://instagram.com/${lead.instagram_handle}`} target="_blank" rel="noopener noreferrer">
              @{lead.instagram_handle}
            </a>
          )}
        </div>
        {lead.instagram_handle && (
          <a
            className="lead-detail-contact-ig-btn"
            href={`https://instagram.com/${lead.instagram_handle}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contacter sur Instagram
          </a>
        )}
        {score && (
          <button className="lead-detail-score-trigger" onClick={() => setShowScoreDrawer(true)} title="Voir le détail du score">
            <ScoreGauge score={score.score} />
          </button>
        )}
      </div>

      <div className="lead-detail-signals-row">
        <ChipPill label={`Potentiel : ${PURCHASE_POTENTIAL_LABEL[potential]}`} color={PURCHASE_POTENTIAL_COLOR[potential]} bg={`${PURCHASE_POTENTIAL_COLOR[potential]}18`} />
        {instagramSignal && (
          <ChipPill
            label={instagramSignal.follows_target ? 'Vous suit (vu au dernier scan)' : 'Ne vous suit pas (vu au dernier scan)'}
            color={instagramSignal.follows_target ? '#1a7f4e' : '#8a8e96'}
            bg={instagramSignal.follows_target ? 'rgba(26,127,78,0.12)' : 'rgba(138,142,150,0.12)'}
          />
        )}
        {lastGesture && <span className="lead-detail-last-gesture">Dernier geste : {lastGesture.title} · {relativeTime(lastGesture.at)}</span>}
      </div>

      {(hasInstagramProfile || (score && score.totalInteractions > 0)) && (
        <div className="lead-detail-ig-summary">
          {score && (
            <>
              <SummaryStat label="Interactions" value={String(score.totalInteractions)} />
              <SummaryStat label="Likes" value={String(score.likesCount)} />
              <SummaryStat label="Commentaires" value={String(score.commentsCount)} />
              <SummaryStat label="Dernière interaction" value={score.lastInteractionAt ? relativeTime(score.lastInteractionAt) : '—'} />
            </>
          )}
          {hasInstagramProfile && (
            <>
              <SummaryStat label="Followers" value={lead.instagram_followers_count != null ? String(lead.instagram_followers_count) : '—'} />
              <SummaryStat label="Following" value={lead.instagram_following_count != null ? String(lead.instagram_following_count) : '—'} />
              <SummaryStat label="Compte" value={lead.instagram_is_private ? 'Privé' : 'Public'} />
            </>
          )}
        </div>
      )}
      {hasInstagramProfile && lead.instagram_profile_synced_at && (
        <div className="lead-detail-sync-note">
          Profil Instagram synchronisé le {new Date(lead.instagram_profile_synced_at).toLocaleDateString('fr-FR')} — pas une donnée en temps réel.
        </div>
      )}

      <div className="lead-detail-actions">
        <StatusSelect entries={STATUS_CONFIG} value={lead.status} onChange={(key) => patch({ status: key as Lead['status'] })} />
        <Button variant="secondary" disabled={logging} onClick={() => logCallAttempt(false)}>
          Appel — pas de réponse
        </Button>
        <Button variant="secondary" disabled={logging} onClick={() => logCallAttempt(true)}>
          Appel — joint
        </Button>
      </div>

      {/* Lead / Relance / Closing selector — mirrors leads-client.tsx on the
          web keeping these three views inside one page rather than as
          separate routes. */}
      <Tabs
        items={[
          { key: 'infos', label: 'Lead' },
          { key: 'activite', label: `Activité (${activity.length})` },
          { key: 'relance', label: `Relance${pendingFollowUps.length > 0 ? ` (${pendingFollowUps.length})` : ''}` },
          { key: 'closing', label: 'Closing' },
        ]}
        active={tab}
        onChange={(k) => setTab(k as TabKey)}
      />

      {showScoreDrawer && score && (
        <Drawer title="Pourquoi ce score ?" onClose={() => setShowScoreDrawer(false)}>
          {score.signals.length === 0 ? (
            <p className="lead-detail-empty">Aucun signal particulier détecté pour ce lead.</p>
          ) : (
            <div className="lead-detail-signals">
              {score.signals.map((signal) => (
                <div key={signal.key} className="lead-detail-signal">
                  <div className="lead-detail-signal-label">{signal.label}</div>
                  <div className="lead-detail-signal-detail">{signal.detail}</div>
                </div>
              ))}
            </div>
          )}
        </Drawer>
      )}

      <div className="lead-detail-body lead-detail-body--page">
        {tab === 'activite' && <ActivityTimeline entries={activity} />}

        {tab === 'infos' && (
          <div className="lead-detail-columns">
            <div className="lead-detail-col">
              <Section title="Coordonnées">
                <EditableRow
                  label="Téléphone"
                  value={lead.phone}
                  editing={editingField === 'phone'}
                  editValue={editValue}
                  onEditValueChange={setEditValue}
                  onStartEdit={() => startEdit('phone', lead.phone)}
                  onSave={() => saveEdit('phone')}
                />
                <EditableRow
                  label="Email"
                  value={lead.email ?? ''}
                  editing={editingField === 'email'}
                  editValue={editValue}
                  onEditValueChange={setEditValue}
                  onStartEdit={() => startEdit('email', lead.email ?? '')}
                  onSave={() => saveEdit('email')}
                />
              </Section>

              <Section title="Commercial">
                <div className="lead-detail-field-row">
                  <span className="lead-detail-field-label">Source</span>
                  <StatusPill label={source.label} color={source.color} bg={source.bg} />
                </div>
                <div className="lead-detail-field-row">
                  <span className="lead-detail-field-label">Tags</span>
                </div>
                <TagList tags={lead.tags} onAdd={addTag} onRemove={removeTag} />
              </Section>

              {hasAttribution && (
                <Section title="Attribution">
                  {lead.meta_campaign_id && (
                    <div className="lead-detail-field-row">
                      <span className="lead-detail-field-label">Campagne</span>
                      <span className="lead-detail-field-value">{lead.meta_campaign_id}</span>
                    </div>
                  )}
                  {lead.meta_adset_id && (
                    <div className="lead-detail-field-row">
                      <span className="lead-detail-field-label">Ad set</span>
                      <span className="lead-detail-field-value">{lead.meta_adset_id}</span>
                    </div>
                  )}
                  {lead.meta_ad_id && (
                    <div className="lead-detail-field-row">
                      <span className="lead-detail-field-label">Ad</span>
                      <span className="lead-detail-field-value">{lead.meta_ad_id}</span>
                    </div>
                  )}
                  {journey?.attribution.first_touch.value && (
                    <div className="lead-detail-field-row">
                      <span className="lead-detail-field-label">Premier contact</span>
                      <span className="lead-detail-field-value">
                        {journey.attribution.first_touch.source}: {journey.attribution.first_touch.value}
                      </span>
                    </div>
                  )}
                </Section>
              )}

              <Section title="Métadonnées">
                <div className="lead-detail-field-row">
                  <span className="lead-detail-field-label">Créé le</span>
                  <span>{new Date(lead.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="lead-detail-field-row">
                  <span className="lead-detail-field-label">Modifié le</span>
                  <span>{new Date(lead.updated_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </Section>
            </div>

            <div className="lead-detail-col">
              <Section title={`Appels (${lead.calls.length})`}>
                {lead.calls.length === 0 ? (
                  <p className="lead-detail-empty">Aucun appel</p>
                ) : (
                  lead.calls.map((call) => (
                    <div key={call.id} className="lead-detail-list-row">
                      <span>{callTypeLabel(call.type)}</span>
                      <span className="lead-detail-muted">{callOutcomeLabel(call.outcome)}</span>
                      <span className="lead-detail-muted">#{call.attempt_number}</span>
                    </div>
                  ))
                )}
              </Section>

              <Section title="Notes">
                <Textarea
                  value={notesValue}
                  onChange={(e) => {
                    setNotesValue(e.target.value)
                    setNotesDirty(true)
                  }}
                />
                {notesDirty && (
                  <Button variant="primary" onClick={saveNotes} disabled={savingNotes} style={{ marginTop: 8 }}>
                    {savingNotes ? 'Enregistrement…' : 'Enregistrer les notes'}
                  </Button>
                )}
              </Section>

              <button className="lead-detail-delete" onClick={handleDelete}>
                Supprimer définitivement ce lead
              </button>
            </div>
          </div>
        )}

        {tab === 'relance' && (
          <div className="lead-detail-columns">
            <div className="lead-detail-col">
              <Section title="Nouvelle relance">
                <form onSubmit={createFollowUp} className="lead-detail-followup-form">
                  <Input placeholder="Raison de la relance" value={newFollowUpReason} onChange={(e) => setNewFollowUpReason(e.target.value)} />
                  <Input type="datetime-local" value={newFollowUpDate} onChange={(e) => setNewFollowUpDate(e.target.value)} />
                  <select
                    className="ds-input"
                    value={newFollowUpChannel}
                    onChange={(e) => setNewFollowUpChannel(e.target.value as typeof newFollowUpChannel)}
                  >
                    <option value="manuel">Manuel</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="instagram_dm">Instagram DM</option>
                  </select>
                  <Button type="submit" variant="primary" disabled={creatingFollowUp || !newFollowUpReason.trim() || !newFollowUpDate}>
                    {creatingFollowUp ? 'Création…' : 'Planifier la relance'}
                  </Button>
                </form>
              </Section>
            </div>
            <div className="lead-detail-col">
              <Section title={`Relances (${lead.follow_ups.length})`}>
                {lead.follow_ups.length === 0 ? (
                  <p className="lead-detail-empty">Aucune relance</p>
                ) : (
                  lead.follow_ups.map((fu) => (
                    <div key={fu.id} className="lead-detail-list-row">
                      <span>{fu.reason}</span>
                      <span className="lead-detail-muted">{followUpChannelLabel(fu.channel)}</span>
                      <span className="lead-detail-muted">{followUpStatusLabel(fu.status)}</span>
                      {fu.status === 'en_attente' && (
                        <button className="lead-detail-mini-action" onClick={() => markFollowUpDone(fu.id)}>
                          Marquer fait
                        </button>
                      )}
                    </div>
                  ))
                )}
              </Section>
            </div>
          </div>
        )}

        {tab === 'closing' && (
          <div className="lead-detail-columns">
            <div className="lead-detail-col">
              <Section title="Closer ce lead">
                <form onSubmit={closeDeal} className="lead-detail-followup-form">
                  <label className="lead-detail-form-label">Montant (€)</label>
                  <Input type="number" min="0" value={dealAmount} onChange={(e) => setDealAmount(e.target.value)} />
                  <label className="lead-detail-form-label">Cash collecté (€)</label>
                  <Input type="number" min="0" value={dealCashCollected} onChange={(e) => setDealCashCollected(e.target.value)} />
                  <label className="lead-detail-form-label">Échéances</label>
                  <Input type="number" min="1" value={dealInstallments} onChange={(e) => setDealInstallments(e.target.value)} />
                  <Button type="submit" variant="primary" disabled={savingDeal || !dealAmount}>
                    {savingDeal ? 'Enregistrement…' : 'Marquer comme clos'}
                  </Button>
                </form>
              </Section>
            </div>
            <div className="lead-detail-col">
              <Section title="Deal actuel">
                {lead.status === 'clos' || lead.deal_amount ? (
                  <>
                    <div className="lead-detail-field-row">
                      <span className="lead-detail-field-label">Montant</span>
                      <span className="font-mono">{lead.deal_amount != null ? `${lead.deal_amount} €` : '—'}</span>
                    </div>
                    <div className="lead-detail-field-row">
                      <span className="lead-detail-field-label">Cash collecté</span>
                      <span className="font-mono">{lead.cash_collected} €</span>
                    </div>
                    <div className="lead-detail-field-row">
                      <span className="lead-detail-field-label">Échéances</span>
                      <span className="font-mono">{lead.deal_installments}</span>
                    </div>
                    <div className="lead-detail-field-row">
                      <span className="lead-detail-field-label">Clos le</span>
                      <span>{lead.closed_at ? new Date(lead.closed_at).toLocaleDateString('fr-FR') : '—'}</span>
                    </div>
                  </>
                ) : (
                  <p className="lead-detail-empty">Pas encore de deal pour ce lead.</p>
                )}
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lead-detail-section">
      <div className="lead-detail-section-title">{title}</div>
      {children}
    </div>
  )
}

function EditableRow({
  label,
  value,
  editing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSave,
}: {
  label: string
  value: string
  editing: boolean
  editValue: string
  onEditValueChange: (v: string) => void
  onStartEdit: () => void
  onSave: () => void
}) {
  return (
    <div className="lead-detail-field-row">
      <span className="lead-detail-field-label">{label}</span>
      {editing ? (
        <div className="lead-detail-edit-inline">
          <Input value={editValue} onChange={(e) => onEditValueChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSave()} autoFocus />
          <button onClick={onSave}>✓</button>
        </div>
      ) : (
        <button className="lead-detail-field-value lead-detail-field-editable" onClick={onStartEdit}>
          {value || '—'}
        </button>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="lead-detail-summary-stat">
      <div className="lead-detail-summary-value font-mono">{value}</div>
      <div className="lead-detail-summary-label">{label}</div>
    </div>
  )
}
