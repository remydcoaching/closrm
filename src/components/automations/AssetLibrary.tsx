'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Link2, Mic, FileText, Upload, Trash2, Check, Loader2, Plus, Square, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { WorkflowAsset, WorkflowAssetType } from '@/types'

interface Props {
  open: boolean
  mode?: 'manage' | 'pick'
  onClose: () => void
  onPick?: (asset: WorkflowAsset) => void
  selectedAssetId?: string
}

const TYPE_META: Record<WorkflowAssetType, { label: string; icon: typeof Link2; color: string; bg: string }> = {
  link:  { label: 'Lien',    icon: Link2,    color: '#5b9bf5', bg: 'rgba(91,155,245,0.15)' },
  audio: { label: 'Vocal',   icon: Mic,      color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  file:  { label: 'Fichier', icon: FileText, color: '#D69E2E', bg: 'rgba(214,158,46,0.15)' },
}

export default function AssetLibrary({ open, mode = 'pick', onClose, onPick, selectedAssetId }: Props) {
  const [assets, setAssets] = useState<WorkflowAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState<WorkflowAssetType | null>(null)

  useEffect(() => {
    if (!open) return
    fetchAssets()
  }, [open])

  async function fetchAssets() {
    setLoading(true)
    try {
      const res = await fetch('/api/workflow-assets')
      const json = await res.json()
      setAssets(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet asset ?')) return
    const res = await fetch(`/api/workflow-assets/${id}`, { method: 'DELETE' })
    if (res.ok) setAssets((prev) => prev.filter((a) => a.id !== id))
  }

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720, maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-primary)',
          borderRadius: 14,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {mode === 'pick' ? 'Choisir un asset' : 'Bibliothèque d\'assets'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Liens, vocaux et fichiers réutilisables dans tes workflows
            </div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>

        {/* Add buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 20px 0' }}>
          {(['link', 'audio', 'file'] as WorkflowAssetType[]).map((t) => {
            const meta = TYPE_META[t]
            const Icon = meta.icon
            return (
              <button
                key={t}
                onClick={() => setShowAdd(t)}
                style={{
                  flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 12px',
                  background: meta.bg,
                  border: `1px solid ${meta.color}`,
                  borderRadius: 8,
                  color: meta.color,
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <Icon size={13} />
                <span>{meta.label}</span>
              </button>
            )
          })}
        </div>

        {showAdd && (
          <div style={{ padding: '12px 20px 0' }}>
            <AddAssetForm
              type={showAdd}
              onCancel={() => setShowAdd(null)}
              onCreated={(asset) => {
                setAssets((prev) => [asset, ...prev])
                setShowAdd(null)
              }}
            />
          </div>
        )}

        {/* List */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '12px 20px 20px',
        }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Loader2 size={18} className="animate-spin" />
            </div>
          )}
          {!loading && assets.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--text-muted)' }}>
              Aucun asset pour l&apos;instant. Crée-en un avec les boutons ci-dessus.
            </div>
          )}
          {!loading && assets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {assets.map((a) => (
                <AssetRow
                  key={a.id}
                  asset={a}
                  selected={a.id === selectedAssetId}
                  pickable={mode === 'pick'}
                  onPick={() => onPick?.(a)}
                  onDelete={() => handleDelete(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AssetRow({ asset, selected, pickable, onPick, onDelete }: {
  asset: WorkflowAsset
  selected: boolean
  pickable: boolean
  onPick: () => void
  onDelete: () => void
}) {
  const meta = TYPE_META[asset.type]
  const Icon = meta.icon
  const [h, setH] = useState(false)

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 8,
        background: selected ? meta.bg : (h ? 'var(--bg-hover)' : 'var(--bg-surface)'),
        border: `1px solid ${selected ? meta.color : (h ? 'var(--border-primary)' : 'transparent')}`,
        cursor: pickable ? 'pointer' : 'default',
        transition: 'all 0.12s',
      }}
      onClick={pickable ? onPick : undefined}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 7, background: meta.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={15} style={{ color: meta.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{asset.name}</div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {asset.type === 'link' ? asset.url : `${meta.label}${asset.file_size ? ` · ${formatBytes(asset.file_size)}` : ''}`}
        </div>
      </div>
      {asset.type === 'audio' && (
        <audio controls src={asset.url} style={{ height: 28, maxWidth: 160 }} />
      )}
      {selected && <Check size={16} style={{ color: meta.color, flexShrink: 0 }} />}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        style={{ ...iconBtn, color: 'var(--text-muted)' }}
        title="Supprimer"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function AddAssetForm({ type, onCancel, onCreated }: {
  type: WorkflowAssetType
  onCancel: () => void
  onCreated: (asset: WorkflowAsset) => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [audioMode, setAudioMode] = useState<'record' | 'upload'>('record')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const meta = TYPE_META[type]

  async function handleSubmit() {
    setError(null)
    if (!name.trim()) return setError('Le nom est requis')

    setSubmitting(true)
    try {
      let payload: Record<string, unknown> = { type, name: name.trim() }

      if (type === 'link') {
        if (!url.trim()) throw new Error('URL requise')
        payload.url = url.trim()
      } else {
        if (!file) throw new Error('Fichier requis')
        const supabase = createClient()
        const ext = file.name.split('.').pop() || 'bin'
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('workflow-assets')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('workflow-assets').getPublicUrl(path)
        payload = {
          ...payload,
          url: pub.publicUrl,
          storage_path: path,
          mime_type: file.type,
          file_size: file.size,
        }
      }

      const res = await fetch('/api/workflow-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Erreur')
      onCreated(json.data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      background: 'var(--bg-surface)', border: `1px solid ${meta.color}`,
      borderRadius: 10, padding: 14,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: meta.color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Nouveau {meta.label.toLowerCase()}
      </div>
      <input
        type="text"
        placeholder="Nom de l'asset (ex : Vocal de bienvenue)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />
      {type === 'link' ? (
        <input
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ ...inputStyle, marginTop: 8 }}
        />
      ) : type === 'audio' ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, padding: 3, background: 'var(--bg-input)', borderRadius: 8 }}>
            {(['record', 'upload'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setAudioMode(m); setFile(null) }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 6,
                  background: audioMode === m ? meta.color : 'transparent',
                  color: audioMode === m ? 'white' : 'var(--text-secondary)',
                  border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {m === 'record' ? <><Mic size={13} /> Enregistrer</> : <><Upload size={13} /> Importer</>}
              </button>
            ))}
          </div>
          {audioMode === 'record' ? (
            <VoiceRecorder onChange={setFile} />
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', padding: 10, borderRadius: 8,
                  background: 'var(--bg-input)', border: '1px dashed var(--border-primary)',
                  color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Upload size={14} />
                <span>{file ? file.name : 'Choisir un fichier audio (MP3, OGG…)'}</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          <input
            ref={fileRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', padding: 10, borderRadius: 8,
              background: 'var(--bg-input)', border: '1px dashed var(--border-primary)',
              color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Upload size={14} />
            <span>{file ? file.name : 'Choisir un fichier'}</span>
          </button>
        </div>
      )}
      {error && (
        <div style={{ fontSize: 11, color: '#E53E3E', marginTop: 8 }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnSecondary}>Annuler</button>
        <button onClick={handleSubmit} disabled={submitting} style={{ ...btnPrimary(meta.color), opacity: submitting ? 0.6 : 1 }}>
          {submitting ? <Loader2 size={13} className="animate-spin" /> : 'Créer'}
        </button>
      </div>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-secondary)',
  cursor: 'pointer', padding: 6, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)',
  borderRadius: 7, padding: '9px 11px',
  color: 'var(--text-primary)', fontSize: 12,
  width: '100%', outline: 'none',
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-primary)',
  borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', cursor: 'pointer',
}

function btnPrimary(color: string): React.CSSProperties {
  return {
    background: color, border: 'none', borderRadius: 7,
    padding: '7px 14px', fontSize: 12, fontWeight: 600,
    color: 'white', cursor: 'pointer', minWidth: 80,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

function VoiceRecorder({ onChange }: { onChange: (file: File | null) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [duration, setDuration] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (timerRef.current) clearInterval(timerRef.current)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const ext = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm'
        const file = new File([blob], `recording.${ext}`, { type: blob.type })
        onChange(file)
        const url = URL.createObjectURL(blob)
        setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url })
        setState('recorded')
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      recorder.start()
      recorderRef.current = recorder
      setState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (e) {
      setError((e as Error).message || 'Accès micro refusé')
    }
  }

  function stop() {
    recorderRef.current?.stop()
    recorderRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onChange(null)
    setState('idle')
    setDuration(0)
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{
      padding: 14, borderRadius: 8,
      background: 'var(--bg-input)', border: '1px dashed var(--border-primary)',
    }}>
      {state === 'idle' && (
        <button
          onClick={start}
          style={{
            width: '100%', padding: '14px', borderRadius: 8,
            background: '#EC4899', border: 'none', color: 'white',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Mic size={16} />
          <span>Démarrer l&apos;enregistrement</span>
        </button>
      )}
      {state === 'recording' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: '#E53E3E', animation: 'pulse 1s ease-in-out infinite',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Enregistrement…</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(duration)}</div>
          </div>
          <button
            onClick={stop}
            style={{
              padding: '8px 14px', borderRadius: 7,
              background: '#E53E3E', border: 'none', color: 'white',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Square size={12} fill="white" /> Arrêter
          </button>
        </div>
      )}
      {state === 'recorded' && previewUrl && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            Enregistrement · {fmt(duration)}
          </div>
          <audio controls src={previewUrl} style={{ width: '100%', height: 32 }} />
          <button
            onClick={reset}
            style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 6,
              background: 'transparent', border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <RotateCcw size={11} /> Recommencer
          </button>
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: '#E53E3E', marginTop: 8 }}>{error}</div>}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
