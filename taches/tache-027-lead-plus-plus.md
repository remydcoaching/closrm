# Tâche 027 — Lead++ : workflow inline, pseudo IG, saisie en chaîne, onglet Messages

> **Statut :** ⬜ Non démarré
> **Développeur :** Pierre (réassigné le 2026-04-07 — initialement prévu pour Rémy)
> **Date de création :** 2026-04-07
> **Branche Git prévue :** `feature/pierre-lead-plus-plus`
>
> ⚠️ Cette tâche touche le module Leads de Rémy. C'est une **exception
> assumée** au principe de séparation : Pierre est mieux placé car il maîtrise
> le module Instagram (`ig_conversations`, `ig_messages`) et le moteur
> Workflows (option A pour le workflow inline). Coordination obligatoire
> avec Rémy avant de toucher à `src/components/leads/LeadForm.tsx`,
> `src/app/api/leads/route.ts`, et `supabase/migrations/` (colonne
> `leads.instagram_handle`).

---

## Objectif

Transformer le module Leads pour fluidifier la **saisie en masse** et automatiser
la **prise en charge follow-up** dès la création :

1. Saisir un workflow de relance directement depuis la modale "Ajouter un lead",
   pré-rempli selon la source choisie (un follower IG → DM J0 + DM J+2, etc.).
2. Détecter automatiquement la source `instagram_ads`/`follow_ads` quand on
   remplit le champ pseudo Instagram.
3. Permettre la saisie en chaîne ("Ajouter et continuer") pour rentrer
   plusieurs leads d'affilée sans rouvrir la modale manuellement.
4. Lier automatiquement un lead au pseudo IG correspondant dans le module
   Messages de Pierre, et afficher un onglet "Messagerie" sur la fiche lead.

---

## Périmètre

### 1. Modale "Ajouter un lead" — refonte

- [ ] Nouveau champ `instagram_handle` (pseudo IG) dans le formulaire
- [ ] Si le champ est rempli → forcer `source = instagram_ads` (ou `follow_ads`
      au choix via toggle radio rapide)
- [ ] Sauvegarde du pseudo dans `leads.instagram_handle` (nouvelle colonne)
- [ ] Validation : pseudo sans `@`, alphanumérique + `_` + `.`

### 2. Workflow de follow-up inline (toggle qui s'ouvre sous la source)

