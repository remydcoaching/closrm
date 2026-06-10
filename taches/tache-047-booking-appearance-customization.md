# Tâche 047 — Personnalisation page de réservation + responsive mobile

**Branche** : `feature/pierre-booking-appearance-customization`
**Date** : 2026-06-10
**Statut** : Implémenté, en attente de migration DB et test

## Objectif

Permettre au coach de personnaliser l'apparence de sa page publique de réservation :
- Choisir un thème de fond (sombre / clair) en plus de la couleur principale
- Voir la description du calendrier sur la page publique
- Prévisualiser la page avec un rendu PC / tablette / mobile depuis l'éditeur

Et corriger le bug responsive : sur mobile la page affichait toujours le grid 2 colonnes (date à gauche, heures à droite tronquées) — désormais les heures sont empilées sous la date.

## Fichiers créés

- `supabase/migrations/084_booking_background_theme.sql` — colonne `background_theme` (text, check 'dark'|'light', default 'dark')
- `src/components/booking-calendars/BookingPagePreviewModal.tsx` — modale iframe avec switch Bureau / Tablette / Mobile

## Fichiers modifiés

- `src/types/index.ts` — ajout `background_theme` sur `BookingCalendar`
- `src/lib/validations/booking-calendars.ts` — validation Zod du thème
- `src/app/api/public/book/[workspaceSlug]/[calendarSlug]/route.ts` — expose `background_theme` dans la réponse publique
- `src/app/(dashboard)/parametres/calendriers/[id]/page.tsx` — UI Apparence (color picker + toggle thème + bouton Prévisualiser) ; chargement workspace slug pour l'URL d'aperçu
- `src/app/book/[workspaceSlug]/[calendarSlug]/page.tsx`
  - Affichage de la description sous le nom du calendrier
  - `useEffect` qui pose `data-theme="light"` sur `<html>` quand le calendrier est en mode clair (s'appuie sur les CSS variables existantes de `globals.css`)
  - `useEffect` + `matchMedia('(max-width: 720px)')` → `gridTemplateColumns: '1fr'` sur mobile, cache la colonne droite tant qu'aucune date n'est sélectionnée

## TODO côté humain

1. Appliquer la migration `084_booking_background_theme.sql` sur Supabase prod (dashboard SQL editor)
2. Tester la prévisualisation sur le calendrier `appel de candidature`
3. Vérifier le rendu mobile réel (Safari iPhone) — pas seulement DevTools

## Tâches liées

- Précédentes : aucune (premier passage sur la personnalisation de la page booking)
- Suivantes potentielles : appliquer le thème clair/sombre aussi sur la page de confirmation post-booking (cohérence visuelle après redirect)
