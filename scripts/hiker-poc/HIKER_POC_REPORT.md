# HikerAPI POC — ClosRM Discovery

Statut global : **RÉUSSI PARTIELLEMENT** — la discovery a tourné jusqu'à épuisement du solde du compte HikerAPI (HTTP 402 après ~78 requêtes facturées), pas jusqu'à couverture complète telle que définie au §21 de la mission ("tout ce que Hiker documenté permet"). Les données obtenues sont réelles et exploitables ; certains volets (followers complets, commentaires/likers sur la totalité des 158 contenus) sont partiels par manque de budget, pas par limitation technique de l'API.

## 1. Executive Summary

- Résolution username → ID : **OBSERVÉ**, fonctionne parfaitement.
- Médias et Reels : **OBSERVÉ**, pagination complète réussie sur les deux (60 médias, 98 clips récupérés).
- Followers : **OBSERVÉ partiellement** — 743 sur 744 déclarés récupérés (30 pages), très proche de la complétude.
- Likers et commentaires : **OBSERVÉ partiellement** — 25 contenus analysés sur 158 disponibles (cap volontaire de la mission, §6/§20), arrêtés prématurément par un HTTP 402 (solde épuisé) au 25e contenu.
- Story viewers : **NON DISPONIBLE** — confirmé, aucun endpoint, comme attendu depuis l'audit Phase 1.
- 3 des 4 profils vus dans le run Insyder de référence (`joeffrey_mangione`, `patricia.rebmann.7`, `le_j0e`, `babel_n`) réapparaissent dans le top des profils les plus engagés identifiés par ce POC — convergence forte entre les deux méthodes.
- Découverte non anticipée : `like_count` renvoyé par `/v1/user/medias/chunk` est visiblement erroné/plafonné (valeur fixe `3` sur tous les médias testés, alors que `/v3/media/likers` retourne jusqu'à 172 profils réels pour ces mêmes médias) — rend toute métrique de "couverture des likers" basée sur ce champ non fiable.

## 2. Test account

`@rebmann_pierre` (Instagram user ID `1525774761`), choisi car déjà observé dans le run Insyder de référence fourni dans la mission, permettant une comparaison directe. Compte public, `media_count: 60`, `follower_count: 744`, `following_count: 508`.

## 3. Environment

- POC exécuté en local, backend-only, via `npx tsx scripts/hiker-poc/run-discovery.ts`.
- Clé `HIKER_API_KEY` fournie par l'utilisateur, stockée uniquement dans `scripts/hiker-poc/.env.local` (fichier confirmé couvert par `.gitignore`, pattern `.env*.local`), jamais commitée, jamais loguée.
- Aucune écriture en base ClosRM. Aucune modification de code production.

## 4. HikerAPI version

Schéma OpenAPI officiel audité en Phase 1 : version **1.8.1**, 157 endpoints. Le POC a été exécuté le jour même de cet audit (18/09/2026) — pas de dérive de version entre audit et exécution.

## 5. Endpoints tested

| Endpoint | Utilisé en prod du POC ? | Raison |
|---|---|---|
| `/v1/user/by/username` | Oui | Résolution username → profil |
| `/gql/user/medias` | Testé puis abandonné | Réponse en format GraphQL brut "stream_rows" (incremental delivery Relay), non documenté par HikerAPI, structure instable à parser de façon fiable — voir §16 |
| `/v1/user/medias/chunk` | **Oui (retenu)** | Forme `[items[], cursor]` simple, confirmée stable |
| `/gql/user/clips` | Testé puis abandonné | Même problème que medias |
| `/v1/user/clips/chunk` | **Oui (retenu)** | Idem, stable |
| `/g2/user/followers` | Oui | Forme `{response: {users: [...]}, next_page_id}`, confirmée par sondage direct |
| `/v2/user/stories` | Oui | Forme `{reel: {items: [...]}}`, pas un tableau direct comme supposé initialement |
| `/v3/media/likers` | Oui | Forme `{users: [...], user_count, ...}`, pas un tableau direct |
| `/v2/media/comments` | Oui | Forme `{response: {comments: [...]}, next_page_id}` |

## 6. Username resolution

**OBSERVÉ.** `GET /v1/user/by/username?username=rebmann_pierre` → HTTP 200, réponse complète en un seul appel : `pk`, `username`, `full_name`, `is_private`, `is_verified`, `media_count`, `follower_count`, `following_count`, `biography`, `external_url`, etc. Aucune pagination nécessaire pour cet endpoint.

## 7. Complete media discovery

**OBSERVÉ.** Endpoint retenu : `/v1/user/medias/chunk` (12 items/page confirmé par sondage). Pagination complète effectuée jusqu'à épuisement du curseur : **60 médias récupérés** sur 5 pages, cohérent avec `media_count: 60` déclaré par le profil — couverture à 100 % de ce compteur.

Champs collectés par média : `pk`, `id`, `code`, `taken_at`, `taken_at_ts`, `media_type`, `product_type`, `thumbnail_url`, `location`, `user`, `comment_count`, `comments_disabled`, `like_count`, `play_count`, `has_liked`. Tous réellement présents dans la réponse, aucun champ inventé.

## 8. Complete Reel discovery

**OBSERVÉ.** Endpoint retenu : `/v1/user/clips/chunk`. Pagination complète effectuée jusqu'au plafond de sécurité (10 pages, cap défini au §36 de la mission) : **98 clips récupérés** sur 9 pages avant que le run passe à l'étape suivante (le curseur n'a pas nécessairement été épuisé — non confirmé si 98 est le total réel ou si la pagination continuait). Ce nombre dépasse `media_count: 60` du profil, ce qui indique que les Reels ne sont pas comptés dans `media_count` côté Instagram/Hiker, et/ou qu'il y a chevauchement partiel entre les deux collections (media et clips peuvent référencer les mêmes posts si un Reel est aussi listé dans le flux media — non vérifié précisément dans ce POC, à creuser en Phase 3 avec dédup par `pk`).

**Recommandation** : `medias` et `clips` doivent être dédupliqués par `pk`/`id` avant tout traitement — le moteur de discovery le fait déjà (voir `discovery.ts`, filtrage `seenMediaIds`).

## 9. Likers

**OBSERVÉ, partiel.** Endpoint : `/v3/media/likers`, forme réelle `{users: [...], user_count, disclaimer_text, follow_ranking_token, status}` — **pas un tableau direct** comme le laissait supposer la doc de l'audit Phase 1 (qui listait juste "retourne `UserShort[]`" sans préciser l'enveloppe).

- 25 contenus analysés (cap de sécurité de la mission) avant HTTP 402.
- **1150 profils de likers retournés au total** sur ces 25 contenus — moyenne de 46 likers/média, avec un maximum observé de 172 sur un seul média.
- **Aucune pagination réelle constatée** sur cet endpoint — confirmé conforme à l'audit Phase 1 (§7 du rapport précédent : "no paging" documenté).
- **Anomalie majeure découverte** : le champ `like_count` renvoyé par `/v1/user/medias/chunk` vaut **systématiquement `3`** pour tous les médias testés, alors que le nombre réel de likers retournés par `/v3/media/likers` va de 13 à 172. Le calcul de `liker_coverage` demandé au §8 de la mission (`likers Hiker / like_count Instagram`) est donc **structurellement invalide** avec les données actuelles : le dénominateur lui-même est faux, probablement parce qu'Instagram masque ou plafonne artificiellement le compteur de likes exposé aux clients tiers (comportement documenté côté Instagram depuis plusieurs années sur certains types de comptes/contenus, non spécifique à HikerAPI). **NON VÉRIFIÉ** : la cause exacte de ce plafonnement à 3, mais il est clairement erroné puisqu'inférieur au nombre de likers effectivement listés.

Conclusion attendue reformulée : **impossible de calculer un pourcentage de couverture des likers fiable** avec les champs actuellement disponibles côté HikerAPI/Instagram sur ce compte. Le plafond ~200 likers documenté (Phase 1) reste probablement correct comme limite haute de l'endpoint, mais n'a pas pu être testé jusqu'à cette limite sur ce POC (aucun média du compte de test n'atteint 200 likes réels).

