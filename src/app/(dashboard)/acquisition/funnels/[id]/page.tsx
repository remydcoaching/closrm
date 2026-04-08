'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Monitor, Smartphone, Tablet, Save, Globe, Check, Undo2, Redo2 } from 'lucide-react'
import type {
  FunnelPage,
  FunnelPresetOverrideJSON,
  FunnelEffectsConfigJSON,
} from '@/types'
import FunnelPageTabs from '@/components/funnels/FunnelPageTabs'
import FunnelBuilderV2 from '@/components/funnels/v2/FunnelBuilderV2'
import { useUndoRedo } from '@/components/funnels/v2/use-undo-redo'
import { useAutosave } from '@/components/funnels/v2/use-autosave'

interface FunnelData {
  id: string
  name: string
  status: 'draft' | 'published'
  // T-028a/c — design system fields
  preset_id: string
  preset_override: FunnelPresetOverrideJSON | null
  effects_config: FunnelEffectsConfigJSON
  pages: FunnelPage[]
}

export default function FunnelBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  // T-028b Phase 6 — pages stockées via useUndoRedo pour Cmd+Z / Cmd+Shift+Z
  const {
    state: pages,
    setState: setPages,
    undo: undoPages,
    redo: redoPages,
    canUndo,
    canRedo,
    reset: resetPages,
  } = useUndoRedo<FunnelPage[]>([])
  const [activePageId, setActivePageId] = useState<string>('')
  const [funnelName, setFunnelName] = useState('')
  const [editingName, setEditingName] = useState(false)
  // T-028b Phase 4 — preview multi-device : desktop (1200px) / tablet (768px) / mobile (375px)
  const [mode, setMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchFunnel = useCallback(async () => {
    try {
      const res = await fetch(`/api/funnels/${id}`)
      const json = await res.json()
      if (json.data) {
        const f = json.data as FunnelData
        setFunnel(f)
        setFunnelName(f.name)
        let pgs = Array.isArray(f.pages) ? f.pages : []

        // If no pages, create a default one
        if (pgs.length === 0) {
          const createRes = await fetch(`/api/funnels/${id}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Page 1', slug: 'page-1', blocks: [] }),
          })
          const createJson = await createRes.json()
          if (createJson.data) {
            pgs = [createJson.data]
          }
        }

        // Reset undo/redo history avec les pages chargées (pas un setState normal,
        // sinon le chargement initial créerait une entrée d'historique)
        resetPages(pgs)
        if (pgs.length > 0) {
          setActivePageId(pgs[0].id)
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [id, resetPages])

  useEffect(() => { fetchFunnel() }, [fetchFunnel])

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setSaved(false)

    try {
      // Save funnel name if changed
      if (funnel && funnelName !== funnel.name) {
        await fetch(`/api/funnels/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: funnelName }),
        })
      }

      // Save all pages
      await Promise.all(pages.map(page =>
        fetch(`/api/funnels/${id}/pages/${page.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks: page.blocks, name: page.name }),
        })
      ))

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }, [saving, funnel, funnelName, id, pages])

  /**
   * T-028b — Callback appelé par le builder v2 quand le coach modifie le design
   * (preset, override couleurs, effets toggleables). PATCH le funnel en DB
   * et met à jour le state local pour que le preview se reconfigure.
   * Fire-and-forget : le design change est petit et instantané côté UX,
   * pas besoin d'autosave debounced ici (contrairement aux pages/blocks).
   */
  const handleFunnelDesignChange = useCallback(
    (changes: {
      preset_id?: string
      preset_override?: FunnelPresetOverrideJSON | null
      effects_config?: FunnelEffectsConfigJSON
    }) => {
      // Update local state immediately for snappy UX
      setFunnel((prev) => (prev ? { ...prev, ...changes } : prev))
      // PATCH backend in background
      fetch(`/api/funnels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      }).catch(() => {
        // Best-effort
      })
    },
    [id],
  )

  /**
   * T-028b Phase 6 — Autosave debounced sur les pages.
   *
   * Quand `pages` change (via setState ou via undo/redo), démarre un timer
   * de 1.5s. Si rien ne rechange entre temps, sauvegarde toutes les pages
   * en parallèle via l'API.
   *
   * Désactivé tant que `loading` ou `funnel` est null (pas de save au mount).
   */
  const autosavePages = useCallback(async (pagesToSave: FunnelPage[]) => {
    await Promise.all(
      pagesToSave.map((page) =>
        fetch(`/api/funnels/${id}/pages/${page.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks: page.blocks, name: page.name }),
        }),
      ),
    )
  }, [id])

  const { status: autosaveStatus } = useAutosave({
    value: pages,
    onSave: autosavePages,
    delayMs: 1500,
    enabled: !loading && funnel !== null,
  })

  const handlePublish = useCallback(async () => {
    if (publishing) return
    // Save first
    await handleSave()
    setPublishing(true)
    setPublished(false)

    try {
      const res = await fetch(`/api/funnels/${id}/publish`, { method: 'POST' })
      const json = await res.json()
      if (json.data) {
        setFunnel(prev => prev ? { ...prev, status: json.data.status } : prev)
        setPublished(true)
        setTimeout(() => setPublished(false), 2000)
      }
    } catch {
      // ignore
    } finally {
      setPublishing(false)
    }
  }, [publishing, handleSave, id])

  const handleAddPage = useCallback(async () => {
    const pageNum = pages.length + 1
    try {
      const res = await fetch(`/api/funnels/${id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Page ${pageNum}`,
          slug: `page-${pageNum}`,
          blocks: [],
        }),
      })
      const json = await res.json()
      if (json.data) {
        // T-028b Phase 6 — useUndoRedo expose `setState(value)`, pas de callback signature.
        // On lit la valeur courante via la closure (`pages` est dans les deps).
        setPages([...pages, json.data])
        setActivePageId(json.data.id)
      }
    } catch {
      // ignore
    }
  }, [id, pages, setPages])

  const handleDeletePage = useCallback(async (pageId: string) => {
    try {
      await fetch(`/api/funnels/${id}/pages/${pageId}`, { method: 'DELETE' })
      const updated = pages.filter((p) => p.id !== pageId)
      setPages(updated)
      if (activePageId === pageId && updated.length > 0) {
        setActivePageId(updated[0].id)
      }
    } catch {
      // ignore
    }
  }, [id, activePageId, pages, setPages])

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 16, background: 'var(--bg-primary, #0A0A0A)',
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #262626', borderTopColor: '#E53E3E',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary, #A0A0A0)', fontWeight: 500 }}>
          Chargement du funnel...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!funnel) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 12, background: 'var(--bg-primary, #0A0A0A)',
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>🔍</div>
        <span style={{ fontSize: 14, color: 'var(--text-secondary, #A0A0A0)', fontWeight: 500 }}>
          Funnel introuvable
        </span>
        <button
          onClick={() => router.push('/acquisition/funnels')}
          style={{
            marginTop: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600,
            background: 'transparent', color: '#E53E3E', border: '1px solid rgba(229,62,62,0.3)',
            borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(229,62,62,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          Retour aux funnels
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary, #0A0A0A)' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        height: 56, padding: '0 16px', flexShrink: 0,
        background: 'var(--bg-secondary, #141414)',
        borderBottom: '1px solid var(--border-primary, #262626)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Back */}
        <button
          onClick={() => router.push('/acquisition/funnels')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 8,
            background: 'transparent', border: '1px solid var(--border-primary, #262626)',
            color: 'var(--text-secondary, #A0A0A0)', cursor: 'pointer', padding: 0, flexShrink: 0,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary, #262626)'; e.currentTarget.style.color = 'var(--text-secondary, #A0A0A0)'; e.currentTarget.style.background = 'transparent' }}
        >
          <ArrowLeft size={16} />
        </button>

        {/* Funnel name (editable) */}
        {editingName ? (
          <input
            autoFocus
            value={funnelName}
            onChange={e => setFunnelName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditingName(false) }}
            style={{
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)',
              background: 'var(--bg-primary, #0a0a0a)', border: '1px solid #E53E3E',
              borderRadius: 8, padding: '6px 12px', outline: 'none', width: 220,
              transition: 'border-color 0.2s ease',
            }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            style={{
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '6px 10px', borderRadius: 8, flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {funnelName}
          </button>
        )}

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: 'var(--border-primary, #262626)', flexShrink: 0 }} />

        {/* Page tabs */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <FunnelPageTabs
            pages={pages}
            activePageId={activePageId}
            onSelectPage={setActivePageId}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
          />
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: 'var(--border-primary, #262626)', flexShrink: 0 }} />

        {/* Undo / Redo buttons — T-028b Phase 6 */}
        <div style={{
          display: 'flex', gap: 2, background: 'var(--bg-primary, #0a0a0a)',
          borderRadius: 8, padding: 3, flexShrink: 0,
          border: '1px solid var(--border-primary, #262626)',
        }}>
          <button
            onClick={undoPages}
            disabled={!canUndo}
            title="Annuler (Cmd+Z)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 28, borderRadius: 6, border: 'none',
              background: 'transparent',
              color: canUndo ? 'var(--text-primary, #ccc)' : 'rgba(255,255,255,0.2)',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              padding: 0, transition: 'all 0.2s ease',
            }}
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redoPages}
            disabled={!canRedo}
            title="Refaire (Cmd+Shift+Z)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 28, borderRadius: 6, border: 'none',
              background: 'transparent',
              color: canRedo ? 'var(--text-primary, #ccc)' : 'rgba(255,255,255,0.2)',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              padding: 0, transition: 'all 0.2s ease',
            }}
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* Autosave status indicator — T-028b Phase 6 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 8px', fontSize: 11, color: 'var(--text-secondary, #888)',
          flexShrink: 0, minWidth: 90,
        }}>
          {autosaveStatus === 'pending' && (
            <>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#D69E2E',
              }} />
              <span>Modifs...</span>
            </>
          )}
          {autosaveStatus === 'saving' && (
            <>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#3B82F6', animation: 'fnl-builder-pulse 1s ease-in-out infinite',
              }} />
              <span>Sauvegarde...</span>
            </>
          )}
          {autosaveStatus === 'saved' && (
            <>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#38A169',
              }} />
              <span>Sauvegardé</span>
            </>
          )}
          {autosaveStatus === 'error' && (
            <>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#E53E3E',
              }} />
              <span>Erreur de save</span>
            </>
          )}
        </div>

        {/* Device toggle (Desktop / Tablet / Mobile) — T-028b Phase 4 */}
        <div style={{
          display: 'flex', gap: 2, background: 'var(--bg-primary, #0a0a0a)',
          borderRadius: 8, padding: 3, flexShrink: 0,
          border: '1px solid var(--border-primary, #262626)',
        }}>
          <button
            onClick={() => setMode('desktop')}
            title="Desktop (1200px)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 28, borderRadius: 6, border: 'none',
              background: mode === 'desktop' ? 'rgba(229,62,62,0.15)' : 'transparent',
              color: mode === 'desktop' ? '#E53E3E' : 'var(--text-secondary, #555)',
              cursor: 'pointer', padding: 0, transition: 'all 0.2s ease',
            }}
          >
            <Monitor size={14} />
          </button>
          <button
            onClick={() => setMode('tablet')}
            title="Tablet (768px)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 28, borderRadius: 6, border: 'none',
              background: mode === 'tablet' ? 'rgba(229,62,62,0.15)' : 'transparent',
              color: mode === 'tablet' ? '#E53E3E' : 'var(--text-secondary, #555)',
              cursor: 'pointer', padding: 0, transition: 'all 0.2s ease',
            }}
          >
            <Tablet size={14} />
          </button>
          <button
            onClick={() => setMode('mobile')}
            title="Mobile (375px)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 28, borderRadius: 6, border: 'none',
              background: mode === 'mobile' ? 'rgba(229,62,62,0.15)' : 'transparent',
              color: mode === 'mobile' ? '#E53E3E' : 'var(--text-secondary, #555)',
              cursor: 'pointer', padding: 0, transition: 'all 0.2s ease',
            }}
          >
            <Smartphone size={14} />
          </button>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', fontSize: 12, fontWeight: 600,
            background: saved ? 'rgba(56,161,105,0.1)' : 'rgba(255,255,255,0.04)',
            color: saved ? '#38A169' : 'var(--text-primary, #ccc)',
            border: saved ? '1px solid rgba(56,161,105,0.3)' : '1px solid var(--border-primary, #262626)',
            borderRadius: 8,
            cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0,
            opacity: saving ? 0.6 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.borderColor = '#444' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = saved ? 'rgba(56,161,105,0.3)' : 'var(--border-primary, #262626)' }}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé' : 'Sauvegarder'}
        </button>

        {/* Publish */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', fontSize: 12, fontWeight: 600,
            background: published ? '#38A169' : '#E53E3E',
            color: '#fff', border: 'none', borderRadius: 8,
            cursor: publishing ? 'not-allowed' : 'pointer', flexShrink: 0,
            opacity: publishing ? 0.7 : 1,
            transition: 'all 0.2s ease',
            boxShadow: published ? '0 0 12px rgba(56,161,105,0.3)' : '0 0 12px rgba(229,62,62,0.2)',
          }}
          onMouseEnter={e => { if (!publishing) e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = publishing ? '0.7' : '1' }}
        >
          <Globe size={14} />
          {publishing ? 'Publication...' : published ? 'Publié !' : funnel.status === 'published' ? 'Dépublier' : 'Publier'}
        </button>
      </div>

      {/* Builder v2 (T-028b) — l'ancien `<FunnelBuilder>` reste sur disque
          jusqu'à la Phase 8 de T-028b où on le supprimera proprement. */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FunnelBuilderV2
          funnel={funnel}
          pages={pages}
          activePageId={activePageId}
          onPagesChange={setPages}
          onFunnelDesignChange={handleFunnelDesignChange}
          mode={mode}
        />
      </div>
    </div>
  )
}
