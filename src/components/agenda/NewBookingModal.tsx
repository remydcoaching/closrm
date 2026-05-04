'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Info, Ban, Calendar, Clock, User, MapPin, FileText, ChevronDown, Repeat } from 'lucide-react'
import { BookingCalendar, BookingWithCalendar, Lead, BookingLocation } from '@/types'

/** Sentinel utilisé comme valeur dans le <select> calendrier pour signifier
 *  "horaire bloqué" — remplace l'ancien onglet "Horaire bloqué". */
const BLOCKED_CALENDAR_VALUE = '__blocked__'

interface NewBookingModalProps {
  calendars: BookingCalendar[]
  locations: BookingLocation[]
  prefillDate: string   // "2026-04-01"
  prefillTime: string   // "14:00"
  prefillDuration?: number // minutes, from drag selection
  /** Lead à pré-sélectionner — usage : ouverture depuis fiche/side panel lead. */
  prefillLead?: Lead | null
  /** Si présent, le modal passe en mode édition : pré-remplit les champs depuis
   *  le booking existant et soumet en PATCH au lieu de POST. */
  editingBooking?: BookingWithCalendar | null
  onClose: () => void
  onCreated: () => void
}

/** Champ en ligne minimaliste (style Cron/Notion) : transparent, sans bordure,
 *  hover/focus subtils. */
const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 6,
  color: 'var(--text-primary)',
  padding: '6px 8px',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  colorScheme: 'dark',
  transition: 'background 0.12s, border-color 0.12s',
  cursor: 'pointer',
}

