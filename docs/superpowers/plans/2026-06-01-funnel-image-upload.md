# Funnel Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre l'upload d'images depuis l'ordinateur dans les blocs Image (galerie) et Hero de l'éditeur de funnels, avec compression automatique côté client avant envoi vers R2.

**Architecture:** Un hook `useImageUpload` gère la compression (`browser-image-compression`), la récupération d'une presigned URL R2 (`/api/storage/upload-url`), et l'upload XHR avec progress. Un composant partagé `<ImageUploadField>` gère les 4 états UI (vide, en cours, rempli, erreur) et est réutilisé dans `HeroConfig` et `ImageConfig`. Les images funnels sont stockées dans R2 sous `workspaces/{wid}/funnels/{fid}/{uuid}.webp` et servies via URL publique.

**Tech Stack:** Next.js App Router, TypeScript, `browser-image-compression`, Cloudflare R2 (`@aws-sdk/client-s3`), XHR pour progress, CSS variables de l'app

---

## Prérequis manuels (à faire avant le Task 1)

Ces étapes ne peuvent pas être automatisées — elles doivent être faites manuellement :

1. **Merger develop** : `git fetch origin && git merge origin/develop` — les types de blocs ont évolué en production
2. **Configurer R2 public** : Dans le dashboard Cloudflare → R2 → ton bucket → Settings → Public access → Enable. Ou : `npx wrangler r2 bucket update <bucket-name> --jurisdiction eu` puis activer depuis le dashboard. Note l'URL publique (format `https://pub-xxx.r2.dev`).
3. **Ajouter la variable d'env** dans `.env.local` :
   ```
   R2_PUBLIC_URL=https://pub-xxx.r2.dev
   ```
   Et dans Vercel → Settings → Environment Variables : ajouter `R2_PUBLIC_URL`.

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `src/hooks/useImageUpload.ts` | Créé |
| `src/components/funnels/config/ImageUploadField.tsx` | Créé |
| `src/app/api/storage/upload-url/route.ts` | Modifié — ajout variante `funnel_image` |
| `src/components/funnels/v2/FunnelBuilderV2.tsx` | Modifié — ajout `workspace_id` dans le Pick, propagation |
| `src/components/funnels/FunnelBlockConfig.tsx` | Modifié — ajout props `funnelId` + `workspaceId`, propagation |
| `src/components/funnels/config/HeroConfig.tsx` | Modifié — ajout props + `<ImageUploadField>` |
| `src/components/funnels/config/ImageConfig.tsx` | Modifié — ajout props + `<ImageUploadField>` par slot photo |
| `src/types/index.ts` | Modifié si nécessaire — type `FunnelImageBlockConfig` évolué |
| `package.json` | `browser-image-compression` ajouté |

---

## Task 1 : Installer browser-image-compression + vérifier le type FunnelImageBlockConfig

**Files:**
- Modify: `package.json`
- Check: `src/types/index.ts`

- [ ] **Step 1.1 : Installer la dépendance**

```bash
npm install browser-image-compression
npm install --save-dev @types/browser-image-compression
```

Vérifier que l'install s'est bien passé :
```bash
node -e "require('browser-image-compression'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 1.2 : Vérifier le type FunnelImageBlockConfig après le merge develop**

Ouvrir `src/types/index.ts` et chercher `FunnelImageBlockConfig`. Deux cas possibles :

**Cas A — La prod a déjà évolué (type multi-photos) :**
```typescript
export interface FunnelImagePhoto {
  src: string
  alt: string
  linkUrl: string | null
}

export interface FunnelImageBlockConfig {
  photos: FunnelImagePhoto[]
  // + éventuellement size, columns, alignment
}
```
→ **Aller directement au Task 2.**

**Cas B — Toujours l'ancien type single-image (`src: string`) :**
```typescript
export interface FunnelImageBlockConfig {
  src: string
  alt: string
  width: number | null
  alignment: 'left' | 'center' | 'right'
  linkUrl: string | null
}
```
→ **Remplacer par :**

```typescript
export interface FunnelImagePhoto {
  src: string
  alt: string
  linkUrl: string | null
}

