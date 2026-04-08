# Spec — Assistant IA de Relance (V1)

> **Date :** 2026-04-07
> **Auteur :** Pierre
> **Statut :** Valide par le dev, en attente d'implementation
> **Inspiration :** Mochi (Nick Setting) — AI Setter + Creator DNA + Golden Script

---

## Objectif

Integrer un assistant IA dans ClosRM qui analyse les conversations Instagram d'un lead, comprend ou il en est dans le parcours de vente, et genere un message de relance personnalise dans la voix du coach. L'objectif est de permettre aux coachs de gerer 100+ conversations/jour avec la qualite d'un message manuel.

---

## Principes

1. **Human-in-the-loop** — l'IA suggere, le coach valide et envoie
2. **Transparent** — le coach ne sait pas que c'est Claude derriere, c'est juste "l'assistant IA"
3. **Self-learning** — l'IA s'ameliore au fil du temps en analysant les conversations qui convertissent
4. **Zero config technique** — cle API Anthropic cote serveur, le coach n'a rien a configurer

---

## Architecture

```
                     ┌─────────────────────┐
                     │  Coach Brief         │
                     │  (onboarding guide)  │
                     └──────────┬──────────┘
                                │
┌──────────────┐   ┌────────────▼────────────┐   ┌──────────────────┐
│ Conversation │──▶│    POST /api/ai/suggest  │◀──│ Golden Script     │
│ IG Messages  │   │                          │   │ (conversations    │
└──────────────┘   │  src/lib/ai/suggest.ts   │   │  gagnantes)       │
                   │                          │   └──────────────────┘
┌──────────────┐   │  Prompt = brief + msgs   │
│ Lead infos   │──▶│  + lead + golden script  │
│ status/tags  │   │                          │
└──────────────┘   └────────────┬─────────────┘
                                │
                   ┌────────────▼─────────────┐
                   │  Response                 │
                   │  - guidance (strategie)   │
                   │  - message (pret a envoyer)│
                   │  - status_suggestion      │
                   └────────────┬─────────────┘
                                │
                   ┌────────────▼─────────────┐
                   │  UI : side panel ou       │
                   │  page Messages            │
                   │                           │
                   │  fenetre <7j → envoi      │
                   │  fenetre >7j → copier +   │
                   │  ouvrir dans Instagram    │
                   └───────────────────────────┘
```

---

## Composant 1 — Coach Brief (Parametres > Assistant IA)

### Onboarding (premiere visite)

Quand le coach accede a la fonctionnalite IA pour la premiere fois, un wizard lui pose 5-6 questions :

1. **Ton offre** — "Decris ton offre principale en 1-2 phrases" (ex: "Coaching perte de poids pour hommes 25-45 ans, programme de 12 semaines")
2. **Ta cible** — "Qui sont tes prospects ideaux ?" (ex: "Hommes sedentaires qui veulent perdre 10-20kg")
3. **Ton style** — choix multiple : Tutoiement / Vouvoiement / Ca depend
4. **Ton approche de relance** — "Comment tu relances habituellement ?" avec suggestions :
   - J'envoie du contenu gratuit (video, article) pour engager
   - Je pose des questions sur leurs objectifs
   - Je propose directement un appel
   - Mix de tout ca
5. **Exemples de messages** — "Colle 2-3 messages que t'as envoyes et qui ont bien marche" (textarea)
6. **Ton objectif final** — choix : Booker un appel decouverte / Vendre un produit en DM / Les deux

### Stockage

Table `ai_coach_briefs` :
```sql
CREATE TABLE ai_coach_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  offer_description TEXT,
  target_audience TEXT,
  tone TEXT DEFAULT 'tu' CHECK (tone IN ('tu', 'vous', 'mixed')),
  approach TEXT,
  example_messages TEXT,
  goal TEXT DEFAULT 'book_call' CHECK (goal IN ('book_call', 'sell_dm', 'both')),
  generated_brief TEXT, -- brief genere par l'IA a partir des reponses
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Generation du brief

Apres les 6 questions, on appelle Claude pour generer un brief structure :
```
A partir des reponses du coach, genere un brief de 200 mots max qui decrit :
- Le style de communication (ton, expressions)
- La strategie de relance (etapes)
- Les messages types a utiliser
- Les signaux d'achat a detecter
```

Le coach peut re-editer le brief genere a tout moment dans Parametres.

### Self-learning (V1 simple)

Quand un lead passe en statut `clos` (deal won) :
- On tag la conversation comme "gagnante" dans `ai_conversation_outcomes`
- Periodiquement (cron ou a la demande), on re-analyse les conversations gagnantes pour affiner le brief

Table `ai_conversation_outcomes` :
```sql
CREATE TABLE ai_conversation_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'no_response')),
  messages_snapshot JSONB, -- snapshot des messages au moment du tag
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Composant 2 — Guidance + Convert (UI)

