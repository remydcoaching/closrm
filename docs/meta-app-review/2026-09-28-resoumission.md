# Meta App Review — resoumission (2026-09-28)

Dossier pour relancer le Contrôle app de ClosRM après le refus reçu. On filme **ClosRM web** (closrm.fr), pas l'app desktop.

## 1. Ce que le refus dit vraiment

- **9 autorisations sur 10 : « cas d'utilisation autorisé »**, refusées uniquement parce que la vidéo ne montrait pas le parcours de bout en bout (connexion Meta → acceptation des autorisations → fonctionnalité qui marche).
- **Page Public Metadata Access : refus sur le fond** (« pas nécessaire »). ClosRM ne lit pas de Pages publiques qu'il ne gère pas.
- **Messages** — note de l'examinateur : montrer (1) le compte sélectionné, (2) un envoi en direct depuis ClosRM, (3) le message arrivé dans l'app Instagram.

## 2. Ce qu'on change dans la demande

| Autorisation | Décision | Pourquoi |
|---|---|---|
| Page Public Metadata Access | **Retirer** | Refus sur le fond, inutile à ClosRM |
| `instagram_business_basic` | **Retirer** | Appartient à « Instagram Login », que ClosRM n'utilise pas (ClosRM utilise la connexion Facebook : `src/lib/meta/client.ts`) |
| `instagram_business_manage_messages` | **Retirer** | Idem, doublon de `instagram_manage_messages` |
| `pages_show_list` | Garder | Choix de la Page liée au compte Instagram |
| `pages_read_engagement` | Garder | Lecture de la Page et de son compte Instagram lié |
| `instagram_basic` | Garder | Profil et publications du compte connecté |
| `instagram_manage_messages` | Garder | Messagerie Instagram dans ClosRM |
| `instagram_manage_comments` | Garder | Commentaires : lecture et réponse |
| `instagram_manage_insights` | Garder | Statistiques des reels et stories |
| `instagram_content_publish` | Garder | Publication depuis le planning |

Les autres autorisations demandées au clic « Connecter » (`leads_retrieval`, `ads_read`, `read_insights`, `business_management`, `pages_manage_metadata`) relèvent de la partie Publicités / Lead Ads : à soumettre dans une demande séparée si ce n'est pas déjà fait.

## 3. Règles communes à toutes les vidéos

