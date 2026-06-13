'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Calendar, Loader2, MessageCircle } from 'lucide-react'
import { Lead, Call, FollowUp } from '@/types'
import StatusBadge from '@/components/leads/StatusBadge'
import SourceBadge from '@/components/leads/SourceBadge'
import LeadDetail from '@/components/leads/LeadDetail'
import LeadMessagesTab from '@/components/leads/LeadMessagesTab'
import CallScheduleModal from '@/components/leads/CallScheduleModal'
import LogCallModal from '@/components/leads/LogCallModal'
import LeadAddBookingButton from '@/components/leads/LeadAddBookingButton'

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
  const [showLogCall, setShowLogCall] = useState(false)
  const [activeTab, setActiveTab] = useState<'detail' | 'messages'>('detail')

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
          color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
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
        color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
        marginBottom: 20,
      }}>
        <ArrowLeft size={14} /> Leads
      </button>

      {/* Barre d'actions flottante (les boutons restent au-dessus pour rester accessibles) */}
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 8,
        marginBottom: 20, flexWrap: 'wrap',
      }}>
        <button onClick={() => setShowLogCall(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.25)',
          color: '#3b82f6', cursor: 'pointer',
        }}>
          <Phone size={13} />
          Logger un appel
        </button>
        <button onClick={() => setShowCallModal(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: 'rgba(168,85,247,0.10)', border: '1px solid rgba(168,85,247,0.25)',
          color: '#a855f7', cursor: 'pointer',
        }}>
          <Phone size={13} /> Planifier un appel
        </button>
        <LeadAddBookingButton lead={lead} variant="large" onCreated={fetchLead} />
      </div>

      {/* Tabs */}
      {lead.instagram_handle && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border-primary)' }}>
          <button
            onClick={() => setActiveTab('detail')}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: activeTab === 'detail' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'detail' ? '2px solid #E53E3E' : '2px solid transparent',
            }}
          >
            Fiche
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: 'transparent',
              color: activeTab === 'messages' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'messages' ? '2px solid #E53E3E' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <MessageCircle size={14} /> Messagerie
          </button>
        </div>
      )}

      {/* Contenu principal */}
      {activeTab === 'messages' && lead.instagram_handle ? (
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <LeadMessagesTab leadId={lead.id} instagramHandle={lead.instagram_handle} />
        </div>
      ) : (
        // Une seule colonne pleine largeur — toute l'info est dans LeadDetail.
        // Le right sidebar "Résumé" était redondant avec le bloc 1.
        <LeadDetail lead={lead} onUpdate={handleUpdate} />
      )}

      {/* Modale planifier appel */}
      {showCallModal && (
        <CallScheduleModal
          lead={lead}
          onClose={() => setShowCallModal(false)}
          onScheduled={fetchLead}
        />
      )}

      {/* Logger un appel */}
      {showLogCall && (
        <LogCallModal
          lead={{ id: lead.id, first_name: lead.first_name, last_name: lead.last_name }}
          onClose={() => setShowLogCall(false)}
          onLogged={({ reached, isUpdate }) => {
            if (isUpdate) {
              fetchLead()
              return
            }
            handleUpdate({
              call_attempts: lead.call_attempts + 1,
              ...(reached ? { reached: true } : {}),
            })
            fetchLead()
          }}
        />
      )}
    </div>
  )
}
