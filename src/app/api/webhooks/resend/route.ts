import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Resend webhook events
// Docs: https://resend.com/docs/dashboard/webhooks/introduction
export async function POST(request: Request) {
  const body = await request.json()
  const event = body.type
  const data = body.data

  if (!event || !data?.email_id) {
    return NextResponse.json({ ok: true }) // ignore malformed
  }

  const supabase = createServiceClient()
  const resendEmailId = data.email_id

  // Find the email_send record
  const { data: send } = await supabase
    .from('email_sends')
    .select('id')
    .eq('resend_email_id', resendEmailId)
    .single()

  if (!send) {
    return NextResponse.json({ ok: true }) // not our email
  }

  const now = new Date().toISOString()

  switch (event) {
    case 'email.delivered':
      await supabase
        .from('email_sends')
        .update({ status: 'delivered' })
        .eq('id', send.id)
      break

    case 'email.opened':
      await supabase
        .from('email_sends')
        .update({ status: 'opened', opened_at: now })
        .eq('id', send.id)
      break

    case 'email.clicked':
      await supabase
        .from('email_sends')
        .update({ status: 'clicked', clicked_at: now })
        .eq('id', send.id)
      break

    case 'email.bounced':
      await supabase
        .from('email_sends')
        .update({ status: 'bounced', bounced_at: now })
        .eq('id', send.id)
      break

    case 'email.complained':
      await supabase
        .from('email_sends')
        .update({ status: 'complained' })
        .eq('id', send.id)
      break
  }

  return NextResponse.json({ ok: true })
}
