import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { createClient } from '@/lib/supabase/server'
import { buildBookingConfirmationHtml } from '@/lib/email/templates/booking-confirmation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const SAMPLE = {
  prospectFirstName: 'Camille',
  prospectLastName: 'Durand',
  // Tomorrow 14h30 — feels concrete without being "now"
  scheduledAt: (() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    d.setHours(14, 30, 0, 0)
    return d
  })(),
}

function resolveTemplate(template: string, ctx: { calendarName: string }): string {
  const dateStr = format(SAMPLE.scheduledAt, 'EEEE d MMMM yyyy', { locale: fr })
  const timeStr = format(SAMPLE.scheduledAt, 'HH:mm')
  return template
    .replace(/\{\{prenom\}\}/g, SAMPLE.prospectFirstName)
    .replace(/\{\{nom\}\}/g, SAMPLE.prospectLastName)
    .replace(/\{\{date_rdv\}\}/g, dateStr)
    .replace(/\{\{heure_rdv\}\}/g, timeStr)
    .replace(/\{\{nom_calendrier\}\}/g, ctx.calendarName || 'Coaching')
}

export async function POST(request: NextRequest) {
  let workspaceId: string
  try {
    ;({ workspaceId } = await getWorkspaceId())
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { message?: string; calendarName?: string; variant?: 'meet' | 'location'; template?: 'premium' | 'minimal' | 'plain'; accentColor?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = (body.message ?? '').trim()
  const calendarName = body.calendarName ?? 'Coaching'
  const variant = body.variant === 'location' ? 'location' : 'meet'
  const template = body.template === 'minimal' || body.template === 'plain' ? body.template : 'premium'
  const accentColor = typeof body.accentColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(body.accentColor)
    ? body.accentColor
    : '#E53E3E'

  const supabase = await createClient()
  const [{ data: ws }, { data: coachUser }] = await Promise.all([
    supabase.from('workspaces').select('name').eq('id', workspaceId).maybeSingle(),
    supabase.from('users').select('full_name').eq('workspace_id', workspaceId).eq('role', 'coach').maybeSingle(),
  ])

  const dateStr = format(SAMPLE.scheduledAt, 'EEEE d MMMM yyyy', { locale: fr })
  const timeStr = format(SAMPLE.scheduledAt, 'HH:mm')

  const html = buildBookingConfirmationHtml({
    to: 'preview@example.com',
    workspaceId,
    coachName: coachUser?.full_name ?? '',
    brandName: ws?.name ?? coachUser?.full_name ?? 'Votre marque',
    prospectName: SAMPLE.prospectFirstName,
    date: dateStr,
    time: timeStr,
    meetUrl: variant === 'meet' ? 'https://meet.google.com/preview-link' : undefined,
    locationName: variant === 'location' ? 'Bureau ' + (ws?.name ?? 'Coaching') : undefined,
    locationAddress: variant === 'location' ? '12 rue de la Paix, 75002 Paris' : undefined,
    customMessage: message ? resolveTemplate(message, { calendarName }) : undefined,
    template,
    accentColor,
    manageUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://closrm.fr'}/booking/manage/preview?token=preview`,
  })

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