- [ ] Toggle "Créer un workflow de relance" (caché par défaut)
- [ ] À l'ouverture → suggestion pré-remplie selon la source :
  - `instagram_ads` / `follow_ads` → DM IG J0 ("Salut {{prenom}}, merci de me
    suivre !") + DM IG J+2 (relance)
  - `facebook_ads` → WhatsApp J0 + WhatsApp J+1 + Email J+3
  - `formulaire` / `funnel` → Email J0 + WhatsApp J+1
  - `manuel` → vide (le coach choisit)
- [ ] Éditeur inline minimal : liste de steps {channel, delay_days, template_text}
      avec ajout/suppression/édition. Pas besoin de tout l'éditeur du module
      Workflows — version compacte.
- [ ] À la création du lead → POST `/api/leads` puis si workflow rempli, POST
      vers `/api/workflows` ou directement `/api/follow-ups` x N selon ce que
      Pierre préfère (à valider avec lui — voir Notes techniques)
- [ ] Templates par défaut configurables dans Paramètres > Réglages (V2.1)

### 3. Saisie en chaîne — bouton "Ajouter et continuer"

- [ ] Nouveau bouton à droite de "Ajouter" : `Ajouter et continuer` (icône `+`)
- [ ] Comportement :
  1. Soumission du formulaire (idem bouton normal)
  2. Toast de confirmation "Lead ajouté ✓ — {{prénom}}"
  3. La modale reste ouverte mais **vide** (reset complet du form)
  4. Focus automatique sur le champ Prénom
- [ ] Garde le toggle workflow en mémoire entre saisies (le coach configure
      une fois et ajoute 20 followers IG d'affilée)

### 4. Liaison automatique avec une conversation Instagram existante

- [ ] À la création du lead avec un `instagram_handle` rempli :
  1. Query `ig_conversations` pour `participant_username = handle` (table
     du module IG de Pierre)
  2. Si match → UPDATE `ig_conversations.lead_id = new_lead.id`
  3. Si pas de match → ne rien faire (la liaison se fera plus tard côté
     module Messages de Pierre quand un message arrive)
- [ ] Coordination avec Pierre : la table `ig_conversations` a déjà la colonne
      `lead_id` (vu en T-023 — types/index.ts:862). Aucun changement de schéma
      côté Pierre.

### 5. Onglet "Messagerie" sur la fiche lead

- [ ] Nouvel onglet dans la fiche `/leads/[id]` à côté des onglets existants
      (Infos / Calls / Follow-ups / Notes / Messagerie)
- [ ] Visible uniquement si `lead.instagram_handle` ou si une `ig_conversation`
      est liée
- [ ] Affichage : timeline des `ig_messages` de la conversation liée (API
      `/api/instagram/conversations/[id]/messages` côté Pierre, en lecture seule)
- [ ] Bouton "Ouvrir dans Messages" → redirige vers la page DM IG de Pierre
- [ ] Pas d'envoi de message depuis cet onglet en V1 — read-only

---

## Fichiers concernés (prévisionnel)

### Fichiers à créer
| Fichier | Description |
|---------|-------------|
| `supabase/migrations/0XX_lead_instagram_handle.sql` | Ajout colonne `leads.instagram_handle text` + index |
| `src/components/leads/InlineWorkflowEditor.tsx` | Éditeur compact des steps de relance |
| `src/components/leads/LeadMessagesTab.tsx` | Onglet Messagerie sur la fiche lead |
| `src/lib/leads/workflow-templates.ts` | Templates de relance par source |

### Fichiers à modifier
| Fichier | Nature |
|---------|--------|
| `src/components/leads/LeadForm.tsx` | Champ pseudo IG, toggle workflow, bouton "Ajouter et continuer" |
| `src/lib/validations/leads.ts` | Schéma Zod : `instagram_handle` optionnel |
| `src/types/index.ts` | `Lead` += `instagram_handle: string \| null` |
| `src/app/api/leads/route.ts` | Insert pseudo, lier `ig_conversations` si match, créer follow-ups si workflow rempli |
| `src/app/(dashboard)/leads/[id]/page.tsx` | Ajouter onglet Messagerie |
| `supabase/schema.sql` | Reflet de la migration |

---

## Tâches liées

| Relation | Tâche | Description |
|----------|-------|-------------|
| Suite de | A-007 | Source `follow_ads` + channel `instagram_dm` (déjà fait) |
| Pivot de | T-026 | Followers-as-prospects (abandonné — limites API IG) |
| Dépend de | T-023 | Module Instagram + table `ig_conversations` (Pierre) |
| Lecture croisée | Module Messages (Pierre) | Lecture des `ig_messages` côté fiche lead |
| Coordination avec | T-029 | Format du payload workflow inline ↔ moteur d'automations |

---

## Notes techniques

### Coordination avec Rémy — points à valider avant de coder

1. **Toucher au module Leads** — Pierre doit prévenir Rémy avant chaque
   modification de :
   - `src/components/leads/LeadForm.tsx` (ajout champ pseudo + bouton chaîne + toggle workflow)
   - `src/app/api/leads/route.ts` (insert pseudo + lien `ig_conversations` + création workflow)
   - `src/app/(dashboard)/leads/[id]/page.tsx` (onglet Messagerie)
   - `src/types/index.ts` (Lead += `instagram_handle`)
   - Migration SQL sur `leads`

2. **Stockage du workflow inline** — Pierre tranche, c'est son moteur :
   - Option A : créer un vrai `workflow` via `/api/workflows` (réutilise
     son moteur, statuts, exécutions). À privilégier puisque Pierre maîtrise
     le code.
   - Option B : créer N `follow_ups` directement (plus léger, mais perd la
     notion de "workflow"). Fallback si Option A trop lourde.

3. **Schéma `ig_conversations.lead_id`** — déjà présent (T-023), Pierre
   l'utilise déjà côté DM. Réutiliser tel quel.

4. **Onglet Messagerie** — Pierre réutilise ses propres endpoints
   `/api/instagram/conversations/[id]/messages` en read-only.

### Migration : ajout `instagram_handle`

- Colonne nullable, pas de default
- Index simple (pas unique — plusieurs leads peuvent avoir le même pseudo IG
  s'il y a doublon dans le pipeline, à ne pas bloquer)
- ⚠️ Touche la table `leads` (module de Rémy) : prévenir Rémy avant push

### Templates de relance par source — proposition

```ts
const TEMPLATES_BY_SOURCE: Record<LeadSource, WorkflowStep[]> = {
  instagram_ads: [
    { channel: 'instagram_dm', delay_days: 0, text: "Salut {{prenom}} ! Merci de me suivre 🙏 Tu es là pour [objectif] ?" },
    { channel: 'instagram_dm', delay_days: 2, text: "Hey {{prenom}}, je voulais te demander : qu'est-ce qui t'a fait cliquer sur mon profil ?" },
  ],
  follow_ads: [ /* idem */ ],
  facebook_ads: [
    { channel: 'whatsapp', delay_days: 0, text: "Bonjour {{prenom}}, suite à votre demande..." },
    { channel: 'whatsapp', delay_days: 1, text: "..." },
    { channel: 'email', delay_days: 3, text: "..." },
  ],
  formulaire: [ /* idem */ ],
  funnel: [ /* idem */ ],
  manuel: [],
}
```

### Saisie en chaîne — UX

- Le bouton "Ajouter et continuer" doit être **secondaire** visuellement
  (le primaire reste "Ajouter" qui ferme la modale, comportement par défaut)
- Toast : composant existant à utiliser (vérifier dans `src/components/shared/`)
- Reset partiel : tags vidés, notes vidées, mais on garde la source + le
  workflow configuré (gain de temps massif)

---

## Résultat final

_À remplir à la fin de la tâche._

---

## Améliorations identifiées pendant cette tâche

_À remplir au fil de l'eau._
