import { NextRequest, NextResponse } from 'next/server'
import { buildBookingConfirmationHtml, type BookingConfirmationParams } from '@/lib/email/templates/booking-confirmation'

export const dynamic = 'force-dynamic'

const VARIANTS: Record<string, BookingConfirmationParams> = {
  meet: {
    to: 'prospect@example.com',
    coachName: 'Pierre Rebmann',
    prospectName: 'Camille Durand',
    date: 'Mardi 5 mai 2026',
    time: '14h30',
    meetUrl: 'https://meet.google.com/abc-defg-hij',
    workspaceId: 'demo',
    brandName: 'ClosRM Coaching',
  },
  location: {
    to: 'prospect@example.com',
    coachName: 'Pierre Rebmann',
    prospectName: 'Camille Durand',
    date: 'Mardi 5 mai 2026',
    time: '14h30',
    locationName: 'Bureau ClosRM',
    locationAddress: '12 rue de la Paix, 75002 Paris',
    workspaceId: 'demo',
    brandName: 'ClosRM Coaching',
  },
  custom: {
    to: 'prospect@example.com',
    coachName: 'Rémy Dupuis',
    prospectName: 'Alexandre Martin',
    date: 'Vendredi 8 mai 2026',
    time: '10h00',
    meetUrl: 'https://meet.google.com/xyz-1234-pqr',
    workspaceId: 'demo',
    brandName: 'Rémy Coaching',
    customMessage:
      "Salut Alexandre,\n\nJe suis vraiment ravi qu'on échange ensemble. Prépare 2-3 questions sur ce que tu souhaites travailler, on rentrera direct dans le concret.\n\nÀ très vite !",
  },
  minimal: {
    to: 'prospect@example.com',
    coachName: 'Sophie Laurent',
    prospectName: '',
    date: '12 juin 2026',
    time: '09h00',
    workspaceId: 'demo',
  },
}

const VARIANT_LABELS: Record<string, string> = {
  meet: 'Visio (Meet)',
  location: 'Présentiel (lieu)',
  custom: 'Avec message coach',
  minimal: 'Minimal (sans prénom)',
}

function renderIndex(activeVariant: string): string {
  const tabs = Object.keys(VARIANTS)
    .map((key) => {
      const isActive = key === activeVariant
      const bg = isActive ? '#0A0A0A' : '#ffffff'
      const color = isActive ? '#ffffff' : '#374151'
      const border = isActive ? '#0A0A0A' : '#E5E7EB'
      return `<a href="?variant=${key}" style="display:inline-block; padding:8px 14px; background:${bg}; color:${color}; border:1px solid ${border}; border-radius:8px; font-size:13px; font-weight:600; text-decoration:none; margin-right:8px; margin-bottom:8px;">${VARIANT_LABELS[key]}</a>`
    })
    .join('')

  return `
    <div style="position:sticky; top:0; background:#ffffff; border-bottom:1px solid #E5E7EB; padding:16px 24px; z-index:10; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div>
          <p style="margin:0 0 2px; font-size:11px; font-weight:700; color:#E53E3E; letter-spacing:1px; text-transform:uppercase;">Email preview</p>
          <h1 style="margin:0; font-size:18px; font-weight:700; color:#0A0A0A;">Booking confirmation</h1>
        </div>
        <div>${tabs}</div>
      </div>
    </div>`
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PREVIEW !== '1') {
    return new NextResponse('Not found', { status: 404 })
  }

  const url = new URL(request.url)
  const variant = url.searchParams.get('variant') || 'meet'
  const raw = url.searchParams.get('raw') === '1'

  const params = VARIANTS[variant] ?? VARIANTS.meet
  const html = buildBookingConfirmationHtml(params)

  if (raw) {
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const wrapped = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Email preview — ${VARIANT_LABELS[variant] ?? variant}</title>
<style>body{margin:0;background:#E5E7EB;}</style>
</head>
<body>
${renderIndex(variant)}
<div style="padding:24px;">
  ${html}
</div>
</body>
</html>`

  return new NextResponse(wrapped, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
