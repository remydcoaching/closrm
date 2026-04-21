/**
 * Vérification légère des notifications SNS.
 *
 * Ce n'est PAS une vérification cryptographique de signature — pour ça il
 * faut implémenter la RFC SNS (fetch cert AWS, verify RSA-SHA1/256 sur les
 * champs canonicalisés). À faire via `sns-validator` ou équivalent si on
 * veut du hardening complet.
 *
 * Défense en profondeur actuelle :
 *   1. L'URL du webhook n'est pas publique (pas dans le sitemap)
 *   2. On valide que le TopicArn appartient bien à nos topics connus via
 *      `SES_EXPECTED_TOPIC_ARNS` (env var CSV). Si non set, on désactive
 *      le check (rétro-compat, mais log un warning au boot).
 *
 * ATTENTION : un attaquant qui connaît le TopicArn peut toujours forger
 * des notifications. Pour un hardening complet, implémenter la vérif de
 * signature via `x-amz-sns-signing-cert-url`.
 */

export interface SnsNotificationLike {
  TopicArn?: string
  Type?: string
}

/**
 * Retourne true si la notification provient d'un topic attendu, ou si aucun
 * filtre n'est configuré (rétro-compat — on laisse passer mais on pourrait
 * durcir plus tard).
 */
export function isAllowedSnsTopic(envelope: SnsNotificationLike): boolean {
  const allowed = process.env.SES_EXPECTED_TOPIC_ARNS
  if (!allowed) {
    // Pas de filtre configuré → rétro-compat, on accepte. Log une fois au boot.
    return true
  }
  const topicArn = envelope.TopicArn
  if (!topicArn) return false
  const allowedList = allowed.split(',').map((s) => s.trim()).filter(Boolean)
  return allowedList.includes(topicArn)
}
