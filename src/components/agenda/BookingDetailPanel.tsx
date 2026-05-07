'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { X, MapPin, Clock, Calendar, User, Trash2, Phone, Mail, Tag, PhoneCall, Bell, Video } from 'lucide-react'
import { BookingWithCalendar, BookingStatus, Lead, Call, FollowUp } from '@/types'

interface BookingDetailPanelProps {
  booking: BookingWithCalendar
  onClose: () => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'À confirmer', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  confirmed: { label: 'Confirmé', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  completed: { label: 'Terminé', color: '#38A169', bg: 'rgba(56,161,105,0.12)' },
  cancelled: { label: 'Annulé', color: '#E53E3E', bg: 'rgba(229,62,62,0.12)' },
  no_show: { label: 'Absent', color: '#D69E2E', bg: 'rgba(214,158,46,0.12)' },
}

type TabKey = 'rdv' | 'prospect'

export function BookingDetailPanel({
  booking,
  onClose,
  onDelete,
  onStatusChange,
}: BookingDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('rdv')
  const [lead, setLead] = useState<(Lead & { calls?: Call[]; follow_ups?: FollowUp[] }) | null>(null)
  const [loadingLead, setLoadingLead] = useState(false)
  const touchStartX = useRef(0)

  const hasLead = !!booking.lead_id

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) < 50) return
    if (diff < 0 && hasLead) setActiveTab('prospect')
    else if (diff > 0) setActiveTab('rdv')
  }

  // Trackpad swipe (horizontal scroll) — native listener to allow preventDefault
  const swipeAccum = useRef(0)
  const swipeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
      e.preventDefault()
      swipeAccum.current += e.deltaX
      if (swipeTimeout.current) clearTimeout(swipeTimeout.current)
      swipeTimeout.current = setTimeout(() => { swipeAccum.current = 0 }, 200)
      if (swipeAccum.current > 80 && hasLead) {
        setActiveTab('prospect')
        swipeAccum.current = 0
      } else if (swipeAccum.current < -80) {
        setActiveTab('rdv')
        swipeAccum.current = 0
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [hasLead])

  const color = booking.booking_calendar?.color ?? '#6b7280'
  const startDate = parseISO(booking.scheduled_at)
  const formattedDate = format(startDate, 'EEEE d MMMM yyyy', { locale: fr })
  const formattedTime = format(startDate, 'HH:mm', { locale: fr })
  const displayTitle = booking.lead
    ? `${booking.lead.first_name} ${booking.lead.last_name}`.trim()
    : booking.title

  // Fetch full lead details when prospect tab is opened
  useEffect(() => {
    if (activeTab !== 'prospect' || !booking.lead_id) return
    setLoadingLead(true)
    fetch(`/api/leads/${booking.lead_id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => { if (json?.data) setLead(json.data) })
      .catch(() => {})
      .finally(() => setLoadingLead(false))
  }, [activeTab, booking.lead_id])

  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'rdv', label: 'Rendez-vous', show: true },
    { key: 'prospect', label: 'Prospect', show: hasLead },
  ]

  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
        background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border-secondary)',
        zIndex: 40, display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 4, minHeight: 36, borderRadius: 2, background: color, flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>
              {displayTitle}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border-secondary)', marginBottom: 0 }}>
          {tabs.filter((t) => t.show).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                background: 'none', border: 'none',
                color: activeTab === tab.key ? 'var(--color-primary, #E53E3E)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.key ? '2px solid var(--color-primary, #E53E3E)' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — swipeable */}
      <div
        ref={contentRef}
        style={{ padding: 20, flex: 1 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeTab === 'rdv' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <DetailRow icon={<Calendar size={15} />} label="Date">
              <span style={{ textTransform: 'capitalize' }}>{formattedDate}</span>
            </DetailRow>
            <DetailRow icon={<Clock size={15} />} label="Heure">
              {formattedTime} · {booking.duration_minutes} min
            </DetailRow>
            {booking.location?.name && (
              <DetailRow icon={<MapPin size={15} />} label="Lieu">
                {booking.location.name}
                {booking.location.address && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block' }}>{booking.location.address}</span>
                )}
              </DetailRow>
            )}
            {/* Google Meet link */}
            {booking.meet_url && (
              <div>
                <a
                  href={booking.meet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 8,
                    background: 'rgba(56,161,105,0.12)', border: '1px solid #38A169',
                    color: '#38A169', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none', cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                >
                  <Video size={15} /> Rejoindre le Meet
                </a>
              </div>
            )}
            {!booking.meet_url && booking.location?.location_type === 'online' && booking.location.address && (
              <div>
                <a
                  href={booking.location.address}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 8,
                    background: 'rgba(167,139,250,0.12)', border: '1px solid #a78bfa',
                    color: '#a78bfa', fontSize: 13, fontWeight: 600,
                    textDecoration: 'none', cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                >
                  <Video size={15} /> Rejoindre la visio
                </a>
              </div>
            )}
            {!booking.meet_url && booking.location?.location_type === 'online' && !booking.location.address && (
              <div style={{
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#3b82f6',
                lineHeight: 1.5,
              }}>
                Lien Meet non disponible — connectez Google Calendar
              </div>
            )}
            {booking.lead && (
              <DetailRow icon={<User size={15} />} label="Lead">
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{booking.lead.first_name} {booking.lead.last_name}</div>
                  {booking.lead.phone && <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>{booking.lead.phone}</div>}
                </div>
              </DetailRow>
            )}
            {booking.booking_calendar?.name && (
              <DetailRow icon={<Calendar size={15} />} label="Calendrier">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {booking.booking_calendar.name}
                </span>
              </DetailRow>
            )}
            {booking.notes && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</div>
                <div style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-secondary)',
                  borderRadius: 8, padding: '10px 12px', fontSize: 13,
                  color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {booking.notes}
                </div>
              </div>
            )}

            {/* Status */}
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Statut</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(Object.entries(STATUS_CONFIG) as [BookingStatus, typeof STATUS_CONFIG[BookingStatus]][]).map(([status, cfg]) => {
                  const active = booking.status === status
                  return (
                    <button key={status} onClick={() => onStatusChange(booking.id, status)} style={{
                      padding: '7px 10px', borderRadius: 8,
                      border: `1px solid ${active ? cfg.color : 'var(--border-secondary)'}`,
                      background: active ? cfg.bg : 'transparent',
                      color: active ? cfg.color : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Delete */}
            <div style={{ marginTop: 10, paddingTop: 16, borderTop: '1px solid var(--border-secondary)' }}>
              <button
                onClick={() => onDelete(booking.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid #E53E3E',
                  background: 'transparent', color: '#E53E3E', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <Trash2 size={14} /> Supprimer ce RDV
              </button>
            </div>
          </div>
        )}

        {activeTab === 'prospect' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {loadingLead && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Chargement...</div>}
            {!loadingLead && !lead && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Aucune information disponible.</div>}
            {!loadingLead && lead && (
              <>
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-active)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, color: 'var(--color-primary, #E53E3E)',
                  }}>
                    {(lead.first_name?.[0] || '').toUpperCase()}{(lead.last_name?.[0] || '').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {lead.first_name} {lead.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
                      {lead.status?.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                {lead.phone && (
                  <DetailRow icon={<Phone size={15} />} label="Téléphone">
                    <a href={`tel:${lead.phone}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{lead.phone}</a>
                  </DetailRow>
                )}
                {lead.email && (
                  <DetailRow icon={<Mail size={15} />} label="Email">
                    <a href={`mailto:${lead.email}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>{lead.email}</a>
                  </DetailRow>
                )}

                {/* Source */}
                {lead.source && (
                  <DetailRow icon={<Tag size={15} />} label="Source">
                    {lead.source.replace(/_/g, ' ')}
                  </DetailRow>
                )}

                {/* Tags */}
                {lead.tags && lead.tags.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Tags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {lead.tags.map((tag: string) => (
                        <span key={tag} style={{
                          padding: '3px 8px', borderRadius: 4, fontSize: 11,
                          background: 'var(--bg-active)', color: 'var(--text-secondary)',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {lead.notes && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Notes</div>
                    <div style={{
                      background: 'var(--bg-input)', border: '1px solid var(--border-secondary)',
                      borderRadius: 8, padding: '10px 12px', fontSize: 13,
                      color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    }}>
                      {lead.notes}
                    </div>
                  </div>
                )}

                {/* Call history */}
                {lead.calls && lead.calls.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <PhoneCall size={13} /> Historique d&apos;appels ({lead.calls.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {lead.calls.map((call: Call) => {
                        const outcomeColors: Record<string, string> = {
                          done: '#38A169', pending: '#3b82f6', cancelled: '#E53E3E', no_show: '#D69E2E',
                        }
                        const outcomeLabels: Record<string, string> = {
                          done: 'Fait', pending: 'En attente', cancelled: 'Annulé', no_show: 'Absent',
                        }
                        return (
                          <div key={call.id} style={{
                            background: 'var(--bg-input)', border: '1px solid var(--border-secondary)',
                            borderRadius: 8, padding: '8px 10px', fontSize: 12,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                {call.type}
                              </span>
                              <span style={{
                                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                background: `${outcomeColors[call.outcome] || '#666'}22`,
                                color: outcomeColors[call.outcome] || '#666',
                                fontWeight: 600,
                              }}>
                                {outcomeLabels[call.outcome] || call.outcome}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 3 }}>
                              {format(parseISO(call.scheduled_at), 'd MMM yyyy · HH:mm', { locale: fr })}
                              {call.duration_seconds ? ` · ${Math.ceil(call.duration_seconds / 60)} min` : ''}
                            </div>
                            {call.notes && (
                              <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                                {call.notes.length > 80 ? call.notes.slice(0, 80) + '...' : call.notes}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Follow-ups */}
                {lead.follow_ups && lead.follow_ups.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Bell size={13} /> Follow-ups ({lead.follow_ups.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {lead.follow_ups.map((fu: FollowUp) => {
                        const statusColors: Record<string, string> = {
                          pending: '#3b82f6', done: '#38A169', cancelled: '#E53E3E',
                        }
                        const statusLabels: Record<string, string> = {
                          pending: 'En attente', done: 'Fait', cancelled: 'Annulé',
                        }
                        return (
                          <div key={fu.id} style={{
                            background: 'var(--bg-input)', border: '1px solid var(--border-secondary)',
                            borderRadius: 8, padding: '8px 10px', fontSize: 12,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-primary)' }}>{fu.reason || 'Relance'}</span>
                              <span style={{
                                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                background: `${statusColors[fu.status] || '#666'}22`,
                                color: statusColors[fu.status] || '#666',
                                fontWeight: 600,
                              }}>
                                {statusLabels[fu.status] || fu.status}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 3 }}>
                              {format(parseISO(fu.scheduled_at), 'd MMM yyyy · HH:mm', { locale: fr })}
                              {fu.channel ? ` · ${fu.channel}` : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Link to lead page */}
                <a
                  href={`/leads/${lead.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '8px 0', borderRadius: 8, marginTop: 8,
                    border: '1px solid var(--border-secondary)', background: 'transparent',
                    color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  Voir la fiche complète →
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ color: 'var(--text-secondary)', marginTop: 1, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{children}</div>
      </div>
    </div>
  )
}
