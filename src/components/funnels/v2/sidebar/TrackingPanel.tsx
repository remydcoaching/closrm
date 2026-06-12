'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import MetaEventPicker from '../../config/MetaEventPicker'
import type { MetaEventConfig } from '@/lib/meta/funnel-events'

interface Props {
  metaPixelId: string | null
  onMetaPixelChange: (pixelId: string | null) => void
  /** Page actuellement éditée — son meta_event optionnel et son nom. */
  activePage?: { id: string; name: string; meta_event?: MetaEventConfig | null } | null
  /** Callback déclenché quand le coach change l'event Meta de la page active. */
  onActivePageMetaEventChange?: (next: MetaEventConfig | null) => void
}

export default function TrackingPanel({
  metaPixelId,
  onMetaPixelChange,
  activePage,
  onActivePageMetaEventChange,
}: Props) {
  const [open, setOpen] = useState(true)
  const [guideOpen, setGuideOpen] = useState(false)

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.trim()
    onMetaPixelChange(val || null)
  }

  return (
    <div style={{ borderTop: '1px solid #262626' }}>
      {/* ─── Header ──────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '12px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#A0A0A0', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        TRACKING &amp; PIXELS
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* ─── Pixel ID field ──────────────────────────────────── */}
          <label style={labelStyle}>Facebook Pixel ID</label>
          <input
            type="text"
            placeholder="Ex: 123456789012345"
            defaultValue={metaPixelId ?? ''}
            onBlur={handleInput}
            style={inputStyle}
          />

          {/* ─── Guide accordion ─────────────────────────────────── */}
          <button
            onClick={() => setGuideOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', fontSize: 12, fontWeight: 600,
              padding: '8px 0 0', marginTop: 4,
            }}
          >
            {guideOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {guideOpen ? 'Masquer le guide' : 'Afficher le guide'}
          </button>

          {/* ─── Page-level Meta event (in addition to PageView) ──────── */}
          {activePage && onActivePageMetaEventChange && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #262626' }}>
              <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Page : {activePage.name}
              </p>
              <MetaEventPicker
                value={activePage.meta_event}
                onChange={(next) => onActivePageMetaEventChange(next.type === 'none' ? null : next)}
                defaultChoice="none"
                title="Quand un visiteur arrive sur cette page…"
              />
              <p style={{ fontSize: 11, color: '#666', margin: '8px 0 0', lineHeight: 1.5 }}>
                En plus du <code style={{ color: '#A0A0A0' }}>PageView</code> auto. Utile pour le cas pré-filtre : la page qualifiée envoie <code style={{ color: '#A0A0A0' }}>Lead</code>, la page « pas qualifié » envoie rien.
              </p>
            </div>
          )}

          {guideOpen && (
            <div style={guideStyle}>
              <p style={guideTitleStyle}>Facebook Pixel</p>
              <ol style={{ margin: '8px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  'Allez dans Meta Events Manager',
                  'Cliquez sur "Connecter des sources de données → Web"',
                  'Choisissez "Meta Pixel"',
                  "Copiez l'ID du pixel (nombre à 15 chiffres)",
                  'Collez-le dans le champ Facebook Pixel ID ci-dessus',
                ].map((step, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#A0A0A0', lineHeight: 1.5 }}>{step}</li>
                ))}
              </ol>
              <p style={{ fontSize: 11, color: '#666', margin: '8px 0 0', lineHeight: 1.5 }}>
                Les events (PageView, Lead, Schedule) se déclenchent automatiquement sur vos funnels.
              </p>
              <div style={{ borderTop: '1px solid #262626', marginTop: 12, paddingTop: 12 }}>
                <p style={guideTitleStyle}>Events automatiques</p>
                {[
                  { name: 'PageView', desc: 'chargement de chaque page' },
                  { name: 'Lead', desc: 'formulaire soumis' },
                  { name: 'Schedule', desc: 'call réservé' },
                ].map(({ name, desc }) => (
                  <div key={name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', minWidth: 80 }}>{name}</span>
                    <span style={{ fontSize: 11, color: '#A0A0A0' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#A0A0A0', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  background: '#1A1A1A', border: '1px solid #333',
  borderRadius: 8, color: '#fff', outline: 'none',
  fontFamily: 'Poppins, sans-serif', boxSizing: 'border-box',
}

const guideStyle: React.CSSProperties = {
  marginTop: 12, padding: 12,
  background: '#1A1A1A', borderRadius: 8,
  border: '1px solid #262626',
}

const guideTitleStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#fff', margin: 0,
}