export interface FunnelImageBlockConfig {
  photos: FunnelImagePhoto[]
  size: 'small' | 'medium' | 'large'
  columns: 1 | 2 | 3
  alignment: 'left' | 'center' | 'right'
}
```

Et mettre à jour `src/lib/funnels/defaults.ts` — la valeur par défaut du bloc image :
```typescript
case 'image':
  return {
    photos: [],
    size: 'large',
    columns: 1,
    alignment: 'center',
  } satisfies FunnelImageBlockConfig
```

- [ ] **Step 1.3 : Vérifier que TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: aucune erreur. Si des erreurs apparaissent sur `ImageBlock.tsx` ou `ImageConfig.tsx`, elles seront corrigées dans les tasks suivants.

- [ ] **Step 1.4 : Commit**

```bash
git add package.json package-lock.json src/types/index.ts src/lib/funnels/defaults.ts
git commit -m "feat(funnels/image): install browser-image-compression, evolve image block type to multi-photo"
```

---

## Task 2 : Modifier l'API route `/api/storage/upload-url`

**Files:**
- Modify: `src/app/api/storage/upload-url/route.ts`

- [ ] **Step 2.1 : Ajouter le schéma et le handler funnel image**

Remplacer le contenu de `src/app/api/storage/upload-url/route.ts` par :

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getWorkspaceId } from '@/lib/supabase/get-workspace'
import { isR2Configured } from '@/lib/storage/r2-client'
import { buildR2Path, signUpload, type R2Target } from '@/lib/storage/signing'

const MAX_BYTES = 2 * 1024 * 1024 * 1024
const FUNNEL_IMAGE_MAX_BYTES = 15 * 1024 * 1024 // 15 Mo avant compression

const postBodySchema = z.object({
  type: z.undefined().or(z.literal('post')),
  post_id: z.string().uuid(),
  target: z.enum(['final', 'media', 'rush']),
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(100),
  content_length: z.number().int().positive().max(MAX_BYTES),
})

const funnelImageBodySchema = z.object({
  type: z.literal('funnel_image'),
  funnel_id: z.string().uuid(),
  content_type: z.string().min(1).max(100),
  content_length: z.number().int().positive().max(FUNNEL_IMAGE_MAX_BYTES),
})

export async function POST(request: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json({ error: 'R2 storage not configured' }, { status: 503 })
    }

    const { workspaceId } = await getWorkspaceId()
    const body = await request.json().catch(() => null)

    // Route funnel image
    if (body?.type === 'funnel_image') {
      const parsed = funnelImageBodySchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      }

      const { funnel_id, content_type, content_length } = parsed.data
      const path = `workspaces/${workspaceId}/funnels/${funnel_id}/${randomUUID()}.webp`

      const upload_url = await signUpload({ path, contentType: content_type, contentLength: content_length })

      const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
      if (!R2_PUBLIC_URL) {
        return NextResponse.json({ error: 'R2_PUBLIC_URL not configured' }, { status: 503 })
      }
      const public_url = `${R2_PUBLIC_URL}/${path}`

      return NextResponse.json({ upload_url, path, public_url })
    }

    // Route post (existante — inchangée)
    const parsed = postBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { post_id, target, filename, content_type, content_length } = parsed.data
    const path = buildR2Path({
      workspaceId,
      postId: post_id,
      target: target as R2Target,
      filename,
    })

    const upload_url = await signUpload({ path, contentType: content_type, contentLength: content_length })
    return NextResponse.json({ upload_url, path })
  } catch (e) {
    console.error('[storage/upload-url]', e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 2.2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur sur ce fichier.

- [ ] **Step 2.3 : Test manuel de la route**

Démarrer le serveur dev : `npm run dev`

Depuis la console navigateur (sur une page authentifiée de l'app), tester :
```javascript
const res = await fetch('/api/storage/upload-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'funnel_image',
    funnel_id: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // un vrai funnel_id
    content_type: 'image/webp',
    content_length: 50000,
  }),
})
console.log(await res.json())
```

Expected: `{ upload_url: "https://...", path: "workspaces/.../funnels/.../uuid.webp", public_url: "https://pub-xxx.r2.dev/workspaces/..." }`

- [ ] **Step 2.4 : Commit**

```bash
git add src/app/api/storage/upload-url/route.ts
git commit -m "feat(api/storage): add funnel_image upload variant with public URL"
```

---

## Task 3 : Créer le hook `useImageUpload`

**Files:**
- Create: `src/hooks/useImageUpload.ts`

- [ ] **Step 3.1 : Créer le fichier**

Créer `src/hooks/useImageUpload.ts` :

```typescript
import imageCompression from 'browser-image-compression'
import { useState, useCallback } from 'react'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_INPUT_MB = 15

