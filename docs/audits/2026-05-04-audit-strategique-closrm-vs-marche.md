# Audit stratégique ClosRM vs marché — 2026-05-04

> Audit complet produit + workflow + benchmark concurrents.
> Synthèse de 2 investigations parallèles (audit interne + benchmark 7 concurrents).
> Objectif : identifier où on est bon, où on est faible, et où on doit investir pour gagner.

**Auteur :** Claude Code (Opus 4.7) sur demande de Pierre
**Codebase analysée :** v0.6 (post-session T-043, 2026-05-04)
**Concurrents benchmarkés :** iClosed, GoHighLevel, Close, HubSpot, Attio, Pipedrive, Folk

---

## TL;DR (à lire en 2 min)

**Verdict global :** ClosRM v0.6 est un produit **étonnamment riche** (38 modules, 62 migrations, 170+ routes API) avec une **direction artistique forte** et des **différenciateurs réels** (funnels VSL, Instagram natif, IA Claude). MAIS 4 stubs critiques bloquent la viabilité commerciale et 5 features standards 2026 manquent.

**Forces vraies (vs marché) :**
1. Funnels VSL + design system 20× plus riche qu'iClosed
2. Instagram module complet (DM, comments, posts, captions IA) — unique sur le segment
3. IA Claude native (vs ChatGPT basique GHL) + brief coach
4. UI moderne et FR (vs GHL US-centric daté)
5. Pricing potentiel agressif (€39 entrée vs $97 GHL)

**Blockers critiques (V1 non-vendable tant que pas fixés) :**
1. `FormBlock` = `console.log` stub → funnels ne créent aucun lead
2. `BookingBlock` = placeholder dashed → pas de booking depuis funnel
3. WhatsApp/Email actions automations = stubs → automations non-fonctionnelles
4. Clé API Anthropic côté client → security + monétisation impossible

**Gaps marché 2026 (table stakes manquants) :**
1. Reminders RDV interactifs (boutons confirmer/replanifier) — réduit no-shows -40%
2. Deposit Stripe à la réservation — réduit no-shows -40%
3. AI transcription + summary post-call — devenu standard 2026
4. Mobile app native — coach indépendant vit sur tel
5. Capture lead AVANT slot booking (USP iClosed)

**Recommandation stratégique :**
> **Stop building features. Ship the V1 cleanly.**
> 10 jours focus sur P0 + P1 → produit bookable.
> Ensuite, 3 features qui font la différence : reminders interactifs WhatsApp + deposit Stripe + AI brief packagé.
> Le reste (mobile native, transcription, voice agent) = roadmap Q4 2026 / Q1 2027.

---

## 1. Inventaire modules ClosRM (état réel)

| Module | Maturité | Forces | Gaps critiques |
|--------|---------:|--------|----------------|
| **Leads** | 10/10 | Pipeline 8 statuts, fiche riche, import CSV 5 étapes | Pas de tâches liées, pas de notes structurées en UI |
| **Closing** | 9/10 | Drag-resize RDV style Google Calendar, GCal sync | Pas de vue par closer |
| **Follow-ups** | 9/10 | Statuts, presets J+1→J+30 | Pas de suivi exécution réelle |
| **Statistiques** | 8/10 | KPIs delta vs N-1, funnel cohorte, sparklines | Queries client (pas RPC), ROAS = "—" |
| **Agenda / Booking** | 9/10 | 4 types RDV, drag-resize, GCal OAuth | FormBlock funnel = stub |
| **Automations** | 8/10 | 4 triggers × 6 actions, dry-run, logs | **WhatsApp/Email/Telegram actions = stubs** |
| **Funnels v2** | 8/10 | 9 presets DA, builder | **FormBlock + BookingBlock = stubs** |
| **Emails** | 7/10 | Sequences, broadcasts, domaines custom | **Resend = blocker multi-tenant** (migration SES) |
| **Instagram** | 7/10 | DMs, comments, posts, reels, captions IA | Pas de webhook entrants (polling) |
| **Pubs Meta** | 8/10 | Dashboard CPL, ROAS, perf par campagne | Pas de refresh token auto, ROAS "—" |
| **Équipe** | 7/10 | Membres, rôles, permissions, chat, training | Pas d'invitation UI, assignation pas wired |
| **Assistant IA** | 8/10 | Brief coach 7-step, lead magnets, self-learning | **Clé API côté client = security risk** |
| **Dashboard v2** | 9/10 | Hero adaptatif, listes algo, brief IA on-demand | Cache 24h sans invalidation smart |
| **Finance/Wallet** | 6/10 | Overview revenue + commissions | **Wallet = stub** (pas de Stripe) |

