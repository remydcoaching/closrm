// Identity shown on the public legal pages (privacy policy, data deletion —
// required by Meta's App Review). Set in Vercel: NEXT_PUBLIC_LEGAL_COMPANY,
// NEXT_PUBLIC_LEGAL_EMAIL, NEXT_PUBLIC_LEGAL_ADDRESS.
export const LEGAL = {
  company: process.env.NEXT_PUBLIC_LEGAL_COMPANY || 'ClosRM',
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || null,
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || null,
  updatedAt: '2 octobre 2026',
}
