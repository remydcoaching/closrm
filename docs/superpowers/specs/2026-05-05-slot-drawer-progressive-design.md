# SlotDetailDrawer — Refonte progressive

**Date** : 2026-05-05
**Auteur** : Pierre (via Claude Code brainstorming)
**Cible** : `src/components/social/planning/SlotDetailDrawer.tsx`

---

## Problème

Le drawer actuel affiche simultanément :

1. Brief de production (hook, titre, script, refs, notes coach)
2. Montage (monteur assigné, lien rush, lien final, validation)
3. Publication multi-plateformes (média + IG caption/hashtags + YT titre/description/visibilité + TikTok)
4. Discussion coach ↔ monteur

Tous ces blocs apparaissent **toujours en même temps**, quel que soit l'état du slot. Conséquences :

- À l'étape "Idée", on voit déjà les champs vides "Description YouTube", "Caption Instagram", "Lien du rush", etc. → bruit cognitif.
- À l'étape "Programmé", on voit encore le brief de production complet alors que c'est figé. → travail terminé mais dépliage permanent.
- Plusieurs informations sont **dupliquées** : la date prévue et le statut sont à la fois en pills dans le header et dans des cartes pleines en dessous.
- Le mélange brief + publication au même niveau force le coach à scroller entre les deux pendant qu'il rédige.

L'utilisateur ouvre ce drawer à différents moments selon où en est le slot (capture d'idée, brief profond, finalisation publication, suivi monteur). Le drawer doit s'adapter à ces moments, pas tout exposer en permanence.

## Non-objectifs

- Ajouter de nouveaux types de contenu (carrousel, etc.).
- Modifier le schéma DB (`social_posts.content_kind` reste `post|story|reel`).
- Toucher au workflow de publication backend.
- Toucher au drawer monteur (`SlotMontageDrawer` dans `/montage/page.tsx`) — il est déjà refondu en 2 colonnes.

## Solution

**Progressive disclosure** : les 3 zones (Brief / Montage / Publication) sont des **accordéons**. Leur état déplié/replié par défaut dépend du `production_status` du slot. L'utilisateur peut tout déplier/replier manuellement — rien n'est verrouillé.

### Comportement par statut

| `production_status`    | Brief        | Montage         | Publication     |
|------------------------|--------------|-----------------|-----------------|
| `idea`                 | Déplié       | Replié          | Replié          |
| `filmed`               | Replié       | Déplié          | Replié          |
| `edited`               | Replié       | Déplié          | Replié          |
| `ready`                | Replié       | Replié          | Déplié          |
| `scheduled` (status)   | Replié       | Replié          | Déplié (RO)     |
| `published` (status)   | Replié       | Replié          | Déplié (RO)     |

L'état initial est calculé une fois au mount selon le statut. Ensuite, chaque clic utilisateur sur un en-tête d'accordéon est respecté pour toute la durée d'ouverture du drawer (état local, pas persisté en DB).

### Zone Brief

- En-tête replié : `Brief — <hook tronqué à 80 char>` ou `Brief — (vide)` si rien.
- Déplié : formulaire actuel (hook, titre, script, refs, notes coach).
- Toujours éditable, quel que soit le statut.

### Zone Montage

- **Cachée complètement** si : `monteur_id` est null **ET** `production_status` ∈ {`idea`}.
- Sinon : affichée en accordéon.
- En-tête replié : `Montage — <monteur email|"Non assigné"> · <statut court>`
  - Statut court : `À monter`, `Monté ✓`, `Validé ✓✓`.
- Déplié : monteur, lien rush, lien final, statut, boutons de validation.

### Zone Publication

- En-tête replié : `Publication — <résumé plateformes>` (ex : `Publication — IG · YT` ou `Publication — Aucune plateforme`).
- Déplié :
  - 3 toggles plateformes Instagram / YouTube / TikTok (cliquables à tout moment, pas bloqués par statut).
  - 1 zone média partagée (upload).
  - Tabs plateformes actives (déjà en place via `activePlatformTab`) — **1 seule plateforme visible à la fois**.
  - Champs spécifiques de la plateforme active.
  - Bouton "Programmer la publication" en bas (logique inchangée).

### Nettoyage des redondances dans le header

- **Supprimer** la carte "Date prévue" qui apparaît sous le titre (déjà présente en pill `DatePill` dans le header).
- **Supprimer** la carte "Statut" idem (déjà présente en pill `StatusPill` dans le header).
- Le header garde : pill pillar + pill content_kind + pill date + pill statut + titre + bouton fermer. Pas de doublons en dessous.

### Chat coach ↔ monteur

