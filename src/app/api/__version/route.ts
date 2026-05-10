import { NextResponse } from 'next/server'

// Diagnostic uniquement — retourne le SHA Git + horodatage du build Vercel.
// Utilisé pour vérifier qu'un déploiement Vercel a bien embarqué le dernier
// commit de main (et que ce qui tourne en prod n'est pas un bundle bloqué
// sur un ancien commit).
//
// À supprimer après diagnostic.

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'unknown',
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? 'unknown',
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? 'unknown',
    region: process.env.VERCEL_REGION ?? 'unknown',
    builtAt: new Date().toISOString(),
    buildId: process.env.NEXT_PHASE ?? 'unknown',
    nodeEnv: process.env.NODE_ENV,
  })
}
