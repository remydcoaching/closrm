/**
 * AWS SES Inbound — gestion de la Receipt Rule multi-tenant.
 *
 * Une seule Receipt Rule gère l'inbound de tous les workspaces. Quand un coach
 * ajoute un domaine custom, on injecte `reply.{domain}` dans le tableau
 * Recipients de la rule pour que SES route ses mails vers le SNS topic.
 *
 * Env requis :
 *   SES_INBOUND_RULE_SET_NAME  — nom du rule set actif (ex: "closrm-inbound")
 *   SES_INBOUND_RULE_NAME      — nom de la rule unique (ex: "multi-tenant")
 *
 * Région : eu-west-1 (SES inbound n'est pas dispo en eu-west-3).
 */

import {
  SESClient,
  DescribeReceiptRuleCommand,
  UpdateReceiptRuleCommand,
  type ReceiptRule,
} from '@aws-sdk/client-ses'

const SES_INBOUND_REGION = 'eu-west-1'

let _client: SESClient | null = null
function getClient(): SESClient {
  if (_client) return _client
  _client = new SESClient({ region: SES_INBOUND_REGION })
  return _client
}

function getRuleConfig(): { ruleSetName: string; ruleName: string } | null {
  const ruleSetName = process.env.SES_INBOUND_RULE_SET_NAME
  const ruleName = process.env.SES_INBOUND_RULE_NAME
  if (!ruleSetName || !ruleName) return null
  return { ruleSetName, ruleName }
}

async function fetchRule(): Promise<
  { ok: true; rule: ReceiptRule; ruleSetName: string } | { ok: false; error: string }
> {
  const cfg = getRuleConfig()
  if (!cfg) {
    return { ok: false, error: 'SES_INBOUND_RULE_SET_NAME/SES_INBOUND_RULE_NAME non configurés' }
  }
  try {
    const res = await getClient().send(
      new DescribeReceiptRuleCommand({ RuleSetName: cfg.ruleSetName, RuleName: cfg.ruleName }),
    )
    if (!res.Rule) return { ok: false, error: 'Receipt rule introuvable' }
    return { ok: true, rule: res.Rule, ruleSetName: cfg.ruleSetName }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function saveRule(ruleSetName: string, rule: ReceiptRule): Promise<{ ok: boolean; error?: string }> {
  try {
    await getClient().send(new UpdateReceiptRuleCommand({ RuleSetName: ruleSetName, Rule: rule }))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Ajoute un recipient (ex: "reply.moncoaching.fr") dans la receipt rule.
 * Idempotent : no-op si déjà présent.
 */
export async function addRecipientToRule(recipient: string): Promise<{ ok: boolean; error?: string }> {
  const fetched = await fetchRule()
  if (!fetched.ok) return fetched
  const { rule, ruleSetName } = fetched
  const normalized = recipient.toLowerCase()
  const current = (rule.Recipients || []).map((r) => r.toLowerCase())
  if (current.includes(normalized)) return { ok: true }
  const next: ReceiptRule = { ...rule, Recipients: [...(rule.Recipients || []), recipient] }
  return saveRule(ruleSetName, next)
}

/**
 * Supprime un recipient de la rule. Idempotent.
 */
export async function removeRecipientFromRule(recipient: string): Promise<{ ok: boolean; error?: string }> {
  const fetched = await fetchRule()
  if (!fetched.ok) return fetched
  const { rule, ruleSetName } = fetched
  const normalized = recipient.toLowerCase()
  const current = rule.Recipients || []
  const next = current.filter((r) => r.toLowerCase() !== normalized)
  if (next.length === current.length) return { ok: true }
  return saveRule(ruleSetName, { ...rule, Recipients: next })
}
