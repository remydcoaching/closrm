'use client'

import { useEffect, useState } from 'react'
import { UserCircle2, Building2, Palette, Link2, ShieldAlert } from 'lucide-react'
import ProfileForm from '@/components/settings/ProfileForm'
import WorkspaceForm from '@/components/settings/WorkspaceForm'
import BrandingForm from '@/components/settings/BrandingForm'
import DeleteAccount from '@/components/settings/DeleteAccount'

interface UserData {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface WorkspaceData {
  id: string
  name: string
  timezone: string
  accent_color: string
  logo_url: string | null
}

interface SectionProps {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  tone?: 'default' | 'danger'
}

function Section({ icon, title, description, children, tone = 'default' }: SectionProps) {
  const borderColor = tone === 'danger' ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-primary)'
  const iconBg = tone === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)'
  const iconColor = tone === 'danger' ? '#ef4444' : 'var(--text-secondary)'

  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 280px) 1fr',
        gap: 48,
        paddingBlock: 32,
        alignItems: 'start',
      }}
      className="settings-section"
    >
      <header style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: iconBg,
            border: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <h2
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            {description}
          </p>
        </div>
      </header>

      <div
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${borderColor}`,
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
        }}
      >
        {children}
      </div>
    </section>
  )
}

export default function ReglagesPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugSuccess, setSlugSuccess] = useState(false)

  async function fetchData() {
    try {
      const [profileRes, slugRes] = await Promise.all([
        fetch('/api/user/profile'),
        fetch('/api/workspaces/slug'),
      ])
      if (!profileRes.ok) throw new Error('Impossible de charger le profil')
      const json = await profileRes.json()
      setUser(json.data.user)
      setWorkspace(json.data.workspace)
      if (slugRes.ok) {
        const slugJson = await slugRes.json()
        setSlug(slugJson.slug || '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  async function saveSlug() {
    setSlugSaving(true)
    setSlugError(null)
    setSlugSuccess(false)
    try {
      const res = await fetch('/api/workspaces/slug', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Erreur')
      }
      setSlugSuccess(true)
      setTimeout(() => setSlugSuccess(false), 3000)
    } catch (err) {
      setSlugError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSlugSaving(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 48, maxWidth: 1080, margin: '0 auto' }}>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  if (error || !user || !workspace) {
    return (
      <div style={{ padding: 48, maxWidth: 1080, margin: '0 auto' }}>
        <p style={{ color: '#ef4444', fontSize: 14 }}>{error || 'Erreur de chargement'}</p>
      </div>
    )
  }

  const publicOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <>
      <style jsx>{`
        @media (max-width: 900px) {
          :global(.settings-section) {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '40px 48px 80px',
        }}
      >
        <header style={{ marginBottom: 8 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              marginBottom: 6,
            }}
          >
            Réglages
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
            Gérez votre compte, votre workspace et la personnalisation de ClosRM.
          </p>
        </header>

        <div style={{ borderTop: '1px solid var(--border-primary)', marginTop: 24 }}>
          <Section
            icon={<UserCircle2 size={18} />}
            title="Profil"
            description="Vos informations personnelles visibles par vous et votre équipe."
          >
            <ProfileForm user={user} onSave={fetchData} />
          </Section>

          <div style={{ borderTop: '1px solid var(--border-primary)' }} />

          <Section
            icon={<Building2 size={18} />}
            title="Workspace"
            description="Nom, fuseau horaire et paramètres globaux de votre espace de travail."
          >
            <WorkspaceForm workspace={workspace} onSave={fetchData} />
          </Section>

          <div style={{ borderTop: '1px solid var(--border-primary)' }} />

          <Section
            icon={<Palette size={18} />}
            title="Personnalisation"
            description="Couleur d'accent et logo utilisés dans l'interface et sur vos pages publiques."
          >
            <BrandingForm
              accentColor={workspace.accent_color ?? '#00C853'}
              logoUrl={workspace.logo_url ?? null}
              onSave={fetchData}
            />
          </Section>

          <div style={{ borderTop: '1px solid var(--border-primary)' }} />

          <Section
            icon={<Link2 size={18} />}
            title="Lien de prise de RDV"
            description="Ce slug personnalise l'URL publique de vos calendriers de réservation."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Slug public
              </label>
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'flex',
                    flex: '1 1 320px',
                    minWidth: 0,
                    border: '1px solid var(--border-primary)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'var(--bg-input)',
                  }}
                >
                  <span
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      fontSize: 13,
                      color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap',
                      borderRight: '1px solid var(--border-primary)',
                    }}
                  >
                    {publicOrigin}/book/
                  </span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="mon-slug"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                <button
                  onClick={saveSlug}
                  disabled={slugSaving || !slug}
                  style={{
                    padding: '10px 18px',
                    background: 'var(--color-primary, #E53E3E)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: slugSaving || !slug ? 'not-allowed' : 'pointer',
                    opacity: slugSaving || !slug ? 0.5 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {slugSaving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              </div>
              {slugError && (
                <p style={{ color: '#ef4444', fontSize: 12 }}>{slugError}</p>
              )}
              {slugSuccess && (
                <p style={{ color: '#38A169', fontSize: 12 }}>Slug sauvegardé !</p>
              )}
            </div>
          </Section>

          <div style={{ borderTop: '1px solid var(--border-primary)' }} />

          <Section
            icon={<ShieldAlert size={18} />}
            title="Zone dangereuse"
            description="Actions irréversibles concernant votre compte et votre workspace."
            tone="danger"
          >
            <DeleteAccount workspaceName={workspace.name} />
          </Section>
        </div>
      </div>
    </>
  )
}
