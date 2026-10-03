# Audit ClosRM — sécurité, vitesse, workflow (nuit du 1er au 2 octobre 2026)

Périmètre : API Next.js (`src/app/api`), base Supabase (migrations, RLS), app desktop Electron (`electron/`). Mesures faites en prod (closrm.fr, Vercel fra1 → Supabase Francfort) et dans des instances isolées de l'app.

## 1. Sécurité

### Corrigé (en prod via #582, ou dans #583 à fusionner)

| Sévérité | Problème | Correctif | PR |
|---|---|---|---|
| Haute | `GET` et `POST /api/instagram/account` renvoyaient toute la ligne `ig_accounts`, **jetons d'accès Meta compris** (`access_token`, `page_access_token`), à tout membre du workspace. | Liste de colonnes publiques `IG_ACCOUNT_PUBLIC_COLS`, sans les jetons (`src/lib/instagram/link-account.ts`). | #582 |
| Haute | Webhooks SES / SNS (e-mails entrants, rebonds) non signés : on ne vérifiait que le `TopicArn`, une valeur que l'expéditeur écrit lui-même. Quelqu'un qui connaît l'ARN pouvait injecter de faux e-mails, de faux rebonds (blocage d'adresses) ou faire appeler une URL au serveur via `SubscribeURL`. | Vérification cryptographique SNS (certificat de `sns.<région>.amazonaws.com`, RSA-SHA1 et SHA256), `SubscribeURL` limitée aux domaines SNS (`src/lib/email/sns-verify.ts`). En cas d'urgence, mettre `SNS_VERIFY=off`. | #582 |
| Haute | Tables internes `pm_boards`, `pm_tasks`, `sprint_weeks`, `sprint_day_kpis` sans RLS : lisibles, et modifiables, avec la clé anon publique (vérifié : 200 OK sans connexion). | **Migration 124** (RLS sans politique ; le serveur les lit avec la clé service). | #583 |
| Moyenne | Webhook Meta (leads publicitaires) non signé. | Vérification `X-Hub-Signature-256` à temps constant, partagée avec le webhook Instagram (`src/lib/meta/webhook-signature.ts`). Active si `META_APP_SECRET` est défini. | #582 |
| Moyenne | La clé API IA du coach était renvoyée en clair par `GET /api/ai/brief`. | Clé masquée (4 derniers caractères) ; à l'enregistrement, la valeur masquée conserve la clé stockée. | #583 |
| Moyenne | App desktop : la fenêtre principale pouvait être emmenée vers une page externe, qui aurait eu accès à l'API du preload (session Supabase). | Garde `will-navigate` (les liens externes s'ouvrent dans le navigateur) ; les IPC de session ne répondent qu'aux pages de l'app ; CSP sans `unsafe-inline` dans l'app compilée (`electron/main/index.ts`). | #582 |
| Basse | Recherches libres (leads, calls, follow-ups, ciblage) insérées telles quelles dans les filtres `or()` de PostgREST : une virgule cassait la requête ou ajoutait une condition. Pas de fuite entre workspaces (RLS et filtre `workspace_id` restent appliqués). | `orSearchTerm()` (`src/lib/supabase/or-search.ts`). | #582 |
| Basse | Fonctions `SECURITY DEFINER` sans `search_path` figé (lint Supabase). | **Migration 125** (fige le `search_path` de toutes ces fonctions, sans avoir à connaître leurs signatures). | #583 |

