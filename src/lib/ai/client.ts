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
