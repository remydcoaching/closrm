# Audit technique — Refonte billing, consommables & IA

**Date** : 2026-04-19
**Auteur** : Pierre (via Claude Code)
**Scope** : Refonte complète du modèle économique de ClosRM pour passage en SaaS payant
**Statut** : À valider par Pierre et Rémy

---

> **MISE À JOUR 2026-04-19 (décision finale pricing email)** :
> Switch complet **Resend → AWS SES en V1**. Raisons :
> 1. **Cap de 10 domaines sur Resend Pro** = blocker pour multi-tenant (besoin Scale $1150 dès 10-15 coachs custom domain)
> 2. **Coût drastiquement inférieur** : $1/10k emails sur SES vs $35 minimum sur Resend même pour 10k
> 3. **Pas de cliff pricing** : AWS SES scale linéairement, Resend a un gap Pro $35 → Scale $1150
> 4. **Domaines illimités** sur SES, problème structurel résolu dès V1
>
> Impact scope : P4 revient à 3.5j (implémentation complète SES), dependency au démarrage : création compte AWS + sortie sandbox (24-48h délai). Total refonte billing : **18j**.

## 1. Résumé exécutif

ClosRM est partiellement architecturé pour le modèle payant :
- ✅ **Email** : clé Resend déjà côté serveur (env var ClosRM), rien à refactor côté clé API. À ajouter : quota tracking.
- ❌ **IA / Claude** : chaque workspace stocke sa propre clé Anthropic dans `ai_coach_briefs.api_key`. À refactor en proxy backend avec clé unique ClosRM.
- ❌ **Billing / Stripe / wallet** : zéro infrastructure, à bâtir from scratch.
- ❌ **WhatsApp / SMS** : UI prévue mais pas d'envoi réel implémenté.

Cette architecture partielle empêche :

1. **Toute monétisation** : impossible de prendre une marge sur des consommables que le client paie directement au fournisseur.
2. **Une UX d'onboarding fluide** : le coach doit créer deux comptes externes (Resend + Anthropic) avant de pouvoir envoyer le moindre email ou utiliser l'IA.
3. **Tout contrôle de coût** : aucune vision consolidée de la consommation par workspace, aucun quota, aucune limite.
4. **Toute logique d'équipe payante** : workspace_members existe, mais pas de notion de "siège facturé".

Cet audit liste **8 phases d'implémentation** (~18 jours de dev) pour transformer ClosRM en SaaS multi-tenant payant avec :
- Souscriptions mensuelles par plan (Starter / Pro / Scale + Trial)
- Quotas inclus de consommables (emails, tokens IA, WhatsApp) resetés chaque mois
- Wallet pré-payé pour l'overage avec recharge automatique CB
- Proxy backend pour tous les appels IA (clé Anthropic unique ClosRM)
- Abstraction provider email (switch Resend ↔ AWS SES sans toucher le code métier)
- Intégration Stripe (Checkout + Customer Portal + webhooks)
- Flag `is_internal` pour workspaces co-fondateurs/beta testeurs (bypass billing)

---

## 2. État actuel du système (factuel, basé sur exploration du repo)

### 2.1 Système email

| Élément | Fichier / migration | État |
|--------|---------------------|------|
| Client HTTP Resend | `src/lib/email/client.ts` | Wrapper `fetch` simple, `EmailConfig { apiKey, fromEmail, fromName }` passée à chaque appel |
| Batch avec rate limit | `src/lib/email/batch-sender.ts` | 100 emails/batch, 1.1s delay |
| Template booking | `src/lib/email/templates/booking-confirmation.ts` | Appel direct `sendEmail()` |
| Workflow action | `src/lib/workflows/actions/send-email.ts` | Appel direct `sendEmail()` |
| Scheduler | `src/app/api/cron/workflow-scheduler/route.ts:360` | Appel direct `sendEmail()` |
| Domaines custom | `supabase/migrations/006_email_module.sql` → `email_domains` | `resend_domain_id`, statut, DNS records par workspace |
| Templates | `email_templates` | Blocs JSONB par workspace |
| Broadcasts | `email_broadcasts` | Brouillons, programmés, envoyés |
| Log envois | `email_sends` | sent/delivered/opened/clicked/bounced/complained |
| Webhook events | `src/app/api/webhooks/resend/route.ts` | Reçoit callbacks Resend |

**Verdict** : architecture propre, bien découpée. L'abstraction provider est quasi-gratuite (1 interface + 2 impls). La migration Resend → AWS SES est **faisable sans casser la UI existante**.

### 2.2 Système IA / Claude

| Élément | Fichier / migration | État |
|--------|---------------------|------|
| Client SDK | `src/lib/ai/client.ts` | `@anthropic-ai/sdk`, signature `callClaude(prompt, apiKey, model)` |
| Stockage clé API | `supabase/migrations/019_ai_api_key.sql` → colonne `ai_coach_briefs.api_key` | Clé par workspace |
| Brief coach | `src/lib/ai/brief.ts:28-31` (`getApiKey`) + `:47-48` | Utilise Sonnet, bloque si pas de clé |
| Suggestions messages | `src/lib/ai/suggest.ts:67` | Utilise Haiku par défaut |
| Apprentissage | `src/app/api/ai/learn/route.ts` | Analyse conversations wons |
| Caption sociale | `src/app/api/social/generate-caption/route.ts` | Génération posts |
| UI settings | `src/app/(dashboard)/parametres/assistant-ia/ai-settings-client.tsx` | Formulaire saisie clé API |

**Verdict** : à refondre en profondeur. La clé doit passer **côté serveur** (env var ClosRM unique), tous les appels transitent par un proxy `/api/ai/complete` qui débite les tokens du quota workspace puis du wallet.

### 2.3 Système billing / Stripe

**État : zéro infrastructure.**

