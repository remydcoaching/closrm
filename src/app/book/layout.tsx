export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  )
}
