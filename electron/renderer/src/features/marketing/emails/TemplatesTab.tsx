// Emails > Templates — web templates-client.tsx (+ StarterGallery).
// Routes: GET/POST /api/emails/templates, PUT/DELETE /api/emails/templates/:id,
// POST /api/emails/templates/preview (server-compiled HTML).
// The drag & drop block editor stays on the web: openWeb('/acquisition/emails/templates/:id').
import { useEffect, useState } from 'react'
import { api } from '../../../lib/api-client'
import { openWeb } from '../../../lib/web-link'
import { Button } from '../../../design-system/Button'
import { Input } from '../../../design-system/Input'
import { Drawer } from '../../../design-system/Drawer'
import { formatNumber } from '../../../design-system/StatCard'
import { TableCard } from '../../../design-system/TableCard'
import { SearchInput } from '../../../design-system/SearchInput'
import { LoadingState, ErrorState, EmptyState } from '../../../design-system/States'
import { relativeTime } from '../../leads/status'
import { apiPostText, errorMessage } from '../http'
import { BLANK_TEMPLATE_BLOCKS, EMAIL_STARTERS } from '../catalog'
import type { EmailTemplate } from '../types'

const editorPath = (id: string) => `/acquisition/emails/templates/${id}`

export function TemplatesTab({ onCount }: { onCount: (n: number) => void }) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showGallery, setShowGallery] = useState(false)
  const [selected, setSelected] = useState<EmailTemplate | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const data = await api.get<EmailTemplate[]>('/api/emails/templates')
      const arr = Array.isArray(data) ? data : []
      setTemplates(arr)
      onCount(arr.length)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createFrom(body: Record<string, unknown>) {
    setActionError(null)
    try {
      const tpl = await api.post<EmailTemplate>('/api/emails/templates', body)
      setShowGallery(false)
      await load()
      setSelected(tpl)
    } catch (err) {
      setActionError(errorMessage(err))
    }
  }

  async function handleDuplicate(t: EmailTemplate) {
    setBusy(t.id)
    await createFrom({
      name: `${t.name} (copie)`,
      subject: t.subject,
      blocks: t.blocks,
      preview_text: t.preview_text,
      preset_id: t.preset_id ?? undefined,
    })
    setBusy(null)
  }

  async function handleDelete(t: EmailTemplate) {
    if (!confirm('Supprimer ce template ?')) return
    setBusy(t.id)
    try {
      await api.delete(`/api/emails/templates/${t.id}`)
      await load()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const q = search.trim().toLowerCase()
  const visible = (templates ?? []).filter((t) => !q || t.name.toLowerCase().includes(q) || (t.subject ?? '').toLowerCase().includes(q))

  return (
    <>
      {actionError && (
        <div className="mk-banner mk-banner--warning">
          <span>{actionError}</span>
          <button className="mk-action" onClick={() => setActionError(null)}>
            Fermer
          </button>
        </div>
      )}
      {templates === null && !error && <LoadingState label="Chargement des templates…" />}
      {error && <ErrorState message={error} onRetry={load} />}
      {templates && (
        <TableCard
          title="Templates"
          subtitle="Crée et gère tes modèles d'email"
          toolbar={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un template…" />
              <button className="ds-pill-button ds-pill-button--dark" onClick={() => setShowGallery(true)}>
                + Nouveau template
              </button>
            </>
          }
        >
          {visible.length === 0 ? (
            <EmptyState title="Aucun template" description="Crée ton premier modèle d'email." />
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Sujet</th>
                  <th className="ds-num-cell">Blocs</th>
                  <th className="ds-num-cell">Modifié</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="ds-row-clickable" onClick={() => setSelected(t)}>
                    <td className="mk-name">{t.name}</td>
                    <td className="ds-muted">{t.subject || '—'}</td>
                    <td className="ds-num-cell">
                      <span className="ds-num">{formatNumber((t.blocks ?? []).length)}</span>
                    </td>
                    <td className="ds-num-cell ds-muted">{relativeTime(t.updated_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="mk-row-actions">
                        <button className="mk-action" onClick={() => setSelected(t)}>
                          Aperçu
                        </button>
                        <button className="mk-action" onClick={() => openWeb(editorPath(t.id))}>
                          Éditer ↗
                        </button>
                        <button className="mk-action" disabled={busy === t.id} onClick={() => handleDuplicate(t)}>
                          Dupliquer
                        </button>
                        <button className="mk-action mk-action--danger" disabled={busy === t.id} onClick={() => handleDelete(t)}>
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

      {showGallery && (
        <div className="lead-create-overlay" onClick={() => setShowGallery(false)}>
          <div className="lead-create-modal mk-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Choisir un point de départ</h2>
            <p className="mk-section-sub">{EMAIL_STARTERS.length} templates pré-bâtis ou pars d'une page vierge.</p>
            <div className="mk-card-grid">
              <button
                className="mk-pick-card mk-pick-card--dashed"
                onClick={() => createFrom({ name: 'Nouveau template', preset_id: 'classique', blocks: BLANK_TEMPLATE_BLOCKS() })}
              >
                <div className="mk-pick-title">Vierge</div>
                <div className="mk-pick-desc">Commence de zéro avec un seul bloc texte.</div>
              </button>
              {EMAIL_STARTERS.map((s) => (
                <button
                  key={s.id}
                  className="mk-pick-card"
                  onClick={() => createFrom({ name: s.name, subject: s.subject, preset_id: s.preset_id, blocks: s.blocks() })}
                >
                  <div className="mk-pick-title">{s.name}</div>
                  <div className="mk-pick-desc">{s.description}</div>
                </button>
              ))}
            </div>
            <div className="lead-create-actions">
              <Button variant="ghost" onClick={() => setShowGallery(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <TemplateDrawer
          template={selected}
          onClose={() => setSelected(null)}
          onSaved={(t) => {
            setSelected(t)
            load()
          }}
        />
      )}
    </>
  )
}

function TemplateDrawer({ template, onClose, onSaved }: { template: EmailTemplate; onClose: () => void; onSaved: (t: EmailTemplate) => void }) {
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject ?? '')
  const [previewText, setPreviewText] = useState(template.preview_text ?? '')
  const [html, setHtml] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(template.name)
    setSubject(template.subject ?? '')
    setPreviewText(template.preview_text ?? '')
    setHtml(null)
    setPreviewError(false)
    apiPostText('/api/emails/templates/preview', { blocks: template.blocks ?? [], preview_text: template.preview_text ?? undefined })
      .then(setHtml)
      .catch(() => setPreviewError(true))
  }, [template])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const t = await api.put<EmailTemplate>(`/api/emails/templates/${template.id}`, {
        name: name.trim() || template.name,
        subject,
        preview_text: previewText || null,
      })
      onSaved(t)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mk-drawer-wide">
      <Drawer title={template.name} onClose={onClose}>
        <div className="mk-form">
          <div className="mk-toolbar">
            <button className="mk-action mk-action--primary" onClick={() => openWeb(editorPath(template.id))}>
              Ouvrir l'éditeur de blocs ↗
            </button>
          </div>
          <div className="mk-field">
            <label>Nom</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="mk-field">
            <label>Sujet</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex : Bienvenue {{prenom}}" />
          </div>
          <div className="mk-field">
            <label>Texte de prévisualisation</label>
            <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Affiché après le sujet dans la boîte de réception" />
          </div>
          {error && <p className="lead-create-error">{error}</p>}
          <div className="lead-create-actions">
            <Button variant="primary" disabled={saving} onClick={save}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
          <div className="mk-drawer-section">Aperçu</div>
          {html ? (
            <iframe className="mk-preview-frame" sandbox="" srcDoc={html} title="Aperçu du template" />
          ) : previewError ? (
            <div className="mk-preview-empty">Aperçu indisponible</div>
          ) : (
            <LoadingState label="Compilation de l'aperçu…" />
          )}
        </div>
      </Drawer>
    </div>
  )
}
