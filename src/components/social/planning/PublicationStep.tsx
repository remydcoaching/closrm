'use client'

import { useRef, useState } from 'react'
import type { SocialPostWithPublications, SocialPostPublication } from '@/types'
import DateTimePicker from './DateTimePicker'

type Platform = 'instagram' | 'youtube' | 'tiktok'

interface PublicationStepProps {
  slot: SocialPostWithPublications
  onUpdate: (patch: Partial<SocialPostWithPublications>) => void
  onTogglePlatform: (platform: Platform, enabled: boolean) => void
  onUpdatePublication: (platform: Platform, patch: Record<string, unknown>) => void
  onUploadMedia: (file: File) => Promise<void>
  uploading: boolean
  uploadPct?: number
  onSchedule: () => void
  onPublishNow?: () => void
  /** Reprogrammer un slot deja `scheduled` : update scheduled_at + plan_date. */
  onReschedule?: (date: string, time: string) => void
  scheduling: boolean
  /** True quand 'Publier maintenant' tourne (vs 'Programmer'). */
  publishingNow?: boolean
  readOnly: boolean
  scheduledTime: string
  onScheduledTimeChange: (time: string) => void
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
  onUpdate,
  onTogglePlatform,
  onUpdatePublication,
  onUploadMedia,
  uploading,
  uploadPct = 0,
  onSchedule,
  onPublishNow,
  onReschedule,
  scheduling,
  publishingNow = false,
  readOnly,
  scheduledTime,
  onScheduledTimeChange,
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

  // La date programmee est dans le passe ? On bloque "Programmer la publication"
  // (mais "Publier maintenant" reste autorise — c'est une publication immediate).
  const scheduledDateInPast = (() => {
    if (!slot.plan_date) return false
    const datePart = slot.plan_date.slice(0, 10)
    const built = new Date(`${datePart}T${scheduledTime}:00`)
    if (isNaN(built.getTime())) return false
    return built.getTime() <= Date.now()
  })()

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