| Élément recherché | Résultat |
|-------------------|----------|
| Library Stripe dans `package.json` | Absente |
| Table `plans`, `subscriptions`, `invoices` | Aucune |
| Colonnes `stripe_customer_id`, `plan_id` sur `workspaces` | Aucune |
| Webhook Stripe | Aucun |
| Variable env Stripe | Absente |
| UI "Plan & facturation" dans paramètres | Absente |

**Verdict** : à construire from scratch.

### 2.4 Système WhatsApp / SMS

| Élément | État |
|--------|------|
| UI channel dans follow-ups | Présente (`ChannelBadge.tsx`) |
| Workflow action `send_whatsapp` | Référencée dans workflows mais **pas d'implémentation d'envoi réel** |
| Lib Meta Cloud API | Aucune |
| Webhook réception WhatsApp | Aucun |
| Table log WhatsApp sends | Aucune |

**Verdict** : à implémenter en parallèle du billing pour que l'intégration soit native à notre modèle (quota + wallet dès le day-1).

### 2.5 Structure workspace / multi-tenant

| Élément | Fichier / migration | État |
|--------|---------------------|------|
| Table `workspaces` | `supabase/schema.sql:8` | Minimale : `id, name, owner_id, created_at` |
| Table `users` | `supabase/schema.sql:20` | Profil + rôle (`coach/setter/closer`) |
| Table `workspace_members` | `supabase/migrations/023_workspace_members.sql` | Rôles `admin/setter/closer`, backfill owner fait |
| Fonction `user_workspace_ids()` | migration 023 | Helper RLS |
| Trigger `handle_new_user` | schema.sql + migration 023 | Crée workspace + user + member à l'inscription |

**Verdict** : base solide. Il suffit d'ajouter des colonnes à `workspaces` pour plan, trial, stripe, wallet, is_internal, seats_count.

---

## 3. Architecture cible

### 3.1 Diagramme logique

```
┌────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js App)                         │
│  Settings > Plan & Facturation   Settings > Wallet   Features      │
└─────────────┬───────────────────────┬──────────────────────┬───────┘
              │                       │                      │
              ▼                       ▼                      ▼
    ┌─────────────────┐      ┌────────────────┐    ┌────────────────┐
    │ /api/billing/*  │      │ /api/wallet/*  │    │ /api/ai/*      │
    │ /api/stripe/*   │      │                │    │ /api/emails/*  │
    └────────┬────────┘      └────────┬───────┘    └────────┬───────┘
             │                        │                     │
             ▼                        ▼                     ▼
    ┌────────────────────────────────────────────────────────────┐
    │              Billing Service (new)                          │
    │  - quota_check()                                           │
    │  - consume_quota_or_wallet()                               │
    │  - record_usage_event()                                    │
    │  - trigger_auto_recharge() via Stripe                      │
    └──────┬──────────────┬───────────────┬──────────────┬──────┘
           │              │               │              │
           ▼              ▼               ▼              ▼
    ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐
    │ Supabase │  │ Stripe API   │  │ Anthropic│  │ AWS SES    │
    │ (Postgres│  │ (Sub, Invoice│  │ (via     │  │ (or Resend)│
    │  + RLS)  │  │  SetupIntent)│  │  Gateway)│  │            │
    └──────────┘  └──────────────┘  └──────────┘  └────────────┘
```

### 3.2 Contrat du `BillingService`

Pseudo-TypeScript :

```ts
interface BillingService {
  // Avant chaque consommation : vérifie quota inclus puis wallet
  checkAvailability(
    workspaceId: string,
    resourceType: 'email' | 'ai_tokens' | 'whatsapp' | 'sms',
    quantity: number,
  ): Promise<{ allowed: boolean; source: 'quota' | 'wallet' | 'blocked'; reason?: string }>

  // Débite réellement après consommation réussie
  consume(
    workspaceId: string,
    resourceType: ResourceType,
    quantity: number,
    cost_cents_eur: number, // coût fournisseur réel pour margin reporting
    source: string, // 'workflow', 'manual', 'broadcast', 'ai_suggest'...
    metadata?: Record<string, unknown>,
  ): Promise<void>

  // Déclenche recharge Stripe off-session si solde < threshold
  maybeAutoRecharge(workspaceId: string): Promise<{ triggered: boolean; amount_cents?: number }>

  // Stats usage par période
  getUsageForPeriod(workspaceId: string, periodStart: Date): Promise<UsageReport>
}
```

### 3.3 Abstraction provider email

```ts
// src/lib/email/providers/types.ts
interface EmailProvider {
  sendOne(params: SendOneParams): Promise<SendResult>
  sendBatch(params: SendBatchParams): Promise<BatchResult>
  verifyDomain(domain: string, workspaceId: string): Promise<DomainStatus>
  getDomainStatus(domainId: string): Promise<DomainStatus>
  // webhook handlers
  handleDeliveryEvent(payload: unknown): Promise<void>
}

// src/lib/email/providers/resend.ts
export const ResendProvider: EmailProvider = { ... }

// src/lib/email/providers/ses.ts
export const SesProvider: EmailProvider = { ... }

// src/lib/email/index.ts
export const emailProvider: EmailProvider =
  process.env.EMAIL_PROVIDER === 'ses' ? SesProvider : ResendProvider
```

Les appelants (workflows, batch-sender, templates) importent `emailProvider` sans se soucier du provider sous-jacent.

### 3.4 Proxy IA

```ts
// src/app/api/ai/complete/route.ts
POST { prompt: string, model?: 'haiku'|'sonnet'|'opus', maxTokens?: number }

1. Récupérer workspace_id depuis session
2. billingService.checkAvailability('ai_tokens', estimateTokens(prompt, maxTokens))
3. Si bloqué : 402 Payment Required avec lien upgrade/recharge
4. Router vers modèle via Vercel AI Gateway ('anthropic/claude-haiku-4-5', 'anthropic/claude-sonnet-4-6', etc.)
5. Récupérer response.usage.input_tokens + response.usage.output_tokens
6. billingService.consume('ai_tokens', inputTokens + outputTokens, calculateCostCents(...), 'ai_proxy')
7. Renvoyer la completion
```

