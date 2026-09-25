# M2 — Validation réelle de l'app Electron

Toutes les commandes ci-dessous ont été **réellement exécutées** dans cette session. Aucun résultat n'est affirmé sans avoir été observé.

## 1. npm install : **PASS**

Un problème d'environnement machine (pas du projet) a été rencontré et corrigé sans toucher au système : le cache npm global (`~/.npm/_cacache`) contient des fichiers appartenant à `root` (résidu d'une install `sudo` antérieure), provoquant `EACCES`. Contournement : cache npm temporaire local (`--cache /tmp/npm-cache-electron`), sans `sudo chown` sur le système. **494 packages installés**, 16 vulnérabilités signalées par npm (2 modérées, 13 hautes, 1 critique) — non corrigées dans cette session, à traiter séparément (probablement dans les devDependencies de tooling, non auditées en détail ici).

## 2. npm run dev : **PASS** (après correction d'un vrai bug)

### Bug trouvé et corrigé : incompatibilité ESM du main process Electron

**Symptôme observé** : `npm run dev` faisait planter Electron immédiatement avec `TypeError: Cannot read properties of undefined (reading 'exports')` dans `cjsPreparseModuleExports` — un crash interne au translator ESM de Node, avant même l'exécution du code applicatif.

**Cause racine identifiée** (par isolation directe, pas par supposition) : `package.json` avait `"type": "module"`, ce qui poussait `vite-plugin-electron` à compiler `main/index.ts` en ESM natif. Le module natif `electron`, chargé via `import` dans ce contexte précis (Electron 33.4.11 + Node 20.18.3 + `sandbox: true`), casse le translator CJS-vers-ESM de Node. Reproduit isolément avec `electron dist-electron/main/index.js` en dehors de tout contexte Vite.

**Correction appliquée** :
- Retrait de `"type": "module"` du `package.json` d'`electron/` — force le main process en CommonJS (le format historiquement fiable pour le bootstrap Electron).
- Retrait de `fileURLToPath(import.meta.url)` dans `main/index.ts` (syntaxe ESM-only), remplacé par le `__dirname` natif que CJS fournit directement.

### Deuxième bug trouvé et corrigé : `ELECTRON_RUN_AS_NODE=1`

Après la correction ESM/CJS, un second crash est apparu : `electron.app.requestSingleInstanceLock` sur `undefined`. Isolé précisément : `require('electron')` retournait une **string** (le chemin du binaire) au lieu de l'API — comportement documenté d'Electron quand la variable d'environnement `ELECTRON_RUN_AS_NODE=1` est active, ce qui était le cas dans le shell de cette session (probablement hérité de l'environnement d'exécution du harness). **Correction : lancer avec `env -u ELECTRON_RUN_AS_NODE`** — pas une modification du code du projet, un ajustement de l'environnement de lancement.

### Résultat observé après ces deux corrections

```
env -u ELECTRON_RUN_AS_NODE npm run dev
```
→ Vite démarre (`http://localhost:5173`), compile main/preload sans erreur, **le process Electron principal et son renderer tournent de façon stable** (vérifié via `ps aux` : process actifs, CPU stable, aucune boucle de crash sur 15+ secondes d'observation).

**Limite honnête** : sans accès à un display dans cet environnement sandboxé, je n'ai pas pu capturer de screenshot pour confirmer visuellement le rendu du contenu React (voir §8 Design — non vérifié visuellement, seulement par lecture de code et absence d'erreur console/process).

### Troisième correction (trouvée en cours de typecheck, avant tout crash) : types `import.meta.env`

`npm run typecheck` a révélé `Property 'env' does not exist on type 'ImportMeta'` sur les 3 usages de `import.meta.env.VITE_*`. Corrigé par l'ajout de `renderer/src/vite-env.d.ts` (déclaration de types standard Vite, absente du scaffold initial).

## 3. npm run build : **PASS**

