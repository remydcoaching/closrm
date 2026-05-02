/**
 * Catalogue d'icônes premium pour les blocs email (features_grid, etc.).
 * Chaque icône = un identifiant + un SVG path Lucide 24×24 viewBox.
 * Utilisé par le picker dans l'inspector et par le compiler v2 pour
 * générer des <img> inline compatibles email.
 */

export interface EmailIcon {
  id: string
  label: string
  category: string
  path: string
}

export const EMAIL_ICON_CATEGORIES = [
  'Populaire',
  'Business',
  'Communication',
  'Contenu',
  'Interface',
  'Santé',
] as const

export const EMAIL_ICONS: EmailIcon[] = [
  // ─── Populaire ──────────────────────────────────────────────────────
  { id: 'star', label: 'Étoile', category: 'Populaire', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  { id: 'zap', label: 'Éclair', category: 'Populaire', path: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z' },
  { id: 'rocket', label: 'Fusée', category: 'Populaire', path: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' },
  { id: 'trophy', label: 'Trophée', category: 'Populaire', path: 'M6 9H4.5a2.5 2.5 0 010-5H6 M18 9h1.5a2.5 2.5 0 000-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22h10c0-2-0.85-3.25-2.03-3.79A1.07 1.07 0 0114 17v-2.34 M18 2H6v7a6 6 0 0012 0V2z' },
  { id: 'heart', label: 'Cœur', category: 'Populaire', path: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z' },
  { id: 'check-circle', label: 'Validé', category: 'Populaire', path: 'M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3' },
  { id: 'target', label: 'Cible', category: 'Populaire', path: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 18a6 6 0 100-12 6 6 0 000 12z M12 14a2 2 0 100-4 2 2 0 000 4z' },
  { id: 'flame', label: 'Flamme', category: 'Populaire', path: 'M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z' },
  { id: 'sparkles', label: 'Étincelles', category: 'Populaire', path: 'M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.936A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.962 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .962L15.5 14.063a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.962 0z M20 3v4 M22 5h-4' },
  { id: 'award', label: 'Récompense', category: 'Populaire', path: 'M12 15l-3.5 7.46 1-4.36-3.5-2.6h4.36L12 15z M12 15l3.5 7.46-1-4.36 3.5-2.6H13.64L12 15z M12 15a7 7 0 100-14 7 7 0 000 14z' },

  // ─── Business ───────────────────────────────────────────────────────
  { id: 'trending-up', label: 'Croissance', category: 'Business', path: 'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6' },
  { id: 'bar-chart', label: 'Graphique', category: 'Business', path: 'M12 20V10 M18 20V4 M6 20v-4' },
  { id: 'dollar-sign', label: 'Dollar', category: 'Business', path: 'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
  { id: 'briefcase', label: 'Mallette', category: 'Business', path: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16' },
  { id: 'calendar', label: 'Calendrier', category: 'Business', path: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z M16 2v4 M8 2v4 M3 10h18' },
  { id: 'clock', label: 'Horloge', category: 'Business', path: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 6v6l4 2' },
  { id: 'users', label: 'Équipe', category: 'Business', path: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
  { id: 'shield', label: 'Bouclier', category: 'Business', path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { id: 'lock', label: 'Cadenas', category: 'Business', path: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4' },
  { id: 'gem', label: 'Diamant', category: 'Business', path: 'M6 3h12l4 6-10 13L2 9z M11 3l1 10 M13 3l-1 10 M2 9h20' },

  // ─── Communication ──────────────────────────────────────────────────
  { id: 'mail', label: 'Email', category: 'Communication', path: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6' },
  { id: 'message-circle', label: 'Message', category: 'Communication', path: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' },
  { id: 'phone', label: 'Téléphone', category: 'Communication', path: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z' },
  { id: 'send', label: 'Envoyer', category: 'Communication', path: 'M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z' },
  { id: 'bell', label: 'Notification', category: 'Communication', path: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0' },
  { id: 'headphones', label: 'Casque', category: 'Communication', path: 'M3 18v-6a9 9 0 0118 0v6 M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z' },

  // ─── Contenu ────────────────────────────────────────────────────────
  { id: 'book-open', label: 'Livre', category: 'Contenu', path: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z' },
  { id: 'video', label: 'Vidéo', category: 'Contenu', path: 'M23 7l-7 5 7 5V7z M14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z' },
  { id: 'mic', label: 'Podcast', category: 'Contenu', path: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z M19 10v2a7 7 0 01-14 0v-2 M12 19v4 M8 23h8' },
  { id: 'image', label: 'Photo', category: 'Contenu', path: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21' },
  { id: 'gift', label: 'Cadeau', category: 'Contenu', path: 'M20 12v10H4V12 M2 7h20v5H2z M12 22V7 M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z' },
  { id: 'download', label: 'Télécharger', category: 'Contenu', path: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3' },
  { id: 'play-circle', label: 'Lecture', category: 'Contenu', path: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M10 8l6 4-6 4V8z' },

  // ─── Interface ──────────────────────────────────────────────────────
  { id: 'settings', label: 'Paramètres', category: 'Interface', path: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
  { id: 'layers', label: 'Couches', category: 'Interface', path: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' },
  { id: 'compass', label: 'Boussole', category: 'Interface', path: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z' },
  { id: 'terminal', label: 'Code', category: 'Interface', path: 'M4 17l6-5-6-5 M12 19h8' },
  { id: 'globe', label: 'Globe', category: 'Interface', path: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M2 12h20 M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z' },
  { id: 'cpu', label: 'Processeur', category: 'Interface', path: 'M18 8H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2z M9 4v4 M15 4v4 M9 20v4 M15 20v4 M20 9h4 M20 15h4 M0 9h4 M0 15h4' },

  // ─── Santé ──────────────────────────────────────────────────────────
  { id: 'activity', label: 'Activité', category: 'Santé', path: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { id: 'sun', label: 'Soleil', category: 'Santé', path: 'M12 17a5 5 0 100-10 5 5 0 000 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42' },
  { id: 'smile', label: 'Sourire', category: 'Santé', path: 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01' },
  { id: 'leaf', label: 'Feuille', category: 'Santé', path: 'M11 20A7 7 0 019.8 6.9C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' },
  { id: 'coffee', label: 'Café', category: 'Santé', path: 'M18 8h1a4 4 0 010 8h-1 M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z M6 1v3 M10 1v3 M14 1v3' },
  { id: 'mountain', label: 'Montagne', category: 'Santé', path: 'M8 3l4 8 5-5 5 15H2L8 3z' },
]

export function getEmailIconById(id: string): EmailIcon | undefined {
  return EMAIL_ICONS.find((i) => i.id === id)
}

export function renderIconSvg(
  icon: EmailIcon,
  color: string,
  size: number = 28,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`
}

export function isEmailIconId(value: string): boolean {
  return EMAIL_ICONS.some((i) => i.id === value)
}