**Stats globales :**
- 103,609 LOC | 638 TSX/TS files | 62 migrations SQL | 170+ routes API
- **0 tests unitaires/E2E** (risque régression élevé)
- **6 composants > 700 lignes** (NewBookingModal 1019L, EquipeClient 1246L, ActionConfigPanel 872L…)
- **140 console.log/error en prod** (noise + perf overhead)

---

## 2. Forces réelles vs marché (différenciateurs)

| Différenciateur | vs qui ? | Magnitude |
|-----------------|----------|-----------|
| Funnels VSL + booking + design system 9 presets DA | iClosed (none), GHL (legacy UI) | 🔥🔥🔥 Énorme |
| Instagram natif (DM, comments, posts, captions IA) | Tous (HubSpot/iClosed/GHL ≈ rien) | 🔥🔥🔥 Énorme |
| IA Claude (vs ChatGPT basic GHL) + brief coach | GHL, HubSpot | 🔥🔥 Fort |
| UI moderne FR + RGPD | GHL/iClosed (US-centric) | 🔥🔥 Fort |
| Pricing potentiel €39/mo | GHL ($97), HubSpot ($45+) | 🔥🔥 Fort |
| Drag-resize RDV style Google Calendar | iClosed (basic), GHL (clunky) | 🔥 Moyen |
| Dashboard v2 command center (hero algo + listes) | Tous (KPI cards classiques) | 🔥 Moyen |

---

## 3. Faiblesses critiques (blockers V1)

### 🔴 P0 — Bloquent la viabilité commerciale

| # | Problème | Fichier | Effort | Impact |
|---|----------|---------|--------|--------|
| 1 | **FormBlock = `console.log` stub** | `src/components/funnels/blocks/FormBlock.tsx:64` | 0.5j | Funnel ne crée aucun lead — chaîne d'acquisition cassée |
| 2 | **BookingBlock = placeholder dashed** | `src/components/funnels/blocks/BookingBlock.tsx:50-70` | 1.5j | Funnel ne réserve aucun RDV — chaîne booking cassée |
| 3 | **Send WhatsApp/Email actions = stubs** | `src/lib/workflows/actions/send-whatsapp.ts` | 1.5j | Toutes les automations rappel/follow-up = non-fonctionnelles |
| 4 | **API key Anthropic côté client** | `ai-settings-client.tsx:200-250` | 0.5j | Security risk + monétisation IA impossible |

### 🟡 P1 — Bloquent le scale

| # | Problème | Effort | Impact |
|---|----------|--------|--------|
| 5 | **Resend = max 10 domaines, coût prohibitif** → migration AWS SES | 2j | Multi-tenant emails impossible au-delà de 10 coachs |
| 6 | **Pas de `deal_amount` tracking** → ROAS = "—" partout | 0.5j | Coachs ne peuvent pas mesurer le ROI de leurs ads |
| 7 | **Stats queries client-side** (pas de RPC Supabase) | 3j | N+1 queries, perf mauvaise à 10k leads |
| 8 | **0 tests E2E** | 5j | Régressions silencieuses à chaque release |

### 🟠 P2 — Dette technique

| # | Problème | Effort |
|---|----------|--------|
| 9 | 6 composants > 700 lignes (NewBookingModal, EquipeClient, ActionConfigPanel) | 2j refacto |
| 10 | RLS policies basées `owner_id` uniquement (V2 setter/closer cassé) | 0.5j |
| 11 | 140 console.log en prod | 0.5j |
| 12 | Notes reels en localStorage (perdues au changement de navigateur) | 0.5j |

---

