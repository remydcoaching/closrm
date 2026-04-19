# Tâche : Domaines email custom + envoi/réception

**Date plan** : 2026-04-19
**Estimation totale** : 5-15j selon scope retenu (V1 send-only vs V1.5 inbound)

---

## 🎯 Objectif

Permettre à chaque coach de :
1. **Envoyer** des emails depuis `coach@sondomaine.fr` (au lieu de `@closrm.fr`)
2. (V1.5) **Recevoir** les réponses dans une boîte ClosRM (réponses lead → ticket dans CRM)

---

## 📊 État actuel — ce qui existe déjà

### ✅ Backend prêt
- Table `email_domains` (workspace_id, domain, resend_domain_id, status, dns_records, default_from_email, default_from_name)
- Wrapper Resend API : `src/lib/email/domains.ts` (createDomain, verifyDomain, getDomain, deleteDomain)
- Routes API :
  - `POST /api/emails/domains` (créer)
  - `GET /api/emails/domains` (lister)
  - `GET /api/emails/domains/[id]` (détail)
  - `DELETE /api/emails/domains/[id]`
  - `POST /api/emails/domains/[id]/verify` (trigger verif Resend)
- Webhook `/api/webhooks/resend` : delivered/opened/clicked/bounced/complained
- Broadcasts (`/api/emails/broadcasts/[id]/send`) lit `email_domains.default_from_email` du workspace
- Cron auto-verify domaines pending

