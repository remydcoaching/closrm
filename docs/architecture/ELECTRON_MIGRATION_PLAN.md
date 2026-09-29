# Plan de migration ClosRM Web → Electron-first

Décision produit prise (non remise en cause dans ce document) : ClosRM devient une application desktop Electron-first. `closrm.fr` reste le site marketing/inscription/téléchargement/gestion de compte. Toute l'expérience CRM quotidienne migre vers l'app desktop. Ce document est un plan — aucun code n'a été écrit, aucune migration DB appliquée, aucune modification de production.

## 1. Executive Summary

ClosRM est aujourd'hui un monolithe Next.js 16 (App Router) + Supabase, avec **~270 routes API**, **0 Server Action**, **0 React Query/SWR** (fetch direct + Server Components), un **middleware d'auth déjà compatible Bearer token** (construit pour l'app mobile Expo existante), et **106 migrations Supabase**. Le point le plus déterminant de cet audit : **ClosRM a déjà un second client de production consommant son API via Bearer token — l'app mobile React Native**. C'est la preuve vivante que l'architecture backend actuelle supporte déjà un client "non-navigateur-web", ce qui réduit fortement le risque technique de la migration Electron côté auth/API.

Le reste de la complexité vient d'ailleurs : ~340 fichiers `'use client'`, un layout dashboard qui dépend de Server Components (fetch DB direct + `force-dynamic`), un `middleware.ts` Next.js qui porte toute la logique de gate d'accès, et un ratio non négligeable de code métier UI (leads, DM sessions, agenda, funnels, emails) largement réutilisable tel quel s'il est extrait de son enveloppe Next.js.

**Recommandation d'architecture** (détaillée en §3) : **Electron + Vite + React** pour le renderer, consommant l'API Next.js existante (conservée et déployée sur Vercel comme aujourd'hui, devenant un backend API pur) via HTTP + Bearer token — le même mécanisme que le mobile. Pas de Next.js dans Electron : Next.js sert de backend, pas de renderer.

## 2. Current Architecture

```
Vercel (Next.js 16, App Router)
├── src/app/(auth)/          — login, register, reset-password
├── src/app/(dashboard)/     — CRM complet (~25 sous-domaines : leads, agenda, closing,
│                              follow-ups, acquisition/*, parametres/*, finance, équipe...)
├── src/app/api/             — ~270 routes API (leads, calls, agenda, instagram, meta,
│                              hiker, apify, emails, workflows, billing, wallet, storage,
│                              notifications, cron, webhooks...)
├── src/middleware.ts        — auth gate + role gate ("monteur"), skip volontaire sur /api/*
├── src/lib/supabase/        — server.ts (Bearer-aware), service.ts, get-workspace.ts
└── src/lib/{meta,instagram,hiker,apify,billing,email,push,storage,whatsapp}/

Supabase (Postgres + Auth + RLS + pg_cron)
├── 106 migrations
└── pg_cron + pg_net → déclenche des routes /api/cron/* (booking-reminders, social-posts, apify-instagram)

Cloudflare R2 (stockage fichiers, compatible S3)
AWS SES/SNS (emails), Expo Push API (notifications mobile)

Mobile (Expo + bare RN, déjà en production)
└── Consomme la même API Next.js via Authorization: Bearer <jwt>
```

**Ce qui compte le plus pour la migration** : le dashboard actuel repose sur un mélange de Server Components (auth + fetch initial) et de Client Components qui font `fetch('/api/...')`. Il n'y a pas de Server Actions à réécrire — tout passe déjà par des routes API HTTP classiques, ce qui est exactement le modèle dont un renderer Electron a besoin.

## 3. Target Architecture

```
ClosRM
│
├── closrm.fr (Next.js, conservé, réduit progressivement)
│   ├── landing / pricing
│   ├── signup / login (redirige vers téléchargement de l'app une fois connecté)
│   ├── download (macOS / Windows)
│   └── account / billing (facturation, gestion abonnement)
│
├── ClosRM Desktop (Electron + Vite + React)
│   ├── main/          — process principal : fenêtres, IPC, auto-update, deep links, tray
│   ├── preload/        — contextBridge exposant une API minimale et typée au renderer
│   ├── renderer/       — l'app React (CRM : leads, DM sessions, agenda, analytics, settings...)
│   ├── background/     — tâches locales (notifications desktop, polling léger, DM session reminders)
│   └── instagram-webview/  — <webview> Instagram authentifiée (Phase Instagram privé, non construite ici)
│
└── Cloud (inchangé dans son rôle, adapté dans son usage)
    ├── Next.js API routes (déployées sur Vercel, deviennent le backend HTTP pur)
    ├── Supabase (Postgres, Auth, RLS, pg_cron) — source de vérité, inchangée
    ├── Meta / Hiker / Apify — restent appelés exclusivement depuis les routes API (jamais depuis Electron)
    ├── Webhooks (Meta, Instagram, SES) — restent côté cloud, aucune raison de les déplacer
    └── Cron jobs (Vercel Cron + pg_cron) — restent côté cloud
```

**Principe directeur, respecté strictement** : Electron est un **client HTTP enrichi**, pas un second backend. La seule logique qui vit véritablement "dans" Electron et nulle part ailleurs est celle qui a besoin d'un contexte machine locale : fenêtre native, notifications desktop, et — plus tard — le contexte navigateur authentifié Instagram. Tout le reste (règles métier, calcul de scoring, envoi d'emails, appels Meta/Hiker/Apify, cron) reste côté cloud exactement comme aujourd'hui.

### Répartition par domaine audité

| Domaine | A. Reste backend | B. Devient Electron UI | C. Déplacé/adapté | D. Reste web | E. Refonte nécessaire |
|---|---|---|---|---|---|
| Routes API (leads, calls, agenda, etc.) | ✅ Toutes | | | | Auth : passer du cookie au Bearer systématique (déjà supporté) |
| Auth (login/signup) | ✅ Supabase Auth | Écran de login natif dans Electron | | ✅ aussi sur closrm.fr (signup web) | Flux "navigateur système → deep link" à construire (§6) |
| `middleware.ts` (gate d'accès) | | | ✅ Sa logique de rôle/permissions devient des checks côté renderer + API, plus de middleware Next côté client | | Le rôle "monteur" gate doit être revérifié côté API, pas seulement middleware |
| Dashboard layout (RSC + fetch DB direct) | | ✅ Devient un fetch client au montage de l'app | ✅ | | Le pattern RSC "fetch serveur → hydrate contexte" n'existe pas en SPA — à remplacer par un fetch initial + état de chargement |
| Leads / Calls / Agenda / Closing / Follow-ups (UI) | | ✅ Largement réutilisable (composants React, juste retirer les dépendances `next/*`) | | | Vérifier chaque usage de `next/navigation`, `next/link`, `next/image` |
| DM Sessions (`closrm-session-dm`) | ✅ Logique serveur (`priority.ts`, `resolve-step.ts`) | ✅ UI de la file de session | | | Aucune — module déjà découplé du rendu |
| Meta / Hiker / Apify (`src/lib/{meta,instagram,hiker,apify}`) | ✅ Restent appelés uniquement depuis les routes API | | | | **Vérifier et corriger** les imports client-side identifiés dans `src/lib/meta` (voir §9, risque sécurité) |
| Webhooks (`/api/webhooks/*`) | ✅ Inchangés | | | | Aucune |
| Cron (Vercel + pg_cron) | ✅ Inchangés | | | | Aucune |
| Storage (R2 uploads) | ✅ Génération d'URL signée reste côté API | ✅ UI d'upload (picker fichier natif possible) | | | Remplacer le input file web par le file picker natif Electron (meilleure UX, pas obligatoire) |
| Notifications (push mobile, email, WhatsApp/Telegram) | ✅ Restent côté cloud | ✅ Ajout de notifications desktop natives (nouveau canal, pas un remplacement) | | | Aucune sur l'existant, ajout net |
| Billing / Settings | ✅ Logique quota/wallet | ✅ UI settings | | ✅ Reste accessible sur closrm.fr si on veut un accès billing sans installer l'app | Aucune majeure |
| Funnels publics (`src/app/f/[workspaceSlug]/...`) | ✅ | | | ✅ Ce sont des pages publiques vues par les prospects du coach, pas par le coach lui-même — n'ont aucune raison de vivre dans Electron | Aucune |
| Booking public (`src/app/book/...`) | ✅ | | | ✅ Même raisonnement que les funnels | Aucune |
| Emails (templates, envoi) | ✅ Entièrement backend | ✅ UI de composition/preview | | | Aucune |
| Mobile app (Expo) | ✅ Consomme la même API | | | | Aucune — troisième client, coexiste sans conflit |

## 4. Electron Architecture

### Choix technologique : Electron + Vite + React (pas Electron + Next.js)

Comparaison :

| Option | Verdict | Raison |
|---|---|---|
| Electron + Next.js (SSR interne) | **Écarté** | Next.js App Router est pensé pour un serveur HTTP par requête (RSC, `next/headers`, middleware). Le faire tourner *dans* Electron nécessiterait soit un serveur Node embarqué (complexité, port local, cycle de vie à gérer), soit `output: export` (statique) qui **perd les Server Components et le middleware** — revenant de fait à une SPA, avec en plus le poids de Next.js pour rien |
| Electron + Next.js (`output: export`) | **Écarté** | Même perte de RSC/middleware que ci-dessus, sans le bénéfice : autant partir sur un renderer pensé nativement pour ce mode (Vite) |
| **Electron + Vite + React** | **Retenu** | Vite est l'outil de référence pour un renderer Electron SPA : HMR rapide, build léger, aucune dépendance à un serveur Next actif. Les composants React existants (Client Components) sont réutilisables presque tels quels — il faut juste retirer les imports `next/*` (navigation, link, image) et les remplacer par leurs équivalents `react-router`/`<img>` |
| Electron + React Native (via react-native-macos/windows) | **Écarté** | Réécriture complète de l'UI web existante en composants RN — invaliderait tout le travail de réutilisation ; pertinent seulement si on voulait partager le code avec l'app mobile Expo, ce qui n'est pas l'objectif ici (deux apps aux UX différentes : desktop CRM dense vs mobile terrain) |

### Structure interne

- **Main process** (`electron/main/`) : cycle de vie des fenêtres, menu natif, tray (optionnel), gestion des deep links (`closrm://`), auto-update (`electron-updater`), crash reporting.
- **Preload** (`electron/preload/`) : `contextBridge.exposeInMainWorld('closrm', {...})` — surface minimale : `openExternal(url)`, `onDeepLink(callback)`, `notify(title, body)`, `getAppVersion()`, plus tard `instagram.*` pour le Connector. **Jamais** de `require` direct exposé, `nodeIntegration: false`, `contextIsolation: true` partout, cohérent avec ce qui a déjà été fait pour le module Hiker (aucun secret côté client).
- **Renderer** (`electron/renderer/`, ou un futur dossier `desktop/` à la racine) : l'app React/Vite, réutilisant au maximum les composants de `src/components/` actuels.
- **IPC** : uniquement pour ce qui ne peut pas passer par HTTP (notifications natives, deep link, version de l'app, futur accès Instagram WebView). Tout le reste (leads, DM sessions, agenda...) parle en HTTP direct à l'API Next.js — **pas la peine de faire transiter les données métier par IPC**, ce serait une complexité inutile.
- **CSP** : `Content-Security-Policy` stricte sur le renderer (`default-src 'self'`, `connect-src` limité au domaine API ClosRM + Supabase), même esprit que le durcissement déjà en place pour les `<webview>` dans le code Insyder analysé (Phase 3.5B) — à appliquer nous-mêmes, pas à copier leur code.
- **Stockage local** : `electron-store` (JSON chiffré) pour les préférences UI (sidebar collapsed, thème), **jamais pour un secret** (le JWT Supabase va dans le Keychain/Credential Manager via `keytar` ou équivalent — voir §7).
- **Auto-update** : `electron-updater`, alimenté par GitHub Releases (§11).
- **Crash reporting** : Sentry (déjà potentiellement en place côté web à vérifier — sinon un service equivalent), ou le crash reporter natif d'Electron a minima en V1.
- **Logs** : `electron-log`, rotation locale, jamais de secret loggé (cohérent avec la discipline déjà appliquée au module Hiker).
- **Deep links** : schéma `closrm://` enregistré (`app.setAsDefaultProtocolClient`), utilisé pour le callback d'auth (§6) — pattern déjà vu et audité chez Insyder (`lien.js`), mais implémenté proprement par nous, pas copié.
- **Notifications desktop** : `Notification` API native d'Electron/OS, alimentée soit par polling léger, soit par une future websocket/SSE (à définir en Phase background jobs, §8).
- **Démarrage automatique** : `app.setLoginItemSettings` — optionnel, à activer seulement sur consentement explicite de l'utilisateur.
- **macOS / Windows** : cible principale macOS Apple Silicon (poste de dev), avec build Windows dès que possible pour ne pas fermer ce marché — packaging via `electron-builder`.
- **Signature/notarization** : obligatoire pour macOS (Gatekeeper bloque sinon toute distribution hors App Store), à budgéter (compte développeur Apple, certificat) — détaillé en §11.

## 5. Backend Architecture

**Inchangée dans son rôle.** Les ~270 routes API Next.js restent le backend, déployées sur Vercel comme aujourd'hui. Ce qui change :

- **Auth** : toutes les routes doivent accepter le Bearer token de façon uniforme — c'est **déjà le cas** (`getWorkspaceId()` gère déjà ce chemin pour le mobile). Aucun changement de code attendu ici, seulement une vérification exhaustive qu'aucune route n'a de dépendance cachée à un cookie de session (à auditer route par route en Phase B).
- **`middleware.ts`** : sa fonction de redirection web (`/login` ↔ `/dashboard`) devient sans objet pour un client Electron (pas de navigation de pages HTML) — mais son rôle de **gate de rôle** ("monteur" restreint à certaines pages) doit être revérifié : dans le monde actuel, ce gate est en partie une **commodité UX côté middleware**, pas une garantie de sécurité (la vraie garantie doit être RLS + vérification serveur dans chaque route). À auditer : est-ce que le rôle "monteur" est aussi vérifié côté route API, ou seulement bloqué par le middleware (auquel cas Electron parlant directement à l'API contournerait ce gate) ? **Point à vérifier avant Phase B**, classé risque en §17.
- **CORS** : les routes API devront accepter des requêtes cross-origin depuis le renderer Electron (`app://` ou équivalent, pas un domaine web) — à configurer explicitement, absent aujourd'hui puisque tout est same-origin (Next.js sert son propre frontend).

## 6. Authentication

**Flux recommandé : Electron → navigateur système → callback deep link** (pas de formulaire de login directement dans une fenêtre Electron pour le compte ClosRM lui-même).

Pourquoi pas "Electron directement" (formulaire natif) : ce serait plus simple à construire, mais un navigateur système présente l'avantage de réutiliser une session déjà connectée (SSO potentiel futur, gestion de mot de passe du navigateur), et surtout **isole la saisie du mot de passe ClosRM d'un contexte Electron custom** — bonne pratique OAuth standard (PKCE), déjà le pattern recommandé par Supabase Auth pour les apps desktop/mobile.

Flux détaillé :
1. Electron ouvre `https://closrm.fr/auth/desktop-login?redirect=closrm://auth-callback` dans le navigateur système par défaut (`shell.openExternal`).
2. L'utilisateur se connecte normalement sur la page web (Supabase Auth, flux déjà existant).
3. Le web redirige vers `closrm://auth-callback?token=<jwt>` (ou un code d'échange, plus sûr qu'un JWT en clair dans une URL — à trancher en Phase A).
4. macOS/Windows relaie ce deep link à l'app Electron déjà enregistrée comme handler du schéma `closrm://` (`app.setAsDefaultProtocolClient`).
5. Le main process reçoit le lien, extrait le token, le transmet au renderer via IPC, qui l'utilise pour les appels API suivants (`Authorization: Bearer`).
6. Le token est stocké de façon sécurisée (Keychain macOS / Credential Manager Windows, via `keytar` ou l'API `safeStorage` d'Electron), jamais en `localStorage` brut.

**Logout** : effacer le token du stockage sécurisé + invalidation côté Supabase (`auth.signOut()` via l'API, appelable même sans session cookie puisqu'on a le JWT).

**Multi-device / changement de machine** : chaque installation Electron a son propre token stocké localement — reconnexion nécessaire sur une nouvelle machine, comportement standard (identique à l'app mobile aujourd'hui).

**Révocation** : gérée par Supabase Auth côté serveur (expiration de session), rien de spécifique à ajouter côté Electron au-delà de gérer un 401 de l'API en renvoyant l'utilisateur vers le flux de login.

**Refresh token** : Supabase gère nativement le refresh — le SDK `@supabase/supabase-js` peut tourner côté renderer Electron exactement comme il tourne dans l'app mobile (même bibliothèque, déjà en dépendance mobile), avec persistance de session déléguée au stockage sécurisé plutôt qu'à `localStorage`.

## 7. Instagram Architecture

Pas construite dans cette phase (interdiction explicite). Ce qui est planifié pour plus tard :

```
Electron
  → <webview> Instagram (partition Electron dédiée par workspace, session persistante)
  → authentification utilisateur (login manuel dans la webview, jamais de mot de passe demandé par ClosRM)
  → lecture des cookies de la partition (sessionid, ds_user_id, csrftoken...) — jamais affichés, jamais loggés
  → exécution de la collecte dans le contexte authentifié (BrowserWindow cachée sur la même partition)
  → normalisation locale (mêmes types que src/lib/hiker/normalizer.ts, réutilisables tels quels)
  → envoi au backend ClosRM des SEULS résultats normalisés (jamais les cookies bruts)
  → backend écrit dans instagram_interactions (même table, même provider pattern que Hiker : source_provider='instagram_private' à ajouter le moment venu)
```

Ceci correspond à l'**Architecture 1 (session locale)** recommandée dans la Phase 3.5B — pas l'Architecture 2 (envoi des cookies au serveur) qu'Insyder semble pratiquer au moins partiellement. Le choix de ClosRM est de ne jamais faire transiter un cookie Instagram vers le cloud, réduisant la surface de risque à la machine locale de l'utilisateur uniquement.

## 8. Private Instagram Architecture

Ce que le futur POC (non construit ici, cf. Phase 3.5B §20) devra confirmer avant tout engagement : la disponibilité réelle de l'endpoint privé de viewers de story, sa fenêtre temporelle, et sa stabilité. Rien de nouveau à ajouter ici par rapport à ce qui a déjà été documenté dans `docs/architecture/PHASE_3_5B_ELECTRON_DECISION.md` — ce document-ci se contente de refléter cette architecture dans le plan de migration global (§7 ci-dessus), sans la reconstruire.

## 9. Security

Ligne rouge explicite de la mission, déjà respectée par construction dans ce plan : **les clés serveur (Hiker, Apify, Meta App Secret, Supabase Service Role) ne sont jamais embarquées dans Electron**. Elles restent exclusivement dans les variables d'environnement Vercel, lues uniquement par les routes API — Electron ne fait jamais d'appel direct à `api.hikerapi.com`, `api.apify.com`, ou `graph.facebook.com`. Ce principe est déjà celui du module Hiker actuel (`HIKER_API_KEY` server-only, jamais exposée) — la migration Electron ne fait que l'étendre à l'ensemble du produit, elle ne l'invente pas.

**Point de vigilance trouvé pendant l'audit, à corriger avant/pendant la migration** : `src/lib/meta` est importé depuis plusieurs fichiers `.tsx` côté client (`AdCreativePanel.tsx`, `FormBlock.tsx`, `BookingBlock.tsx`, `MetaEventPicker.tsx`, `TrackingPanel.tsx`, la page `acquisition/publicites`). **Non vérifié avec certitude** si ces imports ne concernent que des types/constantes sans risque, ou s'ils tirent en fait du code appelant l'API Meta avec des credentials côté navigateur (le fichier `src/lib/meta/client.ts` fait ~19KB, probablement la logique d'appel). **Action recommandée avant la Phase B** : auditer précisément ces 6 fichiers pour confirmer qu'aucun secret Meta ne transite déjà côté client dans le web actuel — si c'est déjà le cas aujourd'hui, c'est un risque de sécurité préexistant indépendant d'Electron, mais qui doit être corrigé avant de porter ce code tel quel dans le renderer.

**Autres points sécurité** :
- **Token Supabase (JWT)** : stockage sécurisé natif (Keychain/Credential Manager), jamais `localStorage` — voir §6.
- **IPC** : surface minimale exposée via `contextBridge`, jamais de `require`/`ipcRenderer` bruts accessibles au renderer.
- **XSS/renderer compromise** : `contextIsolation: true`, `nodeIntegration: false`, CSP stricte — le renderer ne doit jamais pouvoir exécuter de Node.js même en cas d'injection de contenu (cohérent avec le durcissement déjà pratiqué pour les `<webview>` dans le code Insyder analysé, mais implémenté indépendamment par ClosRM).
- **Auto-update** : `electron-updater` doit vérifier la signature des mises à jour (comportement par défaut avec des releases signées) — jamais accepter une mise à jour non signée.
- **Code signing** : obligatoire dès la première distribution publique, pas seulement en "V2" — sans quoi macOS Gatekeeper affiche un avertissement bloquant à chaque lancement.

## 10. Background Jobs

| Tâche | Doit rester server-side | Peut devenir locale | Bénéficie réellement d'Electron |
|---|---|---|---|
| Envoi d'emails (SES) | ✅ | | |
| CAPI Meta, sync Instagram (Graph), Hiker discovery | ✅ | | |
| pg_cron (booking reminders, social posts, Apify) | ✅ | | |
| Purge de liens trackés | ✅ | | |
| Notifications push mobile (Expo) | ✅ | | |
| **Notifications desktop natives** (nouveau lead, RDV imminent) | | | ✅ — c'est un vrai gain Electron : notification OS native sans dépendre d'un onglet ouvert |
| **Rappel de DM Session en attente** (UI locale) | | | ✅ — affichage local d'un badge/notification, la donnée elle-même reste calculée côté `buildPriorityQueue` serveur |
| **Instagram WebView / collecte privée** (futur) | | ✅ doit être locale par nature (contexte navigateur authentifié) | ✅ — raison d'être de tout ce chantier |
| Polling léger de nouvelles données (si pas de websocket) | | ✅ possible en tâche de fond Electron | Partiellement — un onglet navigateur peut aussi poller ; le vrai gain est de continuer même fenêtre minimisée/tray |

**Principe respecté** : on ne déplace vers Electron que ce qui a une vraie justification (accès machine locale, notification OS, ou contexte navigateur authentifié). Tout calcul métier, tout appel à un provider tiers avec des credentials, reste côté cloud.

## 11. UX

### Design system — refonte visuelle complète (exigence explicite)

La migration Electron est l'occasion assumée d'une refonte visuelle totale, découplée de la logique métier :

- **Palette** : fond principal blanc/très clair, lumineux — rupture nette avec la palette sombre actuelle de ClosRM (`#0A0A0A`/rouge, documentée dans `CLAUDE.md`). Couleur d'accent inspirée de l'identité visuelle Instagram (gradient rose/violet/orange caractéristique), dans l'esprit visuel d'Insyder observé lors des phases précédentes (dashboard clair, cartes de profils, listes d'interactions denses mais aérées). **Aucune contrainte de compatibilité avec le branding actuel** — la palette peut changer intégralement, comme demandé explicitement.
- **Design system comme couche indépendante** : un dossier dédié (ex. `packages/design-system/` ou `electron/renderer/design-system/`) portant tokens (couleurs, typographie, espacements), composants primitifs (boutons, inputs, cards, badges de statut) et layout patterns (sidebar, page tabs) — construit une fois, consommé par tous les écrans progressivement migrés. Ceci permet de **migrer un module métier (ex. Leads) sans devoir attendre que 100% du design soit figé** : le module utilise les primitives du design system au fur et à mesure qu'elles existent, et l'ancien style Tailwind existant peut coexister temporairement pendant la transition (chaque écran migré adopte le nouveau système, les écrans non encore migrés gardent l'ancien, sans conflit puisque ce sont des arbres de composants séparés une fois sortis de Next.js).
- **Référence Insyder** : reprise de l'esprit (pas du code, jamais copié) observé dans les phases précédentes — dashboard avec cartes de métriques en haut, listes de profils avec avatar rond + badges de statut (suit/ne suit pas), sections d'analytics avec graphiques simples sur fond clair. Aucun détail visuel non observé directement ne doit être inventé comme s'il venait d'Insyder — cette section reste volontairement générale sur ce point tant qu'aucune référence visuelle précise n'a été transmise.
- **Cohérence transversale** : sidebar, CRM, leads, DM sessions, Instagram, analytics, settings partagent les mêmes primitives — pas de redesign îlot par îlot sans design system commun, sans quoi la refonte progressive produirait un patchwork visuel incohérent pendant toute la durée de la migration (risque explicitement à éviter, voir §17).

### Patterns UX desktop à ajouter (gains natifs vs le web actuel)

- Sidebar de navigation persistante (déjà existante conceptuellement via `DashboardShell`/`Sidebar`, à recomposer nativement)
- Raccourcis clavier globaux (`Cmd+K` recherche, navigation entre modules) — absent aujourd'hui
- Notifications OS natives (vs notifications in-app web actuelles)
- Fenêtres/modales natives pour les actions rapides (créer un lead, logger un appel) sans navigation de page complète
- États offline/reconnexion explicites — le web actuel dépend implicitement de la connectivité Vercel/Supabase sans UX dédiée de reconnexion ; Electron doit gérer explicitement "connexion perdue → retry → reconnecté"
- Indicateur de mise à jour disponible (auto-update) avec contrôle utilisateur du moment d'installation
- Statut des intégrations (Meta, Instagram, Hiker) visible en permanence dans un coin de l'UI, pas seulement sur la page Paramètres

## 12. Stability

Analyse technique, pas une affirmation vague :

**Problèmes réellement résolus par Electron** :
- Dépendance à un onglet navigateur ouvert pour tout traitement en arrière-plan (notifications, polling) — un process Electron peut tourner en tray/minimisé.
- Fraîcheur du cache : le layout dashboard actuel force déjà `dynamic/no-cache` à cause de problèmes de cache Vercel documentés (`revalidate = 0`, commentaire explicite dans le code) — un renderer Electron SPA avec fetch direct n'a pas cette classe de problème de cache HTML côté CDN.
- Contexte navigateur authentifié pour Instagram (déjà tout le sujet de la Phase 3.5B).

**Problèmes NON résolus par Electron** :
- La fiabilité du backend (Vercel, Supabase, latence API) reste strictement identique — Electron ne change rien à la vitesse ou disponibilité du cloud.
- Les bugs de logique métier (scoring, dédup, workflow engine) sont dans le code partagé, pas dans la couche de rendu — ils persistent à l'identique.
- La compatibilité des providers tiers (Meta, Hiker, Apify — tout ce qui a été documenté comme limitation dans les phases précédentes) est indépendante du client.

**Nouveaux problèmes introduits par Electron** :
- Fragmentation de version : contrairement au web où tous les utilisateurs ont toujours la dernière version déployée, les utilisateurs Electron peuvent rester sur d'anciennes versions si l'auto-update échoue ou est retardé — nécessite une stratégie de compatibilité API ascendante.
- Surface d'attaque desktop : crash natifs, comportement différent par OS, permissions système (notifications, accès réseau) à gérer explicitement.
- Coût de support multiplié par plateforme (macOS/Windows, potentiellement plusieurs versions d'OS).
- Risque de dérive du renderer par rapport à l'API si le contrat HTTP change sans versioning — actuellement non nécessaire (un seul frontend Next.js consomme son unique backend), devient nécessaire avec 3 clients indépendants (web restant, mobile, desktop).

## 13. Deployment

- **Cible principale** : macOS Apple Silicon (poste de dev actuel), build universel (Apple Silicon + Intel) recommandé dès que possible pour ne pas exclure les Mac Intel encore en usage chez des coachs.
- **Windows** : à prévoir en parallèle ou juste après macOS — `electron-builder` gère les deux depuis la même codebase.
- **Auto-update** : `electron-updater`, alimenté par **GitHub Releases** (gratuit, déjà l'écosystème du repo, pas de nouvelle infra à payer) — canal `latest` pour la production.
- **Signing/notarization macOS** : nécessite un compte Apple Developer Program (99$/an) et un certificat "Developer ID Application" — obligatoire avant toute distribution publique, sans quoi Gatekeeper bloque activement l'app.
- **Signing Windows** : certificat de signature de code (Authenticode) — recommandé mais moins bloquant que macOS (SmartScreen avertit sans bloquer totalement selon la réputation accumulée).
- **Versioning** : SemVer standard, aligné sur les tags Git.
- **Rollback** : GitHub Releases permet de republier une version antérieure comme `latest` en cas de régression critique — `electron-updater` redescendra les clients au prochain check si configuré ainsi (à valider techniquement en Phase A, pas garanti par défaut selon la stratégie de canal).
- **Beta channel** : `electron-builder` supporte des canaux `beta`/`alpha` séparés — recommandé dès que l'équipe dépasse une seule personne testant les nouvelles versions, pour ne pas exposer tous les coachs à une build instable.
- **Crash reports** : Sentry (à vérifier si déjà utilisé côté web — sinon nouvelle intégration légère) ou le crash reporter natif Electron en V1 minimal.

## 14. Migration Strategy

**Peut-on réutiliser 70-90% de l'UI et de la logique actuelle dans Electron ? Oui, avec des ajustements identifiés et bornés.**

Ce qui se porte quasiment tel quel :
- Tous les composants métier purement présentationnels (`src/components/leads/`, `src/components/agenda/`, etc.) — ils ne dépendent pas de RSC, seulement de props et de `fetch`.
- Les hooks personnalisés qui font du `fetch('/api/...')` — identiques, seul le token d'auth change de source (cookie → Bearer stocké localement).
- Toute la logique serveur (`src/lib/dm-sessions/`, `src/lib/meta/`, `src/lib/hiker/`, `src/lib/billing/`...) — **reste côté backend Next.js sans aucune modification**, ce n'est pas du code à porter dans Electron, c'est déjà à sa place.
- Les schémas de validation Zod (`src/lib/validations/`) — réutilisables des deux côtés si besoin (validation optimiste côté renderer).

Ce qui doit être adapté (pas réécrit, adapté) :
- Tout import `next/navigation`, `next/link` → remplacé par `react-router-dom` (ou équivalent SPA) — mécanique, pas une réécriture de logique.
- Le pattern RSC du layout dashboard (fetch DB direct en Server Component) → devient un fetch client au montage (`useEffect` ou une lib de data fetching à introduire, voir Risques §17 sur l'absence actuelle de React Query — **c'est le bon moment pour l'introduire**, la migration Electron est une raison légitime d'ajouter cette dépendance qui manque aujourd'hui).
- Les 6 fichiers avec import `src/lib/meta` côté client (§9) — à corriger avant de porter, indépendamment d'Electron.
- Le seul usage de `next/image` (`src/app/layout.tsx`) — trivial à remplacer par un `<img>` standard.
- Le rôle du `middleware.ts` : sa partie redirection web devient sans objet ; sa partie gate de rôle doit être vérifiée route par route (§5).

Ce qui doit être réellement réécrit :
- Rien d'identifié comme nécessitant une réécriture complète de logique métier. Le principal effort est mécanique (retirer les dépendances Next.js du rendu) plutôt que conceptuel.

## 15. File/Folder Impact

**À conserver tel quel (aucun changement)** :
- `src/app/api/**` (toutes les routes — deviennent l'API pure du backend)
- `src/lib/{meta,instagram,hiker,apify,billing,email,push,storage,whatsapp,dm-sessions}/**`
- `supabase/migrations/**`
- `src/middleware.ts` (adapté en Phase B, pas supprimé — continue de servir le web restant)
- `mobile/**` (inchangé, troisième client indépendant)

**À déplacer / adapter** :
- `src/components/**` — la majorité migre vers un nouveau dossier renderer Electron (`electron/renderer/src/components/` ou équivalent), avec retrait des imports `next/*`
- `src/app/(dashboard)/**` — les pages elles-mêmes ne migrent pas telles quelles (ce sont des routes Next.js), mais leur contenu JSX/logique est la base des nouveaux écrans Electron
- `src/lib/validations/**` — dupliqué ou partagé via un package interne si le monorepo le permet (à structurer en Phase A)
- `src/lib/layout/page-tab-groups.ts` — logique de navigation réutilisable, à adapter au routing SPA

**À créer** :
- `electron/` (ou `desktop/`) — main, preload, renderer, structure Vite
- `electron/renderer/design-system/` — nouveau design system (§11)
- Nouveau package de types/contrats partagés si un monorepo est mis en place (optionnel, à trancher en Phase A)
- `docs/architecture/` — déjà initié (ce document + Phase 3.5B)

**À supprimer éventuellement plus tard (jamais maintenant)** :
- `src/app/(dashboard)/**` (les pages Next.js elles-mêmes) — seulement une fois l'app Electron en production stable et le web CRM officiellement retiré (§16, Milestone M10)
- Rien d'autre n'est candidat à suppression dans le périmètre de ce plan.

## 16. Roadmap

| Milestone | Livrable | Fichiers principaux | Risques | Tests | Critère GO/NO-GO |
|---|---|---|---|---|---|
| **M0 — Architecture** | Ce document + validation du choix Electron+Vite | `docs/architecture/ELECTRON_MIGRATION_PLAN.md` | Désaccord tardif sur la techno | Revue humaine | Accord explicite sur §3/§4 |
| **M1 — Electron shell** | App Electron vide qui se lance, fenêtre native, menu, auto-update configuré (sans contenu métier) | `electron/main`, `electron/preload` | Configuration `electron-builder` sous-estimée | Lancement manuel sur macOS Apple Silicon | L'app se lance, se met à jour depuis une release de test |
| **M2 — Auth** | Flux navigateur système → deep link → token stocké en Keychain, appel API authentifié réussi | `electron/main` (deep link), `closrm.fr/auth/desktop-login` (nouvelle route web) | Sécurité du transit du token dans l'URL deep link | Login end-to-end manuel | Un utilisateur réel se connecte et un appel `/api/leads` authentifié réussit |
| **M3 — CRM (design system + module Leads pilote)** | Design system de base (tokens, primitives) + module Leads entièrement fonctionnel dans Electron | `electron/renderer/design-system/`, `electron/renderer/src/features/leads/` | Sous-estimer le temps de refonte visuelle en la faisant "en même temps" que le port fonctionnel | Tests manuels + tests unitaires portés des composants Leads existants | Un coach peut consulter/créer/modifier un lead depuis l'app desktop, visuellement conforme au nouveau design |
| **M4 — Intégrations (Agenda, DM Sessions, Meta/Instagram/Hiker read-only)** | Modules Agenda + DM Sessions + affichage des données Meta/Instagram/Hiker (pas de nouvelle logique, juste consommation API existante) | `electron/renderer/src/features/{agenda,dm-sessions,integrations}/` | Volume de composants à porter sous-estimé (~270 routes API à couvrir progressivement, pas toutes en une fois) | Tests par module au fur et à mesure | Les 4 modules fonctionnent sans régression vs le web |
| **M5 — Background** | Notifications desktop natives, DM session reminders locaux | `electron/background/` | Sur-ingénierie (mettre trop de choses en local, cf. §10) | Tests manuels de notification | Une notification desktop apparaît pour un événement réel (nouveau lead) |
| **M6 — Instagram WebView** | `<webview>` Instagram fonctionnelle, capture de session locale (sans encore appeler d'endpoint privé) | `electron/instagram-webview/` | Durcissement sécurité de la webview sous-estimé | Tests manuels de login/logout Instagram | Une session Instagram est capturée et détectable localement, jamais transmise au cloud à ce stade |
| **M7 — Private Instagram POC** | POC isolé validant `list_reel_media_viewer` (cf. Phase 3.5B §20) | `tools/instagram-private-poc/` | Endpoint privé qui ne répond plus/a changé | Test manuel sur compte de test | Viewers nominatifs récupérés sur un compte de test contrôlé |
| **M8 — Story Viewers** | Intégration production de la collecte de viewers si M7 est concluant | Extension de `src/lib/hiker`-like pattern pour ce nouveau provider | Tout ce qui est documenté en §14 de la Phase 3.5B (fenêtre temporelle, stabilité) | Tests d'intégration avec mocks (même approche que Hiker Phase 3.5) | Collecte fiable sur plusieurs comptes de test réels sur plusieurs jours |
| **M9 — Production** | App Electron distribuée aux premiers coachs, web CRM toujours actif en parallèle | Tout ce qui précède, packaging final | Adoption utilisateur (installation desktop = friction) | Beta fermée avant large rollout | Taux d'adoption/rétention beta jugé suffisant (seuil à définir par le produit, pas par ce document) |
| **M10 — Web simplification** | Retrait progressif des routes `(dashboard)` du web, `closrm.fr` réduit à marketing/billing/download | Suppression différée de `src/app/(dashboard)/**` | Coachs non migrés vers le desktop perdant l'accès | Communication utilisateur + fenêtre de transition | 100% (ou seuil défini) des workspaces actifs utilisent le desktop depuis N semaines |

## 17. Risks

- **Middleware "monteur" gate potentiellement UX-only, pas sécurité réelle** (§5) — à vérifier avant M4, sans quoi Electron pourrait exposer un accès que le web bloquait seulement visuellement.
- **Imports `src/lib/meta` côté client** (§9) — risque de sécurité potentiellement déjà présent aujourd'hui dans le web, à corriger indépendamment de la migration.
- **Absence de React Query/SWR** — la migration va naturellement demander de la gestion de cache/état serveur plus riche qu'un simple `fetch` dispersé ; introduire une lib de data fetching est raisonnable à faire tôt (M3) plutôt que de porter le pattern actuel tel quel et le regretter plus tard.
- **Volume de ~270 routes API et ~340 fichiers Client Components** — risque de sous-estimation du temps de portage si chaque route/composant est traité comme un cas particulier ; la roadmap mitige ce risque en procédant module par module (M3→M4) plutôt que big-bang.
- **Refonte design en parallèle du portage fonctionnel** — risque de mélanger deux efforts (fonctionnel + visuel) et de ralentir les deux ; le plan sépare explicitement "design system disponible" (M3, tokens/primitives) de "tous les écrans repeints" (étalé sur M3→M9).
- **Fragmentation de version desktop** (§12) — nécessite une politique de compatibilité API claire dès que le desktop est en production, absente aujourd'hui car un seul client existe.
- **Coût de signature/notarisation et de support multi-OS** (§13/§17) — coût récurrent nouveau pour l'organisation, à budgéter formellement, pas seulement technique.
- **Adoption utilisateur** (M9) — un CRM qui demande une installation desktop a une friction d'onboarding supérieure à un lien web ; aucune donnée utilisateur disponible pour quantifier ce risque dans le cadre de cette phase.
- **Dépendance à un endpoint Instagram privé non documenté** (M7/M8) — déjà signalé en détail dans la Phase 3.5B, rappelé ici car il conditionne deux milestones entiers de cette roadmap.

## 18. Open Questions

- Le token d'auth doit-il transiter en clair dans l'URL du deep link (M2), ou faut-il un mécanisme d'échange de code à usage unique (plus sûr, légèrement plus complexe) ? À trancher en Phase A/M2.
- Faut-il un monorepo (types/validations partagés entre `src/app/api` et `electron/renderer`) ou une simple duplication contrôlée au démarrage ? Impacte la structure de `src/lib/validations/`.
- Sentry (ou équivalent) est-il déjà utilisé côté web ? Non confirmé dans cet audit — à vérifier avant de choisir l'outil de crash reporting desktop.
- Le rollback automatique via `electron-updater`/GitHub Releases fonctionne-t-il "out of the box" avec la stratégie de canal envisagée, ou faut-il un mécanisme de dégradation manuel ? À valider techniquement en Phase A.
- Linux est-il un marché à couvrir pour les coachs ClosRM ? Non tranché — impacte le périmètre de `electron-builder`.
- Quel seuil d'adoption déclenche M10 (retrait du web CRM) ? C'est une décision produit, pas technique — non traitée ici.
- Le design system doit-il s'appuyer sur les primitives Radix déjà en dépendance (cohérence avec l'existant) ou repartir sur une autre base ? Recommandé de garder Radix (déjà audité, accessible, sans dépendance Next.js) sauf raison contraire.

## 19. Recommended First Implementation Step

**Milestone M1 (Electron shell) uniquement**, sans aucune fonctionnalité métier : une app Electron + Vite qui se lance sur macOS Apple Silicon, avec le squelette main/preload/renderer, la configuration `electron-builder` de base, et un mécanisme d'auto-update pointant vers un dépôt GitHub Releases de test. Aucune connexion à l'API ClosRM, aucune donnée réelle. Objectif : valider la chaîne de build/signature/distribution avant d'investir dans le portage fonctionnel (M2+) — c'est le risque le plus nouveau pour l'organisation (§13/§17) et le moins coûteux à valider isolément en premier.

---

## Résumé pour décision

**Architecture recommandée** : Electron + Vite + React (renderer), Next.js API conservé comme backend HTTP pur sur Vercel, auth via Bearer token (mécanisme déjà mûr grâce à l'app mobile), design system desktop entièrement nouveau (fond clair, accents inspirés Instagram) construit en couche indépendante de la logique métier.

**Roadmap** : M0 (ce document) → M1 (shell Electron) → M2 (auth) → M3 (design system + Leads pilote) → M4 (Agenda/DM Sessions/intégrations) → M5 (background/notifications) → M6 (Instagram WebView) → M7 (POC privé) → M8 (Story Viewers) → M9 (production/beta) → M10 (simplification web).

**Premier milestone à implémenter** : M1 — shell Electron vide, packaging + auto-update, sans logique métier.

**Risques principaux** : gate de rôle "monteur" potentiellement non sécurisé au niveau API (à vérifier avant M4) ; imports `meta` côté client à auditer pour fuite de secret potentielle déjà présente aujourd'hui ; volume de portage (270 routes, 340 composants) à traiter module par module pour éviter le big-bang ; coût récurrent nouveau de signature/notarisation et support multi-OS ; dépendance à un endpoint Instagram privé non documenté conditionnant M7/M8 ; adoption utilisateur d'un desktop non quantifiée.

**Décisions nécessitant ton GO explicite avant de coder quoi que ce soit** :
1. Confirmer le choix Electron + Vite (vs toute autre option écartée en §4).
2. Confirmer le flux d'auth "navigateur système + deep link" (vs un formulaire natif plus simple mais moins standard).
3. Trancher la question ouverte sur le transit du token dans le deep link (clair vs code d'échange) — impacte directement M2.
4. Valider qu'on commence bien par M1 (shell vide) plutôt que de sauter directement à une fonctionnalité métier.
5. Statuer sur le périmètre Linux et la structure monorepo (questions ouvertes non bloquantes pour M1, mais à trancher avant M3).
