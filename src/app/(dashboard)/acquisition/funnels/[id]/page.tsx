'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Monitor, Smartphone, Tablet, Save, Globe, Check, Undo2, Redo2, ExternalLink, Copy, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type {
  FunnelPage,
  FunnelPresetOverrideJSON,
  FunnelEffectsConfigJSON,
} from '@/types'
import FunnelPageTabs from '@/components/funnels/FunnelPageTabs'
import FunnelBuilderV2 from '@/components/funnels/v2/FunnelBuilderV2'
import { useUndoRedo } from '@/components/funnels/v2/use-undo-redo'
import { useAutosave } from '@/components/funnels/v2/use-autosave'
import {
  getDefaultPageBlocks,
  getDefaultPageBlocksForTemplate,
  type FunnelPageTemplate,
} from '@/lib/funnels/defaults'
import { useWorkspaceSlugState, buildPublicFunnelUrl } from '@/lib/funnels/use-workspace-slug'

interface FunnelData {
  id: string
  name: string
  slug: string
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
  // T-028 Phase 14 — Feedback "action effectuée" après un clic sur Publier/Dépublier.
  // `publishFeedback` contient soit 'published' soit 'unpublished' pendant 2s,
  // pour afficher le bon message vert (au lieu de toujours montrer "Publié !").
  const [publishFeedback, setPublishFeedback] = useState<'published' | 'unpublished' | null>(null)
  const [loading, setLoading] = useState(true)
  // T-028 Phase 14/16 — Slug du workspace pour construire l'URL publique.
  // `workspaceSlug` = la valeur (ou null si pas configuré)
  // `workspaceSlugFetched` = true une fois le fetch terminé (permet de
  // distinguer "en cours" de "definitivement null" pour l'UX du warning)
  const { slug: workspaceSlug, fetched: workspaceSlugFetched } = useWorkspaceSlugState()
  const [copiedUrl, setCopiedUrl] = useState(false)

  // T-028 Phase 15 — Garde anti-double-exécution pour fetchFunnel.
  // React 19 StrictMode exécute les useEffect 2x en dev, ce qui créait 2 POST
  // concurrents vers /api/funnels/[id]/pages quand on essayait de créer la
  // page par défaut Hero+Text+Footer → violation de la contrainte unique sur
  // funnel_pages(funnel_id, slug). Ce ref garantit qu'on n'essaie qu'une seule
  // fois par mount, peu importe le nombre de réinvocations de l'effet.
  const hasFetchedRef = useRef(false)