### Emplacement

Le bouton "Assistant IA" apparait a **deux endroits** :

1. **Side panel du lead** (`LeadSidePanel.tsx`) — un bouton sous la section contact
2. **Page Messages** (`ConversationThread.tsx`) — un bouton a cote du champ d'envoi

### Flow utilisateur

1. Le coach clique sur le bouton "IA" (icone sparkle/etoile)
2. **Guidance** s'affiche dans un encart :
   - Analyse de la situation : "Ce prospect est tiede. Il a montre de l'interet il y a 10 jours pour ta video sur la perte de poids mais n'a pas repondu a ta derniere relance."
   - Strategie recommandee : "Relance avec un nouveau contenu de valeur. Pose une question ouverte pour re-engager."
   - Suggestion de statut : "Statut actuel : nouveau → suggere : setting_planifie" (si pertinent)
3. **Convert** : le message genere apparait dans le champ de saisie, editable
4. Le coach modifie s'il veut, puis :
   - **Fenetre ouverte (<7j depuis dernier msg du prospect)** → bouton "Envoyer" (appelle POST /api/instagram/messages/send)
   - **Fenetre fermee (>7j)** → bouton "Copier le message" + bouton "Ouvrir dans Instagram" (lien `https://www.instagram.com/{username}`)

### Detection de la fenetre

La fenetre est calculee a partir de `ig_messages` :
```sql
SELECT MAX(sent_at) FROM ig_messages
WHERE conversation_id = ? AND sender_type = 'participant'
```
Si `now() - max_sent_at > 7 days` → fenetre fermee.

### Composant UI : `AiSuggestionPanel.tsx`

```typescript
interface AiSuggestionPanelProps {
  leadId: string
  conversationId?: string
  onSendMessage?: (text: string) => void // pour injecter dans le champ de saisie
}
```

Etats :
- `idle` — bouton "IA" visible
- `loading` — spinner pendant l'appel API
- `ready` — guidance + message affiche
- `error` — message d'erreur

---

## Composant 3 — API Backend

### Route : `POST /api/ai/suggest`

```typescript
// Body
{
  lead_id: string
  conversation_id?: string // optionnel, on le deduit du lead_id si absent
}

// Response
{
  guidance: string       // explication strategie (2-3 phrases)
  message: string        // message pret a envoyer
  status_suggestion?: {  // suggestion de changement de statut (optionnel)
    from: LeadStatus
    to: LeadStatus
    reason: string
  }
  window_open: boolean   // true si on peut envoyer via API
  window_expires_at?: string // date d'expiration de la fenetre
}
```

### Logique : `src/lib/ai/suggest.ts`

```typescript
async function generateSuggestion(workspaceId: string, leadId: string, conversationId?: string) {
  // 1. Fetch le brief du coach
  const brief = await getBrief(workspaceId)

  // 2. Fetch les infos du lead
  const lead = await getLead(leadId) // status, source, tags, notes, instagram_handle

  // 3. Fetch les derniers messages (20 max)
  const messages = await getMessages(conversationId, 20)

  // 4. Fetch les golden scripts (3 conversations gagnantes similaires)
  const goldenExamples = await getWinningConversations(workspaceId, lead.source, 3)

  // 5. Construire le prompt
  const prompt = buildPrompt(brief, lead, messages, goldenExamples)

  // 6. Appeler Claude (Haiku pour les cas simples, Sonnet pour les complexes)
  const model = messages.length > 10 ? 'claude-sonnet-4-5-20250514' : 'claude-haiku-4-5-20251001'
  const response = await callClaude(prompt, model)

  // 7. Parser la reponse structuree
  return parseResponse(response)
}
```

### Prompt template

```
Tu es l'assistant IA de relance d'un coach. Ton role est d'analyser une conversation Instagram et de suggerer le prochain message.

## BRIEF DU COACH
{brief.generated_brief}

Ton du coach : {brief.tone === 'tu' ? 'tutoiement' : 'vouvoiement'}
Offre : {brief.offer_description}
Cible : {brief.target_audience}
Objectif : {brief.goal === 'book_call' ? 'Amener le prospect a booker un appel' : 'Vendre en DM'}

## INFOS DU PROSPECT
Prenom : {lead.first_name}
Statut : {lead.status}
Source : {lead.source}
Tags : {lead.tags.join(', ')}
Notes : {lead.notes}
Pseudo IG : {lead.instagram_handle}

## CONVERSATION (du plus ancien au plus recent)
{messages.map(m => `[${m.sender_type === 'user' ? 'COACH' : 'PROSPECT'}] ${m.text}`).join('\n')}

## EXEMPLES DE CONVERSATIONS QUI ONT CONVERTI
{goldenExamples.map(ex => formatExample(ex)).join('\n---\n')}

## INSTRUCTIONS
Reponds en JSON avec :
- "guidance": 2-3 phrases expliquant la situation et la strategie recommandee
- "message": le message a envoyer au prospect, dans le style du coach
- "status_suggestion": (optionnel) si le statut du lead devrait changer, { "to": "nouveau_statut", "reason": "pourquoi" }

Le message doit etre naturel, personnalise, et suivre la strategie du coach. Pas de formules generiques. Maximum 3-4 phrases.
```

