import type { SocialPostWithPublications } from '@/types'

export type StepKey = 'brief' | 'montage' | 'publication'

export const STEP_ORDER: StepKey[] = ['brief', 'montage', 'publication']

export const STEP_LABEL: Record<StepKey, string> = {
  brief: 'Brief',
  montage: 'Montage',
  publication: 'Publication',
}

/** Étape ouverte par défaut quand le drawer s'ouvre, selon le statut du slot. */
export function getDefaultStep(slot: SocialPostWithPublications): StepKey {
  if (
    slot.status === 'scheduled' ||
    slot.status === 'published' ||
    slot.status === 'publishing'
  ) {
    return 'publication'
  }
  switch (slot.production_status) {
    case 'idea':
    case 'to_film':
      return 'brief'
    case 'filmed':
    case 'edited':
      return 'montage'
    case 'ready':
      return 'publication'
    default:
      return 'brief'
  }
}

/** Le rond du stepper est-il "vert" (étape complète selon les données) ? */
export function isStepComplete(slot: SocialPostWithPublications, step: StepKey): boolean {
  switch (step) {
    case 'brief': {
      const hookOk = !!slot.hook && slot.hook.trim().length > 0
      const scriptOk = !!slot.script && slot.script.trim().length > 0
      const refsOk = Array.isArray(slot.references_urls) && slot.references_urls.length > 0
      return hookOk && (scriptOk || refsOk)
    }
    case 'montage': {
      return !!slot.final_url && slot.final_url.trim().length > 0
    }
    case 'publication': {
      // A publication record existing for a platform means that platform is configured.
      // SocialPostPublication has no is_enabled field — presence in the array = enabled.
      const hasPlatform = (slot.publications ?? []).length > 0
      const hasMedia = Array.isArray(slot.media_urls) && slot.media_urls.length > 0
      return hasPlatform && hasMedia
    }
  }
}

/** Le footer Discussion doit-il être visible ? */
export function shouldShowDiscussion(slot: SocialPostWithPublications): boolean {
  return !!slot.monteur_id
}

/**
 * Le bouton de transition d'étape est-il visible ?
 * Brief → Montage : quand le brief est prêt à être envoyé au monteur.
 * Montage → Publication : quand la vidéo finale est validée.
 */
export function getTransitionAction(
  slot: SocialPostWithPublications,
  step: StepKey
): { label: string; nextStatus: 'filmed' | 'ready' } | null {
  if (
    step === 'brief' &&
    (slot.production_status === 'idea' || slot.production_status === 'to_film')
  ) {
    return { label: 'Envoyer au montage', nextStatus: 'filmed' }
  }
  if (
    step === 'montage' &&
    !!slot.final_url &&
    slot.final_url.trim().length > 0 &&
    slot.production_status !== 'ready'
  ) {
    return { label: 'Valider le montage', nextStatus: 'ready' }
  }
  return null
}
