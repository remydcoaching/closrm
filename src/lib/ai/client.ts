import Anthropic from '@anthropic-ai/sdk'

export async function callClaude(
  prompt: string,
  apiKey: string,
  model: string = 'claude-haiku-4-5-20251001'
): Promise<string> {
  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text : ''
}
