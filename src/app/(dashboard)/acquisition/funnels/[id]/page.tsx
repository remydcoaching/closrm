'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Monitor, Smartphone, Save, Globe, Check } from 'lucide-react'
import type { FunnelPage } from '@/types'
import FunnelPageTabs from '@/components/funnels/FunnelPageTabs'
import FunnelBuilder from '@/components/funnels/FunnelBuilder'

interface FunnelData {
  id: string
  name: string
  status: 'draft' | 'published'
  pages: FunnelPage[]
}

export default function FunnelBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [pages, setPages] = useState<FunnelPage[]>([])
  const [activePageId, setActivePageId] = useState<string>('')
  const [funnelName, setFunnelName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')
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
        const pgs = Array.isArray(f.pages) ? f.pages : []
        setPages(pgs)
        if (pgs.length > 0 && !activePageId) {
          setActivePageId(pgs[0].id)
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [id, activePageId])

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
        setPages(prev => [...prev, json.data])
        setActivePageId(json.data.id)
      }
    } catch {
      // ignore
    }
  }, [id, pages.length])

  const handleDeletePage = useCallback(async (pageId: string) => {
    try {
      await fetch(`/api/funnels/${id}/pages/${pageId}`, { method: 'DELETE' })
      setPages(prev => {
        const updated = prev.filter(p => p.id !== pageId)
        if (activePageId === pageId && updated.length > 0) {
          setActivePageId(updated[0].id)
        }
        return updated
      })
    } catch {
      // ignore
    }
  }, [id, activePageId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#555' }}>
        Chargement...
      </div>
    )
  }

  if (!funnel) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#555' }}>
        Funnel introuvable
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        height: 52, padding: '0 16px', flexShrink: 0,
        background: '#141414', borderBottom: '1px solid #262626',
      }}>
        {/* Back */}
        <button
          onClick={() => router.push('/acquisition/funnels')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 6,
            background: 'transparent', border: '1px solid #333',
            color: '#888', cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
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
              fontSize: 14, fontWeight: 600, color: '#fff',
              background: '#0a0a0a', border: '1px solid #333', borderRadius: 6,
              padding: '4px 10px', outline: 'none', width: 200,
            }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            style={{
              fontSize: 14, fontWeight: 600, color: '#fff',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 6, flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1a1a1a' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {funnelName}
          </button>
        )}

        {/* Separator */}
        <div style={{ width: 1, height: 24, background: '#262626', flexShrink: 0 }} />

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
        <div style={{ width: 1, height: 24, background: '#262626', flexShrink: 0 }} />

        {/* Desktop / Mobile toggle */}
        <div style={{ display: 'flex', gap: 2, background: '#0a0a0a', borderRadius: 6, padding: 2, flexShrink: 0 }}>
          <button
            onClick={() => setMode('desktop')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 28, borderRadius: 4, border: 'none',
              background: mode === 'desktop' ? '#262626' : 'transparent',
              color: mode === 'desktop' ? '#fff' : '#555',
              cursor: 'pointer', padding: 0,
            }}
          >
            <Monitor size={14} />
          </button>
          <button
            onClick={() => setMode('mobile')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 28, borderRadius: 4, border: 'none',
              background: mode === 'mobile' ? '#262626' : 'transparent',
              color: mode === 'mobile' ? '#fff' : '#555',
              cursor: 'pointer', padding: 0,
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
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            background: '#1a1a1a', color: saved ? '#38A169' : '#ccc',
            border: '1px solid #333', borderRadius: 6,
            cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saving ? 'Sauvegarde...' : saved ? 'Sauvegarde' : 'Sauvegarder'}
        </button>

        {/* Publish */}
        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            background: published ? '#38A169' : '#E53E3E',
            color: '#fff', border: 'none', borderRadius: 6,
            cursor: publishing ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          <Globe size={14} />
          {publishing ? 'Publication...' : published ? 'Publie !' : funnel.status === 'published' ? 'Depublier' : 'Publier'}
        </button>
      </div>

      {/* Builder */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <FunnelBuilder
          pages={pages}
          activePageId={activePageId}
          onPagesChange={setPages}
          mode={mode}
        />
      </div>
    </div>
  )
}
