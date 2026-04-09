# Plan d'implementation — T-027 + T-029 + T-030

> **Date :** 2026-04-07
> **Developpeur :** Pierre
> **Branches :** `feature/pierre-lead-plus-plus`, `feature/pierre-automations-v2`, `feature/pierre-booking-google-meet`
> **Strategie :** Execution sequentielle T-027 → T-030 → T-029 (ordre optimise par dependances)

---

## ORDRE D'EXECUTION ET JUSTIFICATION

**T-027 (Lead++) en premier** — c'est la priorite n.1 et elle cree `leads.instagram_handle` dont T-029 a besoin pour le trigger `lead_with_ig_handle`.

**T-030 (Booking Google Meet) en deuxieme** — independant, compact, et produit `createGoogleMeetEvent()` que T-029 reutilisera comme action workflow `create_google_meet`.

**T-029 (Automations v2) en dernier** — c'est la plus grosse tache et elle depend des deux autres (nouveau trigger + nouvelle action).

---

# T-027 — LEAD++ (workflow inline, pseudo IG, saisie en chaine, onglet Messages)

## Etat des lieux (audit)

### Ce qui existe deja
- **LeadForm.tsx** : modale avec champs prenom/nom/tel/email/source/tags/notes, soumission POST `/api/leads`
- **API POST /api/leads** : validation Zod, insert DB, fire trigger `new_lead` en background
- **Fiche lead** : `/leads/[id]/page.tsx` + `LeadDetail.tsx` avec sections contact, statut, tags, notes, timeline (calls + follow-ups)
- **ig_conversations** : table avec colonne `lead_id` (FK nullable vers leads), `participant_username` pour le handle IG
- **API messages** : GET `/api/instagram/messages?conversation_id={id}` retourne les messages d'une conversation
- **Moteur workflows** : mature, avec actions `create_followup`, `send_dm_instagram` (stub), templates variables
- **Derniere migration** : 014

### Ce qui manque
- Colonne `leads.instagram_handle` en DB
- Champ pseudo IG dans le formulaire
- Liaison automatique lead ↔ ig_conversation
- Bouton "Ajouter et continuer"
- Toggle workflow inline avec editeur compact
- Onglet "Messagerie" sur la fiche lead

---

## Phase 1 — Migration SQL (015)

**Fichier :** `supabase/migrations/015_lead_instagram_handle.sql`

```sql
-- Ajout colonne instagram_handle sur la table leads
ALTER TABLE leads ADD COLUMN instagram_handle TEXT;

-- Index pour recherche rapide par handle
CREATE INDEX idx_leads_instagram_handle ON leads(instagram_handle) WHERE instagram_handle IS NOT NULL;
```

**schema.sql** : ajouter `instagram_handle text` dans le CREATE TABLE leads

---

## Phase 2 — Types et Validations

### `src/types/index.ts`
- Ajouter `instagram_handle: string | null` a l'interface `Lead`

### `src/lib/validations/leads.ts`
- Ajouter au schema Zod :
```typescript
instagram_handle: z.string()
  .regex(/^[a-zA-Z0-9._]{1,30}$/, 'Handle Instagram invalide')
  .optional()
  .or(z.literal(''))
  .default('')
```

---

## Phase 3 — API POST /api/leads (modification)

**Fichier :** `src/app/api/leads/route.ts`

Modifications :
1. Accepter `instagram_handle` dans le body (via le schema Zod modifie)
2. Inserer `instagram_handle` en DB (nettoyer le @ en amont si present)
3. **Apres l'insert du lead** — si `instagram_handle` non vide :
   - SELECT `ig_conversations` WHERE `workspace_id` = current AND `participant_username` = handle
   - Si match → UPDATE `ig_conversations SET lead_id = new_lead.id`
4. **Si workflow inline fourni** dans le body (nouveau champ `inline_workflow`) :
   - POST interne vers `/api/workflows` pour creer le workflow
   - POST vers `/api/workflows/{id}/steps` pour chaque step
   - POST vers `/api/workflows/{id}/activate` pour l'activer
   - Alternative simplifiee : creer directement N follow-ups via insert DB

