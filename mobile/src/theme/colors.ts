// Tokens couleurs (cf spec 6.1). Le primary mobile est vert (#00C853),
// pas le rouge web — choix de design assumé par Rémy.
export const colors = {
  bgPrimary: '#09090b',
  bgSecondary: '#0c0c0e',
  bgElevated: '#141414',
  sheet: '#1c1c1e',
  border: '#262626',
  primary: '#00C853',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
} as const

// 8 teintes pour les avatars, dérivées de manière déterministe du nom
// (même nom → même couleur, sans state à stocker).
export const avatarHues = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
] as const

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarHues[Math.abs(hash) % avatarHues.length]
}