## 4. Benchmark concurrents — matrice features

Légende : ✅ natif solide · ⚠️ partiel/limité · ❌ absent

| Feature | **ClosRM** | iClosed | GHL | Close | HubSpot | Attio | Pipedrive | Folk |
|---------|:----------:|:-------:|:---:|:-----:|:-------:|:-----:|:---------:|:----:|
| Pipeline customisable | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Booking page publique | ✅ | ✅ (cœur) | ✅ | ⚠️ | ✅ | ❌ | ✅ | ❌ |
| **Capture lead AVANT slot** | ❌ | ✅ (USP) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Dialer intégré clic-to-call | ❌ | ⚠️ | ✅ | ✅ (réf) | ✅ | ❌ | ⚠️ | ❌ |
| **Reminders interactifs** (boutons) | ❌ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Deposit Stripe booking** | ❌ | ⚠️ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Funnels / landing pages | ✅ (riches) | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Automations workflows | ✅ | ✅ | ✅ (complexe) | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |
| **AI transcription post-call** | ❌ | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI brief avant call | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Meta Ads (leads + spend) | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | ❌ |
| WhatsApp Business natif | ⚠️ (stub) | ❌ (Zapier) | ✅ (Flows) | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| **Mobile app native** | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ (réf) | ❌ |
| Multi-membres (setter/closer) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reporting closer-level | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |
| Instagram natif | ✅ (unique) | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| API publique / webhooks | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard "command center" | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ |

**Lecture :**
- ClosRM est ✅ ou ⚠️ sur 14/18 features.
- 4 ❌ critiques : capture-before-slot, reminders interactifs, deposit Stripe, mobile native, AI transcription post-call.
- ClosRM seul ✅ unique : **Funnels riches + Instagram natif**.

---

## 5. Deep-dive concurrent N°1 : iClosed

**Positionnement :** "AI scheduler for high-ticket closers". 20k+ users. Pas un CRM complet — un scheduler-first qui s'intègre à HubSpot/Pipedrive/Close via Make/Zapier.

**Ce qu'ils font qu'on ne fait pas (gap analysis) :**

1. **Capture lead AVANT slot** sur la booking page → flippe la séquence Calendly classique. Tu captures email/phone AVANT que le slot s'affiche. Selon eux, +200% leads. **C'est leur USP majeur** et ça serait facile à implémenter chez nous (réorganisation du flow BookingWidget).

2. **Routing IA conditionnel** : un lead VIP → senior closer, un small fish → setter. Configurable sur réponses au form.

3. **Closer leaderboard** avec objections classifiées. Vendu comme "Sales Manager command center". On a Dashboard v2, mais pas la dimension par-closer ni les objections.

4. **Hyros / Meta Pixel baked-in** sur la booking page elle-même.

5. **Stripe natif transactions** trackées avec deal outcome.

**Leurs faiblesses (sources G2/Trustpilot) :**
- ❌ **PAS de mobile app native** — plainte récurrente N°1
- ❌ **Pas de WhatsApp natif** (Zapier seulement) → friction énorme FR
- ❌ **Pas de funnel/landing builder** (greffon scheduler, pas tout-en-un)
- ❌ **Pas de dialer intégré**
- ❌ **Glitches calendrier** rapportés (calendar not loading)
- ❌ **Support lent** (RDV annulés 5min avant, replanif 2 mois)
- ❌ **Tarif opaque** Business custom 5 seats min → barrière coach solo

→ **Opportunité ClosRM :** être le "iClosed avec mobile + WhatsApp + funnels + RGPD FR".

---

## 6. Tendances marché 2026

### Devenu non-négociable (table stakes)

1. **AI Notetaker / transcription appels** — Voice-to-CRM en hausse +340% en 2025 (Fathom, Otter, Gong, Close). **Sans ça, on paraît obsolète.**
2. **Booking page avec capture lead en amont** (popularisée par iClosed). 37% des leads coaching perdus à cause de la friction scheduling.
3. **Reminders multi-canal avec confirmation interactive** — réduction prouvée 40-60% des no-shows. WhatsApp + SMS + email.
4. **Deposit à la réservation** (10-20% du service value) — réduit no-shows 40-60%. Standard high-ticket.
5. **AI brief avant call** (résumé lead + réponses qualif + historique en 1 écran).
6. **Attribution Meta Ads / pixel tracking natif** (coût-par-call / coût-par-deal).
7. **Mobile-first ou app native** (faiblesse iClosed, Folk).
8. **WhatsApp Business API natif** (pas Zapier) — canal dominant FR/EU.

