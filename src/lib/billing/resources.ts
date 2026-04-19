import type { ResourceType } from '@/types/billing'

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  email: 'Emails',
  ai_tokens: 'Crédits IA',
  whatsapp: 'Messages WhatsApp',
  sms: 'SMS',
}

export const RESOURCE_UNIT: Record<ResourceType, string> = {
  email: 'email',
  ai_tokens: 'tokens',
  whatsapp: 'message',
  sms: 'SMS',
}

/**
 * Coût fournisseur estimé par unité, en cents € avec 4 décimales de précision.
 * Sert à alimenter usage_events.cost_cents_eur pour le margin reporting admin.
 */
export const PROVIDER_COST_CENTS_PER_UNIT: Record<ResourceType, number> = {
  email: 0.0085, // Resend overage $0.90/1000 ≈ 0.85€/1000 = 0.00085€/email
  ai_tokens: 0.0005, // Mix Haiku/Sonnet moyen ~= 5€/M tokens = 0.0005€/token
  whatsapp: 4, // ~0.04€/message utility FR Meta
  sms: 6, // ~0.06€/SMS Twilio/OVH
}

export function estimateProviderCostCents(
  resource: ResourceType,
  quantity: number
): number {
  return PROVIDER_COST_CENTS_PER_UNIT[resource] * quantity
}