### Client Claude : `src/lib/ai/client.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function callClaude(prompt: string, model: string): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}
```

### Brief management : `src/lib/ai/brief.ts`

- `getBrief(workspaceId)` — fetch depuis `ai_coach_briefs`
- `generateBrief(answers)` — appelle Claude pour generer le brief a partir des reponses onboarding
- `updateBriefFromWins(workspaceId)` — re-analyse les conversations gagnantes et affine le brief

---

## Composant 4 — Self-Learning

### Trigger automatique

Quand un lead passe en statut `clos` (dans le moteur workflow ou manuellement) :
1. Fetch la conversation IG liee
2. Snapshot les messages dans `ai_conversation_outcomes` avec `outcome = 'won'`
3. Incrementer un compteur — tous les 10 wins, re-generer le brief enrichi

### Trigger manuel

Bouton dans Parametres > Assistant IA : "Analyser mes conversations gagnantes" → regenere le brief avec les nouveaux exemples.

---

## Migration SQL

```sql
-- Brief du coach pour l'IA
CREATE TABLE ai_coach_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  offer_description TEXT,
  target_audience TEXT,
  tone TEXT DEFAULT 'tu' CHECK (tone IN ('tu', 'vous', 'mixed')),
  approach TEXT,
  example_messages TEXT,
  goal TEXT DEFAULT 'book_call' CHECK (goal IN ('book_call', 'sell_dm', 'both')),
  generated_brief TEXT,
  wins_analyzed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations tagguees pour le self-learning
CREATE TABLE ai_conversation_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES ig_conversations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'no_response')),
  messages_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE ai_coach_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace brief" ON ai_coach_briefs FOR ALL USING (
  workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
);

ALTER TABLE ai_conversation_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace outcomes" ON ai_conversation_outcomes FOR ALL USING (
  workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
);
```

---

## Dependance npm

```
@anthropic-ai/sdk
```

---

## Variable d'environnement

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Fichiers a creer

| Fichier | Description |
|---------|-------------|
| `supabase/migrations/018_ai_assistant.sql` | Tables ai_coach_briefs + ai_conversation_outcomes + RLS |
| `src/lib/ai/client.ts` | Client Anthropic SDK |
| `src/lib/ai/suggest.ts` | Logique de generation suggestion (prompt, contexte, appel) |
| `src/lib/ai/brief.ts` | Gestion du brief coach (CRUD, generation, self-learning) |
| `src/app/api/ai/suggest/route.ts` | POST endpoint suggestion |
| `src/app/api/ai/brief/route.ts` | GET/POST/PATCH endpoint brief coach |
| `src/app/(dashboard)/parametres/assistant-ia/page.tsx` | Page onboarding + edition brief |
| `src/components/ai/AiSuggestionPanel.tsx` | UI guidance + convert + envoi/copier |
| `src/components/ai/AiOnboardingWizard.tsx` | Wizard 6 questions |
| `src/components/ai/AiBriefEditor.tsx` | Edition du brief genere |

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `src/components/shared/LeadSidePanel.tsx` | Ajouter bouton IA + AiSuggestionPanel |
| `src/components/messages/ConversationThread.tsx` | Ajouter bouton IA + AiSuggestionPanel |
| `src/components/layout/Sidebar.tsx` | Ajouter lien "Assistant IA" dans Parametres |
| `src/types/index.ts` | Ajouter types AiCoachBrief, AiSuggestion, AiConversationOutcome |

---

## Estimations

- **Migration + types** : rapide
- **Client Claude + suggest.ts + brief.ts** : coeur du systeme
- **API routes** : 2 routes (suggest + brief CRUD)
- **UI onboarding** : wizard 6 etapes
- **UI suggestion** : panel avec guidance + message + envoi/copier
- **Integration side panel + messages** : branchement du panel
- **Self-learning** : trigger auto sur status change + cron

---

*Spec generee le 2026-04-07 — ClosRM / Pierre*