interface UseImageUploadOptions {
  funnelId: string
  workspaceId: string
}

interface UseImageUploadReturn {
  upload: (file: File) => Promise<string>
  isUploading: boolean
  progress: number
  error: string | null
  reset: () => void
}

export function useImageUpload({ funnelId }: UseImageUploadOptions): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setIsUploading(false)
    setProgress(0)
    setError(null)
  }, [])

  const upload = useCallback(async (file: File): Promise<string> => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      const msg = 'Format non supporté (JPG, PNG, WebP, GIF uniquement)'
      setError(msg)
      throw new Error(msg)
    }
    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      const mb = (file.size / 1024 / 1024).toFixed(1)
      const msg = `Fichier trop volumineux (max ${MAX_INPUT_MB} Mo, ton fichier fait ${mb} Mo)`
      setError(msg)
      throw new Error(msg)
    }

    setIsUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Étape 1 : compression côté client (10 → 50%)
      setProgress(10)
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp',
        onProgress: (p) => setProgress(10 + Math.round(p * 0.4)),
      })

      // Étape 2 : presigned URL (50%)
      setProgress(50)
      const signRes = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'funnel_image',
          funnel_id: funnelId,
          content_type: 'image/webp',
          content_length: compressed.size,
        }),
      })

      if (!signRes.ok) {
        const j = await signRes.json().catch(() => ({})) as { error?: string }
        throw new Error(j.error ?? `Erreur serveur (${signRes.status})`)
      }

      const { upload_url, public_url } = await signRes.json() as { upload_url: string; public_url: string }

      // Étape 3 : upload XHR avec progress (55 → 100%)
      setProgress(55)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', upload_url)
        xhr.setRequestHeader('Content-Type', 'image/webp')
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(55 + Math.round((e.loaded / e.total) * 45))
          }
        })
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload échoué (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error("Erreur réseau pendant l'upload"))
        xhr.send(compressed)
      })

      setProgress(100)
      return public_url
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(msg)
      throw e
    } finally {
      setIsUploading(false)
    }
  }, [funnelId])

  return { upload, isUploading, progress, error, reset }
}
```

- [ ] **Step 3.2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 3.3 : Commit**

```bash
git add src/hooks/useImageUpload.ts
git commit -m "feat(hooks): add useImageUpload — R2 presigned upload with client-side compression"
```

---

## Task 4 : Créer le composant `<ImageUploadField>`

**Files:**
- Create: `src/components/funnels/config/ImageUploadField.tsx`

- [ ] **Step 4.1 : Créer le composant**

Créer `src/components/funnels/config/ImageUploadField.tsx` :

```typescript
'use client'

import { useRef, useState, useCallback } from 'react'
import { useImageUpload } from '@/hooks/useImageUpload'

interface Props {
  value: string
  onChange: (url: string) => void
  funnelId: string
  workspaceId: string
  label?: string
}

