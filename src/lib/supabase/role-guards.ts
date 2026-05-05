/**
 * Role-based gates for API routes.
 * Use at the top of any route a monteur should NOT access.
 */
import { NextResponse } from 'next/server'
import type { WorkspaceRole } from '@/types'

/**
 * Returns a 403 NextResponse if the role is 'monteur', else null.
 * Use: const denied = denyMonteur(role); if (denied) return denied;
 */
export function denyMonteur(role: WorkspaceRole) {
  if (role === 'monteur') {
    return NextResponse.json(
      { error: 'Accès refusé — réservé au coach et à l\'équipe.' },
      { status: 403 }
    )
  }
  return null
}