### 3.5 Logique wallet + quota

```
Débiter N unités de "email" pour workspace W :

quota_used = sum(usage_events.quantity WHERE workspace=W AND type='email' AND period=current_period)
quota_remaining = workspace.plan.quota_emails - quota_used

IF quota_remaining >= N:
  → insert usage_event(quantity=N, source='quota')
  → OK, pas de débit wallet

ELSE IF quota_remaining > 0:
  from_quota = quota_remaining
  from_wallet = N - from_quota
  → insert usage_event(quantity=from_quota, source='quota_partial')
  → cost_in_wallet = from_wallet * overage_unit_price_cents
  → IF workspace.wallet_balance < cost_in_wallet:
      → trigger_auto_recharge()  // si activée, attend paiement
      → IF still insufficient: BLOCK
  → decrement wallet_balance by cost_in_wallet
  → insert wallet_transaction(debit, cost_in_wallet, type='email')
  → insert usage_event(quantity=from_wallet, source='wallet')

ELSE (quota épuisé):
  cost_in_wallet = N * overage_unit_price_cents
  → même logique wallet que ci-dessus
```

---

## 4. Phases d'implémentation

| Phase | Titre | Durée | Bloquant pour |
|-------|-------|-------|---------------|
| P1 | Infra billing & plans (DB + helpers) | 1.5j | P2 à P8 |
| P2 | Stripe integration (Checkout + portail + webhooks) | 2.5j | P5, P8 |
| P3 | Refonte IA (proxy + tracking) | 3j | — |
| P4 | Email : switch complet Resend → AWS SES + quota tracking | 3.5j | Sortie sandbox AWS (24-48h) |
| P5 | Wallet & overage | 2j | — (dépend P2) |
| P6 | WhatsApp/SMS intégration + billing | 3j | — |
| P7 | UI Paramètres > Plan & Usage | 1.5j | — |
| P8 | Trial system + reminders | 1j | — (dépend P2) |

**Total : ~18 jours** de dev solo, parallélisable :
- **Pierre** : P1 → P2 → P5 → P7 → P8 (billing-centric)
- **Rémy** : P3 → P4 → P6 (providers-centric)

### P1 — Infra billing & plans (1.5j)

**Livrables** :
- Migration 037_billing_plans.sql
- Migration 038_workspace_billing.sql
- Migration 039_usage_tracking.sql
- Migration 040_wallet.sql
- `src/lib/billing/service.ts` (BillingService)
- `src/lib/billing/resources.ts` (types de ressources, conversions)
- `src/lib/billing/quota.ts` (checks + consommation)
- Seed initial 4 plans (trial/starter/pro/scale)

**Critères de done** :
- Toutes les migrations appliquées en local
- Test unitaire : `checkAvailability` renvoie bien `quota / wallet / blocked` selon les cas
- Flag `is_internal = true` sur workspace Pierre → bypass tous les checks

### P2 — Stripe integration (2.5j)