export default function ImageUploadField({ value, onChange, funnelId, workspaceId, label }: Props) {
  const { upload, isUploading, progress, error, reset } = useImageUpload({ funnelId, workspaceId })
  const inputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    try {
      const url = await upload(file)
      onChange(url)
    } catch {
      // l'erreur est déjà dans le state du hook
    }
  }, [upload, onChange])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleUrlSubmit = useCallback(() => {
    const trimmed = urlInput.trim()
    if (trimmed) {
      onChange(trimmed)
      setUrlInput('')
    }
  }, [urlInput, onChange])

  // État rempli
  if (value && !isUploading) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div
          style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-primary)' }}
          onMouseEnter={e => { const ov = e.currentTarget.querySelector<HTMLElement>('.img-ov'); if (ov) ov.style.opacity = '1' }}
          onMouseLeave={e => { const ov = e.currentTarget.querySelector<HTMLElement>('.img-ov'); if (ov) ov.style.opacity = '0' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
          <div
            className="img-ov"
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0, transition: '.15s' }}
          >
            <button onClick={() => inputRef.current?.click()} style={overlayBtn('var(--color-primary)')}>Changer</button>
            <button onClick={() => { onChange(''); reset() }} style={overlayBtn('rgba(255,255,255,0.15)')}>Supprimer</button>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      </div>
    )
  }

  // État upload en cours
  if (isUploading) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={{ ...dropZoneBase, opacity: 0.7 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Compression + upload…</span>
          <div style={{ width: '100%', background: 'var(--border-secondary)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
            <div style={{ background: 'var(--color-primary)', height: '100%', width: `${progress}%`, transition: '.2s' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{progress}%</span>
        </div>
      </div>
    )
  }

  // État erreur
  if (error) {
    return (
      <div>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={{ border: '2px dashed var(--color-primary)', borderRadius: 8, padding: '14px 12px', textAlign: 'center', background: 'var(--bg-input)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-primary)', marginBottom: 6 }}>⚠️ {error}</div>
          <button onClick={reset} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // État vide
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <div
        style={{ ...dropZoneBase, borderColor: isDragging ? 'var(--color-primary)' : 'var(--border-secondary)', cursor: 'pointer' }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <span style={{ fontSize: 18, marginBottom: 4 }}>⬆</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Glisse ou{' '}
          <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>clique pour uploader</span>
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>JPG PNG WebP · max 15 Mo</span>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ou URL</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border-primary)' }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
          placeholder="https://..."
          style={{ flex: 1, padding: '7px 10px', fontSize: 12, background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-primary)', outline: 'none' }}
        />
        <button onClick={handleUrlSubmit} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', borderRadius: 8, padding: '0 10px', fontSize: 12, cursor: 'pointer' }}>
          OK
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4,
}

const dropZoneBase: React.CSSProperties = {
  border: '2px dashed var(--border-secondary)',
  borderRadius: 8,
  padding: '18px 12px',
  textAlign: 'center',
  background: 'var(--bg-input)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
}

function overlayBtn(bg: string): React.CSSProperties {
  return { background: bg, color: 'white', padding: '4px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', border: 'none' }
}
```

- [ ] **Step 4.2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4.3 : Commit**

```bash
git add src/components/funnels/config/ImageUploadField.tsx
git commit -m "feat(funnels/config): add ImageUploadField component with 4 states"
```

---

## Task 5 : Propager `funnelId` + `workspaceId` vers les configs

`HeroConfig` et `ImageConfig` ont besoin de `funnelId` et `workspaceId` pour instancier `useImageUpload`. Ces valeurs sont disponibles dans `FunnelBuilderV2` mais ne sont pas propagées jusqu'aux configs. On les thread ici.

**Files:**
- Modify: `src/components/funnels/v2/FunnelBuilderV2.tsx` (lignes ~77-97 et ~240)
- Modify: `src/components/funnels/FunnelBlockConfig.tsx`

- [ ] **Step 5.1 : Modifier `FunnelBuilderV2.tsx` — ajouter `workspace_id` dans le Pick**

Trouver la ligne :
```typescript
funnel: Pick<Funnel, 'id' | 'preset_id' | 'preset_override' | 'effects_config'>
```

Remplacer par :
```typescript
funnel: Pick<Funnel, 'id' | 'workspace_id' | 'preset_id' | 'preset_override' | 'effects_config'>
```

- [ ] **Step 5.2 : Passer `funnelId` et `workspaceId` à `FunnelBlockConfigPanel`**

Trouver la ligne (environ ligne 240) :
```typescript
<FunnelBlockConfigPanel block={selectedBlock} onChange={handleBlockChange} pages={pages} blocks={blocks} />
```

Remplacer par :
```typescript
<FunnelBlockConfigPanel
  block={selectedBlock}
  onChange={handleBlockChange}
  pages={pages}
  blocks={blocks}
  funnelId={funnel.id}
  workspaceId={funnel.workspace_id}
/>
```

- [ ] **Step 5.3 : Modifier `FunnelBlockConfig.tsx` — ajouter les props et les propager**

Remplacer l'interface Props :
```typescript
interface Props {
  block: FunnelBlock
  onChange: (block: FunnelBlock) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
  funnelId: string
  workspaceId: string
}
```

Mettre à jour la signature de la fonction :
```typescript
export default function FunnelBlockConfig({ block, onChange, pages, blocks, funnelId, workspaceId }: Props) {
```

Trouver le rendu du bloc hero :
```typescript
{block.type === 'hero' && (
  <HeroConfig config={block.config as Parameters<typeof HeroConfig>[0]['config']} onChange={c => handleConfigChange(c)} pages={pages} blocks={blocks} />
)}
```

Remplacer par :
```typescript
{block.type === 'hero' && (
  <HeroConfig
    config={block.config as Parameters<typeof HeroConfig>[0]['config']}
    onChange={c => handleConfigChange(c)}
    pages={pages}
    blocks={blocks}
    funnelId={funnelId}
    workspaceId={workspaceId}
  />
)}
```

Trouver le rendu du bloc image :
```typescript
{block.type === 'image' && (
  <ImageConfig config={block.config as Parameters<typeof ImageConfig>[0]['config']} onChange={c => handleConfigChange(c)} pages={pages} blocks={blocks} />
)}
```

Remplacer par :
```typescript
{block.type === 'image' && (
  <ImageConfig
    config={block.config as Parameters<typeof ImageConfig>[0]['config']}
    onChange={c => handleConfigChange(c)}
    pages={pages}
    blocks={blocks}
    funnelId={funnelId}
    workspaceId={workspaceId}
  />
)}
```

- [ ] **Step 5.4 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: des erreurs sur `HeroConfig` et `ImageConfig` (props `funnelId`/`workspaceId` pas encore déclarées) — c'est attendu, elles seront corrigées dans les tasks suivants.

Si TypeScript remonte une erreur sur `page.tsx` (le parent de `FunnelBuilderV2`) disant que `workspace_id` est manquant, trouver l'endroit où `funnel` est construit/sélectionné dans le composant parent et s'assurer que `workspace_id` est inclus dans la requête Supabase (ex: `select('id, workspace_id, preset_id, ...')`). C'est probablement déjà le cas.

- [ ] **Step 5.5 : Commit**

```bash
git add src/components/funnels/v2/FunnelBuilderV2.tsx src/components/funnels/FunnelBlockConfig.tsx
git commit -m "feat(funnels/builder): thread funnelId + workspaceId down to block configs"
```

---

## Task 6 : Intégrer `<ImageUploadField>` dans `HeroConfig`

**Files:**
- Modify: `src/components/funnels/config/HeroConfig.tsx`

- [ ] **Step 6.1 : Mettre à jour HeroConfig**

Remplacer le contenu de `src/components/funnels/config/HeroConfig.tsx` par :

```typescript
'use client'

import type { HeroBlockConfig, FunnelPage, FunnelBlock } from '@/types'
import RedirectPicker from './RedirectPicker'
import ImageUploadField from './ImageUploadField'

interface Props {
  config: HeroBlockConfig
  onChange: (config: HeroBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
  funnelId: string
  workspaceId: string
}

export default function HeroConfig({ config, onChange, pages, blocks, funnelId, workspaceId }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={labelStyle}>Badge (au-dessus du titre)</label>
        <input
          type="text"
          value={config.badgeText || ''}
          onChange={e => onChange({ ...config, badgeText: e.target.value })}
          placeholder="Atelier 100% Gratuit"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Titre</label>
        <input
          type="text"
          value={config.title}
          onChange={e => onChange({ ...config, title: e.target.value })}
          placeholder="Votre titre principal"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Sous-titre</label>
        <input
          type="text"
          value={config.subtitle}
          onChange={e => onChange({ ...config, subtitle: e.target.value })}
          placeholder="Description courte"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Texte du bouton</label>
        <input
          type="text"
          value={config.ctaText}
          onChange={e => onChange({ ...config, ctaText: e.target.value })}
          placeholder="Réserver un appel"
          style={inputStyle}
        />
      </div>
      <RedirectPicker
        value={config.ctaUrl || null}
        onChange={val => onChange({ ...config, ctaUrl: val || '' })}
        pages={pages}
        blocks={blocks}
        label="Lien du bouton"
        required
      />
      <ImageUploadField
        value={config.backgroundImage || ''}
        onChange={url => onChange({ ...config, backgroundImage: url || null })}
        funnelId={funnelId}
        workspaceId={workspaceId}
        label="Image de fond"
      />
      <div>
        <label style={labelStyle}>Alignement</label>
        <select
          value={config.alignment}
          onChange={e => onChange({ ...config, alignment: e.target.value as HeroBlockConfig['alignment'] })}
          style={inputStyle}
        >
          <option value="left">Gauche</option>
          <option value="center">Centre</option>
          <option value="right">Droite</option>
        </select>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8,
  color: 'var(--text-primary)', outline: 'none',
}
```

- [ ] **Step 6.2 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur sur HeroConfig. Il peut rester des erreurs sur ImageConfig — normal.

- [ ] **Step 6.3 : Test manuel Hero**

Dans `npm run dev`, ouvrir un funnel → cliquer sur un bloc Hero → dans l'inspecteur droit, vérifier que :
- La section "Image de fond" affiche la zone d'upload + séparateur "ou URL"
- Cliquer sur la zone ouvre le sélecteur de fichiers
- Uploader une image → barre de progression → aperçu de l'image uploadée
- "Supprimer" remet la zone vide
- Entrer une URL + Enter → aperçu de l'image externe

- [ ] **Step 6.4 : Commit**

```bash
git add src/components/funnels/config/HeroConfig.tsx
git commit -m "feat(funnels/hero): replace background image URL input with ImageUploadField"
```

---

## Task 7 : Intégrer `<ImageUploadField>` dans `ImageConfig`

**Files:**
- Modify: `src/components/funnels/config/ImageConfig.tsx`

- [ ] **Step 7.1 : Remplacer ImageConfig**

> **Note :** Ce code assume que `FunnelImageBlockConfig` a évolué vers la structure multi-photos (`photos: FunnelImagePhoto[]`). Si après le merge develop la structure est différente, adapter en conséquence en gardant le même pattern (un `<ImageUploadField>` par slot).

Remplacer le contenu de `src/components/funnels/config/ImageConfig.tsx` par :

```typescript
'use client'

import type { FunnelImageBlockConfig, FunnelImagePhoto, FunnelPage, FunnelBlock } from '@/types'
import RedirectPicker from './RedirectPicker'
import ImageUploadField from './ImageUploadField'

interface Props {
  config: FunnelImageBlockConfig
  onChange: (config: FunnelImageBlockConfig) => void
  pages?: FunnelPage[]
  blocks?: FunnelBlock[]
  funnelId: string
  workspaceId: string
}

export default function ImageConfig({ config, onChange, pages, blocks, funnelId, workspaceId }: Props) {
  function updatePhoto(index: number, updates: Partial<FunnelImagePhoto>) {
    const photos = config.photos.map((p, i) => i === index ? { ...p, ...updates } : p)
    onChange({ ...config, photos })
  }

  function addPhoto() {
    if (config.photos.length >= 10) return
    onChange({ ...config, photos: [...config.photos, { src: '', alt: '', linkUrl: null }] })
  }

  function removePhoto(index: number) {
    onChange({ ...config, photos: config.photos.filter((_, i) => i !== index) })
  }

  function movePhoto(from: number, to: number) {
    const photos = [...config.photos]
    const [moved] = photos.splice(from, 1)
    photos.splice(to, 0, moved)
    onChange({ ...config, photos })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Réglages globaux */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Taille</label>
          <select value={config.size} onChange={e => onChange({ ...config, size: e.target.value as FunnelImageBlockConfig['size'] })} style={inputStyle}>
            <option value="small">Petite</option>
            <option value="medium">Moyenne</option>
            <option value="large">Grande</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Colonnes</label>
          <select value={config.columns} onChange={e => onChange({ ...config, columns: Number(e.target.value) as FunnelImageBlockConfig['columns'] })} style={inputStyle}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Alignement</label>
        <select value={config.alignment} onChange={e => onChange({ ...config, alignment: e.target.value as FunnelImageBlockConfig['alignment'] })} style={inputStyle}>
          <option value="left">Gauche</option>
          <option value="center">Centre</option>
          <option value="right">Droite</option>
        </select>
      </div>

      <div style={{ height: 1, background: 'var(--border-primary)' }} />

      {/* Liste des photos */}
      {config.photos.map((photo, i) => (
        <div key={i} style={{ border: '1px solid var(--border-primary)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={labelStyle}>Photo {i + 1}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => i > 0 && movePhoto(i, i - 1)} disabled={i === 0} style={iconBtn}>↑</button>
              <button onClick={() => i < config.photos.length - 1 && movePhoto(i, i + 1)} disabled={i === config.photos.length - 1} style={iconBtn}>↓</button>
              <button onClick={() => removePhoto(i)} style={iconBtn}>🗑</button>
            </div>
          </div>
          <ImageUploadField
            value={photo.src}
            onChange={src => updatePhoto(i, { src })}
            funnelId={funnelId}
            workspaceId={workspaceId}
          />
          <div>
            <label style={labelStyle}>Texte alternatif</label>
            <input
              type="text"
              value={photo.alt}
              onChange={e => updatePhoto(i, { alt: e.target.value })}
              placeholder="Description de l'image"
              style={inputStyle}
            />
          </div>
          <RedirectPicker
            value={photo.linkUrl}
            onChange={val => updatePhoto(i, { linkUrl: val })}
            pages={pages}
            blocks={blocks}
            label="Lien au clic"
          />
        </div>
      ))}

      {/* Bouton ajouter */}
      <button
        onClick={addPhoto}
        disabled={config.photos.length >= 10}
        style={{
          fontSize: 12,
          color: config.photos.length >= 10 ? 'var(--text-disabled)' : 'var(--color-primary)',
          background: 'transparent',
          border: `1px dashed ${config.photos.length >= 10 ? 'var(--text-disabled)' : 'var(--color-primary)'}`,
          borderRadius: 8,
          padding: 8,
          cursor: config.photos.length >= 10 ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        + Ajouter une photo{config.photos.length >= 10 ? ' (max 10)' : ''}
      </button>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 8,
  color: 'var(--text-primary)', outline: 'none',
}

const iconBtn: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-primary)',
  color: 'var(--text-secondary)',
  borderRadius: 5,
  padding: '2px 7px',
  fontSize: 12,
  cursor: 'pointer',
}
```

- [ ] **Step 7.2 : Vérifier TypeScript — build complet**

```bash
npx tsc --noEmit
```

Expected: aucune erreur. Si `FunnelImagePhoto` n'est pas exporté depuis `@/types`, l'ajouter à `src/types/index.ts`.

- [ ] **Step 7.3 : Vérifier le build Next.js**

```bash
npm run build
```

Expected: build réussi, aucune erreur TypeScript ou d'import.

- [ ] **Step 7.4 : Commit**

```bash
git add src/components/funnels/config/ImageConfig.tsx
git commit -m "feat(funnels/image): replace URL inputs with ImageUploadField per photo slot"
```

---

## Task 8 : Test manuel end-to-end + vérification aussi du ImageBlock rendu

**Files:**
- Read: `src/components/funnels/blocks/ImageBlock.tsx` (pour vérifier qu'il gère `photos[]`)

- [ ] **Step 8.1 : Vérifier que `ImageBlock.tsx` gère la structure multi-photos**

Ouvrir `src/components/funnels/blocks/ImageBlock.tsx`. Il doit itérer sur `config.photos` et afficher chaque image. Si ce fichier utilise encore `config.src` (ancien format single-image), le mettre à jour :

```typescript
// Attendu après merge develop :
config.photos.map((photo, i) => (
  <img key={i} src={photo.src} alt={photo.alt} ... />
))
```

Si ce n'est pas le cas, faire la mise à jour et committer séparément.

- [ ] **Step 8.2 : Test manuel bloc Image**

Dans `npm run dev`, ouvrir un funnel → cliquer sur un bloc Image → dans l'inspecteur :
1. Cliquer "+ Ajouter une photo" → un slot photo apparaît
2. Dans le slot, uploader une image par drag & drop → barre de progression → aperçu
3. Uploader une 2e photo via clic → apparaît dans un 2e slot
4. Tester ↑ ↓ pour réordonner les photos
5. Tester 🗑 pour supprimer
6. Ajouter 10 photos → vérifier que le bouton "+ Ajouter" est désactivé
7. Entrer une URL externe dans le champ URL → valider avec Enter → aperçu de l'image externe

- [ ] **Step 8.3 : Vérifier la preview funnel**

Dans la preview centrale du builder, vérifier que les images uploadées s'affichent bien dans le bloc Image et dans le fond du bloc Hero. Les URLs publiques R2 doivent être directement accessibles (pas de 403).

Si les images ne s'affichent pas (403) : vérifier que R2 Public Access est bien activé sur le bucket (voir Prérequis manuels).

- [ ] **Step 8.4 : Vérifier la persistance**

Sauvegarder le funnel (autosave ou bouton Publier), recharger la page → les images doivent toujours s'afficher. Les URLs R2 publiques sont permanentes.

- [ ] **Step 8.5 : Commit final**

```bash
git add -p  # vérifier qu'on n'inclut pas .env.local
git commit -m "feat(funnels/image): complete image upload integration — Hero + Image gallery blocks"
```

---

## Récapitulatif des commits attendus

1. `feat(funnels/image): install browser-image-compression, evolve image block type to multi-photo`
2. `feat(api/storage): add funnel_image upload variant with public URL`
3. `feat(hooks): add useImageUpload — R2 presigned upload with client-side compression`
4. `feat(funnels/config): add ImageUploadField component with 4 states`
5. `feat(funnels/builder): thread funnelId + workspaceId down to block configs`
6. `feat(funnels/hero): replace background image URL input with ImageUploadField`
7. `feat(funnels/image): replace URL inputs with ImageUploadField per photo slot`
8. `feat(funnels/image): complete image upload integration — Hero + Image gallery blocks`
