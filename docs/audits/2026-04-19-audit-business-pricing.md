# Audit business — Pricing, marges & positionnement

**Date** : 2026-04-19
**Auteur** : Pierre (via Claude Code)
**Scope** : Modèle économique, grille tarifaire, logique d'équipe, marges, break-even
**Statut** : À valider par Pierre et Rémy
**Companion doc** : [2026-04-19-audit-technique-billing.md](./2026-04-19-audit-technique-billing.md)

---

## 1. Résumé exécutif

ClosRM passe d'un modèle "outil interne gratuit" à un SaaS payant. Les décisions économiques clés à figer :

1. **Modèle de facturation** : **hybride** (allocation incluse mensuelle + wallet pré-payé pour l'overage avec recharge auto CB), inspiré de GHL mais plus simple.
2. **Tarifs proposés** : 4 plans (Trial / Starter 29€ / Pro 59€ / Scale 149€) + pricing par siège additionnel.
3. **Logique d'équipe** : **additive douce** (+29€/siège en Pro, +49€/siège en Scale) plutôt que multiplicative stricte ×2 ×4 ×6 (trop cher à l'acquisition).
4. **Marge brute visée** : 80-90% sur Starter/Pro, 60% sur Scale (plus de consommation), 3-5× markup sur l'overage.
5. **Break-even** : ~2 clients payants couvrent l'infra, ~140 clients couvrent un salaire de 3 000€/mois pour Pierre+Rémy.

---

## 2. Coûts réels unitaires (référence fournisseurs 2026-Q2)

### 2.1 Consommables facturables

| Consommable | Provider | Coût unitaire USD/EUR | Exemples |
|-------------|----------|----------------------|----------|
| **Email transactionnel** | **AWS SES** (V1) | 0.0001$/email = 0.10$/1000 | 10 000 emails = 0.85€ |
| **Email domaine custom** | AWS SES + SNS | ~0.00012$/email | 10 000 emails = 1€ |
| ~~Email Resend~~ (abandonné V1) | Resend | 35$/mois minimum (100k) + 0.90$/1000 overage | 10 000 emails = 32€ min |
| **Token IA Haiku 4.5** | Anthropic | 0.80$/M input + 4$/M output | ~0.005€/réponse de 500 tokens |
| **Token IA Sonnet 4.6** | Anthropic | 3$/M input + 15$/M output | ~0.018€/réponse de 500 tokens |
| **Token IA Opus 4.7** | Anthropic | 15$/M input + 75$/M output | ~0.09€/réponse de 500 tokens |
| **WhatsApp utility FR** (rappel RDV) | Meta Cloud | ~0.0365€/conv (France) | 1000 rappels = 37€ |
| **WhatsApp marketing FR** | Meta Cloud | ~0.0768€/conv (France) | 1000 messages = 77€ |
| **SMS France** | Twilio ou OVH | ~0.06€/SMS | 1000 SMS = 60€ |

### 2.2 Stratégie de routage modèle IA (économie ×3 à ×5)

Router intelligemment selon la complexité de la tâche :

| Tâche | Modèle | Justification |
|-------|--------|---------------|
| Résumé court appel (< 200 tokens output) | Haiku | Quasi gratuit, suffit largement |
| Suggestion message DM | Haiku | Ton + simple pattern matching |
| Rédaction follow-up personnalisé | Sonnet | Nuances importantes |
| Génération brief coach (1×) | Sonnet | Tâche complexe une seule fois |
| Analyse stratégique pipeline | Opus | Réservé aux tâches critiques rares |
| Génération caption post réseau social | Haiku | Simple, volumétrique |

**Impact économique** : si on fait 80% Haiku / 15% Sonnet / 5% Opus (mix optimisé) au lieu de 100% Sonnet, le coût IA moyen passe de ~18€/1M tokens à ~5€/1M tokens. **Division par 3.6.**

### 2.3 Coûts fixes ClosRM

