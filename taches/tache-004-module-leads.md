# Tâche 004 — Module Leads (API + Frontend)

**Statut :** ✅ Terminé
**Développeur :** Rémy
**Date de création :** 2026-03-27
**Date de complétion :** 2026-03-27
**Branche :** `feature/remy-module-leads`

---

## Description

Implémentation complète du module Leads : API REST sécurisée + page liste + fiche lead détaillée.
C'est le cœur du CRM — tout le reste en dépend.

## Objectif

- API CRUD complète pour les leads, multi-tenant via `workspace_id` + RLS Supabase
- Page liste des leads avec tableau dense, filtres, pagination, toggle "joint", actions
- Fiche lead détaillée avec infos contact, statut, tags, notes auto-save, timeline interactions

---

## Fichiers créés

| Fichier | Description |
|---------|-------------|
| `src/lib/validations/leads.ts` | Schémas Zod : createLeadSchema, updateLeadSchema, leadFiltersSchema |
| `src/app/api/leads/route.ts` | GET (liste paginée + filtres) + POST (créer lead) |
| `src/app/api/leads/[id]/route.ts` | GET (détail + calls + follow_ups) + PATCH + DELETE (soft) |
| `src/components/leads/StatusBadge.tsx` | Badge statut coloré (7 états) |
| `src/components/leads/SourceBadge.tsx` | Badge source (Facebook, Instagram, Formulaire, Manuel) |
| `src/components/leads/LeadFilters.tsx` | Filtres (recherche texte, statuts, sources) avec debounce 300ms |
| `src/components/leads/LeadForm.tsx` | Modale création lead avec validation Zod côté client |
| `src/components/leads/CallScheduleModal.tsx` | Modale planification appel (setting/closing) |
| `src/components/leads/LeadDetail.tsx` | Détail lead : contact, statut, tags, notes, timeline |

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/app/(dashboard)/leads/page.tsx` | Remplacé le placeholder par la vraie page liste |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Remplacé le placeholder par la vraie fiche lead |

---

## Fonctionnalités implémentées

### API

- `GET /api/leads` — liste paginée, filtres par statut/source/search/tags, tri, pagination
- `POST /api/leads` — création avec validation Zod, status 'nouveau' par défaut
- `GET /api/leads/[id]` — détail + calls + follow_ups joinés
- `PATCH /api/leads/[id]` — mise à jour partielle (infos, statut, tags, notes, reached)
- `DELETE /api/leads/[id]` — soft delete (status → 'dead')

### Page Liste `/leads`

- Tableau dense : date, nom, téléphone, email, source (badge), tentatives, joint (toggle), statut (badge), tags, actions
- Toggle "joint" optimiste (UI mise à jour immédiatement, sync en arrière-plan)
- Bouton "Ajouter un lead" → modale LeadForm
- Filtres : recherche texte (debounce 300ms), multi-select statuts, multi-select sources
- Pagination avec état total/pages
- Action "Voir" → fiche lead, "Archiver" → soft delete avec confirmation

### Fiche Lead `/leads/[id]`

- Header : nom, statut + source badges, téléphone, boutons "Appeler" + "Planifier RDV"
- Bouton "Appeler" : incrémente `call_attempts` avec confirmation
- Bouton "Planifier RDV" → CallScheduleModal (setting ou closing)
- Panneau droit : KPIs rapides (tentatives, appels planifiés, follow-ups en attente, source Meta)
- LeadDetail : infos contact, changement statut (dropdown), tags éditables, notes auto-save (debounce 800ms), timeline unifiée (calls + follow-ups)

---

## Améliorations ajoutées en session (non prévues au plan)

- **Filtres en panneau déroulant** : bouton "Filtres" avec badge compteur, panneau avec statuts + sources, chips actifs visibles sous la barre
- **Dropdowns inline Tentatives** : sélecteur 0→5 appels directement dans la colonne du tableau
- **Dropdown inline Statut** : changement de statut sans ouvrir la fiche
- **Gestion tags inline** : bouton `+` discret dans la colonne Tags → panneau ajout/suppression
- **ConfirmModal custom** (`src/components/shared/ConfirmModal.tsx`) : remplace `confirm()` natif partout
- **Boutons Appeler + Planifier dans la liste** : actions directes sans aller sur la fiche

---

## Décisions techniques

- **Soft delete** : `DELETE` passe `status = 'dead'` (pas de suppression physique — préserve l'historique)
- **Optimistic UI** sur le toggle "joint" pour la réactivité
- **Auto-save notes** avec debounce 800ms (pas de bouton save)
- **Timeline unifiée** : calls + follow-ups triés par date desc dans LeadDetail
- **Fallback CallScheduleModal** : si l'API `/api/calls` (Pierre) n'est pas encore dispo, on met à jour le statut du lead directement
- **Inline styles** respectés (pas de classes Tailwind) — cohérent avec le reste du codebase

---

## Tâches liées

- **Débloque** : T-007 (Closing — Pierre), T-011 (Statistiques — Rémy)
- **Dépend de** : T-002 (Auth — Pierre, `getWorkspaceId()`, `useUser()`)
- **Prochaine pour Rémy** : T-003 (Dashboard avec vraies données)

---

## Notes

- Le `CallScheduleModal` a un fallback si l'API `/api/calls` n'est pas encore implémentée par Pierre
- Les types `Lead`, `Call`, `FollowUp`, `LeadStatus`, `LeadSource` sont réutilisés depuis `src/types/index.ts`
- `getWorkspaceId()` utilisé dans les 2 API routes pour l'isolation multi-tenant
