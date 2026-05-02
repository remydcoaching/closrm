'use client'

/**
 * Inspector du bloc sélectionné. Rend un formulaire de config spécifique
 * au type de bloc. 14 types supportés. Chaque type → son panneau de champs.
 *
 * Pour garder le fichier compact, tous les panels sont inline ici.
 */

import type {
  EmailBlock,
  HeaderBlockConfig,
  EmailHeroBlockConfig,
  TextBlockConfig,
  ImageBlockConfig,
  ButtonBlockConfig,
  EmailCtaBannerBlockConfig,
  DividerBlockConfig,
  EmailSpacerBlockConfig,
  EmailQuoteBlockConfig,
  EmailTestimonialsBlockConfig,
  EmailFeaturesGridBlockConfig,
  EmailVideoBlockConfig,
  EmailSocialLinksBlockConfig,
  FooterBlockConfig,
} from '@/types'
import { X } from 'lucide-react'
import { EMAIL_BLOCK_LABELS } from '@/lib/email/defaults'
import RichEmailEditor from '@/components/emails/RichEmailEditor'
import EmailIconPicker from './EmailIconPicker'

interface Props {
  block: EmailBlock
  onChange: (block: EmailBlock) => void
  onClose: () => void
}

export default function EmailBlockInspector({ block, onChange, onClose }: Props) {
  function update<T extends EmailBlock['config']>(patch: Partial<T>) {
    onChange({ ...block, config: { ...block.config, ...patch } as EmailBlock['config'] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid #1f1f1f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Bloc
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            {EMAIL_BLOCK_LABELS[block.type] || block.type}
          </span>
        </div>
        <button
          onClick={onClose}
          title="Fermer"
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            cursor: 'pointer',
            color: '#888',
            display: 'flex',
            padding: 5,
          }}
        >
          <X size={13} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {renderPanel(block, update)}
      </div>
    </div>
  )
}

