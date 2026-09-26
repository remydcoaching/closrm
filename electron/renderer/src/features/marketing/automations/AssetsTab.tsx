// Automations > Bibliothèque d'assets — web AssetLibrary.tsx (links, voice
// notes and files reused by workflow actions). Routes: GET/POST
// /api/workflow-assets, DELETE /api/workflow-assets/:id. Uploads go to the
// same Supabase Storage bucket ('workflow-assets') as the web, then the
// public URL is registered through POST /api/workflow-assets.
// In-app voice recording (MediaRecorder on the web) is not ported: record on
// the web or upload an audio file.
import { useEffect, useState } from 'react'
import { api } from '../../../lib/api-client'
import { supabase } from '../../../lib/supabase'
import { openWeb } from '../../../lib/web-link'
import { Button } from '../../../design-system/Button'
import { Input } from '../../../design-system/Input'
import { TableCard } from '../../../design-system/TableCard'
import { Chips } from '../../../design-system/Tabs'
import { StatusPill } from '../../../design-system/StatusPill'
import { LoadingState, ErrorState, EmptyState } from '../../../design-system/States'
import { errorMessage } from '../http'
import { formatBytes, formatDate } from '../format'
import type { WorkflowAsset, WorkflowAssetType } from '../types'

const TYPE_META: Record<WorkflowAssetType, { label: string; color: string; bg: string }> = {
  link: { label: 'Lien', color: 'var(--color-info)', bg: 'var(--color-info-soft)' },
  audio: { label: 'Vocal', color: 'var(--color-accent-solid)', bg: 'var(--color-accent-soft)' },
  file: { label: 'Fichier', color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
}

type Filter = 'all' | WorkflowAssetType

export function AssetsTab() {
  const [assets, setAssets] = useState<WorkflowAsset[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState<WorkflowAssetType | null>(null)

  async function load() {
    setError(null)
    try {
      const r = await api.get<{ data: WorkflowAsset[] }>('/api/workflow-assets')
      setAssets(r.data ?? [])
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function remove(a: WorkflowAsset) {
    if (!confirm(`Supprimer « ${a.name} » ? Les workflows qui l'utilisent ne pourront plus l'envoyer.`)) return
    try {
      await api.delete(`/api/workflow-assets/${a.id}`)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const count = (t: WorkflowAssetType) => (assets ?? []).filter((a) => a.type === t).length
  const visible = (assets ?? []).filter((a) => filter === 'all' || a.type === filter)

  return (
    <>
      {assets === null && !error && <LoadingState label="Chargement des assets…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {assets && (
        <TableCard
          title="Bibliothèque d'assets"
          subtitle="Liens, vocaux et fichiers réutilisables dans les actions de vos workflows"
          toolbar={
            <>
              <Chips
                items={[
                  { key: 'all' as Filter, label: 'Tous', count: assets.length },
                  { key: 'link' as Filter, label: 'Liens', count: count('link') },
                  { key: 'audio' as Filter, label: 'Vocaux', count: count('audio') },
                  { key: 'file' as Filter, label: 'Fichiers', count: count('file') },
                ]}
                active={filter}
                onChange={setFilter}
              />
              <button className="ds-pill-button" onClick={() => setCreating('link')}>
                + Lien
              </button>
              <button className="ds-pill-button" onClick={() => setCreating('audio')}>
                + Vocal
              </button>
              <button className="ds-pill-button ds-pill-button--dark" onClick={() => setCreating('file')}>
                + Fichier
              </button>
            </>
          }
        >
          {visible.length === 0 ? (
            <EmptyState title="Aucun asset" description="Ajoutez un lien, un vocal ou un fichier." />
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th className="ds-num-cell">Taille</th>
                  <th className="ds-num-cell">Ajouté le</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="mk-name">{a.name}</div>
                      {a.type === 'audio' ? (
                        <audio src={a.url} controls style={{ height: 32, marginTop: 4 }} />
                      ) : (
                        <div className="ds-muted">{a.url}</div>
                      )}
                    </td>
                    <td>
                      <StatusPill {...TYPE_META[a.type]} />
                    </td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{a.type === 'link' ? '—' : formatBytes(a.file_size)}</span>
                    </td>
                    <td className="ds-num-cell ds-muted">{formatDate(a.created_at)}</td>
                    <td>
                      <div className="mk-row-actions">
                        <button
                          className="mk-action"
                          onClick={() => (window.closrm?.openExternal ? window.closrm.openExternal(a.url) : window.open(a.url, '_blank', 'noopener'))}
                        >
                          Ouvrir ↗
                        </button>
                        <button className="mk-action mk-action--danger" onClick={() => remove(a)}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>
      )}
      {creating && (
        <NewAssetModal
          type={creating}
          onClose={() => setCreating(null)}
          onCreated={() => {
            setCreating(null)
            load()
          }}
        />
      )}
    </>
  )
}

function NewAssetModal({ type, onClose, onCreated }: { type: WorkflowAssetType; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
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
        const ext = file.name.split('.').pop() || 'bin'
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('workflow-assets').upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('workflow-assets').getPublicUrl(path)
        payload = { ...payload, url: pub.publicUrl, storage_path: path, mime_type: file.type || undefined, file_size: file.size }
      }
      await api.post('/api/workflow-assets', payload)
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="lead-create-overlay" onClick={onClose}>
      <div className="lead-create-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nouveau {TYPE_META[type].label.toLowerCase()}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Input placeholder="Nom de l'asset (ex : Vocal de bienvenue)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {type === 'link' ? (
            <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          ) : (
            <input type="file" accept={type === 'audio' ? 'audio/*' : undefined} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          )}
          {type === 'audio' && (
            <button type="button" className="mk-link" onClick={() => openWeb('/acquisition/automations')}>
              Enregistrer un vocal au micro : ouvrir la bibliothèque sur le web ↗
            </button>
          )}
          {error && <p className="lead-create-error">{error}</p>}
          <div className="lead-create-actions">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Ajout…' : 'Ajouter'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
