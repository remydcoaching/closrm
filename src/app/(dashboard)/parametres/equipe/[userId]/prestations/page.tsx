'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save, Pencil, Check, X, Scissors } from 'lucide-react'
import type { MonteurPricingTier } from '@/types'
import { useToast } from '@/components/ui/Toast'

interface MemberInfo {
  user_id: string
  email: string | null
  full_name: string | null
}

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'
}

export default function MonteurPrestationsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const toast = useToast()
  const [member, setMember] = useState<MemberInfo | null>(null)
  const [tiers, setTiers] = useState<MonteurPricingTier[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice, setEditPrice] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [memberRes, tiersRes] = await Promise.all([
        fetch('/api/workspaces/members?role=monteur'),
        fetch(`/api/monteur-pricing-tiers?monteur_id=${userId}`),
      ])
      const memberJson = await memberRes.json()
      const tiersJson = await tiersRes.json()
      type MemberRow = { user_id: string; user?: { email?: string | null; full_name?: string | null } | null }
      const found = ((memberJson.data ?? []) as MemberRow[]).find(m => m.user_id === userId)
      setMember(found ? {
        user_id: found.user_id,
        email: found.user?.email ?? null,
        full_name: found.user?.full_name ?? null,
      } : null)
      setTiers(tiersJson.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function createTier() {
    const priceCents = Math.round(parseFloat(newPrice.replace(',', '.')) * 100)
    if (!newName.trim() || !Number.isFinite(priceCents) || priceCents < 0) {
      toast.error('Champs invalides', 'Nom et prix requis (ex: 50 ou 50.50).')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/monteur-pricing-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monteur_id: userId, name: newName.trim(), price_cents: priceCents }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Erreur')
      setTiers(prev => [...prev, json.data])
      setNewName('')
      setNewPrice('')
      toast.success('Prestation créée')
    } catch (e) {
      toast.error('Erreur', (e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function saveTier(id: string) {
    const priceCents = Math.round(parseFloat(editPrice.replace(',', '.')) * 100)
    if (!editName.trim() || !Number.isFinite(priceCents) || priceCents < 0) {
      toast.error('Champs invalides')
      return
    }
    try {
      const res = await fetch(`/api/monteur-pricing-tiers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), price_cents: priceCents }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Erreur')
      setTiers(prev => prev.map(t => t.id === id ? json.data : t))
      setEditingId(null)
      toast.success('Prestation mise à jour')
    } catch (e) {
      toast.error('Erreur', (e as Error).message)
    }
  }

  async function deleteTier(id: string) {
    if (!confirm('Supprimer cette prestation ? (les slots qui l\'utilisent garderont la trace mais elle sera archivée)')) return
    try {
      const res = await fetch(`/api/monteur-pricing-tiers/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Erreur')
      setTiers(prev => prev.filter(t => t.id !== id))
      toast.success('Supprimée')
    } catch (e) {
      toast.error('Erreur', (e as Error).message)
    }
  }

  function startEdit(t: MonteurPricingTier) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditPrice((t.price_cents / 100).toString())
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800, margin: '0 auto' }}>
      <Link
        href="/parametres/equipe"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> Équipe
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(139,92,246,0.15)', color: '#8b5cf6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Scissors size={18} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Prestations
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
            {member?.full_name ?? member?.email ?? 'Monteur'}
          </p>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        padding: 18, marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
          Nouvelle prestation
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Reel premium, Vlog, YouTube vidéo…"
            style={{
              flex: 1,
              background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
              borderRadius: 8, padding: '8px 12px', fontSize: 13,
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <input
            type="text"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            placeholder="50"
            style={{
              width: 100,
              background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
              borderRadius: 8, padding: '8px 12px', fontSize: 13,
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>€</span>
          <button
            onClick={createTier}
            disabled={creating || !newName.trim() || !newPrice}
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 700,
              color: '#fff', background: '#8b5cf6',
              border: 'none', borderRadius: 8,
              cursor: creating ? 'wait' : 'pointer',
              opacity: !newName.trim() || !newPrice ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <Plus size={13} /> Ajouter
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
            Chargement…
          </div>
        ) : tiers.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)' }}>
            Aucune prestation pour ce monteur. Crée-en une ci-dessus.
          </div>
        ) : (
          tiers.map((t, idx) => {
            const isEditing = editingId === t.id
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px',
                borderTop: idx === 0 ? 'none' : '1px solid var(--border-primary)',
                background: isEditing ? 'var(--bg-elevated)' : 'transparent',
              }}>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                        borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                      }}
                    />
                    <input
                      type="text"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      style={{
                        width: 80,
                        background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
                        borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>€</span>
                    <button onClick={() => saveTier(t.id)} style={{
                      padding: 6, background: '#10b981', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', color: '#fff',
                    }}><Save size={12} /></button>
                    <button onClick={() => setEditingId(null)} style={{
                      padding: 6, background: 'transparent', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer', display: 'flex', color: 'var(--text-tertiary)',
                    }}><X size={12} /></button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#8b5cf6' }}>
                      {formatEuros(t.price_cents)}
                    </div>
                    <button onClick={() => startEdit(t)} style={{
                      padding: 6, background: 'transparent', border: '1px solid var(--border-primary)', borderRadius: 6, cursor: 'pointer', display: 'flex', color: 'var(--text-tertiary)',
                    }}><Pencil size={12} /></button>
                    <button onClick={() => deleteTier(t.id)} style={{
                      padding: 6, background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer', display: 'flex', color: '#ef4444',
                    }}><Trash2 size={12} /></button>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
