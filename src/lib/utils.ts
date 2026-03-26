import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { LeadStatus, CallOutcome, FollowUpStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', options ?? { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau lead',
  setting_planifie: 'Setting planifié',
  no_show_setting: 'No-show Setting',
  closing_planifie: 'Closing planifié',
  no_show_closing: 'No-show Closing',
  clos: 'Closé ✅',
  dead: 'Dead ❌',
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  nouveau: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  setting_planifie: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  no_show_setting: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  closing_planifie: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  no_show_closing: 'bg-red-500/20 text-red-400 border-red-500/30',
  clos: 'bg-green-500/20 text-green-400 border-green-500/30',
  dead: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
}

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  pending: 'En attente',
  done: 'Fait',
  cancelled: 'Annulé',
  no_show: 'Absent',
}

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  en_attente: 'En attente',
  fait: 'Fait',
  annule: 'Annulé',
}

export const SOURCE_LABELS: Record<string, string> = {
  facebook_ads: 'Facebook Ads',
  instagram_ads: 'Instagram Ads',
  formulaire: 'Formulaire',
  manuel: 'Manuel',
}
