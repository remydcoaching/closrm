# M1 — ClosRM Desktop (Electron) : implémentation

Statut : **code du vertical slice écrit, non exécuté dans cette session** (contrainte de budget de session signalée en cours de route — voir §"Ce qui n'a pas pu être vérifié"). Aucune modification de la base Next.js/Supabase existante, aucune migration, aucune suppression. Le web (`closrm.fr`) et l'app mobile ne sont touchés par aucun changement de ce commit.

## 1. Ce qui a été construit

Un nouveau dossier racine `electron/` (package séparé, son propre `package.json`, aucune dépendance du repo Next.js modifiée) :

```
electron/
├── package.json, tsconfig.json, vite.config.ts, .env.example, .gitignore
├── main/index.ts          — fenêtre, deep link closrm://, CSP, secure storage (IPC)
├── preload/index.ts       — contextBridge minimal : onDeepLink, secureStorage
└── renderer/
    ├── index.html
    └── src/
        ├── main.tsx, app/App.tsx (routing), app/DashboardLayout.tsx
        ├── design-system/  — tokens.css, Button, Card, Badge, Avatar, Input, Sidebar, States
        ├── features/auth/LoginPage.tsx
        ├── features/leads/  — LeadsListPage, LeadDetailPage, LeadCreatePage, types.ts
        └── lib/  — supabase.ts, secure-session-storage.ts, auth-context.tsx, api-client.ts, electron-bridge.d.ts
```

## 2. Architecture réalisée

```
Electron (renderer, Vite+React, HashRouter)
  → AuthProvider (Supabase JS SDK, flowType: pkce, storage = secureSessionStorage)
  → login : signInWithOtp (magic link email) — PAS signInWithPassword
  → deep link closrm://auth-callback?code=... capté par le main process → IPC → renderer
  → exchangeCodeForSession(code) → session Supabase
  → session persistée via IPC vers le main process → safeStorage (Keychain/Credential Manager) → fichier local chiffré
  → api-client.ts ajoute Authorization: Bearer <access_token> à chaque requête
  → appelle l'API Next.js EXISTANTE (GET/POST /api/leads, GET/PATCH /api/leads/:id)
  → Next.js: getWorkspaceId() accepte déjà ce Bearer (mécanisme déjà utilisé par l'app mobile — AUCUN changement backend)
  → Supabase (RLS, source de vérité) — inchangé
```

## 3. M1B — Authentification : décision prise en cours de route (documentée, pas improvisée)

La mission demandait un "code d'échange à usage unique" plutôt qu'un JWT en clair dans le deep link. En vérifiant la documentation Supabase (via Context7) avant d'écrire le code plutôt que de deviner, il est apparu que **le flux PKCE natif de Supabase pour un deep link custom repose sur un magic link envoyé par email (`signInWithOtp`), pas sur le login email/mot de passe actuel du web** (`signInWithPassword`). Faire fonctionner un login password avec un code à usage unique aurait nécessité soit de transmettre un refresh token en clair dans l'URL (exactement ce que la mission voulait éviter), soit une nouvelle route ClosRM avec stockage serveur d'un code de pairing (changement de backend plus lourd, hors périmètre M1 sans validation préalable).

**Point soumis à validation avant d'être codé** (conformément à la règle "STOP avant tout auth breaking change") : confirmé — magic link email retenu. C'est un changement d'UX de connexion réel (email + clic sur un lien, pas de mot de passe tapé dans Electron) par rapport au web, mais :
- Zéro changement au login password web existant (`src/app/(auth)/login/page.tsx` non touché).
- Zéro nouvelle route API ClosRM, zéro nouvelle table, zéro migration.
- `shouldCreateUser: false` : ce flux ne peut pas créer de compte, seulement connecter un compte existant — l'inscription reste exclusivement sur le web.

**Stockage de session** : `secureSessionStorage` (`electron/renderer/src/lib/secure-session-storage.ts`) redirige les lectures/écritures de session Supabase vers `window.closrm.secureStorage`, qui appelle par IPC le main process, lequel chiffre via `safeStorage` d'Electron (Keychain macOS / Credential Manager Windows / libsecret Linux) et écrit dans un fichier sous `app.getPath('userData')` — jamais `localStorage`, jamais en clair, jamais loggé.

## 4. M1C — API : aucun changement backend nécessaire, un point bloquant identifié (CORS)

Vérifié dans le code existant : `GET/POST /api/leads`, `GET/PATCH /api/leads/[id]`, `GET /api/auth/me` utilisent déjà `getWorkspaceId()` qui accepte un header `Authorization: Bearer <jwt>` — mécanisme déjà en place pour l'app mobile Expo. **Zéro ligne backend modifiée.**

