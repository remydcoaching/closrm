import { NextResponse } from 'next/server'

// Migration 127 not applied yet → explicit 503 the desktop shows as-is.
export function goalsDbError(error: { code?: string; message?: string }) {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return NextResponse.json(
      { code: 'GOALS_MIGRATION_MISSING', error: "La table des objectifs n'existe pas encore : applique la migration 127_goals.sql dans Supabase." },
      { status: 503 },
    )
  }
  if (error.code === '42703' || error.code === 'PGRST204') {
    return NextResponse.json(
      { code: 'GOALS_MIGRATION_MISSING', error: "Applique les dernières migrations des objectifs (129 à 132) dans Supabase pour utiliser cette option." },
      { status: 503 },
    )
  }
  return NextResponse.json({ error: error.message ?? 'Erreur serveur' }, { status: 500 })
}

export function authOrServerError(err: unknown) {
  if (err instanceof Error && err.message === 'Not authenticated') return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}

/** A column that a not-yet-applied migration adds (PostgREST / Postgres codes). */
export function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}
