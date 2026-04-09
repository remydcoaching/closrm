'use client'

/**
 * T-028c — BookingBlock (stub visuel "À venir").
 *
 * ⚠️ Ce bloc est volontairement un PLACEHOLDER fonctionnel en V1.
 * La logique réelle d'intégration calendrier sera ajoutée dans une tâche dédiée
 * — voir `ameliorations.md → A-028a-01` pour le plan complet.
 *
 * Décision T-028a/c (validée le 2026-04-07) :
 * - On redesigne visuellement le bloc pour qu'il s'intègre au design system
 * - On affiche un overlay "À venir" + désactivation du clic
 * - On documente clairement que le branchement réel se fera sur le module
 *   Calendrier interne T-022 (et non sur Calendly externe), via les API
 *   /api/booking-calendars/* déjà existantes
 *
 * Visuellement : card centrée avec icône calendrier, titre, sous-titre,
 * bordure dashed teintée par la couleur principale. Tout passe par les CSS
 * vars du preset → s'adapte automatiquement au thème.
 */

import type { BookingBlockConfig } from '@/types'

interface Props {
  config: BookingBlockConfig
}

export default function BookingBlock({ config }: Props) {
  return (
    <div style={{ padding: '40px 20px', maxWidth: 600, margin: '0 auto' }}>
      {config.title && (
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--fnl-primary)',
            margin: '0 0 8px',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {config.title}
        </h2>
      )}
      {config.subtitle && (
        <p
          style={{
            fontSize: 16,
            color: 'var(--fnl-text-secondary)',
            margin: '0 0 28px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          {config.subtitle}
        </p>
      )}

      <div
        style={{
          position: 'relative',
          border: '2px dashed rgba(var(--fnl-primary-rgb), 0.4)',
          borderRadius: 20,
          padding: '56px 24px',
          textAlign: 'center',
          background:
            'linear-gradient(135deg, rgba(var(--fnl-primary-rgb), 0.06) 0%, rgba(var(--fnl-primary-rgb), 0.02) 100%)',
        }}
      >
        {/* Badge "À venir" en haut à droite */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            padding: '6px 14px',
            background:
              'linear-gradient(135deg, var(--fnl-primary) 0%, var(--fnl-primary-light) 100%)',
            color: 'white',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: 'uppercase',
            borderRadius: 50,
            boxShadow: '0 4px 15px rgba(var(--fnl-primary-rgb), 0.3)',
          }}
        >
          À venir
        </div>

        <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">
          📅
        </div>

        <p
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--fnl-text)',
            margin: '0 0 8px',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          Réservation de RDV
        </p>
        <p
          style={{
            fontSize: 13,
            color: 'var(--fnl-text-secondary)',
            margin: '0 0 4px',
            maxWidth: 400,
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.5,
          }}
        >
          Bientôt disponible : intégration directe avec tes calendriers ClosRM
          (cf. <strong>Paramètres &gt; Calendriers</strong>).
        </p>
        {config.calendarId && (
          <p
            style={{
              fontSize: 11,
              color: 'var(--fnl-text-secondary)',
              opacity: 0.6,
              marginTop: 12,
              fontFamily: 'monospace',
            }}
          >
            Calendrier configuré : {config.calendarId}
          </p>
        )}
      </div>
    </div>
  )
}
