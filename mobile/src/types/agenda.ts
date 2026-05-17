// AgendaItem = call OU booking unifiés pour la timeline jour mobile.
// Source = origine (call ou booking) pour permettre le routing au tap.

export type AgendaItemSource = 'call' | 'booking'
export type AgendaItemKind = 'setting' | 'closing' | 'meeting' | 'personal'

export interface AgendaItem {
  id: string
  source: AgendaItemSource
  kind: AgendaItemKind
  title: string
  scheduled_at: string
  duration_minutes: number
  // Métadonnées pour navigation et affichage.
  call_id?: string
  booking_id?: string
  lead_id?: string | null
  lead_name?: string | null
  amount?: number | null
  outcome?: 'pending' | 'done' | 'no_show' | 'cancelled' | null
  status?: string | null
  color?: string | null
  location_name?: string | null
  notes?: string | null
}
