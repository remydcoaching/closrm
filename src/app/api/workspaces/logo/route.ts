import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2 Mo

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez JPG, PNG ou WebP.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Le fichier dépasse 2 Mo.' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${workspaceId}/logo.${ext}`

    // Upload (upsert to replace existing logo)
    const { error: uploadError } = await supabase.storage
      .from('workspace-logos')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('workspace-logos')
      .getPublicUrl(path)

    // Update workspace logo_url
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({ logo_url: urlData.publicUrl })
      .eq('id', workspaceId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: { logo_url: urlData.publicUrl } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const { workspaceId } = await getWorkspaceId()
    const supabase = await createClient()

    // List files in workspace folder to find current logo
    const { data: files } = await supabase.storage
      .from('workspace-logos')
      .list(workspaceId)

    if (files && files.length > 0) {
      const paths = files.map((f) => `${workspaceId}/${f.name}`)
      await supabase.storage.from('workspace-logos').remove(paths)
    }

    // Clear logo_url
    const { error: updateError } = await supabase
      .from('workspaces')
      .update({ logo_url: null })
      .eq('id', workspaceId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    if (err instanceof Error && err.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
