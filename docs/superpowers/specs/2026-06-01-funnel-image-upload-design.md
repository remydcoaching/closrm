# Funnel Image Upload — Design Spec

**Date :** 2026-06-01  
**Auteur :** Rémy  
**Statut :** Approuvé

---

## Contexte

Dans l'éditeur de funnels, les images (bloc Image/galerie et image de fond du bloc Hero) ne peuvent être configurées que via une URL externe. L'objectif est d'ajouter l'upload direct depuis l'ordinateur, avec compression automatique côté client avant envoi vers R2.

---

## Périmètre

### Inclus
- Upload d'images dans le **bloc Image** (galerie multi-photos, jusqu'à 10 images)
- Upload de l'**image de fond du bloc Hero**
- Compression automatique côté client (WebP, max 1920px, qualité 80%)
- URL externe conservée comme option secondaire (fallback)

### Exclu
- Vidéos : on garde les URLs uniquement (YouTube/Vimeo/URL directe)
- Médiathèque workspace centralisée (V2)
- Suppression des objets R2 orphelins (V2 — job de nettoyage)

---

## Architecture

### Vue d'ensemble

```
browser-image-compression (lib npm)
         │
         ▼
useImageUpload (hook)
  ├── valide le fichier (format, taille max 15 Mo)
  ├── compresse côté client (WebP, max 1920px, qualité 80%)
  ├── appelle POST /api/storage/upload-url (type: 'funnel')
  ├── upload direct vers R2 via presigned URL PUT
  └── retourne { url, isUploading, progress, error, reset }
         │
         ▼
<ImageUploadField> (composant partagé)
  ├── État vide   : zone drag & drop + URL fallback
  ├── En cours    : barre de progression, URL désactivée
  ├── Image OK    : aperçu + "Changer" / "Supprimer" au survol
  └── Erreur      : message clair + bouton "Réessayer"
         │
   ┌─────┴──────┐
   ▼            ▼
HeroConfig   ImageConfig (un composant par slot photo)
```

---

## Composants et fichiers

### Nouveau : `src/hooks/useImageUpload.ts`

```typescript
interface UseImageUploadOptions {
  funnelId: string
  workspaceId: string
  maxSizeMB?: number        // défaut : 15
  maxWidthOrHeight?: number // défaut : 1920
}

interface UseImageUploadReturn {
  upload(file: File): Promise<string>  // retourne l'URL publique R2
  isUploading: boolean
  progress: number  // 0–100
  error: string | null
  reset(): void
}
```

**Logique interne :**
1. Valider le format (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) et la taille (≤ 15 Mo)
2. Comprimer via `browser-image-compression` — skip si déjà ≤ 200 Ko et ≤ 1920px
3. Appeler `POST /api/storage/upload-url` avec `{ type: 'funnel', funnelId, workspaceId, contentType: 'image/webp' }`
4. Uploader le blob WebP directement vers R2 via le presigned URL (PUT)
5. Retourner l'URL publique R2

### Nouveau : `src/components/funnels/config/ImageUploadField.tsx`

```typescript
interface ImageUploadFieldProps {
  value: string                    // URL actuelle (vide = pas d'image)
  onChange(url: string): void
  funnelId: string
  workspaceId: string
  label?: string                   // ex : "Image de fond"
}
```

**Comportement :**
- Supporte le drag & drop et le clic pour ouvrir le sélecteur de fichiers
- Utilise exclusivement des CSS variables (`var(--bg-elevated)`, `var(--border-primary)`, `var(--border-secondary)`, `var(--text-secondary)`, `var(--color-primary)`, etc.) — aucune couleur hardcodée
- Quand `value` est non vide : affiche l'aperçu de l'image + "Changer" / "Supprimer" au survol
- Quand `value` est vide : affiche la zone d'upload + URL en option secondaire
- "Supprimer" remet `value` à `''` (pas de suppression R2 en V1)

### Modifié : `src/components/funnels/config/HeroConfig.tsx`
- Remplace l'input URL de l'image de fond par `<ImageUploadField>`
- `funnelId` et `workspaceId` récupérés depuis le contexte de l'éditeur

### Modifié : `src/components/funnels/config/ImageConfig.tsx`
- Chaque slot photo utilise `<ImageUploadField>` à la place de l'input URL
- Bouton "+ Ajouter une photo" désactivé quand `photos.length >= 10`
- **Note :** merger `develop` avant implémentation — le type `FunnelImageBlockConfig` a probablement évolué vers un tableau `photos[]` en production

### Modifié : `src/app/api/storage/upload-url/route.ts`
- Ajout du paramètre `type: 'funnel'` + `funnelId`
- Path R2 généré : `workspaces/{workspaceId}/funnels/{funnelId}/{uuid}.webp`
- Auth et vérification workspace inchangées

---

## Stockage R2

### Path
```
workspaces/{workspaceId}/funnels/{funnelId}/{uuid}.webp
```

### Accès public
Les funnels sont des pages publiques (visiteurs non authentifiés). Les images doivent être lisibles sans token.

**Décision :** Configurer R2 pour accès public en lecture sur le préfixe `workspaces/*/funnels/*`. L'URL publique est stockée directement dans le champ `src` du block config.

**Comment configurer :** Dans le dashboard Cloudflare → R2 → le bucket → Settings → "Public access" → activer. Ou via `wrangler r2 bucket update <bucket> --public`. À faire une seule fois en production avant le premier déploiement.

Avantage : URL permanente, aucun SSR requis pour régénérer des tokens, compatible CDN Cloudflare.

### Suppression (V1)
Aucune suppression R2 déclenchée depuis le client. Quand l'utilisateur retire une image d'un bloc, l'objet reste dans R2. Job de nettoyage prévu en V2.

---

## Limites et validations

| Contrainte | Valeur | Appliquée où |
|---|---|---|
| Taille max fichier entrant | 15 Mo | Hook (avant compression) |
| Formats acceptés | JPG, PNG, WebP, GIF | Hook |
| Largeur max après compression | 1920 px | `browser-image-compression` |
| Qualité WebP | 80% | `browser-image-compression` |
| Images max par bloc galerie | 10 | ImageConfig (bouton désactivé) |

---

## Dépendance npm

```bash
npm install browser-image-compression
```

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `src/hooks/useImageUpload.ts` | Créé |
| `src/components/funnels/config/ImageUploadField.tsx` | Créé |
| `src/components/funnels/config/HeroConfig.tsx` | Modifié |
| `src/components/funnels/config/ImageConfig.tsx` | Modifié |
| `src/app/api/storage/upload-url/route.ts` | Modifié |
| `package.json` | `browser-image-compression` ajouté |

---

## Prérequis avant implémentation

1. Merger `develop` dans la branche feature (le type `FunnelImageBlockConfig` a probablement évolué vers un tableau `photos[]`)
2. Activer l'accès public R2 sur le bucket (Cloudflare dashboard → R2 → bucket → Settings → Public access, ou `wrangler r2 bucket update <bucket> --public`) — à faire une seule fois avant déploiement
3. Vérifier que la variable d'env `R2_PUBLIC_URL` (ou équivalent) expose l'URL publique du bucket dans le code
