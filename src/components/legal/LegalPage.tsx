// Shared shell of the public legal pages: readable column, no app chrome.
import Link from 'next/link'

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: '#f6f6f7', padding: '48px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <article style={{ maxWidth: 760, margin: '0 auto', background: '#fff', borderRadius: 16, padding: '40px 44px', color: '#1d1d1f', lineHeight: 1.6, fontSize: 15, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#c837ab', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ClosRM</p>
        <h1 style={{ margin: '6px 0 24px', fontSize: 28 }}>{title}</h1>
        {children}
        <p style={{ marginTop: 40, fontSize: 13, color: '#6e6e73' }}>
          <Link href="/confidentialite">Politique de confidentialité</Link> · <Link href="/suppression-des-donnees">Suppression des données</Link>
        </p>
      </article>
    </main>
  )
}

export const h2: React.CSSProperties = { fontSize: 18, margin: '28px 0 8px' }
