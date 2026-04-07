# Tâche 030 — Booking : création automatique d'un Google Meet pour les RDV en ligne

> **Statut :** ⬜ Non démarré
> **Développeur :** Pierre
> **Date de création :** 2026-04-07
> **Branche Git prévue :** `feature/pierre-booking-google-meet`

---

## Objectif

Quand un prospect réserve un créneau via la page de booking publique d'un coach,
et que le **booking calendar associé est de type "en ligne"**, créer
automatiquement un événement Google Calendar avec un lien Google Meet attaché.
Le lien doit être :

1. Inséré dans la confirmation envoyée au prospect
2. Inséré dans la confirmation envoyée au coach
3. Visible dans la fiche booking côté CRM
4. Synchronisé avec le Google Calendar du coach (si connecté)

---

## Périmètre

### 1. Distinction présentiel / en ligne sur les booking calendars

- [ ] Vérifier comment c'est géré aujourd'hui : `BookingLocation` existe avec
      un champ `address` (types/index.ts:275). Probablement que `address = null`
      ou un type particulier indique un meet en ligne. À auditer.
- [ ] Si pas encore distingué : ajouter un champ `location_type: 'in_person' | 'online'`
      sur `booking_locations` (migration SQL)
- [ ] UI Réglages > Booking : toggle "Lieu : présentiel / en ligne" lors de
      la création/édition d'un location

### 2. Création automatique du Meet via Google Calendar API

- [ ] À chaque INSERT dans `bookings` :
  1. Vérifier si la `booking_location_id` est de type `online`
  2. Vérifier si l'intégration Google Calendar est connectée pour ce workspace
  3. Si oui → appeler `events.insert` avec `conferenceData.createRequest`
     (génère automatiquement un Meet)
  4. Récupérer le `hangoutLink` et le stocker dans `bookings.meet_url`
  5. Sinon (Google non connecté) → fallback : créer un lien Meet "vide" via
     une URL générique ? Ou laisser le coach configurer manuellement.
- [ ] Migration SQL : ajouter `bookings.meet_url text` (nullable)

### 3. Diffusion du lien Meet

- [ ] **Email de confirmation au prospect** : ajouter le lien Meet en évidence
- [ ] **Email/notification au coach** : idem
- [ ] **Fiche booking dans le CRM** : afficher le bouton "Rejoindre le Meet"
- [ ] **Sync Google Calendar du coach** : l'événement créé doit déjà avoir
      le Meet (via `conferenceData`)

### 4. Annulation / Reprogrammation

- [ ] À l'annulation d'un booking → supprimer l'événement Google + le Meet
- [ ] À la reprogrammation → mettre à jour l'event (le `hangoutLink` reste
      valide normalement)

---

## Fichiers concernés

### Fichiers existants (à modifier)
- `src/lib/google/calendar.ts` (ou équivalent — créer si pas encore)
- `src/app/api/bookings/route.ts` (création)
- `src/app/api/bookings/[id]/route.ts` (update/delete)
- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts` (booking public)
- `src/types/index.ts` — `Booking` += `meet_url: string \| null`,
  `BookingLocation` += `location_type: 'in_person' \| 'online'`
- `src/components/booking/BookingDetailModal.tsx` ou équivalent
- Templates email de confirmation booking

### Fichiers à créer
- `supabase/migrations/0XX_booking_meet_and_location_type.sql`
- `src/lib/google/meet.ts` — helper pour appel à `conferenceData.createRequest`

---

## Tâches liées

| Relation | Tâche | Description |
|----------|-------|-------------|
| Évolution de | T-022 | Module Calendrier/Booking + Google Calendar sync |
| Coordination avec | T-029 | Action workflow `create_google_meet` réutilisable |
| Liée à | T-019 | Page Intégrations — Google Calendar OAuth |

---

## Notes techniques

### Google Calendar API — `conferenceData.createRequest`

Doc officielle : https://developers.google.com/calendar/api/v3/reference/events/insert
Le champ clé :

```json
{
  "conferenceData": {
    "createRequest": {
      "requestId": "<unique-id>",
      "conferenceSolutionKey": { "type": "hangoutsMeet" }
    }
  }
}
```

Après création, le `hangoutLink` est dans la réponse → à stocker.

### Cas du coach sans Google Calendar connecté

Décider du fallback : interdire les bookings en ligne ? Afficher un warning au
prospect ? Recommandation : **bloquer la création de booking_location de type
"online" si Google Calendar n'est pas connecté**, et afficher un encart dans
les Paramètres > Booking pour inviter à connecter.

### Conflit potentiel avec sync Google Calendar existante

T-022 sync déjà les events Google → bookings ClosRM. Vérifier que la création
côté ClosRM ne crée pas un doublon. Probablement : marquer l'event créé via
ce flow avec un tag (`source: closrm`) pour éviter le re-import.

---

## Résultat final

_À remplir à la fin de la tâche._

---

## Améliorations identifiées pendant cette tâche

_À remplir au fil de l'eau._