**Livrables** :
- `npm install stripe @stripe/stripe-js`
- ENV vars : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_STARTER`, etc.
- `src/lib/stripe/client.ts` (singleton Stripe)
- `src/app/api/stripe/checkout/route.ts` (création session Checkout)
- `src/app/api/stripe/portal/route.ts` (redirection Customer Portal)
- `src/app/api/stripe/webhooks/route.ts` (handlers : `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`)
- Création auto `stripe_customer_id` à l'inscription (hook Supabase `handle_new_user` OU lazy à la 1ère visite facturation)
- SetupIntent flow pour sauvegarder la CB (wallet auto-recharge)

**Critères de done** :
- Un coach peut souscrire Pro via Stripe Checkout → retour à `/parametres/plan` avec plan actif
- Le webhook met à jour `subscription_status`, `current_period_start/end`, `plan_id`
- Customer Portal accessible depuis UI

### P3 — Refonte IA (3j)

**Livrables** :
- Migration 041_drop_ai_api_key.sql (retire colonne `ai_coach_briefs.api_key`)
- `src/lib/ai/client.ts` refactoré : plus de param `apiKey`, utilise clé ClosRM + Vercel AI Gateway
- Nouveau `src/app/api/ai/complete/route.ts` (proxy unique)
- Refactor `src/lib/ai/brief.ts` → appelle le proxy
- Refactor `src/lib/ai/suggest.ts` → appelle le proxy
- Refactor `src/app/api/ai/learn/route.ts` → appelle le proxy
- Refactor `src/app/api/social/generate-caption/route.ts` → appelle le proxy
- Suppression/refonte `src/app/(dashboard)/parametres/assistant-ia/ai-settings-client.tsx` → plus de champ clé API, remplacé par affichage quota restant + historique
- ENV var `ANTHROPIC_API_KEY` (ou `AI_GATEWAY_API_KEY` si Vercel Gateway)

**Critères de done** :
- Aucun appel Anthropic direct dans le code hors du proxy
- Aucune table ne contient de clé API utilisateur
- Consommation IA d'un workspace apparaît dans `usage_events` avec coût correct
- Workspace sans quota → 402 avec message "Rechargez votre wallet ou upgradez votre plan"

### P4 — Switch complet Resend → AWS SES (3.5j) + sortie sandbox AWS (24-48h)

**Décision finale (2026-04-19)** : AWS SES dès la V1 payante. Raison : le cap de 10 domaines sur Resend Pro est un vrai blocker pour un SaaS multi-tenant où chaque coach vérifie son propre domaine. À Scale Resend ($1150/mois) c'est $13k/an versus $1-30/mois sur AWS SES au même volume. Le switch est économiquement évident et le dev (3.5j) est négligeable vs bénéfices long terme.

**Pré-requis (à faire en parallèle du dev)** :
- Compte AWS créé au nom de l'auto-entreprise Pierre (15 min)
- Région **eu-west-3 (Paris)** activée (RGPD + latence)
- Demande de sortie sandbox SES envoyée (5 min + 24-48h délai AWS)
- IAM user `closrm-ses-production` + clés API (10 min)
- SNS topic pour bounces/complaints configuré (15 min)
- Voir guide détaillé "Setup AWS SES step-by-step" en annexe de ce doc

**Livrables code** :
- `src/lib/email/providers/types.ts` (interface `EmailProvider`)
- `src/lib/email/providers/ses.ts` (impl complète via `@aws-sdk/client-ses` + `@aws-sdk/client-sesv2` + `@aws-sdk/client-sns`)
- `src/lib/email/index.ts` (export `emailProvider` directement SES, plus de conditionnel)
- Refactor des 4 call sites pour utiliser `emailProvider.sendOne / sendBatch` :
  - `src/lib/workflows/actions/send-email.ts`
  - `src/app/api/cron/workflow-scheduler/route.ts:356`
  - `src/app/api/emails/broadcasts/[id]/send/route.ts:108`
  - `src/lib/email/templates/booking-confirmation.ts`
- Ajouter `billingService.checkAvailability(workspaceId, 'email', N)` avant chaque envoi
- Ajouter `billingService.consume(workspaceId, 'email', N, cost_cents, source)` après envoi
- Webhook SNS `src/app/api/webhooks/ses/route.ts` pour recevoir bounces/complaints/delivery events
- Refactor domain verification : suppression des appels Resend, utilisation SES `CreateEmailIdentity` + DKIM + SNS topic
- Migration `email_domains` : ajouter `ses_identity_arn`, marquer `resend_domain_id` comme legacy
- Retirer dépendance Resend du code (garder la clé RESEND_API_KEY en env var optionnelle pour fallback temporaire si besoin)

**Migration données existantes** :
- Aucun domain vérifié à migrer en prod réelle (workspaces actuels = Pierre + Rémy = `is_internal=true`)
- Si Rémy ou Pierre avait des domaines vérifiés sur Resend → re-vérifier sur SES (5 min chacun)

**ENV vars à ajouter** :
```
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SES_CONFIG_SET=closrm-default
AWS_SNS_SES_TOPIC_ARN=arn:aws:sns:eu-west-3:XXX:closrm-ses-bounces
EMAIL_FROM_DEFAULT=noreply@closrm.com
```

**Critères de done** :
- Envoi email depuis workspace Pierre fonctionne via SES (après sortie sandbox)
- Domain verification d'un nouveau domaine coach fonctionne via SES (CNAME DKIM à ajouter chez registrar)
- Envoi d'un broadcast 100 emails traqué dans `usage_events`
- Webhook SNS reçoit un bounce test et met à jour `email_sends.status`
- Workspace avec quota dépassé + wallet vide → envoi bloqué avec erreur claire
- Workspace `is_internal=true` → bypass complet, envoi toujours autorisé
- Taux de bounce d'un workspace > 3% → suspension automatique + email admin

**Resend** :
- Compte Resend conservé en backup uniquement (env var `RESEND_API_KEY` peut rester)
- Aucun appel Resend dans le code de prod
- Domaine(s) vérifié(s) sur Resend peuvent être abandonnés ou laissés dormir

### P5 — Wallet & overage (2j)

**Livrables** :
- `src/app/api/wallet/balance/route.ts` (GET balance)
- `src/app/api/wallet/recharge/route.ts` (POST → SetupIntent si pas de CB, sinon PaymentIntent)
- `src/app/api/wallet/auto-recharge/route.ts` (PUT config)
- `src/app/api/wallet/transactions/route.ts` (GET historique paginé)
- `src/lib/billing/auto-recharge.ts` (logic `maybeAutoRecharge`)
- Cron quotidien `src/app/api/cron/check-low-wallets/route.ts` (safety net)
- UI `src/app/(dashboard)/parametres/wallet/` (balance, recharge manuelle, config auto-recharge, historique)

**Critères de done** :
- Coach peut recharger 10€ manuellement → balance augmente
- Coach active auto-recharge (seuil 2€, montant 10€) → quand il consomme l'overage et balance < 2€, Stripe débite 10€ automatiquement
- Historique transactions visible

### P6 — WhatsApp / SMS + billing (3j)

**Livrables** :
- Migration 042_whatsapp_integration.sql (`whatsapp_sends`, `whatsapp_templates`, colonnes integration)
- `src/lib/whatsapp/client.ts` (Meta Cloud API wrapper)
- `src/app/api/whatsapp/send/route.ts`
- `src/app/api/webhooks/whatsapp/route.ts` (réception delivery events + messages entrants)
- Refactor `src/lib/workflows/actions/send-whatsapp.ts` (nouveau)
- Refactor UI follow-ups pour envoyer réellement
- Quota check + débit wallet sur chaque envoi
- **Décision à trancher** : SMS V1 ou V2 ? Si V1 → Twilio ou OVH SMS

**Critères de done** :
- Envoi WhatsApp depuis follow-up fonctionne en prod sur le compte Meta ClosRM
- Workflow avec action `send_whatsapp` déclenche réellement l'envoi
- Consommation trackée et débitée

### P7 — UI Paramètres > Plan & Usage (1.5j)

**Livrables** :
- `src/app/(dashboard)/parametres/plan/page.tsx` (affiche plan actuel, barres de progression quotas, bouton upgrade)
- `src/app/(dashboard)/parametres/plan/usage/page.tsx` (détail consommation période en cours + historique)
- `src/app/(dashboard)/parametres/wallet/page.tsx` (fait en P5)
- Modal "Changer de plan" → Stripe Customer Portal
- Composant `QuotaBar` réutilisable
- Badges de statut (trial ending, past_due, suspended)

**Critères de done** :
- Page plan affiche : plan actuel, next billing date, quotas utilisés/restants
- Click "Upgrader" → redirige vers Stripe Customer Portal

### P8 — Trial system (1j)

**Livrables** :
- Trigger modifié `handle_new_user` : set `trial_ends_at = now() + 14 days`, `plan_id = 'trial'`, `subscription_status = 'trial'`
- Middleware qui vérifie `trial_ends_at` et `subscription_status` pour lock les features
- Composant banner `TrialCountdown` dans le layout dashboard
- Cron `src/app/api/cron/trial-reminders/route.ts` : envoie email J-3, J-1, J0
- Page "Votre essai est terminé" avec CTA upgrade
- Email templates Resend pour les 3 reminders

**Critères de done** :
- Nouveau user inscrit → trial 14j actif
- À J+14 → features lock, page "upgrade required"
- Upgrade réussi → status passe à `active`, features débloquées

---

## 5. Migrations SQL détaillées

### 5.1 Migration 037 — `billing_plans`

```sql
-- supabase/migrations/037_billing_plans.sql