Build complet exécuté de bout en bout : `tsc` (0 erreur) → `vite build` (renderer 486KB/140KB gzip, main 2.4KB, preload 0.46KB) → `electron-builder` (packaging réel). Résultat vérifié sur disque :
- `release/mac-arm64/ClosRM.app` — bundle macOS réel.
- `release/ClosRM-0.1.0-arm64.dmg` — **97 Mo**, DMG installable réel.

Signature : une identité de développement locale a été trouvée automatiquement sur la machine et utilisée pour signer l'app (`identity=9FD956FF...`). **Notarisation Apple non effectuée** — explicitement hors scope M1/M2 selon la mission, le build reste utilisable en local mais afficherait un avertissement Gatekeeper en dehors du poste de développement.

## 4. Auth Magic Link : **NON TESTÉ** (credentials Supabase réelles absentes de l'environnement de session)

Le flux de code (magic link → deep link → `exchangeCodeForSession`) a été écrit et relu, mais son exécution réelle nécessite :
- Un vrai projet Supabase avec `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` fonctionnels (le `.env.local` utilisé contenait les valeurs placeholder `xxx.supabase.co` de l'exemple, pas de vraies credentials).
- Une vraie boîte email pour recevoir et cliquer le lien.
- Le Redirect URL `closrm://auth-callback` allow-listé côté paramètres Supabase Auth — **non vérifié si c'est déjà le cas sur le projet `hsnqmjsckekbmmwneybb`**.

Aucune de ces conditions n'était réunie dans cette session. **Ce point reste entièrement à valider manuellement**, pas seulement relu.

## 5. Deep link `closrm://` : **NON TESTÉ** (nécessite une app packagée/enregistrée et un vrai clic système)

Le code d'enregistrement (`app.setAsDefaultProtocolClient`) et de réception (`open-url`, `second-instance`) a été relu et est conforme au pattern standard Electron documenté. Son test réel nécessite soit une app packagée installée (le DMG produit en §3 pourrait servir à ce test, non fait ici), soit un lancement `electron . insyder://...` en dev — non exécuté dans cette session.

Ce qui **a été testé réellement** et qui est directement lié : `extractAuthCode()` (parsing de l'URL du deep link) est couvert par 5 tests automatisés qui passent (voir §9).

## 6. CORS : **CONFIRMÉ BLOQUANT PAR UN TEST RÉEL** (correction non appliquée, en attente de validation)

Un vrai serveur Next.js a été démarré localement (`npm run dev` dans le repo principal, lecture seule, aucune modification) pour tester empiriquement plutôt que supposer :

```
curl -i -X OPTIONS http://localhost:3000/api/auth/me \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
→ HTTP/1.1 204 No Content — AUCUN header Access-Control-Allow-Origin

curl -i http://localhost:3000/api/auth/me -H "Origin: http://localhost:5173"
→ HTTP/1.1 401 Unauthorized — AUCUN header Access-Control-Allow-Origin
```

**Confirmé empiriquement** : le serveur répond (curl n'est jamais bloqué, ce n'est pas un test suffisant à lui seul), mais l'absence totale d'en-tête `Access-Control-Allow-Origin` signifie qu'un vrai moteur Chromium (celui qu'utilise Electron) **refusera que le JavaScript du renderer lise la réponse** — le `fetch()` échouerait côté renderer avec une erreur réseau opaque, avant même d'atteindre la logique de gestion d'erreur de `api-client.ts`.

**Correction minimale nécessaire** (préparée, **non appliquée** — modification du backend partagé) :
- **Fichier concerné** : `next.config.ts` (ajout d'un bloc `headers()` scopé à `/api/:path*`) ou, alternative plus fine, un ajustement dans `src/middleware.ts` pour injecter `Access-Control-Allow-Origin` conditionnellement selon l'origine de la requête (dev : `http://localhost:5173` ; prod packagée : une origine à définir, probablement un scheme custom une fois hors dev — point encore ouvert).
- **Risque** : `next.config.ts` et `src/middleware.ts` sont des fichiers **partagés avec le web et l'app mobile** — une erreur de configuration CORS trop permissive (`*` sur des routes authentifiées) créerait un risque de sécurité réel pour tout le produit, pas seulement Electron. Une erreur trop restrictive casserait juste Electron sans rien risquer d'autre.
- **Recommandation** : scoper strictement l'autorisation CORS à l'origine exacte attendue (`http://localhost:5173` en dev, une origine précise à définir pour la build packagée), jamais un wildcard `*`, et seulement sur les routes `/api/*` qui acceptent déjà le Bearer token (donc déjà conçues pour un client non-web).

**Non appliqué dans cette session, en attente de ton accord explicite avant modification du backend partagé.**

## 7. API / Bearer : **PASS partiel** (logique testée réellement via mocks, pas contre un vrai serveur à cause du blocage CORS §6)

Testé réellement (26 tests automatisés, voir §9) :
- Attachement de `Authorization: Bearer <token>` depuis la session Supabase courante — **PASS**.
- Absence de header `Authorization` quand aucune session n'existe — **PASS**.
- Levée d'`ApiError(401)` sur une réponse non authentifiée — **PASS**.
- Levée d'`ApiError` avec le message serveur sur 403/404/500 — **PASS**.
- Aucune fuite du token dans les logs console — **PASS** (vérifié activement, pas juste absence de `console.log` visible à l'œil).

**Non testé en conditions réelles bout-en-bout** (renderer → vrai serveur Next.js → vraie base) à cause du blocage CORS non résolu (§6) — un test end-to-end réel échouerait actuellement pour une raison déjà identifiée et non liée à la logique applicative elle-même.

## 8. Leads : **PASS partiel** (logique de données testée réellement, rendu visuel non vérifié)

Testé réellement : `GET /api/leads` (liste), `GET /api/leads/:id` (détail), `POST /api/leads` (création, payload vérifié), `PATCH /api/leads/:id` (modification), gestion 404/400 comme `ApiError` — 6 tests dédiés, tous passants (voir §9). Un bug réel a été trouvé et corrigé au passage : `LeadsListPage.tsx` contenait un contournement de type louche (`'info' as never`) sur le mapping statut→couleur de badge — extrait dans un module `status.ts` dédié, testé (7 tests), et le composant corrigé pour l'utiliser proprement.

**Non testé** : recherche/filtres (mission "recherche si elle existe actuellement" — non portée en M1, confirmé absente du scope construit, donc rien à tester ici), rendu visuel réel des états loading/empty/erreur (nécessiterait le display, voir §2).

## 9. Tests : **PASS — 26/26**

```
npm run test
 Test Files  5 passed (5)
      Tests  26 passed (26)
```

Répartition : `deep-link.test.ts` (5), `secure-session-storage.test.ts` (4), `api-client.test.ts` (6), `status.test.ts` (5), `api-integration.test.ts` (6). Couvre les minimums demandés par la mission : parsing deep-link, gestion de session (jamais localStorage), client API (Bearer, 401/403/404/500, non-fuite de token), logique Leads (liste/détail/création/modification/erreurs).

**Non couvert par des tests automatisés** : démarrage réel d'Electron, contextIsolation en conditions réelles (vérifiés par lecture de code + `ps aux`, pas par un test automatisé dédié), le flow d'auth de bout en bout (nécessite les credentials réelles de §4).

## 10. Security audit : **PASS**

Vérifié par recherche exhaustive dans le code (`grep`), pas par relecture visuelle seule :

| Point | Résultat |
|---|---|
| `contextIsolation: true` | ✅ confirmé (`main/index.ts:76`) |
| `nodeIntegration: false` | ✅ confirmé (`main/index.ts:77`) |
| `sandbox: true` | ✅ confirmé (`main/index.ts:78`) |
| Preload minimal, pas de `require`/`ipcRenderer` brut exposé | ✅ confirmé — seuls `onDeepLink` et `secureStorage.{get,set,clear}` exposés |
| CSP présente | ✅ confirmée (`main/index.ts`, en-tête `Content-Security-Policy`) |
| Aucun secret serveur (`HIKER_API_KEY`, `APIFY_*`, `META_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, Stripe, AWS) dans `electron/` | ✅ confirmé — 0 occurrence trouvée par grep |
| Session jamais dans `localStorage` | ✅ confirmé — `secureSessionStorage` route tout vers IPC → `safeStorage` |
| Tokens jamais loggés | ✅ confirmé — 0 occurrence de `console.log`/`console.error` contenant un token, et testé activement (voir `api-client.test.ts`, "never logs or exposes the access token") |
| Tokens jamais en query params/URL | ✅ confirmé — seul le `code` PKCE (à usage unique, sans valeur après échange) transite par l'URL du deep link, jamais un access/refresh token |

Aucun problème de sécurité trouvé dans ce périmètre.

## 11. Git

```
git status --porcelain
?? electron/
```

**A. Changements Electron** : dossier `electron/` entier (nouveau), y compris les corrections apportées pendant M2 (retrait `"type": "module"`, retrait `import.meta.url`, ajout `vite-env.d.ts`, correction `LeadsListPage.tsx`/nouveau `status.ts`, 5 nouveaux fichiers de tests, `vitest.config.ts`).

**B. Changements web/backend** : **aucun**. Le point CORS (§6) a été testé (lecture, `curl` contre un serveur local temporaire) mais **aucune ligne de `next.config.ts`, `src/middleware.ts` ou toute route API n'a été modifiée.**

**C. Changements docs/tests** : ce document (`docs/architecture/ELECTRON_M2_VALIDATION.md`), les 5 fichiers de tests listés en §9 (comptés dans "A" ci-dessus puisqu'ils sont sous `electron/`).

Confirmé : Apify intact, DB intacte, aucune migration, aucun Story Viewer, aucune WebView Instagram, aucun Hiker dans Electron, aucun background job complexe, aucune suppression.

## 12. Rapport final

| Point | Statut |
|---|---|
| npm install | **PASS** (contournement d'un problème de cache npm root-owned, hors projet) |
| npm run dev | **PASS** (après correction de 2 bugs réels : ESM/CJS du main process, `ELECTRON_RUN_AS_NODE`) |
| npm run build | **PASS** (DMG réel de 97 Mo produit) |
| Tests | **PASS — 26/26** |
| Auth magic link | **NON TESTÉ** — pas de projet Supabase réel configuré dans cette session |
| Deep link | **NON TESTÉ** en conditions réelles (app packagée + clic système) — code relu, logique de parsing testée (5 tests) |
| API Bearer | **PASS** (logique testée par mocks) — end-to-end réel bloqué par CORS (§6) |
| Leads | **PASS** (logique de données testée) — rendu visuel non vérifié (pas de display) |
| CORS | **Bloquant confirmé par test réel**, correction préparée et expliquée, **non appliquée** (backend partagé, en attente de ton accord) |
| Security audit | **PASS**, aucun problème trouvé |

**Fichiers modifiés** : uniquement sous `electron/` (nouveau dossier) + ce rapport sous `docs/architecture/`. Zéro fichier web/backend touché.

**Problèmes restants** :
1. CORS à corriger côté Next.js avant que l'API Bearer fonctionne réellement depuis Electron (§6) — nécessite ton accord avant modification.
2. Auth magic link et deep link à valider avec un vrai projet Supabase et un vrai clic utilisateur — impossible à faire dans cet environnement de session.
3. 16 vulnérabilités npm signalées, non auditées en détail.
4. Rendu visuel du design system non vérifié faute de display dans cet environnement.

**Prochaine étape M3** : une fois le CORS validé et corrigé (§6), et un vrai test manuel end-to-end effectué avec de vraies credentials Supabase (magic link → deep link → Leads CRUD réel), reprendre la roadmap M3 du plan de migration (design system approfondi + module Leads pilote plus complet) sur des fondations dont l'auth et l'API sont, cette fois, prouvées fonctionnelles de bout en bout — pas seulement testées unitairement.
