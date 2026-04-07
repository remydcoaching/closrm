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

export async function getApiKey(workspaceId: string): Promise<string | null> {
  const brief = await getBrief(workspaceId)
  return brief?.api_key || null
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
    api_key?: string
  }
): Promise<AiCoachBrief> {
  const supabase = await createClient()

  const apiKey = answers.api_key
  if (!apiKey) throw new Error('Cle API requise pour generer le brief')

  // Generate brief from answers
  const prompt = buildBriefGenerationPrompt(answers)
  const generatedBrief = await callClaude(prompt, apiKey, 'claude-sonnet-4-5-20250514')

  const { data, error } = await supabase
    .from('ai_coach_briefs')
    .upsert({
      workspace_id: workspaceId,
      offer_description: answers.offer_description,
      target_audience: answers.target_audience,
      tone: answers.tone,
      approach: answers.approach,
      example_messages: answers.example_messages,
      goal: answers.goal,
      api_key: apiKey,
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
  _source: string,
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
