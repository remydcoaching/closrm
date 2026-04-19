# Tâche : Refonte billing V1 (socle P1 + P3 + P4 + UI plan)

**Statut** : code en place, en attente d'application des migrations DB + sortie sandbox AWS SES
**Date de création** : 2026-04-19
**Audits de référence** : `docs/audits/2026-04-19-audit-technique-billing.md`, `docs/audits/2026-04-19-audit-business-pricing.md`

## Objectif

Mettre en place l'infrastructure de billing multi-tenant pour ClosRM : plans Trial/Starter/Pro/Scale/Internal, quotas par ressource (email, IA, WhatsApp), wallet pré-payé, flag `is_internal` pour co-fondateurs. Refondre le système IA en proxy backend (clé Anthropic unique ClosRM). Ajouter quota tracking sur tous les envois email (Resend conservé pour V1, AWS SES prêt en archi pour migration M4-M6).

Scope **non couvert** dans cette phase : Stripe Checkout + Customer Portal (P2), wallet auto-recharge off-session (P5), WhatsApp Meta Cloud API (P6), trial reminders auto (P8), migration effective Resend → AWS SES (à activer quand sandbox AWS sorti).

## Migrations SQL créées

- `supabase/migrations/037_billing_plans.sql` — table `billing_plans` + seed 5 plans
- `supabase/migrations/038_workspace_billing.sql` — colonnes plan/trial/stripe/seats sur `workspaces`, backfill trial 14j
- `supabase/migrations/039_usage_tracking.sql` — table `usage_events` + vue `workspace_current_usage`
- `supabase/migrations/040_wallet.sql` — colonnes wallet sur `workspaces` + table `wallet_transactions`
- `supabase/migrations/041_billing_helpers.sql` — drop `ai_coach_briefs.api_key` + fonctions RPC `consume_resource`, `credit_wallet`, `debit_wallet`

**À appliquer** : commit + push + `supabase db push` (ou via CI).

## Fichiers créés

### Types
- `src/types/billing.ts` — tous les types TS (PlanId, BillingPlan, WorkspaceBilling, UsageEvent, WalletTransaction, QuotaInfo, ConsumeResult)

### Services billing
- `src/lib/billing/service.ts` — `consumeResource()`, `creditWallet()`
- `src/lib/billing/quota.ts` — `getQuotaInfo()`, `getCurrentUsage()`
- `src/lib/billing/resources.ts` — labels, unités, coûts provider estimés

### API routes
- `src/app/api/billing/plan/route.ts` — GET plan + usage + quotas du workspace courant
- `src/app/api/billing/plans/route.ts` — GET liste des plans publics
- `src/app/api/wallet/balance/route.ts` — GET solde wallet
- `src/app/api/wallet/transactions/route.ts` — GET historique wallet

### UI
- `src/app/(dashboard)/parametres/plan/page.tsx` — page "Plan & Usage" : plan actuel, quotas, wallet, bouton gérer abonnement (stub Stripe P2)

## Fichiers modifiés

### IA — refonte proxy
- `src/lib/ai/client.ts` — refondu : plus de param `apiKey`, utilise `ANTHROPIC_API_KEY` env var + integration `consumeResource` pour quota/usage tracking, nouvelle signature `callClaude({ prompt, workspaceId, source, ... })`, classe `AiQuotaExceededError`
- `src/lib/ai/brief.ts` — suppression `getApiKey`, `saveBrief()` sans api_key
- `src/lib/ai/suggest.ts` — utilise nouvelle signature `callClaude()`
- `src/app/api/ai/brief/route.ts` — gère AiQuotaExceededError (402)
- `src/app/api/ai/suggest/route.ts` — gère AiQuotaExceededError (402)
- `src/app/api/ai/learn/route.ts` — utilise nouvelle signature
- `src/app/api/social/generate-caption/route.ts` — utilise nouvelle signature
- `src/app/(dashboard)/parametres/assistant-ia/ai-settings-client.tsx` — suppression étape "Clé API" du wizard (passe de 8 à 7 steps), suppression champ edit api_key

### Email — quota tracking
- `src/lib/workflows/actions/send-email.ts` — check quota + consume avant envoi Resend
- `src/app/api/cron/workflow-scheduler/route.ts` — check quota + consume pour booking reminders email
- `src/app/api/emails/broadcasts/[id]/send/route.ts` — pre-check quota/wallet pour broadcast (bloque si insuffisant), consume après envoi
- `src/lib/email/templates/booking-confirmation.ts` — consume si workspaceId fourni (optionnel pour compat)

### Types
- `src/types/index.ts` — suppression `api_key` de `AiCoachBrief`

### Nav
- `src/components/layout/Sidebar.tsx` — lien "Plan & Usage" ajouté dans section COMPTE
- `src/lib/permissions.ts` — route `/parametres/plan` accessible admin

### Branding `closrm.com` → `closrm.fr` (domaine réel)
- `src/lib/email/client.ts`
- `src/app/api/emails/broadcasts/[id]/send/route.ts`
- `src/components/funnels/v2/WorkspaceNameModal.tsx`
- `src/components/landing/landing-page.tsx`

## Décisions techniques appliquées

1. **Quota + wallet atomique** via fonction SQL `consume_resource(workspace, type, qty, cost, source, metadata)` : check plan → wallet en une seule transaction, pas de race condition.
2. **Estimation grossière tokens IA** (4 char ≈ 1 token) pour pre-check quota avant appel Anthropic. Ajustement post-appel via `response.usage` réel (débit de la différence seulement si la conso dépasse l'estimation).
3. **Bypass `is_internal=true`** : le code SQL et TS court-circuite complètement les checks quota/wallet pour les workspaces co-fondateurs/beta-testeurs.
4. **Fair-use cap email** sur Starter/Pro (30 000/mois) : le dépassement renvoie une erreur 402 avec message d'upgrade plutôt que de débiter un gros montant wallet.
5. **Resend conservé V1** : infra AWS SES codée dans l'audit mais pas activée (attend sortie sandbox AWS + ajustement `email_domains` pour supporter SES).

## Checks validés

- ✅ `npx tsc --noEmit` → 0 erreur
- ✅ `npx eslint` sur tous les fichiers modifiés → 0 erreur
- ✅ Aucune référence `api_key` résiduelle dans `src/`

## Tâches restantes (non V1)

- P2 : intégration Stripe (Checkout, Customer Portal, webhooks, setup intents)
- P5 : wallet recharge auto off-session + UI wallet complète
- P6 : WhatsApp Meta Cloud API + templates + quota WhatsApp
- P7 : UI avancée (comparaison plans, upgrade flow, historique wallet)
- P8 : trial reminders (cron J-3/J-1/J0) + lock features post-trial
- Migration effective Resend → AWS SES (après sortie sandbox)

## Actions admin Pierre requises

1. Appliquer les migrations 037-041 en prod (commit + push + Supabase push)
2. Flagger son workspace + celui de Rémy en `is_internal=true` via SQL :
   ```sql
   UPDATE workspaces SET is_internal = true, plan_id = 'internal', subscription_status = 'internal'
   WHERE id IN ('<uuid-pierre>', '<uuid-remy>');
   ```
3. Ajouter `ANTHROPIC_API_KEY` dans les env vars Vercel (clé Anthropic au nom de l'auto-entreprise ClosRM)
4. Finir setup AWS SES (vérifier CNAME DKIM chez OVH + sortie sandbox)

## Documents de référence

- `docs/audits/2026-04-19-audit-technique-billing.md`
- `docs/audits/2026-04-19-audit-business-pricing.md`
- `taches/tache-aws-ses-dns-records.md`
