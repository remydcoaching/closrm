'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Video, Link as LinkIcon, Phone, Info, AlertTriangle, Plus, X, Check } from 'lucide-react'
import { BookingLocation } from '@/types'

type LocationMode = 'in_person' | 'google_meet' | 'custom_link' | 'phone'

export interface LocationInfo {
  mode: LocationMode
  locationName?: string
  locationAddress?: string
  customLink?: string
}

const PHONE_LOCATION_NAME = 'Téléphone'

interface LocationEditorProps {
  selectedLocationIds: string[]
  onChange: (ids: string[]) => void
  googleCalendarConnected: boolean
  onLocationInfoChange?: (info: LocationInfo) => void
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

function locationToMode(loc: BookingLocation): LocationMode {
  if (loc.location_type === 'in_person') return 'in_person'
  if (loc.name === PHONE_LOCATION_NAME) return 'phone'
  if (loc.address && loc.address.trim().length > 0) return 'custom_link'
  return 'google_meet'
}

const CARDS: { mode: LocationMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    mode: 'in_person',
    label: 'Présentiel',
    description: 'Rendez-vous en personne à une adresse physique',
    icon: <MapPin size={20} />,
  },
  {
    mode: 'google_meet',
    label: 'Google Meet',
    description: 'Lien Meet généré automatiquement',
    icon: <Video size={20} />,
  },
  {
    mode: 'custom_link',
    label: 'Visio personnalisée',
    description: 'Zoom, Teams ou autre lien de visio',
    icon: <LinkIcon size={20} />,
  },
  {
    mode: 'phone',
    label: 'Téléphone',
    description: 'Tu appelles le prospect au numéro fourni à la réservation',
    icon: <Phone size={20} />,
  },
]

