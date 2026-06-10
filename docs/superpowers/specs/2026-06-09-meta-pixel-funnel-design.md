---
name: meta-pixel-funnel
description: Intégration du Meta Pixel (Facebook Pixel) par funnel — injection côté public + UI de configuration dans le builder + events automatiques (PageView, Lead, Schedule)
metadata:
  type: project
---

# Meta Pixel par funnel

## Objectif

Permettre au coach de connecter son pixel Meta à chacun de ses tunnels de vente. En entrant son Pixel ID dans l'éditeur, les pages publiques injectent automatiquement le script Meta et déclenchent les events standard — ce qui permet à Meta d'optimiser les campagnes et de construire des audiences de retargeting.

## Contexte

L'application dispose déjà d'un système de tracking interne (`FunnelTracker`, `/api/public/f/events`) qui mesure les vues, clics CTA et vidéo pour les stats internes. Le pixel Meta est un système parallèle, indépendant, qui envoie les mêmes signaux directement à Meta.

**Inspiration :** UpTrainer (section "Tracking & Pixels" dans le panneau de réglages du funnel, identique à ce qui est demandé).

## Périmètre

### Inclus
- Champ Pixel ID (par funnel) dans le builder
- Injection du script Meta sur les pages publiques
- Events automatiques : `PageView`, `Lead`, `Schedule`
- Guide intégré dans l'éditeur

### Exclus
- Event `Purchase`
- Events personnalisables par le coach
- Meta Conversions API (CAPI) côté serveur

## Architecture

### 1. Base de données

Migration `083_funnel_meta_pixel.sql` :

```sql
ALTER TABLE funnels ADD COLUMN meta_pixel_id TEXT;
```

Nullable. Aucun index nécessaire (jamais requêté en WHERE).

### 2. API — `GET /api/funnels/[id]` et `PATCH /api/funnels/[id]`

- `GET` : ajouter `meta_pixel_id` dans la clause `select()`
- `PATCH` : accepter `meta_pixel_id` dans le body (TEXT, pas de validation stricte — on stocke tel quel, le coach est responsable de la valeur)

### 3. Éditeur — nouveau composant `TrackingPanel`

Fichier : `src/components/funnels/v2/sidebar/TrackingPanel.tsx`

Section collapsible (ouverte par défaut) dans la sidebar gauche du builder, positionnée **sous** DirectionArtistiquePanel et SectionsListPanel.

**Contenu :**
- Header : "TRACKING & PIXELS" avec chevron toggle
- Champ : label "Facebook Pixel ID", input texte, placeholder "Ex: 123456789012345"
- Accordéon "Guide" (replié par défaut) avec le texte d'aide :
  1. Aller dans Meta Events Manager
  2. Cliquer "Connecter des sources de données → Web"
  3. Choisir "Meta Pixel"
  4. Copier l'ID (nombre à 15 chiffres)
  5. Coller dans le champ ci-dessus
  - Mentions des events qui se déclenchent : PageView, Lead, Schedule

**Props :**
```ts
interface Props {
  metaPixelId: string | null
  onMetaPixelChange: (pixelId: string | null) => void
}
```

La valeur est sauvegardée via debounce (1s) dans le parent, identique au pattern de DirectionArtistiquePanel.

### 4. Intégration dans le builder

`FunnelBuilderV2.tsx` :
- Ajout de `meta_pixel_id: string | null` dans la prop `funnel`
- Ajout d'un callback `onMetaPixelChange: (pixelId: string | null) => void`
- Rendu de `<TrackingPanel>` en bas de la sidebar gauche

`acquisition/funnels/[id]/page.tsx` :
- Ajout de `meta_pixel_id` dans `FunnelData`
- Handler `handleMetaPixelChange` → PATCH vers `/api/funnels/[id]` avec `{ meta_pixel_id: value || null }`
- L'autosave existant n'est pas réutilisé ici car `meta_pixel_id` n'est pas dans le même état que les blocs — on utilise un PATCH direct avec debounce.

### 5. Injection sur la page publique

`app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` :

1. `loadFunnelPageData` : ajouter `meta_pixel_id` dans la requête `funnels` → retourner dans `PageData`
2. Dans le composant `PublicFunnelPage`, si `meta_pixel_id` est défini :

```tsx
import Script from 'next/script'

// Dans le return, avant </> :
{metaPixelId && (
  <Script
    id="meta-pixel"
    strategy="afterInteractive"
  >{`
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${metaPixelId}');
    fbq('track', 'PageView');
  `}</Script>
)}
```

`PageView` est inclus dans le script de base → déclenché automatiquement à chaque chargement de page.

### 6. Event `Lead` — FormBlock

`src/components/funnels/blocks/FormBlock.tsx` :

Après le `await fetch('/api/public/f/submit', ...)` réussi, avant `setSubmitted(true)` :

```ts
window.fbq?.('track', 'Lead')
```

La fonction `fbq` est optionnellement chaînée (`?.`) — si le pixel n'est pas chargé (pas de Pixel ID configuré, ou adblock), l'appel est silencieusement ignoré.

### 7. Event `Schedule` — BookingBlock

`src/components/funnels/blocks/BookingBlock.tsx` :

Après la confirmation d'un booking (succès API), ajouter :

```ts
window.fbq?.('track', 'Schedule')
```

Même pattern que FormBlock.

## Déclaration TypeScript globale

Pour éviter les erreurs TypeScript sur `window.fbq` :

```ts
// src/types/globals.d.ts (à créer ou compléter)
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}
```

## Comportement attendu

| Situation | Comportement |
|-----------|-------------|
| Pixel ID non configuré | Aucun script injecté, aucun event envoyé |
| Pixel ID configuré | Script fbq injecté, `PageView` au chargement |
| Formulaire soumis avec succès | `Lead` envoyé à Meta |
| Booking confirmé | `Schedule` envoyé à Meta |
| Ad blocker actif | Events bloqués (~20-30% des visiteurs, comportement normal) |
| Pixel ID incorrect | Meta reçoit les events mais les rejette — visible dans Events Manager |

## Fichiers créés / modifiés

| Fichier | Type |
|---------|------|
| `supabase/migrations/083_funnel_meta_pixel.sql` | Nouveau |
| `src/components/funnels/v2/sidebar/TrackingPanel.tsx` | Nouveau |
| `src/components/funnels/v2/FunnelBuilderV2.tsx` | Modifié |
| `src/app/(dashboard)/acquisition/funnels/[id]/page.tsx` | Modifié |
| `src/app/api/funnels/[id]/route.ts` | Modifié |
| `src/app/f/[workspaceSlug]/[funnelSlug]/[pageSlug]/page.tsx` | Modifié |
| `src/components/funnels/blocks/FormBlock.tsx` | Modifié |
| `src/components/funnels/blocks/BookingBlock.tsx` | Modifié |
| `src/types/globals.d.ts` | Nouveau (ou modifié) |

## Tâche associée

Tache N° suivante dans la numérotation séquentielle globale (à vérifier dans `taches/`).