### Émergent (différenciateur 2026, table stakes 2027)

- **AI Voice Agent** (qualification appels entrants quand coach indispo)
- **AI Scorecards par appel** (rep noté sur méthodologie de vente)
- **Conversation intelligence** (objections classifiées, deal risk, coaching moments)
- **Compliance Meta WhatsApp** (depuis 15/01/2026, Task-Specific AI Agents requis pour booking/support)
- **Voice-to-CRM** (remplir le CRM en parlant après un call)

---

## 7. Roadmap stratégique (12 mois)

### 🚨 Phase 0 — Stop building, ship V1 cleanly (10 jours)

**Objectif :** rendre ClosRM réellement vendable. Aucune feature nouvelle.

1. [P0] FormBlock API publique → lead creation + workflow trigger (0.5j)
2. [P0] BookingBlock intégré au calendrier (réutiliser widget existant) (1.5j)
3. [P0] WhatsApp/Email actions — vrais envois Meta Cloud + AWS SES (1.5j)
4. [P0] API key Anthropic → proxy serveur `POST /api/ai/complete` (0.5j)
5. [P1] Migration Resend → AWS SES (abstraction layer) (2j)
6. [P1] `deal_amount` tracking + ROAS visible (0.5j)
7. [P1] E2E tests Playwright sur 5 flows critiques (3j)
8. [P2] Refacto 6 méga-composants (parallélisable) (2j)

**Livrable :** V1 production-ready, démo de bout en bout fonctionnelle.

---

### 🎯 Phase 1 — Lancement bêta + différenciateurs (Q3 2026)

**Objectif :** 50 coachs FR en bêta payante. Construire ce qui fait gagner vs iClosed/GHL.

**Features stratégiques (par ordre ROI/effort) :**

1. **Reminders WhatsApp interactifs** (boutons "Confirmer" / "Replanifier" / "Annuler") (3j)
   → Réduit no-shows 40-60%. Pricing power énorme. Gap iClosed.

2. **Deposit Stripe à la réservation** (toggle par calendrier) (5j)
   → Réduit no-shows 40-60%. Différentie de GHL clunky. Justifie plan Pro.

3. **Capture lead AVANT slot** sur booking page (1.5j)
   → USP iClosed. Trivial à implémenter (réorganiser BookingWidget).