export default function LocationEditor({
  selectedLocationIds,
  onChange,
  googleCalendarConnected,
  onLocationInfoChange,
}: LocationEditorProps) {
  const [locations, setLocations] = useState<BookingLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [newPlaceName, setNewPlaceName] = useState('')
  const [newPlaceAddress, setNewPlaceAddress] = useState('')
  const [showAddPlace, setShowAddPlace] = useState(false)
  const [customLink, setCustomLink] = useState('')
  const [forcedMode, setForcedMode] = useState<LocationMode | null>(null)

  // Determine active mode from selected locations or forced mode
  const selectedLocations = locations.filter((l) => selectedLocationIds.includes(l.id))
  const derivedMode: LocationMode | null = selectedLocations.length > 0
    ? locationToMode(selectedLocations[0])
    : null
  const activeMode = forcedMode ?? derivedMode

  // All in_person locations available in the workspace
  const inPersonLocations = locations.filter((l) => l.location_type === 'in_person')

  // Sync custom link field when selection changes
  useEffect(() => {
    if (activeMode === 'custom_link' && selectedLocations.length > 0) {
      setCustomLink(selectedLocations[0].address ?? '')
    }
  }, [activeMode, selectedLocations])

  // Notify parent of location info changes — use primitive deps to avoid infinite loops
  const firstSelectedName = selectedLocations[0]?.name
  const firstSelectedAddress = selectedLocations[0]?.address
  useEffect(() => {
    if (!onLocationInfoChange || !activeMode) return
    const info: LocationInfo = { mode: activeMode }
    if (activeMode === 'in_person' && firstSelectedName) {
      info.locationName = firstSelectedName
      info.locationAddress = firstSelectedAddress ?? undefined
    } else if (activeMode === 'custom_link' && firstSelectedAddress) {
      info.customLink = firstSelectedAddress
    }
    onLocationInfoChange(info)
  }, [activeMode, firstSelectedName, firstSelectedAddress, onLocationInfoChange])

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

  const selectMode = useCallback(
    async (mode: LocationMode) => {
      setForcedMode(mode)

      if (mode === 'in_person') {
        // Keep currently selected in_person ids, don't auto-select all
        const currentInPerson = selectedLocationIds.filter((id) => {
          const loc = locations.find((l) => l.id === id)
          return loc && loc.location_type === 'in_person'
        })
        onChange(currentInPerson)
        // If no places exist yet, open the add form automatically
        if (inPersonLocations.length === 0) {
          setShowAddPlace(true)
        }
        return
      }

      // For google_meet, custom_link, phone: find or create a single location
      const locationType: 'in_person' | 'online' = 'online'
      const locationAddress: string | null = mode === 'custom_link' ? (customLink || null) : null
      const locationName =
        mode === 'google_meet'
          ? 'Google Meet'
          : mode === 'phone'
            ? PHONE_LOCATION_NAME
            : 'Visio personnalisée'

      const existing = locations.find((l) => locationToMode(l) === mode)
      if (existing) {
        onChange([existing.id])
        return
      }

      const res = await fetch('/api/booking-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: locationName, address: locationAddress, location_type: locationType }),
      })
      if (res.ok) {
        const json = await res.json()
        const created = json.data as BookingLocation
        setLocations((prev) => [...prev, created])
        onChange([created.id])
      }
    },
    [locations, inPersonLocations, customLink, onChange]
  )

  // Toggle a single in_person location on/off
  function toggleInPersonLocation(locId: string) {
    const current = selectedLocationIds.filter((id) => {
      const loc = locations.find((l) => l.id === id)
      return loc && loc.location_type === 'in_person'
    })
    const isSelected = current.includes(locId)
    const next = isSelected
      ? current.filter((id) => id !== locId)
      : [...current, locId]
    onChange(next)
  }

  async function addNewPlace() {
    if (!newPlaceName.trim()) return
    const res = await fetch('/api/booking-locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newPlaceName.trim(),
        address: newPlaceAddress.trim() || null,
        location_type: 'in_person',
      }),
    })
    if (res.ok) {
      const json = await res.json()
      const created = json.data as BookingLocation
      setLocations((prev) => [...prev, created])
      // Auto-select the new location
      onChange([...selectedLocationIds, created.id])
      setNewPlaceName('')
      setNewPlaceAddress('')
      setShowAddPlace(false)
    }
  }

  async function removePlace(locId: string) {
    const res = await fetch(`/api/booking-locations/${locId}`, { method: 'DELETE' })
    if (res.ok) {
      setLocations((prev) => prev.filter((l) => l.id !== locId))
      onChange(selectedLocationIds.filter((id) => id !== locId))
    }
  }

  const handleCustomLinkBlur = useCallback(async () => {
    if (activeMode !== 'custom_link' || selectedLocations.length === 0) return
    const loc = selectedLocations[0]
    if (loc.address === customLink) return
    await fetch(`/api/booking-locations/${loc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: customLink }),
    })
    setLocations((prev) =>
      prev.map((l) => (l.id === loc.id ? { ...l, address: customLink } : l))
    )
  }, [activeMode, selectedLocations, customLink])

  if (loading) {
    return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Chargement...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
        Comment se dérouleront les rendez-vous ?
      </p>

      {/* 3 selectable cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CARDS.map((card) => {
          const isSelected = activeMode === card.mode
          return (
            <button
              key={card.mode}
              type="button"
              onClick={() => selectMode(card.mode)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 10,
                border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                background: isSelected ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.06)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: isSelected ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.12)' : 'var(--bg-active, rgba(255,255,255,0.04))',
                  color: isSelected
                    ? 'var(--color-primary)'
                    : card.mode === 'google_meet'
                      ? '#3b82f6'
                      : card.mode === 'custom_link'
                        ? '#a78bfa'
                        : card.mode === 'phone'
                          ? '#10b981'
                          : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {card.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                    marginBottom: 2,
                  }}
                >
                  {card.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {card.description}
                </div>
              </div>

              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {isSelected && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                    }}
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* In-person: multi-location picker */}
      {activeMode === 'in_person' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block' }}>
            Lieux disponibles
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — le prospect pourra choisir</span>
          </label>

          {inPersonLocations.length === 0 && !showAddPlace && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Aucun lieu ajouté. Ajoutez vos adresses ci-dessous.
            </div>
          )}

          {/* Existing in-person locations as checkboxes */}
          {inPersonLocations.map((loc) => {
            const isChecked = selectedLocationIds.includes(loc.id)
            return (
              <div
                key={loc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${isChecked ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                  background: isChecked ? 'rgba(var(--color-primary-rgb, 0,200,83), 0.04)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onClick={() => toggleInPersonLocation(loc.id)}
              >
                {/* Checkbox */}
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `2px solid ${isChecked ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                  background: isChecked ? 'var(--color-primary)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}>
                  {isChecked && <Check size={12} color="#000" strokeWidth={3} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{loc.name}</div>
                  {loc.address && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{loc.address}</div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePlace(loc.id) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 4,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Supprimer ce lieu"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}

          {/* Add new place form */}
          {showAddPlace ? (
            <div style={{
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-elevated)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <input
                type="text"
                placeholder="Nom du lieu (ex: Fitness Park Lampertheim)"
                value={newPlaceName}
                onChange={(e) => setNewPlaceName(e.target.value)}
                style={inputStyle}
                autoFocus
              />
              <input
                type="text"
                placeholder="Adresse (optionnel)"
                value={newPlaceAddress}
                onChange={(e) => setNewPlaceAddress(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddPlace(false); setNewPlaceName(''); setNewPlaceAddress('') }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    border: '1px solid var(--border-primary)',
                    background: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={addNewPlace}
                  disabled={!newPlaceName.trim()}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    border: 'none',
                    background: newPlaceName.trim() ? 'var(--color-primary)' : 'var(--border-primary)',
                    color: newPlaceName.trim() ? '#000' : 'var(--text-muted)',
                    cursor: newPlaceName.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Ajouter
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddPlace(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px dashed var(--border-primary)',
                background: 'transparent',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: 12,
                transition: 'all 0.15s',
              }}
            >
              <Plus size={14} />
              Ajouter un lieu
            </button>
          )}
        </div>
      )}

      {activeMode === 'google_meet' && !googleCalendarConnected && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(214,158,46,0.06)',
            border: '1px solid rgba(214,158,46,0.2)',
            fontSize: 12,
            color: '#D69E2E',
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Google Calendar n&apos;est pas connecté. Connectez-le dans{' '}
            <a
              href="/parametres/integrations"
              style={{ color: '#D69E2E', textDecoration: 'underline', fontWeight: 500 }}
            >
              Paramètres &gt; Intégrations
            </a>{' '}
            pour générer automatiquement un lien Google Meet.
          </span>
        </div>
      )}

      {activeMode === 'google_meet' && googleCalendarConnected && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(56,161,105,0.06)',
            border: '1px solid rgba(56,161,105,0.2)',
            fontSize: 12,
            color: '#38A169',
            lineHeight: 1.5,
          }}
        >
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Un lien Google Meet sera généré automatiquement pour chaque réservation.
          </span>
        </div>
      )}

      {activeMode === 'phone' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.2)',
            fontSize: 12,
            color: '#10b981',
            lineHeight: 1.5,
          }}
        >
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Tu appelleras le prospect au numéro qu&apos;il aura renseigné dans le formulaire de
            réservation. Pense à activer le champ <strong>Téléphone</strong> en requis dans le
            formulaire ci-dessous.
          </span>
        </div>
      )}

      {activeMode === 'custom_link' && (
        <div style={{ paddingLeft: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Lien de la visio
          </label>
          <input
            type="url"
            placeholder="https://zoom.us/j/123456789"
            value={customLink}
            onChange={(e) => setCustomLink(e.target.value)}
            onBlur={handleCustomLinkBlur}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
            Ce lien sera partagé avec le prospect lors de la réservation
          </span>
        </div>
      )}
    </div>
  )
}
