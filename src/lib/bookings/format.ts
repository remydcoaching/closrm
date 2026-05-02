/**
 * Date/time formatters for booking emails.
 *
 * Forces the Europe/Paris timezone so the formatted strings reflect the
 * booking time as the prospect sees it, regardless of where the server runs
 * (Vercel functions execute in UTC by default, which would otherwise show
 * a 14h booking as 12h).
 */

const TZ = 'Europe/Paris'

export function formatBookingDateFR(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatBookingTimeFR(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
