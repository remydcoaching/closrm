// Paramètres › Assistant IA — port of parametres/assistant-ia/ai-settings-client.tsx.
// Wizard (7 steps) when no generated brief, edit view otherwise.
// Endpoints: GET/POST /api/ai/brief (POST regenerates the brief), POST /api/ai/learn.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api-client'
import { Input, Textarea } from '../../design-system/Input'
import { Chips } from '../../design-system/Tabs'
import { StatCard, StatGrid } from '../../design-system/StatCard'
import { ErrorState, LoadingState } from '../../design-system/States'
import { Field, NoticeBanner, useNotice } from '../social/ui'
import { errMsg } from '../social/http'
import '../social/social.css'

type Tone = 'tu' | 'vous' | 'mixed'
type Goal = 'book_call' | 'sell_dm' | 'both'

interface AiCoachBrief {
  id: string
  offer_description: string | null
  target_audience: string | null
  tone: Tone
  approach: string | null
  example_messages: string | null
  goal: Goal
  api_key: string | null
  generated_brief: string | null
  wins_analyzed: number
  updated_at: string
}

interface Answers {
  offer_description: string
  target_audience: string
  tone: Tone
  approach: string
  example_messages: string
  goal: Goal
  api_key: string
}

const APPROACH_OPTIONS = [
  { id: 'free_content', label: 'Contenu gratuit (lead magnet, masterclass…)' },
  { id: 'questions', label: 'Questions sur les objectifs du prospect' },
  { id: 'direct_call', label: "Proposition directe d'un appel" },
  { id: 'mix', label: 'Mix des approches' },
]
const TONES: { value: Tone; label: string; desc: string }[] = [
  { value: 'tu', label: 'Tutoiement', desc: '« Salut ! Comment tu vas ? »' },
  { value: 'vous', label: 'Vouvoiement', desc: '« Bonjour, comment allez-vous ? »' },
  { value: 'mixed', label: 'Ça dépend', desc: "Le ton s'adapte selon le contexte" },
]
const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: 'book_call', label: 'Booker un appel', desc: 'Planifier un appel de setting ou closing' },
  { value: 'sell_dm', label: 'Vendre en DM', desc: 'Conclure la vente directement par messages' },
  { value: 'both', label: 'Les deux', desc: 'Selon le contexte' },
]
const STEPS = [
  { title: 'Votre offre', description: 'Décrivez votre offre principale en quelques phrases.' },
  { title: 'Votre cible', description: 'Qui sont vos prospects idéaux ?' },
  { title: 'Votre ton', description: 'Comment vous adressez-vous à vos prospects ?' },
  { title: 'Votre approche', description: 'Comment abordez-vous la conversation avec un nouveau lead ?' },
  { title: 'Exemples de messages', description: 'Collez 2-3 messages que vous envoyez habituellement à vos prospects.' },
  { title: 'Votre objectif', description: 'Que voulez-vous accomplir avec vos messages ?' },
  { title: 'Clé API Claude', description: "Entrez votre clé API Anthropic (console.anthropic.com › Settings › API Keys) pour activer l'assistant." },
]

function fromBrief(b: AiCoachBrief | null): Answers {
  return {
    offer_description: b?.offer_description ?? '',
    target_audience: b?.target_audience ?? '',
    tone: b?.tone ?? 'tu',
    approach: b?.approach ?? '',
    example_messages: b?.example_messages ?? '',
    goal: b?.goal ?? 'book_call',
    api_key: b?.api_key ?? '',
  }
}

