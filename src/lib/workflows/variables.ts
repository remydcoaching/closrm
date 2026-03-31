/**
 * Template variable resolution for workflow messages.
 * Replaces {{variable}} placeholders with actual values from context.
 */

export interface TemplateContext {
  lead?: {
    first_name: string
    last_name: string
    email: string | null
    phone: string
  }
  call?: {
    scheduled_at: string
    type: string
  }
  coach?: {
    full_name: string
  }
  booking_link?: string
}

const MONTHS_FR = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
]

function formatDateFr(isoDate: string): string {
  const date = new Date(isoDate)
  const day = date.getDate()
  const month = MONTHS_FR[date.getMonth()]
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

function formatTimeFr(isoDate: string): string {
  const date = new Date(isoDate)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`
}

export function resolveTemplate(template: string, context: TemplateContext): string {
  let result = template

  // Lead variables
  result = result.replace(/\{\{prenom\}\}/g, context.lead?.first_name ?? '')
  result = result.replace(/\{\{nom\}\}/g, context.lead?.last_name ?? '')
  result = result.replace(/\{\{email\}\}/g, context.lead?.email ?? '')
  result = result.replace(/\{\{telephone\}\}/g, context.lead?.phone ?? '')

  // Call / RDV variables
  if (context.call?.scheduled_at) {
    result = result.replace(/\{\{date_rdv\}\}/g, formatDateFr(context.call.scheduled_at))
    result = result.replace(/\{\{heure_rdv\}\}/g, formatTimeFr(context.call.scheduled_at))
  } else {
    result = result.replace(/\{\{date_rdv\}\}/g, '')
    result = result.replace(/\{\{heure_rdv\}\}/g, '')
  }

  // Coach variables
  result = result.replace(/\{\{nom_coach\}\}/g, context.coach?.full_name ?? '')

  // Booking variables
  result = result.replace(/\{\{lien_booking\}\}/g, context.booking_link ?? '')
  result = result.replace(/\{\{lieu\}\}/g, '') // placeholder for future booking module

  return result
}
