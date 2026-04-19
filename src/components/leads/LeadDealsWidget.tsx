'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trophy, Trash2, Check, XCircle, Pencil, X } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Deal, DealStatus } from '@/types'

function formatEuro(v: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

const statusStyle: Record<DealStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Actif', color: '#38A169', bg: 'rgba(56,161,105,0.12)' },
  completed: { label: 'Terminé', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  churned: { label: 'Annulé', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  refunded: { label: 'Remboursé', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
}

const card: React.CSSProperties = {
  padding: '12px 14px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-primary)',
  borderRadius: 6, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24, padding: 0,
}

const inputS: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '6px 8px',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
  borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none',
}

interface Props {
  leadId: string
}

export default function LeadDealsWidget({ leadId }: Props) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ amount: string; cash_collected: string; installments: string; duration_months: string }>({
    amount: '', cash_collected: '', installments: '1', duration_months: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/deals?lead_id=${leadId}`)
    if (res.ok) {
      const json = await res.json()
      setDeals(json.data ?? [])
    }
    setLoading(false)
  }, [leadId])

  useEffect(() => { load() }, [load])

  async function changeStatus(deal: Deal, status: DealStatus) {
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  async function deleteDeal(deal: Deal) {
    if (!confirm(`Supprimer définitivement le deal de ${formatEuro(Number(deal.amount))} ? Cette action est irréversible.`)) return
    await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
    load()
  }

  function startEdit(deal: Deal) {
    setEditingId(deal.id)
    setEditValues({
      amount: String(deal.amount),
      cash_collected: String(deal.cash_collected),
      installments: String(deal.installments),
      duration_months: deal.duration_months != null ? String(deal.duration_months) : '',
    })
  }

  async function saveEdit(deal: Deal) {
    const amount = parseFloat(editValues.amount)
    const cash = parseFloat(editValues.cash_collected)
    const inst = parseInt(editValues.installments, 10)
    const duration = editValues.duration_months ? parseInt(editValues.duration_months, 10) : null
    if (!Number.isFinite(amount) || amount < 0) return
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        cash_collected: Number.isFinite(cash) ? cash : 0,
        installments: inst || 1,
        duration_months: duration,
      }),
    })
    setEditingId(null)
    load()
  }

  if (loading) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chargement...</p>
  }

  if (deals.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun paiement</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {deals.map(deal => {
        const amount = Number(deal.amount)
        const cash = Number(deal.cash_collected)
        const remaining = Math.max(0, amount - cash)
        const mrr = deal.duration_months ? amount / deal.duration_months : 0
        const cfg = statusStyle[deal.status] ?? statusStyle.active
        const editing = editingId === deal.id

        return (
          <div key={deal.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(56,161,105,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trophy size={14} color="#38A169" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatEuro(amount)}
                    {deal.duration_months && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>· {deal.duration_months} mois</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {format(new Date(deal.started_at), "dd MMM yyyy", { locale: fr })}
                    {deal.ends_at && ` → ${format(new Date(deal.ends_at), "dd MMM yyyy", { locale: fr })}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {cfg.label}
                </span>
                {!editing && (
                  <>
                    <button onClick={() => startEdit(deal)} title="Modifier" style={iconBtn}>
                      <Pencil size={11} color="var(--text-muted)" />
                    </button>
                    {deal.status === 'active' && (
                      <button onClick={() => changeStatus(deal, 'churned')} title="Annuler" style={iconBtn}>
                        <XCircle size={11} color="#f59e0b" />
                      </button>
                    )}
                    <button onClick={() => deleteDeal(deal)} title="Supprimer" style={iconBtn}>
                      <Trash2 size={11} color="#ef4444" />
                    </button>
                  </>
                )}
                {editing && (
                  <>
                    <button onClick={() => saveEdit(deal)} title="Enregistrer" style={iconBtn}>
                      <Check size={11} color="var(--color-primary)" />
                    </button>
                    <button onClick={() => setEditingId(null)} title="Annuler" style={iconBtn}>
                      <X size={11} color="var(--text-muted)" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {editing ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Montant
                  <input type="number" value={editValues.amount} onChange={e => setEditValues(v => ({ ...v, amount: e.target.value }))} style={{ ...inputS, marginTop: 3 }} />
                </label>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Encaissé
                  <input type="number" value={editValues.cash_collected} onChange={e => setEditValues(v => ({ ...v, cash_collected: e.target.value }))} style={{ ...inputS, marginTop: 3 }} />
                </label>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Paiement (x fois)
                  <input type="number" value={editValues.installments} onChange={e => setEditValues(v => ({ ...v, installments: e.target.value }))} style={{ ...inputS, marginTop: 3 }} />
                </label>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Durée (mois, vide = one-shot)
                  <input type="number" value={editValues.duration_months} onChange={e => setEditValues(v => ({ ...v, duration_months: e.target.value }))} style={{ ...inputS, marginTop: 3 }} />
                </label>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 11 }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Encaissé</div>
                  <div style={{ color: '#38A169', fontWeight: 600, marginTop: 2 }}>{formatEuro(cash)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reste</div>
                  <div style={{ color: remaining > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{formatEuro(remaining)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Paiement</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{deal.installments}x</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MRR</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>{mrr > 0 ? formatEuro(mrr) : '—'}</div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