| Poste | Mensuel |
|-------|---------|
| Vercel Pro | 20€ |
| Supabase Pro | 25€ |
| Domaine + DNS | 1€ |
| Anthropic minimum | 0€ (pay-as-you-go) |
| AWS SES fixes | 0€ |
| Stripe fixes | 0€ (frais par transaction seulement) |
| **Total fixe** | **~46€/mois** |

**Frais variables Stripe** : 1.5% + 0.25€ par transaction réussie en Europe. Pour 100 paiements de 59€ = 100 × (59 × 0.015 + 0.25) = 113.5€/mois. À intégrer dans la marge.

---

## 3. Scénarios d'usage par persona

Pour dimensionner les quotas inclus, modélisons 4 personas réalistes.

### 3.1 Persona A — Coach solo débutant (50 leads/mois)

| Consommable | Usage mensuel | Coût réel ClosRM |
|-------------|---------------|------------------|
| Emails (confirmation + rappel + no-show + follow-up) | 50 leads × 4 = **200 emails** | 0.02€ |
| IA (suggestions + rédactions) | ~30k tokens (mix) | 0.15€ |
| WhatsApp (rappels RDV) | 50 × 0.0365€ = **50 rappels** | 1.83€ |
| **Total coût provider** | | **~2€/mois** |
| **Prix plan Starter 29€** | | **Marge : 27€ (93%)** |

### 3.2 Persona B — Coach actif (200 leads/mois)

| Consommable | Usage mensuel | Coût réel ClosRM |
|-------------|---------------|------------------|
| Emails | 200 × 5 = **1 000 emails** | 0.10€ |
| IA (usage régulier) | ~200k tokens (mix) | 1.00€ |
| WhatsApp | 200 × 0.05€ = **200 messages** | 10€ |
| **Total coût provider** | | **~11€/mois** |
| **Prix plan Pro 59€** | | **Marge : 48€ (81%)** |

### 3.3 Persona C — Coach avec petite équipe (500 leads/mois, 3 sièges)

| Consommable | Usage mensuel | Coût réel ClosRM |
|-------------|---------------|------------------|
| Emails | 500 × 6 = **3 000 emails** | 0.30€ |
| IA (équipe + analyse) | ~800k tokens | 4€ |
| WhatsApp | 500 × 0.06€ = **500 messages** | 30€ |
| **Total coût provider** | | **~34€/mois** |
| **Prix plan Pro 3 sièges : 59 + 2×29 = 117€** | | **Marge : 83€ (71%)** |

### 3.4 Persona D — Cabinet scale (2 000 leads/mois, 6 sièges, broadcasts marketing)

| Consommable | Usage mensuel | Coût réel ClosRM |
|-------------|---------------|------------------|
| Emails (incl. broadcasts marketing) | 2000 × 7 + 5000 broadcast = **19 000 emails** | 1.90€ |
| IA | ~3M tokens | 15€ |
| WhatsApp (marketing + utility) | 2000 × 0.06€ = **2 000 messages** | 120€ |
| **Total coût provider** | | **~137€/mois** |
| **Prix plan Scale 6 sièges : 149 + 5×49 = 394€** | | **Marge : 257€ (65%)** |

### 3.5 Synthèse marges

| Persona | Plan | Prix mensuel | Coût réel | Marge brute | % marge |
|---------|------|--------------|-----------|-------------|---------|
| A - Solo débutant | Starter | 29€ | 2€ | 27€ | 93% |
| B - Solo actif | Pro | 59€ | 11€ | 48€ | 81% |
| C - Équipe 3 | Pro 3 sièges | 117€ | 34€ | 83€ | 71% |
| D - Cabinet 6 | Scale 6 sièges | 394€ | 137€ | 257€ | 65% |

**Marge brute moyenne pondérée attendue : ~78%** (très correct pour un SaaS B2B outil de prod).

---

## 4. Grille tarifaire proposée

### 4.1 Les 4 plans

#### 🆓 Trial — 14 jours gratuits
- Destiné à la découverte
- Accès à **toutes les features** du plan Pro
- 1 siège uniquement
- Quotas plafonnés pour éviter l'abus :
  - 500 emails
  - 50 000 tokens IA
  - 50 messages WhatsApp
