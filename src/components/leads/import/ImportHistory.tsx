'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react'
import type { LeadImportBatch } from '@/types'

const STATUS_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'En attente', color: '#D69E2E', bg: '#D69E2E20' },
  processing: { label: 'En cours', color: '#3B82F6', bg: '#3B82F620' },
  completed:  { label: 'Terminé', color: '#38A169', bg: '#38A16920' },
  failed:     { label: 'Échoué', color: '#E53E3E', bg: '#E53E3E20' },
  cancelled:  { label: 'Annulé', color: '#666', bg: '#66666620' },
}

export default function ImportHistory() {
  const router = useRouter()
  const [batches, setBatches] = useState<LeadImportBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      const res = await fetch('/api/leads/import/history')
      const json = await res.json()
      if (res.ok) setBatches(json.data || [])
      setLoading(false)
    }
    fetchHistory()
  }, [])

  const handleCancel = async (batchId: string) => {
    if (!confirm('Annuler cet import ? Les leads sans appels ni follow-ups seront supprimés.')) return
    setCancelling(batchId)
    const res = await fetch(`/api/leads/import/${batchId}`, { method: 'DELETE' })
    const json = await res.json()
    if (res.ok) {
      alert(json.data.message)
      setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, status: 'cancelled' } : b))
    } else {
      alert(`Erreur : ${json.error}`)
    }
    setCancelling(null)
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/leads')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 6,
            background: 'transparent', border: '1px solid #333', color: '#A0A0A0', cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
          Historique des imports
        </h1>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Loader2 size={24} color="#666" style={{ animation: 'spin 1s linear infinite' }} />
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {!loading && batches.length === 0 && (
        <p style={{ fontSize: 14, color: '#666', textAlign: 'center', padding: 40 }}>
          Aucun import effectué.
        </p>
      )}

      {!loading && batches.length > 0 && (
        <div style={{ borderRadius: 8, border: '1px solid #262626', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Date</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#A0A0A0', background: '#1a1a1a' }}>Fichier</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#A0A0A0', background: '#1a1a1a' }}>Total</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#38A169', background: '#1a1a1a' }}>Créés</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#3B82F6', background: '#1a1a1a' }}>MAJ</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#666', background: '#1a1a1a' }}>Ignorés</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#E53E3E', background: '#1a1a1a' }}>Erreurs</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#A0A0A0', background: '#1a1a1a' }}>Statut</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#A0A0A0', background: '#1a1a1a' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const badge = STATUS_BADGES[b.status] || STATUS_BADGES.pending
                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '10px 14px', color: '#fff' }}>
                      {new Date(b.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#A0A0A0' }}>{b.file_name}</td>
                    <td style={{ padding: '10px 14px', color: '#fff', textAlign: 'center' }}>{b.total_rows}</td>
                    <td style={{ padding: '10px 14px', color: '#38A169', textAlign: 'center' }}>{b.created_count}</td>
                    <td style={{ padding: '10px 14px', color: '#3B82F6', textAlign: 'center' }}>{b.updated_count}</td>
                    <td style={{ padding: '10px 14px', color: '#666', textAlign: 'center' }}>{b.skipped_count}</td>
                    <td style={{ padding: '10px 14px', color: '#E53E3E', textAlign: 'center' }}>{b.error_count}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                        fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {(b.status === 'completed' || b.status === 'failed') && (
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={cancelling === b.id}
                          title="Annuler cet import"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: 6,
                            background: 'transparent', border: '1px solid #333', color: '#E53E3E',
                            cursor: cancelling === b.id ? 'not-allowed' : 'pointer',
                            opacity: cancelling === b.id ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
