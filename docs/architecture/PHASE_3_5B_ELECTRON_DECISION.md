# PHASE 3.5B — Décision architecture : Instagram privé & Electron

## 1. Executive Summary

Hiker et Meta officiel couvrent la grande majorité de la Discovery Instagram (profils, médias, reels, likers, commentaires, followers). Aucun des deux ne fournit — et ne peut structurellement fournir — la liste **nominative** des viewers d'une story sur un compte tiers.

Une analyse approfondie du bundle Electron **et** du frontend web bundlé d'Insyder (nouvelle source non exploitée en Phase 1/2/2.5) apporte une preuve directe, au niveau du code, qu'Insyder :
1. capture une vraie session Instagram (cookies, user-agent) via un contexte Electron authentifié ;
2. **envoie ces cookies bruts à son propre backend serveur** (argument GraphQL `cookies: String!` obligatoire sur `saveInstagramSession`) ;
3. possède un endpoint privé Instagram fonctionnel côté client Electron pour lister les viewers nominatifs d'une story (`list_reel_media_viewer`) ;
4. affiche côté produit un comptage de viewers par story (`storiesSpectateurs`) avec un avertissement explicite en dur dans le code : *"Instagram truncates a story's viewer list"*.

Ceci confirme que la fonctionnalité existe chez Insyder et qu'elle repose sur une session Instagram authentique capturée localement — mais **la preuve ne montre pas explicitement où (Electron local ou backend serveur) le endpoint privé `list_reel_media_viewer` est réellement rappelé en production** pour aujourd'hui produire `storiesSpectateurs`. Ceci est signalé comme **INFÉRENCE**, pas fait, tout au long du document.

**Décision** : un Electron Connector minimal est **CONDITIONAL GO** — justifié uniquement si ClosRM décide de viser les Story Viewers nominatifs comme fonctionnalité produit. Sans cet objectif, **WEB ONLY reste la bonne architecture** pour tout le reste du périmètre Discovery (Meta + Hiker + Apify). Un Full Electron App n'est justifié par aucun élément trouvé : **NO-GO**. Avant tout engagement, un **POC minimal isolé est recommandé (CONDITIONAL GO)**, sur un compte de test contrôlé, hors production.

## 2. État réel après Phase 3.5

La Phase 3.5 initiale (persistance Hiker, migrations, dédup, idempotence, RLS) est **terminée**, validée uniquement par mock Supabase faute d'environnement staging ou de Docker disponible. Elle n'est pas reprise ni remise en cause ici. Le seul écart connu (nom de table `discovery_runs` vs `hiker_discovery_runs` mentionné dans une mission antérieure) reste ouvert et n'est pas traité dans ce document.

## 3. Pourquoi cette Phase 3.5B existe

Pendant l'analyse fonctionnelle qui a suivi la Phase 3.5, la comparaison avec les fonctionnalités observées chez Insyder (Phase 1 — run `decouverteStatut` avec `followers_total`, `leads_total`, etc.) a fait ressortir un manque structurel : Insyder expose des concepts produit — lurkers, audience silencieuse, story viewers historisés — qu'aucun provider actuellement intégré dans ClosRM (Meta, Hiker, Apify) ne peut alimenter. Cette phase existe pour trancher, avant tout investissement produit, si cette lacune impose une brique desktop.

## 4. Preuves Insyder

Toutes les preuves ci-dessous proviennent de fichiers déjà présents sur la machine : `/Applications/Insyder.app` (app installée, shell Electron déjà extrait en Phase 1 sous `instagram.js`/`main.js`/`preload.js`, et son dossier `Contents/Resources/renderer/` — le frontend Next.js exporté statiquement, **non exploité en Phase 1**, analysé pour la première fois dans cette phase) et `/Users/pierrerebmann/Downloads/app.insyder.io.har` (capture réseau du site marketing, peu informative pour cette question — voir §4.6).

### 4.1 Capture de session Instagram côté Electron
`PROUVÉ PAR LE CODE` — `instagram.js` (shell Electron) contient `readCapturedSession()` qui lit directement les cookies du store Electron d'une partition dédiée (`persist:ig-<userKey>`) : `sessionid`, `ds_user_id`, `csrftoken`, `mid`, `ig_did`, `rur`, `datr`, `shbid`, `shbts`. Capture aussi `userAgent`, `acceptLanguage`, `appId` (`936619743392459`, l'app id web officiel d'Instagram), et une résolution de géolocalisation par IP (`geo: {ip, country, region, city}` via `ipwho.is`).

