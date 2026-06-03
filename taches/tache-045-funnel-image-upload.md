# Tâche 045 — Funnel : Upload d'images depuis l'ordinateur

**Développeur :** Rémy  
**Branche :** `feature/remy-sprint-planning-page` (intégrée avec l'éditeur funnel)  
**Date :** 2026-06-01  
**Statut :** ✅ Terminé (en attente du test manuel post-config R2)

---

## Objectif

Permettre aux coachs d'uploader des images directement depuis leur ordinateur dans l'éditeur de funnels — aussi bien dans le bloc **Image/galerie** (jusqu'à 10 photos) que pour l'**image de fond du bloc Hero**. Avant cette tâche, seules les URLs externes étaient acceptées.

---

## Spec

Spec brainstorming validée : `docs/superpowers/specs/2026-06-01-funnel-image-upload-design.md`

Décisions clés :
- Stockage Cloudflare R2 avec accès public permanent (pas de signed read URLs)
- Compression côté client via `browser-image-compression` : WebP, max 1920px, qualité 80%, skip si déjà < 200 Ko
- Limite 15 Mo avant compression, 10 images max par bloc galerie
- Pas de suppression R2 en V1 (job de nettoyage prévu en V2)

---

## Fichiers créés

| Fichier | Description |
|---------|-------------|
| `src/hooks/useImageUpload.ts` | Hook : validation, compression, upload R2 via presigned URL, progress XHR |
| `src/components/funnels/config/ImageUploadField.tsx` | Composant : 4 états (vide, uploading, rempli, erreur), drag & drop, URL fallback |

---

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/app/api/storage/upload-url/route.ts` | Ajout du type `funnel_image` : path R2 `workspaces/{wsId}/funnels/{funnelId}/{uuid}.webp`, retourne `public_url` |
| `src/components/funnels/config/HeroConfig.tsx` | Remplace input URL "Image de fond" par `<ImageUploadField>` |
| `src/components/funnels/config/ImageConfig.tsx` | Remplace input URL par `<ImageUploadField>` par slot photo, limite 10 images |
| `src/components/funnels/FunnelBlockConfig.tsx` | Propage `funnelId` vers HeroConfig et ImageConfig |
| `src/components/funnels/v2/FunnelBuilderV2.tsx` | Passe `funnelId={funnel.id}` à FunnelBlockConfigPanel |
| `package.json` | Ajout `browser-image-compression@^2.0.2` |

---

## Prérequis avant mise en production

1. **Configurer R2 Public Access** dans le dashboard Cloudflare :
   - R2 → bucket → Settings → Public access → Enable
   - Noter l'URL publique (ex : `https://pub-xxx.r2.dev`)
2. **Ajouter `R2_PUBLIC_URL`** dans `.env.local` ET dans Vercel (Settings → Environment Variables)

---

## Tâches liées

- `tache-028-funnels-v2.md` — builder V2 dans lequel s'insère ce feature
- `tache-028b-builder-ux.md` — UX du builder (multi-images déjà en place post-merge)