function renderPanel(
  block: EmailBlock,
  update: <T extends EmailBlock['config']>(patch: Partial<T>) => void,
) {
  switch (block.type) {
    case 'header': {
      const c = block.config as HeaderBlockConfig
      return (
        <>
          <Field label="Titre">
            <TextInput value={c.title} onChange={(v) => update<HeaderBlockConfig>({ title: v })} />
          </Field>
          <Field label="Logo URL (optionnel)">
            <TextInput value={c.logoUrl || ''} onChange={(v) => update<HeaderBlockConfig>({ logoUrl: v })} />
          </Field>
          <Field label="Alignement">
            <AlignPicker value={c.alignment} onChange={(v) => update<HeaderBlockConfig>({ alignment: v })} />
          </Field>
        </>
      )
    }
    case 'hero': {
      const c = block.config as EmailHeroBlockConfig
      return (
        <>
          <Field label="Titre">
            <TextInput value={c.title} onChange={(v) => update<EmailHeroBlockConfig>({ title: v })} />
          </Field>
          <Field label="Sous-titre">
            <TextArea value={c.subtitle || ''} onChange={(v) => update<EmailHeroBlockConfig>({ subtitle: v })} />
          </Field>
          <Field label="Image URL (optionnel)">
            <TextInput value={c.imageUrl || ''} onChange={(v) => update<EmailHeroBlockConfig>({ imageUrl: v })} />
          </Field>
          <Field label="CTA texte">
            <TextInput value={c.ctaText || ''} onChange={(v) => update<EmailHeroBlockConfig>({ ctaText: v })} />
          </Field>
          <Field label="CTA URL">
            <TextInput value={c.ctaUrl || ''} onChange={(v) => update<EmailHeroBlockConfig>({ ctaUrl: v })} />
          </Field>
          <Field label="Alignement">
            <div style={{ display: 'flex', gap: 4 }}>
              {(['left', 'center'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => update<EmailHeroBlockConfig>({ alignment: a })}
                  style={chipStyle(c.alignment === a)}
                >
                  {a === 'left' ? 'Gauche' : 'Centre'}
                </button>
              ))}
            </div>
          </Field>
        </>
      )
    }
    case 'text': {
      const c = block.config as TextBlockConfig
      return (
        <Field label="Contenu">
          <RichEmailEditor
            value={c.content}
            onChange={(v) => update<TextBlockConfig>({ content: v })}
            minHeight={160}
          />
        </Field>
      )
    }
    case 'image': {
      const c = block.config as ImageBlockConfig
      return (
        <>
          <Field label="URL de l'image">
            <TextInput value={c.src} onChange={(v) => update<ImageBlockConfig>({ src: v })} />
          </Field>
          <Field label="Texte alternatif">
            <TextInput value={c.alt} onChange={(v) => update<ImageBlockConfig>({ alt: v })} />
          </Field>
          <Field label="Largeur (px, optionnel)">
            <TextInput
              value={c.width?.toString() || ''}
              onChange={(v) => update<ImageBlockConfig>({ width: v ? parseInt(v) : undefined })}
            />
          </Field>
          <Field label="Alignement">
            <AlignPicker value={c.alignment} onChange={(v) => update<ImageBlockConfig>({ alignment: v })} />
          </Field>
        </>
      )
    }
    case 'button': {
      const c = block.config as ButtonBlockConfig
      return (
        <>
          <Field label="Texte du bouton">
            <TextInput value={c.text} onChange={(v) => update<ButtonBlockConfig>({ text: v })} />
          </Field>
          <Field label="URL">
            <TextInput value={c.url} onChange={(v) => update<ButtonBlockConfig>({ url: v })} />
          </Field>
          <Field label="Couleur (override preset)">
            <ColorRow value={c.color} onChange={(v) => update<ButtonBlockConfig>({ color: v })} />
          </Field>
          <Field label="Alignement">
            <AlignPicker value={c.alignment} onChange={(v) => update<ButtonBlockConfig>({ alignment: v })} />
          </Field>
        </>
      )
    }
    case 'cta_banner': {
      const c = block.config as EmailCtaBannerBlockConfig
      return (
        <>
          <Field label="Texte principal">
            <TextArea value={c.text} onChange={(v) => update<EmailCtaBannerBlockConfig>({ text: v })} />
          </Field>
          <Field label="Texte du bouton">
            <TextInput value={c.ctaText} onChange={(v) => update<EmailCtaBannerBlockConfig>({ ctaText: v })} />
          </Field>
          <Field label="URL">
            <TextInput value={c.ctaUrl} onChange={(v) => update<EmailCtaBannerBlockConfig>({ ctaUrl: v })} />
          </Field>
          <Field label="Couleur de fond (optionnel)">
            <ColorRow
              value={c.backgroundColor || ''}
              onChange={(v) => update<EmailCtaBannerBlockConfig>({ backgroundColor: v })}
            />
          </Field>
        </>
      )
    }
    case 'divider': {
      const c = block.config as DividerBlockConfig
      return (
        <>
          <Field label="Couleur">
            <ColorRow value={c.color || '#e4e4e7'} onChange={(v) => update<DividerBlockConfig>({ color: v })} />
          </Field>
          <Field label="Espacement (px)">
            <TextInput
              value={(c.spacing || 16).toString()}
              onChange={(v) => update<DividerBlockConfig>({ spacing: parseInt(v) || 16 })}
            />
          </Field>
        </>
      )
    }
    case 'spacer': {
      const c = block.config as EmailSpacerBlockConfig
      return (
        <Field label="Hauteur (px)">
          <TextInput
            value={c.height.toString()}
            onChange={(v) => update<EmailSpacerBlockConfig>({ height: parseInt(v) || 24 })}
          />
        </Field>
      )
    }
    case 'quote': {
      const c = block.config as EmailQuoteBlockConfig
      return (
        <>
          <Field label="Citation">
            <TextArea value={c.text} onChange={(v) => update<EmailQuoteBlockConfig>({ text: v })} />
          </Field>
          <Field label="Auteur (optionnel)">
            <TextInput value={c.author || ''} onChange={(v) => update<EmailQuoteBlockConfig>({ author: v })} />
          </Field>
        </>
      )
    }
    case 'testimonials': {
      const c = block.config as EmailTestimonialsBlockConfig
      return (
        <>
          {c.items.map((t, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #262626',
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <Field label={`Témoignage ${idx + 1} — Quote`}>
                <TextArea
                  value={t.quote}
                  onChange={(v) => {
                    const items = [...c.items]
                    items[idx] = { ...t, quote: v }
                    update<EmailTestimonialsBlockConfig>({ items })
                  }}
                />
              </Field>
              <Field label="Auteur">
                <TextInput
                  value={t.author}
                  onChange={(v) => {
                    const items = [...c.items]
                    items[idx] = { ...t, author: v }
                    update<EmailTestimonialsBlockConfig>({ items })
                  }}
                />
              </Field>
              <Field label="Rôle (optionnel)">
                <TextInput
                  value={t.role || ''}
                  onChange={(v) => {
                    const items = [...c.items]
                    items[idx] = { ...t, role: v }
                    update<EmailTestimonialsBlockConfig>({ items })
                  }}
                />
              </Field>
              {c.items.length > 1 && (
                <button
                  onClick={() => update<EmailTestimonialsBlockConfig>({ items: c.items.filter((_, i) => i !== idx) })}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: 'transparent',
                    border: '1px solid #7f1d1d',
                    color: '#fca5a5',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() =>
              update<EmailTestimonialsBlockConfig>({
                items: [...c.items, { quote: '', author: '' }],
              })
            }
            style={{
              padding: '8px 12px',
              fontSize: 12,
              background: 'transparent',
              border: '1px dashed #555',
              color: '#888',
              borderRadius: 6,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            + Ajouter un témoignage
          </button>
        </>
      )
    }
    case 'features_grid': {
      const c = block.config as EmailFeaturesGridBlockConfig
      return (
        <>
          <Field label="Colonnes">
            <div style={{ display: 'flex', gap: 4 }}>
              {([2, 3] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => update<EmailFeaturesGridBlockConfig>({ columns: n })}
                  style={chipStyle(c.columns === n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>
          {c.items.map((f, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #262626',
                borderRadius: 8,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <Field label={`Feature ${idx + 1} — Icône`}>
                <EmailIconPicker
                  value={f.icon || ''}
                  onChange={(v) => {
                    const items = [...c.items]
                    items[idx] = { ...f, icon: v }
                    update<EmailFeaturesGridBlockConfig>({ items })
                  }}
                />
              </Field>
              <Field label="Titre">
                <TextInput
                  value={f.title}
                  onChange={(v) => {
                    const items = [...c.items]
                    items[idx] = { ...f, title: v }
                    update<EmailFeaturesGridBlockConfig>({ items })
                  }}
                />
              </Field>
              <Field label="Description">
                <TextArea
                  value={f.description}
                  onChange={(v) => {
                    const items = [...c.items]
                    items[idx] = { ...f, description: v }
                    update<EmailFeaturesGridBlockConfig>({ items })
                  }}
                />
              </Field>
              {c.items.length > 1 && (
                <button
                  onClick={() => update<EmailFeaturesGridBlockConfig>({ items: c.items.filter((_, i) => i !== idx) })}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: 'transparent',
                    border: '1px solid #7f1d1d',
                    color: '#fca5a5',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() =>
              update<EmailFeaturesGridBlockConfig>({
                items: [...c.items, { title: '', description: '' }],
              })
            }
            style={{
              padding: '8px 12px',
              fontSize: 12,
              background: 'transparent',
              border: '1px dashed #555',
              color: '#888',
              borderRadius: 6,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            + Ajouter une feature
          </button>
        </>
      )
    }
    case 'video': {
      const c = block.config as EmailVideoBlockConfig
      return (
        <>
          <Field label="URL de la miniature">
            <TextInput value={c.thumbnailUrl} onChange={(v) => update<EmailVideoBlockConfig>({ thumbnailUrl: v })} />
          </Field>
          <Field label="Lien vidéo (Loom / YouTube)">
            <TextInput value={c.linkUrl} onChange={(v) => update<EmailVideoBlockConfig>({ linkUrl: v })} />
          </Field>
          <Field label="Légende (optionnel)">
            <TextInput value={c.caption || ''} onChange={(v) => update<EmailVideoBlockConfig>({ caption: v })} />
          </Field>
        </>
      )
    }
    case 'social_links': {
      const c = block.config as EmailSocialLinksBlockConfig
      const fields: (keyof EmailSocialLinksBlockConfig)[] = [
        'instagram',
        'facebook',
        'linkedin',
        'twitter',
        'youtube',
        'telegram',
        'website',
      ]
      return (
        <>
          {fields.map((f) => (
            <Field key={f} label={f[0].toUpperCase() + f.slice(1)}>
              <TextInput
                value={c[f] || ''}
                onChange={(v) => update<EmailSocialLinksBlockConfig>({ [f]: v } as Partial<EmailSocialLinksBlockConfig>)}
              />
            </Field>
          ))}
        </>
      )
    }
    case 'footer': {
      const c = block.config as FooterBlockConfig
      return (
        <Field label="Texte du footer">
          <TextArea value={c.text} onChange={(v) => update<FooterBlockConfig>({ text: v })} />
        </Field>
      )
    }
  }
}

// ─── Shared input primitives ─────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 7,
          paddingLeft: 2,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

const baseInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  fontSize: 12.5,
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 7,
  color: '#eee',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 0.12s',
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={baseInputStyle} />
}

function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      style={{ ...baseInputStyle, resize: 'vertical', minHeight: 70 }}
    />
  )
}

function AlignPicker({
  value,
  onChange,
}: {
  value: 'left' | 'center' | 'right'
  onChange: (v: 'left' | 'center' | 'right') => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['left', 'center', 'right'] as const).map((a) => (
        <button key={a} onClick={() => onChange(a)} style={chipStyle(value === a)}>
          {a === 'left' ? 'Gauche' : a === 'center' ? 'Centre' : 'Droite'}
        </button>
      ))}
    </div>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 28, border: 'none', cursor: 'pointer', padding: 0, background: 'transparent' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...baseInputStyle, fontFamily: 'monospace' }}
      />
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '7px 10px',
    fontSize: 11.5,
    fontWeight: active ? 600 : 500,
    borderRadius: 6,
    border: active ? '1px solid #fff' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
    color: active ? '#fff' : '#aaa',
    cursor: 'pointer',
    transition: 'all 0.12s',
  }
}
