// Theme tokens (dark + light).
//
// Architecture : `colors` est un Proxy qui lit dynamiquement le thème
// courant du singleton `themeState`. Quand on toggle, on appelle
// `setTheme()` puis on force un remount global (cf ThemeProvider).
// Les composants importent `colors` comme avant, sans modification.

export type Theme = 'dark' | 'light'

interface ColorTokens {
  bgPrimary: string
  bgSecondary: string
  bgElevated: string
  sheet: string
  border: string
  primary: string
  warning: string
  danger: string
  info: string
  purple: string
  cyan: string
  pink: string
  orange: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
}

export const darkColors: ColorTokens = {
  // Tokens iOS HIG natifs — Apple UIColor system colors dark mode.
  // Réf : https://developer.apple.com/design/human-interface-guidelines/color
  bgPrimary: '#000000', // systemBackground dark
  bgSecondary: '#1c1c1e', // secondarySystemBackground / groupedBackground card
  bgElevated: '#1c1c1e', // dans groupes : sections card unifiée bg #1c1c1e
  sheet: '#1c1c1e',
  // UIColor.separator dark = rgba(84,84,88,0.65). Sur bg #1c1c1e ça donne
  // visuellement #3a3a3c (ce que macOS affiche quand on screenshot).
  border: '#3a3a3c',
  primary: '#00C853',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
  // textPrimary = label (UIColor.label dark)
  textPrimary: '#FFFFFF',
  // textSecondary = secondaryLabel : rgba(235,235,245,0.6) ≈ #ebebf599
  textSecondary: '#ebebf599',
  // textTertiary = tertiaryLabel : rgba(235,235,245,0.3) ≈ #ebebf54d
  textTertiary: '#ebebf54d',
}

export const lightColors: ColorTokens = {
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F5F5F7',
  bgElevated: '#FFFFFF',
  sheet: '#F2F2F7',
  border: '#D1D1D6',
  primary: '#00A040', // primary légèrement assombri pour le contraste sur blanc
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
  purple: '#7C3AED',
  cyan: '#0891B2',
  pink: '#DB2777',
  orange: '#EA580C',
  textPrimary: '#0A0A0A',
  textSecondary: '#3F3F46',
  textTertiary: '#71717A',
}

// Singleton mutable. Mis à jour par setTheme() + ThemeProvider remount.
const themeState = {
  current: 'dark' as Theme,
}

export function setTheme(t: Theme) {
  themeState.current = t
}

export function getTheme(): Theme {
  return themeState.current
}

// Proxy qui forwarde aux tokens du thème courant.
// `colors.primary` → résout à `(themeState.current === 'dark' ? darkColors : lightColors).primary`
export const colors: ColorTokens = new Proxy({} as ColorTokens, {
  get(_target, prop: string) {
    const map = themeState.current === 'dark' ? darkColors : lightColors
    return (map as unknown as Record<string, string>)[prop]
  },
}) as ColorTokens

// 8 teintes pour les avatars — fixes (les mêmes en dark/light).
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
