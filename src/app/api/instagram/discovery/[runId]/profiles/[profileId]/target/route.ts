import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

/**
 * "Cibler" — converts one observed discovery_profiles row into a real lead,
 * on demand, one profile at a time. This is the ONLY way a Ciblage
 * (Discovery) scan creates a lead — the scan itself only observes (see
 * persist-profiles.ts). If the profile was already a lead (matched_lead_id
 * set at scan time), this just returns that existing lead instead of
 * creating a duplicate.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string; profileId: string }> }
) {
  try {
    const { profileId } = await params
    const { workspaceId, userId } = await getWorkspaceId()
    const supabase = await createClient()

    const { data: profile, error: profileError } = await supabase
      .from('discovery_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('workspace_id', workspaceId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    if (profile.matched_lead_id) {
      return NextResponse.json({ data: { leadId: profile.matched_lead_id, alreadyExisted: true } })
    }

    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        workspace_id: workspaceId,
        first_name: profile.full_name ?? profile.instagram_username,
        last_name: '',
        phone: '',
        email: null,
        status: 'nouveau',
        source: 'instagram_engagement',
        instagram_handle: profile.instagram_username,
        instagram_user_id: profile.instagram_user_id,
        instagram_is_verified: profile.is_verified,
        instagram_profile_pic_url: profile.profile_pic_url,
      })
      .select('id')
      .single()

    if (insertError || !newLead) {
      return NextResponse.json({ error: insertError?.message ?? 'Échec de la création du lead' }, { status: 500 })
    }

    await supabase
      .from('discovery_profiles')
      .update({ matched_lead_id: newLead.id, targeted_at: new Date().toISOString(), targeted_by: userId })
      .eq('id', profileId)

    return NextResponse.json({ data: { leadId: newLead.id, alreadyExisted: false } }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