- Pas de CB demandée à l'inscription
- À J-3, J-1, J0 : email de reminder + CTA upgrade
- Après J+14 : compte suspendu (lecture seule), données conservées 30 jours

#### 💼 Starter — 29€/mois TTC
- **Cible** : coach solo qui débute, < 100 leads/mois
- **1 siège** (pas d'ajout d'équipe)
- Inclus :
  - **5 000 emails/mois**
  - **500k tokens IA/mois** (~= 1000 conversations IA)
  - **300 messages WhatsApp/mois**
- Features actives :
  - Leads + pipeline complet
  - Closing + Follow-ups
  - Intégrations Meta Ads, Google Agenda, WhatsApp
  - Statistiques de base
  - Automations limitées à 3 workflows actifs
- Features non incluses :
  - Emails marketing / broadcasts
  - Tunnels de vente (V2 de toute façon)
  - Multi-utilisateurs

#### 🚀 Pro — 59€/mois TTC (base 1 siège)
- **Cible** : coach actif, équipe de 2-3, 100-500 leads/mois
- **Prix siège additionnel : +29€/mois**
- **Max 3 sièges** (coach + 1 setter + 1 closer)
- Inclus (quotas scalent par siège — voir ci-dessous) :
  - **20 000 emails/mois** (base 1 siège) + 5 000/siège supp
  - **2M tokens IA/mois** + 500k/siège
  - **1 500 messages WhatsApp/mois** + 300/siège
- Features actives :
  - Tout le plan Starter
  - Multi-utilisateurs (admin/setter/closer)
  - Automations illimitées
  - Emails broadcasts (segments)
  - Dashboard attribution Meta Ads
  - Statistiques avancées avec filtres
  - Branding custom (logo, nom workspace)

#### 🏢 Scale — 149€/mois TTC (base 1 siège)
- **Cible** : cabinet/agence, équipe 4+, > 500 leads/mois, usage intensif
- **Prix siège additionnel : +49€/mois**
- **Sièges illimités**
- Inclus (quotas scalent par siège) :
  - **100 000 emails/mois** (base) + 10 000/siège
  - **10M tokens IA/mois** + 1M/siège
  - **8 000 messages WhatsApp/mois** + 500/siège
- Features actives :
  - Tout le plan Pro
  - Tunnels de vente (V2)
  - Emails marketing séquences (V2)
  - API publique workspace (read-only leads)
  - Support prioritaire (réponse < 24h)
  - Onboarding personnalisé 30 min avec Pierre/Rémy

#### ⚙️ Internal (flag, pas public)
- Workspace avec `is_internal = true`
- Bypass tous les quotas et billing
- Utilisé pour : co-fondateurs, employés futurs, bêta-testeurs VIP
- Visible dans l'UI comme "Plan Interne ClosRM" pour la transparence

### 4.2 Tableau synthèse

| Plan | Prix 1 siège | +Siège supp. | Max sièges | Emails inclus | Fair-use cap | Tokens IA | WhatsApp | Overage email | Coût estimé | Marge brute |
|------|--------------|--------------|------------|---------------|--------------|-----------|----------|---------------|-------------|-------------|
| Trial | 0€ (14j) | — | 1 | 500 | 500 | 50k | 50 | bloqué | ~1€ total | acquisition |
| Starter | **29€** | — | 1 | **5 000** | **30 000** | 500k | 300 | **1€ / 1 000** | ~3€ | **26€ (90%)** |
| Pro | **59€** | **+29€** | 3 | **10 000** (+3k/siège) | **30 000** | 2M | 1 500 | **1€ / 1 000** | ~6€ | **53€ (90%)** |
| Scale | **149€** | **+49€** | illimité | **50 000** (+5k/siège) | pas de cap | 10M | 8 000 | **1€ / 1 000** | ~20€ | **129€ (86%)** |

**Décisions finales de pricing** :