const FR_DAY = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const FR_MONTH = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function formatDateLabel(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${FR_DAY[dt.getDay()]} ${d} ${FR_MONTH[m - 1]}`
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  }
  return `${minutes} min`
}


export default function NewBookingModal({
  calendars,
  locations,
  prefillDate,
  prefillTime,
  prefillDuration,
  prefillLead,
  editingBooking,
  onClose,
  onCreated,
}: NewBookingModalProps) {
  const isEditing = Boolean(editingBooking)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calendar dropdown — `BLOCKED_CALENDAR_VALUE` représente "Horaire bloqué"
  // (remplace l'ancien onglet). Init depuis editingBooking si présent.
  // Pour une création, on défaut sur "Horaire bloqué" : ça respecte la durée
  // sélectionnée par drag (sinon le calendrier par défaut écraserait la durée
  // avec sa propre `duration_minutes`).
  // Si on ouvre depuis un lead (prefillLead), on default sur le 1er calendrier
  // disponible plutôt que sur "Horaire bloqué" — c'est le cas d'usage attendu.
  const initialCalendarId = editingBooking
    ? (editingBooking.is_personal ? BLOCKED_CALENDAR_VALUE : editingBooking.calendar_id ?? '')
    : prefillLead && calendars.length > 0
      ? calendars[0].id
      : BLOCKED_CALENDAR_VALUE
  const [calendarId, setCalendarId] = useState<string>(initialCalendarId)
  const isBlocked = calendarId === BLOCKED_CALENDAR_VALUE

  const [locationId, setLocationId] = useState<string>(editingBooking?.location_id ?? '')
  const [leadSearch, setLeadSearch] = useState('')
  const [leadResults, setLeadResults] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(
    editingBooking?.lead
      ? ({
          id: editingBooking.lead.id,
          first_name: editingBooking.lead.first_name,
          last_name: editingBooking.lead.last_name,
          phone: editingBooking.lead.phone ?? null,
          email: editingBooking.lead.email ?? null,
        } as Lead)
      : (prefillLead ?? null),
  )

  // Title — pour les "horaires bloqués" et l'édition de bookings perso
  const [title, setTitle] = useState(editingBooking?.title ?? '')

  // Shared
  const [date, setDate] = useState(prefillDate)
  const [time, setTime] = useState(prefillTime)

  // Sync prefill when props change (modal reopened with new slot)
  // En mode édition, on ignore les prefills — l'init initial via editingBooking
  // est la source de vérité.
  useEffect(() => {
    if (isEditing && editingBooking) {
      const d = new Date(editingBooking.scheduled_at)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      setDate(`${yyyy}-${mm}-${dd}`)
      setTime(`${hh}:${mi}`)
    }
  }, [isEditing, editingBooking])
  useEffect(() => { if (!isEditing) setDate(prefillDate) }, [prefillDate, isEditing])
  useEffect(() => { if (!isEditing) setTime(prefillTime) }, [prefillTime, isEditing])
  useEffect(() => { if (!isEditing && prefillDuration) setDuration(prefillDuration) }, [prefillDuration, isEditing])
  const [duration, setDuration] = useState<number>(
    editingBooking?.duration_minutes ?? prefillDuration ?? calendars[0]?.duration_minutes ?? 60
  )
  const [notes, setNotes] = useState(editingBooking?.notes ?? '')

  // Récurrence : `null` = pas récurrent. Sinon { frequency, count }.
  // Édition d'une série : on désactive le contrôle (V1 = pas de propagation).
  type RecurrenceFreq = 'daily' | 'weekly' | 'monthly'
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq | 'none'>('none')
  const [recurrenceCount, setRecurrenceCount] = useState<number>(4)

  const [googleCalendarConnected, setGoogleCalendarConnected] = useState<boolean | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedCalendar = calendars.find((c) => c.id === calendarId)
  const availableLocations = locations.filter(
    (l) => l.is_active && selectedCalendar?.location_ids?.includes(l.id)
  )

  const selectedLocation = availableLocations.find((l) => l.id === locationId)
  const isOnlineLocation = selectedLocation?.location_type === 'online'

  // Check Google Calendar connection status
  useEffect(() => {
    fetch('/api/integrations?type=google_calendar')
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        const integration = json?.data?.[0] ?? json?.data
        setGoogleCalendarConnected(!!integration?.is_active)
      })
      .catch(() => setGoogleCalendarConnected(false))
  }, [])

  // Update duration when calendar changes — uniquement quand l'utilisateur
  // change explicitement le calendrier après ouverture du modal. On évite le
  // run au mount initial qui écraserait la durée pré-remplie (drag-select).
  const calendarChangeMountRef = useRef(true)
  useEffect(() => {
    if (isEditing) return
    if (calendarChangeMountRef.current) {
      calendarChangeMountRef.current = false
      return
    }
    const cal = calendars.find((c) => c.id === calendarId)
    if (cal) setDuration(cal.duration_minutes)
  }, [calendarId, calendars, isEditing])

  // ── Lead search optimisée ──
  // Stratégie hybride :
  //  1. Préfetch ~150 leads récents au montage du modal (single hit, hors UI critique)
  //  2. À chaque keystroke, filtre LOCALEMENT ces leads → résultats instantanés
  //  3. Si la query a >= 2 chars et que le local renvoie peu de résultats,
  //     fallback API en background (debounce 120ms + AbortController + cache)
  //  4. Mémo des réponses serveur par query (Map) → backspace = instant
  const recentLeadsRef = useRef<Lead[]>([])
  const serverCacheRef = useRef<Map<string, Lead[]>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  // Préfetch au montage : leads récents (id, prénom, nom, tel, email).
  // Endpoint existant — on demande 150, ordonné par défaut côté serveur (created_at desc).
  useEffect(() => {
    let cancelled = false
    fetch('/api/leads?per_page=100')
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (cancelled) return
        const leads = (json?.data ?? []) as Lead[]
        recentLeadsRef.current = leads
      })
      .catch(() => { /* silently ignore */ })
    return () => { cancelled = true }
  }, [])

  // Filtre local sur les leads préchargés (rapide, sans I/O)
  const filterLocalLeads = useCallback((q: string): Lead[] => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const out: Lead[] = []
    for (const l of recentLeadsRef.current) {
      const hay = `${l.first_name ?? ''} ${l.last_name ?? ''} ${l.email ?? ''} ${l.phone ?? ''}`.toLowerCase()
      if (hay.includes(needle)) {
        out.push(l)
        if (out.length >= 8) break
      }
    }
    return out
  }, [])

  useEffect(() => {
    // Annule tout debounce + requête en cours
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (leadSearch.length < 1) {
      setLeadResults([])
      return
    }

    // 1) Réponse instantanée locale
    const localHits = filterLocalLeads(leadSearch)
    setLeadResults(localHits)

    // 2) Cache serveur déjà résolu pour cette query → applique direct, skip réseau
    const cached = serverCacheRef.current.get(leadSearch)
    if (cached) {
      setLeadResults(cached)
      return
    }

    // 3) Fallback réseau seulement si query >= 2 chars (évite trafic inutile)
    //    et si le local ramène peu (<5) — sinon on garde les résultats locaux.
    if (leadSearch.length < 2 || localHits.length >= 5) return

    debounceRef.current = setTimeout(async () => {
      const ac = new AbortController()
      abortRef.current = ac
      try {
        const res = await fetch(
          `/api/leads?search=${encodeURIComponent(leadSearch)}&per_page=8`,
          { signal: ac.signal },
        )
        if (!res.ok) return
        const json = await res.json()
        const data = (json.data ?? []) as Lead[]
        serverCacheRef.current.set(leadSearch, data)
        // Si une nouvelle saisie a déjà changé `leadSearch`, on n'écrase pas
        // (l'effet suivant aura abort cette requête de toute façon).
        setLeadResults(data)
      } catch {
        // abort or network error → silently ignore
      }
    }, 120)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [leadSearch, filterLocalLeads])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Build a proper local Date and convert to ISO (UTC) so the server stores the correct time
      const localDate = new Date(`${date}T${time}:00`)
      const scheduledAt = localDate.toISOString()

      // Recurrence n'est appliquée qu'en création (pas en édition V1)
      const recurrencePayload = !isEditing && recurrenceFreq !== 'none'
        ? { frequency: recurrenceFreq, count: recurrenceCount }
        : null

      const body = isBlocked
        ? {
            is_personal: true,
            calendar_id: null,
            lead_id: null,
            location_id: null,
            title: title || 'Horaire bloqué',
            scheduled_at: scheduledAt,
            duration_minutes: duration,
            notes: notes || null,
            ...(recurrencePayload ? { recurrence: recurrencePayload } : {}),
          }
        : {
            is_personal: false,
            calendar_id: calendarId || null,
            lead_id: selectedLead?.id ?? null,
            location_id: locationId || null,
            title: title.trim()
              || (selectedLead
                ? `${selectedLead.first_name} ${selectedLead.last_name}`.trim()
                : 'Rendez-vous'),
            scheduled_at: scheduledAt,
            duration_minutes: duration,
            notes: notes || null,
            ...(recurrencePayload ? { recurrence: recurrencePayload } : {}),
          }

      // En édition : PATCH /api/bookings/[id]. Sinon : POST /api/bookings.
      const url = isEditing && editingBooking
        ? `/api/bookings/${editingBooking.id}`
        : '/api/bookings'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? (isEditing ? 'Erreur lors de la modification' : 'Erreur lors de la création'))
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  // Heure de fin calculée depuis time + duration
  const endTimeStr = (() => {
    if (!time) return ''
    const [h, m] = time.split(':').map(Number)
    const totalMin = h * 60 + m + duration
    const endH = Math.floor(totalMin / 60) % 24
    const endM = totalMin % 60
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  })()

  // Couleur du calendrier sélectionné (pour le dot)
  const calendarColor = isBlocked
    ? 'var(--text-muted)'
    : (selectedCalendar?.color ?? 'var(--text-muted)')

  const titlePlaceholder = isBlocked
    ? 'Pause déjeuner, vacances…'
    : selectedLead
      ? `${selectedLead.first_name} ${selectedLead.last_name}`.trim()
      : 'Rendez-vous sans titre'

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 14,
          width: 520,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          padding: 0,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)',
          position: 'relative',
        }}
      >
        {/* Bande colorée fine à gauche, prend la couleur du calendrier */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 3,
            background: calendarColor,
            opacity: isBlocked ? 0.3 : 0.85,
            borderTopLeftRadius: 14,
            borderBottomLeftRadius: 14,
            transition: 'background 0.2s',
          }}
        />
        {/* Header — minimal, juste un close button. Le "titre" du modal vient
            du grand input ci-dessous. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px 0 20px',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-elevated)',
            zIndex: 1,
          }}
        >
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {isEditing ? 'Modifier' : 'Nouveau rendez-vous'}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: 4,
              borderRadius: 6,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 22px 4px 22px' }}>
            {/* Titre — input large, sans bordure, focus principal du modal */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={titlePlaceholder}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: -0.2,
                fontFamily: 'inherit',
                padding: '6px 0 14px 0',
                marginBottom: 6,
                borderBottom: '1px solid var(--border-primary)',
                width: '100%',
              }}
              autoFocus={!isEditing}
            />

            {/* Lignes : icône + champ. Style Cron/Notion — minimal, hover/focus discrets. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

              {/* Calendrier — dot coloré + select natif stylé */}
              <Row icon={<Calendar size={15} />} ariaLabel="Calendrier">
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 8,
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: calendarColor,
                      pointerEvents: 'none',
                    }}
                  />
                  <select
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    style={{ ...fieldStyle, paddingLeft: 24, appearance: 'none', WebkitAppearance: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <option value={BLOCKED_CALENDAR_VALUE}>Horaire bloqué</option>
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id}>{cal.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: 8, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                </div>
              </Row>

              {/* Date + Heures — un seul bloc visuel */}
              <Row icon={<Clock size={15} />} ariaLabel="Date et heure">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                  <DateField value={date} onChange={setDate} />
                  <TimeSelect
                    value={time}
                    onChange={setTime}
                    rangeStart={0}
                    rangeEnd={23}
                  />
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '0 2px' }}>→</span>
                  <TimeSelect
                    value={endTimeStr}
                    onChange={(v) => {
                      if (!time || !v) return
                      const [sh, sm] = time.split(':').map(Number)
                      const [eh, em] = v.split(':').map(Number)
                      const diff = (eh * 60 + em) - (sh * 60 + sm)
                      if (diff > 0) setDuration(diff)
                    }}
                    rangeStart={0}
                    rangeEnd={23}
                  />
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 4 }}>
                    · {formatDuration(duration)}
                  </span>
                </div>
              </Row>

              {!isBlocked && (
                <>
                  {/* Lead */}
                  <Row icon={<User size={15} />} ariaLabel="Lead">
                    {selectedLead ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: 'var(--bg-hover)',
                          flex: 1,
                        }}
                      >
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          color: 'var(--text-primary)',
                        }}>
                          <span
                            aria-hidden
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              background: 'color-mix(in srgb, var(--color-primary) 25%, transparent)',
                              color: 'var(--color-primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          >
                            {(selectedLead.first_name?.[0] ?? '').toUpperCase()}{(selectedLead.last_name?.[0] ?? '').toUpperCase()}
                          </span>
                          {selectedLead.first_name} {selectedLead.last_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedLead(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 2,
                            borderRadius: 4,
                          }}
                          aria-label="Désélectionner le lead"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="text"
                          placeholder="Rechercher un lead…"
                          value={leadSearch}
                          onChange={(e) => setLeadSearch(e.target.value)}
                          style={{ ...fieldStyle, cursor: 'text' }}
                          onFocus={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                          onBlur={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        />
                        {leadResults.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-secondary)',
                              borderRadius: 8,
                              marginTop: 4,
                              zIndex: 10,
                              overflow: 'hidden',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            }}
                          >
                            {leadResults.map((lead) => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => {
                                  setSelectedLead(lead)
                                  setLeadSearch('')
                                  setLeadResults([])
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  width: '100%',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--text-primary)',
                                  fontSize: 13,
                                  padding: '8px 12px',
                                  textAlign: 'left',
                                  gap: 8,
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                              >
                                <span style={{
                                  width: 22, height: 22, borderRadius: 999,
                                  background: 'color-mix(in srgb, var(--color-primary) 25%, transparent)',
                                  color: 'var(--color-primary)',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                                }}>
                                  {(lead.first_name?.[0] ?? '').toUpperCase()}{(lead.last_name?.[0] ?? '').toUpperCase()}
                                </span>
                                <span>{lead.first_name} {lead.last_name}</span>
                                {lead.phone && (
                                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto', fontSize: 12 }}>
                                    {lead.phone}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Row>

                  {/* Lieu */}
                  {availableLocations.length > 0 && (
                    <Row icon={<MapPin size={15} />} ariaLabel="Lieu">
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                        <select
                          value={locationId}
                          onChange={(e) => setLocationId(e.target.value)}
                          style={{ ...fieldStyle, appearance: 'none', WebkitAppearance: 'none', paddingRight: 24, color: locationId ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        >
                          <option value="">Choisir un lieu…</option>
                          {availableLocations.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}{l.location_type === 'online' ? ' (en ligne)' : ''}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={13} style={{ position: 'absolute', right: 8, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                      </div>
                    </Row>
                  )}
                </>
              )}

              {isBlocked && (
                <Row icon={<Ban size={15} />} ariaLabel="Bloqué">
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: '6px 8px' }}>
                    Aucun lead, aucune réservation possible
                  </span>
                </Row>
              )}

              {/* Récurrence — uniquement en création (l'édition V1 ne propage pas) */}
              {!isEditing && (
                <Row icon={<Repeat size={15} />} ariaLabel="Récurrence">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <select
                        value={recurrenceFreq}
                        onChange={(e) => setRecurrenceFreq(e.target.value as RecurrenceFreq | 'none')}
                        style={{
                          ...fieldStyle,
                          appearance: 'none',
                          WebkitAppearance: 'none',
                          paddingRight: 24,
                          width: 'auto',
                          minWidth: 130,
                          color: recurrenceFreq === 'none' ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <option value="none">Pas de récurrence</option>
                        <option value="daily">Tous les jours</option>
                        <option value="weekly">Toutes les semaines</option>
                        <option value="monthly">Tous les mois</option>
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: 8, color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    </div>
                    {recurrenceFreq !== 'none' && (
                      <>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>×</span>
                        <input
                          type="number"
                          min={2}
                          max={52}
                          value={recurrenceCount}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10)
                            if (!Number.isNaN(n)) setRecurrenceCount(Math.max(2, Math.min(52, n)))
                          }}
                          style={{
                            ...fieldStyle,
                            width: 56,
                            textAlign: 'center',
                            cursor: 'text',
                          }}
                          onFocus={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                          onBlur={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        />
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                          {recurrenceFreq === 'daily' ? 'jours' : recurrenceFreq === 'weekly' ? 'semaines' : 'mois'}
                        </span>
                      </>
                    )}
                  </div>
                </Row>
              )}

              {/* Notes */}
              <Row icon={<FileText size={15} />} ariaLabel="Notes" alignTop>
                <textarea
                  placeholder="Notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  style={{
                    ...fieldStyle,
                    cursor: 'text',
                    resize: 'vertical',
                    minHeight: 32,
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                  }}
                  onFocus={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onBlur={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                />
              </Row>
            </div>

            {/* Avertissement Google Meet — uniquement pour réunion online sans intégration */}
            {!isBlocked && isOnlineLocation && googleCalendarConnected === false && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                margin: '8px 0 4px 0',
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)',
                fontSize: 12, color: '#60a5fa', lineHeight: 1.5,
              }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Connectez Google Calendar dans les paramètres pour générer un lien Meet automatique.
                </span>
              </div>
            )}

            {error && (
              <div
                style={{
                  background: 'color-mix(in srgb, #ef4444 10%, transparent)',
                  border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                  borderRadius: 8,
                  color: '#fca5a5',
                  fontSize: 12,
                  padding: '8px 12px',
                  marginTop: 8,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              padding: '14px 20px',
              borderTop: '1px solid var(--border-primary)',
              position: 'sticky',
              bottom: 0,
              background: 'var(--bg-elevated)',
              marginTop: 12,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'var(--color-primary-hover)' : 'var(--color-primary)',
                border: 'none',
                borderRadius: 8,
                color: '#000',
                fontSize: 13,
                fontWeight: 600,
                padding: '8px 18px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.12s',
              }}
            >
              {loading
                ? (isEditing ? 'Enregistrement…' : 'Création…')
                : isEditing
                  ? 'Enregistrer'
                  : isBlocked
                    ? 'Bloquer le créneau'
                    : 'Prendre rendez-vous'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** Ligne de formulaire : icône à gauche (16px gutter) + champ qui prend tout. */
function Row({
  icon,
  children,
  ariaLabel,
  alignTop,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  ariaLabel: string
  alignTop?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: alignTop ? 'flex-start' : 'center',
        gap: 10,
        padding: '4px 0',
      }}
    >
      <div
        aria-label={ariaLabel}
        style={{
          width: 18,
          flexShrink: 0,
          color: 'var(--text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: alignTop ? 8 : 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}

/** Champ date inline qui affiche un libellé FR cliquable et déclenche le picker natif. */
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => {
          const el = ref.current
          if (!el) return
          // showPicker() est dispo sur Chromium-based; fallback focus
          const ie = el as HTMLInputElement & { showPicker?: () => void }
          if (typeof ie.showPicker === 'function') ie.showPicker()
          else el.focus()
        }}
        style={{
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--text-primary)',
          fontSize: 13,
          padding: '6px 8px',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.12s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {formatDateLabel(value) || 'Choisir une date'}
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          pointerEvents: 'none',
          colorScheme: 'dark',
        }}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  )
}

/** Time select compact, options par tranches de 15 min de rangeStart..rangeEnd inclus. */
function TimeSelect({
  value,
  onChange,
  rangeStart,
  rangeEnd,
}: {
  value: string
  onChange: (v: string) => void
  rangeStart: number
  rangeEnd: number
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'transparent',
        border: '1px solid transparent',
        color: 'var(--text-primary)',
        fontSize: 13,
        padding: '6px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        fontFamily: 'inherit',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        textAlign: 'center',
        colorScheme: 'dark',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {Array.from({ length: (rangeEnd - rangeStart) * 4 + 1 }, (_, i) => {
        const totalMin = rangeStart * 60 + i * 15
        const h = Math.floor(totalMin / 60)
        const m = totalMin % 60
        const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        return <option key={val} value={val}>{val}</option>
      })}
    </select>
  )
}
