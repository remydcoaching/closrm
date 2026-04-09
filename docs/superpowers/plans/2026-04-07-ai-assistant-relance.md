# Assistant IA de Relance — Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrer un assistant IA (Claude) qui analyse les conversations Instagram d'un lead et genere un message de relance personnalise dans la voix du coach.

**Architecture:** API route `/api/ai/suggest` recoit un lead_id, construit un prompt avec le brief coach + messages IG + infos lead + conversations gagnantes, appelle Claude, retourne guidance + message. Le composant `AiSuggestionPanel` s'integre dans le side panel lead et la page Messages. Le coach configure son brief via un onboarding wizard dans Parametres.

**Tech Stack:** Next.js 14 App Router, @anthropic-ai/sdk, Supabase (PostgreSQL + RLS), TypeScript

**Spec :** `docs/superpowers/specs/2026-04-07-ai-assistant-relance-design.md`

---

## Task 1 : Installation SDK + migration SQL + types

**Files:**
- Modify: `package.json`
- Create: `supabase/migrations/018_ai_assistant.sql`
- Modify: `supabase/schema.sql`
- Modify: `src/types/index.ts` (apres ligne 913)

- [ ] **Step 1: Installer le SDK Anthropic**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Creer la migration 018**

Creer `supabase/migrations/018_ai_assistant.sql` :

```sql
-- Brief du coach pour l'IA
CREATE TABLE ai_coach_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  offer_description TEXT,
  target_audience TEXT,
  tone TEXT DEFAULT 'tu' CHECK (tone IN ('tu', 'vous', 'mixed')),
  approach TEXT,
  example_messages TEXT,
  goal TEXT DEFAULT 'book_call' CHECK (goal IN ('book_call', 'sell_dm', 'both')),
  generated_brief TEXT,
  wins_analyzed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations tagguees pour le self-learning
CREATE TABLE ai_conversation_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'no_response')),
  messages_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ai_coach_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace brief" ON ai_coach_briefs FOR ALL USING (
  workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
);

ALTER TABLE ai_conversation_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace outcomes" ON ai_conversation_outcomes FOR ALL USING (
  workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
);
```

- [ ] **Step 3: Ajouter les types TypeScript**

A la fin de `src/types/index.ts` (apres ligne 913), ajouter :

```typescript
// ─── AI Assistant ─────────────────────────────

export interface AiCoachBrief {
  id: string
  workspace_id: string
  offer_description: string | null
  target_audience: string | null
  tone: 'tu' | 'vous' | 'mixed'
  approach: string | null
  example_messages: string | null
  goal: 'book_call' | 'sell_dm' | 'both'
  generated_brief: string | null
  wins_analyzed: number
  updated_at: string
  created_at: string
}

export interface AiSuggestion {
  guidance: string
  message: string
  status_suggestion?: {
    from: LeadStatus
    to: LeadStatus
    reason: string
  }
  window_open: boolean
  window_expires_at?: string
}

export interface AiConversationOutcome {
  id: string
  workspace_id: string
  conversation_id: string
  lead_id: string | null
  outcome: 'won' | 'lost' | 'no_response'
  messages_snapshot: Record<string, unknown>[] | null
  created_at: string
}
```

- [ ] **Step 4: Mettre a jour schema.sql**

Ajouter les definitions des tables dans `supabase/schema.sql` apres les tables existantes (reflet de la migration).

- [ ] **Step 5: Verifier que ca compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json supabase/ src/types/index.ts
git commit -m "feat: add AI assistant migration, types, and SDK dependency"
```

---

## Task 2 : Client Claude + logique de suggestion

**Files:**
- Create: `src/lib/ai/client.ts`
- Create: `src/lib/ai/suggest.ts`
- Create: `src/lib/ai/brief.ts`
- Create: `src/lib/ai/prompts.ts`

- [ ] **Step 1: Creer le client Claude**

Creer `src/lib/ai/client.ts` :

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function callClaude(
  prompt: string,
  model: 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-5-20250514' = 'claude-haiku-4-5-20251001'
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text : ''
}
```

- [ ] **Step 2: Creer le module de prompts**

Creer `src/lib/ai/prompts.ts` :