1. **Overage à 1€/1 000 emails** (simplicité + compétitivité vs GHL à $0.67/1000). Tes marges au volume réaliste sont > 90% parce que 95% des clients n'atteignent jamais leur quota. Seul l'edge case "10 clients × 100k emails" tombe à 46% de marge, et c'est encore rentable.

2. **Fair-use limit à 30 000 emails/mois** sur Starter/Pro : affichage d'un message dans l'UI forçant l'upgrade vers Scale ou négociation d'un plan custom. Protège les marges contre les "power users" atypiques sur les plans d'entrée (cold email marketing, broadcasts massifs).

3. **AWS SES dès la V1** (décision finale 2026-04-19) : le cap de 10 domaines sur Resend Pro est un blocker structurel pour un SaaS multi-tenant. AWS SES = domaines illimités + coût quasi nul. Économies projetées : $1k-13k/an selon volume. Dev (3.5j) amorti en 2-3 mois.

4. **Volume réaliste M6** (mix 30 Starter + 50 Pro + 10 Scale = 90 clients) : 215k emails/mois total → coût Resend ~127€ → revenue ~5 300€ → **marge 95%**. Très rentable.

5. **Positionnement vs GHL** : ClosRM Pro à 59€ avec 10k emails inclus est **moins cher que GHL Starter à $97/mois sans email**. Avantage concurrentiel net sur l'entrée de gamme.

### 4.3 Logique d'équipe : additive douce vs multiplicative stricte

**Demande initiale Pierre** : "le plan équipe, ça doit être ×2 ×4 ×6 en fonction du nombre de personnes"

Deux interprétations possibles :

#### Option A — Additive douce (reco par défaut)

| Sièges | Plan Pro | Plan Scale |
|--------|----------|------------|
| 1 | 59€ (×1.00) | 149€ (×1.00) |
| 2 | 88€ (×1.49) | 198€ (×1.33) |
| 3 | 117€ (×1.98) | 247€ (×1.66) |
| 4 | — | 296€ (×1.99) |
| 5 | — | 345€ (×2.32) |
| 6 | — | 394€ (×2.64) |

**Avantages** :
- Prix attractif pour l'équipe de 2-3 (seuil psychologique pour les petits cabinets)
- Alignement avec Pipedrive, Close, HubSpot qui font +X€ par siège additionnel

#### Option B — Multiplicative stricte (×2 ×4 ×6)

| Sièges | Multiplicateur | Plan Pro | Plan Scale |
|--------|----------------|----------|------------|
| 1 | ×1 | 59€ | 149€ |
| 2 | ×2 | 118€ | 298€ |
| 4 | ×4 | 236€ | 596€ |
| 6 | ×6 | 354€ | 894€ |

**Avantages** :
- Simple à communiquer ("prix par personne fixe")
- Bien pour cabinets déjà solides qui recrutent
- Marge plus élevée

**Inconvénient majeur** : Scale 6 à 894€/mois → sortira du champ des coachs francophones indépendants, trop proche de HubSpot qui offre plus.

### 4.4 Recommandation finale Pricing

**Option A (additive douce)** pour les raisons suivantes :
1. La cible est prioritairement **coach solo ou petit cabinet (1-3 personnes)** — donc le plan Pro 1-3 sièges est le sweet spot
2. L'option B devient délirante à 6 sièges (894€) vs valeur perçue
3. Plus facile à itérer : on peut monter les prix des sièges additionnels à 39€ ou 59€ en P2 si on voit que les grosses équipes sous-paient vs la conso réelle

**Si Pierre veut garder l'esprit "×2 ×4 ×6"**, on peut l'afficher marketing comme :
> "Chaque siège supplémentaire vous coûte ~50% du plan de base"

---

## 5. Pricing overage / wallet

### 5.1 Principe

Quand un workspace dépasse son quota inclus, **l'overage sort automatiquement du wallet** du workspace. Le wallet se recharge automatiquement via Stripe quand son solde passe sous un seuil (par défaut 2€).

