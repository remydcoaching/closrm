const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/

// ML Kit OCR renvoie le texte ligne par ligne, dans l'ordre visuel. Le handle
// Instagram est toujours le premier "mot" de la ligne de notification, suivi
// du texte descriptif. On tolère espaces multiples / retours OCR bruités.
const FOLLOW_LINE_REGEX =
  /^@?([a-zA-Z0-9._]{1,30})\s+(?:a commencé à vous suivre|a accepté votre demande de suivi)/i

/** Pure function: parses raw OCR text (one screenshot) into a filtered handle
 *  list. No network call — testable directly against sample OCR output. */
export function parseHandlesFromOcrText(text: string): string[] {
  const lines = text.split('\n')
  const handles: string[] = []
  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/\s+/g, ' ')
    const match = line.match(FOLLOW_LINE_REGEX)
    if (match && INSTAGRAM_HANDLE_REGEX.test(match[1])) {
      handles.push(match[1])
    }
  }
  return handles
}

export function extractHandlesFromTexts(texts: string[]): string[] {
  return texts.flatMap(parseHandlesFromOcrText)
}

export function dedupHandles(handles: string[]): string[] {
  return [...new Set(handles)]
}
