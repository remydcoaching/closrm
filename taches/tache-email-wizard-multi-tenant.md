# Tâche : Wizard email multi-tenant autonome

**Date** : 2026-04-20
**Branche** : feature/pierre-email-wizard-multi-tenant
**Statut** : en cours (tests E2E à faire par Pierre)

---

## 🎯 Objectif

Permettre à n'importe quel coach ClosRM d'onboarder son propre domaine d'envoi
sans intervention manuelle AWS de ma part, et de choisir librement son
expéditeur (`contact@sondomaine.fr`, `coach@sondomaine.fr`, etc.).

Avant cette tâche :
- Le wizard générait seulement les 3 CNAME DKIM
- Il fallait créer à la main la receipt rule SES + ajouter SPF + MX inbound
- Résultat : sur pierre-coaching.fr, onboarding manuel pendant 30 min

Après :
- Le wizard génère 5 records (3 DKIM + SPF TXT + MX inbound sur `reply.{domaine}`)
- La receipt rule SES est mise à jour automatiquement pour router les réponses
- Le coach tape juste son domaine et copie/colle les records dans son DNS

---

## 🛠 Changements

### 1. `src/lib/email/domains.ts`
- Ajout `getInboundSubdomain(domain)` → `reply.{domain}`
- Helper `buildDnsRecords(domain, tokens, status)` qui assemble DKIM + SPF + MX
- `createDomain` et `getDomain` retournent les 5 records au lieu de 3

### 2. `src/lib/email/receipt-rule.ts` (nouveau)
- `addRecipientToRule(recipient)` — injecte un recipient dans la receipt rule
  SES en eu-west-1 via Describe + UpdateReceiptRule (idempotent)
- `removeRecipientFromRule(recipient)` — cleanup miroir
- Env requis : `SES_INBOUND_RULE_SET_NAME`, `SES_INBOUND_RULE_NAME`

### 3. `POST /api/emails/domains`
- Après `createDomain` succès → appel `addRecipientToRule('reply.{domain}')`
- Non bloquant (log warn si KO)

### 4. `DELETE /api/emails/domains/[id]`
- Cleanup receipt rule en miroir

### 5. `DomainWizard.tsx`
- Step 1 : texte explicatif sur `reply.{domain}` pour rassurer le coach sur sa
  boîte mail pro existante (qu'on ne touche pas)
- Step 2 (cleanup) : checklist reformulée pour viser uniquement le sous-domaine
  reply et les anciens services (Mailgun, Resend, GHL…)

### 6. `package.json`
- Ajout `@aws-sdk/client-ses` (v1) — SESv2 ne couvre pas les receipt rules

---

## ✅ Checklist déploiement

- [ ] Ajouter env `SES_INBOUND_RULE_SET_NAME` + `SES_INBOUND_RULE_NAME` sur Vercel (prod + preview)
- [ ] Vérifier que l'IAM utilisé par Vercel a bien `ses:DescribeReceiptRule` + `ses:UpdateReceiptRule` en eu-west-1
- [ ] Tester l'onboarding sur un domaine de test (ex: test.closrm.fr)
- [ ] Vérifier que la receipt rule a bien reçu le nouveau recipient
- [ ] Envoyer un mail test à `reply@reply.{test-domain}` → doit arriver dans Messages

---

## 🔜 Next steps (hors scope cette tâche)

- SPF du domaine parent : on pousse `v=spf1 include:amazonses.com -all`. Si le
  coach a déjà un SPF OVH (pour sa boîte pro), il va l'écraser. Prévoir une
  étape "détection SPF existant" + merge automatique.
- Pour pierre-coaching.fr déjà configuré à la main : vérifier que l'entry
  `email_domains` existe bien (sinon créer via UI pour que le matching webhook
  fonctionne).
- UI : afficher l'adresse de réponse (`reply@reply.{domain}`) dans le done
  screen pour que le coach sache où vont ses inbound.
