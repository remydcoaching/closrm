# Migration storage R2 + Lifecycle posts + UX Frame.io

**Date** : 2026-05-07
**Auteur** : Pierre via Claude Code
**Cible** : remplacer Supabase Storage par Cloudflare R2 pour les vidéos, instaurer un lifecycle des posts, terminer la refonte UX type Frame.io

---

## Problème

3 problèmes cumulés découverts dans l'audit du 2026-05-07 :

1. **Coût Supabase Storage** : ~$0.021/GB stocké + $0.09/GB egress. Vidéos = poste de coût qui dérape vite, surtout l'egress (chaque review = data sortante facturée).
2. **Orphan accumulator** : le bucket `content-drafts` (250MB max par fichier) n'est jamais nettoyé. Aucun appel `storage.remove` lors de la suppression d'un post, jamais de cron de cleanup, pas de soft-delete sur `social_posts`. Tous les fichiers depuis le jour 1 sont encore là.
3. **UX du drawer** insuffisante : la preview vidéo en thumbnail compact (140px) ne donne pas l'impression Frame.io que demande Pierre. La review monteur ↔ coach demande un gros player visible.

## Non-objectifs

- Migrer les buckets `workspace-logos`, `avatars`, `workflow-assets` (ils restent sur Supabase — petits volumes, pas de problème de coût)
- Implémenter les annotations timestampées sur vidéo (Frame.io killer feature) — phase ultérieure
- Toucher au backend de publication Instagram/YouTube
- Refondre les buckets de média Instagram/YouTube (URLs externes, pas notre stockage)

## Solution — vue d'ensemble

