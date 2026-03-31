# Spec : Personnalisation couleur & logo par workspace

> Date : 2026-03-31
> Auteur : Pierre
> Statut : Draft

---

## Contexte

La couleur primaire `#00C853` (vert) est actuellement hardcodée dans tout le CRM — 154 occurrences dans 64 fichiers. Chaque coach veut pouvoir personnaliser sa couleur de marque et son logo. Cette personnalisation s'applique **partout** : dashboard interne, sidebar, boutons, badges, ET pages publiques (booking Calendly-like, futur tunnel de vente).

## Objectif

Permettre à chaque coach de :
1. Choisir sa **couleur d'accent** (parmi des presets ou hex libre)
2. Uploader son **logo workspace** (affiché sidebar, booking pages, etc.)
3. Voir le changement appliqué **instantanément** dans toute l'app

---

## 1. Base de données

### Migration `003_branding.sql`

```sql
-- Ajout colonnes branding au workspace
ALTER TABLE workspaces
  ADD COLUMN accent_color text NOT NULL DEFAULT '#00C853',
  ADD COLUMN logo_url text;

-- Bucket Storage pour les logos workspace
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS : seul le owner peut upload/modifier/supprimer
CREATE POLICY "workspace_logos_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "workspace_logos_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "workspace_logos_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Lecture publique (les logos sont visibles sur les pages booking)
CREATE POLICY "workspace_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-logos');
```

### Type TypeScript mis à jour

```typescript
export interface Workspace {
  id: string
  name: string
  owner_id: string
  timezone: string
  accent_color: string   // hex, default '#00C853'
  logo_url: string | null
  created_at: string
}
```

---

## 2. Mécanisme CSS : variables dynamiques

### Principe

Le `accent_color` du workspace est injecté comme CSS custom property au niveau du `<body>` ou du layout wrapper. Tous les composants utilisent `var(--color-primary)` au lieu de `#00C853` hardcodé.

### globals.css (inchangé comme fallback)

```css
@theme inline {
  --color-primary: #00C853;       /* fallback si pas de workspace */
  --color-primary-hover: #00A844;
}
```

### Injection dynamique

Un composant `BrandingInjector` (client component) dans le dashboard layout :

```typescript
// src/lib/branding/BrandingInjector.tsx
'use client'

import { useEffect } from 'react'

interface Props {
  accentColor: string
  logoUrl: string | null
}

export function BrandingInjector({ accentColor, logoUrl }: Props) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-primary', accentColor)
    root.style.setProperty('--color-primary-hover', darkenHex(accentColor, 15))
    // bg-active avec opacity
    const rgb = hexToRgb(accentColor)
    if (rgb) {
      root.style.setProperty('--bg-active', `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`)
    }
  }, [accentColor])

  return null
}
```

### Fonctions utilitaires

```typescript
// src/lib/branding/utils.ts
export function darkenHex(hex: string, percent: number): string { ... }
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null { ... }
export function isValidHex(hex: string): boolean { ... }
```

---

## 3. Refactor des couleurs hardcodées

### Stratégie

Remplacement systématique dans tous les fichiers **source** (pas les docs) :

| Pattern actuel | Remplacement |
|---|---|
| `'#00C853'` (inline style) | `'var(--color-primary)'` |
| `'#00A844'` (hover) | `'var(--color-primary-hover)'` |
| `rgba(0,200,83,X)` | `var(--bg-active)` ou calcul dynamique |
| `backgroundColor: '#00C853'` | `backgroundColor: 'var(--color-primary)'` |
| `color: '#00C853'` | `color: 'var(--color-primary)'` |
| `borderColor: '#00C853'` | `borderColor: 'var(--color-primary)'` |

### Fichiers impactés (~50 composants source)

Tous les fichiers `.tsx` et `.ts` dans `src/` qui contiennent `#00C853` ou `#00A844`.

Exclure les fichiers dans `docs/`, `taches/`, `etat.md` (pas du code).

---

## 4. Composant BrandingForm

### Emplacement

Nouvelle section dans `/parametres/reglages`, entre `WorkspaceForm` et `DeleteAccount`.

### UI

```
┌─────────────────────────────────────────────┐
│  Personnalisation                           │
│                                             │
│  Couleur d'accent                           │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐           │
│  │🟢│ │🔴│ │🔵│ │🟣│ │🟡│ │🩷│           │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘           │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐           │
│  │🩵│ │🟠│ │  │ │  │ │  │ │⬛│           │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘           │
│                                             │
│  Couleur personnalisée : [ #______ ]        │
│                                             │
│  Aperçu :                                   │
│  ┌─────────────┐  ┌────────┐               │
│  │  Bouton CTA  │  │ Badge  │               │
│  └─────────────┘  └────────┘               │
│                                             │
│  Logo du workspace                          │
│  ┌──────────────────────┐                   │
│  │                      │                   │
│  │   Glisser ou cliquer │                   │
│  │   pour uploader      │                   │
│  │                      │                   │
│  └──────────────────────┘                   │
│  JPG, PNG ou WebP • Max 2 Mo               │
│                                             │
│          [ Enregistrer ]                    │
└─────────────────────────────────────────────┘
```