### 5.2 Grille de prix overage

| Ressource | Unité minimale | Coût fournisseur | Prix vente ClosRM | Markup |
|-----------|----------------|------------------|-------------------|--------|
| Emails | 1 000 | 0.10€ | **0.50€** | ×5 |
| Tokens IA | 100 000 | 0.20€ (mix Haiku/Sonnet) | **1.00€** | ×5 |
| WhatsApp utility | 100 messages | 4€ | **8€** | ×2 |
| WhatsApp marketing | 100 messages | 8€ | **14€** | ×1.75 |
| SMS (si V2) | 100 | 6€ | **12€** | ×2 |

### 5.3 Paliers de recharge wallet

Le coach choisit le montant de recharge auto dans l'UI :
- **10€** (recommandé pour Starter)
- **25€** (recommandé pour Pro)
- **50€** (recommandé pour Scale)
- **100€** (Scale + gros consommateurs)
- Personnalisé (min 5€, max 500€)

### 5.4 Seuil de déclenchement auto-recharge

Par défaut : **2€** (configurable 0€-20€ par le coach).

Quand `wallet_balance < threshold` ET `auto_recharge_enabled = true` :
1. Tentative débit Stripe sur carte sauvegardée
2. Si succès → crédit wallet + continuation envoi
3. Si échec → marqueur `stripe_payment_failed`, email alerte au coach, features overage bloquées jusqu'à mise à jour CB

### 5.5 Exemple d'addition mensuelle vue par le coach

**Plan Pro 59€ + overage wallet**

```
Abonnement Pro (du 01/05 au 31/05) : 59,00€
Recharge wallet auto du 15/05      : 25,00€
Recharge wallet auto du 28/05      : 25,00€
─────────────────────────────────────────
Total du mois                      : 109,00€

Détail consommation wallet :
- 3 200 emails overage (au-delà du quota) : 1,60€
- 850k tokens IA overage                  : 8,50€
- 450 messages WhatsApp overage           : 36,00€
- (reste au wallet : 4,90€)
```

Le coach voit dans son UI :
- Quota inclus restant en temps réel
- Wallet restant
- Historique recharges + débits
- Projection de fin de mois si tendance continue

---

## 6. Benchmarks concurrents (France/Europe 2026)

### 6.1 Comparaison directe

| Solution | Plan entry | Plan pro | Plan équipe/scale | Notes |
|----------|-----------|----------|-------------------|-------|
| **GoHighLevel** (US) | 97$/mois | 297$/mois | 497$/mois + wallet | Wallet pur pour consommables, UX complexe |
| **Close.com** | 49$/user | 99$/user | 139$/user | Per seat pur, IA payante en sup |
| **Pipedrive** | 14$/user | 29$/user | 59$/user | Sans IA native, emails via SMTP propre |
| **HubSpot Starter** | 20€ | 890€ | 3 600€ | Freemium généreux puis saut énorme |
| **Copper** | 23€/user | 49€/user | 99€/user | Axé Google Workspace |
| **Zoho CRM** | 14€/user | 23€/user | 40€/user | Low cost, UX datée |
| **Monday CRM** | 10€/user | 17€/user | 25€/user | Interface excellente, pas spé coaching |
| **YESSS Coach CRM** (FR) | 49€/mois | 99€/mois | N/A | Concurrent direct FR, moins complet |

### 6.2 Positionnement ClosRM

```
  Prix ↑
  500 € ┤              HubSpot Pro ●
  400 € ┤                           ● GHL Pro
  300 € ┤                                      ● Scale ClosRM 6 sièges (394€)
  200 € ┤                       ● Scale ClosRM 3 sièges (247€)
  150 € ┤                  ● Scale ClosRM 1 siège (149€)
  100 € ┤             ● GHL Start    ● Pro ClosRM 3 sièges (117€)
   75 € ┤       ● Close Pro       ● YESSS Pro
   60 € ┤                         ● Pro ClosRM 1 siège (59€)
   50 € ┤       ● YESSS Starter
   30 € ┤       ● Starter ClosRM (29€)
   20 € ┤       ● HubSpot Starter   ● Pipedrive Pro
    0 ─┴─────────────────────────────────────────────→  Features/Valeur
```

