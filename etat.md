# Etat du projet — ClosRM

> Fichier mis a jour obligatoirement a la fin de chaque tache.
> Derniere mise a jour : 2026-04-10

---

## Statut global

**Phase actuelle :** Developpement V1 (finalisation) + features avancees (IA)
**Version :** 0.5
**Branche principale active :** `develop`

---

## Modules — Etat d'avancement

| Module | Responsable | Statut | Tache(s) |
|--------|-------------|--------|----------|
| Setup projet (Next.js + Supabase + Auth + Layout) | Remy | ✅ Termine | — |
| Auth (login, register, reset, middleware, hooks) | Pierre | ✅ Termine | T-002 |
| Landing page | Pierre | ✅ Termine | T-002 |
| Module Leads — Liste + API | Remy | ✅ Termine | T-004 |
| Module Leads — Fiche lead | Remy | ✅ Termine | T-004 |
| **Lead++ (pseudo IG, relances directes, saisie chaine, Messages tab)** | **Pierre** | **✅ Termine** | **T-027** |
| Dashboard d'accueil (vraies donnees) | Remy | ✅ Termine | T-003 |
| Module Closing — API + Frontend | Pierre | ✅ Termine | T-007 |
| Module Follow-ups — API + Frontend | Pierre | ✅ Termine | T-008 |
| Module Statistiques | Remy | ✅ Termine | T-011 |
| Base de donnees (vue globale) | Remy | ✅ Termine | T-012 |
| Module Automations v1 (Workflows) | Pierre | ✅ Termine | T-014 |
| **Module Automations v2 (4 triggers, 6 actions, dry-run, historique)** | **Pierre** | **✅ Termine** | **T-029** |
| **Refonte visuelle Automations** | **Pierre** | **✅ Termine** | **2026-04-07** |
| Notifications WhatsApp/Telegram/Email | Pierre | ✅ Termine | T-016 |
| Parametres Reglages | Pierre | ✅ Termine | T-018 |
| Parametres Integrations | Pierre | ✅ Termine | T-019 |
| Dark/Light Mode + Branding dynamique | Pierre | ✅ Termine | — |
| Integration Meta Ads (OAuth + webhook + UI) | Remy | ✅ Termine | T-013 |
| Integration Google Calendar | Pierre | ✅ Termine | T-022 |
| Module Publicites (Meta Ads dashboard) | Remy | ✅ Termine | T-017 |
| Module Publicites v2 — Leadform/Follow Ads + sante | Remy | ✅ Termine | T-025 |
| Source `follow_ads` + channel `instagram_dm` | Remy | ✅ Termine | A-007 |
| Module Emails (sequences + broadcast) | Pierre | ✅ Termine | T-020 |
| Module Calendrier / Booking | Pierre | ✅ Termine | T-022 |
| **Booking → auto Google Meet + 3 types de lieu** | **Pierre** | **✅ Termine** | **T-030** |
| Module Reseaux Sociaux (Instagram) | Pierre | ✅ Termine | T-023, T-024 |
| Module Messages (DMs Instagram) | Pierre | ✅ Termine | T-023, T-024 |
| Module Commentaires (Instagram) | Pierre | ✅ Termine | T-024 |
| Publication Instagram (Post/Reel/Story) | Pierre | ✅ Termine | T-024 |
| Planification auto Instagram (cron) | Pierre | ✅ Termine | T-024 |
| **Assistant IA de Relance (Guidance + Convert + Brief + Self-learning)** | **Pierre** | **✅ Termine** | **T-032** |
| **Lead magnets structures (titre + lien) dans Assistant IA** | **Pierre** | **✅ Termine** | **A-011** |
| **Funnels v2 — Direction artistique (presets + 9 effets)** | **Remy** | **✅ Termine** | **T-028a** |
| **Funnels v2 — Migration des 13 blocs** | **Remy** | **✅ Termine** | **T-028c** |
| **Funnels v2 — Refonte builder UX** | **Remy** | **✅ Termine** | **T-028b** |
| **Funnels — BookingBlock fonctionnel (calendrier integre)** | **Remy** | **✅ Termine** | **A-028a-01** |
| **Funnels — FormBlock fonctionnel (creation lead + workflows)** | **Remy** | **✅ Termine** | **A-028a-02** |
| **Funnels — RedirectPicker unifie + templates enrichis** | **Remy** | **✅ Termine** | **A-028a-01/02** |
| **Module Automations (v1+v2)** | **Pierre** | **⚠️ Code OK, APIs manquantes** | **T-014, T-029** |
| Instagram Automations (trigger comment_keyword) | Pierre | ⬜ Non demarre | T-021 |
| Import portefeuille leads (CSV + alternatives) | Remy | ⬜ Non demarre | T-031 |
| Linktree interne (liens trackables par lead) | — | ⬜ Non demarre | A-010 |
| Followers-as-prospects (V2) | Remy | ❌ Abandonne (API IG) | T-026 |