**Point bloquant identifié, non corrigé dans cette session** (changement de configuration backend partagée — signalé plutôt que modifié sans validation, conformément à la règle de travail) : aucune configuration CORS n'existe dans le repo (`grep` sur `middleware.ts`, `next.config.ts`, routes API — rien trouvé). En développement, le renderer Electron tourne sur l'origine du serveur Vite (`http://localhost:5173` typiquement) et appelle `http://localhost:3000` — **une requête cross-origin que Chromium (moteur d'Electron) bloquera par défaut sans en-têtes CORS explicites côté Next.js**. C'est un prérequis à corriger en tout début de M2 (ajout d'en-têtes CORS scopés, à discuter : soit globalement sur `/api/*`, soit seulement quand l'origine correspond au renderer Electron packagé) — non fait ici pour ne pas toucher au backend partagé sans confirmation explicite.

## 5. M1D — Module Leads : vertical slice minimal

- **Liste** (`LeadsListPage.tsx`) : `GET /api/leads?per_page=50`, affichage avatar/nom/contact/statut.
- **Détail + modification** (`LeadDetailPage.tsx`) : `GET /api/leads/:id`, formulaire minimal (prénom, nom, téléphone, email, notes), `PATCH /api/leads/:id` à l'enregistrement.
- **Création** (`LeadCreatePage.tsx`) : `POST /api/leads`, redirige vers la fiche créée.
- **Pas portés délibérément** (hors scope M1, mission explicite) : recherche/filtres avancés, vues multiples, import CSV, tags, assignation, workflow inline, tout ce qui vit dans les ~15 autres composants `src/components/leads/*.tsx` du web actuel.

## 6. M1E — Design system : construit à partir des tokens réels Insyder (référence, jamais copiés)

Suite à l'information transmise en cours de session (analyse directe du CSS compilé d'Insyder), `tokens.css` a été reconstruit avec les vraies valeurs de référence fournies (couleurs, familles de police), et non plus une simple "inspiration Instagram" générique :

- **Accent** : `#c837ab` / `#f261d5`, gradient Instagram 5 couleurs (`#ffdd55 → #ff994a → #f24962 → #d6249f → #c837ab`).
- **Surfaces claires** : blanc, `#f7f7f8`, `#f2f1f2`, `#edf0f4`.
- **Texte** : `#171b20` (primaire), `#4a4e55`/`#6b6f76`/`#8a8e96` (secondaire/tertiaire/muted).
- **Bordures** : `rgba(20,20,30,.09)` / `.16`, tels quels.
- **Typographie** : `IBM Plex Sans` en police principale d'UI, `IBM Plex Mono` réservée aux contenus numériques (classe utilitaire `.font-mono`, pas encore appliquée dans les écrans Leads M1 — aucun montant/donnée chiffrée dense n'y figure pour l'instant). Clash/Satoshi **non intégrés** : réservés à un futur passage branding/marketing, jamais nécessaires pour l'UI CRM elle-même.
- **Rayons** généreux (`--radius-lg: 18px`, `--radius-xl: 28px`), dans l'esprit d'un langage arrondi de référence — valeurs choisies indépendamment, pas mesurées pixel-perfect sur un écran Insyder.

**Aucun fichier, classe CSS, nom de composant ou asset Insyder n'a été copié.** Seules des valeurs de tokens (couleurs, familles de police) — non protégeables comme du code — ont servi de point de référence pour construire des primitives ClosRM entièrement nouvelles, avec leurs propres noms de classes (`ds-*`) et leur propre structure.

Composants livrés : `Button`, `Card`, `Badge`, `Avatar`, `Input`/`Textarea`, `Sidebar`, `LoadingState`/`ErrorState`/`EmptyState`. Non livrés en M1 (à ajouter au fil des futurs modules) : tableau/liste dense générique, modales, table de données paginée.

## 7. M1G — Sécurité Meta : audit fait, aucun risque trouvé

Les 5 fichiers `.tsx` identifiés en Phase 4 (`AdCreativePanel.tsx`, `FormBlock.tsx`, `BookingBlock.tsx`, `MetaEventPicker.tsx`, `TrackingPanel.tsx`) ont été relus précisément :
- 4 sur 5 importent uniquement des **types TypeScript** (`import type {...}`) — effacés à la compilation, aucun code exécutable bundlé.
- Le seul import de valeur (`resolveMetaEvent`, depuis `src/lib/meta/funnel-events.ts`) provient d'un fichier **statique** : un catalogue d'étiquettes UI et une fonction pure, sans `process.env`, sans appel réseau, sans dépendance vers `client.ts`/`capi.ts` (les fichiers qui contiennent `META_APP_SECRET`).

**Conclusion : aucun secret Meta ne fuit côté client dans le web actuel.** Rien à corriger avant de réutiliser ce type de composant plus tard.

## 8. Réutilisation vs. réécriture (M1F)