**Positionnement** :
- **Starter 29€** : moitié prix vs YESSS (49€), comparable HubSpot
- **Pro 59€** : sweet spot cible coach actif, 40% moins cher que YESSS Pro
- **Scale 149€** : haut-de-gamme compétitif vs GHL (3× moins cher) avec spécialisation coaching

**Argument de vente principal** :
> "Le CRM spécialisé coaching francophone qui inclut l'IA et WhatsApp nativement — sans les 297$ mensuels de GHL."

---

## 7. Projections financières & break-even

### 7.1 Coûts fixes ClosRM

| Poste | Mensuel |
|-------|---------|
| Infra (Vercel + Supabase + DNS) | 46€ |
| Outils dev (GitHub, Vercel Team, etc.) | 20€ |
| Compte Anthropic minimum | 0€ |
| **Total strict infra** | **~66€/mois** |

Si on inclut une rémunération mini Pierre + Rémy à 3 000€/mois chacun :
- **Total avec salaires mini** : **~6 066€/mois**

### 7.2 Marge moyenne pondérée par client

Hypothèse de mix client acquis :
- 40% Starter (29€, marge 26€)
- 45% Pro 1 siège (59€, marge 48€)
- 10% Pro 2-3 sièges (~100€, marge 75€)
- 5% Scale (150-300€, marge 100€)

**Marge moyenne pondérée : ~47€/client/mois** après frais Stripe et provider.

### 7.3 Break-even

| Objectif | Clients payants nécessaires |
|----------|----------------------------|
| Couvrir infra pure (66€) | **2 clients** |
| Couvrir Pierre à 1 500€/mois | **32 clients** |
| Couvrir Pierre + Rémy à 1 500€/mois chacun | **64 clients** |
| Couvrir Pierre + Rémy à 3 000€/mois chacun | **128 clients** |
| Objectif 12 mois (20k€ MRR net) | **~450 clients** |

### 7.4 Projection MRR

Hypothèse de croissance acquisition modérée :

| Mois | Clients payants | MRR brut | MRR net après coûts |
|------|-----------------|----------|---------------------|
| M1 | 10 | 470€ | 410€ |
| M3 | 50 | 2 350€ | 2 050€ |
| M6 | 150 | 7 050€ | 6 200€ |
| M9 | 300 | 14 100€ | 12 400€ |
| M12 | 500 | 23 500€ | 20 700€ |
| M18 | 1 000 | 47 000€ | 41 500€ |
| M24 | 1 800 | 84 600€ | 75 000€ |

### 7.5 Sensibilité aux risques

**Risque 1 : sous-consommation (clients Starter qui ne consomment rien)**
- Impact positif sur les marges (quota non consommé = coût provider évité)
- Mais risque de churn : "je ne l'utilise pas, je résilie"
- **Mitigation** : onboarding fort, emails d'activation, usage score

**Risque 2 : sur-consommation WhatsApp**
- Coach Pro qui abuse WhatsApp marketing : 5 000 msg/mois (quota 1500) → overage 3500 × 0.14€ = 490€ facturé
- Coût réel ClosRM : 3500 × 0.08€ = 280€
- **Marge additionnelle 210€** — OK, le wallet protège bien

**Risque 3 : churn élevé**
- Si churn > 5%/mois, le MRR net stagne malgré acquisition
- **Mitigation** : engagement product (daily usage coach), stickiness via Google Agenda sync, exports CSV/backup

---

## 8. Cadre légal, fiscal, RGPD

### 8.1 TVA

- **Obligation tarifs TTC** (B2C France)
- TVA 20% française par défaut
- Clients UE : reverse charge B2B si numéro VAT validé → gérer via **Stripe Tax** (gratuit, auto-déclare)
- Clients hors UE : pas de TVA