  const fetchFunnel = useCallback(async () => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    try {
      const res = await fetch(`/api/funnels/${id}`)
      if (!res.ok) {
        console.error('[FunnelBuilderPage] fetchFunnel failed:', res.status, await res.text())
        return
      }
      const json = await res.json()
      if (json.error) {
        console.error('[FunnelBuilderPage] fetchFunnel API error:', json.error)
        return
      }
      if (json.data) {
        const f = json.data as FunnelData
        setFunnel(f)
        setFunnelName(f.name)
        let pgs = Array.isArray(f.pages) ? f.pages : []

        // T-028 Phase 10 — Si le funnel n'a aucune page, en créer une auto
        // avec le squelette par défaut (Hero + Text + Footer) au lieu d'une
        // page vide. Le coach démarre toujours sur un truc qui ressemble à
        // quelque chose (validé avec Rémy le 2026-04-07).
        // T-028 Phase 15 — Protégé par `hasFetchedRef` ci-dessus pour éviter
        // les POST concurrents en StrictMode.
        if (pgs.length === 0) {
          const createRes = await fetch(`/api/funnels/${id}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Page 1',
              slug: 'page-1',
              blocks: getDefaultPageBlocks(),
            }),
          })
          if (!createRes.ok) {
            console.error(
              '[FunnelBuilderPage] create default page failed:',
              createRes.status,
              await createRes.text(),
            )
            // Re-fetch les pages existantes au cas où une autre instance
            // aurait créé la page entre-temps (défense en profondeur).
            const retryRes = await fetch(`/api/funnels/${id}`)
            if (retryRes.ok) {
              const retryJson = await retryRes.json()
              const retryPages = Array.isArray(retryJson.data?.pages) ? retryJson.data.pages : []
              if (retryPages.length > 0) {
                pgs = retryPages
              }
            }
          } else {
            const createJson = await createRes.json()
            if (createJson.error) {
              console.error('[FunnelBuilderPage] create default page API error:', createJson.error)
            } else if (createJson.data) {
              pgs = [createJson.data]
            }
          }
        }

        // Reset undo/redo history avec les pages chargées (pas un setState normal,
        // sinon le chargement initial créerait une entrée d'historique)
        resetPages(pgs)
        if (pgs.length > 0) {
          setActivePageId(pgs[0].id)
        }
      }
    } catch (err) {
      console.error('[FunnelBuilderPage] fetchFunnel unexpected error:', err)
      // Reset du flag pour permettre un retry manuel si l'erreur était réseau
      hasFetchedRef.current = false
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
    setPublishFeedback(null)

    try {
      const res = await fetch(`/api/funnels/${id}/publish`, { method: 'POST' })
      const json = await res.json()
      if (json.data) {
        const newStatus = json.data.status as 'draft' | 'published'
        setFunnel(prev => prev ? { ...prev, status: newStatus } : prev)
        // T-028 Phase 14 — Montre le bon feedback selon la nouvelle action.
        // Si on vient de passer en `draft`, le bouton montre "Dépublié ✓"
        // au lieu de "Publié ✓" comme avant (bug reporté par Rémy).
        setPublishFeedback(newStatus === 'published' ? 'published' : 'unpublished')
        setTimeout(() => setPublishFeedback(null), 2000)
      }
    } catch {
      // ignore
    } finally {
      setPublishing(false)
    }
  }, [publishing, handleSave, id])

  // T-028 Phase 14 — Copie l'URL publique du funnel dans le presse-papiers
  // et affiche un feedback "Copié !" pendant 1.5s.
  const handleCopyPublicUrl = useCallback(async () => {
    const pageSlug = pages[0]?.slug ?? null
    const url = buildPublicFunnelUrl(workspaceSlug, funnel?.slug ?? null, pageSlug)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 1500)
    } catch (err) {
      console.error('[FunnelBuilderPage] clipboard write failed:', err)
    }
  }, [workspaceSlug, funnel?.slug, pages])

  const handleAddPage = useCallback(async (template: FunnelPageTemplate = 'blank') => {
    const pageNum = pages.length + 1
    try {
      const res = await fetch(`/api/funnels/${id}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Page ${pageNum}`,
          slug: `page-${pageNum}`,
          // T-028 Phase 11 — Squelette selon le template choisi par le coach
          // via le menu du bouton "+" dans FunnelPageTabs.
          blocks: getDefaultPageBlocksForTemplate(template),
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('[FunnelBuilderPage] handleAddPage failed:', res.status, errText)
        alert(`Impossible d'ajouter la page (HTTP ${res.status}). Voir la console pour les détails.`)
        return
      }
      const json = await res.json()
      if (json.error) {
        console.error('[FunnelBuilderPage] handleAddPage API error:', json.error)
        alert(`Impossible d'ajouter la page : ${json.error}`)
        return
      }
      if (json.data) {
        // T-028b Phase 6 — useUndoRedo expose `setState(value)`, pas de callback signature.
        // On lit la valeur courante via la closure (`pages` est dans les deps).
        setPages([...pages, json.data])
        setActivePageId(json.data.id)
      }
    } catch (err) {
      console.error('[FunnelBuilderPage] handleAddPage unexpected error:', err)
      alert('Erreur réseau lors de l\'ajout de la page. Voir la console pour les détails.')
    }
  }, [id, pages, setPages])

  const handleDeletePage = useCallback(async (pageId: string) => {
    try {
      const res = await fetch(`/api/funnels/${id}/pages/${pageId}`, { method: 'DELETE' })
      if (!res.ok) {
        console.error('[FunnelBuilderPage] handleDeletePage failed:', res.status, await res.text())
        return
      }
      const updated = pages.filter((p) => p.id !== pageId)
      setPages(updated)
      if (activePageId === pageId && updated.length > 0) {
        setActivePageId(updated[0].id)
      }
    } catch (err) {
      console.error('[FunnelBuilderPage] handleDeletePage unexpected error:', err)
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

        {/* Publish / Unpublish — T-028 Phase 14 fix : feedback correct
            selon l'action effectuée (Publié ✓ vs Dépublié ✓). */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', fontSize: 12, fontWeight: 600,
            background: publishFeedback ? '#38A169' : '#E53E3E',
            color: '#fff', border: 'none', borderRadius: 8,
            cursor: publishing ? 'not-allowed' : 'pointer', flexShrink: 0,
            opacity: publishing ? 0.7 : 1,
            transition: 'all 0.2s ease',
            boxShadow: publishFeedback ? '0 0 12px rgba(56,161,105,0.3)' : '0 0 12px rgba(229,62,62,0.2)',
          }}
          onMouseEnter={e => { if (!publishing) e.currentTarget.style.opacity = '0.9' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = publishing ? '0.7' : '1' }}
        >
          <Globe size={14} />
          {publishing
            ? 'Publication...'
            : publishFeedback === 'published'
              ? 'Publié !'
              : publishFeedback === 'unpublished'
                ? 'Dépublié !'
                : funnel.status === 'published'
                  ? 'Dépublier'
                  : 'Publier'}
        </button>
      </div>

      {/* T-028 Phase 14/16 — Barre d'URL publique quand le funnel est publié.
          3 états possibles :
          - workspaceSlug pas encore chargé (hook async) → on cache la barre
          - workspaceSlug null (workspace pas configuré) → warning + lien vers /parametres/reglages
          - workspaceSlug valide + page existante → URL + boutons copier/ouvrir */}
      {funnel.status === 'published' && (() => {
        const pageSlug = pages[0]?.slug ?? null

        // Cas 1 : workspaceSlug encore en cours de chargement — on cache (évite un flash de warning)
        if (workspaceSlug === null && !workspaceSlugFetched) return null

        // Cas 2 : workspaceSlug est définitivement null (workspace sans slug configuré)
        if (!workspaceSlug) {
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px',
              background: 'rgba(214,158,46,0.08)',
              borderBottom: '1px solid rgba(214,158,46,0.2)',
              flexShrink: 0,
            }}>
              <AlertTriangle size={13} color="#D69E2E" style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: 12, color: '#D69E2E',
                flex: 1, lineHeight: 1.4,
              }}>
                <strong>Ton funnel est publié</strong>, mais il n&apos;a pas encore d&apos;URL publique car aucun slug n&apos;est défini pour ton workspace.
              </span>
              <Link
                href="/parametres/reglages"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 12px', fontSize: 11, fontWeight: 700,
                  background: '#D69E2E', color: '#0A0A0A',
                  border: 'none', borderRadius: 6,
                  textDecoration: 'none', flexShrink: 0,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}
              >
                Configurer →
              </Link>
            </div>
          )
        }