### Nouveau champ body (optionnel) :
```typescript
inline_workflow?: {
  steps: Array<{
    channel: 'whatsapp' | 'email' | 'instagram_dm' | 'manuel'
    delay_days: number
    template_text: string
  }>
}
```

---

## Phase 4 — LeadForm.tsx (refonte UI)

**Fichier :** `src/components/leads/LeadForm.tsx`

### Ajouts :
1. **Champ `instagram_handle`** : input texte avec icone Instagram, placeholder "@pseudo"
   - Nettoyage auto du @ a la saisie
   - Validation regex live
   - Si rempli + source = 'manuel' → suggestion auto de changer source en 'instagram_ads' ou 'follow_ads' (radio inline)

2. **Toggle "Creer un workflow de relance"** : switch sous le select source
   - Quand active → affiche l'editeur compact
   - **Pre-remplissage par source** :
     - `instagram_ads` / `follow_ads` → DM IG J0 + DM IG J+2
     - `facebook_ads` → WhatsApp J0 + WhatsApp J+1 + Email J+3
     - `formulaire` / `funnel` → Email J0 + WhatsApp J+1
     - `manuel` → vide
   - L'editeur affiche une liste de steps avec : canal (badge), delai (J+X), message (textarea court)
   - Boutons + / - pour ajouter/supprimer un step

3. **Bouton "Ajouter et continuer"** : a cote du bouton "Ajouter"
   - Style secondaire (outline) vs primaire
   - Comportement : soumet le form, affiche toast "Lead ajoute - {{prenom}}", reset le form SAUF source + toggle workflow (gain de temps)
   - Focus auto sur le champ prenom

### Nouveau composant : `InlineWorkflowEditor.tsx`
- Liste de steps editables
- Props : `source`, `steps`, `onStepsChange`
- Chaque step = { channel, delay_days, template_text }
- Variables disponibles : {{prenom}}, {{nom}}, {{nom_coach}}

### Templates par source : `src/lib/leads/workflow-templates.ts`
- Export des templates pre-remplis par source
- Utilise par InlineWorkflowEditor pour le pre-remplissage initial

---

## Phase 5 — Onglet Messagerie sur la fiche lead

### Modification : `src/app/(dashboard)/leads/[id]/page.tsx` et `LeadDetail.tsx`

1. **Nouveau systeme d'onglets** dans LeadDetail :
   - Infos | Appels | Follow-ups | Notes | Messagerie
   - Onglet "Messagerie" visible uniquement si `lead.instagram_handle` non null ou ig_conversation liee