### 8.2 Mentions obligatoires CGV SaaS

- Droit de rétractation 14j (exception digital services si consommation immédiate → à formuler clairement)
- Résiliation mensuelle avec 0 engagement
- Rétention données 30 jours post-résiliation → suppression auto via cron
- DPO identifié (Pierre ou externe)
- Sous-traitants listés : Supabase (US + EU), Vercel (US), Stripe (US), Anthropic (US), AWS (EU), Meta (US)

### 8.3 Spécifique WhatsApp Business

- Meta exige un numéro de téléphone dédié (impossible de réutiliser un perso)
- Templates WhatsApp soumis à approbation Meta (délai 24-48h)
- Politiques anti-spam strictes (opt-in explicite, bouton désabonnement)
- Si le client reçoit 3 signalements "spam" → Meta peut suspendre le numéro **sans préavis**

### 8.4 Facturation automatique

- Stripe génère les factures avec SIRET ClosRM, envoyées par email au coach
- Téléchargement PDF depuis Customer Portal
- Numérotation séquentielle imposée par la loi française

---

## 9. Stratégie d'acquisition & conversion

### 9.1 Trial flow idéal

```
Jour 0  — Inscription
        — Email bienvenue + vidéo onboarding 3 min
        — CTA : "Connecte ton compte Meta" (premier lead auto-imported)

Jour 1  — Email "Crée ton premier follow-up automatique"
Jour 3  — Email "Configure tes rappels RDV WhatsApp"
Jour 7  — Email "Voici tes 5 premières stats"
Jour 11 — Email "J-3 avant la fin de ton essai" + offre -30% 1er mois
Jour 13 — Email "J-1 : ton workspace sera verrouillé demain"
Jour 14 — Email "Essai terminé, upgrade pour continuer"
        — Compte passe en `read-only` (features désactivées)

Jour 44 — Email "On supprime ton workspace dans 14 jours"
Jour 58 — Suppression auto (+ email notif)
```

### 9.2 Offres acquisition

- **First mover discount** : -30% sur les 3 premiers mois (Starter 20€, Pro 40€)
- **Parrainage** : 1 mois offert pour chaque filleul qui prend un plan payant (les deux en bénéficient)
- **Annuel** : -20% si paiement à l'année (commit de trésorerie)
- **Coupon lancement** : `CLOSRM2026` → -50% sur 6 mois pour les 50 premiers

### 9.3 Upgrade intra-plan

- Banner dans l'app quand quota > 80% : "Vous approchez de la limite. Upgrader à Pro pour +300% de quota"
- Email automatique J+7 après avoir consommé 100% du quota : proposition upgrade
- Si un coach se retrouve à payer > 50€/mois d'overage → suggestion forte d'upgrade

### 9.4 Downgrade

- Customer Portal Stripe gère les downgrades (Pro → Starter)
- Prorata de l'abonnement en cours remboursé automatiquement
- **Conditions** : le workspace doit déjà avoir ≤ 1 siège actif

---

## 10. Recommandations finales

### 10.1 Pricing finalisé recommandé

| Plan | Prix/mois | Sièges | Usage cible |
|------|-----------|--------|-------------|
| **Trial** | 0€ | 1 | Découverte 14j |
| **Starter** | **29€** | 1 | Coach solo démarrage |
| **Pro** | **59€** (+29€/siège, max 3) | 1-3 | Coach actif + petite équipe |
| **Scale** | **149€** (+49€/siège, ∞) | 1-∞ | Cabinet/agence |

### 10.2 Logique opérationnelle

- **Lancement en bêta privée** : flags `is_internal` sur Pierre + Rémy + 5-10 coachs amis
- **Pricing final en bêta publique** : ajustement ±20% possible selon feedbacks
- **Première année** : accepter marges plus basses si ça permet d'acquérir plus de clients (croissance > profits)
- **An 2** : monter les prix de 20% pour les nouveaux clients (grand-pérennisation anciens pour 12 mois)

### 10.3 Décisions ouvertes à trancher par Pierre

