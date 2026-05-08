const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://closrm.fr'

function toGoogleDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export interface CalendarLinkParams {
  title: string
  startISO: string
  durationMinutes: number
  location?: string
  description?: string
}

export function buildGoogleCalendarUrl(params: CalendarLinkParams): string {
  const start = new Date(params.startISO)
  const end = new Date(start.getTime() + params.durationMinutes * 60 * 1000)

  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', params.title)
  url.searchParams.set('dates', `${toGoogleDate(start)}/${toGoogleDate(end)}`)
  if (params.location) url.searchParams.set('location', params.location)
  if (params.description) url.searchParams.set('details', params.description)
  return url.toString()
}

export function buildIcsUrl(params: CalendarLinkParams): string {
  const url = new URL(`${APP_URL}/api/bookings/ical`)
  url.searchParams.set('title', params.title)
  url.searchParams.set('start', params.startISO)
  url.searchParams.set('duration', String(params.durationMinutes))
  if (params.location) url.searchParams.set('location', params.location)
  if (params.description) url.searchParams.set('description', params.description)
  return url.toString()
}

export function buildCalendarUrls(params: CalendarLinkParams) {
  return {
    googleCalendarUrl: buildGoogleCalendarUrl(params),
    icsUrl: buildIcsUrl(params),
  }
}
