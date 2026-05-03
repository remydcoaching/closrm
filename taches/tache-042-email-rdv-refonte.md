# Tâche 042 — Refonte email confirmation RDV + pipeline rappels

## Objectif
Refondre l'email de confirmation/rappel de RDV (visuel premium, 3 templates au choix, couleur d'accent custom par calendrier), brancher le pipeline rappels sur le bon template, ajouter une page publique de gestion (annuler / reprogrammer), et résoudre la limitation Vercel Hobby cron via pg_cron Supabase.

## Contexte
Session du 2026-05-02 nuit + 2026-05-03 matin. Audit initial : l'email de confirmation existait mais n'était jamais envoyé (`if (!process.env.AWS_ACCESS_KEY_ID) return` silencieux + AWS SES pas configuré côté .env.local). Les rappels du calendrier (Confirmation H+0, H-2, H-24…) tombaient sur un fallback texte ultra basique au lieu d'utiliser le template HTML. Vercel Hobby plafonnait les crons à 1x/jour, donc les rappels ne partaient qu'à 8h le lendemain.

## Réalisations

### Email — refonte template
- 3 templates : **premium** (header dark luxe + détails illustrés), **minimal** (sobre Cal.com-ish), **plain** (texte brut)
- Couleur d'accent custom par calendrier (color picker dans l'UI)
- Bulle "Message de [coach]" qui remplace l'intro standard quand un message custom est saisi
- Header dark avec gradient + brand initial + badge "Confirmé"
- Card de détails avec barre verticale gauche en accent (remplace les SVG strippés par Gmail)
- Bloc visio premium (bouton avec ombre)
- Bloc lieu alternatif
- Bouton "Reprogrammer ou annuler" + footer disclaimer dans une section unifiée en bas
- Subject contextualisé : `Votre rendez-vous le [date] à [heure]`

### Aperçu live dans l'UI
- Endpoint `POST /api/calendars/preview-reminder` (auth, sample data + brand workspace réel)
- Composant `RemindersEditor` : iframe srcDoc qui se met à jour quand on tape (debounce 400ms) avec toggle Visio/Présentiel
- Bloc sélecteur de template + color picker visible si au moins un rappel email

### Historique des envois
- Endpoint `GET /api/calendars/[id]/reminders-log` (joins booking + lead)
- Composant `RemindersLog` : filtres par status, badges colorés, erreurs visibles, scrollable max 480px

### Booking horizon
- Migration `056_booking_max_advance_days.sql`
- Nouveau champ `max_advance_days` (nullable) dans `booking_calendars`
- Filtrage GET slots + validation POST sur les 2 routes publiques
- Input UI dans la config calendrier

### Page publique de gestion (manage_token)
- Migration `058_booking_manage_token.sql` (uuid auto-generated, unique index)
- Route `/booking/manage/[id]?token=xxx` (publique via token, pas d'auth)
- API `POST /api/public/bookings/[id]/cancel` + cancel reminders
- Bouton "Reprogrammer" → calendrier public pour re-réserver
- Middleware mis à jour pour autoriser `/book/*` et `/booking/*` même pour user logué

### Pipeline rappels
- À la création de booking : email **Confirmation** envoyé directement (avec template + accent + customMessage du calendrier)
- `createBookingReminders` skip les rappels delay=0 email (déjà envoyés direct, pas de doublon)
- Cron dédié `/api/cron/booking-reminders` (extrait du heavier workflow-scheduler)
- Skip silencieux si booking deleted/cancelled au moment de l'envoi (status=cancelled au lieu d'un fallback texte moche)

### Cron pg_cron Supabase (contournement Vercel Hobby)
- Migration `059_pgcron_booking_reminders.sql` + `060_pgcron_vault_secrets.sql`
- Extensions `pg_cron` + `pg_net` activées
- Schedule `* * * * *` qui ping `https://closrm.fr/api/cron/booking-reminders` avec Bearer token
- Secrets stockés dans Supabase Vault (ALTER DATABASE bloqué côté hosted) :
  - `app_url` = `https://closrm.fr`
  - `app_cron_secret` = même que la env var Vercel CRON_SECRET
- Vercel `vercel.json` : retiré le cron `booking-reminders` (workflow-scheduler reste à `0 8 * * *` pour les autres tâches)

### Personnalisation visuelle
- `email_template` (`premium` | `minimal` | `plain`) et `email_accent_color` (`#RRGGBB`) ajoutés à `booking_calendars` (migration `057_booking_email_template.sql`)
- Schema Zod, type TS, UI sélecteur (3 cards visuelles + color picker hex)
- Bulle "Message de" suit la couleur d'accent (background tinté + label assombri pour lisibilité)

