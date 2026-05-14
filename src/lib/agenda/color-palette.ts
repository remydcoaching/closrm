/**
 * Palette de couleurs disponibles pour override la couleur d'un booking.
 * Inspirée Notion / Linear : 8 teintes saturées + lisibles sur fond sombre.
 *
 * `null` (auto) = pas d'override → la couleur du calendrier l'emporte
 * (ou bleu pour les bookings personnels).
 */

export interface BookingColorOption {
  hex: string
  label: string
}

export const BOOKING_COLOR_PALETTE: BookingColorOption[] = [
  { hex: '#3b82f6', label: 'Bleu' },
  { hex: '#10b981', label: 'Vert' },
  { hex: '#f59e0b', label: 'Orange' },
  { hex: '#ef4444', label: 'Rouge' },
  { hex: '#a855f7', label: 'Violet' },
  { hex: '#ec4899', label: 'Rose' },
  { hex: '#06b6d4', label: 'Cyan' },
  { hex: '#6b7280', label: 'Gris' },
]
