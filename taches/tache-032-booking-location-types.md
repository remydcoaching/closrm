# Tache 032 — Choix du type de lieu dans les calendriers de booking

## Description
Ajouter la possibilite de choisir le type de rendez-vous (presentiel, Google Meet, visio personnalisee) directement dans le formulaire de creation/edition d'un calendrier de booking.

## Objectif
Permettre au coach de definir comment se derouleront ses rendez-vous : en personne, via Google Meet auto-genere, ou via un lien de visio personnalise (Zoom, Teams, etc.).

## Approche technique
Pas de migration DB necessaire. On reutilise les champs existants :
- `location_type = 'in_person'` + `address` = adresse physique -> Presentiel
- `location_type = 'online'` + `address` vide/null -> Google Meet (auto-genere)
- `location_type = 'online'` + `address` rempli avec URL -> Lien visio custom

## Fichiers modifies
- `src/components/booking-calendars/LocationEditor.tsx` — reecrit avec 3 cards visuelles selectionnables (presentiel, Google Meet, visio personnalisee)
- `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx` — titre section "Lieux" -> "Type de rendez-vous"
- `src/components/agenda/BookingDetailPanel.tsx` — ajout bouton "Rejoindre la visio" pour les liens custom (violet), en plus du bouton Meet existant (vert)
- `src/app/api/bookings/route.ts` — ne pas generer de Meet quand location a un lien custom
- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts` — idem cote public

## Statut
- [x] Implemente
- [ ] Teste en local
- [ ] Merge dans develop
