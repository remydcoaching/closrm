// Tokens couleurs (cf spec 6.1). Le primary mobile est vert (#00C853),
// pas le rouge web — choix de design assumé par Rémy.
export const colors = {
  bgPrimary: '#09090b',
  bgSecondary: '#0c0c0e',
  // bgElevated remonté de #141414 → #1a1a1c pour creuser le contraste
  // entre la carte et le fond — sinon les LeadCards adjacentes paraissent
  // se fondre les unes dans les autres ('lourd à voir' / 'enchaîné').
  bgElevated: '#1a1a1c',
  sheet: '#1c1c1e',
  // border #2e2e30 (au lieu de #262626) pour qu'on distingue mieux les
  // limites des cards dans une liste dense.
  border: '#2e2e30',
  primary: '#00C853',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
  textPrimary: '#FFFFFF',
  // textSecondary remonté de #A0A0A0 → #BFBFBF pour meilleure lisibilité
  // sur fond noir profond. Le contraste WCAG AA passe de 6.2:1 à 8.2:1.
  textSecondary: '#BFBFBF',
  // Tier intermédiaire pour les labels uppercase / metadata discrète.
  textTertiary: '#8A8A8A',
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