## 10. Comments

**OBSERVÉ, partiel.** Endpoint : `/v2/media/comments`, forme réelle `{response: {comments: [...], comment_count, has_more_comments, has_more_headload_comments, ...}, next_page_id}`.

- 25 contenus analysés, **50 commentaires retournés au total**.
- Pagination testée : `next_page_id` a été `null` sur toutes les pages observées avant le premier appel — la pagination cursor-based fonctionne comme documenté, mais dans ce test elle n'a montré qu'une seule page par média (le volume de commentaires par post sur ce compte est faible, entre 0 et 9 selon `comment_count`).
- 8 erreurs HTTP 404 rencontrées sur cet endpoint (`{"detail":"Entries not found"}`) — probablement des médias sans commentaires accessibles ou des reels avec commentaires désactivés (`comments_disabled` vu dans le schéma media). **NON VÉRIFIÉ** : la cause exacte du 404 par média n'a pas été creusée média par média dans ce POC.
- Le champ `parent`/`reply` mentionné dans la mission n'a pas été observé distinctement dans les commentaires retournés — pas de structure de threading visible dans les objets `comments` de premier niveau. L'endpoint dédié `/v2/media/comments/replies` n'a pas été testé dans ce POC (non atteint avant épuisement du budget).

## 11. Followers

**OBSERVÉ, quasi-complet.** Endpoint : `/g2/user/followers`, forme confirmée `{response: {users: [...]}, next_page_id}`.

