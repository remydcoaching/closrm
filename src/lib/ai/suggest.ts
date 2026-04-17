import { createClient } from '@/lib/supabase/server'
import { AiSuggestion, Lead, IgMessage } from '@/types'
import { callClaude } from './client'
import { buildSuggestionPrompt } from './prompts'
import { getBrief, getApiKey, getWinningConversations, getLeadMagnetsForWorkspace } from './brief'
import { replaceLeadMagnetUrls } from './replace-lead-magnet-urls'

export async function generateSuggestion(
  workspaceId: string,
  leadId: string,
  conversationId?: string
): Promise<AiSuggestion> {
  const supabase = await createClient()

  // 1. Fetch brief + API key
  const brief = await getBrief(workspaceId)
  const apiKey = await getApiKey(workspaceId)
  if (!apiKey) throw new Error('Cle API non configuree. Allez dans Parametres > Assistant IA.')

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
    messages = (msgs || []) as IgMessage[]
  }

  // 5. Fetch golden scripts
  const goldenExamples = await getWinningConversations(workspaceId, lead.source, 3)

  // 6. Fetch lead magnets (table structurée, remplace l'ancien JSON blob)
  const leadMagnets = await getLeadMagnetsForWorkspace(supabase, workspaceId)

  // 7. Build prompt
  const prompt = buildSuggestionPrompt({ brief, lead: lead as Lead, messages, goldenExamples, leadMagnets })

  // 7. Call Claude — Haiku pour conversations courtes, Sonnet pour longues
  const model = messages.length > 10 ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001'
  const raw = await callClaude(prompt, apiKey, model)

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

  // 8bis. Post-process : remplacer URLs des lead_magnets par short links trackables pour ce lead
  if (parsed.message && leadMagnets.length > 0) {
    parsed.message = await replaceLeadMagnetUrls({
      message: parsed.message,
      leadId,
      workspaceId,
      leadMagnets,
      supabase,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    })
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
      ? { from: lead.status as Lead['status'], to: parsed.status_suggestion.to as Lead['status'], reason: parsed.status_suggestion.reason }
      : undefined,
    window_open: windowOpen,
    window_expires_at: windowExpiresAt,
  }
}
