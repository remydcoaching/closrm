# T-045 · Meta Pixel par funnel

**Développeur :** Rémy
**Priorité :** Haute
**Statut :** ⬜ Spec validée — Prêt à implémenter
**Branche :** `feature/remy-meta-pixel-funnel` (à créer depuis develop)

---

## Description

Intégrer le Meta Pixel (Facebook Pixel) dans les tunnels de vente de ClosRM.
Le coach entre son Pixel ID une seule fois dans l'éditeur de son funnel, et les pages publiques injectent automatiquement le script Meta + déclenchent les events standard.

## Pourquoi c'est important

Les tunnels de vente de ClosRM sont conçus pour être liés aux campagnes Meta Ads. Sans pixel, Meta ne sait pas qui visite les pages — impossible d'optimiser les campagnes, de faire du retargeting, ou de mesurer le coût par lead réel.

Avec le pixel actif :
- **Retargeting** : Meta peut recibler les visiteurs qui n'ont pas rempli le formulaire
- **Optimisation** : Meta apprend quel type de personne convertit (soumet le formulaire, réserve un call) et cherche des profils similaires
- **Attribution** : on voit dans Events Manager combien de leads / calls bookés viennent de chaque campagne

## Objectif

Permettre au coach de coller son Pixel ID dans le builder → les pages publiques font le reste automatiquement, sans configuration technique.

## Spec

Fichier : `docs/superpowers/specs/2026-06-09-meta-pixel-funnel-design.md`

**Décisions prises :**
- Pixel stocké **par funnel** (pas global workspace) — un funnel peut avoir une campagne Meta dédiée avec son propre pixel
- Events automatiques : `PageView` (chargement), `Lead` (FormBlock soumis), `Schedule` (BookingBlock confirmé)
- Pas de CAPI (serveur) pour l'instant — client-side uniquement, suffisant pour l'usage standard
- UI inspirée d'UpTrainer : section "Tracking & Pixels" dans la sidebar gauche du builder

## Fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `supabase/migrations/083_funnel_meta_pixel.sql` | Nouveau — `ALTER TABLE funnels ADD COLUMN meta_pixel_id TEXT` |
| `src/components/funnels/v2/sidebar/TrackingPanel.tsx` | Nouveau — champ Pixel ID + guide |
| `src/components/funnels/v2/FunnelBuilderV2.tsx` | Modifié — intègre TrackingPanel |
| `src/app/(dashboard)/acquisition/funnels/[id]/page.tsx` | Modifié — state + PATCH meta_pixel_id |
| `src/app/api/funnels/[id]/route.ts` | Modifié — expose meta_pixel_id |
| `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` | Modifié — injection Script fbq |
| `src/components/funnels/blocks/FormBlock.tsx` | Modifié — fire Lead |
| `src/components/funnels/blocks/BookingBlock.tsx` | Modifié — fire Schedule |
| `src/types/globals.d.ts` | Nouveau/modifié — declare window.fbq |

## Tâches liées

- T-028a / T-028b / T-028c (Funnels v2 — base sur laquelle cette feature s'appuie)
- A-028a-01 (BookingBlock — à modifier pour ajouter l'event Schedule)
- A-028a-02 (FormBlock — à modifier pour ajouter l'event Lead)