### Couleurs prédéfinies

| Nom | Hex |
|-----|-----|
| Vert (défaut) | `#00C853` |
| Rouge | `#E53E3E` |
| Bleu | `#3B82F6` |
| Violet | `#8B5CF6` |
| Ambre | `#F59E0B` |
| Rose | `#EC4899` |
| Cyan | `#06B6D4` |
| Orange | `#F97316` |
| Teal | `#14B8A6` |
| Indigo | `#6366F1` |
| Lime | `#84CC16` |
| Noir | `#000000` |

### Validation

```typescript
// src/lib/validations/settings.ts — ajout
export const updateBrandingSchema = z.object({
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hex invalide').optional(),
})
```

### Comportement

- Sélection d'une couleur preset → remplit l'input hex + met à jour l'aperçu live
- Saisie libre dans l'input hex → valide le format, met à jour l'aperçu
- L'aperçu montre un bouton et un badge dans la couleur choisie
- Le changement n'est persisté qu'au clic sur "Enregistrer"
- Après sauvegarde, le `BrandingInjector` reçoit la nouvelle couleur → tout le dashboard change

---

## 5. API

### PATCH `/api/workspaces` (existant — extension)

Ajout du champ `accent_color` au schema de validation et à l'update Supabase.

```typescript
// Body accepté (en plus de name, timezone)
{
  accent_color?: string  // hex valide
}
```

### POST `/api/workspaces/logo` (nouveau)

Même pattern que `POST /api/user/avatar` :

1. Reçoit `FormData` avec fichier `logo`
2. Validation : `image/jpeg`, `image/png`, `image/webp`, max 2 Mo
3. Upload vers `workspace-logos/{workspace_id}/logo.{ext}`
4. Supprime l'ancien logo s'il existe
5. Met à jour `workspaces.logo_url`
6. Retourne `{ data: { logo_url: string } }`

### DELETE `/api/workspaces/logo` (nouveau)

1. Supprime le fichier dans Storage
2. Met `workspaces.logo_url = null`
3. Retourne `{ data: { success: true } }`

---

## 6. Intégration dans le layout

### Dashboard layout (`src/app/(dashboard)/layout.tsx`)

```typescript
// Fetch workspace (déjà fait pour la sidebar)
// Passer accent_color et logo_url au BrandingInjector

<BrandingInjector
  accentColor={workspace.accent_color}
  logoUrl={workspace.logo_url}
/>
```

### Sidebar (`src/components/layout/Sidebar.tsx`)

- Si `logo_url` existe → afficher le logo en haut de la sidebar (32x32, rounded)
- Sinon → garder le texte "ClosRM" actuel

### Pages publiques (booking — futur)

- Le booking page fetch le workspace par slug
- Utilise `accent_color` et `logo_url` pour le branding de la page

---

## 7. Fichiers à créer / modifier

### Nouveaux fichiers
- `supabase/migrations/003_branding.sql`
- `src/lib/branding/BrandingInjector.tsx`
- `src/lib/branding/utils.ts`
- `src/components/settings/BrandingForm.tsx`
- `src/app/api/workspaces/logo/route.ts`

### Fichiers à modifier
- `src/types/index.ts` — ajouter `accent_color`, `logo_url` à Workspace
- `src/lib/validations/settings.ts` — ajouter validation hex
- `src/app/api/workspaces/route.ts` — accepter `accent_color` dans PATCH
- `src/app/(dashboard)/layout.tsx` — intégrer BrandingInjector
- `src/app/(dashboard)/parametres/reglages/page.tsx` — ajouter BrandingForm
- `src/components/layout/Sidebar.tsx` — afficher logo si présent
- `src/app/globals.css` — ajuster `--bg-active` fallback
- **~50 fichiers composants** — remplacer `#00C853` → `var(--color-primary)` et `#00A844` → `var(--color-primary-hover)`

---

## 8. Vérification

1. **Couleur** : Changer la couleur dans Settings → tout le dashboard (sidebar, boutons, badges, graphiques) change instantanément
2. **Persistance** : Recharger la page → la couleur persiste
3. **Fallback** : Workspace sans `accent_color` → vert par défaut
4. **Logo upload** : Upload → visible dans sidebar et Settings
5. **Logo suppression** : Supprimer → retour au texte "ClosRM"
6. **Validation** : Hex invalide → erreur affichée, pas de sauvegarde
7. **Pages auth/landing** : Non impactées (gardent le vert par défaut, pas de workspace context)
8. **Dark/Light mode** : La couleur custom fonctionne dans les deux modes
