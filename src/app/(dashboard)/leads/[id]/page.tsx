'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Calendar, Loader2 } from 'lucide-react'
import { Lead, Call, FollowUp } from '@/types'
import StatusBadge from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import LeadDetail from '@/components/leads/LeadDetail'
import CallScheduleModal from '@/components/leads/CallScheduleModal'
import ConfirmModal from '@/components/shared/ConfirmModal'

interface LeadWithRelations extends Lead {
  calls: Call[]
  follow_ups: FollowUp[]
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [lead, setLead] = useState<LeadWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCallModal, setShowCallModal] = useState(false)
  const [callingLoading, setCallingLoading] = useState(false)
  const [confirmCall, setConfirmCall] = useState(false)

  async function fetchLead() {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}`)
      if (!res.ok) { setError('Lead introuvable.'); return }
      const json = await res.json()
      setLead(json.data)
    } catch {
      setError('Erreur lors du chargement.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLead() }, [id])

  function handleUpdate(updated: Partial<Lead>) {
    setLead(prev => prev ? { ...prev, ...updated } : prev)
  }

  async function doCall() {
    if (!lead) return
    setConfirmCall(false)
    setCallingLoading(true)
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_attempts: lead.call_attempts + 1 }),
      })
      const json = await res.json()
      if (res.ok) handleUpdate({ call_attempts: json.data.call_attempts })
    } finally {
      setCallingLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={24} color="#555" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#ef4444' }}>{error || 'Lead introuvable.'}</p>
        <button onClick={() => router.push('/leads')} style={{
          marginTop: 12, display: 'flex', alignItems: 'center', gap: 6,
          color: '#888', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
        }}>
          <ArrowLeft size={14} /> Retour aux leads
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <button onClick={() => router.push('/leads')} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: '#666', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
        marginBottom: 20,
      }}>
        <ArrowLeft size={14} /> Leads
      </button>

      {/* Header */}
      <div style={{
        background: '#0f0f11', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14, padding: 24, marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
            {lead.first_name} {lead.last_name}
          </h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge status={lead.status} />
            <SourceBadge source={lead.source} />
            {lead.phone && (
              <span style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Phone size={11} /> {lead.phone}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setConfirmCall(true)} disabled={callingLoading} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.25)',
            color: '#3b82f6', cursor: callingLoading ? 'not-allowed' : 'pointer',
          }}>
            {callingLoading
              ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Phone size={13} />
            }
            Appeler
          </button>
          <button onClick={() => setShowCallModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: '#00C853', border: 'none', color: '#000', cursor: 'pointer',
          }}>
            <Calendar size={13} /> Planifier RDV
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Colonne gauche — détail */}
        <LeadDetail lead={lead} onUpdate={handleUpdate} />

        {/* Colonne droite — infos rapides */}
        <div style={{
          background: '#0f0f11', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14, padding: 20, position: 'sticky', top: 24,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>
            Résumé
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Tentatives d&apos;appel</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{lead.call_attempts}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Appels planifiés</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {lead.calls.filter(c => c.outcome === 'pending').length}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Follow-ups en attente</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {lead.follow_ups.filter(f => f.status === 'en_attente').length}
              </p>
            </div>
            <div style={{ paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Source publicitaire</p>
              {lead.meta_campaign_id ? (
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  <p>Campagne : {lead.meta_campaign_id}</p>
                  {lead.meta_adset_id && <p>Ad Set : {lead.meta_adset_id}</p>}
                  {lead.meta_ad_id && <p>Ad : {lead.meta_ad_id}</p>}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#444' }}>Non disponible</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modale planifier appel */}
      {showCallModal && (
        <CallScheduleModal
          lead={lead}
          onClose={() => setShowCallModal(false)}
          onScheduled={fetchLead}
        />
      )}

      {/* Confirmation appel */}
      {confirmCall && (
        <ConfirmModal
          title="Enregistrer un appel"
          message={`Confirmer une tentative d'appel pour ${lead.first_name} ${lead.last_name} ? Le compteur passera à ${lead.call_attempts + 1}.`}
          confirmLabel="Confirmer"
          onConfirm={doCall}
          onCancel={() => setConfirmCall(false)}
        />
      )}
    </div>
  )
}