### Fixes timezone
- Helper `src/lib/bookings/format.ts` : `formatBookingDateFR/TimeFR` qui force `Europe/Paris` via `Intl.DateTimeFormat`
- Avant : Vercel server tournait en UTC, un RDV à 10h Paris s'affichait `08:00` dans l'email
- Appliqué dans `reminders.ts` (resolveMessage) + cron + 3 call sites de création booking

### Bugs corrigés en route
- Le `SELECT` après `INSERT bookings` dans les 2 routes publiques ne retournait pas `manage_token` → bouton manage absent
- Icônes SVG inline strippées par Gmail (bulles roses vides) → remplacées par barre verticale colorée
- `<tr>` orphelins dans `<td>` qui faisaient sortir "À très vite" hors de la card
- Custom message qui apparaissait en double (intro standard + bulle) → conditionnel propre
- Footer disclaimer disparaissait visuellement par double séparateur → unifié dans une seule section

## Fichiers créés
- `supabase/migrations/056_booking_max_advance_days.sql`
- `supabase/migrations/057_booking_email_template.sql`
- `supabase/migrations/058_booking_manage_token.sql`
- `supabase/migrations/059_pgcron_booking_reminders.sql`
- `supabase/migrations/060_pgcron_vault_secrets.sql`
- `src/app/api/cron/booking-reminders/route.ts`
- `src/app/api/calendars/preview-reminder/route.ts`
- `src/app/api/calendars/[id]/reminders-log/route.ts`
- `src/app/api/public/bookings/[id]/cancel/route.ts`
- `src/app/api/dev/email-preview/booking-confirmation/route.ts`
- `src/app/booking/manage/[id]/page.tsx` + `ManageActions.tsx`
- `src/components/booking-calendars/RemindersLog.tsx`
- `src/lib/bookings/format.ts`
- `taches/tache-042-email-rdv-refonte.md` (ce fichier)

## Fichiers modifiés
- `src/lib/email/templates/booking-confirmation.ts` (refonte complète : 3 templates, helpers, dispatcher)
- `src/lib/bookings/reminders.ts` (skip delay=0 email + format timezone)
- `src/lib/supabase/middleware.ts` (autorise `/book` et `/booking`)
- `src/lib/validations/booking-calendars.ts` (schema Zod)
- `src/app/api/cron/workflow-scheduler/route.ts` (section 6 retirée — déléguée au nouveau endpoint)
- `src/app/api/bookings/route.ts` (passage template + accent + customMessage + manageUrl)
- `src/app/api/public/booking/[calendarId]/route.ts` (idem + booking horizon + select manage_token)
- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts` (idem)
- `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx` (UI : limite réservation + template + accent + historique)
- `src/components/booking-calendars/RemindersEditor.tsx` (bloc style email + preview live + custom message replace intro)
- `src/types/index.ts` (BookingCalendar étendu)
- `vercel.json` (workflow-scheduler reste 0 8 * * *, booking-reminders délégué à pg_cron Supabase)

## Setup post-merge (one-time, déjà fait)
1. Migrations 056-060 appliquées via `supabase db push --linked`
2. Secrets Vault créés via SQL editor :
   ```sql
   SELECT vault.create_secret('https://closrm.fr', 'app_url');
   SELECT vault.create_secret('<CRON_SECRET>', 'app_cron_secret');
   ```

## PR mergées (chronologique)
- #322 — feat(email): refonte email confirmation RDV (gros morceau)
- #324 — fix(middleware): widget public accessible aux users logués
- #326 — feat(cron): cron dédié booking-reminders (build cassé sur Hobby — réparé après)
- #328 — fix(cron): cron Hobby-compatible + envoi direct Confirmation
- #330 — feat(cron): pg_cron Supabase
- #332 — fix(cron): pg_cron via Vault
- #334 — fix: timezone + skip deleted booking + manage_token select
- #336 — fix(email): SVG icônes → barre verticale (Gmail strip)
- #338 — fix: padding bouton manage + pagination historique
- #340 — fix: bouton+footer unifiés + historique scrollable
- #342 — fix(email): bulle "Message de" suit la couleur d'accent

## Hors scope V1 (à itérer plus tard)
- Logo image custom uploadé par le coach (pour l'instant : initiale du brand)
- Plus de templates (luxe coloré, B2B sobre, etc.)
- Tracking delivery réel via SNS bounce/complaint AWS (pour l'instant : "sent" = SES a accepté, pas garanti livré)
- Timezone par workspace (pour l'instant : Europe/Paris hardcoded)
- Reschedule "linké" : annule l'ancien et ouvre la sélection en un seul flow

## Notes
- Cron pg_cron tourne toutes les minutes, ~1 min de latence max sur les rappels — testé et validé en prod le 2026-05-03
- Vercel Hobby toujours utilisé, pas d'upgrade payant nécessaire
