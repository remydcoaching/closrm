'use client'

import { useState, useRef } from 'react'
import { X, Loader2, Plus, AtSign } from 'lucide-react'
import { createLeadSchema } from '@/lib/validations/leads'
import { Lead, LeadSource } from '@/types'
import { WorkflowInlineStep, WORKFLOW_TEMPLATES_BY_SOURCE } from '@/lib/leads/workflow-templates'
import InlineWorkflowEditor from './InlineWorkflowEditor'

interface LeadFormProps {
  onClose: () => void
  onCreated: (lead: Lead) => void
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const,
  padding: '8px 12px',
  background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
}

const labelStyle = { fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 5, display: 'block' }

export default function LeadForm({ onClose, onCreated }: LeadFormProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tagInput, setTagInput] = useState('')
  const [workflowEnabled, setWorkflowEnabled] = useState(false)
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowInlineStep[]>([])
  const firstNameRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    instagram_handle: '',
    source: 'manuel' as LeadSource,
    tags: [] as string[],
    notes: '',
  })

  function set(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // When source changes and workflow steps are empty, pre-fill from templates
      if (field === 'source' && workflowEnabled && workflowSteps.length === 0) {
        const templates = WORKFLOW_TEMPLATES_BY_SOURCE[value] ?? []
        setWorkflowSteps([...templates])
      }
      return next
    })
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
  }

  function handleInstagramChange(value: string) {
    const cleaned = value.replace(/^@/, '')
    setForm(prev => {
      const next = { ...prev, instagram_handle: cleaned }
      if (cleaned && prev.source === 'manuel') {
        next.source = 'instagram_ads'
        if (workflowEnabled && workflowSteps.length === 0) {
          const templates = WORKFLOW_TEMPLATES_BY_SOURCE['instagram_ads'] ?? []
          setWorkflowSteps([...templates])
        }
      }
      if (!cleaned && (prev.source === 'follow_ads' || prev.source === 'instagram_ads')) {
        next.source = 'manuel'
      }
      return next
    })
    if (errors.instagram_handle) setErrors(prev => { const e = { ...prev }; delete e.instagram_handle; return e })
  }

  function toggleWorkflow() {
    const next = !workflowEnabled
    setWorkflowEnabled(next)
    if (next && workflowSteps.length === 0) {
      const templates = WORKFLOW_TEMPLATES_BY_SOURCE[form.source] ?? []
      setWorkflowSteps([...templates])
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !form.tags.includes(t)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, t] }))
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  async function submitForm(continueMode: boolean) {
    const parsed = createLeadSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      parsed.error.issues.forEach(i => {
        if (i.path[0]) fieldErrors[String(i.path[0])] = i.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const payload: Record<string, unknown> = { ...parsed.data }
      if (workflowSteps.length > 0) {
        payload.inline_workflow = { steps: workflowSteps }
      }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrors({ general: json.error?.formErrors?.[0] ?? 'Erreur lors de la creation.' })
        return
      }
      onCreated(json.data)

      if (continueMode) {
        // Reset form but keep source and workflow toggle
        setForm(prev => ({
          first_name: '',
          last_name: '',
          phone: '',
          email: '',
          instagram_handle: '',
          source: prev.source,
          tags: [],
          notes: '',
        }))
        setTagInput('')
        setErrors({})
        // Reset workflow steps for next lead
        setWorkflowSteps([])
        // Focus first name input
        setTimeout(() => firstNameRef.current?.focus(), 50)
      } else {
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submitForm(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
        borderRadius: 14, padding: 28, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Ajouter un lead</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Prenom</label>
              <input ref={firstNameRef} style={{ ...inputStyle, borderColor: errors.first_name ? '#ef4444' : 'var(--border-primary)' }}
                value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Jean" />
              {errors.first_name && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.first_name}</p>}
            </div>
            <div>
              <label style={labelStyle}>Nom</label>
              <input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Dupont" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Telephone</label>
            <input style={inputStyle} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+33 6 00 00 00 00" />
          </div>

          <div>
            <label style={labelStyle}>Email</label>
            <input style={{ ...inputStyle, borderColor: errors.email ? '#ef4444' : 'var(--border-primary)' }}
              type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jean@exemple.fr" />
            {errors.email && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.email}</p>}
          </div>

          {/* Instagram Handle */}
          <div>
            <label style={labelStyle}>Pseudo Instagram</label>
            <div style={{ position: 'relative' }}>
              <AtSign size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                style={{ ...inputStyle, paddingLeft: 30, borderColor: errors.instagram_handle ? '#ef4444' : 'var(--border-primary)' }}
                value={form.instagram_handle}
                onChange={e => handleInstagramChange(e.target.value)}
                placeholder="nom.utilisateur"
              />
            </div>
            {errors.instagram_handle && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{errors.instagram_handle}</p>}
          </div>

          <div>
            <label style={labelStyle}>Source</label>
            <select value={form.source} onChange={e => set('source', e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="manuel">Manuel</option>
              <option value="facebook_ads">Facebook Ads</option>
              <option value="instagram_ads">Instagram Ads</option>
              <option value="follow_ads">Follow Ads</option>
              <option value="formulaire">Formulaire</option>
              <option value="funnel">Funnel</option>
            </select>
          </div>

          {/* Relances */}
          <InlineWorkflowEditor
            source={form.source}
            steps={workflowSteps}
            onStepsChange={setWorkflowSteps}
          />

          <div>
            <label style={labelStyle}>Tags</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {form.tags.map(tag => (
                <span key={tag} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 99, fontSize: 11,
                  background: 'rgba(0,200,83,0.10)', color: 'var(--color-primary)', border: '1px solid rgba(0,200,83,0.20)',
                }}>
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 0, lineHeight: 1 }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="chaud, vip, referral..." />
              <button type="button" onClick={addTag} style={{
                padding: '8px 12px', background: 'var(--border-primary)',
                border: '1px solid var(--border-primary)', borderRadius: 8,
                color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={3} placeholder="Notes libres sur ce lead..."
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {errors.general && (
            <p style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8 }}>
              {errors.general}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--border-primary)', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
            }}>
              Annuler
            </button>
            <button type="button" disabled={loading} onClick={() => submitForm(true)} style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: '1px solid var(--border-primary)', background: 'transparent',
              color: 'var(--text-primary)', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Ajouter et continuer
            </button>
            <button type="submit" disabled={loading} style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: loading ? 'rgba(0,200,83,0.5)' : 'var(--color-primary)', border: 'none',
              color: '#000', cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
