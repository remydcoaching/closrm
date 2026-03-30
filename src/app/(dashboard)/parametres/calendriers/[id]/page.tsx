'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookingCalendar, WeekAvailability, FormField } from '@/types'
import AvailabilityEditor from '@/components/booking-calendars/AvailabilityEditor'
import FormFieldsEditor from '@/components/booking-calendars/FormFieldsEditor'

const DEFAULT_AVAILABILITY: WeekAvailability = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
  saturday: [],
  sunday: [],
}

export default function EditCalendarPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [bufferMinutes, setBufferMinutes] = useState(0)
  const [color, setColor] = useState('#E53E3E')
  const [location, setLocation] = useState('')
  const [availability, setAvailability] = useState<WeekAvailability>(DEFAULT_AVAILABILITY)
  const [formFields, setFormFields] = useState<FormField[]>([])

  useEffect(() => {
    async function fetchCalendar() {
      try {
        const res = await fetch(`/api/booking-calendars/${id}`)
        if (!res.ok) throw new Error('Calendrier non trouvé')
        const json = await res.json()
        const cal: BookingCalendar = json.data

        setName(cal.name)
        setSlug(cal.slug)
        setDescription(cal.description ?? '')
        setDurationMinutes(cal.duration_minutes)
        setBufferMinutes(cal.buffer_minutes)
        setColor(cal.color)
        setLocation(cal.location ?? '')
        setAvailability(cal.availability ?? DEFAULT_AVAILABILITY)
        setFormFields(cal.form_fields ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchCalendar()
  }, [id])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch(`/api/booking-calendars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description: description || null,
          duration_minutes: durationMinutes,
          buffer_minutes: bufferMinutes,
          color,
          location: location || null,
          availability,
          form_fields: formFields,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setSaveError(json.error ?? 'Erreur lors de la sauvegarde')
      } else {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2500)
      }
    } catch {
      setSaveError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      {/* Back link */}
      <Link
        href="/parametres/calendriers"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          marginBottom: 24,
        }}
      >
        ← Retour aux calendriers
      </Link>

      {/* Page title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{name || 'Calendrier'}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveSuccess && (
            <span style={{ fontSize: 13, color: '#38A169' }}>Enregistré</span>
          )}
          {saveError && (
            <span style={{ fontSize: 13, color: '#ef4444' }}>{saveError}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#E53E3E',
              border: 'none',
              borderRadius: 8,
              padding: '9px 20px',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Section: Général */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 16px',
            paddingBottom: 10,
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          Général
        </h2>
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 10,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Nom</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Slug */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Slug (URL)
            </label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              style={inputStyle}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Lettres minuscules, chiffres et tirets uniquement
            </span>
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Description <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Duration + Buffer */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Durée (minutes)
              </label>
              <input
                type="number"
                min={5}
                max={480}
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Tampon (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={bufferMinutes}
                onChange={e => setBufferMinutes(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Color */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>Couleur</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{
                  width: 36,
                  height: 36,
                  border: '1px solid var(--border-primary)',
                  borderRadius: 6,
                  background: 'none',
                  cursor: 'pointer',
                  padding: 2,
                }}
              />
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{ ...inputStyle, width: 100 }}
              />
            </div>
          </div>

          {/* Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Lieu / Lien visio <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optionnel)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Ex: Google Meet, Zoom, adresse…"
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      {/* Section: Disponibilités */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 16px',
            paddingBottom: 10,
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          Disponibilités
        </h2>
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 10,
            padding: 24,
          }}
        >
          <AvailabilityEditor availability={availability} onChange={setAvailability} />
        </div>
      </section>

      {/* Section: Formulaire */}
      <section style={{ marginBottom: 40 }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 16px',
            paddingBottom: 10,
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          Formulaire de réservation
        </h2>
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-primary)',
            borderRadius: 10,
            padding: 24,
          }}
        >
          <FormFieldsEditor fields={formFields} onChange={setFormFields} />
        </div>
      </section>
    </div>
  )
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