Comme anticipé dans le plan de migration : le design system étant entièrement nouveau (M1E), et le composant Leads existant (`leads-client.tsx`, 449 lignes, couplé à `next/navigation`/`next/dynamic`/un contexte de config workspace) trop lourd pour un vertical slice minimal, les écrans Leads M1 ont été **réécrits sobrement** plutôt que portés — mais la **logique d'appel API et les schémas de champs** (types `Lead`, contrat `createLeadSchema`/`updateLeadSchema` côté serveur) ont été repris tels quels, aucune règle métier réinventée. Ceci est cohérent avec le plan : la réutilisation porte sur le contrat et les schémas, pas nécessairement sur le JSX visuel puisque le design change entièrement.

## 9. Ce qui n'a pas pu être vérifié dans cette session

**Point important à ne pas glisser sous le tapis** : `npm install` et un lancement réel (`npm run dev`) n'ont pas été exécutés dans cette session (contrainte de budget de session signalée par l'utilisateur en cours de route). Le code a été écrit avec le plus grand soin de cohérence (imports, types, structure Vite/electron-builder standard), mais **aucune des commandes ci-dessous n'a été testée en conditions réelles**. Il est probable qu'un premier `npm install && npm run dev` révèle des ajustements mineurs (versions de dépendances à aligner, config Vite/electron-vite à affiner) — c'est attendu pour un premier scaffold, pas un signe d'erreur de conception.

## 10. Commandes pour lancer (à valider)

```bash
cd electron
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # attendu : fenêtre Electron + Vite HMR
```

Prérequis côté web : `npm run dev` sur le repo Next.js principal (port 3000) pour que l'API réponde — et **corriger le point CORS (§4) avant que le premier appel API ne fonctionne réellement**, sans quoi le premier `fetch` échouera silencieusement côté renderer.

## 11. Build (à valider)

```bash
cd electron
npm run build   # tsc + vite build + electron-builder (cible mac dmg par défaut, voir package.json)
```

Signature/notarisation macOS **non configurées** (hors scope M1 par la mission elle-même) — le DMG produit ne sera pas installable sans avertissement Gatekeeper au-delà du poste de développement local.

## 12. Tests

**Non exécutés dans cette session** (même contrainte que §9). Aucun test automatisé n'a été écrit pour ce vertical slice — la mission listait un minimum (démarrage Electron, contextIsolation, flow auth, appel API authentifié, CRUD Leads, 401) qui reste à couvrir avant de considérer M1 clos. C'est la limite la plus importante de cette livraison : **le code existe, sa correction en conditions réelles n'est pas prouvée.**

Test manuel demandé par la mission (§M1K) — **à exécuter, pas fait ici** :
1. `npm install && npm run dev` (electron/) + `npm run dev` (repo principal)
2. Se connecter (email → lien magic link → clic → retour dans Electron)
3. Arriver sur `/leads`
4. Ouvrir un lead existant, le modifier, enregistrer
5. Créer un nouveau lead
6. Rafraîchir (Cmd+R) et vérifier la persistance
7. Se déconnecter, se reconnecter

## 13. Problèmes rencontrés / décisions prises en cours de route

- **Flux d'auth** : magic link plutôt que password+deep-link — décision soumise et validée avant implémentation (§3).
- **CORS** : bloquant identifié, non corrigé (changement de backend partagé, signalé pour validation avant M2 plutôt que modifié unilatéralement).
- **Design tokens** : mis à jour en cours de route suite à la transmission des vraies valeurs CSS Insyder — reconstruits à partir de ces références, sans copie de code.
- **Contrainte de budget de session** : a interrompu le cycle normal "écrire → `npm install` → lancer → corriger → tester" avant sa complétion — documenté explicitement plutôt que de prétendre à un M1 validé de bout en bout.

## 14. Ce qui doit être fait pour M2 (mis à jour)

1. **Exécuter réellement** `npm install`/`npm run dev`/`npm run build` et corriger ce qui ne fonctionne pas au premier essai (attendu).
2. **Corriger le CORS** côté Next.js pour autoriser l'origine du renderer Electron (dev : `localhost:5173` ; prod packagée : à définir, probablement un scheme `app://` custom une fois hors dev).
3. Écrire les tests listés en §12 (aucun n'existe encore).
4. Exécuter le test manuel end-to-end décrit en §12.
5. Configurer `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` réels et vérifier que `signInWithOtp` + le deep link fonctionnent de bout en bout sur un compte de test.
6. Vérifier que le Redirect URL `closrm://auth-callback` est bien allow-listé dans les paramètres Supabase Auth du projet (`hsnqmjsckekbmmwneybb`) — sinon Supabase refusera la redirection.
7. Reprendre la roadmap M2+ du plan de migration une fois ces points fermés.