### 4.2 Endpoint privé Story Viewer appelé depuis le contexte Electron
`PROUVÉ PAR LE CODE` — dans `instagram.js`, fonction `IN_PAGE_ANALYSIS` (exécutée via `webContents.executeJavaScript` dans une `BrowserWindow` chargeant réellement `https://www.instagram.com/` sur la partition contenant les cookies capturés) :
```js
const vr = await get('/api/v1/media/' + pk + '/list_reel_media_viewer/?supported_capabilities_new=%5B%5D');
const viewers = (vr.json && vr.json.users) || [];
results.stories.push({ story_pk: String(pk), taken_at: ..., viewer_count: viewers.length || Number(s.viewer_count || 0), viewers: people(viewers) });
```
où `people()` mappe chaque viewer à `{username, full_name, pk, is_private, profile_pic_url}`. C'est un appel **same-origin, authentifié par les cookies réels de la page**, exécuté depuis l'intérieur du contexte de navigation Instagram — pas un appel serveur externe avec des cookies rejoués.

### 4.3 Le backend d'Insyder exige les cookies bruts — pas seulement une session côté client
`PROUVÉ PAR LE CODE` — schéma GraphQL AppSync embarqué dans le renderer bundlé (`renderer/_next/static/chunks/428-*.js`), mutation `saveInstagramSession` :
```json
"cookies": {"name": "cookies", "isArray": false, "type": "String", "isRequired": true},
"userAgent": {"name": "userAgent", "isArray": false, "type": "String", "isRequired": true}
```
`cookies` et `userAgent` sont des arguments **String obligatoires** (`isRequired: true`) de cette mutation. Ce n'est pas une hypothèse : c'est le schéma d'introspection GraphQL réel, tel que le SDK Amplify du frontend le connaît. Ceci prouve que le frontend est conçu pour envoyer les cookies Instagram bruts au backend d'Insyder à un moment du flux.

### 4.4 Catalogue complet des actions backend (dbQuery/dbMutate)
`PROUVÉ PAR LE CODE` — le même chunk contient un `Set` JavaScript en dur listant toutes les actions valides pour un pattern RPC générique (`dbQuery({action, args})` / `dbMutate({action, args})`), incluant explicitement : `storiesSpectateurs`, `lurkersListe`, `statsInvisibles`, `storyFuite`, `contentDetail`, `contentComments`, `contentLeads`, `leadStoryGestes`, aux côtés du module Discovery déjà connu (`decouverteProfils`, `decouverteStatut`, etc. — cohérent avec la Phase 1).

### 4.5 Appel réel de `storiesSpectateurs` et avertissement produit sur la troncature
`PROUVÉ PAR LE CODE` — dans le chunk de page principal (`app/page-*.js`) :
```js
let i = await e4.sq.storiesSpectateurs({instaId: e, days: a, debut: s, fin: r});
// mappe vers { contentId, caption, thumbnailUrl, postedAt, spectateurs, total }
```
avec, dans les textes UI en dur du même composant : `"A floor: Instagram truncates a story's viewer list."` (`explication` du composant liste des stories). C'est Insyder lui-même qui documente, dans son propre produit, que le comptage de viewers qu'il affiche est plafonné par Instagram — cohérent avec le "floor" déjà documenté sur les likers dans l'audit HikerAPI (Phase 1/2).

**Important** : ce que cet appel retourne dans ce composant précis est un **comptage agrégé par story** (`spectateurs`, `total` — des nombres), pas la liste nominative individuelle. Le composant affichant explicitement la liste nominative par story n'a pas pu être localisé dans ce build (voir §4.7 — limite honnête).

### 4.6 Le HAR réseau capturé n'apporte aucune preuve supplémentaire sur ce sujet
`OBSERVÉ` — `app.insyder.io.har` (86 entrées) capture uniquement le trafic du site marketing/FAQ et un ensemble d'actions Discovery déjà connu (`decouverteProfil`, `decouverteStatut`, `myAccounts`, `reglagesVisibilite`, etc.). Aucune des actions liées aux Story Viewers/sessions Instagram n'y apparaît — ce HAR documente une navigation qui n'a pas exercé ces écrans, pas une preuve que ces fonctionnalités n'existent pas (elles sont prouvées par ailleurs, §4.1-4.5).

### 4.7 Limite honnête de cette investigation
`INCONNU` — le call-site exact reliant `list_reel_media_viewer` (prouvé côté Electron, §4.2) à la fonctionnalité `storiesSpectateurs`/liste nominative affichée en production (prouvée côté contrat GraphQL, §4.4-4.5) n'a pas été localisé dans ce build précis. Deux hypothèses restent ouvertes et sont explicitement classées `INFÉRENCE`, jamais présentées comme fait :
- `INFÉRENCE` — le backend serveur d'Insyder (Lambda/AppSync resolver, non accessible) rejoue les cookies reçus via `saveInstagramSession` pour appeler lui-même `list_reel_media_viewer` en tâche de fond (Architecture 2 de la mission — "session serveur").
- `INFÉRENCE` — le mécanisme de capture visible côté Electron (`fetchStats`/`IN_PAGE_ANALYSIS`) est l'unique voie de collecte réelle, et le rôle de `saveInstagramSession` se limite à conserver un identifiant de session pour d'autres usages (ex. réauthentification, égress IP cohérente) sans que le backend ne rejoue systématiquement les cookies pour du scraping actif.

