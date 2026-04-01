# T-020 — Module Emails (Sequences + Broadcasts)

> Spec validee le 2026-03-31 — Pierre

## Contexte

Les coachs ont besoin d'envoyer des emails a leurs leads pour deux usages :
1. **Relances automatisees** (sequences) — nurturing post-acquisition, rappels, follow-ups
2. **Campagnes ponctuelles** (broadcasts) — promotions, annonces, contenu a une audience ciblee

Inspiration : GoHighLevel / Systeme.io. Chaque coach envoie depuis son propre domaine (ex: `contact@moncoaching.com`), pas depuis `noreply@closrm.com`.

**Note future :** Le domaine custom servira aussi pour les tunnels de vente (V2) — pages de vente, confirmation, etc. hebergees sur le domaine du coach. La table `email_domains` est concue pour etre reutilisable.

---

## 1. Domaines custom

### Flow self-service

1. Parametres > Integrations > carte "Domaine Email"
2. Le coach entre son domaine existant (prerequis : le coach possede deja un domaine)
3. Appel API Resend `POST /domains` pour enregistrer le domaine
4. Affichage des records DNS (SPF, DKIM, DMARC) avec boutons "Copier"
5. Le coach configure les records chez son registrar (OVH, Namecheap, GoDaddy, etc.)
6. Bouton "Verifier" → appel `GET /domains/{id}` pour checker la propagation DNS
7. Une fois verifie : le coach configure son adresse d'envoi et nom affiche

### Fallback

Si pas de domaine custom configure, les emails partent de `noreply@closrm.com`.

### Guide integre

Si le coach n'a pas de domaine, on affiche un guide "Comment obtenir un domaine" avec liens vers les registrars populaires (OVH, Namecheap, GoDaddy, Google Domains).

### Table `email_domains`

```sql
CREATE TABLE email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
  dns_records JSONB,
  default_from_email TEXT,
  default_from_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, domain)
);

ALTER TABLE email_domains ENABLE ROW LEVEL SECURITY;
```

---

## 2. Templates email — Builder drag & drop

### Blocs disponibles

| Bloc | Description |
|------|-------------|
| Header | Logo + titre (image ou texte) |
| Texte | Rich text avec variables (`{{prenom}}`, `{{nom}}`, etc.) |
| Image | Upload ou URL, avec alt text |
| Bouton | CTA avec lien, couleur personnalisable |
| Divider | Separateur visuel |
| Footer | Texte legal + lien desinscription (auto-insere, non supprimable) |

### Fonctionnement

- Template stocke en JSON (liste ordonnee de blocs avec config)
- Compilation JSON → HTML responsive via React Email cote serveur
- Previsualisation live desktop/mobile dans le builder
- Templates nommes et reutilisables
- Variables resolues au moment de l'envoi avec les donnees du lead

### Librairies

- **React Email** (`@react-email/components`) — Composants email responsives
- **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) — Drag & drop
- **TipTap** (`@tiptap/react`) — Rich text editing dans les blocs texte

### Table `email_templates`

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  blocks JSONB NOT NULL DEFAULT '[]',
  preview_text TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
```

### Structure JSON des blocs

```json
[
  {
    "id": "block-1",
    "type": "header",
    "config": { "logoUrl": "...", "title": "Mon Coaching", "alignment": "center" }
  },
  {
    "id": "block-2",
    "type": "text",
    "config": { "content": "<p>Bonjour {{prenom}},</p><p>...</p>" }
  },
  {
    "id": "block-3",
    "type": "button",
    "config": { "text": "Reserver mon appel", "url": "https://...", "color": "#E53E3E", "alignment": "center" }
  },
  {
    "id": "block-4",
    "type": "footer",
    "config": { "text": "© 2026 Mon Coaching. Tous droits reserves." }
  }
]
```

---

## 3. Sequences email

### Principe

Une sequence = un workflow de type `email_sequence` dans le moteur existant (`src/lib/workflows/engine.ts`). L'UI est specialisee (timeline verticale), mais l'execution reutilise le meme moteur (steps, delays, conditions, pause/resume).

### UI — Timeline verticale

```
📧 Email 1 : "Bienvenue {{prenom}}"     [Modifier]
   ↓ Delai : 2 jours
📧 Email 2 : "Votre coaching vous attend" [Modifier]
   ↓ Delai : 3 jours
📧 Email 3 : "Derniere chance"            [Modifier]
   [+ Ajouter un email]
```

### Chaque step

- Selection d'un template existant OU creation inline
- Configuration du delai avant le prochain email (minutes/heures/jours)
- Condition optionnelle (ex: "seulement si le lead n'a pas ouvert l'email precedent")

### Declenchement

- **Manuellement** : le coach inscrit un lead ou groupe de leads
- **Via workflow** : nouvelle action `enroll_in_sequence` dans le workflow engine
- **Via broadcast** : option "inscrire les destinataires dans une sequence apres envoi"

### Table `email_sequence_enrollments`

```sql
CREATE TABLE email_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'unsubscribed')),
  current_step INT NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(sequence_id, lead_id)
);