```typescript
import { AiCoachBrief, Lead, IgMessage } from '@/types'

interface PromptContext {
  brief: AiCoachBrief | null
  lead: Lead
  messages: IgMessage[]
  goldenExamples: { messages: string }[]
}

export function buildSuggestionPrompt(ctx: PromptContext): string {
  const toneLabel = ctx.brief?.tone === 'tu' ? 'tutoiement' : ctx.brief?.tone === 'vous' ? 'vouvoiement' : 'adaptatif'
  const goalLabel = ctx.brief?.goal === 'book_call' ? 'Amener le prospect a booker un appel' : ctx.brief?.goal === 'sell_dm' ? 'Vendre en DM' : 'Booker un appel ou vendre en DM'

  const messagesText = ctx.messages
    .map(m => `[${m.sender_type === 'user' ? 'COACH' : 'PROSPECT'}] ${m.text || '(media)'}`)
    .join('\n')

  const goldenText = ctx.goldenExamples.length > 0
    ? ctx.goldenExamples.map((ex, i) => `### Exemple ${i + 1}\n${ex.messages}`).join('\n\n')
    : 'Aucun exemple disponible pour le moment.'

  return `Tu es l'assistant IA de relance d'un coach. Ton role est d'analyser une conversation Instagram et de suggerer le prochain message a envoyer.

## BRIEF DU COACH
${ctx.brief?.generated_brief || 'Pas de brief configure. Genere un message professionnel et engageant.'}

Ton : ${toneLabel}
Offre : ${ctx.brief?.offer_description || 'Non renseigne'}
Cible : ${ctx.brief?.target_audience || 'Non renseigne'}
Objectif : ${goalLabel}

## INFOS DU PROSPECT
Prenom : ${ctx.lead.first_name}
Statut actuel : ${ctx.lead.status}
Source : ${ctx.lead.source}
Tags : ${ctx.lead.tags?.join(', ') || 'aucun'}
Notes : ${ctx.lead.notes || 'aucune'}
Pseudo IG : ${ctx.lead.instagram_handle || 'inconnu'}

## CONVERSATION (du plus ancien au plus recent)
${messagesText || 'Aucun message echange.'}

## EXEMPLES DE CONVERSATIONS QUI ONT CONVERTI
${goldenText}

## INSTRUCTIONS
Reponds UNIQUEMENT en JSON valide (sans markdown, sans backticks) avec cette structure :
{
  "guidance": "2-3 phrases expliquant la situation du prospect et la strategie recommandee",
  "message": "le message a envoyer au prospect, dans le style du coach, naturel et personnalise, 2-4 phrases max",
  "status_suggestion": null ou { "to": "nouveau_statut", "reason": "pourquoi changer" }
}

Le message doit etre naturel, personnalise, pas de formules generiques. Adapte le ton au brief du coach.`
}

export function buildBriefGenerationPrompt(answers: {
  offer_description: string
  target_audience: string
  tone: string
  approach: string
  example_messages: string
  goal: string
}): string {
  return `A partir des reponses d'un coach, genere un brief de 200 mots max decrivant son style de communication et sa strategie de relance Instagram.

Reponses du coach :
- Offre : ${answers.offer_description}
- Cible : ${answers.target_audience}
- Ton : ${answers.tone === 'tu' ? 'Tutoiement' : answers.tone === 'vous' ? 'Vouvoiement' : 'Adaptatif'}
- Approche de relance : ${answers.approach}
- Exemples de messages qui marchent : ${answers.example_messages}
- Objectif : ${answers.goal === 'book_call' ? 'Booker un appel' : answers.goal === 'sell_dm' ? 'Vendre en DM' : 'Les deux'}

Genere un brief structure qui decrit :
1. Le style de communication (ton, expressions typiques, niveau de familiarite)
2. La strategie de relance (comment il approche les prospects, les etapes)
3. Les types de messages qui fonctionnent (basé sur les exemples)
4. Les signaux d'achat a detecter chez les prospects

Reponds UNIQUEMENT avec le brief, sans introduction ni commentaire.`
}
```

- [ ] **Step 3: Creer le module de gestion du brief**

Creer `src/lib/ai/brief.ts` :

```typescript
import { createClient } from '@/lib/supabase/server'
import { AiCoachBrief } from '@/types'
import { callClaude } from './client'
import { buildBriefGenerationPrompt } from './prompts'