Nous n'avons **pas** le code du backend Lambda/resolver d'Insyder. Toute affirmation plus précise sur "comment leur production collecte réellement les viewers aujourd'hui" serait une invention.

## 5. Private Instagram API

`/api/v1/media/{story_pk}/list_reel_media_viewer/` est un endpoint de l'API privée mobile/web d'Instagram (préfixe `/api/v1/`, jamais documenté publiquement par Meta). `DOCUMENTÉ` dans aucun canal officiel Meta. `PROUVÉ PAR LE CODE` comme fonctionnel dans le contexte spécifique d'un navigateur authentifié chargeant réellement `instagram.com` (voir §4.2) — au moment de l'extraction du code (build Insyder de septembre 2026), pas garanti stable dans le temps.

## 6. Meta officiel

`DOCUMENTÉ` — l'API Graph officielle (`src/lib/instagram/api.ts` dans ClosRM, déjà en place) expose `fetchStoryInsights` pour le compte **propre** du coach connecté (`views, reach, replies, shares, navigation, follows, profile_visits` — des agrégats), jamais une liste nominative de viewers, y compris pour son propre compte via l'API (cette donnée n'est visible que dans l'app Instagram native du propriétaire). `NON DISPONIBLE` pour tout compte tiers, par design de la plateforme — confirmé par l'audit Phase 1, reconfirmé ici sans élément nouveau contredisant ce point.

## 7. HikerAPI

`PROUVÉ PAR LE RÉSEAU` (POC Phase 2) — aucun endpoint parmi les 157 du schéma OpenAPI audité n'expose de story viewers. `NON DISPONIBLE`, confirmé deux fois (audit Phase 1 par lecture de la doc, POC Phase 2 par recherche exhaustive des 157 paths). Rien de nouveau trouvé dans cette phase qui contredise ce point.

## 8. Apify