---

## Session du 2026-04-07/08 — Resume des travaux Pierre

### Taches planifiees par Remy (T-027, T-029, T-030)

| Tache | Demande Remy | Resultat |
|-------|-------------|----------|
| **T-027 Lead++** | Pseudo IG, workflow inline, saisie chaine, onglet Messages | ✅ Fait — pseudo IG auto-source, relances directes (pas workflow), presets J+1→J+30, onglet Messages read-only, liaison auto ig_conversations |
| **T-029 Automations v2** | Nouveaux triggers/actions, observability | ✅ Fait — 4 triggers (lead_imported, lead_with_ig_handle, booking_no_show, lead_inactive), 6 actions (send_dm_ig, create_meet, update_lead_field, add_note, set_reached, schedule_call), dry-run, historique executions, re-run, alertes echec |
| **T-030 Booking Google Meet** | Distinguer presentiel/en ligne, Meet auto | ✅ Fait — 3 types de lieu (presentiel/Google Meet/visio custom), Meet auto via conferenceData, email confirmation, bouton "Rejoindre le Meet" |

### Travaux supplementaires (session)

| Travail | Detail |
|---------|--------|
| Refonte visuelle Automations | Page liste (cartes, filtres, recherche), page workflow [id] (3 onglets), modale creation, composants polish |
| LeadForm ameliore | Source auto IG, prenom optionnel, section relances toujours visible, presets + nurturing |
| Follow-up action modal | Presets relance (demain→1 mois) + nurturing (1-3 mois) + raison optionnelle |
| Page Leads UX | Clic ligne → side panel (plus de bouton "Voir"), bouton supprimer lead (hard delete) |
| Calendar locations | 3 types dans edition calendrier (presentiel/Meet/visio) |
| **T-032 Assistant IA** | Spec + plan + implementation complete — brief coach (wizard 7 etapes), suggestion IA (guidance + convert), self-learning, cle API par coach, lead magnets structures |

### Coordination avec Remy — Points a communiquer

1. **Migrations 015-020 appliquees** : `leads.instagram_handle`, `booking_locations.location_type`, `bookings.meet_url`, `leads.last_activity_at`, `workflows.notify_on_failure`, `ai_coach_briefs`, `ai_conversation_outcomes`, `ai_coach_briefs.api_key`, `ai_coach_briefs.lead_magnets`
2. **LeadForm.tsx modifie** : champ pseudo IG, section relances, saisie en chaine — risque de conflit avec T-031
3. **API leads modifiee** : POST accepte instagram_handle + inline_workflow, DELETE = hard delete
4. **types/index.ts modifie** : Lead += instagram_handle, nouveaux types IA, nouveaux triggers/actions workflow
5. **Trigger `lead_imported`** expose dans T-029 — Remy peut le fire dans T-031

---

## Blocages APIs — a resoudre avant mise en prod

| Action workflow | API requise | Statut |
|---|---|---|
| `send_whatsapp` | Meta WhatsApp Business API (token + phone number ID) | ⬜ Pas configure |
| `send_dm_instagram` | Meta Instagram Messaging API (page access token) | ⬜ Pas configure |
| `send_email` | Resend API (webhook en prod) | ⬜ Webhook pas configure |
| `create_google_meet` | Google Calendar API (OAuth) | ⚠️ OAuth OK, pas teste en prod |
| `send_notification` (Telegram) | Telegram Bot Token | ⬜ Pas configure |
| Cron workflow-scheduler | Vercel Cron | ⬜ Pas configure en prod |

> Les automations sont **fonctionnelles au niveau code** mais les actions qui envoient des messages (WhatsApp, DM IG, email, Telegram) ne marcheront qu'une fois les APIs configurees dans Parametres > Integrations.

---

*Mis a jour le 2026-04-08 par Claude Code — ClosRM*
