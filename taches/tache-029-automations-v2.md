# Tâche 029 — Automations v2 : refonte / extension du module Workflows

> **Statut :** ⬜ Non démarré
> **Développeur :** Pierre
> **Date de création :** 2026-04-07
> **Branche Git prévue :** `feature/pierre-automations-v2`

---

## Objectif

Le module Automations / Workflows existe (livré en T-014, refait en T-014v2 le
01/04 avec branching, 13 actions, et builder visuel). Cette tâche est sa **v2
fonctionnelle** : nouveaux triggers, nouvelles actions, meilleur observability,
et compatibilité avec les nouvelles features du CRM (T-027 Lead++, T-030 Meet,
T-031 Import CSV).

---

## Périmètre (à affiner par Pierre selon ses priorités)

### Nouveaux triggers
- [ ] `lead_imported` — déclenché quand des leads sont créés en bulk via CSV
      (cf. T-031). Permet d'enrôler automatiquement un lot dans une séquence.
- [ ] `lead_with_ig_handle` — déclenché quand un lead est créé avec un pseudo
      Instagram (cf. T-027), pour automatiser un DM de bienvenue
- [ ] `booking_no_show` — distinct de `call_no_show`, spécifique au booking
- [ ] `lead_inactive_x_days` — relance automatique des leads sans activité

### Nouvelles actions
- [ ] `send_dm_instagram` — compléter le stub (cf. T-021 Instagram Automations)
- [ ] `create_google_meet` — créer un lien Meet à la volée (cf. T-030)
- [ ] `assign_to_setter` / `assign_to_closer` — pour la V2 multi-membres
- [ ] `update_lead_field` — UPDATE générique de n'importe quel champ
- [ ] `wait_until_date` — pause jusqu'à une date absolue (J+30 fixe vs delay)

### Builder UX
- [ ] Connecteurs visuels entre branches (déjà listé dans le polish T-014)
- [ ] Vue "tableau d'exécutions" avec filtres (workflow, statut, lead, période)
- [ ] Re-jouer une exécution failed manuellement (avec correction du contexte)
- [ ] Test à blanc d'un workflow (dry-run sur un lead choisi sans envoyer
      réellement les messages)

### Observability
- [ ] Logs détaillés par étape avec payload résolu (templates expansés)
- [ ] Métriques par workflow : nb runs, taux de succès, durée moyenne
- [ ] Alertes auto si un workflow échoue X fois de suite
- [ ] Export CSV des exécutions pour analyse externe

### Compatibilité avec les nouvelles features
- [ ] **T-027** — accepter le payload "workflow inline" depuis la modale lead
      (voir Notes techniques de T-027 pour les options A/B)
- [ ] **T-030** — exposer l'action `create_google_meet` réutilisable
- [ ] **T-031** — trigger `lead_imported` qui reçoit le batch_id

---

## Fichiers concernés

### Fichiers existants (à étendre)
- `src/lib/workflows/engine.ts`
- `src/lib/workflows/trigger.ts`
- `src/lib/workflows/templates.ts`
- `src/lib/workflows/actions/*` (un fichier par action)
- `src/components/automations/WorkflowBuilder.tsx`
- `src/components/automations/TriggerConfigPanel.tsx`
- `src/components/automations/ActionConfigPanel.tsx`
- `src/app/api/workflows/`
- `src/types/index.ts` (type `WorkflowTriggerType` + `WorkflowActionType`)

### Fichiers à créer
- `src/lib/workflows/actions/send-dm-instagram.ts` (compléter le stub)
- `src/lib/workflows/actions/create-google-meet.ts`
- `src/lib/workflows/actions/update-lead-field.ts`
- `src/lib/workflows/actions/wait-until-date.ts`
- `src/components/automations/ExecutionsTable.tsx`
- `src/components/automations/DryRunDialog.tsx`
- `src/app/api/workflows/[id]/dry-run/route.ts`

---

## Tâches liées

| Relation | Tâche | Description |
|----------|-------|-------------|
| Évolution de | T-014 | Module Automations v1 |
| Coordination avec | T-027 | Workflow inline depuis la modale lead (Rémy) |
| Coordination avec | T-030 | Action `create_google_meet` (Pierre) |
| Coordination avec | T-031 | Trigger `lead_imported` (Rémy crée le trigger côté lead) |
| Liée à | T-021 | Instagram Automations (toujours non démarré) |

---

## Notes techniques

### Coordination avec Rémy

- **T-027 (workflow inline)** : Rémy doit pouvoir POST un workflow + steps
  d'un coup depuis la modale lead. Définir avec lui le format du payload
  (probablement : `{ workflow: {name, steps: [...]}, lead_id }`)
- **T-031 (import CSV)** : quand Rémy fait un import bulk, il doit fire le
  trigger `lead_imported` avec `{ batch_id, lead_count, source }`

### Risque : taille du périmètre
Comme T-028, cette tâche est volontairement large. Pierre découpera en sous-
tâches T-029a, T-029b après priorisation.

---

## Résultat final

_À remplir à la fin de la tâche._

---

## Améliorations identifiées pendant cette tâche

_À remplir au fil de l'eau._
