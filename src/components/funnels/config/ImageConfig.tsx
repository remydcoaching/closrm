'use client'

import type { FunnelImageBlockConfig, FunnelImageItem, FunnelPage, FunnelBlock } from '@/types'
import RedirectPicker from './RedirectPicker'

interface Props {
  config: FunnelImageBlockConfig
  onChange: (config: FunnelImageBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
}

// On migre les funnels legacy (1 image via `src`) vers le mode `images[]`
// au premier édit, pour que le coach travaille avec un seul modèle mental.
function getImages(config: FunnelImageBlockConfig): FunnelImageItem[] {
  if (Array.isArray(config.images) && config.images.length > 0) return config.images
  if (config.src) {
    return [{ src: config.src, alt: config.alt || '', linkUrl: config.linkUrl ?? null }]
  }
  return []
}

export default function ImageConfig({ config, onChange, pages, blocks }: Props) {
  const images = getImages(config)
  const size = config.size ?? 'large'
  const columns = config.columns ?? (images.length >= 2 ? 2 : 1)

  const updateImages = (next: FunnelImageItem[], extra?: Partial<FunnelImageBlockConfig>) => {
    // On garde `src/alt/linkUrl` synchros sur la 1ère image pour la rétro-compat
    // (pages publiques anciennes qui lisent encore ces champs en fallback).
    const first = next[0]
    onChange({
      ...config,
      ...extra,
      images: next,
      src: first?.src ?? '',
      alt: first?.alt ?? '',
      linkUrl: first?.linkUrl ?? null,
    })
  }

  const updateItem = (index: number, patch: Partial<FunnelImageItem>) => {
    const next = images.map((item, i) => (i === index ? { ...item, ...patch } : item))
    updateImages(next)
  }

  const addImage = () => {
    updateImages([...images, { src: '', alt: '', linkUrl: null }])
  }

  const removeImage = (index: number) => {
    updateImages(images.filter((_, i) => i !== index))
  }

  const moveImage = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target], next[index]]
    updateImages(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Taille des photos</label>
          <select
            value={size}
            onChange={(e) =>
              onChange({ ...config, size: e.target.value as FunnelImageBlockConfig['size'] })
            }
            style={inputStyle}
          >
            <option value="small">Petite</option>
            <option value="medium">Moyenne</option>
            <option value="large">Grande</option>
            <option value="full">Pleine largeur</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Colonnes</label>
          <select
            value={columns}
            onChange={(e) =>
              onChange({ ...config, columns: Number(e.target.value) as 1 | 2 | 3 })
            }
            style={inputStyle}
          >
            <option value={1}>1 colonne</option>
            <option value={2}>2 colonnes</option>
            <option value={3}>3 colonnes</option>
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Alignement</label>
        <select
          value={config.alignment}
          onChange={(e) =>
            onChange({
              ...config,
              alignment: e.target.value as FunnelImageBlockConfig['alignment'],
            })
          }
          style={inputStyle}
        >
          <option value="left">Gauche</option>
          <option value="center">Centre</option>
          <option value="right">Droite</option>
        </select>
      </div>

      <div style={{ height: 1, background: '#222', margin: '4px 0' }} />

      {images.map((item, i) => (
        <div key={i} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#888' }}>Photo {i + 1}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => moveImage(i, -1)}
                disabled={i === 0}
                style={iconBtn(i === 0)}
                title="Monter"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveImage(i, 1)}
                disabled={i === images.length - 1}
                style={iconBtn(i === images.length - 1)}
                title="Descendre"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeImage(i)}
                style={{ background: 'none', border: 'none', color: '#E53E3E', fontSize: 12, cursor: 'pointer' }}
              >
                Supprimer
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>URL de l&apos;image</label>
            <input
              type="url"
              value={item.src}
              onChange={(e) => updateItem(i, { src: e.target.value })}
              placeholder="https://images.unsplash.com/..."
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={labelStyle}>Texte alternatif</label>
            <input
              type="text"
              value={item.alt}
              onChange={(e) => updateItem(i, { alt: e.target.value })}
              placeholder="Description de l'image"
              style={inputStyle}
            />
          </div>
          <RedirectPicker
            value={item.linkUrl}
            onChange={(val) => updateItem(i, { linkUrl: val })}
            pages={pages}
            blocks={blocks}
            label="Lien au clic"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addImage}
        style={{
          padding: '8px 12px',
          fontSize: 12,
          background: '#1a1a1a',
          border: '1px dashed #444',
          borderRadius: 8,
          color: '#aaa',
          cursor: 'pointer',
        }}
      >
        + Ajouter une photo
      </button>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#888',
  display: 'block',
  marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: 8,
  color: '#fff',
  outline: 'none',
}

const cardStyle: React.CSSProperties = {
  background: '#111',
  borderRadius: 8,
  padding: 10,
  border: '1px solid #262626',
}

const iconBtn = (disabled: boolean): React.CSSProperties => ({
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 6,
  color: disabled ? '#444' : '#aaa',
  fontSize: 11,
  width: 22,
  height: 22,
  cursor: disabled ? 'not-allowed' : 'pointer',
  padding: 0,
  lineHeight: 1,
})
