# Tâche 028 — Funnels v2 : refonte builder + templates + analytics

> **Statut :** ⬜ Non démarré
> **Développeur :** Rémy
> **Date de création :** 2026-04-07
> **Branche Git prévue :** `feature/remy-funnels-v2`

---

## Objectif

Le module Funnels existe (livré par Pierre en T-023 funnel-builder) mais reste
"clairement améliorable" selon Rémy. Cette tâche est une **refonte qualitative**
du builder et de l'expérience pour atteindre un niveau "production" comparable
à Systeme.io / GoHighLevel.

> ⚠️ Périmètre exact à préciser après audit du module actuel : commencer par
> faire le tour de l'existant, identifier les blocs faibles, puis prioriser.

---

## Périmètre (à affiner après audit)

### Phase 1 — Audit de l'existant
- [ ] Faire le tour de tous les blocs disponibles aujourd'hui (Hero, Video,
      Form, Booking, Pricing, FAQ, Countdown, CTA, Text, Image, Spacer)
- [ ] Tester chaque bloc en preview + publication
- [ ] Lister les bugs/manques dans une section "Findings" de cette fiche

### Phase 2 — Builder UX
- [ ] Améliorer le drag & drop (snap visuel, drop zones plus claires)
- [ ] Inspector latéral pour chaque bloc (au lieu de modales empilées)
- [ ] Preview live desktop/mobile/tablet en temps réel
- [ ] Undo/Redo (Cmd+Z) — mémo des dernières actions
- [ ] Duplication de bloc rapide (Cmd+D)
- [ ] Réorganisation au clavier (haut/bas)

### Phase 3 — Nouveaux blocs
- [ ] Bloc Témoignages avancé (carousel, ratings, photos avant/après)
- [ ] Bloc Garantie (badge + texte)
- [ ] Bloc Comparaison "avant/après"
- [ ] Bloc Quizz / Diagnostic (multi-step → résultat → form)
- [ ] Bloc Logo bar (clients/médias)

### Phase 4 — Templates par niche
- [ ] Galerie de templates "prêts à l'emploi"
- [ ] Templates : Coach business, Coach sport, Coach mindset, Immobilier,
      Formation en ligne, Mastermind, Bootcamp
- [ ] Cloner un template → page éditable

### Phase 5 — Analytics par funnel
- [ ] Page stats par funnel : vues, leads, taux de conversion par étape
- [ ] Heatmap de scroll (V2.1 — optionnel)
- [ ] A/B testing simple : 2 variantes d'une page, split 50/50
- [ ] Funnel visuel global : étape 1 → étape 2 → conversion finale

### Phase 6 — Publication / Domaines
- [ ] Vérifier que l'attachement à un domaine custom (déjà géré côté Email)
      fonctionne pour les funnels
- [ ] SSL automatique (Vercel domains)
- [ ] Page de remerciement post-conversion configurable

---

## Fichiers concernés

### Fichiers à auditer
- `src/components/funnels/FunnelBuilder.tsx`
- `src/components/funnels/FunnelPagePreview.tsx`
- `src/components/funnels/blocks/*` (tous les blocs)
- `src/app/api/funnels/` (toutes les routes)
- `src/app/(public)/funnels/[slug]/page.tsx` (rendu public)
- `supabase/migrations/008_funnels.sql`

### Fichiers à créer (estimation)
- `src/components/funnels/Inspector.tsx` — panneau latéral d'édition
- `src/components/funnels/blocks/Testimonials*` (refonte)
- `src/components/funnels/blocks/Quiz*`
- `src/components/funnels/templates/` — templates pré-faits
- `src/components/funnels/FunnelStats.tsx`
- `src/lib/funnels/ab-test.ts`

---

## Tâches liées

| Relation | Tâche | Description |
|----------|-------|-------------|
| Refactor de | T-023 (Pierre) | Module Funnels initial |
| Liée à | T-020 | Module Emails (sync entre soumission funnel → ajout séquence) |
| Liée à | T-022 | Module Booking (bloc Booking dans funnel) |

---

## Notes techniques

### À voir avec Pierre avant de démarrer
- Pierre a construit le funnel builder initial : valider qu'il accepte que
  Rémy refasse une grosse partie du code (ou se répartir : Rémy refait les
  blocs, Pierre garde le moteur)
- Aligner la convention de stockage des `FunnelBlockConfig` (déjà typée dans
  `src/types/index.ts:471`)

### Risque : périmètre énorme
Cette tâche est volontairement large. Découper en sous-tâches T-028a, T-028b,
T-028c après l'audit Phase 1.

---

## Résultat final

_À remplir à la fin de la tâche._

---

## Améliorations identifiées pendant cette tâche

_À remplir au fil de l'eau._
