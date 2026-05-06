# SlotDetailDrawer Progressive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réduire la complexité visuelle de `SlotDetailDrawer.tsx` en transformant les zones Brief / Montage / Publication en accordéons dont l'état d'expansion par défaut dépend du `production_status` du slot.

**Architecture:** Refactor purement frontend. Un composant accordéon `<DrawerSection>` local au fichier wrappe les 3 zones existantes. Une fonction pure `getDefaultExpansion(slot)` calcule l'état initial. Un `useRef<string | null>` mémorise le `slotId` déjà initialisé pour ne pas écraser les overrides utilisateur quand le slot s'auto-save. Pas de modification DB ni d'API.

**Tech Stack:** React (Next.js App Router), TypeScript, lucide-react icons, inline styles avec CSS variables.

**Spec source:** `docs/superpowers/specs/2026-05-05-slot-drawer-progressive-design.md`

**Validation:** ce repo n'a pas de framework de tests UI (cf. `find ... -name '*.test.tsx'` → vide hors `node_modules`). La validation se fait par checklist manuelle dans le navigateur sur `npm run dev` à la fin de chaque section.

---

## Task 1: Composant `<DrawerSection>` accordéon

**Files:**
- Modify: `src/components/social/planning/SlotDetailDrawer.tsx` (ajouter le composant local après `Field` ~ ligne 1414)

- [ ] **Step 1: Ajouter `DrawerSection` dans le fichier**

Ajouter ce composant **juste après** la fonction `Field` (entre lignes 1438 et 1440 actuelles, avant `interface PricingTier`) :

```tsx
function DrawerSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  summary?: string | null
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{
      border: '1px solid var(--border-primary)',
      borderRadius: 10,
      background: 'var(--bg-secondary)',
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '12px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-primary)', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            {title}
          </span>
          {!open && summary && (
            <span style={{
              fontSize: 12, color: 'var(--text-tertiary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}>
              {summary}
            </span>
          )}
        </div>
        {open ? <ChevronDown size={15} color="var(--text-tertiary)" /> : <ChevronRight size={15} color="var(--text-tertiary)" />}
      </button>
      {open && (
        <div style={{
          padding: '4px 14px 14px',
          borderTop: '1px solid var(--border-primary)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}
```

`ChevronDown` et `ChevronRight` sont déjà importés en haut du fichier (cf. ligne 6).

- [ ] **Step 2: Vérifier que TS passe**

```bash
npx tsc --noEmit
```

Attendu : pas d'erreur (le composant n'est pas encore utilisé, mais doit type-check).

- [ ] **Step 3: Commit**

```bash
git add src/components/social/planning/SlotDetailDrawer.tsx
git commit -m "feat(social): ajoute composant DrawerSection accordeon"
```

---

## Task 2: État + helper `getDefaultExpansion`

**Files:**
- Modify: `src/components/social/planning/SlotDetailDrawer.tsx`

- [ ] **Step 1: Ajouter le helper hors du composant**

Ajouter **juste avant** `export default function SlotDetailDrawer` (autour ligne 47) :

```tsx
type SectionExpansion = { brief: boolean; montage: boolean; publication: boolean }

function getDefaultExpansion(slot: SocialPostWithPublications): SectionExpansion {
  const ps = slot.production_status ?? 'idea'
  const s  = slot.status ?? 'draft'
  const isPublishedish = s === 'scheduled' || s === 'publishing' || s === 'published'

  if (isPublishedish) return { brief: false, montage: false, publication: true }
  if (ps === 'idea')   return { brief: true,  montage: false, publication: false }
  if (ps === 'filmed' || ps === 'edited') return { brief: false, montage: true, publication: false }
  // 'ready'
  return { brief: false, montage: false, publication: true }
}
```

- [ ] **Step 2: Ajouter l'état + l'init effect dans le composant**

Dans `SlotDetailDrawer`, **après** la ligne où `activePlatformTab` est déclaré (ligne 59), ajouter :

```tsx
  const [briefOpen, setBriefOpen] = useState(false)
  const [montageOpen, setMontageOpen] = useState(false)
  const [pubOpen, setPubOpen] = useState(false)
  const initSlotIdRef = useRef<string | null>(null)
```

Puis trouver le bloc `if (loading || !slot) return ...` (autour ligne 358) et **avant** ce return, ajouter :