- Reste affiché **uniquement** si `monteur_id` n'est pas null, sinon caché.
- Position inchangée (panneau dédié à droite, ou en bas selon layout actuel).

## Architecture & implémentation

### Composant accordéon réutilisable

Créer `<DrawerSection>` local au fichier (ou colocate dans le même `.tsx`) :

```tsx
interface DrawerSectionProps {
  title: string
  summary?: string         // contenu replié (ex: "Brief — comment j'ai perdu 5kg…")
  defaultOpen: boolean
  forceHide?: boolean      // skip render entirely (Montage en idea sans monteur)
  children: React.ReactNode
}
```

Le composant gère son `open` localement (`useState(defaultOpen)`). Pas de persistance.

### État du drawer

Ajout dans `SlotDetailDrawer` :

```ts
const [briefOpen, setBriefOpen] = useState(false)
const [montageOpen, setMontageOpen] = useState(false)
const [pubOpen, setPubOpen] = useState(false)
```

Initialisés via une fonction pure `getDefaultExpansion(slot)` qui prend le slot et renvoie `{ brief, montage, publication }` selon la table de comportement ci-dessus.

L'effet d'init s'exécute **une seule fois** quand `slot` est chargé pour la première fois (pas à chaque update). Sinon, ouvrir Publication en idée et que l'auto-save mette à jour `slot` retiendrait nos changements.

```ts
const initSlotIdRef = useRef<string | null>(null)
useEffect(() => {
  // Init exécuté une fois par slotId : si slotId change (drawer rouvert sur
  // un autre slot), on ré-initialise. Si seul le contenu de `slot` change
  // (auto-save), on garde l'état utilisateur.
  if (!slot || initSlotIdRef.current === slot.id) return
  const exp = getDefaultExpansion(slot)
  setBriefOpen(exp.brief)
  setMontageOpen(exp.montage)
  setPubOpen(exp.publication)
  initSlotIdRef.current = slot.id
}, [slot])
```

### Données reçues / pas de changement

- `slot.production_status` et `slot.status` existent déjà.
- `slot.monteur_id` existe déjà.
- `enabledPlatforms` existe déjà.
- Aucune migration nécessaire.

### Read-only en `scheduled`/`published`

Logique déjà en place pour `isPublished` (line 384). Étendue : quand `slot.status` ∈ {`scheduled`, `publishing`, `published`}, désactiver tous les inputs de la zone Publication. Brief reste éditable (les coachs corrigent parfois post-publication les notes internes).

## Plan de tests manuels

1. **Slot statut "Idée" (vierge)** : ouvrir → seul Brief déplié. Montage caché (pas de monteur). Publication repliée avec "Aucune plateforme".
2. **Slot statut "Idée" + monteur assigné** : Brief déplié, Montage replié visible (header "Montage — pierre@x · À monter"), Publication repliée.
3. **Slot statut "Filmed"** : Brief replié, Montage déplié, Publication repliée.
4. **Slot statut "Ready" + IG enabled** : Brief replié, Montage replié, Publication dépliée avec onglet IG actif.
5. **Slot statut "Published"** : tous les blocs Read-only sur Publication, Brief reste éditable.
6. **Override manuel** : ouvrir slot en Idée, déplier manuellement Publication, modifier la caption → la valeur est sauvegardée. Fermer le drawer, rouvrir → Publication revient à son état par défaut (replié).
7. **Pas de doublon** date/statut : le header doit montrer date+statut une seule fois.
8. **Toggles plateformes** : cocher/décocher IG en statut Idée doit fonctionner (pas bloqué).

## Risques

- **Régression Calendar/Board** : le drawer est mounté depuis BoardView et PlanningCalendarView. Vérifier que les props inchangées le restent.
- **Chat caché si pas de monteur** : confirmer que c'est OK fonctionnellement (avant, le chat était toujours visible). Acceptable car le chat slot est conçu pour coach↔monteur uniquement.
- **L'effet d'init mono-coup par slot** : `initSlotIdRef` mémorise le `slot.id` traité. Couvert par l'implémentation ci-dessus.

## Ordre d'implémentation

1. Créer `<DrawerSection>` accordéon générique dans le fichier.
2. Extraire le bloc Brief existant dans `<DrawerSection title="Brief">`.
3. Extraire le bloc Montage dans `<DrawerSection title="Montage" forceHide={...}>`.
4. Extraire le bloc Publication dans `<DrawerSection title="Publication">`.
5. Ajouter `getDefaultExpansion` + l'effet d'init mono-coup.
6. Supprimer les cartes redondantes Date/Statut sous le titre.
7. Conditionner l'affichage du chat sur `monteur_id`.
8. Tests manuels checklist.

Pas de changement DB, pas de migration, pas de nouveau endpoint API.
