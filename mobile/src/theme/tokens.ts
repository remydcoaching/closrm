// Design tokens iOS HIG strict — utilisés à travers toute l'app.
// Référence : https://developer.apple.com/design/human-interface-guidelines/typography

// ─── Spacing scale (Apple's 8-pt grid system) ──────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
} as const

// ─── Typography (iOS Dynamic Type) ─────────────────────────────────────
// Tailles + weights conformes UIKit/SwiftUI text styles.
type TypeStyle = {
  fontSize: number
  lineHeight: number
  fontWeight: '300' | '400' | '500' | '600' | '700' | '800'
  letterSpacing?: number
}

export const type: Record<
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'bodyEmphasis'
  | 'callout'
  | 'subheadline'
  | 'footnote'
  | 'caption1'
  | 'caption2',
  TypeStyle
> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  bodyEmphasis: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07 },
}

// ─── Radii (Apple corner radius system) ────────────────────────────────
export const radius = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  xxl: 20,
  pill: 999,
} as const

// ─── Touch targets (Apple HIG: minimum 44pt) ───────────────────────────
export const touch = {
  min: 44,
  comfortable: 56,
} as const
