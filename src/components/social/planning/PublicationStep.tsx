'use client'

import { useRef, useState } from 'react'
import type { SocialPostWithPublications, SocialPostPublication } from '@/types'

type Platform = 'instagram' | 'youtube' | 'tiktok'

interface PublicationStepProps {
  slot: SocialPostWithPublications
  onUpdate: (patch: Partial<SocialPostWithPublications>) => void
  onTogglePlatform: (platform: Platform, enabled: boolean) => void
  onUpdatePublication: (platform: Platform, patch: Record<string, unknown>) => void
  onUploadMedia: (file: File) => Promise<void>
  uploading: boolean
  onSchedule: () => void
  scheduling: boolean
  readOnly: boolean
}

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
]

function getPublication(
  publications: SocialPostPublication[],
  platform: Platform
): SocialPostPublication | undefined {
  return publications.find((p) => p.platform === platform)
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url)
}

export default function PublicationStep({
  slot,
  onTogglePlatform,
  onUpdatePublication,
  onUploadMedia,
  uploading,
  onSchedule,
  scheduling,
  readOnly,
}: PublicationStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const publications = slot.publications ?? []

  const enabledPlatforms = PLATFORMS.filter((p) =>
    publications.some((pub) => pub.platform === p.key)
  )

  const [activeTab, setActiveTab] = useState<Platform | null>(() => {
    return enabledPlatforms[0]?.key ?? null
  })

  // Keep activeTab in sync: if the active tab's platform got disabled, reset to first enabled
  const resolvedActiveTab: Platform | null =
    activeTab && enabledPlatforms.some((p) => p.key === activeTab)
      ? activeTab
      : enabledPlatforms[0]?.key ?? null

  const hasMedia = Array.isArray(slot.media_urls) && slot.media_urls.length > 0
  const canSchedule =
    !readOnly &&
    enabledPlatforms.length > 0 &&
    hasMedia

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onUploadMedia(file)
      e.target.value = ''
    }
  }

  function handleToggle(platform: Platform) {
    if (readOnly) return
    const currentlyEnabled = publications.some((p) => p.platform === platform)
    onTogglePlatform(platform, !currentlyEnabled)
    // If enabling, switch to that tab
    if (!currentlyEnabled) {
      setActiveTab(platform)
    } else if (resolvedActiveTab === platform) {
      // If disabling the active tab, switch to next available
      const remaining = enabledPlatforms.filter((p) => p.key !== platform)
      setActiveTab(remaining[0]?.key ?? null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 18px 18px' }}>

      {/* 1. Platform toggles */}
      <Field label="Plateformes">
        <div style={{ display: 'flex', gap: 8 }}>
          {PLATFORMS.map(({ key, label }) => {
            const isEnabled = publications.some((p) => p.platform === key)
            return (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                disabled={readOnly}
                style={isEnabled ? activePlatformBtnStyle : inactivePlatformBtnStyle}
              >
                {label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* 2. Media zone */}
      <Field label="Média">
        {hasMedia ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {slot.media_urls.map((url, i) => (
              <div
                key={i}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: '#000',
                  border: '1px solid var(--border-primary)',
                  flexShrink: 0,
                }}
              >
                {isVideoUrl(url) ? (
                  <video
                    src={url}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    preload="metadata"
                    muted
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={`media-${i}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              disabled={readOnly || uploading}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={readOnly || uploading}
              style={uploadBtnStyle}
            >
              {uploading ? 'Upload en cours…' : '📁 Uploader image ou vidéo'}
            </button>
          </>
        )}
      </Field>

      {/* 3. Per-platform tabs + fields */}
      {enabledPlatforms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Tab row */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', gap: 0 }}>
            {enabledPlatforms.map(({ key, label }) => {
              const isActive = resolvedActiveTab === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--color-primary)' : 'var(--text-tertiary)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: isActive
                      ? '2px solid var(--color-primary)'
                      : '2px solid transparent',
                    cursor: 'pointer',
                    marginBottom: -1,
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Active tab fields */}
          {resolvedActiveTab === 'instagram' && (
            <InstagramFields
              publication={getPublication(publications, 'instagram')}
              onUpdate={(patch) => onUpdatePublication('instagram', patch)}
              readOnly={readOnly}
            />
          )}
          {resolvedActiveTab === 'youtube' && (
            <YouTubeFields
              publication={getPublication(publications, 'youtube')}
              onUpdate={(patch) => onUpdatePublication('youtube', patch)}
              readOnly={readOnly}
            />
          )}
          {resolvedActiveTab === 'tiktok' && (
            <TikTokPlaceholder />
          )}
        </div>
      )}

      {/* 4. Schedule button */}
      {canSchedule && (
        <button
          onClick={onSchedule}
          disabled={scheduling}
          style={scheduleBtnStyle}
        >
          {scheduling ? 'Programmation…' : 'Programmer la publication'}
        </button>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InstagramFields({
  publication,
  onUpdate,
  readOnly,
}: {
  publication: SocialPostPublication | undefined
  onUpdate: (patch: Record<string, unknown>) => void
  readOnly: boolean
}) {
  const config = (publication?.config ?? {}) as {
    caption?: string
    hashtags?: string[]
  }
  const caption = config.caption ?? ''
  const hashtags = Array.isArray(config.hashtags) ? config.hashtags : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Caption">
        <textarea
          value={caption}
          onChange={(e) => onUpdate({ ...config, caption: e.target.value })}
          placeholder="Rédigez votre caption Instagram…"
          rows={4}
          disabled={readOnly}
          style={textareaStyle}
        />
      </Field>
      <Field label="Hashtags">
        <input
          type="text"
          value={hashtags.join(' ')}
          onChange={(e) => {
            const raw = e.target.value
            const parsed = raw
              .split(/\s+/)
              .map((t) => t.trim())
              .filter(Boolean)
            onUpdate({ ...config, hashtags: parsed })
          }}
          placeholder="#coaching #motivation …"
          disabled={readOnly}
          style={inputStyle}
        />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
          Séparés par des espaces
        </span>
      </Field>
    </div>
  )
}

function YouTubeFields({
  publication,
  onUpdate,
  readOnly,
}: {
  publication: SocialPostPublication | undefined
  onUpdate: (patch: Record<string, unknown>) => void
  readOnly: boolean
}) {
  const config = (publication?.config ?? {}) as {
    title?: string
    description?: string
    privacy_status?: 'private' | 'unlisted' | 'public'
  }
  const title = config.title ?? ''
  const description = config.description ?? ''
  const privacy = config.privacy_status ?? 'private'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Titre">
        <input
          type="text"
          value={title}
          onChange={(e) => onUpdate({ ...config, title: e.target.value })}
          placeholder="Titre de la vidéo YouTube…"
          disabled={readOnly}
          style={inputStyle}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => onUpdate({ ...config, description: e.target.value })}
          placeholder="Description de la vidéo…"
          rows={4}
          disabled={readOnly}
          style={textareaStyle}
        />
      </Field>
      <Field label="Visibilité">
        <select
          value={privacy}
          onChange={(e) =>
            onUpdate({
              ...config,
              privacy_status: e.target.value as 'private' | 'unlisted' | 'public',
            })
          }
          disabled={readOnly}
          style={selectStyle}
        >
          <option value="private">Privé</option>
          <option value="unlisted">Non répertorié</option>
          <option value="public">Public</option>
        </select>
      </Field>
    </div>
  )
}

function TikTokPlaceholder() {
  return (
    <div
      style={{
        padding: '20px 16px',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--text-tertiary)',
        background: 'var(--bg-elevated)',
        borderRadius: 8,
        border: '1px dashed var(--border-primary)',
      }}
    >
      Intégration TikTok — bientôt disponible
    </div>
  )
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: 13,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 6,
  outline: 'none',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'auto',
  cursor: 'pointer',
}

const uploadBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-primary)',
  background: 'var(--bg-elevated)',
  border: '1px dashed var(--border-primary)',
  borderRadius: 8,
  cursor: 'pointer',
}

const activePlatformBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 700,
  color: '#fff',
  background: 'var(--color-primary)',
  border: '1px solid var(--color-primary)',
  borderRadius: 20,
  cursor: 'pointer',
}

const inactivePlatformBtnStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 20,
  cursor: 'pointer',
}

const scheduleBtnStyle: React.CSSProperties = {
  alignSelf: 'stretch',
  marginTop: 8,
  padding: '12px 18px',
  fontSize: 14,
  fontWeight: 700,
  color: '#fff',
  background: 'var(--color-primary)',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
}
