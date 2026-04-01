# Module Funnels — Builder de tunnels de vente

> Spec validee le 2026-04-01 — Pierre

## Contexte

Les coachs ont besoin de creer des tunnels de vente (pages VSL, formulaire de candidature, page de booking, page de remerciement) sur leur propre domaine. Inspiration : Systeme.io / GoHighLevel. Le coach empile des sections pre-designees, personnalise les textes/images/couleurs, et publie sur son domaine custom (le meme que pour les emails).

**Note :** Le domaine custom est deja configure dans `email_domains`. On le reutilise — le coach ajoute juste un CNAME vers Vercel pour heberger ses pages.

---

## 1. Architecture globale

Un **funnel** = un ensemble de **pages** liees entre elles. Chaque page = une pile de **blocs** configurables.

```
Funnel "Programme 90 jours"
├── Page 1 : VSL (video + hero + temoignages + CTA)
├── Page 2 : Formulaire de candidature
├── Page 3 : Booking (prise de RDV integree)
└── Page 4 : Merci (confirmation)
```

Chaque bouton CTA ou formulaire redirige vers la page suivante (ou une URL externe).

---

## 2. Base de donnees

### Table `funnels`

```sql
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  domain_id UUID REFERENCES email_domains(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnels_workspace" ON funnels
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
```

### Table `funnel_pages`

```sql
CREATE TABLE funnel_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  page_order INT NOT NULL DEFAULT 1,
  blocks JSONB NOT NULL DEFAULT '[]',
  seo_title TEXT,
  seo_description TEXT,
  favicon_url TEXT,
  redirect_url TEXT,
  is_published BOOLEAN DEFAULT false,
  views_count INT DEFAULT 0,
  submissions_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(funnel_id, slug)
);

ALTER TABLE funnel_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnel_pages_workspace" ON funnel_pages
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );
```

### Table `funnel_events` (tracking)

```sql
CREATE TABLE funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'form_submit', 'button_click', 'video_play')),
  visitor_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funnel_events_workspace" ON funnel_events
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

CREATE INDEX idx_funnel_events_page ON funnel_events(funnel_page_id);
CREATE INDEX idx_funnel_events_visitor ON funnel_events(visitor_id);
```

### Modification table `leads`

Ajouter `'funnel'` comme source possible :

```sql
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source IN ('facebook_ads', 'instagram_ads', 'formulaire', 'manuel', 'funnel'));
```

---

## 3. Blocs disponibles (12 types)

| Type | Description | Config |
|------|-------------|--------|
| `hero` | Titre accrocheur + sous-titre + bouton CTA | title, subtitle, buttonText, buttonUrl, backgroundImage, overlay, alignment |
| `video` | Embed YouTube ou Vimeo | url, autoplay |
| `testimonials` | Grille de temoignages | items: [{name, text, photo, role}] |
| `form` | Formulaire de candidature (cree un lead) | fields: [{key, label, type, required}], redirectUrl, submitButtonText |
| `booking` | Embed du systeme de booking existant | calendarId (FK booking_calendars) |
| `pricing` | Bloc offre/tarif | title, price, priceNote, features: string[], buttonText, buttonUrl, highlighted |
| `faq` | Accordeon questions/reponses | items: [{question, answer}] |
| `countdown` | Compte a rebours | targetDate, expiredText |
| `cta` | Bouton d'appel a l'action | text, url, color, size (sm/md/lg), alignment |
| `text` | Bloc texte libre | content (retours a la ligne → br) |
| `image` | Image avec lien optionnel | src, alt, width, alignment, linkUrl |
| `spacer` | Espacement vide | height (px) |

### Structure JSON d'un bloc

```json
{
  "id": "block-1718000000",
  "type": "hero",
  "config": {
    "title": "Transforme ta vie en 90 jours",
    "subtitle": "Le programme qui a change la vie de +500 personnes",
    "buttonText": "Reserver mon appel",
    "buttonUrl": "/programme-90j/candidature",
    "backgroundImage": "https://...",
    "alignment": "center",
    "overlay": true
  }
}
```

---

## 4. Builder UI

### Layout 3 colonnes

- **Gauche (240px)** — Palette de blocs (drag vers preview) + liste des pages du funnel (onglets cliquables)
- **Centre** — Preview live de la page (rendu reel, responsive)
- **Droite (320px, au clic)** — Panel de config du bloc selectionne

### Top bar

