import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import MetaIntegrationCard from './meta-card'
import GoogleCalendarCard from './google-card'
import DomainSetup from '@/components/emails/DomainSetup'

interface PageProps {
  searchParams: Promise<{ success?: string; error?: string }>
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { workspaceId } = await getWorkspaceId()
  const supabase = await createClient()

  const { data: integrations } = await supabase
    .from('integrations')
    .select('type, is_active, connected_at, meta_page_id, credentials_encrypted')
    .eq('workspace_id', workspaceId)

  const metaIntegration = integrations?.find(i => i.type === 'meta')
  const googleIntegration = integrations?.find(i => i.type === 'google_calendar')

  const successMessage: Record<string, string> = {
    meta_connected: 'Facebook Meta Ads + Instagram connecté avec succès ! Les leads arrivent maintenant automatiquement.',
  }
  const errorMessage: Record<string, string> = {
    auth_required: 'Vous devez être connecté pour accéder à cette page.',
    meta_denied: 'Connexion Meta annulée.',
    invalid_state: 'Erreur de sécurité. Veuillez réessayer.',
    no_pages: 'Aucune page Facebook trouvée sur ce compte Meta.',
    oauth_failed: 'Erreur lors de la connexion Meta. Vérifiez votre compte et réessayez.',
    db_error: 'Erreur lors de la sauvegarde. Veuillez réessayer.',
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        Intégrations
      </h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 32 }}>
        Connecte tes outils pour automatiser l&apos;acquisition et le suivi des leads.
      </p>

      {/* Notifications */}
      {params.success && successMessage[params.success] && (
        <div style={{
          background: 'rgba(0, 200, 83, 0.08)',
          border: '1px solid rgba(0, 200, 83, 0.25)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 13,
          color: '#00C853',
        }}>
          {successMessage[params.success]}
        </div>
      )}
      {params.error && errorMessage[params.error] && (
        <div style={{
          background: 'rgba(229, 62, 62, 0.08)',
          border: '1px solid rgba(229, 62, 62, 0.25)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 13,
          color: '#E53E3E',
        }}>
          {errorMessage[params.error]}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Meta Ads */}
        <MetaIntegrationCard integration={metaIntegration ?? null} />

        {/* Google Agenda */}
        <GoogleCalendarCard integration={googleIntegration ?? null} />

        {/* Domaine Email */}
        <DomainSetup />

        {/* WhatsApp Business */}
        <PlaceholderCard
          icon="💬"
          name="WhatsApp Business"
          description="Messages automatiques aux leads et rappels RDV"
          color="#25D366"
        />

        {/* Telegram */}
        <PlaceholderCard
          icon="✈️"
          name="Telegram"
          description="Notifications coach en temps réel"
          color="#229ED9"
        />

        {/* Stripe */}
        <PlaceholderCard
          icon="💳"
          name="Stripe"
          description="Suivi paiements et abonnements — V2"
          color="#635BFF"
        />
      </div>
    </div>
  )
}

function PlaceholderCard({
  icon,
  name,
  description,
  color,
}: {
  icon: string
  name: string
  description: string
  color: string
}) {
  return (
    <div style={{
      background: '#141414',
      border: '1px solid #262626',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>{description}</div>
        </div>
      </div>
      <span style={{
        fontSize: 11,
        color: '#444',
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: 6,
        padding: '4px 10px',
      }}>
        Bientôt
      </span>
    </div>
  )
}