export function AiAssistantPage() {
  const [brief, setBrief] = useState<AiCoachBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, notify, clearNotice] = useNotice()

  const load = useCallback(async () => {
    setError(null)
    try {
      const r = await api.get<{ data: AiCoachBrief | null }>('/api/ai/brief')
      setBrief(r.data)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="soc-page">
      <header className="soc-header">
        <div>
          <h1>Assistant IA</h1>
          <p>Configurez votre assistant pour qu'il comprenne votre offre et propose des messages de relance personnalisés.</p>
        </div>
      </header>
      <NoticeBanner notice={notice} onClose={clearNotice} />
      {brief?.generated_brief ? (
        <EditView brief={brief} notify={notify} onUpdated={() => void load()} />
      ) : (
        <Wizard existing={brief} notify={notify} onDone={() => void load()} />
      )}
    </div>
  )
}

function ApproachPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = value.split(',').filter(Boolean)
  return (
    <div className="soc-stack" style={{ gap: 6 }}>
      {APPROACH_OPTIONS.map((o) => (
        <label key={o.id} className="soc-row" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selected.includes(o.id)}
            onChange={() => onChange((selected.includes(o.id) ? selected.filter((s) => s !== o.id) : [...selected, o.id]).join(','))}
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

function OptionList<T extends string>({ options, value, onChange }: { options: { value: T; label: string; desc: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="soc-stack" style={{ gap: 6 }}>
      {options.map((o) => (
        <label key={o.value} className="soc-row" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
          <input type="radio" checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            <strong>{o.label}</strong>
            <br />
            <span className="soc-muted">{o.desc}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function Wizard({ existing, notify, onDone }: { existing: AiCoachBrief | null; notify: (t: string, tone?: 'success' | 'danger') => void; onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Answers>(() => fromBrief(existing))
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((prev) => ({ ...prev, [k]: v }))

  const canProceed = (() => {
    switch (step) {
      case 0:
        return a.offer_description.trim().length > 0
      case 1:
        return a.target_audience.trim().length > 0
      case 3:
        return a.approach.trim().length > 0
      case 6:
        return a.api_key.trim().length > 10
      default:
        return true
    }
  })()

  async function generate() {
    setSaving(true)
    try {
      await api.post('/api/ai/brief', a)
      notify('Brief généré')
      onDone()
    } catch (e) {
      notify(`Erreur lors de la génération du brief : ${errMsg(e)}`, 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="soc-card" style={{ maxWidth: 720 }}>
      <div className="soc-bar">
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <span className="soc-muted">
        Étape {step + 1} sur {STEPS.length}
      </span>
      <div>
        <h2 className="soc-card-title" style={{ fontSize: 18 }}>
          {STEPS[step].title}
        </h2>
        <p className="soc-card-sub">{STEPS[step].description}</p>
      </div>
      {step === 0 && <Textarea rows={5} autoFocus value={a.offer_description} onChange={(e) => set('offer_description', e.target.value)} placeholder="Coaching perte de poids 12 semaines, accompagnement personnalisé…" />}
      {step === 1 && <Textarea rows={5} autoFocus value={a.target_audience} onChange={(e) => set('target_audience', e.target.value)} placeholder="Hommes 25-45 ans, sédentaires, qui veulent perdre 10-20 kg…" />}
      {step === 2 && <OptionList options={TONES} value={a.tone} onChange={(v) => set('tone', v)} />}
      {step === 3 && <ApproachPicker value={a.approach} onChange={(v) => set('approach', v)} />}
      {step === 4 && <Textarea rows={8} autoFocus value={a.example_messages} onChange={(e) => set('example_messages', e.target.value)} placeholder={"Salut [prénom] ! J'ai vu que tu t'étais inscrit(e)…"} />}
      {step === 5 && <OptionList options={GOALS} value={a.goal} onChange={(v) => set('goal', v)} />}
      {step === 6 && <Input type="password" autoFocus value={a.api_key} onChange={(e) => set('api_key', e.target.value)} placeholder="sk-ant-api03-..." />}
      <div className="soc-row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="ds-pill-button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          ‹ Précédent
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={!canProceed} onClick={() => setStep((s) => s + 1)}>
            Suivant ›
          </button>
        ) : (
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={saving || !canProceed} onClick={() => void generate()}>
            {saving ? 'Génération en cours…' : '✦ Générer mon brief'}
          </button>
        )}
      </div>
    </section>
  )
}

function EditView({ brief, notify, onUpdated }: { brief: AiCoachBrief; notify: (t: string, tone?: 'success' | 'danger') => void; onUpdated: () => void }) {
  const [a, setA] = useState<Answers>(() => fromBrief(brief))
  const [section, setSection] = useState<'offer' | 'target' | 'tone' | 'approach' | 'examples' | 'goal'>('offer')
  const [saving, setSaving] = useState(false)
  const [learning, setLearning] = useState(false)
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((prev) => ({ ...prev, [k]: v }))

  async function regenerate() {
    setSaving(true)
    try {
      await api.post('/api/ai/brief', { ...a, api_key: a.api_key || brief.api_key })
      notify('Brief régénéré')
      onUpdated()
    } catch (e) {
      notify(`Erreur lors de la régénération : ${errMsg(e)}`, 'danger')
    } finally {
      setSaving(false)
    }
  }

  async function saveKey() {
    try {
      await api.post('/api/ai/brief', { ...fromBrief(brief), api_key: a.api_key })
      notify('Clé API enregistrée')
      onUpdated()
    } catch (e) {
      notify(errMsg(e), 'danger')
    }
  }

  async function learn() {
    setLearning(true)
    try {
      const r = await api.post<{ data: { wins_analyzed: number } }>('/api/ai/learn', {})
      notify(`Brief mis à jour à partir de ${r.data.wins_analyzed} conversation(s) gagnante(s).`)
      onUpdated()
    } catch (e) {
      notify(errMsg(e), 'danger')
    } finally {
      setLearning(false)
    }
  }

  return (
    <div className="soc-stack">
      <StatGrid>
        <StatCard label="Conversations analysées" value={brief.wins_analyzed} caption="Conversations gagnantes utilisées pour affiner le brief" />
        <StatCard label="Dernière mise à jour" value={new Date(brief.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} />
      </StatGrid>
      <section className="soc-card">
        <h2 className="soc-card-title">Brief généré (IA)</h2>
        <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{brief.generated_brief}</p>
        <span className="soc-muted" style={{ fontSize: 11 }}>
          Le brief est produit par l'IA à partir de la configuration ci-dessous (le web ne permet pas non plus de l'enregistrer à la main).
        </span>
      </section>
      <section className="soc-card">
        <h2 className="soc-card-title">Configuration</h2>
        <Chips
          items={[
            { key: 'offer', label: 'Offre' },
            { key: 'target', label: 'Cible' },
            { key: 'tone', label: `Ton : ${TONES.find((t) => t.value === a.tone)?.label}` },
            { key: 'approach', label: 'Approche' },
            { key: 'examples', label: 'Exemples' },
            { key: 'goal', label: `Objectif : ${GOALS.find((g) => g.value === a.goal)?.label}` },
          ]}
          active={section}
          onChange={setSection}
        />
        {section === 'offer' && <Textarea rows={4} value={a.offer_description} onChange={(e) => set('offer_description', e.target.value)} />}
        {section === 'target' && <Textarea rows={4} value={a.target_audience} onChange={(e) => set('target_audience', e.target.value)} />}
        {section === 'tone' && <OptionList options={TONES} value={a.tone} onChange={(v) => set('tone', v)} />}
        {section === 'approach' && <ApproachPicker value={a.approach} onChange={(v) => set('approach', v)} />}
        {section === 'examples' && <Textarea rows={6} value={a.example_messages} onChange={(e) => set('example_messages', e.target.value)} />}
        {section === 'goal' && <OptionList options={GOALS} value={a.goal} onChange={(v) => set('goal', v)} />}
        <div className="soc-row">
          <button type="button" className="ds-pill-button ds-pill-button--dark" disabled={saving} onClick={() => void regenerate()}>
            {saving ? 'Régénération…' : '↻ Régénérer le brief'}
          </button>
          <button type="button" className="ds-pill-button" disabled={learning} onClick={() => void learn()}>
            {learning ? 'Analyse…' : 'Apprendre de mes conversations gagnantes'}
          </button>
        </div>
      </section>
      <section className="soc-card">
        <Field label="Clé API Claude">
          <Input type="password" value={a.api_key} onChange={(e) => set('api_key', e.target.value)} placeholder="sk-ant-api03-..." />
        </Field>
        {a.api_key !== (brief.api_key ?? '') && (
          <button type="button" className="ds-pill-button ds-pill-button--dark" style={{ alignSelf: 'flex-start' }} onClick={() => void saveKey()}>
            Sauvegarder la clé
          </button>
        )}
        <span className="soc-muted" style={{ fontSize: 11 }}>
          Obtenez votre clé sur console.anthropic.com. Elle est stockée côté serveur et utilisée uniquement pour générer des suggestions.
        </span>
      </section>
    </div>
  )
}
