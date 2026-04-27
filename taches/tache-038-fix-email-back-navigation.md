# T-038 — Fix navigation retour pages Email

**Auteur :** Pierre
**Date :** 2026-04-27
**Statut :** ✅ Terminé

## Objectif

Corriger le bug de navigation : depuis le détail d'une séquence / template / broadcast, le bouton "← Retour" ramenait sur une page standalone (`/acquisition/emails/sequences`, `/broadcasts`, `/templates`) au lieu de la page Emails unifiée avec onglets.

## Cause

Architecture double :
- `/acquisition/emails/page.tsx` → page unifiée avec 4 onglets (Campagnes / Séquences / Templates / Paramètres) gérés en state local React
- `/acquisition/emails/{sequences,broadcasts,templates}/page.tsx` → pages standalone sans onglets

Les boutons retour utilisaient `router.push('/acquisition/emails/{section}')` → tombaient sur les standalone.

## Fix

1. Page unifiée lit `?tab=X` du query param pour initialiser l'onglet actif
2. Changement d'onglet → `router.replace('/acquisition/emails?tab=X')` pour synchroniser l'URL
3. Boutons retour mis à jour pour `/acquisition/emails?tab=X`
4. Pages standalone converties en `redirect('/acquisition/emails?tab=X')` (couvre aussi accès direct via URL)

## Fichiers modifiés

- `src/app/(dashboard)/acquisition/emails/page.tsx`
- `src/app/(dashboard)/acquisition/emails/sequences/page.tsx`
- `src/app/(dashboard)/acquisition/emails/broadcasts/page.tsx`
- `src/app/(dashboard)/acquisition/emails/templates/page.tsx`
- `src/app/(dashboard)/acquisition/emails/sequences/[id]/page.tsx`
- `src/app/(dashboard)/acquisition/emails/broadcasts/[id]/page.tsx`
- `src/app/(dashboard)/acquisition/emails/broadcasts/new/page.tsx`
- `src/app/(dashboard)/acquisition/emails/templates/[id]/page.tsx`

## Tâches liées

- T-029 (Email module v2 / Email Builder)