`OBSERVÉ` — l'intégration Apify actuelle de ClosRM (`src/lib/apify/`) ne couvre que les likers d'un post surveillé (`processLikersDataset`, type `like` uniquement). Aucune fonctionnalité équivalente aux story viewers n'existe dans l'actor/pipeline actuellement branché. `INCONNU` si un actor Apify tiers existe sur le marketplace Apify capable de le faire — non recherché dans cette phase (hors périmètre : la question porte sur l'architecture ClosRM, pas sur un nouveau shopping de providers).

## 9. Web-only feasibility

Question posée : peut-on ouvrir Instagram depuis le navigateur de l'utilisateur final de ClosRM (le coach) et utiliser sa session pour appeler `list_reel_media_viewer` depuis l'app web ClosRM elle-même ?

`NON` — pour des raisons structurelles du modèle de sécurité web, pas par manque d'un bypass à trouver :
- **Same-origin policy** : une page servie depuis `closrm.io` (ou équivalent) ne peut pas lire les cookies du domaine `instagram.com`, ni exécuter de JavaScript dans le contexte d'une page `instagram.com` ouverte dans un autre onglet/fenêtre. C'est une garantie du navigateur, pas une configuration contournable côté serveur.
- **iframe** : Instagram envoie `X-Frame-Options`/`Content-Security-Policy: frame-ancestors` qui empêchent l'intégration d'`instagram.com` dans une iframe d'un site tiers — confirmé par le comportement public bien connu d'Instagram (bloque systématiquement l'embedding), `DOCUMENTÉ` par l'usage général du web, pas re-testé spécifiquement dans cette phase.
- **Popup** : une popup Instagram ouverte depuis ClosRM serait une fenêtre de navigateur séparée, dont le contenu (cookies, DOM) reste totalement inaccessible au script ClosRM d'origine (`window.opener` ne permet aucune lecture cross-origin du contenu de la popup).
- **Third-party cookies** : même si une requête réussissait à atteindre `instagram.com` depuis un contexte tiers, le blocage des cookies tiers (déjà généralisé sur Safari, en déploiement sur Chrome) empêcherait Instagram de reconnaître une session existante dans ce contexte.

**Conclusion §9** : un SaaS web classique ne peut techniquement pas reproduire ce qu'Insyder fait avec Electron. Ce n'est pas un choix d'ingénierie de ClosRM, c'est une limite du modèle de sécurité des navigateurs web appliquée à un domaine tiers non coopératif (Instagram ne fournit aucune API cross-origin officielle pour ce cas d'usage).

## 10. Browser automation feasibility (backend)

Question posée : un backend ClosRM pourrait-il piloter un navigateur headless (Playwright/Puppeteer/CDP) pour obtenir le même contexte authentifié ?

`OUI, TECHNIQUEMENT POSSIBLE, MAIS AVEC UN COÛT ET UN RISQUE DIFFÉRENTS D'ELECTRON` — un navigateur Chromium piloté côté serveur (Playwright, par exemple) peut ouvrir une vraie page `instagram.com`, gérer un login, et exécuter du JS dans ce contexte exactement comme le fait la `BrowserWindow` cachée d'Insyder (`fetchStats`, §4.2) — le mécanisme est le même Chromium sous-jacent, qu'il tourne dans Electron sur la machine de l'utilisateur ou dans un conteneur serveur.

Différences structurantes par rapport à Electron :
- **Origine de la connexion réseau** : un navigateur serveur appelle Instagram depuis une IP de datacenter, pas depuis l'IP résidentielle du coach — ceci reproduit exactement le problème identifié en Phase 1 sur HikerAPI (IP datacenter = pattern de bot plus facilement détecté qu'une IP résidentielle utilisateur). C'est précisément la raison technique pour laquelle Insyder choisit Electron plutôt qu'un serveur : faire porter la connexion par le navigateur réel de l'utilisateur, sur son réseau réel.
- **Login** : le coach devrait taper ses identifiants Instagram dans un contexte serveur distant qu'il ne voit pas directement (streaming vidéo du navigateur headless, ou un flux détourné) — UX dégradée et perception de confiance très différente d'un vrai navigateur local.
- Aucune dépendance Playwright/Puppeteer/Electron n'existe actuellement dans `package.json` de ClosRM — vérifié, confirmé absente.

**Conclusion §10** : possible en théorie, mais reproduit un problème d'IP déjà documenté comme défavorable (Phase 1/2), sans apporter l'avantage principal d'Electron (IP résidentielle légitime de l'utilisateur). Pas retenu comme option privilégiée.

## 11. Electron feasibility

| Élément | Apporté par Electron | Preuve |
|---|---|---|
| Chromium local | OUI | Electron embarque un vrai moteur Chromium — fait d'architecture Electron, pas spécifique à Insyder |
| Partition persistante | OUI | `session.fromPartition('persist:ig-<userKey>')`, `instagram.js` §Phase 1 — cookies survivent au redémarrage de l'app |
| Contexte Instagram authentique | OUI | La `BrowserWindow`/`<webview>` charge réellement `https://www.instagram.com/`, pas une simulation |
| Cookies first-party | OUI | Les cookies sont posés par Instagram lui-même sur son propre domaine, dans le contexte de la partition — jamais volés côté réseau |
| Login natif | OUI | L'utilisateur tape ses identifiants directement dans la page Instagram réelle affichée dans l'app, comme dans n'importe quel navigateur |
| Session persistante | OUI | Confirmé, même mécanisme que ci-dessus |
| JS exécuté dans le contexte Instagram | OUI | `webContents.executeJavaScript(script, true)` sur la `BrowserWindow` chargée sur `instagram.com` — exécution same-origin réelle |
| Exécution de la requête privée en contexte authentifié | OUI | §4.2, `list_reel_media_viewer` appelé ainsi et fonctionnel au moment du build audité |

**Conclusion §11** : chacun des éléments listés est `OUI` avec preuve directe issue du code, pas une supposition — c'est la conclusion la plus solidement établie de ce document.

## 12. Session architecture (WebView vs BrowserWindow, et les 3 architectures)

### WebView vs BrowserWindow — ce qu'Insyder utilise réellement
`PROUVÉ PAR LE CODE` :
- **Login** : un `<webview>` intégré dans la fenêtre principale de l'app (mentionné explicitement dans `main.js`, commentaire *"Enables the embedded <webview> the renderer uses for Instagram login"*, `webviewTag: true`). Le `<webview>` porte la partition `persist:ig-<userKey>` choisie par le renderer.
- **Analyse** (`fetchStats`) : une **`BrowserWindow` séparée, cachée** (`show: false`), construite avec les mêmes `webPreferences: { session: ses }` pointant sur la même partition — pas le même composant que le `<webview>` de login, mais partageant la session capturée. `main.js` durcit explicitement tout `<webview>` attaché (`will-attach-webview` : retire le preload, force `nodeIntegration: false`).

**Est-ce indispensable ?** `OUI pour le WebView (login)` — nécessaire pour offrir un vrai formulaire de connexion Instagram interactif à l'utilisateur, avec un rendu visible. `OUI pour la BrowserWindow (analyse)` — nécessaire pour exécuter du JS dans un contexte réellement authentifié same-origin ; un simple client HTTP (fetch côté Node, sans navigateur) ne suffit pas, car Instagram distingue une requête XHR authentique émise depuis sa propre page (avec tous les en-têtes `sec-fetch-*`, référer, etc.) d'un appel HTTP brut — c'est exactement le commentaire du code d'Insyder lui-même : *"A bare server-style fetch from the main process gets 401'd from a home/residential IP; a real browser context does not."*

Un `BrowserView`/`WebContents` nu (sans fenêtre visible) suffirait probablement techniquement à la place d'une `BrowserWindow` cachée — Insyder choisit une `BrowserWindow` avec `show: false`, ce qui revient au même résultat fonctionnel. `INCERTAIN` s'il y a une raison technique précise de préférer l'un à l'autre au-delà de la simplicité d'implémentation Electron.

### Les trois architectures de session (§5 de la mission)

| | Architecture 1 — Session locale | Architecture 2 — Session serveur | Architecture 3 — Browser worker |
|---|---|---|---|
| **Description** | Login + requête privée + résultats, tout exécuté localement dans Electron ; seuls les résultats normalisés remontent à ClosRM | Login local, mais les cookies bruts sont envoyés au backend qui rejoue lui-même les requêtes privées | Login local, backend orchestre un navigateur serveur (Playwright) qui répète les requêtes |
| **Ce qu'Insyder fait réellement** | Le mécanisme `fetchStats` (§4.2) fonctionne ainsi | Le contrat `saveInstagramSession` (§4.3) montre que les cookies **sont aussi** envoyés au backend | `INCONNU` si utilisé — pas de preuve trouvée |
| **Sécurité** | Meilleure — les cookies ne quittent jamais la machine de l'utilisateur | Moindre — une base de données de cookies Instagram valides devient une cible de grande valeur | Équivalente à Architecture 2 côté stockage, avec un composant serveur supplémentaire à sécuriser |
| **Complexité** | Faible côté serveur (juste ingestion de résultats déjà normalisés) | Élevée — nécessite de rejouer des requêtes privées Instagram depuis un backend, avec gestion de la même contrainte d'origine (IP datacenter, §10) que HikerAPI | Élevée, cumul des deux problèmes |
| **Maintenance** | Le format des endpoints privés peut changer ; la mise à jour se fait via une release de l'app Electron | Idem, plus la gestion d'un pool de sessions cookies avec leur propre cycle de vie serveur | Idem + maintenance d'une flotte de navigateurs headless |
| **Confidentialité** | Meilleure — pas de session Instagram stockée côté ClosRM | Moins bonne — implique de stocker des cookies de session Instagram, une donnée hautement sensible | Identique à Architecture 2 |
| **Risque de session** | Localisé à la machine de l'utilisateur | Centralisé — la compromission du backend expose toutes les sessions actives | Identique à Architecture 2 |
| **Logout** | Simple — effacer la partition locale | Nécessite une invalidation côté backend en plus | Identique à Architecture 2 |
| **Multi-workspace** | Naturel — une partition par `userKey` déjà en place chez Insyder | Nécessite un mapping session ↔ workspace côté backend | Identique à Architecture 2 |
| **Scalabilité** | Distribuée sur les machines des utilisateurs, pas de coût serveur de calcul | Coût serveur croissant avec le nombre de comptes suivis | Coût serveur le plus élevé (calcul + navigateurs) |
| **Résilience** | Dépend de la présence de l'app ouverte sur la machine du coach | Fonctionne même app fermée, si le backend a déjà les cookies | Idem |

**Recommandation d'architecture si Electron est retenu** : **Architecture 1 (session locale)**, à l'opposé du choix qu'Insyder semble faire au moins partiellement (§4.3 prouve que des cookies transitent vers leur backend, même si l'usage exact reste `INFÉRENCE`). Une architecture où le Connector ClosRM exécute la requête privée localement et ne transmet que des résultats déjà normalisés (viewers déjà identifiés, jamais le cookie brut) réduit drastiquement la surface de risque de sécurité (§14) sans sacrifier la fonctionnalité.

