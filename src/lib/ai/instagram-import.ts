import Anthropic from '@anthropic-ai/sdk'

const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/

const EXTRACTION_PROMPT = `Tu regardes une capture d'écran du centre de notifications Instagram (app iOS).

Extrais UNIQUEMENT les notifications qui correspondent exactement à l'un de ces deux textes (le {handle} est en gras, cliquable, au début de la ligne) :
- "{handle} a commencé à vous suivre"
- "{handle} a accepté votre demande de suivi"

Ignore complètement tout le reste : likes sur reels/stories, commentaires, republications, "Thread suggéré pour vous", trophées de vues, "reel programmé publié", etc.

Réponds UNIQUEMENT avec un objet JSON de cette forme, sans aucun texte avant ou après :
{"handles": ["handle1", "handle2"]}

Si aucune notification pertinente n'est trouvée, réponds {"handles": []}.`

function parseDataUrl(dataUrl: string): { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string } {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!match) throw new Error('Format de data URL image invalide')
  return { mediaType: match[1] as 'image/jpeg' | 'image/png' | 'image/webp', base64: match[2] }
}

/** Pure function: parses Claude's raw text response into a filtered handle
 *  list. Extracted from extractHandlesFromImage so it's testable without
 *  mocking the network call. */
export function parseHandlesFromResponseText(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as { handles?: unknown }
    if (!Array.isArray(parsed.handles)) return []
    return parsed.handles
      .filter((h): h is string => typeof h === 'string')
      .map((h) => h.replace(/^@/, ''))
      .filter((h) => INSTAGRAM_HANDLE_REGEX.test(h))
  } catch {
    return []
  }
}

export async function extractHandlesFromImage(imageDataUrl: string, apiKey: string): Promise<string[]> {
  const { mediaType, base64 } = parseDataUrl(imageDataUrl)
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  })

  const block = response.content[0]
  const text = block.type === 'text' ? block.text : ''
  return parseHandlesFromResponseText(text)
}

export function dedupHandles(handles: string[]): string[] {
  return [...new Set(handles)]
}
