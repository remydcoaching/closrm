export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(0,200,83,0.06), transparent 70%)',
        filter: 'blur(80px)',
      }} />
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }} />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'rgba(0,200,83,0.1)',
            border: '1px solid rgba(0,200,83,0.15)', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: 16,
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#00C853' }}>C</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
            Clos<span style={{ color: '#00C853' }}>RM</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>CRM pour coachs indépendants</p>
        </div>
        {children}
      </div>
    </div>
  )
}