2. **Nouveau composant : `LeadMessagesTab.tsx`**
   - Fetch ig_conversations WHERE lead_id = lead.id
   - Si conversation trouvee → fetch messages via `/api/instagram/messages?conversation_id={id}`
   - Affichage : timeline type chat (bulles gauche/droite selon sender_type)
   - Header : pseudo IG + lien "Ouvrir dans Messages"
   - Read-only en V1 (pas d'envoi)

---

## Phase 6 — Tests et coordination

- Tester creation lead avec handle IG → verifier liaison auto ig_conversation
- Tester saisie en chaine (5 leads d'affilee)
- Tester workflow inline → verifier creation des follow-ups
- Tester onglet Messagerie → verifier affichage des DMs
- **Prevenir Remy** : migration 015 touche table `leads`, modif de LeadForm.tsx et API leads

---

# T-030 — BOOKING → AUTO GOOGLE MEET

## Etat des lieux (audit)

### Ce qui existe deja
- **booking_locations** : table avec `name`, `address`, `is_active` — PAS de `location_type`
- **bookings** : table avec `google_event_id` (deja present), `location_id` (FK) — PAS de `meet_url`
- **Google Calendar lib** : `src/lib/google/calendar.ts` avec `createGoogleCalendarEvent()`, `deleteGoogleCalendarEvent()`, `getValidAccessToken()`, refresh auto des tokens
- **API bookings** : CRUD complet + page publique `/api/public/book/[workspace]/[calendar]`
- **Notifications** : BookingNotifications.tsx (browser push), PAS d'email de confirmation auto

### Ce qui manque
- `booking_locations.location_type` ('in_person' | 'online')
- `bookings.meet_url` pour stocker le lien
- `conferenceData` dans la creation d'event Google Calendar
- Email de confirmation avec lien Meet
- UI pour distinguer lieu physique/en ligne

---

## Phase 1 — Migration SQL (016)

**Fichier :** `supabase/migrations/016_booking_meet_and_location_type.sql`

```sql
-- Type de lieu : presentiel ou en ligne
ALTER TABLE booking_locations ADD COLUMN location_type TEXT NOT NULL DEFAULT 'in_person'
  CHECK (location_type IN ('in_person', 'online'));

-- Lien Google Meet sur les bookings
ALTER TABLE bookings ADD COLUMN meet_url TEXT;
```

**schema.sql** : ajouter les deux colonnes

---

## Phase 2 — Types et Validations

### `src/types/index.ts`
- `BookingLocation` += `location_type: 'in_person' | 'online'`
- `Booking` += `meet_url: string | null`

### Validation booking-locations
- Ajouter `location_type` au schema Zod de creation/edition de locations

---

## Phase 3 — Google Meet creation

### Modification : `src/lib/google/calendar.ts`

Modifier `createGoogleCalendarEvent()` pour accepter une option `withMeet: boolean` :
- Si `withMeet = true` → ajouter `conferenceData` au payload :
```typescript
conferenceData: {
  createRequest: {
    requestId: crypto.randomUUID(),
    conferenceSolutionKey: { type: 'hangoutsMeet' }
  }
}
```
- Ajouter le header `conferenceDataVersion: 1` dans l'URL
- Retourner le `hangoutLink` depuis la reponse Google en plus du `eventId`

### Retour enrichi :
```typescript
{ eventId: string, meetUrl: string | null }
```

---

## Phase 4 — API Bookings (modification)

### POST /api/bookings et POST /api/public/book/...

1. Apres la creation du booking, verifier si le `location_id` pointe vers un lieu de type `online`
2. Si oui ET Google Calendar connecte → creer l'event avec `withMeet: true`
3. Stocker le `meet_url` retourne dans `bookings.meet_url`
4. Si Google non connecte → laisser `meet_url = null`, pas de blocage

### PATCH /api/bookings/[id]

1. Si reprogrammation (changement de `scheduled_at`) et `meet_url` existe :
   - Mettre a jour l'event Google Calendar (le Meet link reste valide)
2. Si annulation (status → 'cancelled') et `google_event_id` existe :
   - Supprimer l'event Google (deja en place)
   - Mettre `meet_url = null`

---

## Phase 5 — UI Locations

### Modification : API `/api/booking-locations`
- Accepter `location_type` dans POST et PATCH
- Retourner `location_type` dans les reponses

### Modification : UI creation/edition de location
- Ajouter un toggle/select "Type : Presentiel / En ligne"
- Si "En ligne" selectionne → masquer le champ adresse
- Warning si Google Calendar non connecte et type = online :
  "Connectez Google Calendar pour generer automatiquement un lien Google Meet"

---

## Phase 6 — Notifications avec lien Meet

### Email de confirmation (nouveau)
- Template email envoye au prospect apres booking confirme
- Contient : date, heure, nom du coach, lien Meet (si online)
- Envoye via Resend (lib existante)
- Declenche dans POST booking apres creation

### Fiche booking CRM
- Afficher le bouton "Rejoindre le Meet" si `meet_url` non null
- Lien cliquable ouvrant dans un nouvel onglet

---

# T-029 — AUTOMATIONS V2

## Etat des lieux (audit)

### Ce qui existe deja (solide)
- **Moteur engine.ts** : execution sequentielle des steps, gestion delay/condition/wait_for_event, branching (parent_step_id + branch true/false), logging complet dans workflow_execution_logs
- **Trigger dispatcher** : `fireTriggersForEvent()` avec matching de config par trigger type
- **13 triggers** declares dans les types (8 implementes avec firing code)
- **10 actions** declarees dans les types, handlers pour : send_email, send_whatsapp, send_notification, create_followup, change_lead_status, add_tag, remove_tag, fb_conversions (stub)
- **Builder UI** : WorkflowBuilder avec DnD, TriggerConfigPanel, ActionConfigPanel, branching visuel basique
- **Cron scheduler** : reprend les delays, declenche call_in_x_hours et followup_pending_x_days
- **Templates** : 14 templates pre-definis, variables {{prenom}}, {{nom}}, {{date_rdv}}, etc.

### Stubs a completer
- `send_dm_instagram` : stub dans send-dm-instagram.ts, `sendIgMessage()` pret dans instagram/api.ts
- `facebook_conversions_api` : stub

### Handlers declares dans les types mais ABSENTS du registry
- `enroll_in_sequence`, `add_note`, `set_reached`, `schedule_call`, `webhook`

### Ce qui manque
- Nouveaux triggers : `lead_imported`, `lead_with_ig_handle`, `booking_no_show`, `lead_inactive_x_days`
- Nouvelles actions : `send_dm_instagram` (completer), `create_google_meet`, `update_lead_field`, `wait_until_date`
- UI : tableau d'executions, dry-run, re-run failed
- Observability : metriques, alertes, export CSV

---

## Phase 1 — Migration SQL (017)

**Fichier :** `supabase/migrations/017_automations_v2.sql`

```sql
-- Tracking derniere activite du lead (pour trigger lead_inactive_x_days)
ALTER TABLE leads ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT now();

-- Notification d'echec sur les workflows
ALTER TABLE workflows ADD COLUMN notify_on_failure BOOLEAN DEFAULT FALSE;
ALTER TABLE workflows ADD COLUMN failure_notification_channel TEXT;
```

---

## Phase 2 — Nouveaux triggers

### Types : ajouter a `WorkflowTriggerType`
- `lead_imported` — fire quand des leads sont crees en bulk (pour T-031 Remy)
- `lead_with_ig_handle` — fire quand un lead est cree/modifie avec un instagram_handle
- `booking_no_show` — fire quand un booking passe en no_show
- `lead_inactive_x_days` — fire par cron quand un lead n'a pas d'activite depuis X jours

### Firing code a ajouter :

**`lead_with_ig_handle`** : dans POST /api/leads, apres l'insert, si `instagram_handle` fourni :
```typescript
fireTriggersForEvent(workspaceId, 'lead_with_ig_handle', { lead_id, instagram_handle })
```

**`booking_no_show`** : dans PATCH /api/bookings/[id], quand status → 'no_show' :
```typescript
fireTriggersForEvent(workspaceId, 'booking_no_show', { lead_id, booking_id })
```

**`lead_inactive_x_days`** : dans le cron scheduler, nouveau bloc :
- Fetch workflows actifs avec trigger `lead_inactive_x_days`
- Pour chaque, lire `trigger_config.days` (defaut 30)
- Chercher leads WHERE `last_activity_at < now() - interval 'X days'`
- Anti-duplicate : pas d'execution pour ce lead+workflow dans les derniers X jours
- Fire pour chaque lead inactif

**`lead_imported`** : sera fire par Remy dans T-031, on expose juste le trigger + matching

### Matching config dans trigger.ts :
- `lead_with_ig_handle` : pas de config specifique (fire pour tout handle)
- `booking_no_show` : pas de config specifique
- `lead_inactive_x_days` : config `{ days: number }`
- `lead_imported` : config `{ source?: LeadSource }` (filtre optionnel par source)

---

## Phase 3 — Nouvelles actions

### `send_dm_instagram` (completer le stub)

**Fichier :** `src/lib/workflows/actions/send-dm-instagram.ts`

Implementation :
1. Resoudre le template du message
2. Recuperer les credentials IG du workspace (integration Meta)
3. Trouver le `participant_ig_id` du lead via `ig_conversations` (WHERE lead_id = lead.id)
4. Si pas de conversation liee → skip avec log "Aucune conversation IG liee"
5. Appeler `sendIgMessage(token, pageId, recipientIgId, message)`
6. Retourner succes + message_id

### `create_google_meet` (nouveau)

**Fichier :** `src/lib/workflows/actions/create-google-meet.ts`

Implementation :
1. Utiliser la fonction `createGoogleCalendarEvent()` modifiee en T-030 (avec `withMeet: true`)
2. Config : `{ title, duration_minutes, scheduled_at? }` (si pas de date → J+1 a 10h par defaut)
3. Stocker le meet_url dans le log d'execution
4. Retourner { eventId, meetUrl }

### `update_lead_field` (nouveau)

**Fichier :** `src/lib/workflows/actions/update-lead-field.ts`

Implementation :
1. Config : `{ field: string, value: string }`
2. Whitelist de champs modifiables : `status`, `tags`, `notes`, `reached`, `instagram_handle`
3. Template resolution sur `value`
4. UPDATE leads SET {field} = value WHERE id = lead_id

### `wait_until_date` (nouveau)

**Fichier :** Modification de `engine.ts`

Implementation :
- Nouveau step_type `wait_until_date` (ou reutiliser `wait_for_event` avec event_type specifique)
- Config : `{ target_date: ISO8601 }` ou `{ field: 'booking.scheduled_at', offset_hours: -2 }`
- Dans le moteur : set `resume_at = target_date`, status = 'waiting'

### Handlers manquants (bonus)

Completer aussi les handlers deja declares mais absents :
- `add_note` : INSERT note dans leads.notes (append)
- `set_reached` : UPDATE leads SET reached = true
- `schedule_call` : INSERT dans calls avec config (type, scheduled_at)

---

## Phase 4 — Builder UI ameliorations

### Tableau d'executions : `ExecutionHistoryPanel.tsx`

- Nouvel onglet "Historique" dans la page workflow [id]
- Table : date, lead, statut (success/failed/waiting), duree, nb steps
- Filtre par statut et periode
- Ligne expandable → detail des logs step par step
- Bouton "Re-executer" sur les failed

### Dry-run : `DryRunDialog.tsx`

- Bouton "Tester" dans le header du workflow
- Modale : selectionner un lead (dropdown search)
- POST `/api/workflows/[id]/dry-run` avec `{ lead_id, dry_run: true }`
- Le moteur execute sans envoyer de vrais messages (flag dry_run dans le context)
- Affiche le resultat : chaque step + ce qui SERAIT envoye

### API route : `/api/workflows/[id]/dry-run/route.ts`
- Appelle `executeWorkflow()` avec flag `dryRun: true`
- Dans le moteur, les actions en mode dry-run loguent mais n'executent pas

### Re-run : `/api/workflows/[id]/executions/[execId]/retry/route.ts`
- Reset execution : current_step = 0, status = 'running'
- Relance `resumeExecution()`

---

## Phase 5 — Observability

### Metriques par workflow
- Ajouter des compteurs dans la page workflow : total runs, taux de succes, derniere execution
- Calcule en temps reel depuis `workflow_executions` (pas de table metrics separee en V1)

### Alertes sur echec
- Si `workflow.notify_on_failure = true` :
  - A la fin d'une execution failed, envoyer notification au coach
  - Canal configure dans `failure_notification_channel` (email, telegram, whatsapp)
  - Reutiliser l'action `send_notification` existante

### TriggerConfigPanel + ActionConfigPanel
- Ajouter les UI de config pour chaque nouveau trigger/action
- Memes patterns que les existants (formulaires conditionnels selon le type)

---

## Phase 6 — Update last_activity_at

Pour alimenter le trigger `lead_inactive_x_days`, mettre a jour `leads.last_activity_at` dans :
- POST /api/calls (appel log)
- POST /api/follow-ups (follow-up cree)
- PATCH /api/leads (modification manuelle)
- Actions workflow qui touchent au lead (change_status, add_tag, etc.)

---

# RESUME GLOBAL — FICHIERS PAR TACHE

## T-027 — Lead++ (branche `feature/pierre-lead-plus-plus`)

| Action | Fichier |
|--------|---------|
| CREER | `supabase/migrations/015_lead_instagram_handle.sql` |
| CREER | `src/components/leads/InlineWorkflowEditor.tsx` |
| CREER | `src/components/leads/LeadMessagesTab.tsx` |
| CREER | `src/lib/leads/workflow-templates.ts` |
| MODIFIER | `src/types/index.ts` (Lead += instagram_handle) |
| MODIFIER | `src/lib/validations/leads.ts` (Zod += instagram_handle) |
| MODIFIER | `src/components/leads/LeadForm.tsx` (champ IG + toggle workflow + saisie chaine) |
| MODIFIER | `src/app/api/leads/route.ts` (accept handle + liaison ig_conv + workflow inline) |
| MODIFIER | `src/app/(dashboard)/leads/[id]/page.tsx` (onglet Messagerie) |
| MODIFIER | `supabase/schema.sql` |

## T-030 — Booking Google Meet (branche `feature/pierre-booking-google-meet`)

| Action | Fichier |
|--------|---------|
| CREER | `supabase/migrations/016_booking_meet_and_location_type.sql` |
| CREER | `src/lib/email/templates/booking-confirmation.ts` |
| MODIFIER | `src/types/index.ts` (BookingLocation += location_type, Booking += meet_url) |
| MODIFIER | `src/lib/google/calendar.ts` (conferenceData + retour meetUrl) |
| MODIFIER | `src/app/api/bookings/route.ts` (creer Meet si online) |
| MODIFIER | `src/app/api/bookings/[id]/route.ts` (gerer annulation/reprog Meet) |
| MODIFIER | `src/app/api/public/book/.../route.ts` (creer Meet si online) |
| MODIFIER | `src/app/api/booking-locations/route.ts` (accepter location_type) |
| MODIFIER | `supabase/schema.sql` |

## T-029 — Automations v2 (branche `feature/pierre-automations-v2`)

| Action | Fichier |
|--------|---------|
| CREER | `supabase/migrations/017_automations_v2.sql` |
| CREER | `src/lib/workflows/actions/create-google-meet.ts` |
| CREER | `src/lib/workflows/actions/update-lead-field.ts` |
| CREER | `src/components/automations/ExecutionHistoryPanel.tsx` |
| CREER | `src/components/automations/DryRunDialog.tsx` |
| CREER | `src/app/api/workflows/[id]/dry-run/route.ts` |
| CREER | `src/app/api/workflows/[id]/executions/[execId]/retry/route.ts` |
| MODIFIER | `src/types/index.ts` (nouveaux triggers + actions) |
| MODIFIER | `src/lib/workflows/actions/send-dm-instagram.ts` (completer stub) |
| MODIFIER | `src/lib/workflows/actions/index.ts` (registry += nouveaux handlers) |
| MODIFIER | `src/lib/workflows/engine.ts` (wait_until_date + dry-run flag) |
| MODIFIER | `src/lib/workflows/trigger.ts` (matching nouveaux triggers) |
| MODIFIER | `src/app/api/cron/workflow-scheduler/route.ts` (booking_no_show + lead_inactive) |
| MODIFIER | `src/components/automations/TriggerConfigPanel.tsx` |
| MODIFIER | `src/components/automations/ActionConfigPanel.tsx` |
| MODIFIER | `src/components/automations/WorkflowBuilder.tsx` |

---

# POINTS DE COORDINATION AVEC REMY

| Sujet | Action requise |
|-------|---------------|
| Migration 015 (leads.instagram_handle) | Prevenir Remy AVANT push |
| LeadForm.tsx modifie | Prevenir Remy — risque de conflit avec T-031 |
| API POST /api/leads modifiee | Prevenir Remy |
| types/index.ts modifie (Lead, triggers, actions) | Accord mutuel |
| Trigger `lead_imported` | Remy le fire dans T-031, Pierre l'expose dans T-029 |
| schema.sql | Chaque modif annoncee |

---

*Plan genere le 2026-04-07 — Pierre / Claude Code*