CREATE TABLE billing_plans (
  id TEXT PRIMARY KEY,
  stripe_price_id TEXT, -- NULL pour 'trial' et 'internal'
  stripe_seat_price_id TEXT, -- metered price pour sièges additionnels
  name TEXT NOT NULL,
  description TEXT,
  base_price_cents INT NOT NULL DEFAULT 0,
  additional_seat_price_cents INT NOT NULL DEFAULT 0,
  max_seats INT, -- NULL = illimité
  quota_emails INT NOT NULL DEFAULT 0,
  quota_ai_tokens BIGINT NOT NULL DEFAULT 0,
  quota_whatsapp INT NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}',
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO billing_plans (id, name, base_price_cents, additional_seat_price_cents, max_seats, quota_emails, quota_ai_tokens, quota_whatsapp, display_order) VALUES
  ('trial',   'Essai 14 jours', 0,     0,    1,    500,    50000,    50,   0),
  ('starter', 'Starter',        2900,  0,    1,    5000,   500000,   300,  1),
  ('pro',     'Pro',            5900,  2900, 3,    20000,  2000000,  1500, 2),
  ('scale',   'Scale',          14900, 4900, NULL, 100000, 10000000, 8000, 3),
  ('internal','Interne (bypass)', 0,   0,    NULL, 2147483647, 9223372036854775807, 2147483647, 99);
```

### 5.2 Migration 038 — `workspaces` billing columns

```sql
-- supabase/migrations/038_workspace_billing.sql

ALTER TABLE workspaces
  ADD COLUMN plan_id TEXT REFERENCES billing_plans(id),
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN subscription_status TEXT CHECK (subscription_status IN ('trial','active','past_due','canceled','suspended','internal')),
  ADD COLUMN trial_ends_at TIMESTAMPTZ,
  ADD COLUMN current_period_start TIMESTAMPTZ,
  ADD COLUMN current_period_end TIMESTAMPTZ,
  ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN seats_count INT NOT NULL DEFAULT 1;

-- Backfill workspaces existants en 'trial' 14 jours depuis maintenant
UPDATE workspaces SET
  plan_id = 'trial',
  subscription_status = 'trial',
  trial_ends_at = now() + interval '14 days',
  current_period_start = now(),
  current_period_end = now() + interval '14 days'
WHERE plan_id IS NULL;

-- Marquer les workspaces des co-fondateurs comme internal (à faire manuellement avec UPDATE ciblé)
-- UPDATE workspaces SET is_internal = true, plan_id = 'internal', subscription_status = 'internal' WHERE id IN ('...uuid Pierre...', '...uuid Rémy...');

-- Modifier le trigger handle_new_user pour initialiser trial automatiquement
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  INSERT INTO workspaces (name, owner_id, plan_id, subscription_status, trial_ends_at, current_period_start, current_period_end)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'full_name', 'Mon workspace') || ' — Workspace',
    new.id,
    'trial',
    'trial',
    now() + interval '14 days',
    now(),
    now() + interval '14 days'
  ) RETURNING id INTO new_workspace_id;

  INSERT INTO users (id, workspace_id, email, role, full_name)
  VALUES (new.id, new_workspace_id, new.email, 'coach', COALESCE(new.raw_user_meta_data->>'full_name', ''));

  INSERT INTO workspace_members (workspace_id, user_id, role, status, activated_at)
  VALUES (new_workspace_id, new.id, 'admin', 'active', now());

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.3 Migration 039 — `usage_events`

```sql
-- supabase/migrations/039_usage_tracking.sql

CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('email','ai_tokens','whatsapp','sms')),
  quantity BIGINT NOT NULL,
  cost_cents_eur NUMERIC(10,4), -- coût fournisseur estimé, pour margin reporting
  source TEXT NOT NULL, -- 'workflow', 'manual', 'broadcast', 'ai_suggest', 'ai_brief', etc.
  billed_from TEXT NOT NULL CHECK (billed_from IN ('quota','wallet','internal')),
  amount_cents_debited INT DEFAULT 0, -- uniquement si billed_from='wallet'
  metadata JSONB,
  billing_period_start TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_events_workspace_period
  ON usage_events(workspace_id, billing_period_start, resource_type);

CREATE INDEX idx_usage_events_created
  ON usage_events(created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_events_workspace" ON usage_events FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active')
);

-- Vue matérialisée pour consommation période en cours (rafraîchie à chaque lecture ou via cron)
CREATE OR REPLACE VIEW workspace_current_usage AS
SELECT
  w.id AS workspace_id,
  w.plan_id,
  w.current_period_start,
  COALESCE(SUM(ue.quantity) FILTER (WHERE ue.resource_type = 'email'), 0) AS emails_used,
  COALESCE(SUM(ue.quantity) FILTER (WHERE ue.resource_type = 'ai_tokens'), 0) AS ai_tokens_used,
  COALESCE(SUM(ue.quantity) FILTER (WHERE ue.resource_type = 'whatsapp'), 0) AS whatsapp_used,
  COALESCE(SUM(ue.quantity) FILTER (WHERE ue.resource_type = 'sms'), 0) AS sms_used
FROM workspaces w
LEFT JOIN usage_events ue ON ue.workspace_id = w.id AND ue.billing_period_start = w.current_period_start
GROUP BY w.id, w.plan_id, w.current_period_start;
```

