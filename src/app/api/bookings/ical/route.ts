import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function toIcsDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const title = searchParams.get('title') || 'Rendez-vous'
  const start = searchParams.get('start')
  const duration = parseInt(searchParams.get('duration') || '30', 10)
  const location = searchParams.get('location') || ''
  const description = searchParams.get('description') || ''

  if (!start) {
    return NextResponse.json({ error: 'Missing start parameter' }, { status: 400 })
  }

  const startDate = new Date(start)
  if (isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
  }

  const endDate = new Date(startDate.getTime() + duration * 60 * 1000)
  const uid = `${startDate.getTime()}-${Math.random().toString(36).slice(2)}@closrm.fr`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClosRM//Booking//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${toIcsDate(startDate.toISOString())}`,
    `DTEND:${toIcsDate(endDate.toISOString())}`,
    `SUMMARY:${escapeIcs(title)}`,
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeIcs(description)}`] : []),
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="rendez-vous.ics"`,
    },
  })
}