```tsx
  // Init des accordéons une fois par slotId. Si seul le contenu de `slot`
  // change (auto-save), on garde l'état utilisateur.
  useEffect(() => {
    if (!slot || initSlotIdRef.current === slot.id) return
    const exp = getDefaultExpansion(slot)
    setBriefOpen(exp.brief)
    setMontageOpen(exp.montage)
    setPubOpen(exp.publication)
    initSlotIdRef.current = slot.id
  }, [slot])
```

`useRef` est déjà importé (cf. ligne 3 : `import { useState, useEffect, useRef, useMemo } from 'react'`).

- [ ] **Step 3: Vérifier que TS passe**

```bash
npx tsc --noEmit
```

Attendu : pas d'erreur. Lint warnings sur les setters non utilisés sont OK (on les utilise dans les tasks suivantes).

- [ ] **Step 4: Commit**

```bash
git add src/components/social/planning/SlotDetailDrawer.tsx
git commit -m "feat(social): etat accordeons + helper getDefaultExpansion"
```

---

## Task 3: Wrap zone Brief

**Files:**
- Modify: `src/components/social/planning/SlotDetailDrawer.tsx` (lignes 476-606 actuelles)

- [ ] **Step 1: Calculer le summary du Brief**

**Avant** le `return` principal du composant (autour ligne 388), ajouter :

```tsx
  const briefSummary = (() => {
    const txt = slot?.hook?.trim() || slot?.title?.trim() || ''
    if (!txt) return '(vide)'
    return txt.length > 80 ? txt.slice(0, 77) + '…' : txt
  })()
```

- [ ] **Step 2: Wrapper le Brief dans `<DrawerSection>`**

Trouver la `LEFT COLUMN` (ligne 476) :

```tsx
          <div style={columnStyle}>
            <ColumnHeader
              icon={Sparkles}
              label="Production"
              ...
            />

            <Field label="Accroche / Hook" ...>
              ...
            </Field>
            <Field label="Titre / Sujet">
              ...
            </Field>
            <Field label="Script" ...>
              ...
            </Field>
            <Field label="Références" ...>
              ...
            </Field>

            <MontageSection ... />
          </div>
```

La transformer en :

```tsx
          <div style={columnStyle}>
            <DrawerSection
              title="Brief"
              summary={briefSummary}
              open={briefOpen}
              onToggle={() => setBriefOpen(o => !o)}
            >
              <Field label="Accroche / Hook" ...>
                ...
              </Field>
              <Field label="Titre / Sujet">
                ...
              </Field>
              <Field label="Script" ...>
                ...
              </Field>
              <Field label="Références" ...>
                ...
              </Field>
            </DrawerSection>

            <MontageSection slot={slot} setSlot={setSlot} patch={patch} />
          </div>
```

(On garde `MontageSection` inchangée à cette task, on la wrappe à la Task 4.)

Le `<ColumnHeader icon={Sparkles} label="Production" ... />` est supprimé : redondant maintenant qu'on a un titre "Brief" dans l'accordéon. Le bouton "Personnaliser l'IA" qu'il portait peut être supprimé (utilisateur peut y aller via paramètres) **ou** déplacé en `action` du Field "Accroche / Hook". **Décision** : on le supprime — la page paramètres reste accessible depuis le menu principal, ce bouton intra-drawer encombre.

- [ ] **Step 3: Tester manuellement**

```bash
npm run dev
```

Ouvrir le navigateur sur `http://localhost:3000/acquisition/reseaux-sociaux`, cliquer sur un slot existant en statut "Idée".

Attendu :
- Bloc "BRIEF" déplié, summary masqué (puisque ouvert).
- Hook/Titre/Script/Références visibles à l'intérieur.
- MontageSection visible juste en dessous (inchangée).
- Plus de header "Production" violet ni de bouton "Personnaliser l'IA".
- Cliquer sur le titre "BRIEF" → replie l'accordéon, le summary apparaît (hook tronqué ou "(vide)").

- [ ] **Step 4: Commit**

```bash
git add src/components/social/planning/SlotDetailDrawer.tsx
git commit -m "refactor(social): brief en accordeon DrawerSection"
```

---

## Task 4: Wrap zone Montage + masquage si pas de monteur en idée

**Files:**
- Modify: `src/components/social/planning/SlotDetailDrawer.tsx`

- [ ] **Step 1: Calculer la visibilité et le summary du Montage**

Juste après `briefSummary` (cf. Task 3 step 1), ajouter :

```tsx
  const montageVisible = !!slot?.monteur_id || (slot?.production_status !== 'idea' && slot?.production_status != null)
  const montageSummary = (() => {
    if (!slot) return ''
    const ps = slot.production_status
    const status = ps === 'ready' ? 'Validé ✓✓' : ps === 'edited' ? 'Monté ✓' : ps === 'filmed' ? 'À monter' : 'Pas commencé'
    const monteur = slot.monteur_id ? 'Assigné' : 'Non assigné'
    return `${monteur} · ${status}`
  })()
```