### 5.4 Migration 040 — `wallet`

```sql
-- supabase/migrations/040_wallet.sql

ALTER TABLE workspaces
  ADD COLUMN wallet_balance_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN wallet_auto_recharge_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN wallet_auto_recharge_amount_cents INT NOT NULL DEFAULT 1000,
  ADD COLUMN wallet_auto_recharge_threshold_cents INT NOT NULL DEFAULT 200,
  ADD COLUMN stripe_default_payment_method_id TEXT;

CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('recharge','debit','refund','adjustment')),
  amount_cents INT NOT NULL, -- positif credit, negatif debit
  balance_after_cents INT NOT NULL,
  resource_type TEXT, -- seulement si type='debit'
  quantity BIGINT, -- seulement si type='debit'
  stripe_payment_intent_id TEXT, -- seulement si type='recharge'
  initiated_by TEXT CHECK (initiated_by IN ('user','auto','admin','system')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wallet_tx_workspace ON wallet_transactions(workspace_id, created_at DESC);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_tx_workspace" ON wallet_transactions FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active')
);
```

### 5.5 Migration 041 — drop clé API IA

```sql
-- supabase/migrations/041_drop_ai_api_key.sql
ALTER TABLE ai_coach_briefs DROP COLUMN IF EXISTS api_key;
```

### 5.6 Migration 042 — WhatsApp intégration (P6)

```sql
-- supabase/migrations/042_whatsapp.sql

CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meta_template_name TEXT, -- nom approuvé côté Meta
  language TEXT NOT NULL DEFAULT 'fr',
  category TEXT CHECK (category IN ('marketing','utility','authentication')),
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE whatsapp_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  meta_message_id TEXT,
  to_phone TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed')),
  cost_cents_eur NUMERIC(10,4),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_whatsapp_sends_workspace ON whatsapp_sends(workspace_id, sent_at DESC);
CREATE INDEX idx_whatsapp_sends_meta_id ON whatsapp_sends(meta_message_id) WHERE meta_message_id IS NOT NULL;

-- Policies workspace-scoped...
```

---

## 6. Fichiers à modifier (inventaire exhaustif)

### 6.1 À créer
- `src/lib/billing/service.ts`
- `src/lib/billing/quota.ts`
- `src/lib/billing/resources.ts`
- `src/lib/billing/auto-recharge.ts`
- `src/lib/stripe/client.ts`
- `src/lib/email/providers/types.ts`
- `src/lib/email/providers/resend.ts`
- `src/lib/email/providers/ses.ts`
- `src/lib/email/index.ts`
- `src/lib/whatsapp/client.ts`
- `src/app/api/ai/complete/route.ts`
- `src/app/api/stripe/checkout/route.ts`
- `src/app/api/stripe/portal/route.ts`
- `src/app/api/stripe/webhooks/route.ts`
- `src/app/api/wallet/balance/route.ts`
- `src/app/api/wallet/recharge/route.ts`
- `src/app/api/wallet/transactions/route.ts`
- `src/app/api/wallet/auto-recharge/route.ts`
- `src/app/api/webhooks/ses/route.ts`
- `src/app/api/webhooks/whatsapp/route.ts`
- `src/app/api/cron/trial-reminders/route.ts`
- `src/app/api/cron/check-low-wallets/route.ts`
- `src/app/(dashboard)/parametres/plan/page.tsx`
- `src/app/(dashboard)/parametres/plan/usage/page.tsx`
- `src/app/(dashboard)/parametres/wallet/page.tsx`
- `src/components/billing/QuotaBar.tsx`
- `src/components/billing/TrialCountdownBanner.tsx`
- `src/components/billing/PlanComparisonCards.tsx`
- `supabase/migrations/037_billing_plans.sql`
- `supabase/migrations/038_workspace_billing.sql`
- `supabase/migrations/039_usage_tracking.sql`
- `supabase/migrations/040_wallet.sql`
- `supabase/migrations/041_drop_ai_api_key.sql`
- `supabase/migrations/042_whatsapp.sql`

### 6.2 À modifier
- `src/lib/ai/client.ts` (supprime param `apiKey`)
- `src/lib/ai/brief.ts` (supprime `getApiKey`, utilise proxy)
- `src/lib/ai/suggest.ts` (idem)
- `src/app/api/ai/learn/route.ts` (idem)
- `src/app/api/social/generate-caption/route.ts` (idem)
- `src/app/(dashboard)/parametres/assistant-ia/ai-settings-client.tsx` (refonte totale : plus de saisie clé, affichage quota)
- `src/lib/email/client.ts` (deprecated, redirige vers `emailProvider`)
- `src/lib/email/batch-sender.ts` (utilise `emailProvider`)
- `src/lib/email/templates/booking-confirmation.ts` (idem)
- `src/lib/workflows/actions/send-email.ts` (idem + quota check)
- `src/lib/workflows/actions/send-whatsapp.ts` (NEW)
- `src/app/api/cron/workflow-scheduler/route.ts` (quota checks)
- `src/types/index.ts` (nouveaux types : `BillingPlan`, `WorkspaceSubscription`, `UsageEvent`, `WalletTransaction`)

