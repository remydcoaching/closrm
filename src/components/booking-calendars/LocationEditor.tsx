'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, MapPin, Video, Info } from 'lucide-react'
import { BookingLocation } from '@/types'

interface LocationEditorProps {
  selectedLocationIds: string[]
  onChange: (ids: string[]) => void
  googleCalendarConnected: boolean
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: 'var(--text-primary)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

export default function LocationEditor({
  selectedLocationIds,
  onChange,
  googleCalendarConnected,
}: LocationEditorProps) {
  const [locations, setLocations] = useState<BookingLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newLocationType, setNewLocationType] = useState<'in_person' | 'online'>('in_person')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchLocations()
  }, [])

  async function fetchLocations() {
    try {
      const res = await fetch('/api/booking-locations')
      if (res.ok) {
        const json = await res.json()
        setLocations(json.data ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/booking-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          address: newAddress.trim() || null,
          location_type: newLocationType,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        const created = json.data as BookingLocation
        setLocations((prev) => [...prev, created])
        onChange([...selectedLocationIds, created.id])
        setNewName('')
        setNewAddress('')
        setNewLocationType('in_person')
        setShowCreate(false)
      }
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/booking-locations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setLocations((prev) => prev.filter((l) => l.id !== id))
      onChange(selectedLocationIds.filter((lid) => lid !== id))
    }
  }

  function toggleLocation(id: string) {
    if (selectedLocationIds.includes(id)) {
      onChange(selectedLocationIds.filter((lid) => lid !== id))
    } else {
      onChange([...selectedLocationIds, id])
    }
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Chargement des lieux...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {locations.map((loc) => {
        const isSelected = selectedLocationIds.includes(loc.id)
        const isOnline = loc.location_type === 'online'
        return (
          <div
            key={loc.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${isSelected ? 'var(--color-primary, #E53E3E)' : 'var(--border-primary)'}`,
              background: isSelected ? 'rgba(229,62,62,0.06)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onClick={() => toggleLocation(loc.id)}
          >
            <div style={{ color: isOnline ? '#3b82f6' : 'var(--text-secondary)', flexShrink: 0 }}>
              {isOnline ? <Video size={16} /> : <MapPin size={16} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {loc.name}
                <span style={{
                  fontSize: 11, fontWeight: 400, marginLeft: 6,
                  color: isOnline ? '#3b82f6' : 'var(--text-muted)',
                }}>
                  {isOnline ? 'En ligne' : 'Presentiel'}
                </span>
              </div>
              {loc.address && !isOnline && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{loc.address}</div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(loc.id)
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, flexShrink: 0,
              }}
              aria-label="Supprimer le lieu"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: '1px dashed var(--border-primary)',
            borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 13,
          }}
        >
          <Plus size={14} /> Ajouter un lieu
        </button>
      )}

      {showCreate && (
        <div
          style={{
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Location type toggle */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Type de lieu
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'in_person' as const, label: 'Presentiel', icon: <MapPin size={14} /> },
                { value: 'online' as const, label: 'En ligne', icon: <Video size={14} /> },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewLocationType(opt.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8, fontSize: 13,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: `1px solid ${newLocationType === opt.value ? 'var(--color-primary, #E53E3E)' : 'var(--border-primary)'}`,
                    background: newLocationType === opt.value ? 'rgba(229,62,62,0.08)' : 'transparent',
                    color: newLocationType === opt.value ? 'var(--color-primary, #E53E3E)' : 'var(--text-secondary)',
                    fontWeight: newLocationType === opt.value ? 600 : 400,
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Nom
            </label>
            <input
              type="text"
              placeholder={newLocationType === 'online' ? 'Ex: Google Meet' : 'Ex: Bureau Paris'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Address — only for in_person */}
          {newLocationType === 'in_person' && (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Adresse <span style={{ color: 'var(--text-muted)' }}>(optionnel)</span>
              </label>
              <input
                type="text"
                placeholder="123 Rue de la Paix, Paris"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Info message for online without Google Calendar */}
          {newLocationType === 'online' && !googleCalendarConnected && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              fontSize: 12, color: '#3b82f6', lineHeight: 1.5,
            }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Connectez Google Calendar dans les parametres pour generer automatiquement un lien Google Meet pour vos rendez-vous en ligne.
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewName(''); setNewAddress(''); setNewLocationType('in_person') }}
              style={{
                background: 'none', border: '1px solid var(--border-primary)',
                borderRadius: 8, padding: '7px 14px', fontSize: 13,
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              style={{
                background: 'var(--color-primary, #E53E3E)', border: 'none',
                borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600,
                color: '#fff', cursor: creating ? 'not-allowed' : 'pointer',
                opacity: creating || !newName.trim() ? 0.5 : 1,
              }}
            >
              {creating ? 'Ajout...' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