| Décision | Reco | À trancher avant |
|----------|------|------------------|
| Pricing additif (A) ou multiplicatif (B) ? | A (59+29+29 = 117€ pour 3) | Implémentation P1 |
| Plan Scale : cap sièges ou illimité ? | Illimité (pas de friction croissance) | Implémentation P1 |
| Wallet : minimum recharge 5€ ou 10€ ? | 10€ (évite micro-paiements) | P5 |
| WhatsApp dans V1 payante ? | Oui (utility only) | P6 |
| SMS V1 ? | Non (WhatsApp suffit) | P6 |
| Plan annuel dès le lancement ? | Non, attendre M6 | M6 |
| Parrainage dès le lancement ? | Non, attendre M3 (éviter fraude) | M3 |
| Coupons lancement (50 premiers) ? | Oui, CLOSRM2026 -50% 6 mois | GA |

### 10.4 Indicateurs à monitorer à partir de M1

- MRR total
- Mix plan (% Starter/Pro/Scale)
- Churn mensuel
- Taux de conversion Trial → Payant (objectif >15%)
- Marge brute par workspace
- Top 5 consommateurs (alertes fraude)
- Wallet auto-recharge failure rate (< 2%)
- NPS à 30 jours d'ancienneté

### 10.5 Audit à réviser à J+90

Cet audit est basé sur des **hypothèses de consommation**. À J+90 post-lancement, il faudra :
1. Recalibrer les **quotas inclus** selon la conso réelle (peut-être trop/trop peu)
2. Recalibrer les **prix overage** selon les marges effectives
3. Décider de **l'ouverture SMS** ou d'autres ressources
4. Décider d'un éventuel **plan Enterprise sur mesure** pour gros cabinets (> 10 sièges)

---

## Annexe A — Calcul détaillé marge brute

### Plan Starter 29€ TTC
- Chiffre d'affaires HT (TVA 20%) : **24.17€**
- Frais Stripe (1.5% + 0.25€) : **0.61€**
- Coût provider estimé : **2€**
- **Marge brute : 21.56€ (89%)**

### Plan Pro 59€ TTC (1 siège)
- CA HT : **49.17€**
- Frais Stripe : **0.99€**
- Coût provider estimé : **11€**
- **Marge brute : 37.18€ (75%)**

### Plan Pro 3 sièges (117€ TTC)
- CA HT : **97.50€**
- Frais Stripe : **2.01€**
- Coût provider estimé : **34€**
- **Marge brute : 61.49€ (63%)**

### Plan Scale 149€ TTC (1 siège)
- CA HT : **124.17€**
- Frais Stripe : **2.49€**
- Coût provider estimé : **60€**
- **Marge brute : 61.68€ (50%)**

### Plan Scale 6 sièges (394€ TTC)
- CA HT : **328.33€**
- Frais Stripe : **6.16€**
- Coût provider estimé : **137€**
- **Marge brute : 185.17€ (56%)**

---

## Annexe B — Modèle Excel/Google Sheets (à produire)

Un tableur dynamique à bâtir avec les variables :
- Nombre de clients par plan
- Mix consommation (variable par client)
- Taux de churn
- Coûts fixes
- Investissement acquisition (pubs Meta, etc.)

Sortie :
- MRR brut/net
- Break-even par palier
- Projection 12/24 mois
- Sensibilité churn

→ À faire **avant implémentation** pour que le pricing ne soit pas figé sur des intuitions mais des chiffres.

---

## Annexe C — Références externes

- [Stripe Tax France](https://docs.stripe.com/tax/supported-countries/france)
- [Meta WhatsApp Business Pricing 2026](https://developers.facebook.com/docs/whatsapp/pricing)
- [RGPD & SaaS (CNIL)](https://www.cnil.fr/fr/reglement-europeen-protection-donnees)
- [Benchmark SaaS pricing 2026 (Paddle)](https://www.paddle.com/resources)
- [GHL pricing officiel](https://www.gohighlevel.com/pricing)