## 13. Story Viewer historical model

`OBSERVÉ` (comportement Instagram bien documenté par l'écosystème indépendant, pas par Meta officiellement) — les stories Instagram expirent après 24h par défaut (sauf mise en avant/"à la une"), et la liste de leurs viewers n'est, à la connaissance générale du secteur, **pas garantie accessible après expiration**, y compris pour le propriétaire du compte dans l'app native. Le commentaire trouvé en dur dans le code d'Insyder (§4.5, *"Instagram truncates a story's viewer list"*) est cohérent avec cette contrainte, mais documente une **troncature de volume**, pas explicitement une fenêtre temporelle — les deux limitations sont probablement réelles mais distinctes, et **INCONNU** avec certitude absolue laquelle domine dans quel cas sans test direct.

**Conséquence directe pour ClosRM (§11 de la mission)** : si les viewers ne sont accessibles que pendant que la story est active, une collecte ponctuelle à la demande (l'utilisateur clique "voir les viewers" après coup) est **structurellement insuffisante**. Un mécanisme de collecte régulière et proactive serait nécessaire :
```
Instagram connecté → scheduler → Stories actives détectées → collecte viewers → historisation → ClosRM
```
Ceci change significativement la portée de tout Connector Electron éventuel : il ne s'agirait pas d'un outil "à la demande", mais d'un processus qui doit tourner en tâche de fond régulièrement tant que l'app Electron est ouverte (ou une architecture serveur qui, elle, retombe sur les problèmes d'IP/origine déjà identifiés en §10).

## 14. Security

**Risque technique** : l'endpoint `/api/v1/media/{id}/list_reel_media_viewer/` est privé et non versionné publiquement — Instagram peut le modifier, le renommer ou en changer le comportement sans préavis, à tout moment. Le comportement peut différer selon le type de compte (personnel vs créateur vs business) — `INCONNU` si testé par Insyder sur les trois cas.

**Risque sécurité** : la question centrale posée par la mission (§5) trouve une réponse directe dans le §4.3 — Insyder envoie bien des cookies bruts à un backend. Ceci démontre qu'un choix "Architecture 2" **est possible en pratique** (quelqu'un le fait), mais l'analyse comparative du §12 montre que ce n'est pas le choix le plus sûr. **Aucune session réelle n'a été manipulée, affichée, loggée ou stockée pendant cette phase** — conformément à la contrainte absolue de la mission.

**Risque produit** : voir §17 (maintenance desktop).

**Risque plateforme/CGU** : ce qui est officiel (Meta Graph API, avec ses scopes documentés) est clairement distinct de ce qui ne l'est pas (l'endpoint privé `/api/v1/...`, jamais documenté par Meta, jamais couvert par un accord de plateforme). Utiliser cet endpoint, via Electron ou tout autre moyen, crée une dépendance à un comportement non contractuel qui peut changer sans préavis, et constitue un usage hors du cadre que Meta prévoit pour les intégrations tierces. Je ne donne aucun avis juridique — ceci nécessiterait une validation compliance/juridique explicite avant tout engagement produit, comme le souligne la mission elle-même.

## 15. Comparaison avec Insyder

Insyder utilise Electron. Ce fait seul ne prouve pas que ClosRM doit devenir Electron — la preuve technique établie (§11) montre que c'est une **solution suffisante**, pas qu'elle est **la seule possible**, ni que **toute l'app** doit devenir Electron pour l'obtenir.

- **Ce qu'Insyder fait réellement** : un produit desktop complet (Electron), dont l'intégralité de l'interface (`renderer/`) est servie localement ou depuis `app.insyder.io`, avec le module Instagram-session intégré au même processus.
- **Ce que ClosRM devrait faire** : garder son CRM entièrement web (aucune preuve trouvée justifiant l'inverse), et n'introduire un composant desktop que pour la portion strictement nécessaire — capturer une session Instagram et exécuter la requête privée dans ce contexte. C'est exactement la distinction Option B (Connector) vs Option C (Full Electron) posée par la mission.
- **Ce dont ClosRM a réellement besoin** : selon que la fonctionnalité Story Viewers nominatifs devienne ou non un objectif produit assumé — voir §21 Décision.

## 16. UX

Un Connector desktop introduit une rupture de parcours par rapport au SaaS web actuel : le coach devrait télécharger, installer, et laisser tourner une application séparée pour bénéficier de cette fonctionnalité — alors que tout le reste de ClosRM (y compris Meta et Hiker) fonctionne sans rien installer. C'est un coût d'adoption réel, à mettre en balance avec la valeur perçue de la fonctionnalité "qui regarde mes stories sans interagir" pour un coach indépendant. Non quantifiable dans le cadre de cette phase (pas de donnée utilisateur disponible) — `INCONNU`.

## 17. Desktop maintenance

Si un Connector Electron est construit, ClosRM prendrait en charge un cycle de release logiciel desktop complet, actuellement inexistant dans son organisation :
- Build et signature pour macOS (notarisation Apple obligatoire depuis plusieurs années pour toute distribution hors App Store) et Windows (signature de code, sans quoi Windows Defender/SmartScreen avertit activement l'utilisateur).
- Distribution : hébergement des binaires, page de téléchargement, versioning.
- Auto-update : mécanisme à maintenir pour pousser les correctifs quand Instagram change son comportement (probable, vu §14).
- Support utilisateur pour les crashs, problèmes d'installation, blocages antivirus/OS spécifiques à chaque plateforme.
- Linux : `INCONNU` si nécessaire pour la base utilisateur ClosRM (coachs indépendants — probablement majoritairement macOS/Windows, non vérifié).

C'est un coût organisationnel réel et récurrent, pas un coût de développement ponctuel — à budgéter explicitement si l'option B ou C est retenue.

## 18. Capability matrix

| Fonction | Meta officiel | HikerAPI | Apify | Private IG | Electron | Preuve |
|---|---|---|---|---|---|---|
| Profil | PROUVÉ | PROUVÉ | NON DOCUMENTÉ | PROUVÉ | PROUVÉ | Phase 1/2, §4.1 |
| Posts | PROUVÉ (compte propre) | PROUVÉ | NON DOCUMENTÉ | PROUVÉ | PROUVÉ | Phase 2, POC |
| Reels | PROUVÉ (compte propre) | PROUVÉ | NON DOCUMENTÉ | PROUVÉ | PROUVÉ | Phase 2, POC |
| Likers | NON DISPONIBLE | PROUVÉ (plafonné) | PROUVÉ (type `like` seul) | PROUVÉ | PROUVÉ | Phase 1/2 |
| Commentaires | PROUVÉ (compte propre) | PROUVÉ | NON DOCUMENTÉ | NON DOCUMENTÉ | INCONNU | Phase 2 |
| Followers | NON DISPONIBLE | PROUVÉ | NON DOCUMENTÉ | PROUVÉ | PROUVÉ | Phase 1/2 |
| Following | NON DISPONIBLE | PROUVÉ | NON DOCUMENTÉ | NON TESTÉ | INCONNU | Phase 2 |
| Stories (actives) | PROUVÉ (compte propre) | PROUVÉ | NON DOCUMENTÉ | PROUVÉ | PROUVÉ | Phase 2, §4.2 |
| Story Viewers | NON DISPONIBLE | NON DISPONIBLE | NON DOCUMENTÉ | PROUVÉ PAR LE CODE | PROUVÉ PAR LE CODE | §4.2, §4.5 |
| Reel Viewers | NON DISPONIBLE | NON DISPONIBLE | NON DOCUMENTÉ | NON DOCUMENTÉ | INCONNU | Aucune preuve trouvée, y compris chez Insyder |
| Story replies | PROUVÉ (compte propre, `fetchStoryInsights`) | NON DOCUMENTÉ | NON DOCUMENTÉ | INCONNU | INCONNU | `src/lib/instagram/api.ts` |
| DM | PROUVÉ (compte propre) | NON DOCUMENTÉ | NON DOCUMENTÉ | INCONNU | INCONNU | `src/lib/instagram/api.ts` |
| Insights | PROUVÉ (compte propre) | NON DOCUMENTÉ | NON DOCUMENTÉ | INCONNU | INCONNU | `src/lib/instagram/api.ts` |
| Lurkers (défini par ClosRM) | NON APPLICABLE (concept produit, pas donnée brute) | POSSIBLE (composite depuis stories+interactions) | NON | POSSIBLE | POSSIBLE | Concept dérivé, jamais une donnée native — cohérent avec la mise en garde de la Phase 1 mission |
| Audience historique | NON DISPONIBLE | NON DISPONIBLE (pas d'historisation propre) | NON | POSSIBLE (si collecte régulière) | POSSIBLE (si collecte régulière) | §13 |

## 19. Unknowns

- Le call-site exact reliant `list_reel_media_viewer` à `storiesSpectateurs` en production Insyder (§4.7).
- Si les cookies envoyés via `saveInstagramSession` sont réellement rejoués côté serveur aujourd'hui, ou stockés à d'autres fins.
- La fenêtre temporelle exacte de disponibilité des viewers après expiration d'une story (probablement nulle ou très courte, non confirmée avec une source technique de premier rang).
- Le comportement de l'endpoint privé selon le type de compte (personnel/créateur/business).
- La stabilité de cet endpoint dans le temps au-delà de la date d'observation (septembre 2026).
- L'appétit réel des coachs ClosRM pour une fonctionnalité nécessitant une installation desktop (aucune donnée utilisateur disponible).
- Si un actor Apify tiers existant pourrait couvrir ce besoin sans Electron (non recherché, hors périmètre de cette phase).

## 20. POC proposal

Si l'analyse ci-dessus est jugée suffisante pour justifier une vérification empirique avant décision finale, un POC minimal isolé est proposé (non construit dans cette phase) :

```
tools/instagram-private-poc/
```

Objectif unique : vérifier, sur un compte Instagram de test contrôlé, que le endpoint `list_reel_media_viewer` fonctionne encore en septembre 2026 dans un contexte Chromium/Electron authentifié — sans reproduire l'architecture complète d'un Connector de production.

Étapes du POC : ouverture d'Instagram dans un contexte Electron local, login utilisateur manuel, détection de session via `current_user`, identification des stories actives, tentative de récupération des viewers, affichage local du résultat. Contraintes : aucune touche à Supabase, à la production, à Hiker, à Apify, ou à Meta OAuth ; aucun cookie stocké dans le repo ou envoyé à ClosRM.

## 21. Architecture options

### OPTION A — Web uniquement
ClosRM reste Next.js/web, Meta OAuth + HikerAPI + Apify legacy. Story Viewers nominatifs restent hors périmètre produit. **Le plus cohérent avec la structure actuelle de l'équipe et du produit.**

### OPTION B — ClosRM Web + Electron Connector
Le CRM reste entièrement web. Un petit Connector Electron séparé gère uniquement : connexion Instagram, session locale, collecte de la donnée privée, synchronisation vers ClosRM. Architecture recommandée en §12 : **session locale (Architecture 1)**, jamais l'envoi des cookies bruts au backend ClosRM.

### OPTION C — ClosRM entier en Electron
Aucun élément de cette analyse ne justifie de transformer l'ensemble de ClosRM en application Electron. Le besoin identifié (session Instagram authentifiée) est strictement localisé et ne requiert pas que le CRM entier tourne dans ce contexte.

## 22. Décision

```
WEB ONLY
GO

ELECTRON CONNECTOR
CONDITIONAL

FULL ELECTRON APP
NO-GO

PRIVATE INSTAGRAM POC
CONDITIONAL
```

**WEB ONLY — GO.** C'est l'architecture à conserver pour tout le périmètre déjà couvert par Meta, Hiker et Apify. Rien dans cette analyse ne remet en cause ce choix pour 90%+ des fonctionnalités Discovery déjà en place ou en cours d'intégration (Phase 3/3.5).

**ELECTRON CONNECTOR — CONDITIONAL.** Techniquement justifié et prouvé faisable (§11) uniquement si les Story Viewers nominatifs / audience silencieuse deviennent un objectif produit assumé par ClosRM. La condition n'est pas technique — elle est produit : est-ce que cette fonctionnalité vaut le coût d'adoption (installation desktop, §16) et le coût de maintenance récurrent (§17) qu'elle impose ? Cette question dépasse le périmètre technique de cette phase. Si retenu, l'architecture recommandée est la session locale (§12, Architecture 1), pas le modèle "cookies envoyés au serveur" qu'Insyder semble au moins partiellement pratiquer.

**FULL ELECTRON APP — NO-GO.** Aucune preuve, aucun raisonnement technique rencontré dans cette analyse ne justifie de sortir ClosRM de son modèle web actuel dans son ensemble.

**PRIVATE INSTAGRAM POC — CONDITIONAL.** À lancer seulement si la décision produit en amont (Connector oui/non) penche vers un GO explicite. Le POC lui-même est peu coûteux et rapide (§20) — sa valeur est de confirmer empiriquement que l'endpoint privé fonctionne encore aujourd'hui, avant d'investir dans l'architecture complète d'un Connector.

---

## Réponses aux 8 questions de la mission

**Q1 — Electron est-il nécessaire pour Meta officiel ?** Non. Meta officiel fonctionne déjà entièrement en web dans ClosRM (`src/lib/instagram/api.ts`), OAuth standard, aucune session navigateur requise.

**Q2 — Electron est-il nécessaire pour HikerAPI ?** Non. HikerAPI est un simple appel API REST avec une clé, backend-only, aucun contexte navigateur requis (`src/lib/hiker/`).

**Q3 — Electron est-il nécessaire pour Story Viewers ?** Oui, dans l'état actuel de la plateforme Instagram et des providers disponibles (Meta, Hiker, Apify) — aucun des trois ne peut fournir cette donnée par un autre moyen identifié dans cette analyse.

**Q4 — Peut-on obtenir Story Viewers depuis un SaaS web classique ?** Non — démontré structurellement au §9 (same-origin policy, blocage iframe, cookies tiers), pas par manque d'essai de contournement.

**Q5 — Si non, pourquoi exactement ?** Parce qu'obtenir cette donnée exige d'exécuter une requête authentifiée dans le contexte natif d'`instagram.com`, ce qu'un navigateur ne permet jamais à un site tiers de faire pour un domaine qui ne coopère pas (Instagram ne propose aucune API cross-origin pour ce cas).

**Q6 — Est-ce qu'un petit Connector Electron suffit ?** Oui — rien dans cette analyse n'indique qu'il faille davantage qu'un Connector limité au périmètre "session Instagram + requête privée + synchronisation", le reste du produit restant web.

**Q7 — Faut-il transformer tout ClosRM en Electron ?** Non — aucun élément trouvé ne le justifie.

**Q8 — Quel POC faut-il réaliser avant la décision finale ?** Le POC minimal décrit au §20 : vérifier sur un compte de test contrôlé, dans un contexte Electron local, que `list_reel_media_viewer` répond encore aujourd'hui — avant tout investissement dans un Connector complet.
