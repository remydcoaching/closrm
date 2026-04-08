'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, ChevronLeft, ChevronRight, Loader2, RefreshCw, Brain, Check, ChevronDown } from 'lucide-react'
import { AiCoachBrief } from '@/types'
import LeadMagnetEditor from '@/components/ai/LeadMagnetEditor'

// ─── Types ──────────────────────────────────────────────────────────────────

type Tone = 'tu' | 'vous' | 'mixed'
type Goal = 'book_call' | 'sell_dm' | 'both'

interface WizardAnswers {
  offer_description: string
  target_audience: string
  tone: Tone
  approach: string
  example_messages: string
  lead_magnets: string
  goal: Goal
  api_key: string
}

const APPROACH_OPTIONS = [
  { id: 'free_content', label: 'Contenu gratuit (lead magnet, masterclass...)' },
  { id: 'questions', label: 'Questions sur les objectifs du prospect' },
  { id: 'direct_call', label: 'Proposition directe d\'un appel' },
  { id: 'mix', label: 'Mix des approches' },
]

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  borderRadius: 12,
  padding: 24,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '12px 14px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  lineHeight: 1.6,
  transition: 'border-color 0.2s ease',
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 28px',
  background: '#E53E3E',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  transition: 'opacity 0.15s ease, transform 0.1s ease',
}

const secondaryBtn: React.CSSProperties = {
  padding: '12px 24px',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  transition: 'all 0.15s ease',
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AiSettingsClient() {
  const [brief, setBrief] = useState<AiCoachBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBrief = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/brief')
      if (!res.ok) throw new Error('Erreur chargement')
      const json = await res.json()
      setBrief(json.data)
    } catch {
      setError('Impossible de charger la configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBrief()
  }, [fetchBrief])

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <Sparkles size={22} color="#E53E3E" />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Assistant IA
        </h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 32 }}>
        Configurez votre assistant pour qu&apos;il comprenne votre offre et propose des messages de relance personnalises.
      </p>

      {brief?.generated_brief ? (
        <EditView brief={brief} onUpdate={fetchBrief} />
      ) : (
        <WizardView existingBrief={brief} onComplete={fetchBrief} />
      )}
    </div>
  )
}

// ─── Wizard View (Onboarding) ───────────────────────────────────────────────

