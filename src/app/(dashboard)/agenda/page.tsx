import { redirect } from 'next/navigation'

/**
 * /agenda → redirige vers /agenda/v2 depuis le cutover de la refonte.
 *
 * L'ancienne implémentation reste accessible via l'historique git si besoin
 * de rollback. Toutes les routes filles (`/agenda/templates`, etc.) restent
 * en place et continuent de fonctionner indépendamment.
 */
export default function AgendaIndexPage() {
  redirect('/agenda/v2')
}
