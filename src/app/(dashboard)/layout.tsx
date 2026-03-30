import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/layout/DashboardShell'
import { BrandingInjector } from '@/lib/branding/BrandingInjector'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch workspace for branding
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('accent_color, logo_url')
    .eq('owner_id', user.id)
    .single()

  const accentColor = workspace?.accent_color ?? '#00C853'
  const logoUrl = workspace?.logo_url ?? null

  return (
    <>
      <BrandingInjector accentColor={accentColor} />
      <DashboardShell logoUrl={logoUrl}>{children}</DashboardShell>
    </>
  )
}
