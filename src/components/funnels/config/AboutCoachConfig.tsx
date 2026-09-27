'use client'

// T-048 — Panneau de config du bloc "Présentation du coach".

import type { AboutCoachBlockConfig, CoachStat, FunnelPage, FunnelBlock } from '@/types'
import ReorderableItemList from './ReorderableItemList'
import ImageUploadField from './ImageUploadField'
import RedirectPicker from './RedirectPicker'

interface Props {
  config: AboutCoachBlockConfig
  onChange: (config: AboutCoachBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
  funnelId: string
}

export default function AboutCoachConfig({ config, onChange, pages, blocks, funnelId }: Props) {
  const stats = config.stats || []

  const updateStat = (index: number, patch: Partial<CoachStat>) => {
    const next = stats.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange({ ...config, stats: next })
  }

  const addStat = () => onChange({ ...config, stats: [...stats, { id: crypto.randomUUID(), value: '', label: '' }] })
  const removeStat = (index: number) => onChange({ ...config, stats: stats.filter((_, i) => i !== index) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ImageUploadField
        value={config.imageUrl || ''}
        onChange={url => onChange({ ...config, imageUrl: url || null })}
        funnelId={funnelId}
        label="Photo du coach"
      />
      <div>
        <label style={labelStyle}>Titre</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre (optionnel)</label>
        <input
          type="text"
          value={config.subtitle || ''}
          onChange={e => onChange({ ...config, subtitle: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Texte de présentation</label>
        <textarea
          value={config.text}
          onChange={e => onChange({ ...config, text: e.target.value })}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Disposition</label>
        <select
          value={config.layout}
          onChange={e => onChange({ ...config, layout: e.target.value as 'image-left' | 'image-right' })}
          style={inputStyle}
        >
          <option value="image-left">Image à gauche</option>
          <option value="image-right">Image à droite</option>
        </select>
      </div>
      <label style={toggleRowStyle}>
        <input
          type="checkbox"
          checked={config.showButton !== false}
          onChange={e => onChange({ ...config, showButton: e.target.checked })}
        />
        <span>Afficher le bouton</span>
      </label>
      <div>
        <label style={labelStyle}>Texte du bouton (optionnel)</label>
        <input
          type="text"
          value={config.ctaText || ''}
          onChange={e => onChange({ ...config, ctaText: e.target.value || undefined })}
          style={inputStyle}
        />
      </div>
      <RedirectPicker
        value={config.ctaUrl ?? null}
        onChange={url => onChange({ ...config, ctaUrl: url ?? undefined })}
        pages={pages}
        blocks={blocks}
        label="Lien du bouton"
      />

      <div>
        <label style={labelStyle}>Statistiques</label>
        <ReorderableItemList
          items={stats}
          onChange={next => onChange({ ...config, stats: next })}
          onAdd={addStat}
          addLabel="Ajouter une statistique"
          renderItem={(stat, i) => (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={stat.value}
                onChange={e => updateStat(i, { value: e.target.value })}
                placeholder="100+"
                style={{ ...inputStyle, width: 70 }}
              />
              <input
                type="text"
                value={stat.label}
                onChange={e => updateStat(i, { label: e.target.value })}
                placeholder="Clients accompagnés"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => removeStat(i)}
                style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          )}
        />
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#555', display: 'block', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: '#0a0a0a', border: '1px solid #333', borderRadius: 8,
  color: '#fff', outline: 'none',
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 12, color: '#aaa', cursor: 'pointer',
}
