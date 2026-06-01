'use client'

/**
 * Bloc public "Actions calendrier" — boutons Google / Apple / Outlook +
 * lien "Reprogrammer ou annuler".
 *
 * Lit la dernière réservation du visiteur en localStorage (scope = funnel).
 * Si rien n'a encore été réservé (ou en preview builder), affiche un message
 * d'avertissement rouge et grise les boutons. Le coach peut alors ajuster
 * son funnel pour s'assurer que ce bloc est servi APRÈS un BookingBlock.
 *
 * Pourquoi localStorage et pas un param d'URL :
 * - Permet de placer le bloc sur n'importe quelle page du funnel (ex: page
 *   de remerciement) sans avoir à propager d'ID dans l'URL.
 * - Le visiteur peut revenir plus tard sur la page : tant que la donnée n'a
 *   pas expiré (cf. booking-storage.ts), il retrouve ses boutons.
 */

import { useEffect, useState } from 'react'
import { Calendar, ExternalLink } from 'lucide-react'
import type { BookingActionsBlockConfig } from '@/types'
import {
  buildGoogleCalendarUrl,
  buildIcsUrl,
  buildOutlookCalendarUrl,
} from '@/lib/email/calendar-links'
import {
  getFunnelScopeFromPathname,
  readFunnelBooking,
  type FunnelBookingSnapshot,
} from '@/lib/funnels/booking-storage'

interface Props {
  config: BookingActionsBlockConfig
}

export default function BookingActionsBlock({ config }: Props) {
  const [booking, setBooking] = useState<FunnelBookingSnapshot | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Lecture côté client uniquement (localStorage indisponible côté serveur).
  useEffect(() => {
    const scope = getFunnelScopeFromPathname(window.location.pathname)
    if (scope) setBooking(readFunnelBooking(scope))
    setHydrated(true)
  }, [])

  const hasBooking = booking !== null

  // Construit les URLs calendrier seulement si on a une réservation.
  const calendarParams = hasBooking
    ? {
        title: booking.title,
        startISO: booking.startISO,
        durationMinutes: booking.durationMinutes,
        location: booking.location || undefined,
        description: booking.description || undefined,
      }
    : null

  const googleUrl = calendarParams ? buildGoogleCalendarUrl(calendarParams) : '#'
  const icsUrl = calendarParams ? buildIcsUrl(calendarParams) : '#'
  const outlookUrl = calendarParams ? buildOutlookCalendarUrl(calendarParams) : '#'

  return (
    <div style={{ padding: '40px 20px', maxWidth: 560, margin: '0 auto' }}>
      {config.title && <h2 style={titleStyle}>{config.title}</h2>}
      {config.subtitle && <p style={subtitleStyle}>{config.subtitle}</p>}

      {/* État "pas encore réservé" — avertissement rouge.
          On rend toujours ce bloc SSR initialement (booking=null), puis
          on l'efface après hydratation si on trouve une réservation. Ça
          évite un flash "boutons cliquables" alors qu'ils ne marchent pas. */}
      {hydrated && !hasBooking && (
        <div style={warningBoxStyle} role="alert">
          {config.noBookingMessage}
        </div>
      )}

      {/* Boutons d'ajout au calendrier. Grisés tant qu'aucune réservation
          n'a été détectée. Pendant le pre-hydratation (SSR) on les rend
          actifs visuellement pour éviter un saut visuel mais sans href réel. */}
      <div style={buttonsRowStyle}>
        <ActionButton
          href={googleUrl}
          label={config.googleLabel}
          disabled={!hasBooking}
          icon={<Calendar size={18} />}
        />
        <ActionButton
          href={icsUrl}
          label={config.appleLabel}
          disabled={!hasBooking}
          icon={<Calendar size={18} />}
          download={hasBooking ? 'rdv.ics' : undefined}
        />
        <ActionButton
          href={outlookUrl}
          label={config.outlookLabel}
          disabled={!hasBooking}
          icon={<Calendar size={18} />}
        />
      </div>

      {/* Lien Reprogrammer/Annuler. On cache complètement si :
          - le coach a désactivé via showManageLink=false, OU
          - la réservation n'a pas de manageUrl (vieille entrée stockée
            avant que ce champ existe, ou booking créé sans token). */}
      {config.showManageLink && hasBooking && booking.manageUrl && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a
            href={booking.manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={manageLinkStyle}
          >
            {config.manageLabel}
            <ExternalLink size={13} style={{ marginLeft: 4, verticalAlign: '-2px' }} />
          </a>
        </div>
      )}
    </div>
  )
}

function ActionButton({
  href,
  label,
  disabled,
  icon,
  download,
}: {
  href: string
  label: string
  disabled: boolean
  icon: React.ReactNode
  download?: string
}) {
  if (disabled) {
    return (
      <button type="button" disabled style={buttonStyle(true)} aria-disabled="true">
        <span style={iconWrapStyle}>{icon}</span>
        <span>{label}</span>
      </button>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      download={download}
      style={buttonStyle(false)}
    >
      <span style={iconWrapStyle}>{icon}</span>
      <span>{label}</span>
    </a>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const titleStyle: React.CSSProperties = {
  fontSize: 24, fontWeight: 800, color: 'var(--fnl-primary)',
  margin: '0 0 8px', textAlign: 'center', lineHeight: 1.3,
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 15, color: 'var(--fnl-text-secondary)',
  margin: '0 0 22px', textAlign: 'center', lineHeight: 1.5,
}

const warningBoxStyle: React.CSSProperties = {
  background: 'rgba(229, 62, 62, 0.08)',
  border: '1px solid rgba(229, 62, 62, 0.35)',
  color: '#E53E3E',
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 13,
  lineHeight: 1.5,
  textAlign: 'center',
  marginBottom: 20,
  fontFamily: 'Poppins, sans-serif',
}

const buttonsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  padding: '12px 18px',
  fontSize: 14,
  fontWeight: 600,
  color: disabled ? 'rgba(var(--fnl-primary-rgb), 0.5)' : 'var(--fnl-text)',
  background: disabled
    ? 'rgba(var(--fnl-primary-rgb), 0.04)'
    : 'rgba(var(--fnl-primary-rgb), 0.06)',
  border: `1px solid rgba(var(--fnl-primary-rgb), ${disabled ? 0.1 : 0.25})`,
  borderRadius: 12,
  cursor: disabled ? 'not-allowed' : 'pointer',
  textDecoration: 'none',
  fontFamily: 'Poppins, sans-serif',
  transition: 'all 0.15s ease',
  opacity: disabled ? 0.55 : 1,
  boxSizing: 'border-box',
})

const iconWrapStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  color: 'var(--fnl-primary)',
  flexShrink: 0,
}

const manageLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--fnl-text-secondary)',
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  fontFamily: 'Poppins, sans-serif',
}