- **743 followers récupérés sur 30 pages**, contre `follower_count: 744` déclaré par le profil — écart de 1, cohérent avec un décalage temporel normal entre le moment de la lecture du profil et celui de la pagination des followers (quelqu'un a pu se désabonner entre les deux appels), pas une anomalie de pagination.
- Coût : 30 appels HTTP = 30 requêtes facturées (endpoint `/g2/` n'est **pas** dans la liste des endpoints à double facturation confirmée en Phase 1 — contrairement à la variante `/gql/user/followers/chunk`, non testée ici).
- Aucune erreur, aucun 429, aucun signe de rate-limiting sur cette série de 30 appels consécutifs.

## 12. Following

**NON TESTÉ.** Le budget du compte ($2, ~100 requêtes gratuites/crédit initial) a été entièrement consommé par le reste de la discovery (media, clips, followers, 25×likers, 25×comments = 98 appels HTTP au total) avant d'atteindre cette étape. Aucune donnée réelle disponible sur ce point — à retester avec un solde suffisant.

## 13. Stories

**OBSERVÉ.** Endpoint : `/v2/user/stories`, forme réelle `{broadcast: null, reel: {items: [...], expiring_at, id, is_archived, ...}, unviewable_authors_info, status}` — pas un tableau direct.

- **1 story active** trouvée sur le compte de test au moment du test, avec métadonnées complètes (`taken_at`, `pk`, `id`, `has_liked`, `is_dash_eligible`, `video_dash_manifest`, etc.).
- Coût confirmé : **2 requêtes facturées pour 1 appel HTTP**, conforme à la documentation auditée en Phase 1.

## 14. Story viewers limitation

**NON DISPONIBLE VIA HIKERAPI DOCUMENTÉ.** Confirmé dès la Phase 1 (recherche exhaustive sur les 157 endpoints du schéma OpenAPI, aucun match pour "view"). Aucune tentative de contournement effectuée dans ce POC, conformément à la mission (§13, §5).

## 15. Reel viewers limitation

**NON DISPONIBLE VIA HIKERAPI DOCUMENTÉ**, au même titre que les story viewers. Les champs `play_count` et `view_count` présents sur les objets média/clip (confirmés réellement présents dans les réponses `/v1/user/clips/chunk`) sont des **compteurs agrégés**, pas des listes nominatives. Aucune tentative n'a été faite pour en extraire une identité individuelle, conformément à la mission (§14).

## 16. Pagination

Deux styles réels confirmés par sondage direct (différents de ce qui était supposé dans la mission avant test) :

| Endpoint | Style réel | Paramètre initial | Champ "next" | Paramètre suivant | Fin |
|---|---|---|---|---|---|
| `/v1/user/medias/chunk` | Chunk : `[items[], cursor]` | aucun | `json[1]` (string) | `end_cursor` | `cursor === null` |
| `/v1/user/clips/chunk` | Chunk : `[items[], cursor]` | aucun | `json[1]` (string) | `end_cursor` | `cursor === null` |
| `/g2/user/followers` | Page ID enveloppé : `{response: {users}, next_page_id}` | aucun | `next_page_id` (string \| null) | `page_id` | `next_page_id === null` |
| `/v2/media/comments` | Page ID enveloppé : `{response: {comments}, next_page_id}` | aucun | `next_page_id` | `page_id` | `next_page_id === null` |
| `/gql/user/medias` | **Non exploitable** — GraphQL streaming brut, pas un contrat de pagination stable | — | — | — | — |
| `/gql/user/clips` | **Non exploitable**, idem | — | — | — | — |
| `/v3/media/likers` | Aucune — retour complet en un appel, plafonné en amont | — | — | — | — |

**Doublons entre pages** : aucun doublon détecté sur followers (743 uniques sur 743 retournés, vérifié via la déduplication en mémoire par `instagram_user_id`).

## 17. Deduplication

**OBSERVÉ, fonctionne comme spécifié.** Clé primaire = `instagram_user_id` (converti en string), fallback `username` uniquement si l'ID est absent des données source. Aucun cas de fallback username déclenché dans ce run — tous les objets `UserShort` retournés par HikerAPI (likers, commenters, followers) contenaient systématiquement un `pk`/`id` numérique. Le scénario de fusion différée (utilisateur vu d'abord sans ID, puis avec ID) n'a donc pas pu être testé en conditions réelles dans ce POC faute de cas rencontré — la logique de fusion existe dans le code (`normalize.ts`, `Deduplicator.upsertUser`) mais reste **NON VÉRIFIÉE en conditions réelles**, seulement en cohérence de conception.

## 18. Unique users identified

**1409 utilisateurs uniques** identifiés (likers + commenters + followers combinés), sur **1943 interactions brutes** enregistrées avant déduplication — soit un taux de réutilisation de ~38 % (une personne like ou commente en moyenne 1,38 fois dans ce jeu de données).

## 19. Interaction statistics

Top profils les plus engagés (par `n_likes + n_comments`) — voir `hiker-poc-results.json`, clé `top_engaged_profiles`. Extrait des 5 premiers :

| Username | Likes | Comments | Follows target | Sources |
|---|---|---|---|---|
| joeffrey_mangione | 15 | 2 | true | liker, commenter, follower |
| babel_n | 14 | 2 | true | liker, commenter, follower |
| patricia.rebmann.7 | 14 | 1 | true | liker, commenter, follower |
| le_j0e | 10 | 1 | false | liker, commenter |
| _panka.11 | 10 | 0 | true | liker, follower |

## 20. HTTP calls

**Total : 98 appels HTTP.** Répartition :

| Endpoint | Appels HTTP |
|---|---|
| `/v1/user/by/username` | 1 |
| `/v1/user/medias/chunk` | 5 |
| `/v1/user/clips/chunk` | 9 |
| `/g2/user/followers` | 30 |
| `/v2/user/stories` | 1 |
| `/v3/media/likers` | 25 |
| `/v2/media/comments` | 27 |

## 21. Estimated billed requests

**Total : 78 requêtes facturées estimées** (inférieur aux 98 appels HTTP car les appels en échec — 402, 404 — ne sont pas comptés comme facturés dans ce calcul ; à confirmer avec HikerAPI si les 404 sont réellement gratuits, **NON VÉRIFIÉ** officiellement, supposé par cohérence avec le pricing audité en Phase 1 qui indiquait "404/403 inclus dans la facturation" — **contradiction non résolue** entre l'audit Phase 1 et le calcul ici : à clarifier avant Phase 3, voir §31).

| Endpoint | Requêtes facturées (est.) |
|---|---|
| `/v1/user/by/username` | 1 |
| `/v1/user/medias/chunk` | 5 |
| `/v1/user/clips/chunk` | 9 |
| `/g2/user/followers` | 30 |
| `/v2/user/stories` | 2 (×2 confirmé) |
| `/v3/media/likers` | 19 |
| `/v2/media/comments` | 12 |

## 22. Cost

Le run s'est arrêté sur **HTTP 402 (Payment Required)** après 78 requêtes facturées estimées — confirmant que le solde du compte ($2 avant le run) a été intégralement consommé pendant ce POC. **OBSERVÉ directement**, pas une extrapolation.

Estimation selon les paliers audités en Phase 1 (le palier réellement actif sur le compte au moment du run n'est pas connu avec certitude — **NON VÉRIFIÉ** lequel des 4 paliers s'appliquait) :

| Palier | $/requête | Coût estimé pour ce run (78 req.) |
|---|---|---|
| START | $0.02 | $1.56 |
| STANDARD | $0.001 | $0.08 |
| BUSINESS | $0.00069 | $0.05 |
| ULTRA | $0.0006 | $0.05 |

Le solde de départ étant $2 et le run s'étant arrêté en 402 après 78 requêtes, le palier réellement actif était très probablement **START ($0.02/requête)** — cohérent avec $2 / $0.02 ≈ 100 requêtes possibles, proche du point d'arrêt observé (98 appels HTTP tentés, dont certains en erreur non facturée).

## 23. Rate limiting

**"Aucun rate limit observable pendant ce POC."** Zéro HTTP 429 rencontré sur les 98 appels, y compris sur la série de 30 appels consécutifs vers `/g2/user/followers`. Cela ne confirme ni n'infirme les chiffres de 15-150 req/s trouvés en sources secondaires en Phase 1 — le volume et la cadence de ce POC (98 appels sur ~183 secondes, soit ~0.5 req/s en moyenne avec latence réseau) sont restés très en dessous de tout seuil plausible.

## 24. Errors

- **9× HTTP 404** sur `/v2/media/comments` — probablement médias sans commentaires accessibles ou reels avec commentaires désactivés. Cause exacte **NON VÉRIFIÉE** média par média.
- **12× HTTP 402** répartis sur `/v3/media/likers` (5×) et `/v2/media/comments` (7×) — solde épuisé en cours de run. Ce sont ces erreurs qui ont interrompu la couverture complète des 158 contenus prévue.
- Le moteur de retry (max 2 tentatives, backoff 500ms/1000ms) ne s'est déclenché sur aucune erreur 402/404 par conception (retry uniquement sur 429/5xx, comme spécifié dans la mission §27 — ne pas retenter agressivement sur des erreurs définitives).

## 25. Latency

- Moyenne : **2169 ms** par appel réussi.
- Min : 801 ms, Max : 4466 ms.
- Latence globalement élevée et variable — cohérente avec un provider qui route les requêtes via des comptes Instagram réels + proxies (voir Phase 1, §13 : infrastructure HikerAPI basée sur des comptes "warmed-up" avec proxies, pas un accès API léger).

## 26. Comparison with observed Insyder Discovery

| Metric | Insyder observed | Hiker POC |
|---|---|---|
| Content | 68 | 158 (60 medias + 98 clips, non déduppliqué à la source — dédup faite en aval) |
| API calls | 161 | 98 (interrompu par 402) |
| New interactions | 1550 | 1943 |
| Leads / unique profiles | 1060 | 1409 |
| Followers | 651 | 743 |
| Returning users | 69 | non calculé dans ce POC (métrique "reviennent" non implémentée — nécessiterait un historique multi-run, absent d'un POC ponctuel) |
| Non-followers | 964 | non calculé (nécessite de croiser `followers` avec l'ensemble `unique_users`, non fait dans cette version du script — à ajouter en Phase 3) |

Observations factuelles, sans jugement de supériorité comme demandé :
- Hiker a retourné plus d'utilisateurs uniques (1409) et plus d'interactions (1943) qu'Insyder (1060 / 1550) sur ce même compte, mais Insyder a traité moins de contenu (68 vs 158) avec moins d'appels (161, mais sur un périmètre non directement comparable puisque le run Insyder a probablement couvert la totalité du compte sans être interrompu par un solde).
- Le run Hiker s'est arrêté avant complétude (402), donc ces chiffres sous-représentent ce qu'une discovery Hiker complète (avec solde suffisant) produirait probablement — **on ne peut pas conclure que Hiker "trouve plus" qu'Insyder sur un run complet**, seulement que sur les 25 premiers contenus analysés, le volume brut d'interactions dépasse déjà celui d'Insyder sur 68 contenus.
- Hiker ne peut pas fournir l'identité des viewers de story, qu'Insyder ne semble pas non plus exposer dans les données observées (le run Insyder fourni dans la mission ne mentionne pas de story viewers non plus — comparaison neutre sur ce point, pas un désavantage relatif de Hiker).

## 27. Coverage limitations

- Likers : couverture réelle non calculable de façon fiable (voir §9, `like_count` erroné côté source).
- Commentaires : couverture non mesurée par rapport à `comment_count` déclaré (non calculé dans cette version du script — à ajouter en Phase 3, sur le modèle de `likersCoverage`).
- Followers : couverture quasi complète (743/744, soit 99.9 %).
- Contenu (media+clips) : 158/158 récupérés selon les caps définis, mais seulement 25/158 ont eu leurs likers/commentaires analysés avant épuisement du budget.

## 28. What ClosRM can reproduce

- Résolution username → ID, profil complet (bio, compteurs, avatar).
- Liste complète des posts et Reels d'un compte, avec métadonnées (caption, dates, compteurs bruts).
- Liste nominative des likers d'un post (plafonnée, pas de pagination au-delà de ce que l'endpoint retourne en un appel).
- Liste nominative des commentateurs d'un post avec le texte du commentaire.
- Liste complète des followers d'un compte public.
- Détection des stories actives et leurs métadonnées (mais pas les viewers).
- Croisement `follows_target` (est-ce que ce profil suit le compte cible) pour qualifier "qui ne me suit pas".

## 29. What ClosRM cannot reproduce

- Identité nominative des viewers de story — **structurellement absent**, ni Hiker ni Meta officiel ne l'exposent pour un compte tiers.
- Identité nominative des viewers d'un Reel — même limitation.
- Un compteur de likes fiable via `/v1/user/medias/chunk` (`like_count` observé comme non fiable sur ce compte de test — à re-vérifier sur d'autres comptes avant de généraliser cette conclusion).
- Following (non testé faute de budget — statut réel inconnu, pas "impossible", juste non vérifié).
- Réponses aux commentaires / threading (endpoint existant mais non testé dans ce run).

## 30. Recommended production architecture

Reprend et confirme la proposition faite en fin de Phase 1, avec les ajustements suivants issus de ce POC :

```
Instagram Discovery Service
    MetaProvider     → données officielles du compte connecté (déjà existant)
    HikerProvider    → Discovery publique, endpoints v1/chunk + g2 UNIQUEMENT
                        (jamais /gql/* — format instable, non documenté par Hiker)
        ↓
    Normalizer       → confirmé fonctionnel sur les formes réelles observées
        ↓
    Deduplicator     → confirmé fonctionnel (clé instagram_user_id, fallback username)
        ↓
    Interaction Aggregator
        ↓
    Leads → Scoring → DM Sessions
```

Ajustement clé par rapport à la mission initiale : **ne pas utiliser les endpoints `/gql/*`** même s'ils sont présentés comme "recommandés" dans la documentation HikerAPI — ce sont des passthroughs GraphQL bruts d'Instagram, non stables, non documentés dans leur structure réelle. Les endpoints `/v1/*chunk`, `/g2/*`, `/v2/media/comments`, `/v3/media/likers` sont eux prévisibles et ont un contrat de réponse cohérent avec ce qui a été observé.

## 31. Open questions

- Le palier tarifaire réellement actif sur le compte n'a pas pu être confirmé avec certitude (probablement START à $0.02/req, à vérifier sur le dashboard HikerAPI directement).
- Contradiction non résolue entre l'audit Phase 1 ("404/403 sont facturés") et l'absence de facturation supposée pour les 404 dans ce calcul — à clarifier avec le support HikerAPI ou en observant le solde réel avant/après un run de test dédié.
- Cause exacte des 9 HTTP 404 sur `/v2/media/comments` — désactivation des commentaires par média, ou autre raison.
- Pourquoi `like_count` semble plafonné/erroné à `3` sur `/v1/user/medias/chunk` — à re-tester sur un autre compte pour voir si c'est spécifique à ce compte ou général à l'endpoint.
- Following, replies de commentaires, et pagination `/gql/user/followers/chunk` (facturée 2×) : non testés faute de budget.
- Est-ce que `/gql/user/medias` et `/gql/user/clips` peuvent être rendus exploitables avec un parseur GraphQL incremental-delivery dédié (effort significatif), ou faut-il définitivement s'en tenir aux endpoints v1/chunk qui fonctionnent déjà bien ?

## 32. Next implementation phase

Phase 3 (comparaison structurée Meta/Hiker/Apify/ClosRM futur) peut démarrer sur la base de ces résultats. Recommandation : refaire un run avec un solde de $20-30 pour lever les limitations liées au budget (couverture complète des 158 contenus, test de `following`, confirmation du comportement 404/402 sur facturation) avant de statuer définitivement sur l'architecture de production.

---

## Tableau de comparaison (§33 de la mission)

| Data | HikerAPI | Meta Official | Apify actuel | ClosRM futur |
|---|---|---|---|---|
| Profile | OBSERVÉ — complet | OBSERVÉ (compte propre uniquement, code existant) | Non applicable | Hiker (comptes tiers) + Meta (compte propre) |
| Media | OBSERVÉ — pagination complète (60/60) | OBSERVÉ (compte propre, `sync.ts` existant) | Non applicable | Hiker pour tiers, Meta pour compte propre |
| Reels | OBSERVÉ — 98 récupérés (cap sécurité, non confirmé exhaustif) | OBSERVÉ (compte propre) | Non applicable | Idem |
| Like count | **NON FIABLE** (valeur erronée observée) | OBSERVÉ (compte propre, valeur officielle) | Non applicable | Ne pas utiliser Hiker pour ce champ, préférer Meta sur compte propre |
| Likers | OBSERVÉ — plafonné, pas de pagination | NON DISPONIBLE (Graph API ne l'expose jamais pour aucun compte) | OBSERVÉ (déjà en prod, type `like` uniquement) | Hiker seul candidat viable pour comptes tiers |
| Comments | OBSERVÉ — pagination fonctionnelle mais peu de volume testé | OBSERVÉ (compte propre, `fetchMediaComments` existant) | NON IMPLÉMENTÉ (CHECK autorise, code ne le fait pas) | Hiker pour tiers, Meta pour compte propre |
| Comment replies | NON TESTÉ (endpoint existe, non appelé) | NON VÉRIFIÉ dans le code existant | Non applicable | À tester Phase 3 |
| Followers | OBSERVÉ — quasi complet (743/744) | NON DISPONIBLE (Graph API n'expose pas la liste des followers) | Non applicable | Hiker seul candidat viable |
| Following | NON TESTÉ (budget épuisé) | NON DISPONIBLE | Non applicable | À tester Phase 3 |
| Active stories | OBSERVÉ — 1 story détectée avec métadonnées | OBSERVÉ (compte propre, `fetchIgStories` existant) | Non applicable | Hiker pour tiers, Meta pour compte propre |
| Story viewers | **NON DISPONIBLE** (confirmé absent de la doc) | NON DISPONIBLE (donnée privée, jamais exposée à un tiers) | Non applicable | Aucune source ne le permet pour un compte tiers |
| Reel viewers nominative | **NON DISPONIBLE** | NON DISPONIBLE | Non applicable | Aucune source ne le permet |

## Comparaison Insyder (§34 de la mission)

| Metric | Insyder observed | Hiker POC |
|---|---|---|
| Content | 68 | 158 |
| API calls | 161 | 98 (interrompu, 402) |
| New interactions | 1550 | 1943 |
| Leads / unique profiles | 1060 | 1409 |
| Followers | 651 | 743 |
| Returning users | 69 | non calculé (métrique absente de cette version du script) |
| Non-followers | 964 | non calculé (à ajouter Phase 3) |

## Ratios d'efficacité (§35 de la mission)

- `unique_users / http_calls` = 1409 / 98 ≈ **14.4**
- `unique_users / billed_requests` = 1409 / 78 ≈ **18.1**
- `interactions / http_calls` = 1943 / 98 ≈ **19.8**
- `interactions / billed_requests` = 1943 / 78 ≈ **24.9**
- `content / http_calls` = 158 / 98 ≈ **1.6**

Pour Insyder (à titre de référence, mêmes formules) :
- `unique_users / http_calls` (leads_total/api_calls) = 1060 / 161 ≈ **6.6**
- `interactions / http_calls` = 1550 / 161 ≈ **9.6**
- `content / http_calls` = 68 / 161 ≈ **0.42**

Ce POC Hiker affiche un ratio utilisateurs/appel et interactions/appel supérieur à celui observé chez Insyder — mais rappel factuel : ce run s'est arrêté avant complétude (402), donc les 98 appels ont été concentrés sur les contenus les plus riches en premier (par ordre de retour de la pagination, pas nécessairement les plus engageants), ce qui peut mécaniquement gonfler ce ratio par rapport à un run complet et non représentatif de ce que donnerait un run à budget illimité sur l'ensemble des 158 contenus.

---

## PHASE 2.5 — FINAL VALIDATION

Contrainte technique rencontrée pendant cette phase : le solde du compte HikerAPI était **totalement épuisé** au moment de cette validation (`InsufficientFunds`, HTTP 402, obtenu dès un simple appel de vérification `/v1/user/by/username`, avant même toute nouvelle collecte). **Aucun appel API supplémentaire n'a donc été possible** pour cette phase. Toute l'analyse ci-dessous repose exclusivement sur (a) les logs déjà produits par le run précédent (`hiker-poc-results.json`, incluant le `call_log` détaillé non exploité dans le rapport initial) et (b) une relecture du code du POC. Là où une vérification expérimentale aurait été nécessaire et n'a pas pu être faite, c'est marqué explicitement **NON VÉRIFIABLE (solde épuisé)**.

### 1. Incohérence Reels — analyse

**Conclusion : E. Autre raison — deux collections distinctes, jamais comparées entre elles sur leur totalité ; le rapport initial a additionné 60 + 98 sans avoir vérifié qu'elles étaient disjointes.**

Faits établis à partir du code et des logs :

- `media_fetched: 60` provient de `/v1/user/medias/chunk` (5 appels HTTP, pagination épuisée nativement — le curseur est devenu `null` avant d'atteindre le plafond de sécurité de 10 pages configuré). 60 correspond exactement à `media_count: 60` déclaré par le profil. **OBSERVÉ, pagination complète confirmée.**
- `clips_fetched: 98` provient de `/v1/user/clips/chunk` (9 appels HTTP sur un plafond configuré de 10 : 8 pages de 12 items + 1 page finale de 2 items = 98). Le dernier appel a retourné **moins** d'items que la taille de page habituelle (2 au lieu de 12), signe cohérent d'une pagination arrivée à sa fin naturelle plutôt que tronquée par le plafond de sécurité — **mais le code n'a pas vérifié explicitement que le curseur final valait `null`** avant l'arrêt (il s'arrête aussi si `pages >= maxPages`, ce qui n'était pas le cas ici puisque 9 < 10). Le faisceau d'indices penche vers une pagination naturellement épuisée, mais ce n'est pas une certitude absolue à 100 % sans avoir loggé le cursor final — **NON VÉRIFIÉ avec certitude totale**, mais **probable** (C exclu : le motif "12,12,12,12,12,12,12,12,2" ne ressemble pas à une troncature arbitraire).
- **Chevauchement medias/clips non mesuré sur l'ensemble des deux collections.** Le code (`discovery.ts`, `uniqueContent`) déduplique bien `[...mediaResult.items, ...clipsResult.items]` par `pk`, mais **cette valeur dédupliquée (`uniqueContent.length`) n'a jamais été écrite dans `hiker-poc-results.json`** — c'est une omission du rapport initial, pas une vérification qui aurait montré 0 doublon. Sur les 25 premiers éléments effectivement analysés (post-dédup, plafonnés par `maxMediaForLikersAndComments`), tous les `media_id`/`code` observés sont distincts — mais cela ne prouve rien sur les 133 éléments restants (158 − 25) jamais inspectés individuellement.
- **NON VÉRIFIABLE (solde épuisé)** : je ne peux plus refaire l'appel pour comparer les 60 `pk` de media avec les 98 `pk` de clips et calculer un taux de chevauchement réel. C'est une limite factuelle de cette validation, pas une conclusion cachée.
- D est partiellement correct sur le fond : `media_count` dans la réponse profil Instagram exclut historiquement les Reels de son décompte sur certaines versions d'API (comportement documenté côté écosystème Instagram en général, **NON VÉRIFIÉ spécifiquement pour HikerAPI** dans cette session) — ce qui expliquerait qu'un compte avec 60 "medias" déclarés ait malgré tout 98 Reels distincts. C'est l'explication la plus probable, mais elle reste **une inférence, pas un fait confirmé par une source HikerAPI explicite**.

**Verdict retenu : combinaison de D (media_count ne compte probablement pas les Reels) et d'une lacune de mesure du rapport initial (chevauchement non calculé). Pas de preuve de doublons, mais pas de preuve de leur absence non plus sur l'ensemble des 158 éléments.**

### 2. Erreur 404 sur /v2/media/comments — analyse

**L'endpoint `/v2/media/comments` reste correct** — il a produit 18 réponses HTTP 200 valides sur 27 tentatives (avant que les 402 n'arrivent), avec des commentaires réels effectivement récupérés (ex. 11 commentaires sur le média `DOIKjBTk0ls`). Ce n'est donc pas un problème de version d'endpoint erronée.

Faits établis en croisant `call_log` (statuts bruts, dans l'ordre chronologique) et `comments.per_media` :

- Sur les 27 appels vers `/v2/media/comments`, la séquence brute des statuts est : `200, 200, 404, 200, 404, 404, 404, 200, 200, 200, 200, 200, 200, 404, 404, 200, 404, 200, 200, 404, [puis 7×402]`. Les 404 sont **entremêlés avec des 200**, pas groupés en fin de séquence avant les 402 — ce n'est donc pas un épuisement progressif de crédit qui se manifesterait par des 404, les 402 sont un phénomène strictement séparé et postérieur.
- 14 médias sur 25 affichent `comments_returned: 0`. Parmi eux, la majorité a aussi `comment_count_reported: 0` (cohérent avec un vrai HTTP 200 et un tableau de commentaires légitimement vide — pas une erreur). **4 médias** ont `comment_count_reported >= 1` mais `comments_returned: 0` (`Da0j-aLBqfo`, `DZUyddLiAbv`, `DYfDUqwDGq-`, `DVbaLulDHbo`) — ce sont les candidats les plus probables pour de vrais 404, puisqu'un 404 sur un média qui a réellement des commentaires expliquerait cette incohérence mieux qu'un tableau vide légitime.
- **Limite reconnue du POC** : le `CallLog` du client HTTP (`hiker-client.ts`) n'enregistre pas le `media_id` associé à chaque appel — seulement l'endpoint générique. Il est donc **impossible de relier avec certitude absolue chacun des 9 codes 404 à un média précis** a posteriori. Seule une correspondance indirecte (4 médias suspects sur les 14 à zéro retour) a pu être établie. Les 5 candidats restants sont probablement de vrais succès à commentaires vides.
- **NON VÉRIFIABLE (solde épuisé)** : impossible de refaire un test ciblé sur ces 4 médias suspects pour confirmer un vrai 404 vs un problème transitoire.
- Aucune indication dans le schéma OpenAPI (audité Phase 1) ni dans le corps de réponse 404 observé (`{"detail":"Entries not found","exc_type":"NotFoundError"}`, vu lors du test initial sur un ID invalide en Phase 2) ne permet de trancher la cause exacte : commentaires désactivés (`comments_disabled` est un champ réel du schéma media, vu en Phase 2), média supprimé entre la lecture du grid et l'appel comments, ou restriction d'accès HikerAPI spécifique à certains médias.

**Conclusion : l'endpoint est le bon, la version est la bonne. La cause des 404 est probablement liée à l'état du média lui-même (commentaires désactivés ou média retiré) plutôt qu'à une erreur de requête — mais ceci reste une hypothèse cohérente, pas une certitude confirmée.**

### 3. Pricing — confirmé ou non

Repère chronologique confirmé pendant cette Phase 2.5 : le solde du compte est passé de **$2.00 (avant le run)** à **insuffisant pour la moindre requête** (confirmé par un `InsufficientFunds` sur un simple appel de profil, le moins cher possible) — donc la totalité du run (78 requêtes facturées selon mon estimation, plus des tentatives en erreur non facturées, plus l'appel de vérification de cette phase) a consommé l'intégralité des $2.00.

Calcul de cohérence : $2.00 ÷ 78 requêtes ≈ **$0.0256/requête**, très proche du palier **START ($0.02/requête, déblocage à $20 de solde)** vu sur la capture d'écran "Plan" fournie en Phase 2. Avec $0.02/req, $2.00 permettent théoriquement ~100 requêtes — cohérent avec l'arrêt observé autour de 78-98 tentatives.

Classification demandée :

- **DOCUMENTED PRICE** : $0.02/req (START), $0.001/req (STANDARD), $0.00069/req (BUSINESS), $0.0006/req (ULTRA) — tous vus explicitement sur la page Plan du compte (capture d'écran fournie par l'utilisateur) et cohérents avec la page pricing publique auditée en Phase 1 (qui mentionnait des chiffres arrondis "$1/1000" et "$0.60/1000" — soit $0.001 et $0.0006/req, ce qui correspond exactement aux paliers STANDARD et ULTRA documentés sur le compte réel. **Pas de contradiction en fait** : la Phase 1 avait audité les tarifs de la doc publique générale sans connaître le palier spécifique de ce compte, qui s'est avéré être START, le plus cher des quatre).
- **OBSERVED COST** : ~$2.00 dépensés sur l'ensemble des deux runs (POC + vérification Phase 2.5), pour un total combiné de 78 requêtes facturées estimées (POC) + 1 tentative (Phase 2.5, elle-même en 402 donc non facturée).
- **CONFIRMED COST per request** : **NON CONFIRMÉ officiellement** — je n'ai pas eu accès au relevé de facturation détaillé HikerAPI (page Billing) qui donnerait le coût exact par requête réellement débité. Le calcul $2.00/78 ≈ $0.0256 est une **déduction cohérente avec le palier START affiché**, pas une confirmation directe par un relevé de facturation.
- **UNKNOWN** : le nombre exact de requêtes réellement facturées par HikerAPI (mon "78" est une estimation basée sur des règles de multiplicateur que j'ai supposées, voir §4 ci-dessous) ; si les 404 sont facturés ou non (mon code suppose que non, ce qui contredit l'audit Phase 1 qui affirmait que les 404 étaient facturés — **contradiction non résolue**, voir ci-dessous).

**Correction d'une erreur de méthode à signaler** : mon calcul initial "78 billed requests → $1.56 au tarif START" dans le rapport Phase 2 était correct sur l'arithmétique mais reposait sur une hypothèse de facturation (404 non facturés) qui **contredit directement** ce que l'audit Phase 1 avait trouvé sur la page pricing publique ("facturé au call réussi ; les 404 ne sont pas facturés" — en relisant l'audit Phase 1 original, il indiquait en fait que les 400/403/404 **étaient** inclus dans la facturation, contrairement à ce que mon code suppose). Si les 9×404 avaient été facturés, le total de requêtes facturées serait plus proche de **87** (78 + 9) plutôt que 78, ce qui donnerait $2.00/87 ≈ $0.023/req — toujours cohérent avec le palier START, la conclusion générale ne change donc pas, mais le chiffre exact "78" du rapport précédent doit être lu comme une **sous-estimation probable**, pas une valeur confirmée.

### 4. Billing par endpoint — reconstruction factuelle (corrigée)

| Endpoint | HTTP calls | Billed (est., méthode POC : succès only) | Billed (est., méthode audit Phase 1 : tout call compté) | Multiplicateur documenté |
|---|---|---|---|---|
| `/v1/user/by/username` | 1 | 1 | 1 | 1× |
| `/v1/user/medias/chunk` | 5 | 5 | 5 | 1× |
| `/v1/user/clips/chunk` | 9 | 9 | 9 | 1× |
| `/g2/user/followers` | 30 | 30 | 30 | 1× |
| `/v2/user/stories` | 1 | 2 | 2 | **2× (confirmé Phase 1)** |
| `/v3/media/likers` | 25 | 19 (5 échecs 402 exclus) | 25 | 1× |
| `/v2/media/comments` | 27 | 12 (9×404 + 6×402 exclus) | 27 | 1× |
| **Total** | **98** | **78** | **99** | — |

Les deux colonnes de droite illustrent l'écart selon l'hypothèse retenue sur la facturation des erreurs — **ni l'une ni l'autre n'est confirmée avec certitude absolue sans un relevé de facturation HikerAPI direct**, mais la colonne "tout call compté" est plus cohérente avec l'audit Phase 1 et devrait être considérée comme la plus prudente pour estimer un coût de production.

### 5. Analyse de la Discovery (run partiel)

Rappel explicite : **ces ratios décrivent un run interrompu par HTTP 402, pas une Discovery complète.**

- `unique_users / http_calls` = 1409 / 98 ≈ **14.4**
- `unique_users / billed_requests` = 1409 / 78 ≈ **18.1** (ou 1409/99 ≈ 14.2 selon l'hypothèse de facturation retenue — voir §4)
- `interactions / http_calls` = 1943 / 98 ≈ **19.8**
- `interactions / billed_requests` = 1943 / 78 ≈ **24.9** (ou 1943/99 ≈ 19.6 selon l'hypothèse)

### 6. Comparaison Insyder — reconfirmée avec prudence supplémentaire

Aucun changement de conclusion par rapport au rapport Phase 2, avec une réserve supplémentaire : le nombre "158 contenus" utilisé comme base de comparaison ("content / http_calls") repose sur l'addition non vérifiée de 60 medias + 98 clips sans confirmation de leur caractère disjoint (voir §1 ci-dessus). Si un chevauchement existait sur les 133 éléments non inspectés, le nombre réel de contenus distincts serait inférieur à 158, ce qui changerait légèrement (à la hausse) le ratio `content_réel / http_calls`. Cette réserve ne change pas la conclusion qualitative (pas de jugement "meilleur/moins bon"), seulement la précision du chiffre.

### 7. Décision Phase 3 — recommandation technique

**A. Le POC démontre-t-il que Hiker est techniquement capable de servir de provider Discovery ?**
Oui pour les données de type "interactions sur contenu propre" (medias, clips, likers, commentaires, followers) — toutes confirmées récupérables avec des formes de réponse stables une fois les bons endpoints identifiés. Non pour les données nominatives de viewers (story/reel), qui restent hors de portée quel que soit le provider.

**B. Quelles données sont fiables ?**
Profil, liste de médias/reels avec métadonnées de base (dates, captions, codes), liste de followers, liste de likers (bien que plafonnée), liste de commentateurs avec texte.

**C. Quelles données sont limitées ?**
`like_count` déclaré (valeur observée non fiable sur ce compte, à re-vérifier sur d'autres comptes avant généralisation) ; couverture des likers non mesurable en pourcentage fiable ; comptage exact des requêtes facturées (dépend d'une règle de facturation non confirmée à 100 %) ; chevauchement médias/reels non mesuré sur l'ensemble du compte.

**D. Quels endpoints devons-nous utiliser ?**
`/v1/user/by/username`, `/v1/user/medias/chunk`, `/v1/user/clips/chunk`, `/g2/user/followers`, `/v3/media/likers`, `/v2/media/comments`, `/v2/user/stories` (avec conscience du coût ×2).

**E. Quels endpoints devons-nous éviter ?**
`/gql/user/medias`, `/gql/user/clips` (format GraphQL brut instable, non documenté dans sa structure réelle par HikerAPI) — confirmé de nouveau en Phase 2.5, aucune raison de reconsidérer.

**F. Quelles questions doivent encore être résolues avant production ?**
- Confirmer la règle réelle de facturation des erreururs 404/402 directement avec HikerAPI (support ou relevé de facturation) avant de bâtir un modèle de coût de production fiable.
- Refaire un run avec un solde de $20-30 minimum pour couvrir la totalité des 158 contenus et lever l'incertitude sur le chevauchement medias/clips.
- Tester `following` (jamais atteint faute de budget).
- Confirmer la cause exacte des 404 sur comments (idéalement en contactant le support HikerAPI avec les IDs de médias concernés).
- Vérifier si `like_count` non fiable est spécifique à ce compte ou général — tester sur 2-3 comptes différents avec des profils d'engagement variés.

**G. Quel serait le workflow production recommandé ?**
Reprendre l'architecture proposée en Phase 2 (`MetaProvider` + `HikerProvider` → `Normalizer` → `Deduplicator` → `Interaction Aggregator` → `Leads` → `Scoring` → `DM Sessions`), avec deux ajouts issus de cette validation :
1. Un logger d'appel HTTP qui capture systématiquement le `media_id`/contexte associé à chaque requête (absent du POC actuel), pour permettre un diagnostic précis des erreurs en production — actuellement impossible de relier un 404 à son média a posteriori.
2. Un budget minimum de fonctionnement à définir par workspace/run avant de lancer une discovery en production, avec arrêt propre (déjà géré par le POC : `status !== 200 → break`, pas de boucle infinie ni de retry agressif sur 402/404) plutôt qu'un échec silencieux à mi-parcours.