- Bouton retour ←
- Nom du funnel (editable inline)
- Selecteur de page (tabs : Page 1 / Page 2 / + Ajouter)
- Toggle Desktop / Mobile
- Bouton "Sauvegarder" + bouton "Publier"

### Interactions

- Drag un bloc de la sidebar → drop dans la preview → insertion a la position
- Clic sur un bloc → ouvre le panel de config a droite
- Drag un bloc dans la preview → reordonne (dnd-kit)
- Hover → bordure bleue + bouton supprimer (X)

---

## 5. Pages publiques & domaine custom

### URLs sans domaine custom (fallback)

```
closrm.vercel.app/f/{workspace-slug}/{funnel-slug}              → Page 1
closrm.vercel.app/f/{workspace-slug}/{funnel-slug}/{page-slug}  → Page specifique
```

### URLs avec domaine custom

```
moncoaching.com/{funnel-slug}              → Page 1
moncoaching.com/{funnel-slug}/{page-slug}  → Page specifique
```

### Configuration domaine

1. Le coach a son domaine dans `email_domains` (deja configure pour les emails)
2. Il ajoute un record DNS CNAME pointant vers `cname.vercel-dns.com`
3. Le domaine est ajoute dans Vercel (manuellement ou via API)
4. Next.js middleware detecte le hostname → resout workspace_id → sert la page

### Rendu

- SSR pour le SEO (meta tags `seo_title`, `seo_description`)
- Charge le branding du workspace (couleur accent, logo)
- Compile les blocs JSON → HTML (compilateur dedie `src/lib/funnels/compiler.ts`)
- Injecte un script de tracking leger

---

## 6. Tracking visiteur

- Cookie anonyme `_closrm_vid` (UUID genere cote client) pour suivre le parcours
- Events envoyes en POST vers `/api/public/f/events`

### Events captures

| Event | Quand | Metadata |
|-------|-------|----------|
| `view` | Chargement de la page | `{ referrer }` |
| `form_submit` | Soumission du formulaire | `{ lead_id }` |
| `button_click` | Clic sur un CTA | `{ button_text, target_url }` |
| `video_play` | Lecture de la video | `{ video_percent: 0-100, video_url }` |

Le `video_percent` est capture via l'API YouTube/Vimeo iframe (postMessage). On envoie un event a 25%, 50%, 75%, 100% de watch time.

---

## 7. Templates predefinis

### 1. VSL classique (1 page)

```json
[
  { "type": "hero", "config": { "title": "...", "subtitle": "...", "buttonText": "Voir la video", "buttonUrl": "#video" } },
  { "type": "video", "config": { "url": "" } },
  { "type": "testimonials", "config": { "items": [{"name":"","text":"","photo":""}] } },
  { "type": "cta", "config": { "text": "Reserver mon appel", "url": "", "color": "#E53E3E", "size": "lg" } }
]
```

### 2. Page de capture (1 page)

```json
[
  { "type": "hero", "config": { "title": "...", "subtitle": "..." } },
  { "type": "form", "config": { "fields": [{"key":"first_name","label":"Prenom","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Telephone","type":"tel","required":true}], "submitButtonText": "Envoyer", "redirectUrl": "" } }
]
```

### 3. Funnel complet (4 pages)

**Page 1 — VSL :**
```json
[
  { "type": "hero", "config": { "title": "...", "subtitle": "...", "buttonText": "Decouvrir", "buttonUrl": "#video" } },
  { "type": "video", "config": { "url": "" } },
  { "type": "testimonials", "config": { "items": [] } },
  { "type": "pricing", "config": { "title": "Mon offre", "price": "997€", "features": [], "buttonText": "Postuler", "buttonUrl": "./candidature" } },
  { "type": "faq", "config": { "items": [] } },
  { "type": "cta", "config": { "text": "Postuler maintenant", "url": "./candidature", "size": "lg" } }
]
```

**Page 2 — Candidature :**
```json
[
  { "type": "hero", "config": { "title": "Formulaire de candidature", "subtitle": "Reponds a ces quelques questions" } },
  { "type": "form", "config": { "fields": [...], "submitButtonText": "Envoyer ma candidature", "redirectUrl": "./booking" } }
]
```

**Page 3 — Booking :**
```json
[
  { "type": "hero", "config": { "title": "Reserve ton appel decouverte", "subtitle": "Choisis un creneau qui te convient" } },
  { "type": "booking", "config": { "calendarId": "" } }
]
```

