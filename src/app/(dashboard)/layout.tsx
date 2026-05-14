import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/layout/DashboardShell'
import { BrandingInjector } from '@/lib/branding/BrandingInjector'
import { WorkspaceConfigProvider } from '@/lib/workspace/config-context'
import type { SourceConfig, StatusConfig } from '@/types'

// Force dynamic rendering pour TOUTES les pages dashboard. Sans ça, Vercel
// pré-rend certains pages et sert un HTML caché jusqu'à 44 minutes — qui
// pointe vers d'anciens JS chunks. Résultat : nouveau code déployé mais
// l'utilisateur voit toujours l'ancienne UI tant que le edge cache n'expire pas.
// Le dashboard étant 100 % authentifié + interactif, force-dynamic n'a pas
// d'impact perf significatif.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch workspace for branding + label configs
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('accent_color, logo_url, status_config, source_config')
    .eq('owner_id', user.id)
    .single()

  const accentColor = workspace?.accent_color ?? '#00C853'
  const logoUrl = workspace?.logo_url ?? null
  const statusConfig = (workspace?.status_config as StatusConfig | null) ?? null
  const sourceConfig = (workspace?.source_config as SourceConfig | null) ?? null

  return (
    <>
      <BrandingInjector accentColor={accentColor} />
      <WorkspaceConfigProvider initialStatusConfig={statusConfig} initialSourceConfig={sourceConfig}>
        <DashboardShell logoUrl={logoUrl}>{children}</DashboardShell>
      </WorkspaceConfigProvider>
    </>
  )
}