| Sujet | Décision |
|---|---|
| Storage primaire vidéo | **Cloudflare R2** (région EU, bucket privé, path workspace-scoped) |
| Backup | **Backblaze B2** (sync nocturne, paranoïaque, ~$0.50/mois pour 100GB) |
| Accès vidéo client | **Signed URLs** TTL 1h via API ClosRM (pas d'URL publique) |
| Path pattern | `workspaces/{workspace_id}/posts/{post_id}/{file_uuid}.{ext}` |
| Lifecycle post | Hot tier tant que `status` ∈ {draft, scheduled, publishing} → après publication : hot 90j, cold 1 an, purge ou conserver selon choix workspace |
| Soft-delete | `social_posts.archived_at` ; cleanup R2 après 30j d'archive |
| UX drawer | 2 colonnes : form gauche / **gros player vidéo droit** quand média présent (~600px de hauteur) |

---

## Détail — Migration R2

### Architecture

```
┌──────────────────┐     upload via SDK S3     ┌─────────────────────┐
│  Browser ClosRM  │ ──────────────────────►   │  Cloudflare R2 EU   │
│ (PUT signed URL) │                            │ closrm-content-eu   │
└──────────────────┘                            └─────────────────────┘
        │                                                 │
        │  GET signed URL (TTL 1h)                        │ replication nocturne
        ▼                                                 ▼
   ┌─────────────────────────────────────┐    ┌─────────────────────┐
   │  ClosRM API (Next.js)               │    │  Backblaze B2 EU    │
   │  /api/storage/sign?path=...         │    │  closrm-backup-eu   │
   └─────────────────────────────────────┘    └─────────────────────┘
```

### Path pattern obligatoire

```
workspaces/{workspace_id}/posts/{post_id}/final-{uuid}.{ext}     ← montage final
workspaces/{workspace_id}/posts/{post_id}/media-{uuid}.{ext}     ← media de publication
```

Avantages :
- Suppression d'un workspace = `DELETE prefix workspaces/{wid}/`
- Suppression d'un post = `DELETE prefix workspaces/{wid}/posts/{pid}/`
- Audit facile par workspace (compter les bytes par préfixe)
- Scoping naturel pour signed URLs (signe sur le préfixe, pas un token global)

### Variables d'env à ajouter

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=closrm-content-eu
R2_PUBLIC_BASE_URL=https://r2.closrm.fr           # CNAME custom optionnel
R2_REGION=auto                                      # R2 ne respecte pas les régions S3 standard
B2_KEY_ID=...
B2_APPLICATION_KEY=...
B2_BUCKET=closrm-backup-eu
```

### Endpoints API ClosRM nouveaux

```
POST   /api/storage/upload-url
       Input  : { workspace_id, post_id, target: 'final' | 'media', filename, content_type, size }
       Output : { upload_url, public_path }   ← presigned PUT URL R2 + path à stocker en DB
       Auth   : RLS via session, vérifie workspace_id appartient à l'utilisateur, vérifie size ≤ 250MB

GET    /api/storage/sign
       Input  : ?path=workspaces/{wid}/posts/{pid}/final-xxx.mp4
       Output : { url }                       ← signed URL GET TTL 1h
       Auth   : vérifie l'utilisateur a accès au workspace via la table workspace_members

DELETE /api/storage/object
       Input  : { path }
       Output : { ok: true }
       Auth   : workspace owner uniquement
```

### Format DB

`social_posts.final_url` et `social_posts.media_urls[]` stockent maintenant le **path R2 relatif** (ex: `workspaces/abc/posts/def/final-xyz.mp4`), **pas l'URL complète**. Le client appelle `/api/storage/sign?path=...` pour récupérer une URL signée à usage unique.

Cette approche :
- Permet de changer de provider sans toucher la DB
- Autorise les signed URLs strictes (pas de fuite d'URL publique permanente)
- Supporte la rotation de clé sans invalider les paths

### Migration des données existantes

Script one-shot `scripts/migrate-supabase-to-r2.ts` :

1. Liste tous les `social_posts` où `final_url` ou `media_urls` contient `content-drafts/`
2. Pour chaque URL Supabase :
   - Download le fichier depuis Supabase Storage
   - Upload vers R2 au nouveau path workspace-scoped
   - Update la row DB pour pointer vers le nouveau path R2
3. Log les erreurs (fichier 404, etc.)
4. Garder les fichiers Supabase 30j après migration pour rollback, puis purge manuelle

Exécution : 1 batch en local, monitorer, idempotent (skip si déjà migré).

### Code à modifier

| Fichier | Changement |
|---|---|
| `src/lib/storage/r2-client.ts` | **NEW** : SDK S3 v3 configuré pour R2 |
| `src/lib/storage/b2-client.ts` | **NEW** : client B2 pour backup nocturne |
| `src/lib/storage/signing.ts` | **NEW** : helpers signed URL upload + GET |
| `src/app/api/storage/upload-url/route.ts` | **NEW** : POST presigned upload |
| `src/app/api/storage/sign/route.ts` | **NEW** : GET signed read URL |
| `src/app/api/storage/object/route.ts` | **NEW** : DELETE object |
| `src/components/social/planning/MontageStep.tsx` | replace `supabase.storage.from('content-drafts').upload` by R2 presigned PUT flow |
| `src/components/social/planning/PublicationStep.tsx` | idem |
| `src/components/social/instagram/IgDraftModal.tsx` | idem |
| `src/components/social/calendar/PostComposer.tsx` | idem |
| `src/app/api/social/posts/[id]/route.ts` (DELETE) | appel `r2.delete(prefix)` après suppression DB |
| `src/app/api/cron/cleanup-orphans/route.ts` | **NEW** : cron quotidien — supprime les fichiers R2 orphelins (paths sans row DB correspondante) |
| `src/app/api/cron/r2-to-b2-backup/route.ts` | **NEW** : cron nocturne — sync R2 → B2 |
| `supabase/migrations/0XX_post_archived_at.sql` | **NEW** : ajouter `archived_at TIMESTAMPTZ` à `social_posts` pour soft-delete |

### Sécurité

- **Bucket R2 privé par défaut** — aucune URL publique ne fonctionne sans signature
- **Signed URLs TTL 1h** — assez long pour un upload ou une review, expire avant qu'un lien fuité serve à autre chose
- **Vérification serveur de la taille déclarée** — l'API `/upload-url` reject si > 250 MB
- **Vérification workspace_id côté API** — l'utilisateur ne peut signer que sur ses propres workspaces
- **CORS R2** : `Access-Control-Allow-Origin: closrm.fr` (et localhost en dev), pas de wildcard

---

## Détail — Lifecycle des posts

### États possibles

```
                    ┌──────────────────┐
            ┌──────►│  status: draft   │ ──┐
            │       └──────────────────┘   │
   create   │                              │ user delete
            │       ┌──────────────────┐   │
            │       │ status:scheduled │ ──┤
            │       └──────────────────┘   │
            │                              │
            │       ┌──────────────────┐   │
            │       │status:publishing │ ──┤
            │       └──────────────────┘   │
            │                              │
            │       ┌──────────────────┐   │
            └──────►│ status:published │ ──┘
                    └──────────────────┘   │
                            │              ▼
                            │      ┌─────────────────┐    purge after 30j
                            └─────►│  archived_at    │ ───────────────────► HARD DELETE row + R2 prefix
                                   │  IS NOT NULL    │
                                   └─────────────────┘
```

### Comportement après publication

Une fois `status = 'published'` :
- **Le post reste indéfiniment** dans la DB (analytics, historique, KPIs)
- **Le fichier vidéo R2 reste accessible** indéfiniment par défaut
- L'utilisateur peut soft-delete (cliquer "Archiver" → set `archived_at = NOW()`)
- À J+30 d'archive, un cron purge le post + supprime le préfixe R2 du post

### Cron nightly — `cleanup-archived`

```
SELECT id, workspace_id FROM social_posts
WHERE archived_at IS NOT NULL AND archived_at < NOW() - INTERVAL '30 days';
```

Pour chaque row :
1. `r2.deleteObjects(prefix='workspaces/{wid}/posts/{id}/')`
2. `b2.deleteObjects(prefix='workspaces/{wid}/posts/{id}/')` (backup aussi)
3. `DELETE FROM social_posts WHERE id = X`

### Cron nightly — `cleanup-orphans` (paranoid)

Filets de sécurité au cas où une suppression DB ait raté la suppression R2 :

```
list R2 prefixes 'workspaces/'
for each post path:
  if no matching row in social_posts → delete
```

Tourne 1× par semaine, pas tous les jours.

### Quotas (optionnel — workspace settings)

```sql
ALTER TABLE workspaces ADD COLUMN storage_quota_bytes BIGINT DEFAULT 53687091200;  -- 50 GB par défaut
ALTER TABLE workspaces ADD COLUMN storage_used_bytes BIGINT DEFAULT 0;
```

Trigger DB qui maintient `storage_used_bytes` à jour à chaque upload/delete. Affichage dans Réglages → Stockage avec bar de progression. Si quota dépassé, l'API `/upload-url` reject.

À implémenter en phase 2, pas dans ce spec.

---

## Détail — UX Frame.io style (drawer 2 colonnes)

### Layout actuel à remplacer

Aujourd'hui le contenu de l'étape (Brief / Montage / Publication) est en **1 colonne** dans un modal de 1100px. Le video preview est dans la colonne (thumbnail 140px). C'est le pain point cité par Pierre.

### Nouveau layout

Le **shell drawer** orchestre 2 zones côte à côte quand l'étape active a un média associé :

```
┌─────────────────────────────────────────────────────────────────────┐
│ [pillar][kind] Title                       date  [del] [×]          │
├─────────────────────────────────────────────────────────────────────┤
│ ●─────●─────● Brief / Montage / Publication                         │
├─────────────────────┬───────────────────────────────────────────────┤
│                     │                                                │
│  Form de l'étape    │         Big media preview                      │
│  active             │         (video player full)                    │
│                     │                                                │
│  ~ 420px             │         flex 1 (~620px sur modal 1100)        │
│                     │                                                │
│  - hook             │         ┌───────────────────┐                  │
│  - script           │         │                   │                  │
│  - références       │         │   <video controls>│                  │
│  - notes            │         │   9:16 ou 16:9    │                  │
│                     │         │                   │                  │
│  [transition btn]   │         └───────────────────┘                  │
│                     │                                                │
├─────────────────────┴───────────────────────────────────────────────┤
│ 💬 Discussion · @monteur · 3 non lus                              ▼ │
└─────────────────────────────────────────────────────────────────────┘
```

### Règles d'affichage du panel droit

```ts
const mediaToShow = (() => {
  if (slot.final_url) return { url: slot.final_url, kind: 'video' }
  if (slot.media_urls?.[0]) {
    const first = slot.media_urls[0]
    return { url: first, kind: /\.(mp4|mov|webm)/i.test(first) ? 'video' : 'image' }
  }
  if (slot.rush_url) return { url: slot.rush_url, kind: 'link' }
  return null
})()
```

- Si `mediaToShow === null` → drawer en **1 colonne** (comme aujourd'hui), modal max 720px
- Sinon → drawer en **2 colonnes**, modal max 1100px
- Le panel droit est **sticky** : ne scrolle pas avec le formulaire à gauche
- Le video player utilise `aspectRatio: auto` pour s'adapter (9:16 vertical, 16:9 horizontal)

### Composant `MediaPreviewPane`

Nouveau composant `src/components/social/planning/MediaPreviewPane.tsx` :

```tsx
interface MediaPreviewPaneProps {
  url: string
  kind: 'video' | 'image' | 'link'
}
```

- `video` : `<video src controls preload="metadata">` plein écran du panel
- `image` : `<img>` cover
- `link` : embed type "ouvrir dans un onglet" + métadonnées extraites si possible (Drive thumbnail, etc.)

Le component gère sa propre signed URL : reçoit le path R2, appelle `/api/storage/sign?path=` pour récupérer l'URL playable.

### Adaptation des Step components

`MontageStep` et `PublicationStep` perdent leur logique de preview vidéo interne (déjà partiellement fait pour MontageStep le 2026-05-06 21h). Reste à :
- Retirer le video preview de `MontageStep` complètement
- Retirer le `MediaThumbnails` de `PublicationStep` (ou le garder en mini-vignette si plusieurs medias, mais le principal reste à droite)

`BriefStep` ne change pas (Brief n'a pas de média).

---

## Plan de tests

### R2 migration
1. Setup R2 bucket + B2 bucket avec credentials test
2. Upload un fichier via le nouveau flow (presigned PUT) → vérifier qu'il arrive dans R2
3. Récupérer l'URL signed → vérifier que la vidéo se lit dans le drawer
4. Sans signature → vérifier 403
5. Migration script sur 5 posts test → vérifier que les URLs DB sont à jour
6. Cleanup orphan : créer un fichier R2 sans row DB → vérifier qu'il est supprimé au prochain cron

### Lifecycle
7. Créer un post + upload vidéo → archived_at IS NULL → fichier R2 présent
8. Soft-delete le post → archived_at set → fichier R2 toujours présent
9. Forcer le cron `cleanup-archived` avec interval 0 → row deleted, prefix R2 vide

### UX 2 colonnes
10. Ouvrir un slot sans média → 1 colonne, modal 720px
11. Uploader une vidéo → drawer passe en 2 colonnes, player gros à droite
12. Switch d'étape Montage → Publication : le panel droit reste, le formulaire à gauche change
13. Resize fenêtre étroite (<900px viewport) → drawer revient en 1 colonne (responsive fallback)
14. Discussion footer : reste en bas full-width

---

## Risques

- **Migration data** : 100% des posts existants pointent vers `content-drafts`. Si le script de migration foire à mi-parcours, états mixtes. **Mitigation** : script idempotent + dry-run mode + transaction par row.
- **Coût caché R2** : les opérations Class A (PUT, COPY, POST, LIST) sont à $4.50 par million. Pour ClosRM, négligeable (quelques milliers de requêtes/mois). Mais à monitorer si le volume explose.
- **CORS R2** : oubli des origines = uploads 404. Test obligatoire en dev avant prod.
- **Backup B2 cost runaway** : si le sync recopie tout chaque nuit au lieu de différentiel, ça coûte cher en API calls. **Mitigation** : utiliser `rclone` ou un diff `mtime` pour ne sync que les nouveautés.
- **Soft-delete oublié** : les utilisateurs cliquent "Supprimer" pensant que c'est immédiat. **Mitigation** : modale claire "Archivé pendant 30 jours, vous pouvez restaurer".

---

## Phases d'implémentation

### Phase A — UX Frame.io 2 colonnes (rapide, immédiat)

Ne touche pas au storage. Améliore tout de suite la perception utilisateur.

1. Créer `MediaPreviewPane.tsx` (gère url + kind + lazy load video)
2. Modifier `SlotDetailDrawer.tsx` : flex row avec form gauche + pane droit conditionnel
3. Retirer le mini-thumbnail de `MontageStep.tsx`
4. Test manuel sur un slot existant

**Effort** : 2-3 heures.

### Phase B — Storage R2 (gros chantier)

1. Setup compte R2 + B2 + credentials → variables d'env
2. Créer `r2-client.ts` + helpers `signing.ts`
3. API routes `upload-url`, `sign`, `object`
4. Modifier `MontageStep` + `PublicationStep` + `IgDraftModal` + `PostComposer` pour utiliser le nouveau flow
5. Migration script : `scripts/migrate-supabase-to-r2.ts`
6. Lancer en dry-run, vérifier, lancer en prod
7. Crons : `cleanup-archived` + `cleanup-orphans` + `r2-to-b2-backup`
8. Migration : ajouter `archived_at` sur `social_posts`
9. Logique soft-delete : DELETE endpoint set `archived_at` au lieu de hard-delete
10. UI : "Archiver" remplace "Supprimer" dans le drawer + page imports

**Effort** : 2-3 jours full-time.

### Phase C — Lifecycle & quotas (optionnel)

1. Réglages workspace : afficher le storage utilisé
2. Quotas par plan d'abonnement
3. Notifications 80% / 100% du quota
4. Page d'archives où l'utilisateur peut restaurer un post archivé < 30j

**Effort** : 1 jour. À faire après B.

---

## Ordre d'exécution suggéré

1. **A → B → C** dans l'ordre, chacun déployable indépendamment.
2. Phase A en localhost en quelques heures pour résoudre la frustration UX immédiate.
3. Phase B planifiée sur 2-3 jours dédiés (compte R2 + tests + migration data).
4. Phase C selon besoin remonté par les utilisateurs.

Coût mensuel cible après migration complète :
- 100GB stockage R2 : ~$1.50
- Backup B2 100GB : ~$0.50
- Egress signed URLs (estimation 200GB/mois) : **$0**
- **Total : ~$2/mois** au lieu des $25-40 actuels Supabase Pro.
