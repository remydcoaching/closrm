import { createServiceClient } from '@/lib/supabase/service'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import ManageActions from './ManageActions'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

export const dynamic = 'force-dynamic'

export default async function ManageBookingPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { token } = await searchParams

  if (!token) {
    return (
      <ErrorState title="Lien invalide" message="Le lien de gestion est incomplet. Vérifiez votre email." />
    )
  }

  const supabase = createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, scheduled_at, duration_minutes, status, manage_token, calendar_id, workspace_id')
    .eq('id', id)
    .maybeSingle()

  if (!booking || booking.manage_token !== token) {
    return <ErrorState title="Lien invalide" message="Ce lien n'est pas valide ou a expiré." />
  }

  // Get calendar slug + workspace slug for the reschedule URL
  let rescheduleUrl: string | null = null
  let calendarName = 'Coaching'
  let brandName = 'ClosRM'

  if (booking.calendar_id) {
    const { data: cal } = await supabase
      .from('booking_calendars')
      .select('name, slug')
      .eq('id', booking.calendar_id)
      .maybeSingle()
    if (cal) {
      calendarName = cal.name ?? calendarName
      const { data: ws } = await supabase
        .from('workspace_slugs')
        .select('slug')
        .eq('workspace_id', booking.workspace_id)
        .maybeSingle()
      if (ws?.slug && cal.slug) {
        rescheduleUrl = `/book/${ws.slug}/${cal.slug}?reschedule_from=${booking.id}&reschedule_token=${token}`
      }
    }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', booking.workspace_id)
    .maybeSingle()
  if (workspace?.name) brandName = workspace.name

  const scheduledAt = parseISO(booking.scheduled_at)
  const dateStr = format(scheduledAt, 'EEEE d MMMM yyyy', { locale: fr })
  const timeStr = format(scheduledAt, "HH'h'mm", { locale: fr })

  const isCancelled = booking.status === 'cancelled'
  const isPast = scheduledAt < new Date()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F4F5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        maxWidth: 540, width: '100%',
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(10,10,10,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{
          background: '#0A0A0A',
          backgroundImage: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 60%, #0F0F0F 100%)',
          padding: '32px 32px 28px',
          color: '#fff',
        }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#A1A1AA', letterSpacing: '0.4px' }}>{brandName}</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700 }}>Votre rendez-vous</h1>
        </div>

        <div style={{ padding: '32px' }}>
          {isCancelled ? (
            <div style={{ padding: '14px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: '#991B1B', fontWeight: 600 }}>Ce rendez-vous a été annulé.</p>
            </div>
          ) : isPast ? (
            <div style={{ padding: '14px 16px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 10, marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 14, color: '#374151', fontWeight: 600 }}>Ce rendez-vous est passé.</p>
            </div>
          ) : null}

          <div style={{
            background: '#FAFAFA',
            border: '1px solid #EFEFEF',
            borderRadius: 14,
            padding: '22px 24px',
            marginBottom: 24,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Date</p>
            <p style={{ margin: '0 0 14px', fontSize: 16, color: '#111827', fontWeight: 600 }}>{dateStr}</p>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Heure</p>
            <p style={{ margin: '0 0 14px', fontSize: 16, color: '#111827', fontWeight: 600 }}>{timeStr}</p>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Type</p>
            <p style={{ margin: 0, fontSize: 16, color: '#111827', fontWeight: 600 }}>{calendarName}</p>
          </div>

          <ManageActions
            bookingId={id}
            token={token}
            rescheduleUrl={rescheduleUrl}
            isCancelled={isCancelled}
            isPast={isPast}
          />
        </div>
      </div>
    </div>
  )
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F4F5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ maxWidth: 420, width: '100%', background: '#ffffff', borderRadius: 16, padding: '36px 32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(10,10,10,0.08)' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#111827' }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 15, color: '#6B7280', lineHeight: 1.6 }}>{message}</p>
      </div>
    </div>
  )
}