### 6.3 ENV vars à ajouter
- `ANTHROPIC_API_KEY` (ou `AI_GATEWAY_API_KEY` si Vercel Gateway)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_PRO_SEAT`, `STRIPE_PRICE_ID_SCALE`, `STRIPE_PRICE_ID_SCALE_SEAT`
- `EMAIL_PROVIDER=resend|ses`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SNS_TOPIC_ARN` (si SES)
- `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`

---

## 7. Risques et décisions clés

### 7.1 Risques

| # | Risque | Probabilité | Impact | Mitigation |
|---|--------|-------------|--------|------------|
| R1 | AWS SES sandbox mode bloque les envois jusqu'à sortie (24-48h AWS) | Haute | Moyen | Démarches AWS dès P1, garder Resend en fallback |
| R2 | Bounce rate AWS SES > 5% → suspension compte ClosRM entier | Moyenne | Critique | Monitoring SNS, auto-suspend workspace si > 3%, vérif domaine obligatoire |
| R3 | Conversion trial → payant trop faible (< 10%) | Haute | Critique | A/B test messages trial, onboarding fort, 1er appel coach offert |
| R4 | Abus wallet : coach enchaîne mini-recharges 5€ pour éviter l'engagement | Moyenne | Faible | Minimum recharge 10€, bloquer spam Stripe |
| R5 | Meta WhatsApp refuse certains templates marketing | Moyenne | Moyen | Commencer avec catégorie "utility" (rappels RDV) seulement en V1 |
| R6 | Migration data existante : coachs actuels qui ont leur propre clé Anthropic vont râler | Moyenne | Moyen | Com proactive, période de grâce 30j, migration auto de leur clé vers notre compte (impossible techniquement → simplement donner plus de quota trial) |
| R7 | Quota check ajoute latence à chaque envoi email / appel IA | Basse | Faible | Cache wallet_balance + usage en mémoire Redis/KV (Vercel KV), invalidation sur write |

### 7.2 Décisions à trancher (voir audit business pour arbitrages)

| ID | Décision | Options | Reco technique |
|----|----------|---------|----------------|
| D1 | Provider email V1 | (a) Resend direct (b) Abstraction + Resend (c) Abstraction + AWS SES direct | **(b)** — abstraction gratuite, Resend OK pour bêta, SES quand volume justifie |
| D2 | Proxy IA via ? | (a) Appel direct Anthropic (b) Vercel AI Gateway | **(b)** — monitoring + failover + multi-provider gratuit |
| D3 | Stripe UI | (a) Custom (b) Stripe Checkout + Customer Portal | **(b)** — zéro UI custom à bâtir, 100% maintenu par Stripe |
| D4 | WhatsApp dans V1 payante ? | (a) Oui dès day-1 (b) Report V2 | **(a)** — c'est un argument de vente fort, et la conso est trackable facilement |
| D5 | SMS dans V1 ? | (a) Oui via Twilio (b) Non | **(b)** — WhatsApp suffit pour la cible coach francophone, SMS trop cher |
| D6 | Grace period past_due | (a) Suspension immédiate (b) 3 jours (c) 7 jours | **(b)** — standard SaaS, laisse le temps de mettre à jour la CB |

---

## 8. Observabilité & monitoring requis

Sans observabilité, on pilote à l'aveugle. Les KPIs à monitorer dès le J1 :

### 8.1 Dashboard admin interne (nouvelle page `/admin/metrics` pour `is_internal=true` users)
- MRR total, par plan, évolution mois par mois
- Nombre de workspaces actifs par plan
- Churn rate mensuel
- Trial → Payant conversion rate
- Top consommateurs (emails, IA, WhatsApp)
- Marge brute par workspace (revenu - coût provider)
- Workspaces approchant limite quota (alerte upsell)

### 8.2 Alertes à configurer
- Alerte si `bounce_rate` d'un workspace > 3% (risque SES)
- Alerte si un workspace consomme > 10× la moyenne (fraude ou bug)
- Alerte Stripe webhook failed
- Alerte recharge auto failed (carte refusée)
- Alerte Anthropic rate limit atteint

### 8.3 Logs à conserver
- Tous les `usage_events` (historique complet)
- Tous les `wallet_transactions`
- Tous les webhooks Stripe (table `stripe_webhook_events`)
- Tous les appels IA (prompts + réponses, pour debug) — **avec opt-out RGPD**

---

## 9. Plan de rollout

### Phase Bêta interne (J+0 à J+18 dev)
- Pierre et Rémy en `is_internal=true`
- Tests de bout en bout sur worksapce de Pierre en parallèle
- Résoudre bugs UX

### Phase Bêta fermée (J+18 à J+45)
- Inviter 5-10 coachs amis, leur donner flag `is_internal` ou coupon Stripe 100% 6 mois
- Monitorer conso réelle vs quotas proposés
- **Réviser les quotas** si on s'aperçoit qu'ils sont trop serrés ou trop généreux

### Phase Bêta publique (J+45 à J+75)
- Ouverture landing page inscription publique
- Pricing final affiché
- Support email actif
- Premiers paiements réels

### GA (J+75)
- Com marketing, pub Meta, lancement annoncé
- Scale si ça prend

---

## 10. Checklist go/no-go avant d'attaquer le code

- [ ] Compte Anthropic entreprise créé + CB + 100$ crédit initial
- [ ] Compte Stripe entreprise créé + verification business + Stripe Tax activé
- [ ] Compte AWS créé (si SES choisi) + demande sortie sandbox envoyée
- [ ] Meta Business Manager + WhatsApp Business Account (si WhatsApp V1) + numéro vérifié
- [ ] Compte Vercel upgradé à Pro ($20/mois) pour Cron Jobs illimités
- [ ] Audit business (doc 2) relu et validé par Pierre et Rémy
- [ ] Décisions D1-D6 tranchées
- [ ] Création branche `feature/billing-v1` (ou décomposition en plusieurs PR par phase)