1. **Interface en anglais, ou sous-titres anglais** qui expliquent chaque bouton cliqué. Le plus simple : sous-titres ajoutés au montage (iMovie, CapCut).
2. **Commencer déconnecté** : Paramètres › Intégrations › Meta › Déconnecter, avant d'enregistrer.
3. **Montrer la connexion Meta en entier** : clic sur « Connecter », écran Facebook, choix de la Page **et** du compte Instagram (bien visibles), écran des autorisations où on clique « Autoriser ».
4. **Montrer la fonctionnalité de l'autorisation**, puis **le résultat dans Instagram** (téléphone filmé ou instagram.com dans un autre onglet).
5. Une vidéo par autorisation, ou une vidéo unique avec un chapitre par autorisation (sous-titre « Permission: instagram_manage_messages » en début de chapitre). Les vidéos séparées évitent les refus en bloc.
6. Utiliser des comptes testeurs (rôle sur l'app) pour les messages et commentaires reçus.

## 4. Script par autorisation (plans + sous-titres anglais)

Chaque vidéo commence par le **bloc Connexion** :

| Plan | À l'écran | Sous-titre |
|---|---|---|
| C1 | ClosRM › Settings › Integrations, carte Meta déconnectée | "The coach opens Integrations to connect their Facebook Page and Instagram professional account." |
| C2 | Clic « Connecter Meta » | "Clicking Connect starts Facebook Login." |
| C3 | Écran Facebook : choix de la Page et du compte Instagram | "The coach selects the Facebook Page and the Instagram professional account ClosRM may use." |
| C4 | Écran des autorisations, clic « Autoriser » | "The coach reviews and grants the requested permissions." |
| C5 | Retour dans ClosRM, carte Meta « Connecté » avec le nom de la Page et le @ | "ClosRM is now connected to the selected Page and Instagram account." |

### instagram_basic
| Plan | À l'écran | Sous-titre |
|---|---|---|
| 1 | Acquisition › Réseaux sociaux › Instagram : @, photo, nombre d'abonnés | "ClosRM reads the connected account's profile: username, picture, follower count." |
| 2 | Liste des posts / reels | "It lists the account's own posts and reels so the coach can track their performance." |
| 3 | Même profil ouvert dans Instagram | "Same account, as shown in Instagram." |

### pages_show_list
| Plan | À l'écran | Sous-titre |
|---|---|---|
| 1 | Plan C3 (choix de la Page) au ralenti | "pages_show_list lets ClosRM list the Pages the coach manages, so they can choose the one linked to their Instagram account." |
| 2 | Carte Meta avec le nom de la Page | "The selected Page is displayed in ClosRM." |

### pages_read_engagement
| Plan | À l'écran | Sous-titre |
|---|---|---|
| 1 | Carte Meta : Page + compte Instagram lié | "ClosRM reads the Page to find the Instagram professional account linked to it." |
| 2 | Onglet Instagram : abonnés et publications | "This is required to load the account's profile, content and messages." |

### instagram_manage_messages (note de l'examinateur à respecter à la lettre)
| Plan | À l'écran | Sous-titre |
|---|---|---|
| 1 | Acquisition › Messages : compte connecté visible en haut | "Step 1 — The connected Instagram account (@…) is visible." |
| 2 | Ouvrir une conversation avec le compte testeur | "The coach opens a conversation with a prospect." |
| 3 | Taper un message, cliquer Envoyer | "Step 2 — The coach sends a reply from ClosRM." |
| 4 | Téléphone du compte testeur : le message arrive dans Instagram | "Step 3 — The message is delivered in the native Instagram app." |
| 5 | Le testeur répond dans Instagram, la réponse apparaît dans ClosRM | "Replies appear in ClosRM, so the coach answers leads in one place." |

### instagram_manage_comments
| Plan | À l'écran | Sous-titre |
|---|---|---|
| 1 | Réseaux sociaux › Instagram › commentaires d'un post | "ClosRM lists comments on the coach's own posts." |
| 2 | Répondre à un commentaire | "The coach replies to a comment from ClosRM." |
| 3 | La réponse visible sous le post dans Instagram | "The reply is published under the post on Instagram." |

### instagram_manage_insights
| Plan | À l'écran | Sous-titre |
|---|---|---|
| 1 | Onglet Reels : vues, portée, enregistrements, partages | "ClosRM shows insights for the coach's own reels: plays, reach, saves, shares." |
| 2 | Mêmes chiffres dans Instagram › Statistiques du reel | "Same metrics in Instagram Insights." |
| 3 | Tableau / graphique comparatif | "The coach uses them to see which content brings leads." |

### instagram_content_publish
| Plan | À l'écran | Sous-titre |
|---|---|---|
| 1 | Réseaux sociaux › Instagram › nouveau brouillon (image + légende) | "The coach prepares a post in ClosRM." |
| 2 | Clic Publier | "ClosRM publishes it to the connected Instagram account." |
| 3 | Le post sur le profil Instagram | "The post is live on Instagram." |

## 5. Notes à coller dans le formulaire (anglais)

Pour chaque autorisation, trois réponses : quelle fonctionnalité, en quoi elle améliore l'app, en quoi elle améliore l'expérience.

**instagram_basic** — ClosRM is a CRM for independent coaches who get clients from Instagram. After connecting their own Instagram professional account, the coach sees their profile (username, picture, follower count) and their own posts and reels in ClosRM, so they can link each lead to the content that brought them. Without this permission ClosRM cannot show the coach's account or content.

**pages_show_list** — During Facebook Login the coach chooses which of their Pages is linked to their Instagram professional account. ClosRM uses pages_show_list to list the Pages the coach manages so they can pick the right one; the chosen Page is displayed in Settings › Integrations.

**pages_read_engagement** — ClosRM reads the selected Page to find its linked Instagram professional account and obtain the Page access token required to read the account's content and messages. It is only used on Pages the coach manages.

**instagram_manage_messages** — Coaches receive prospects' questions in Instagram Direct. ClosRM shows these conversations next to each lead's CRM record and lets the coach reply from ClosRM; replies are delivered in Instagram as shown in the screencast (send from ClosRM → message received in the Instagram app). This lets coaches answer leads faster and never lose a conversation.

**instagram_manage_comments** — ClosRM lists comments on the coach's own posts and lets the coach reply from ClosRM. Comments from prospects are linked to their lead record, so the coach sees every interaction in one place.

**instagram_manage_insights** — ClosRM shows plays, reach, saves and shares of the coach's own reels and stories, next to the number of leads each piece of content generated, so the coach knows which content brings clients.

**instagram_content_publish** — Coaches plan their content in ClosRM's publishing calendar. ClosRM publishes the planned post to the coach's own Instagram professional account at the chosen time, as shown in the screencast.

## 6. Avant de filmer (vérifications)

- [ ] Déployer la version web à filmer, et vérifier que chaque écran ci-dessus marche avec ton compte.
- [ ] Un compte testeur (rôle sur l'app) pour envoyer / recevoir DM et commentaires.
- [ ] Politique de confidentialité et page de suppression des données en ligne, renseignées dans le tableau de bord de l'app.
- [ ] Vérification de l'entreprise (Business Verification) faite ou en cours.
- [ ] Retirer les 3 autorisations de la section 2 de la demande.
- [ ] Limite connue : à la connexion, ClosRM prend la première Page (`src/app/api/integrations/meta/callback/route.ts`, `pages[0]`). Si tu gères plusieurs Pages, n'en coche qu'une sur l'écran Facebook pendant la vidéo, ou on ajoute un vrai choix de Page dans ClosRM avant de filmer.