function WizardView({ existingBrief, onComplete }: { existingBrief: AiCoachBrief | null; onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [answers, setAnswers] = useState<WizardAnswers>({
    offer_description: existingBrief?.offer_description || '',
    target_audience: existingBrief?.target_audience || '',
    tone: existingBrief?.tone || 'tu',
    approach: existingBrief?.approach || '',
    example_messages: existingBrief?.example_messages || '',
    lead_magnets: existingBrief?.lead_magnets || '',
    goal: existingBrief?.goal || 'book_call',
    api_key: existingBrief?.api_key || '',
  })

  const steps = [
    { title: 'Votre offre', description: 'Decrivez votre offre principale en quelques phrases.' },
    { title: 'Votre cible', description: 'Qui sont vos prospects ideaux ?' },
    { title: 'Votre ton', description: 'Comment vous adressez-vous a vos prospects ?' },
    { title: 'Votre approche', description: 'Comment abordez-vous la conversation avec un nouveau lead ?' },
    { title: 'Exemples de messages', description: 'Collez 2-3 messages que vous envoyez habituellement a vos prospects.' },
    { title: 'Vos contenus', description: 'Listez vos lead magnets, videos, ressources que vous partagez a vos prospects. Un par ligne.' },
    { title: 'Votre objectif', description: 'Que voulez-vous accomplir avec vos messages ?' },
    { title: 'Cle API Claude', description: 'Entrez votre cle API Anthropic pour activer l\'assistant IA. Obtenez-la sur console.anthropic.com' },
  ]

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return answers.offer_description.trim().length > 0
      case 1: return answers.target_audience.trim().length > 0
      case 2: return true
      case 3: return answers.approach.trim().length > 0
      case 4: return true
      case 5: return true
      case 6: return true
      case 7: return answers.api_key.trim().length > 10
      default: return false
    }
  }

  async function handleGenerate() {
    setSaving(true)
    try {
      const res = await fetch('/api/ai/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      if (!res.ok) throw new Error('Erreur')
      onComplete()
    } catch {
      alert('Erreur lors de la generation du brief')
    } finally {
      setSaving(false)
    }
  }

  function updateAnswer<K extends keyof WizardAnswers>(key: K, value: WizardAnswers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  const toggleApproach = (id: string) => {
    const current = answers.approach.split(',').filter(Boolean)
    const updated = current.includes(id)
      ? current.filter(a => a !== id)
      : [...current, id]
    updateAnswer('approach', updated.join(','))
  }

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? '#E53E3E' : 'var(--border-primary)',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Etape {step + 1} sur {steps.length}
        </span>
      </div>

      {/* Step content */}
      <div style={{ ...cardStyle, minHeight: 300 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
            {steps[step].title}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0 }}>
            {steps[step].description}
          </p>
        </div>

        {/* Step 0 — Offer */}
        {step === 0 && (
          <textarea
            value={answers.offer_description}
            onChange={e => updateAnswer('offer_description', e.target.value)}
            placeholder="Coaching perte de poids 12 semaines, accompagnement personnalise avec suivi nutritionnel et sportif..."
            rows={5}
            style={{ ...inputStyle, resize: 'vertical' as const }}
            autoFocus
          />
        )}

        {/* Step 1 — Target */}
        {step === 1 && (
          <textarea
            value={answers.target_audience}
            onChange={e => updateAnswer('target_audience', e.target.value)}
            placeholder="Hommes 25-45 ans, sedentaires, qui veulent perdre 10-20kg et reprendre confiance en eux..."
            rows={5}
            style={{ ...inputStyle, resize: 'vertical' as const }}
            autoFocus
          />
        )}

        {/* Step 2 — Tone */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { value: 'tu' as Tone, label: 'Tutoiement', desc: '"Salut ! Comment tu vas ?"' },
              { value: 'vous' as Tone, label: 'Vouvoiement', desc: '"Bonjour, comment allez-vous ?"' },
              { value: 'mixed' as Tone, label: 'Ca depend', desc: 'Le ton s\'adapte selon le contexte' },
            ]).map(opt => {
              const active = answers.tone === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => updateAnswer('tone', opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: 12,
                    border: active ? '2px solid #E53E3E' : '1px solid var(--border-primary)',
                    background: active ? 'rgba(229,62,62,0.06)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: active ? '2px solid #E53E3E' : '2px solid var(--border-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}>
                    {active && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E53E3E' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: active ? '#E53E3E' : 'var(--text-primary)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {opt.desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 3 — Approach */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {APPROACH_OPTIONS.map(opt => {
              const active = answers.approach.split(',').includes(opt.id)
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleApproach(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: 12,
                    border: active ? '2px solid #E53E3E' : '1px solid var(--border-primary)',
                    background: active ? 'rgba(229,62,62,0.06)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: active ? '2px solid #E53E3E' : '2px solid var(--border-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    background: active ? '#E53E3E' : 'transparent',
                    transition: 'all 0.2s ease',
                  }}>
                    {active && <Check size={14} color="#fff" />}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: active ? '#E53E3E' : 'var(--text-primary)' }}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 4 — Example messages */}
        {step === 4 && (
          <textarea
            value={answers.example_messages}
            onChange={e => updateAnswer('example_messages', e.target.value)}
            placeholder={"Salut [prenom] ! J'ai vu que tu t'etais inscrit(e) pour la masterclass...\n\nHey ! Tu as eu le temps de regarder la video ?\n\nSuper, on planifie un appel pour en discuter ?"}
            rows={8}
            style={{ ...inputStyle, resize: 'vertical' as const }}
            autoFocus
          />
        )}

        {/* Step 5 — Lead Magnets */}
        {step === 5 && (
          <LeadMagnetEditor
            value={answers.lead_magnets}
            onChange={(val) => updateAnswer('lead_magnets', val)}
          />
        )}

        {/* Step 6 — Goal */}
        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { value: 'book_call' as Goal, label: 'Booker un appel', desc: 'L\'objectif est de planifier un appel de setting ou closing' },
              { value: 'sell_dm' as Goal, label: 'Vendre en DM', desc: 'Conclure la vente directement par messages' },
              { value: 'both' as Goal, label: 'Les deux', desc: 'Selon le contexte, booker un appel ou vendre en DM' },
            ]).map(opt => {
              const active = answers.goal === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => updateAnswer('goal', opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: 12,
                    border: active ? '2px solid #E53E3E' : '1px solid var(--border-primary)',
                    background: active ? 'rgba(229,62,62,0.06)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: active ? '2px solid #E53E3E' : '2px solid var(--border-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}>
                    {active && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E53E3E' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: active ? '#E53E3E' : 'var(--text-primary)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {opt.desc}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 7 — API Key */}
        {step === 7 && (
          <div>
            <input
              type="password"
              value={answers.api_key}
              onChange={e => updateAnswer('api_key', e.target.value)}
              placeholder="sk-ant-api03-..."
              style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
              Creez un compte sur <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'none' }}>console.anthropic.com</a>, puis allez dans Settings &gt; API Keys pour generer votre cle. Votre cle est stockee de facon securisee et utilisee uniquement pour generer des suggestions.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          style={{
            ...secondaryBtn,
            opacity: step === 0 ? 0.3 : 1,
            cursor: step === 0 ? 'default' : 'pointer',
          }}
        >
          <ChevronLeft size={16} />
          Precedent
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
            style={{
              ...primaryBtn,
              opacity: canProceed() ? 1 : 0.4,
              cursor: canProceed() ? 'pointer' : 'default',
            }}
          >
            Suivant
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={saving}
            style={{
              ...primaryBtn,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Generation en cours...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generer mon brief
              </>
            )}
          </button>
        )}
      </div>

      {/* Inline keyframes for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Edit View (Brief exists) ───────────────────────────────────────────────

function EditView({ brief, onUpdate }: { brief: AiCoachBrief; onUpdate: () => void }) {
  const [generatedBrief, setGeneratedBrief] = useState(brief.generated_brief || '')
  const [saving, setSaving] = useState(false)
  const [learning, setLearning] = useState(false)
  const [learnResult, setLearnResult] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  // Editable fields
  const [offer, setOffer] = useState(brief.offer_description || '')
  const [target, setTarget] = useState(brief.target_audience || '')
  const [tone, setTone] = useState<Tone>(brief.tone)
  const [approach, setApproach] = useState(brief.approach || '')
  const [examples, setExamples] = useState(brief.example_messages || '')
  const [leadMagnets, setLeadMagnets] = useState(brief.lead_magnets || '')
  const [goal, setGoal] = useState<Goal>(brief.goal)
  const [editApiKey, setEditApiKey] = useState(brief.api_key || '')

  async function handleRegenerate() {
    setSaving(true)
    try {
      const res = await fetch('/api/ai/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_description: offer,
          target_audience: target,
          tone,
          approach,
          example_messages: examples,
          lead_magnets: brief.lead_magnets || '',
          goal,
          api_key: editApiKey || brief.api_key,
        }),
      })
      if (!res.ok) throw new Error('Erreur')
      const json = await res.json()
      setGeneratedBrief(json.data.generated_brief || '')
      onUpdate()
    } catch {
      alert('Erreur lors de la regeneration')
    } finally {
      setSaving(false)
    }
  }

  async function handleLearn() {
    setLearning(true)
    setLearnResult(null)
    try {
      // Step 1: Scan existing closed leads for winning conversations
      const scanRes = await fetch('/api/ai/scan-wins', { method: 'POST' })
      const scanJson = scanRes.ok ? await scanRes.json() : null
      const scanned = scanJson?.data?.recorded || 0

      // Step 2: Analyze winning conversations and update brief
      const res = await fetch('/api/ai/learn', { method: 'POST' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        if (scanned > 0) {
          setLearnResult(`${scanned} conversation(s) importee(s), mais pas assez pour analyser. Continuez a closer !`)
          return
        }
        throw new Error(json?.error || 'Erreur')
      }
      const json = await res.json()
      setLearnResult(`${scanned > 0 ? `${scanned} nouvelle(s) conversation(s) importee(s). ` : ''}Brief mis a jour a partir de ${json.data.wins_analyzed} conversation(s) gagnante(s).`)
      onUpdate()
    } catch (err) {
      setLearnResult(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLearning(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  const toneLabel = { tu: 'Tutoiement', vous: 'Vouvoiement', mixed: 'Adaptatif' }
  const goalLabel = { book_call: 'Booker un appel', sell_dm: 'Vendre en DM', both: 'Les deux' }

  const sections: { id: string; label: string; content: React.ReactNode }[] = [
    {
      id: 'offer',
      label: 'Offre',
      content: (
        <textarea
          value={offer}
          onChange={e => setOffer(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      ),
    },
    {
      id: 'target',
      label: 'Cible',
      content: (
        <textarea
          value={target}
          onChange={e => setTarget(e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      ),
    },
    {
      id: 'tone',
      label: `Ton : ${toneLabel[tone]}`,
      content: (
        <div style={{ display: 'flex', gap: 8 }}>
          {(['tu', 'vous', 'mixed'] as Tone[]).map(t => (
            <button
              key={t}
              onClick={() => setTone(t)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: tone === t ? '2px solid #E53E3E' : '1px solid var(--border-primary)',
                background: tone === t ? 'rgba(229,62,62,0.08)' : 'var(--bg-input)',
                color: tone === t ? '#E53E3E' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {toneLabel[t]}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'approach',
      label: 'Approche',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {APPROACH_OPTIONS.map(opt => {
            const active = approach.split(',').includes(opt.id)
            return (
              <button
                key={opt.id}
                onClick={() => {
                  const current = approach.split(',').filter(Boolean)
                  const updated = active ? current.filter(a => a !== opt.id) : [...current, opt.id]
                  setApproach(updated.join(','))
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 10,
                  border: active ? '2px solid #E53E3E' : '1px solid var(--border-primary)',
                  background: active ? 'rgba(229,62,62,0.06)' : 'var(--bg-input)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: active ? '2px solid #E53E3E' : '2px solid var(--border-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? '#E53E3E' : 'transparent',
                  flexShrink: 0, transition: 'all 0.15s ease',
                }}>
                  {active && <Check size={12} color="#fff" />}
                </div>
                <span style={{ fontSize: 13, color: active ? '#E53E3E' : 'var(--text-primary)' }}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      ),
    },
    {
      id: 'examples',
      label: 'Exemples de messages',
      content: (
        <textarea
          value={examples}
          onChange={e => setExamples(e.target.value)}
          rows={5}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      ),
    },
    {
      id: 'lead_magnets',
      label: 'Mes contenus / lead magnets',
      content: (
        <LeadMagnetEditor
          value={leadMagnets}
          onChange={setLeadMagnets}
        />
      ),
    },
    {
      id: 'goal',
      label: `Objectif : ${goalLabel[goal]}`,
      content: (
        <div style={{ display: 'flex', gap: 8 }}>
          {(['book_call', 'sell_dm', 'both'] as Goal[]).map(g => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: goal === g ? '2px solid #E53E3E' : '1px solid var(--border-primary)',
                background: goal === g ? 'rgba(229,62,62,0.08)' : 'var(--bg-input)',
                color: goal === g ? '#E53E3E' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {goalLabel[g]}
            </button>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Generated brief */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            Brief genere
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: 'rgba(229,62,62,0.1)', color: '#E53E3E',
          }}>
            <Sparkles size={12} />
            IA
          </div>
        </div>
        <textarea
          value={generatedBrief}
          onChange={e => setGeneratedBrief(e.target.value)}
          rows={8}
          style={{ ...inputStyle, resize: 'vertical' as const, fontSize: 13, lineHeight: 1.7 }}
        />
      </div>

      {/* Editable sections (accordion) */}
      <div style={cardStyle}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--text-label)',
          letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 14,
        }}>
          Configuration
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sections.map(section => (
            <div key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: expandedSection === section.id ? 'var(--bg-hover)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {section.label}
                </span>
                <ChevronDown
                  size={16}
                  color="var(--text-muted)"
                  style={{
                    transform: expandedSection === section.id ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>
              {expandedSection === section.id && (
                <div style={{ padding: '8px 14px 14px' }}>
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Cle API Claude</div>
        <input
          type="password"
          value={editApiKey}
          onChange={e => setEditApiKey(e.target.value)}
          placeholder="sk-ant-api03-..."
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13, marginBottom: 8 }}
        />
        {editApiKey !== (brief.api_key || '') && (
          <button onClick={async () => {
            await fetch('/api/ai/brief', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...brief, api_key: editApiKey }),
            })
          }} style={{ ...primaryBtn, padding: '8px 16px', fontSize: 12 }}>
            Sauvegarder la cle
          </button>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          Obtenez votre cle sur <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'none' }}>console.anthropic.com</a>
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleRegenerate}
          disabled={saving}
          style={{
            ...primaryBtn,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? 'default' : 'pointer',
          }}
        >
          {saving ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Regeneration...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Regenerer le brief
            </>
          )}
        </button>

        <button
          onClick={handleLearn}
          disabled={learning}
          style={{
            ...secondaryBtn,
            opacity: learning ? 0.6 : 1,
            cursor: learning ? 'default' : 'pointer',
          }}
        >
          {learning ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Analyse en cours...
            </>
          ) : (
            <>
              <Brain size={16} />
              Analyser mes conversations gagnantes
            </>
          )}
        </button>
      </div>

      {learnResult && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 10,
          background: learnResult.includes('Erreur') || learnResult.includes('Aucune')
            ? 'rgba(239,68,68,0.08)'
            : 'rgba(56,161,105,0.08)',
          border: `1px solid ${learnResult.includes('Erreur') || learnResult.includes('Aucune') ? 'rgba(239,68,68,0.2)' : 'rgba(56,161,105,0.2)'}`,
          fontSize: 13,
          color: learnResult.includes('Erreur') || learnResult.includes('Aucune') ? '#ef4444' : '#38A169',
        }}>
          {learnResult}
        </div>
      )}

      {/* Stats */}
      {brief.wins_analyzed > 0 && (
        <div style={{
          ...cardStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
        }}>
          <Brain size={18} color="var(--text-muted)" />
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{brief.wins_analyzed}</strong> conversation(s) analysee(s) pour affiner votre brief
          </span>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