        // Cas 3 : on a le slug workspace — on peut construire l'URL
        const publicUrl = buildPublicFunnelUrl(workspaceSlug, funnel.slug, pageSlug)
        if (!publicUrl) return null
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            background: 'rgba(56,161,105,0.06)',
            borderBottom: '1px solid rgba(56,161,105,0.15)',
            flexShrink: 0,
          }}>
            <Globe size={12} color="#38A169" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#38A169',
              textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
            }}>
              En ligne
            </span>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12, color: 'var(--text-primary, #ccc)',
                fontFamily: 'monospace', textDecoration: 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1, minWidth: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary, #ccc)' }}
              title={publicUrl}
            >
              {publicUrl}
            </a>
            <button
              onClick={handleCopyPublicUrl}
              title={copiedUrl ? 'Copié !' : 'Copier l\'URL'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                background: copiedUrl ? 'rgba(56,161,105,0.15)' : 'rgba(255,255,255,0.05)',
                color: copiedUrl ? '#38A169' : 'var(--text-secondary, #888)',
                border: copiedUrl ? '1px solid rgba(56,161,105,0.3)' : '1px solid var(--border-primary, #262626)',
                borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s ease', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (!copiedUrl) e.currentTarget.style.borderColor = '#444' }}
              onMouseLeave={e => { if (!copiedUrl) e.currentTarget.style.borderColor = 'var(--border-primary, #262626)' }}
            >
              {copiedUrl ? <Check size={11} /> : <Copy size={11} />}
              {copiedUrl ? 'Copié' : 'Copier'}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Ouvrir dans un nouvel onglet"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-secondary, #888)',
                border: '1px solid var(--border-primary, #262626)',
                borderRadius: 6, flexShrink: 0,
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#ccc' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary, #262626)'; e.currentTarget.style.color = 'var(--text-secondary, #888)' }}
            >
              <ExternalLink size={11} />
              Ouvrir
            </a>
          </div>
        )
      })()}

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
