export type PlanId = 'trial' | 'starter' | 'pro' | 'scale' | 'internal'

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'suspended'
  | 'internal'

export type ResourceType = 'email' | 'ai_tokens' | 'whatsapp' | 'sms'

export type BilledFrom = 'quota' | 'wallet' | 'internal'

export type WalletTransactionType = 'recharge' | 'debit' | 'refund' | 'adjustment'

export type TransactionInitiator = 'user' | 'auto' | 'admin' | 'system'

export interface BillingPlan {
  id: PlanId
  stripe_price_id: string | null
  stripe_seat_price_id: string | null
  name: string
  description: string | null
  base_price_cents: number
  additional_seat_price_cents: number
  max_seats: number | null
  quota_emails: number
  quota_emails_per_seat: number
  quota_ai_tokens: number
  quota_ai_tokens_per_seat: number
  quota_whatsapp: number
  quota_whatsapp_per_seat: number
  fair_use_emails_cap: number | null
  overage_email_price_cents_per_1k: number
  overage_ai_tokens_price_cents_per_1k: number
  overage_whatsapp_price_cents_per_1k: number
  features: Record<string, unknown>
  display_order: number
  is_active: boolean
  is_public: boolean
}

export interface WorkspaceBilling {
  plan_id: PlanId | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: SubscriptionStatus | null
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  is_internal: boolean
  seats_count: number
  wallet_balance_cents: number
  wallet_auto_recharge_enabled: boolean
  wallet_auto_recharge_amount_cents: number
  wallet_auto_recharge_threshold_cents: number
  stripe_default_payment_method_id: string | null
}

export interface UsageEvent {
  id: string
  workspace_id: string
  resource_type: ResourceType
  quantity: number
  cost_cents_eur: number | null
  source: string
  billed_from: BilledFrom
  amount_cents_debited: number
  billing_period_start: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface WalletTransaction {
  id: string
  workspace_id: string
  type: WalletTransactionType
  amount_cents: number
  balance_after_cents: number
  resource_type: ResourceType | null
  quantity: number | null
  stripe_payment_intent_id: string | null
  stripe_invoice_id: string | null
  initiated_by: TransactionInitiator
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface WorkspaceCurrentUsage {
  workspace_id: string
  plan_id: PlanId | null
  current_period_start: string | null
  current_period_end: string | null
  seats_count: number
  emails_used: number
  ai_tokens_used: number
  whatsapp_used: number
  sms_used: number
  wallet_debited_cents: number
}

export interface ConsumeResult {
  allowed: boolean
  billed_from: BilledFrom | null
  amount_cents_debited: number
  error_message: string | null
}

export interface QuotaInfo {
  plan_id: PlanId
  resource_type: ResourceType
  quota_total: number
  quota_used: number
  quota_remaining: number
  fair_use_cap: number | null
  overage_price_cents_per_1k: number
}