  // Status banner: si le slot est deja programme/publie, on l'affiche en
  // haut pour que le user voit clairement OU il est dans le flow.
  const statusBanner = (() => {
    if (slot.status === 'scheduled' && slot.scheduled_at) {
      const d = new Date(slot.scheduled_at)
      const fmt = d.toLocaleString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })
      return { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.4)', icon: '📅', label: `Programmé pour le ${fmt}` }
    }
    if (slot.status === 'publishing') {
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', icon: '⏳', label: 'Publication en cours…' }
    }
    if (slot.status === 'published') {
      const d = slot.published_at ? new Date(slot.published_at) : null
      const fmt = d ? d.toLocaleString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''
      return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', icon: '✅', label: fmt ? `Publié le ${fmt}` : 'Publié' }
    }
    if (slot.status === 'partial') {
      return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', icon: '⚠️', label: 'Publication partielle (certaines plateformes ont échoué)' }
    }
    if (slot.status === 'failed') {
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', icon: '❌', label: 'Publication échouée' }
    }
    return null
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '20px 22px 24px' }}>

      {/* Status banner (programme / publie / failed / etc.) */}
      {statusBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '12px 14px',
          background: statusBanner.bg,
          border: `1px solid ${statusBanner.border}`,
          borderRadius: 8,
          fontSize: 13, fontWeight: 600,
          color: statusBanner.color,
        }}>
          <span>{statusBanner.icon} {statusBanner.label}</span>
          {/* Bouton 'Annuler la programmation' uniquement quand status=scheduled */}
          {slot.status === 'scheduled' && !readOnly && (
            <button
              onClick={() => onUpdate({ status: 'draft', scheduled_at: null })}
              style={{
                padding: '5px 10px',
                fontSize: 11, fontWeight: 600,
                color: 'var(--text-tertiary)',
                background: 'transparent',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Annuler la programmation
            </button>
          )}
          {/* Bouton 'Réessayer maintenant' quand failed/partial — relance
              publishPostNow direct, ignore l'heure programmee. */}
          {(slot.status === 'failed' || slot.status === 'partial') && !readOnly && onPublishNow && (
            <button
              onClick={onPublishNow}
              disabled={publishingNow}
              style={{
                padding: '6px 12px',
                fontSize: 11, fontWeight: 700,
                color: '#fff',
                background: statusBanner.color,
                border: 'none',
                borderRadius: 6,
                cursor: publishingNow ? 'not-allowed' : 'pointer',
                opacity: publishingNow ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {publishingNow ? 'Publication…' : '↻ Réessayer'}
            </button>
          )}
          {/* Liens vers les posts publies, par plateforme */}
          {slot.status === 'published' && (slot.publications ?? []).some((p) => p.public_url) && (
            <span style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 500 }}>
              {(slot.publications ?? [])
                .filter((p) => p.public_url)
                .map((p) => (
                  <a
                    key={p.platform}
                    href={p.public_url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: statusBanner.color,
                      textDecoration: 'underline',
                      textTransform: 'capitalize',
                    }}
                  >
                    {p.platform} ↗
                  </a>
                ))}
            </span>
          )}
        </div>
      )}

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
              {uploading ? `Upload… ${uploadPct ?? 0}%` : '📁 Uploader image ou vidéo'}
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

      {/* 4. Scheduled date + time */}
      {enabledPlatforms.length > 0 && (
        <Field label="Date et heure de publication">
          <DateTimePicker
            // Priorité: plan_date (= la date pivot UI) → scheduled_at
            // (= si quelqu'un a programme sans plan_date) → aujourd'hui.
            // Sans ce fallback, un slot sans plan_date affichait toujours
            // 'aujourd hui' meme si scheduled_at pointait sur une autre date.
            date={(
              slot.plan_date ??
              (slot.scheduled_at ? slot.scheduled_at.slice(0, 10) : new Date().toISOString().slice(0, 10))
            ).slice(0, 10)}
            time={scheduledTime}
            onChange={(date, time) => {
              const isScheduled = slot.status === 'scheduled'
              if (isScheduled && onReschedule) {
                // Reprogrammation: PATCH scheduled_at + plan_date + pubs.scheduled_at.
                onReschedule(date, time)
                if (time !== scheduledTime) onScheduledTimeChange(time)
                return
              }
              if (date !== (slot.plan_date ?? '').slice(0, 10)) {
                // Slot manuellement deplace: on le detache de la trame
                // (slot_index=null) sinon l'index unique
                // (workspace_id, plan_date, content_kind, slot_index, pillar_id)
                // peut bloquer si un autre slot occupe deja cette date.
                onUpdate({ plan_date: date, slot_index: null } as Partial<SocialPostWithPublications>)
              }
              if (time !== scheduledTime) onScheduledTimeChange(time)
            }}
            disabled={readOnly || slot.status === 'published' || slot.status === 'publishing'}
          />
        </Field>
      )}

      {/* 5. Schedule + Publish now buttons */}
      {canSchedule && (
        <>
          {scheduledDateInPast && slot.status !== 'scheduled' && slot.status !== 'published' && slot.status !== 'failed' && slot.status !== 'partial' && (
            <div style={pastDateHintStyle}>
              ⚠️ La date sélectionnée est dans le passé. Tu peux soit changer la date, soit cliquer « Publier maintenant ».
            </div>
          )}
          {/* Hint specifique pour failed/partial: clarifier la marche a suivre */}
          {(slot.status === 'failed' || slot.status === 'partial') && scheduledDateInPast && (
            <div style={pastDateHintStyle}>
              💡 Pour réessayer plus tard, choisis une nouvelle date+heure futures puis clique « Reprogrammer ». Pour réessayer tout de suite, clique « Réessayer » dans le bandeau rouge.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                // Si deja programme: PATCH scheduled_at + plan_date directement.
                if (slot.status === 'scheduled' && onReschedule) {
                  const datePart = (slot.plan_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
                  onReschedule(datePart, scheduledTime)
                } else {
                  onSchedule()
                }
              }}
              disabled={scheduling || publishingNow || scheduledDateInPast}
              title={scheduledDateInPast ? 'Date dans le passé — choisis une date future ou publie maintenant' : undefined}
              style={{ ...scheduleBtnStyle, flex: 1, opacity: (publishingNow || scheduledDateInPast) ? 0.4 : 1, cursor: scheduledDateInPast ? 'not-allowed' : 'pointer' }}
            >
              {scheduling ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Spinner /> {slot.status === 'scheduled' ? 'Reprogrammation…' : 'Programmation…'}
                </span>
              ) : (
                slot.status === 'scheduled' ? 'Reprogrammer' :
                (slot.status === 'failed' || slot.status === 'partial') ? 'Reprogrammer' :
                'Programmer la publication'
              )}
            </button>
            {onPublishNow && (
              <button
                onClick={onPublishNow}
                disabled={scheduling || publishingNow}
                title="Publier immediatement (ignore l'heure programmee)"
                style={{ ...publishNowBtnStyle, opacity: scheduling ? 0.4 : 1 }}
              >
                {publishingNow ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Spinner /> Publication…
                  </span>
                ) : 'Publier maintenant'}
              </button>
            )}
          </div>
          {publishingNow && (
            <div style={progressHintStyle}>
              ⏳ Upload du média + traitement Meta/YouTube en cours. Ça peut prendre 30s à 2min selon la taille de la vidéo. Ne ferme pas la fenêtre.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <>
      <span style={{
        display: 'inline-block',
        width: 12, height: 12,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
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
  padding: '10px 12px',
  fontSize: 13,
  lineHeight: 1.4,
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  outline: 'none',
  // Force dark theme on native pickers (calendar popup, time spinner, etc.)
  colorScheme: 'dark',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  cursor: 'pointer',
  paddingRight: 28,
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='none' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M1 1l4 4 4-4'/></svg>\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  colorScheme: 'dark',
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

const progressHintStyle: React.CSSProperties = {
  marginTop: 6,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  background: 'rgba(0, 200, 83, 0.06)',
  border: '1px solid rgba(0, 200, 83, 0.25)',
  borderRadius: 8,
  lineHeight: 1.5,
}

const pastDateHintStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 500,
  color: '#f59e0b',
  background: 'rgba(245, 158, 11, 0.08)',
  border: '1px solid rgba(245, 158, 11, 0.3)',
  borderRadius: 8,
  lineHeight: 1.5,
}

const publishNowBtnStyle: React.CSSProperties = {
  marginTop: 8,
  padding: '12px 18px',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-primary)',
  background: 'transparent',
  border: '1px solid var(--border-primary)',
  borderRadius: 8,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