ALTER TABLE email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
```

### Contraintes

- Un lead ne peut etre inscrit qu'une seule fois par sequence (UNIQUE constraint)
- Si le lead se desinscrit (email_unsubscribed=true) → statut `unsubscribed`, arret immediat
- Stats par step : ouvertures, clics, desinscriptions, drop-off

---

## 4. Broadcasts (campagnes ponctuelles)

### Flow

1. "Nouvelle campagne"
2. Choix d'un template email (ou creation)
3. Filtres dynamiques pour cibler les leads :
   - Statut pipeline (nouveau, setting planifie, close, etc.)
   - Tags (chaud, froid, VIP, etc.)
   - Source (Facebook Ads, Instagram, manuel, etc.)
   - Date de creation (derniers 7j, 30j, 90j, custom)
   - Joint / non joint
   - Combinaison AND entre filtres
4. Preview du nombre de destinataires en temps reel
5. Option : envoyer maintenant ou planifier (date/heure)
6. Envoi en batch (lots de 100, respect rate limits Resend)

### Table `email_broadcasts`

```sql
CREATE TABLE email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_broadcasts ENABLE ROW LEVEL SECURITY;
```

---

## 5. Stats & tracking

### Webhook Resend

- Endpoint : `POST /api/webhooks/resend`
- Events captes : `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
- Chaque event met a jour le record `email_sends` correspondant via `resend_email_id`

### Table `email_sends` (log centralise)

```sql
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES email_broadcasts(id) ON DELETE SET NULL,
  sequence_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  resend_email_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  subject TEXT,
  from_email TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_sends ENABLE ROW LEVEL SECURITY;
```

### Dashboard stats

- **Vue globale** : emails envoyes, taux d'ouverture, taux de clic, taux de bounce, taux de desinscription (periode selectionnable)
- **Vue par broadcast** : stats detaillees par campagne
- **Vue par sequence** : stats par step, funnel drop-off
- **Graphique** : envois/jour

---

## 6. Desinscription

### Flow

1. Lien auto-insere dans le footer de chaque email (bloc Footer non supprimable)
2. URL : `/unsubscribe?token={jwt_signe}` — le token encode `lead_id` + `workspace_id`
3. Page publique de confirmation : "Etes-vous sur de vouloir vous desinscrire ?"
4. Confirmation → flag `email_unsubscribed=true` sur le lead
5. Header `List-Unsubscribe` ajoute a chaque email (one-click unsubscribe clients mail)

### Nouveaux champs sur `leads`

```sql
ALTER TABLE leads ADD COLUMN email_unsubscribed BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN email_unsubscribed_at TIMESTAMPTZ;
```

### Verification avant envoi

Tout envoi (broadcast, sequence, workflow action) verifie `email_unsubscribed = false` avant d'envoyer. Les leads desinscrits sont exclus silencieusement.

---

## 7. Navigation & structure fichiers

### Pages

```
src/app/(dashboard)/acquisition/emails/
├── page.tsx                    # Dashboard stats emails
├── templates/
│   ├── page.tsx                # Liste des templates
│   └── [id]/page.tsx           # Builder drag & drop
├── sequences/
│   ├── page.tsx                # Liste des sequences
│   └── [id]/page.tsx           # Editeur timeline
└── broadcasts/
    ├── page.tsx                # Liste des campagnes
    └── new/page.tsx            # Creation broadcast
```

### API routes

```
src/app/api/emails/
├── templates/route.ts          # CRUD templates
├── sequences/route.ts          # CRUD sequences (wrapper workflow)
├── broadcasts/route.ts         # CRUD + envoi broadcasts
├── sends/route.ts              # Logs d'envoi
└── stats/route.ts              # Agregations stats

src/app/api/webhooks/resend/route.ts    # Webhook tracking
src/app/api/unsubscribe/route.ts        # Page desinscription
```

### Composants

```
src/components/emails/
├── EmailBlockBuilder.tsx       # Drag & drop builder
├── BlockRenderer.tsx           # Rendu d'un bloc dans le builder
├── blocks/                     # Composants par type de bloc
│   ├── HeaderBlock.tsx
│   ├── TextBlock.tsx
│   ├── ImageBlock.tsx
│   ├── ButtonBlock.tsx
│   ├── DividerBlock.tsx
│   └── FooterBlock.tsx
├── EmailPreview.tsx            # Preview desktop/mobile
├── SequenceTimeline.tsx        # Timeline verticale
├── BroadcastFilterBuilder.tsx  # Filtres dynamiques
├── EmailStatsCard.tsx          # KPI cards
└── DomainSetup.tsx             # Widget config domaine

src/app/(public)/unsubscribe/page.tsx   # Page publique desinscription
```

### Librairies a ajouter

```
src/lib/email/
├── client.ts                   # (existant) Resend API wrapper
├── domains.ts                  # Resend Domains API
├── compiler.ts                 # JSON blocks → HTML (React Email)
├── unsubscribe.ts              # Generation/verification tokens JWT
└── batch-sender.ts             # Envoi batch avec rate limiting
```

---

## 8. Resume des tables SQL

| Table | Role |
|-------|------|
| `email_domains` | Domaines custom par workspace |
| `email_templates` | Templates email (blocs JSON) |
| `email_broadcasts` | Campagnes ponctuelles |
| `email_sends` | Log centralise de chaque email envoye |
| `email_sequence_enrollments` | Inscriptions leads dans les sequences |
| `leads` (modifie) | +`email_unsubscribed`, +`email_unsubscribed_at` |

Les sequences elles-memes sont des `workflows` avec un type dedie — pas de nouvelle table pour la definition.