**Page 4 — Merci :**
```json
[
  { "type": "hero", "config": { "title": "Merci !", "subtitle": "Ta candidature a bien ete envoyee" } },
  { "type": "text", "config": { "content": "Voici ce qui va se passer :\n\n1. On analyse ta candidature\n2. Tu recois un email de confirmation\n3. On se retrouve lors de l'appel decouverte" } },
  { "type": "cta", "config": { "text": "Retour au site", "url": "/", "size": "md" } }
]
```

### 4. Page de remerciement (1 page)

```json
[
  { "type": "hero", "config": { "title": "Merci !", "subtitle": "Tout est bien enregistre" } },
  { "type": "text", "config": { "content": "Tu vas recevoir un email de confirmation.\n\nA tres vite !" } },
  { "type": "cta", "config": { "text": "Suivre sur Instagram", "url": "https://instagram.com/...", "size": "md" } }
]
```

---

## 8. Navigation & structure fichiers

### Pages dashboard

```
src/app/(dashboard)/acquisition/funnels/
├── page.tsx                    # Liste des funnels
├── new/page.tsx                # Choix template + creation
└── [id]/page.tsx               # Builder 3 colonnes
```

### API routes

```
src/app/api/funnels/
├── route.ts                    # GET (liste) + POST (creer)
├── [id]/route.ts               # GET + PUT + DELETE
├── [id]/pages/route.ts         # GET (pages) + POST (ajouter page)
├── [id]/pages/[pageId]/route.ts # GET + PUT + DELETE page
├── [id]/publish/route.ts       # POST (publier/depublier)
└── [id]/stats/route.ts         # GET stats du funnel
```

### Pages publiques

```
src/app/f/[workspaceSlug]/[funnelSlug]/
├── page.tsx                    # Page 1 (redirect)
└── [pageSlug]/page.tsx         # Page specifique

src/app/api/public/f/
├── [workspaceSlug]/[funnelSlug]/[pageSlug]/route.ts  # GET blocs + branding
└── events/route.ts             # POST tracking events
```

### Composants

```
src/components/funnels/
├── FunnelBuilder.tsx           # Layout 3 colonnes
├── FunnelBlockPalette.tsx      # Sidebar gauche (blocs draggables)
├── FunnelPagePreview.tsx       # Preview centre
├── FunnelBlockConfig.tsx       # Panel config droite
├── FunnelPageTabs.tsx          # Onglets pages dans le builder
├── FunnelCard.tsx              # Card funnel dans la liste
├── blocks/                     # Composants de rendu par type
│   ├── HeroBlock.tsx
│   ├── VideoBlock.tsx
│   ├── TestimonialsBlock.tsx
│   ├── FormBlock.tsx
│   ├── BookingBlock.tsx
│   ├── PricingBlock.tsx
│   ├── FaqBlock.tsx
│   ├── CountdownBlock.tsx
│   ├── CtaBlock.tsx
│   ├── TextBlock.tsx
│   ├── ImageBlock.tsx
│   └── SpacerBlock.tsx
└── config/                     # Panels de config par type
    ├── HeroConfig.tsx
    ├── VideoConfig.tsx
    ├── TestimonialsConfig.tsx
    ├── FormConfig.tsx
    ├── BookingConfig.tsx
    ├── PricingConfig.tsx
    ├── FaqConfig.tsx
    ├── CountdownConfig.tsx
    ├── CtaConfig.tsx
    ├── TextConfig.tsx
    ├── ImageConfig.tsx
    └── SpacerConfig.tsx
```

### Librairies

```
src/lib/funnels/
├── compiler.ts                 # JSON blocs → HTML page publique
├── templates.ts                # 4 templates predefinis
└── tracking.ts                 # Script tracking client (genere le JS injecte)
```

---

## 9. Resume

| Composant | Description |
|-----------|-------------|
| 3 tables SQL | `funnels`, `funnel_pages`, `funnel_events` |
| 12 types de blocs | hero, video, testimonials, form, booking, pricing, faq, countdown, cta, text, image, spacer |
| Builder 3 colonnes | palette gauche + preview centre + config droite |
| 4 templates | VSL, capture, funnel complet, remerciement |
| Pages publiques SSR | `/f/{slug}/{funnel}/{page}` + domaine custom |
| Tracking | cookie anonyme + events (view, form, click, video play %) |
| Domaine custom | reutilise `email_domains` + CNAME Vercel |