### ❌ Ce qui manque
- **UI gestion domaines** dans Paramètres (la page n'existe pas)
- Wire-up systématique : seul `broadcasts/send` utilise le workspace domain. Restent :
  - `src/lib/workflows/actions/send-email.ts` (utilise `config.from_email` venant du workflow, pas du workspace)
  - `src/lib/email/templates/booking-confirmation.ts` (hardcoded noreply@closrm.fr)
  - `src/lib/email/batch-sender.ts` (à vérifier)
- **Inbound** : 0% — il faut tout construire
- (Plus tard) Migration Resend → AWS SES

---

## 🗂️ Phases

### **P1 — UI gestion domaines** (1.5j) 🟢 *URGENT, débloque tout*

**Pourquoi en premier** : sans UI, le coach ne peut pas ajouter son domaine, donc tous les `default_from_email` restent vides → tout part de `noreply@closrm.fr`.

#### P1.1 Page Paramètres → Domaines email (1j)
- Route `/parametres/domaines-email`
- Liste des domaines workspace avec statut (pending/verified/failed)
- Bouton "Ajouter un domaine"
  - Modal : input nom de domaine
  - Affiche les 3-5 records DNS à copier (DKIM, SPF, return-path)
  - Instructions par registrar (OVH, GoDaddy, Cloudflare)
- Bouton "Vérifier maintenant" (re-trigger Resend verify)
- Bouton "Supprimer"
- Pour chaque domaine vérifié : champ "Email expéditeur par défaut" (ex: `noreply@coach.fr`) + "Nom expéditeur"

**Lien sidebar** : ajouter "Domaines email" dans section Compte de la sidebar.

#### P1.2 Wire-up complet (0.5j)
- `send-email.ts` workflow : si `config.from_email` n'est pas fourni → fallback workspace domain par défaut
- `booking-confirmation.ts` : helper `getWorkspaceFromEmail(workspaceId)` lit DB
- `batch-sender.ts` : pareil

**Done quand** : un coach ajoute `coach.fr`, configure DNS, vérifie, marque par défaut → tous ses emails (workflow, booking, broadcast) partent de `noreply@coach.fr`.

---

### **P2 — Tests E2E + monitoring** (0.5j) 🟢

- Test scenario complet : ajout → DNS → verif → envoi
- Vérifier que `email_sends.from_email` enregistre bien le domaine custom (pour stats)
- Health check : alerter si plus de X% bounces sur un domaine custom (réputation)

---

### **P3 — Réception emails (inbound)** (5-10j) 🟡 *V1.5 — à valider scope*

**Stack recommandée** : Resend Inbound (en beta) OU AWS SES Inbound + S3 + Lambda.

#### P3.1 Choix infra (0.5j)
- **Option A — Resend Inbound** (beta) : on configure les MX, Resend reçoit, fire un webhook avec le contenu parsé. ✅ Simple. ❌ Beta, dépendance vendor.
- **Option B — SES Inbound + Lambda** : MX → SES → S3 → Lambda parse MIME → POST notre webhook. ❌ Compliqué à setup. ✅ Robuste, intégré à notre setup SES déjà en cours.

**Ma reco** : Resend Inbound pour V1.5, switch vers SES quand on aura migré l'envoi sur SES en P5+.

#### P3.2 Schéma DB (0.5j)
- Table `email_threads` : workspace_id, lead_id (nullable), subject, last_message_at
- Table `email_messages` : thread_id, direction (in/out), from_email, to_email, body_html, body_text, received_at, attachments (JSONB)
- Storage Supabase pour les attachments

#### P3.3 Webhook inbound (1.5j)
- Route `/api/webhooks/email-inbound`
- Parse from/to/subject/body/attachments
- Match sur lead par from_email
- Crée thread + message
- Si thread déjà ouvert → append + bump last_message_at
- Notification temps réel au coach (Supabase Realtime ou polling 30s)

#### P3.4 UI Inbox (3-5j)
- Page `/messages-email` (ou dans Lead detail)
- Liste threads (style Gmail) : sender, subject, snippet, time
- Vue détail thread avec messages alternés in/out
- Composer répondre (inline reply)
- Marquer lu/non-lu
- Recherche

#### P3.5 Composer reply qui réutilise threading (1j)
- Headers `In-Reply-To` + `References` pour que la réponse arrive dans le bon thread côté lead
- Quote du message précédent

---

### **P4 — Migration Resend → AWS SES** (1-2j) 🔵 *Quand SES validé*

- Adapter `sendEmail()` dans `client.ts` pour parler SES SDK au lieu de Resend API
- Gestion bounces/complaints via SNS topic SES → notre webhook
- Garder Resend Inbound (P3) ou migrer aussi en SES Inbound

---

## 🎯 Recommandation de scope V1

**Faire P1 + P2 maintenant (~2j)** :
- Permet aux coachs d'envoyer depuis leur domaine
- C'est ce que tu as promis dans les audits / pricing
- Pas d'inbound = limitation mais pas bloquante (les leads peuvent toujours répondre, ça ira juste sur la mailbox du coach via la config réponse)

**Reporter P3 (inbound) en V1.5** :
- C'est gros (5-10j) et pas critique pour le launch
- On peut tracker la demande (combien de coachs le réclament dans les 1ers mois)

**P4 (SES)** : à enchainer dès que AWS valide la prod (24-48h).

---

## ⚠️ Points d'attention techniques

1. **Reply-To** : pour que les réponses lead arrivent dans la mailbox perso du coach (sans inbound dans CRM), on peut setter `Reply-To: coach@vraibox.com` dans les emails sortants. Le coach répond depuis Gmail, le lead répond, ça arrive dans Gmail.
2. **DMARC** : si le coach a un DMARC strict sur son domaine et qu'on envoie sans DKIM aligné → blocage. Resend gère bien ça mais à vérifier.
3. **Réputation domaine custom** : un nouveau domaine = pas de réputation = risque spam. Prévoir un "warm-up" (envoi progressif) ou disclaimer dans l'UI.
4. **GDPR / délivrabilité** : si on stocke les inbound, attention RGPD pour les pièces jointes.

---

## 📋 TODO immédiat si on lance P1

1. `[ ]` Créer `/parametres/domaines-email/page.tsx` + `email-domains-client.tsx`
2. `[ ]` Composant `AddDomainModal` avec affichage records DNS
3. `[ ]` Composant `DomainCard` (liste avec statut/actions)
4. `[ ]` Lien sidebar
5. `[ ]` Wire-up `send-email.ts` workflow + helper `getWorkspaceDefaultFrom()`
6. `[ ]` Wire-up `booking-confirmation.ts`
7. `[ ]` Wire-up `batch-sender.ts`
8. `[ ]` Test E2E manuel : ajouter domaine OVH test → DNS → verif → envoi workflow → vérifier from_email
