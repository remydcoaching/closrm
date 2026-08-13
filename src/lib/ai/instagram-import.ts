const INSTAGRAM_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/

// ML Kit OCR renvoie le texte notification par bloc, mais le rendu Instagram
// coupe le texte sur plusieurs lignes ("a commencé à vous" / "suivre.") et
// colle parfois le handle directement au verbe sans espace visible
// ("maximemum_a commencé..."). On travaille donc sur le texte complet
// (espaces normalisés, retours à la ligne compressés en un seul espace) avec
// un séparateur optionnel entre le handle et le verbe.
const FOLLOW_REGEX =
  /([a-zA-Z0-9._]{2,30}?)\s*a (?:commencé à vous suivre|accepté votre demande de suivi)/gi

/** Pure function: parses raw OCR text (one screenshot) into a filtered handle
 *  list. No network call — testable directly against sample OCR output. */
export function parseHandlesFromOcrText(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const handles: string[] = []
  for (const match of normalized.matchAll(FOLLOW_REGEX)) {
    const handle = match[1].replace(/^@/, '')
    if (INSTAGRAM_HANDLE_REGEX.test(handle)) {
      handles.push(handle)
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
