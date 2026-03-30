'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, transition: 'all 0.3s',
      background: scrolled ? 'rgba(9,9,11,0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--border-primary)' : '1px solid transparent',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>
          Clos<span style={{ color: 'var(--color-primary)' }}>RM</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hidden md:flex">
          <a href="#features" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Fonctionnalités</a>
          <a href="#pricing" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Tarifs</a>
          <a href="#contact" style={{ fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none' }}>Contact</a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="hidden md:flex">
          <Link href="/login" style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, textDecoration: 'none' }}>Se connecter</Link>
          <Link href="/register" style={{ padding: '8px 16px', fontSize: 13, color: '#fff', background: 'var(--color-primary)', borderRadius: 8, textDecoration: 'none', fontWeight: 500 }}>Commencer</Link>
        </div>

        <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div style={{ background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-primary)', padding: '16px 32px' }} className="md:hidden">
          <a href="#features" onClick={() => setMenuOpen(false)} style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 12 }}>Fonctionnalités</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)} style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 12 }}>Tarifs</a>
          <a href="#contact" onClick={() => setMenuOpen(false)} style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: 16 }}>Contact</a>
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/login" style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', padding: 10, border: '1px solid var(--border-primary)', borderRadius: 8, textDecoration: 'none' }}>Se connecter</Link>
            <Link href="/register" style={{ textAlign: 'center', fontSize: 13, color: '#fff', background: 'var(--color-primary)', padding: 10, borderRadius: 8, textDecoration: 'none', fontWeight: 500 }}>Commencer</Link>
          </div>
        </div>
      )}
    </nav>
  )
}