4. **AI brief 1-écran pré-call** (déjà fait, packager UX) (1j)
   → Différenciateur vs iClosed (qui n'a pas).

5. **Closer/setter leaderboard** : show rate, close rate, cash collected par membre (3j)
   → Gap GHL. Différencie pour équipes 2-5.

6. **Routing IA conditionnel** booking → closer (2j)
   → USP iClosed. Pas trivial mais vendable très bien aux équipes.

**Pricing à verrouiller :**
- Starter €39/mo (solo, 1 user, 200 leads/mo)
- Pro €89/mo (solo + setter, IA brief+summary, deposit Stripe)
- Team €189/mo (5 users, attribution Meta avancée, leaderboard)

Référence marché : iClosed €22/seat sans WhatsApp/dialer/IA, GHL $97 avec friction énorme. €39 fait sauter la barrière "<100€".

---

### 🚀 Phase 2 — Scale + IA premium (Q4 2026 / Q1 2027)

**Objectif :** 500 coachs payants, MRR €30k.

1. **Mobile app native iOS/Android** (Expo/React Native) (4-6 sem)
   → Gap énorme iClosed/Folk. Coach indépendant vit sur tel.

2. **AI transcription + summary post-call** + auto-fill CRM (Whisper + Claude) (3 sem)
   → Standard 2026. Gap GHL. Présent Close à $99/user — démocratisable à €40/mo.

3. **Webhook Meta Ads leads entrants** (vs polling actuel) (1 sem)
   → Latence /j → temps réel. Sécurise attribution.

4. **Webhook Instagram DMs entrants** + auto-conversion lead (2 sem)
   → Capitalise sur l'unique différenciateur Instagram.

---

### 🌟 Phase 3 — Moat & expansion (Q2 2027)

**Objectif :** 1500 coachs payants, MRR €100k.

1. **AI Voice Agent** pour appels entrants quand coach indispo (compliance Meta WhatsApp 2026)
2. **AI Scorecards** par appel + conversation intelligence (objections classifiées)
3. **Custom field builder** (flexible schema, vs Attio)
4. **API publique + Zapier bridge** (open ecosystem)
5. **Marketplace templates funnels + automations** (UGC + monétisation)

---

## 8. Ce qu'il NE FAUT PAS faire

1. **Ne pas s'étaler en features** — la V1 a 38 modules, déjà trop. Stop building, fix existing.
2. **Ne pas concurrencer GHL frontalement** sur funnels/email broadcast — c'est leur terrain, on perd.
3. **Ne pas faire whitelabel SaaS / agency mode** — terrain GHL, dilue le focus.
4. **Ne pas faire Conversation Intelligence Gong-grade** — trop coûteux. Whisper + Claude pour le 80/20 suffit.
5. **Ne pas viser power dialer / predictive dialer** — terrain Close, cible enterprise pas coach.
6. **Ne pas faire email marketing broadcast/sequence** — laisser Mailerlite/Brevo. Faire transactionnel only.

---

## 9. Synthèse en 1 image mentale

```
                  ClosRM positioning map (2026)

                    Riche en features
                          ▲
                          │
              GHL ────────┼─────── ClosRM (potentiel)
              ($97, US,   │       (€39, FR, RGPD,
               UI dated,  │        moderne, IA Claude,
               complexe)  │        Instagram unique)
                          │
                          │
           HubSpot ───────┼─────────── (zone vide)
           (B2B SaaS,     │
            pas coach)    │
                          │
       Pauvre ◄───────────┼───────────► Cher
                          │
                          │
              Pipedrive ──┼──── iClosed
              ($14, simple│    ($24/seat, US,
               sales B2B) │     pas WhatsApp,
                          │     pas mobile,
                          │     pas funnels)
                          │
                          ▼
                    Pauvre en features

               ClosRM = iClosed + Funnels + Instagram + WhatsApp + FR
                      ─ 4 stubs critiques
                      + 5 features 2026 manquantes
```

---

## 10. Décisions à prendre (alignement Pierre)

Cocher ce qui est validé pour passer à l'exécution :

- [ ] **Phase 0 (10j)** : on ship la V1 propre avant toute feature nouvelle ?
- [ ] **Phase 1 (Q3)** : ordre de priorité des 6 features stratégiques validé ?
- [ ] **Pricing** : €39 / €89 / €189 OK ou autre cible ?
- [ ] **Mobile native** : Expo (React Native) ou web PWA suffisante en V1 ?
- [ ] **Migration Resend → SES** : on l'attaque maintenant ou on attend d'avoir 5+ coachs payants ?
- [ ] **Tests E2E** : Playwright sur 5 flows critiques ou on continue sans ?
- [ ] **Stop building** : on accepte de geler les features nouvelles 10j ?

---

## Annexes

- **Audit interne complet** : agent Explore — voir transcript task `aa010a22acb785bae`
- **Benchmark concurrents complet** : agent general-purpose — voir transcript task `a387edd26214b84c4`
- **Améliorations identifiées T-043** : `ameliorations.md` (12 nouvelles A-043-01 à -12)
- **État projet** : `etat.md`
- **Audits préexistants** : `docs/audits/2026-04-19-audit-business-pricing.md`, `2026-04-19-audit-technique-billing.md`

---

*Audit produit le 2026-05-04 par Claude Code (Opus 4.7) sur demande de Pierre.*
*Sources benchmark : G2, Trustpilot, sites éditeurs, blogs spécialisés (~30 URLs citées dans le transcript de l'agent benchmark).*