---

## Annexe A — Estimation coûts d'infra au go-live

| Poste | Coût mensuel estimé |
|-------|---------------------|
| Vercel Pro | 20€ |
| Supabase Pro | 25€ |
| Domaine + DNS | 1€ |
| Stripe : aucun fixe, 1.5% + 0.25€ par transaction | variable |
| AWS SES : ~1€ pour 10k emails | variable |
| Anthropic : variable selon usage | variable |
| Meta WhatsApp : variable | variable |
| **Total fixe** | **~46€/mois** |

---

## Annexe B — Guide setup AWS SES (à exécuter avant P4)

### Étape 1 — Créer le compte AWS (15 min)
1. [aws.amazon.com](https://aws.amazon.com) → "Create an AWS Account"
2. Email pro (`admin@closrm.com` ou `pierre@closrm.com`, pas gmail perso)
3. Type : **Professional**
4. Nom société : nom auto-entreprise Pierre
5. SIRET + adresse déclarée URSSAF
6. CB pro (Qonto/Shine/etc.)
7. Vérif téléphonique (SMS)
8. Support plan : **Basic (gratuit)** — pas les payants

### Étape 2 — Région Paris (5 min)
Console top-right → sélectionner **Europe (Paris) eu-west-3** (RGPD + latence).

### Étape 3 — Demande sortie sandbox (5 min + 24-48h délai AWS)
Console → SES → **Account dashboard** → **Request production access**. Copie-colle ce formulaire :

```
Mail type: Transactional
Website URL: https://closrm.com

Use case description:
ClosRM est un CRM SaaS destiné aux coachs francophones.
Emails envoyés via SES : confirmations de RDV, rappels de RDV
(J-1, H-2), notifications de follow-up, réponses automatiques
aux leads ayant rempli un formulaire d'opt-in.

Chaque domaine d'expédition est vérifié individuellement par
notre client (le coach possède et contrôle son propre domaine,
ex: coach-julien.com). Destinataires = leads ayant explicitement
demandé à être contactés via Meta Ads lead forms, formulaires web.

Our opt-out process:
Chaque email inclut un lien de désabonnement. Désabonnements
traités automatiquement, adresses ajoutées à liste de suppression.
Bounces et complaints monitorés via SNS, suspension workspace
automatique si taux > 3%.

Mailing list acquisition:
Leads acquis par nos clients via Meta Ads Lead Forms, tunnels
de vente, saisie manuelle dans le CRM.

Additional info:
Volumes attendus: 10-50k emails/mois initialement.
Taux bounce cible: < 1%. Complaint cible: < 0.05%.
```

AWS répond sous 24-48h par email.

### Étape 4 — Vérifier domaine de test (en parallèle sandbox exit)
1. Console SES → Configuration → Identities → **Create identity**
2. Type : **Domain**
3. Domain : `test-ses.closrm.com` (sous-domaine dédié)
4. ✅ Use DKIM (recommended settings)
5. AWS te donne 3 enregistrements CNAME DKIM à ajouter chez ton registrar DNS
6. 5-30 min plus tard → statut `Verified`

### Étape 5 — User IAM + clés API (10 min)
1. Console → IAM → Users → **Create user**
2. Username : `closrm-ses-production`
3. **Ne pas** cocher "Enable console access" (API only)
4. Permissions → Attach policies directly → cocher :
   - `AmazonSESFullAccess`
   - `AmazonSNSFullAccess`
5. Créer user
6. Onglet Security credentials → **Create access key**
7. Type : **Application running outside AWS**
8. Copier et sauvegarder en 1Password/Bitwarden :
   - Access Key ID (`AKIA...`)
   - Secret Access Key (⚠️ **ne réapparaît plus jamais**)

### Étape 6 — SNS pour bounces/complaints (15 min)
1. Console → SNS → Topics → **Create topic**
2. Type : Standard
3. Name : `closrm-ses-bounces`
4. Après création → **Create subscription**
5. Protocol : **HTTPS**
6. Endpoint : `https://closrm.com/api/webhooks/ses` (route créée en P4)
7. **Enable raw message delivery** : décoché

Puis dans SES :
1. Console SES → **Configuration sets** → **Create set**
2. Name : `closrm-default`
3. Event destinations → SNS → sélectionner `closrm-ses-bounces`
4. Events to publish : Bounce, Complaint, Delivery, Reject

### Étape 7 — ENV vars Vercel (5 min)
Dashboard Vercel → Settings → Environment Variables :
```
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_SES_CONFIG_SET=closrm-default
AWS_SNS_SES_TOPIC_ARN=arn:aws:sns:eu-west-3:XXX:closrm-ses-bounces
EMAIL_FROM_DEFAULT=noreply@closrm.com
```
Tous environnements (Production, Preview, Development).

### Étape 8 — Install SDKs (pendant P4)
```bash
npm install @aws-sdk/client-ses @aws-sdk/client-sesv2 @aws-sdk/client-sns
```

### Étape 9 — Skip Mail Manager (inbound) V1
Mail Manager = inbound email, pas nécessaire V1. Feature "conversations email dans ClosRM" prévue V2.

---

## Annexe C — Références externes

- [Stripe Subscriptions docs](https://docs.stripe.com/billing/subscriptions/overview)
- [Stripe SetupIntent off-session](https://docs.stripe.com/payments/save-and-reuse)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management)
- [AWS SES pricing](https://aws.amazon.com/ses/pricing/)
- [AWS SES sandbox exit](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [Meta WhatsApp Business pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- [Vercel AI Gateway docs](https://vercel.com/docs/ai-gateway)
- [Anthropic API pricing](https://www.anthropic.com/pricing)