### Vérifié, OK
- Tous les crons vérifient leur secret ; le webhook Instagram vérifiait déjà sa signature.
- Les routes qui modifient des données avec la clé service (suppressions d'e-mails, workflows, publication sociale, membres…) filtrent bien sur le workspace de l'appelant.
- CORS : liste blanche d'origines exactes, sans cookies.
- Electron : `contextIsolation`, `sandbox`, pas de `nodeIntegration`, ouverture de fenêtres refusée, liens externes limités à http(s). La fenêtre instagram.com cachée n'a pas de preload et tourne dans une partition isolée.
- `billing_plans` : lecture publique voulue, aucune écriture possible.
- Buckets publics (logos, pièces jointes d'e-mails, brouillons et médias de stories) : voulus, les URL sont envoyées par e-mail ou publiées.

### À décider (non fait)
1. **Jetons Meta lisibles par tout membre du workspace via l'API Supabase** (RLS par workspace sur `ig_accounts` et `ai_coach_briefs`). Correctif proposé : déplacer les jetons dans `integrations` (déjà chiffré), ou retirer le droit `select` sur ces colonnes au rôle `authenticated` et passer les routes concernées (commentaires, messages, conversations, synchro) au client service.
2. **Vérification des jetons sans appeler Supabase Auth** à chaque requête (incident du 1er octobre : Auth bloqué = API bloquée). Il faut passer aux clés de signature JWT asymétriques (dashboard), puis utiliser `auth.getClaims()`.
3. Ta capture d'écran HikerAPI du 18 septembre montre la clé d'accès en clair : régénère-la si cette capture a circulé.

## 2. Vitesse

Mesures en prod, connexion maintenue, médiane sur 5 appels :

| Écran / route | Avant | Après |
|---|---|---|
| App desktop, démarrage (JS chargé) | 1,18 Mo | **563 Ko** (une page = un morceau, toutes préchargées après le démarrage) |
| Publicités (clic → contenu, 2ᵉ visite) | 8,1 s | **0,04 s** |
| Statistiques | 1,6 s | **0,05 s** |
| Finance | 0,3 s | **0,03 s** |
| Toutes les pages, version compilée, en cache | — | **< 20 ms** |
| `GET /api/instagram/people` (Leads Instagram) | 1,2 s (13 s au pire) | **0,35 s** (2 s au pire) |
| Fiche profil `/api/instagram/people/:username` | — | 0,42 s |
| Panneau « Qui a réagi » | — | 0,67 s (265 Ko pour 375 personnes) |

Ce qui a changé :
- **cache d'abord partout** : chaque écran affiche ses dernières données tout de suite, puis se rafraîchit en arrière-plan ;
- **préchargement** des écrans récents au démarrage et au retour sur la fenêtre ;
- **délai max de 60 s** sur les lectures, au lieu d'attendre indéfiniment ;
- synchro DM en arrière-plan au plus toutes les 10 min ;
- index Leads Instagram allégé : les photos et noms ne sont chargés que pour les lignes affichées.

Restent lents (non critiques, l'app les masque grâce au cache) :
- `/api/desktop/dashboard` : 2 s en médiane, mais **n'est utilisée par aucun écran** (le dashboard desktop est calculé côté client depuis le cache). À supprimer ou à optimiser si le mobile l'utilise.
- `/api/leads/grouped` (Pipeline) : 0,85 s, 183 Ko.
- Premier appel d'une route peu utilisée : 1,5 à 3 s (démarrage à froid des fonctions Vercel).

## 3. Workflow

- **Pages retirées** : Interactions (l'ancienne adresse redirige vers Audience). Dans Audience, les doublons de Leads Instagram : « Qui like vos réels », lurkers des stories, tableau des segments CRM.
- **Audience façon Insyder** : trois cartes (Personnes actives, Ne vous suivent pas, Lurkers), chacune ouvre la bonne liste dans Leads Instagram.
- **Code mort supprimé** : `Badge`, `settings/tab-groups`, `publish-timing` (remplacé par « Quand publier »), `LikersSection`.
- **Gardé volontairement** : l'onglet Inbox de Réseaux sociaux. Ce n'est pas un doublon de Messages : il réunit DM et commentaires classés par intention, avec conversion en lead.
- **Navigation** : toute personne affichée quelque part (panneau d'un réel, story, Leads Instagram) ouvre sa fiche lead si c'est un lead CRM, sinon sa fiche profil, où l'on peut l'ajouter en lead.

## 4. À faire de ton côté

1. Appliquer les **migrations 124 et 125** dans le projet `hsnqmjsckekbmmwneybb`.
2. Fusionner la PR **#583**.
3. Décider des points « À décider » ci-dessus.