export async function getBrief(workspaceId: string): Promise<AiCoachBrief | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_coach_briefs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()
  return data
}

export async function saveBrief(
  workspaceId: string,
  answers: {
    offer_description: string
    target_audience: string
    tone: 'tu' | 'vous' | 'mixed'
    approach: string
    example_messages: string
    goal: 'book_call' | 'sell_dm' | 'both'
  }
): Promise<AiCoachBrief> {
  const supabase = await createClient()

  // Generate brief from answers
  const prompt = buildBriefGenerationPrompt(answers)
  const generatedBrief = await callClaude(prompt, 'claude-sonnet-4-5-20250514')

  const { data, error } = await supabase
    .from('ai_coach_briefs')
    .upsert({
      workspace_id: workspaceId,
      ...answers,
      generated_brief: generatedBrief,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function getWinningConversations(
  workspaceId: string,
  source: string,
  limit: number = 3
): Promise<{ messages: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_conversation_outcomes')
    .select('messages_snapshot')
    .eq('workspace_id', workspaceId)
    .eq('outcome', 'won')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return []

  return data.map(row => {
    const msgs = row.messages_snapshot as { sender_type: string; text: string }[] | null
    if (!msgs) return { messages: '' }
    return {
      messages: msgs
        .map(m => `[${m.sender_type === 'user' ? 'COACH' : 'PROSPECT'}] ${m.text || '(media)'}`)
        .join('\n'),
    }
  })
}

export async function recordOutcome(
  workspaceId: string,
  conversationId: string,
  leadId: string,
  outcome: 'won' | 'lost' | 'no_response'
): Promise<void> {
  const supabase = await createClient()

  // Fetch messages snapshot
  const { data: messages } = await supabase
    .from('ig_messages')
    .select('sender_type, text, sent_at')
    .eq('conversation_id', conversationId)
    .eq('workspace_id', workspaceId)
    .order('sent_at', { ascending: true })
    .limit(50)

  await supabase.from('ai_conversation_outcomes').insert({
    workspace_id: workspaceId,
    conversation_id: conversationId,
    lead_id: leadId,
    outcome,
    messages_snapshot: messages || [],
  })
}
```

- [ ] **Step 4: Creer le module de suggestion**

Creer `src/lib/ai/suggest.ts` :

```typescript
import { createClient } from '@/lib/supabase/server'
import { AiSuggestion, Lead, IgMessage } from '@/types'
import { callClaude } from './client'
import { buildSuggestionPrompt } from './prompts'
import { getBrief, getWinningConversations } from './brief'

export async function generateSuggestion(
  workspaceId: string,
  leadId: string,
  conversationId?: string
): Promise<AiSuggestion> {
  const supabase = await createClient()

  // 1. Fetch brief
  const brief = await getBrief(workspaceId)

  // 2. Fetch lead
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!lead) throw new Error('Lead non trouve')

  // 3. Find conversation if not provided
  let convId = conversationId
  if (!convId && lead.instagram_handle) {
    const { data: conv } = await supabase
      .from('ig_conversations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .limit(1)
      .single()
    convId = conv?.id
  }

  // 4. Fetch messages (20 derniers)
  let messages: IgMessage[] = []
  if (convId) {
    const { data: msgs } = await supabase
      .from('ig_messages')
      .select('*')
      .eq('conversation_id', convId)
      .eq('workspace_id', workspaceId)
      .order('sent_at', { ascending: true })
      .limit(20)
    messages = msgs || []
  }

  // 5. Fetch golden scripts
  const goldenExamples = await getWinningConversations(workspaceId, lead.source, 3)

  // 6. Build prompt
  const prompt = buildSuggestionPrompt({ brief, lead, messages, goldenExamples })

  // 7. Call Claude — Haiku pour conversations courtes, Sonnet pour longues
  const model = messages.length > 10 ? 'claude-sonnet-4-5-20250514' : 'claude-haiku-4-5-20251001'
  const raw = await callClaude(prompt, model)

  // 8. Parse response
  let parsed: { guidance: string; message: string; status_suggestion?: { to: string; reason: string } }
  try {
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    // Fallback if JSON parsing fails
    parsed = {
      guidance: 'Impossible de generer une suggestion. Redigez votre message manuellement.',
      message: '',
    }
  }

  // 9. Determine window status
  let windowOpen = false
  let windowExpiresAt: string | undefined
  if (convId) {
    const { data: lastParticipantMsg } = await supabase
      .from('ig_messages')
      .select('sent_at')
      .eq('conversation_id', convId)
      .eq('workspace_id', workspaceId)
      .eq('sender_type', 'participant')
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (lastParticipantMsg) {
      const lastMsgDate = new Date(lastParticipantMsg.sent_at)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      windowOpen = lastMsgDate > sevenDaysAgo
      if (windowOpen) {
        const expires = new Date(lastMsgDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        windowExpiresAt = expires.toISOString()
      }
    }
  }

  return {
    guidance: parsed.guidance,
    message: parsed.message,
    status_suggestion: parsed.status_suggestion
      ? { from: lead.status, to: parsed.status_suggestion.to as Lead['status'], reason: parsed.status_suggestion.reason }
      : undefined,
    window_open: windowOpen,
    window_expires_at: windowExpiresAt,
  }
}
```

- [ ] **Step 5: Verifier que ca compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/
git commit -m "feat: AI suggestion engine — client, prompts, brief, suggest"
```

---

## Task 3 : API routes (suggest + brief CRUD)

**Files:**
- Create: `src/app/api/ai/suggest/route.ts`
- Create: `src/app/api/ai/brief/route.ts`

- [ ] **Step 1: Creer la route suggestion**

Creer `src/app/api/ai/suggest/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { generateSuggestion } from '@/lib/ai/suggest'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()

    const leadId = body.lead_id as string
    const conversationId = body.conversation_id as string | undefined

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id requis' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configuree' }, { status: 500 })
    }

    const suggestion = await generateSuggestion(workspaceId, leadId, conversationId)
    return NextResponse.json({ data: suggestion })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    console.error('[API /ai/suggest] Error:', err)
    return NextResponse.json({ error: 'Erreur lors de la generation' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Creer la route brief CRUD**

Creer `src/app/api/ai/brief/route.ts` :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { getBrief, saveBrief } from '@/lib/ai/brief'

export async function GET() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const brief = await getBrief(workspaceId)
    return NextResponse.json({ data: brief })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const body = await request.json()

    const brief = await saveBrief(workspaceId, {
      offer_description: body.offer_description || '',
      target_audience: body.target_audience || '',
      tone: body.tone || 'tu',
      approach: body.approach || '',
      example_messages: body.example_messages || '',
      goal: body.goal || 'book_call',
    })

    return NextResponse.json({ data: brief }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    console.error('[API /ai/brief] Error:', err)
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verifier que ca compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/
git commit -m "feat: AI API routes — suggest + brief CRUD"
```

---

## Task 4 : Composant AiSuggestionPanel

**Files:**
- Create: `src/components/ai/AiSuggestionPanel.tsx`

- [ ] **Step 1: Creer le composant**

Creer `src/components/ai/AiSuggestionPanel.tsx` :

```typescript
'use client'

import { useState } from 'react'
import { Sparkles, Copy, ExternalLink, Send, Loader2, ChevronUp, ArrowRight } from 'lucide-react'
import { AiSuggestion } from '@/types'

interface Props {
  leadId: string
  conversationId?: string
  instagramHandle?: string | null
  onSendMessage?: (text: string) => void
}

export default function AiSuggestionPanel({ leadId, conversationId, instagramHandle, onSendMessage }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null)
  const [editedMessage, setEditedMessage] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function generate() {
    setState('loading')
    setError('')
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, conversation_id: conversationId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Erreur')
        setState('error')
        return
      }
      setSuggestion(json.data)
      setEditedMessage(json.data.message)
      setState('ready')
    } catch {
      setError('Erreur de connexion')
      setState('error')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(editedMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSend() {
    if (onSendMessage && editedMessage.trim()) {
      onSendMessage(editedMessage.trim())
      setState('idle')
      setSuggestion(null)
    }
  }

  // Idle — just the button
  if (state === 'idle') {
    return (
      <button onClick={generate} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))',
        border: '1px solid rgba(168,85,247,0.25)',
        color: '#a855f7', fontSize: 13, fontWeight: 600,
        transition: 'all 0.2s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.5)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(59,130,246,0.15))' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.25)'; e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))' }}
      >
        <Sparkles size={15} />
        Suggestion IA
      </button>
    )
  }

  // Loading
  if (state === 'loading') {
    return (
      <div style={{
        padding: '16px', borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(59,130,246,0.08))',
        border: '1px solid rgba(168,85,247,0.2)',
        display: 'flex', alignItems: 'center', gap: 10, color: '#a855f7', fontSize: 13,
      }}>
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        Analyse de la conversation en cours...
      </div>
    )
  }

  // Error
  if (state === 'error') {
    return (
      <div style={{
        padding: '12px 14px', borderRadius: 10,
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      }}>
        <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px 0' }}>{error}</p>
        <button onClick={generate} style={{
          fontSize: 11, color: 'var(--text-tertiary)', background: 'none',
          border: '1px solid var(--border-primary)', borderRadius: 6,
          padding: '4px 10px', cursor: 'pointer',
        }}>Reessayer</button>
      </div>
    )
  }

  // Ready — show guidance + message
  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid rgba(168,85,247,0.25)',
      background: 'linear-gradient(180deg, rgba(168,85,247,0.06) 0%, rgba(10,10,10,0.3) 100%)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid rgba(168,85,247,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a855f7', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <Sparkles size={12} />
          Assistant IA
        </div>
        <button onClick={() => { setState('idle'); setSuggestion(null) }} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 11,
        }}>
          <ChevronUp size={14} />
        </button>
      </div>

      {/* Guidance */}
      {suggestion && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(168,85,247,0.1)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {suggestion.guidance}
          </p>
          {suggestion.status_suggestion && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 8, padding: '4px 10px', borderRadius: 6,
              background: 'rgba(56,161,105,0.1)', border: '1px solid rgba(56,161,105,0.2)',
              fontSize: 11, color: '#38A169',
            }}>
              <ArrowRight size={10} />
              Suggere : {suggestion.status_suggestion.to} — {suggestion.status_suggestion.reason}
            </div>
          )}
        </div>
      )}

      {/* Message editable */}
      <div style={{ padding: '12px 14px' }}>
        <textarea
          value={editedMessage}
          onChange={e => setEditedMessage(e.target.value)}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
            borderRadius: 10, color: 'var(--text-primary)', fontSize: 13,
            outline: 'none', resize: 'vertical', lineHeight: 1.5,
          }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {/* Regenerate */}
          <button onClick={generate} style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 11,
            border: '1px solid var(--border-primary)', background: 'transparent',
            color: 'var(--text-tertiary)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Sparkles size={11} />Regenerer
          </button>

          <div style={{ flex: 1 }} />

          {suggestion?.window_open && onSendMessage ? (
            /* Window open — send directly */
            <button onClick={handleSend} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)', border: 'none',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(168,85,247,0.3)',
            }}>
              <Send size={12} />Envoyer
            </button>
          ) : (
            /* Window closed — copy + open IG */
            <>
              <button onClick={handleCopy} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: '1px solid rgba(168,85,247,0.3)', background: 'rgba(168,85,247,0.08)',
                color: '#a855f7', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Copy size={12} />{copied ? 'Copie !' : 'Copier'}
              </button>
              {instagramHandle && (
                <a
                  href={`https://www.instagram.com/${instagramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'linear-gradient(135deg, #E1306C, #C13584)', border: 'none',
                    color: '#fff', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <ExternalLink size={12} />Instagram
                </a>
              )}
            </>
          )}
        </div>

        {/* Window status */}
        {suggestion && !suggestion.window_open && (
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Fenetre de messagerie fermee — copiez le message et envoyez-le depuis Instagram
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verifier que ca compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/
git commit -m "feat: AiSuggestionPanel — guidance, convert, send/copy"
```

---

## Task 5 : Page Parametres > Assistant IA (onboarding wizard)

**Files:**
- Create: `src/app/(dashboard)/parametres/assistant-ia/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (ligne ~43)

- [ ] **Step 1: Creer la page onboarding + edition brief**

Creer `src/app/(dashboard)/parametres/assistant-ia/page.tsx` :

```typescript
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import AiSettingsClient from './ai-settings-client'

export default async function AiSettingsPage() {
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: brief } = await supabase
    .from('ai_coach_briefs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()

  return <AiSettingsClient initialBrief={brief} />
}
```

- [ ] **Step 2: Creer le client component avec wizard + editeur**

Creer `src/app/(dashboard)/parametres/assistant-ia/ai-settings-client.tsx` :

Ce composant fait 2 choses :
- Si pas de brief → affiche le wizard onboarding (6 etapes)
- Si brief existe → affiche l'editeur du brief + bouton "Analyser mes conversations gagnantes"

Le wizard a 6 etapes :
1. Offre (textarea)
2. Cible (textarea)
3. Ton (3 boutons : Tu / Vous / Ca depend)
4. Approche (checkboxes : contenu gratuit / questions objectifs / appel direct / mix)
5. Exemples de messages (textarea)
6. Objectif (3 boutons : Booker un appel / Vendre en DM / Les deux)

Chaque etape : titre + description + input + boutons Precedent/Suivant.
A la derniere etape : bouton "Generer mon brief" → POST /api/ai/brief → affiche le brief genere.

Le composant fait ~250 lignes. Implementer avec le meme style que le reste du dashboard (theme dark, border-radius 12-14px, CSS variables).

- [ ] **Step 3: Ajouter le lien dans la sidebar**

Dans `src/components/layout/Sidebar.tsx`, dans la section COMPTE (apres "Calendriers"), ajouter :

```typescript
{ label: 'Assistant IA', href: '/parametres/assistant-ia', icon: Sparkles }
```

Importer `Sparkles` depuis lucide-react.

- [ ] **Step 4: Verifier que ca compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/parametres/assistant-ia/ src/components/layout/Sidebar.tsx
git commit -m "feat: AI onboarding wizard + settings page + sidebar link"
```

---

## Task 6 : Integration dans le Side Panel et Messages

**Files:**
- Modify: `src/components/shared/LeadSidePanel.tsx` (apres ligne ~191)
- Modify: `src/components/messages/ConversationThread.tsx`
- Modify: `src/components/messages/MessageInput.tsx`

- [ ] **Step 1: Ajouter AiSuggestionPanel dans LeadSidePanel**

Dans `src/components/shared/LeadSidePanel.tsx`, apres la section Notes (ligne ~191), ajouter :

```typescript
{/* AI Assistant */}
<div style={card}>
  <div style={sectionTitle}>Assistant IA</div>
  <AiSuggestionPanel
    leadId={leadId}
    instagramHandle={lead.instagram_handle}
  />
</div>
```

Importer le composant en haut du fichier :
```typescript
import AiSuggestionPanel from '@/components/ai/AiSuggestionPanel'
```

- [ ] **Step 2: Ajouter AiSuggestionPanel dans la page Messages**

Dans `src/components/messages/ConversationThread.tsx` ou le composant parent qui gere la conversation, ajouter le panel IA au-dessus du MessageInput.

L'integration depend de la structure exacte du parent. Le pattern est :
- Le parent passe `conversationId` et `leadId` au panel
- Le `onSendMessage` du panel appelle la meme fonction d'envoi que MessageInput

- [ ] **Step 3: Verifier que ca compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/LeadSidePanel.tsx src/components/messages/
git commit -m "feat: integrate AI suggestion panel in side panel and messages"
```

---

## Task 7 : Self-learning (trigger auto + analyse)

**Files:**
- Modify: `src/app/api/leads/[id]/route.ts`
- Create: `src/app/api/ai/learn/route.ts`

- [ ] **Step 1: Trigger auto quand un lead passe en "clos"**

Dans `src/app/api/leads/[id]/route.ts`, dans le handler PATCH, apres la mise a jour du statut, ajouter :

```typescript
// If lead just won (status changed to 'clos'), record outcome for AI learning
if (parsed.data.status === 'clos' && existing.status !== 'clos') {
  // Find linked IG conversation
  const { data: conv } = await supabase
    .from('ig_conversations')
    .select('id')
    .eq('lead_id', id)
    .eq('workspace_id', workspaceId)
    .limit(1)
    .single()

  if (conv) {
    // Non-blocking — record the outcome
    import('@/lib/ai/brief').then(({ recordOutcome }) => {
      recordOutcome(workspaceId, conv.id, id, 'won').catch(() => {})
    })
  }
}
```

- [ ] **Step 2: Creer la route d'analyse manuelle**

Creer `src/app/api/ai/learn/route.ts` :

```typescript
import { NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { getBrief, getWinningConversations } from '@/lib/ai/brief'
import { callClaude } from '@/lib/ai/client'

export async function POST() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()
    const brief = await getBrief(workspaceId)
    if (!brief) return NextResponse.json({ error: 'Brief non configure' }, { status: 400 })

    const wins = await getWinningConversations(workspaceId, '', 10)
    if (wins.length === 0) return NextResponse.json({ error: 'Aucune conversation gagnante' }, { status: 400 })

    const prompt = `Voici le brief actuel d'un coach :\n\n${brief.generated_brief}\n\nVoici ${wins.length} conversations qui ont abouti a une vente :\n\n${wins.map((w, i) => `--- Conversation ${i + 1} ---\n${w.messages}`).join('\n\n')}\n\nAffine le brief en integrant les patterns qui fonctionnent dans ces conversations. Garde le meme format, meme longueur (200 mots max). Ameliore la strategie et les phrases types basees sur ce qui a reellement converti.`

    const updatedBrief = await callClaude(prompt, 'claude-sonnet-4-5-20250514')

    await supabase
      .from('ai_coach_briefs')
      .update({
        generated_brief: updatedBrief,
        wins_analyzed: (brief.wins_analyzed || 0) + wins.length,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)

    return NextResponse.json({ data: { brief: updatedBrief, wins_analyzed: wins.length } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verifier que ca compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leads/\[id\]/route.ts src/app/api/ai/learn/
git commit -m "feat: AI self-learning — auto record wins + manual brief refresh"
```

---

## Task 8 : Variable d'env + test end-to-end

- [ ] **Step 1: Ajouter ANTHROPIC_API_KEY dans .env.local**

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local
```

(Le dev doit mettre sa vraie cle)

- [ ] **Step 2: Appliquer la migration en DB**

Executer dans le SQL Editor Supabase le contenu de `supabase/migrations/018_ai_assistant.sql`

- [ ] **Step 3: Test complet**

1. Aller dans Parametres > Assistant IA → completer le wizard onboarding
2. Aller dans Leads → cliquer sur un lead avec un pseudo IG
3. Dans le side panel → cliquer sur "Suggestion IA"
4. Verifier que la guidance + message s'affichent
5. Verifier le bouton Envoyer (fenetre ouverte) ou Copier + Instagram (fenetre fermee)
6. Tester la regeneration
7. Tester l'edition du message avant envoi

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: AI relance assistant — complete V1"
```

---

## Resume des fichiers

### A creer (12 fichiers)
| Fichier | Tache |
|---------|-------|
| `supabase/migrations/018_ai_assistant.sql` | T1 |
| `src/lib/ai/client.ts` | T2 |
| `src/lib/ai/prompts.ts` | T2 |
| `src/lib/ai/suggest.ts` | T2 |
| `src/lib/ai/brief.ts` | T2 |
| `src/app/api/ai/suggest/route.ts` | T3 |
| `src/app/api/ai/brief/route.ts` | T3 |
| `src/app/api/ai/learn/route.ts` | T7 |
| `src/components/ai/AiSuggestionPanel.tsx` | T4 |
| `src/app/(dashboard)/parametres/assistant-ia/page.tsx` | T5 |
| `src/app/(dashboard)/parametres/assistant-ia/ai-settings-client.tsx` | T5 |

### A modifier (5 fichiers)
| Fichier | Tache |
|---------|-------|
| `src/types/index.ts` | T1 |
| `supabase/schema.sql` | T1 |
| `src/components/layout/Sidebar.tsx` | T5 |
| `src/components/shared/LeadSidePanel.tsx` | T6 |
| `src/components/messages/ConversationThread.tsx` | T6 |
| `src/app/api/leads/[id]/route.ts` | T7 |