- [ ] **Step 2: Wrapper `MontageSection` dans `DrawerSection` conditionnel**

Remplacer la ligne actuelle :

```tsx
            <MontageSection slot={slot} setSlot={setSlot} patch={patch} />
```

Par :

```tsx
            {montageVisible && (
              <DrawerSection
                title="Montage"
                summary={montageSummary}
                open={montageOpen}
                onToggle={() => setMontageOpen(o => !o)}
              >
                <MontageSection slot={slot} setSlot={setSlot} patch={patch} />
              </DrawerSection>
            )}
```

**Note sur double titre** : `MontageSection` interne a son propre titre / header. C'est acceptable visuellement (titre accordéon "MONTAGE" + sous-titre interne "Assignation monteur" par ex). Si visuellement gênant à l'oeil, on pourra retirer le sous-titre interne dans une PR follow-up — pas dans ce plan pour rester focus.

- [ ] **Step 3: Tester manuellement**

Toujours via `npm run dev`, vérifier 3 cas :

1. Slot en `idea` **sans** monteur assigné → bloc Montage **caché** entièrement (pas même replié).
2. Slot en `idea` **avec** monteur assigné → bloc Montage **replié**, summary "Assigné · Pas commencé".
3. Slot en `filmed` → bloc Montage **déplié** par défaut.

- [ ] **Step 4: Commit**

```bash
git add src/components/social/planning/SlotDetailDrawer.tsx
git commit -m "refactor(social): montage en accordeon, cache si pas de monteur en idee"
```

---

## Task 5: Wrap zone Publication

**Files:**
- Modify: `src/components/social/planning/SlotDetailDrawer.tsx` (lignes 614-767)

- [ ] **Step 1: Calculer le summary Publication**

Après `montageSummary`, ajouter :

```tsx
  const pubSummary = (() => {
    if (!slot) return ''
    const active = (PLATFORMS.filter(p => enabledPlatforms[p.key]) ?? []).map(p => p.label)
    if (active.length === 0) return 'Aucune plateforme'
    return active.join(' · ')
  })()
```

- [ ] **Step 2: Wrapper la RIGHT COLUMN dans `<DrawerSection>`**

Trouver la RIGHT COLUMN actuelle (ligne 614 environ) :

```tsx
          <div style={columnStyle}>
            <ColumnHeader icon={Send} label="Publication" color="#10b981" />

            <Field label="Plateformes" hint="≥ 1 obligatoire">
              ...
            </Field>
            <Field label="Media" ...>
              ...
            </Field>
            {/* Per-platform tabs */}
            <div style={{ marginTop: 4 }}>
              ...
            </div>
            <Field label="Notes">
              ...
            </Field>
            <Field label="Discussion (coach ↔ monteur)">
              <SlotChat slotId={slot.id} />
            </Field>
          </div>
```

La transformer en :

```tsx
          <div style={columnStyle}>
            <DrawerSection
              title="Publication"
              summary={pubSummary}
              open={pubOpen}
              onToggle={() => setPubOpen(o => !o)}
            >
              <Field label="Plateformes" hint="≥ 1 obligatoire">
                ...
              </Field>
              <Field label="Media" ...>
                ...
              </Field>
              <div style={{ marginTop: 4 }}>
                {/* Per-platform tabs (inchangé) */}
                ...
              </div>
              <Field label="Notes">
                ...
              </Field>
            </DrawerSection>

            {slot.monteur_id && (
              <Field label="Discussion (coach ↔ monteur)">
                <SlotChat slotId={slot.id} />
              </Field>
            )}
          </div>
```

Notes :
- Le `<ColumnHeader icon={Send} label="Publication" />` est supprimé (redondant avec le titre de la `DrawerSection`).
- Le `<Field label="Discussion ...">` est sorti de la zone Publication et conditionné sur `slot.monteur_id`.

- [ ] **Step 3: Tester manuellement**

Trois cas :

1. Slot en `idea` **sans** monteur → bloc Publication replié avec "Aucune plateforme" en summary, **chat absent**.
2. Slot en `ready` avec IG enabled et monteur assigné → bloc Publication déplié, summary "Instagram", chat affiché en dessous.
3. Slot en `published` → bloc Publication déplié (read-only fonctionnellement, géré par les hooks existants).

- [ ] **Step 4: Commit**

