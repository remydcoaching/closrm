# Tâche 007 — Module Closing + Follow-ups (API + Frontend)

> **Statut :** En cours (bugs à régler)
> **Développeur :** Pierre
> **Date de début :** 2026-03-28
> **Branche Git :** `feature/pierre-closing`

---

## Objectif

Créer le module Closing (gestion des appels setting/closing) et le module Follow-ups (gestion des relances) — API complètes + pages frontend.

---

## Ce qui a été fait

### API Calls (`/api/calls`)
- [x] GET — liste avec filtres (type, outcome, scheduled_after/before, lead_id, search) + jointure lead + pagination
- [x] POST — créer un call + auto-increment attempt_number + changement auto statut lead
- [x] GET /[id] — détail avec lead
- [x] PATCH /[id] — modifier + changement auto statut lead (done→clos, no_show→no_show_*, cancelled→nouveau)
- [x] DELETE /[id] — supprimer

### API Follow-ups (`/api/follow-ups`)
- [x] GET — liste avec filtres (status, channel, search, scheduled_after/before) + jointure lead + pagination
- [x] POST — créer un follow-up
- [x] PATCH /[id] — modifier (statut, notes, date, channel)
- [x] DELETE /[id] — supprimer

### Frontend Closing (`/closing`)
- [x] 4 onglets avec badge count (À venir / À actualiser / Traités / Annulés-Absents)
- [x] Toggle vue Liste ↔ Calendrier
- [x] Tableau avec colonnes (date, lead, type, tentative, statut, actions)
- [x] Vue calendrier hebdomadaire (navigation semaine, slots 8h-21h)
- [x] Modale "Résultat" (outcome + joint + durée + notes)
- [x] Filtres (recherche, type setting/closing, date range)
- [x] Actions (résultat, reprogrammer, voir fiche, supprimer)

### Frontend Follow-ups (`/follow-ups`)
- [x] 4 onglets avec badge count (En attente / En retard / Terminés / Tous)
- [x] Tableau avec colonnes (date, lead, raison, canal, statut, actions)
- [x] Bouton "Créer un follow-up" avec modale (sélection lead, raison, date/heure, canal, notes)
- [x] Actions (marquer fait, annuler, voir fiche, supprimer)
- [x] Recherche par nom de lead

### Composants créés
- `CallOutcomeBadge` + `CallTypeBadge`
- `CallOutcomeModal` — modale résultat d'appel
- `CallFilters` — filtres closing
- `CallTable` — tableau appels
- `CallCalendar` — vue calendrier hebdomadaire
- `FollowUpStatusBadge` + `ChannelBadge`
- `AddFollowUpModal` — modale création follow-up

### Autres
- [x] Schemas Zod (calls + follow-ups)
- [x] CALL_OUTCOME_COLORS + CALL_TYPE_COLORS dans utils.ts
- [x] CallScheduleModal refait (inputs date/heure séparés, icônes, plus propre)
- [x] Script seed (12 leads + 11 calls + 4 follow-ups)

---

## Corrigé dans cette session (feature/pierre-fix-bugs)

- [x] Onglets "Aujourd'hui" ajoutés sur Closing et Follow-ups
- [x] Logique des onglets corrigée (today/upcoming/overdue basés sur dates du jour)
- [x] Cliquer sur une ligne → ouvre le profil lead en panneau latéral (side panel)
- [x] Side panel éditable : statut lead, phone, email, tags, notes (auto-save)
- [x] Side panel : modifier date/heure des calls et follow-ups
- [x] Side panel : changer outcome des calls (En attente/Fait/Annulé/Absent)
- [x] Side panel : changer statut des follow-ups (En attente/Fait/Annulé)
- [x] Bouton "Traiter" sur follow-ups → modale d'action (Planifier RDV / Relancer avec date modifiable / Nurturing / Dead)
- [x] Plus de "Marquer fait" seul — chaque action a une suite logique
- [x] CallScheduleModal refait (date/heure séparés, icônes)
- [x] Reset password fix — middleware ne redirige plus /reset-password, page update gère le token recovery
- [x] Bouton "Voir fiche" retiré des actions (toute la ligne est cliquable)

## Bugs restants à régler

- [ ] Vérifier que le changement auto de statut lead fonctionne (done+closing → clos, etc.)
- [ ] CallCalendar — fragments React `<>` dans le grid (rendu potentiellement cassé)
- [ ] Tester le flow complet : créer lead → planifier call → marquer résultat → vérifier statut lead
- [ ] Tester reset password flow complet (email → lien → nouveau mdp)

---

## Fichiers créés
| Fichier | Description |
|---------|-------------|
| `src/lib/validations/calls.ts` | Schemas Zod calls |
| `src/lib/validations/follow-ups.ts` | Schemas Zod follow-ups |
| `src/app/api/calls/route.ts` | GET + POST calls |
| `src/app/api/calls/[id]/route.ts` | GET + PATCH + DELETE call |
| `src/app/api/follow-ups/route.ts` | GET + POST follow-ups |
| `src/app/api/follow-ups/[id]/route.ts` | PATCH + DELETE follow-up |
| `src/components/closing/CallOutcomeBadge.tsx` | Badge outcome |
| `src/components/closing/CallTypeBadge.tsx` | Badge type |
| `src/components/closing/CallOutcomeModal.tsx` | Modale résultat |
| `src/components/closing/CallFilters.tsx` | Filtres closing |
| `src/components/closing/CallTable.tsx` | Tableau appels |
| `src/components/closing/CallCalendar.tsx` | Vue calendrier |
| `src/components/follow-ups/FollowUpStatusBadge.tsx` | Badge statut FU |
| `src/components/follow-ups/ChannelBadge.tsx` | Badge canal |
| `src/components/follow-ups/AddFollowUpModal.tsx` | Modale création FU |
| `scripts/seed.ts` | Script injection données test |

## Fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `src/app/(dashboard)/closing/page.tsx` | Remplacé placeholder par module complet |
| `src/app/(dashboard)/follow-ups/page.tsx` | Remplacé placeholder par module complet |
| `src/components/leads/CallScheduleModal.tsx` | Refait (date/heure séparés, icônes, accept Pick<Lead>) |
| `src/lib/utils.ts` | Ajout CALL_OUTCOME_COLORS, CALL_TYPE_COLORS, CALL_TYPE_LABELS |
| `ameliorations.md` | Ajout A-007, A-008, A-009 |

---

## Améliorations identifiées

- A-007 : Source follow_ads + channel instagram_dm
- A-008 : Import auto leads Follow Ads via API Instagram
- A-009 : Automations CTA Instagram → lead + nurturing auto

---

*Créé le 2026-03-28 par Claude Code — ClosRM*