```bash
git add src/components/social/planning/SlotDetailDrawer.tsx
git commit -m "refactor(social): publication en accordeon + chat conditionnel sur monteur"
```

---

## Task 6: Validation manuelle complète + commit final

**Files:**
- Aucun fichier modifié (validation pure)

- [ ] **Step 1: Lancer le dev server**

```bash
npm run dev
```

- [ ] **Step 2: Checklist en 8 points**

Tester sur `http://localhost:3000/acquisition/reseaux-sociaux` (vue Planning) puis cliquer sur des slots :

1. **Slot vierge en Idée** : Brief déplié, Montage caché, Publication repliée ("Aucune plateforme"). Chat absent.
2. **Slot Idée + monteur assigné** : Brief déplié, Montage replié ("Assigné · Pas commencé"), Publication repliée. Chat présent.
3. **Slot Filmed avec rush** : Brief replié, Montage déplié, Publication repliée. Chat présent.
4. **Slot Edited** : Brief replié, Montage déplié, Publication repliée.
5. **Slot Ready avec IG enabled** : Brief replié, Montage replié ("Validé ✓✓"), Publication dépliée avec onglet IG.
6. **Slot Published** : Publication dépliée (read-only fonctionnel via les disabled inputs existants), Brief & Montage repliés.
7. **Override manuel** : ouvrir slot en Idée, déplier Publication manuellement, modifier la caption Instagram, blur input → la valeur est persistée (auto-save habituel). Le bloc reste déplié pendant la session.
8. **Changement de slot** : fermer le drawer, ouvrir un autre slot → l'état des accordéons est ré-initialisé selon le statut du nouveau slot (pas conservé du slot précédent).

- [ ] **Step 3: Vérification TypeScript finale**

```bash
npx tsc --noEmit
```

Attendu : pas d'erreur.

- [ ] **Step 4: Push**

```bash
git push
```

- [ ] **Step 5: Ouvrir une PR vers `develop`**

```bash
gh pr create --base develop --title "refactor(social): SlotDetailDrawer en accordeons progressifs" --body "$(cat <<'EOF'
## Summary
Refonte UX du drawer planning. Les zones Brief / Montage / Publication deviennent des accordéons. Leur état d'expansion par défaut suit le statut du slot.

- Brief déplié en idée
- Montage déplié en filmed/edited (caché complètement si pas de monteur en idée)
- Publication dépliée en ready/scheduled/published
- Chat coach↔monteur conditionné sur l'assignation

L'utilisateur peut tout déplier/replier manuellement à tout moment. Pas de changement DB.

Spec : docs/superpowers/specs/2026-05-05-slot-drawer-progressive-design.md

## Test plan
- [ ] Slot Idée vierge : Brief déplié, reste replié
- [ ] Slot Filmed : Montage déplié
- [ ] Slot Ready : Publication dépliée
- [ ] Override manuel persiste pendant la session
- [ ] Changement de slot ré-initialise l'état

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes (to be removed before execution)

**Spec coverage check :**
- Comportement par statut → Task 2 (`getDefaultExpansion`) ✅
- Brief accordéon avec summary → Task 3 ✅
- Montage caché si idée sans monteur → Task 4 ✅
- Publication accordéon → Task 5 ✅
- Chat conditionné sur monteur → Task 5 ✅
- Override manuel respecté → Task 2 (`initSlotIdRef` mémorise par slotId) ✅
- Changement de slot ré-initialise → Task 2 (clé sur `slot.id`) + Task 6 step 8 valide ✅
- Suppression des cartes Date/Statut redondantes → **Pas couvert par ce plan**. À la relecture du code, la `DatePill` et `StatusPill` actuelles sont les **seules** présences de date/statut (pas de doublon réel) ; le spec se trompait. À traiter dans une refonte visuelle séparée si l'utilisateur le confirme.
- Read-only en `scheduled`/`published` → Comportement déjà géré par la logique `isPublished` existante (cf. SlotDetailDrawer:384). Aucune action nouvelle nécessaire.

**Type consistency :**
- `getDefaultExpansion` retourne `{ brief, montage, publication }` (booléens) — utilisé tel quel par les `setBriefOpen` etc. ✅
- `slot.monteur_id` existe sur `SocialPostWithPublications` (utilisé déjà ligne 766 actuelle via `slot.id`, et le type a `monteur_id` cf. `src/types/index.ts`).
- `enabledPlatforms[p.key]` accessible dans le scope du composant principal (utilisé déjà dans la zone Plateformes).

**Placeholder scan :** aucun TBD, aucune référence vague restante.
