# Meta App Review — checklist pas à pas (Pierre)

Une seule vidéo pour toutes les autorisations, tournée sur **ClosRM web (closrm.fr)**, en 6 clips courts que le script assemble et sous-titre en anglais. Détails et notes en anglais : `2026-09-28-resoumission.md`. Sous-titres : `captions.json`.

## Ce que le refus exige, et où c'est traité

| Exigence de Meta | Réponse |
|---|---|
| Page Public Metadata Access : « cas d'utilisation pas nécessaire » | Retirée de la demande (ClosRM ne lit pas de Pages qu'il ne gère pas) |
| « Le flux de connexion Meta complet » | Clip 1 : carte déconnectée → Connecter → écran Facebook |
| « Une personne octroyant l'accès à l'autorisation » | Clip 1 : choix Page + @ Instagram, écran des autorisations, clic « Autoriser » |
| « L'expérience de bout en bout » pour chaque autorisation | Clips 2 à 6, un par autorisation, résultat montré dans Instagram |
| « UI en anglais, sous-titres, infobulles, expliquer les boutons » | Sous-titres anglais incrustés à chaque étape, bouton français traduit entre parenthèses ; titre de l'autorisation affiché en haut pendant tout le chapitre |
| Messages : (1) asset visible, (2) envoi en direct depuis l'app, (3) message reçu dans le client natif | Clip 3, étapes numérotées « Step 1/2/3 » dans les sous-titres |
| instagram_business_basic / instagram_business_manage_messages | Retirées : famille « Instagram Login » que ClosRM n'utilise pas (ClosRM = connexion Facebook) |

## A. Tableau de bord Meta (developers.facebook.com › app ClosRM)

- [ ] Contrôle app › Demandes : retirer **Page Public Metadata Access**, **instagram_business_basic**, **instagram_business_manage_messages**.
- [ ] Garder : pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_messages, instagram_manage_comments, instagram_manage_insights, instagram_content_publish.
- [ ] **Facebook Login › Paramètres › URI de redirection OAuth valides** : `https://closrm.fr/api/integrations/meta/callback` **et** `https://closrm.vercel.app/api/integrations/meta/callback` (la connexion revient désormais à l'adresse d'où elle part). Domaines de l'app : `closrm.fr`, `closrm.vercel.app`.
- [ ] Paramètres › Général : URL de politique de confidentialité, URL de suppression des données, icône, catégorie, e-mail de contact.
- [ ] Vérification de l'entreprise : faite ou lancée.
- [ ] Rôles d'app › Rôles › Ajouter › **Testeur Instagram** : ton compte Instagram testeur.
- [ ] Sur ce compte, dans Instagram : Paramètres › Sites web et applications › Invitations de testeur › Accepter.

## B. Données à préparer sur closrm.fr

- [ ] Le testeur t'envoie un DM (la conversation doit exister dans ClosRM › Messages).
- [ ] Le testeur commente un de tes posts.
- [ ] L'onglet Reels de ClosRM affiche des stats.
- [ ] Une image + une légende prêtes pour un post de test.
- [ ] Un compte ClosRM de test (e-mail + mot de passe) pour l'examinateur.

## C. Mac

- [ ] Chrome, un seul profil, plein écran, **barre d'adresse visible** (closrm.fr doit se voir).
- [ ] Onglet 1 : closrm.fr (ton compte). Onglet 2 : instagram.com connecté au **testeur**. facebook.com connecté à **ton** Facebook.
- [ ] Ne pas déranger activé, onglets perso fermés, favoris masqués, zoom Chrome 110–125 %.

## D. Tourner les 6 clips (Cmd + Maj + 5 › Écran entier)

Fais les étapes **dans l'ordre des sous-titres, à rythme régulier** (chaque sous-titre dure une part égale du clip). Souris lente, une seconde de pause après chaque clic. Range les fichiers dans `docs/meta-app-review/clips/` avec ces noms :

| Clip | Fichier | Étapes | Durée |
|---|---|---|---|
| 1 | `1-connexion.mov` | (hors caméra : Intégrations › Meta › Déconnecter) 1) Paramètres › Intégrations 2) carte Meta « non connecté », clic « Connecter Meta » 3) écran Facebook, ton compte 4) **choisir ta Page** (une seule) 5) **choisir ton @ Instagram** 6) autorisations → « Continuer / Autoriser » 7) retour ClosRM « Connecté » | 60–90 s |
| 2 | `2-profil.mov` | 1) Acquisition › Réseaux sociaux › Instagram 2) @, photo, abonnés 3) défiler posts/reels 4) instagram.com : ton profil | 30–40 s |
| 3 | `3-messages.mov` | 1) ClosRM › Messages, ton @ visible 2) conversation du testeur 3) **écrire + Envoyer** 4) instagram.com (testeur) : **message reçu** 5) le testeur répond → visible dans ClosRM | 60–90 s |
| 4 | `4-commentaires.mov` | 1) ouvrir le post 2) liste des commentaires 3) **répondre** 4) instagram.com : **réponse visible** | 40–60 s |
| 5 | `5-statistiques.mov` | 1) onglet Reels 2) vues, portée, enregistrements, partages 3) comparer deux reels | 20–30 s |
| 6 | `6-publication.mov` | 1) créer un post (image + légende) 2) **Publier** 3) instagram.com : **post sur ton profil** | 40–60 s |

Clip raté → refais seulement celui-là, même nom.

## E. Assembler

```bash
cd ~/closrm-lead-journey
python3 scripts/meta-review/build_video.py
```

Résultat dans `docs/meta-app-review/videos/` :
- `closrm-app-review.mp4` : la vidéo unique (1920×1200, titre de l'autorisation en haut, étape en anglais en bas, écran filmé jamais recouvert) ;
- un fichier par clip, au cas où Meta demande une vidéo par autorisation ;
- `chapters.txt` : le minutage de chaque autorisation dans la vidéo, à coller dans les notes.

Regarde la vidéo en entier ; si un sous-titre tombe mal, dis-le-moi et j'ajuste.

## F. Envoyer à Meta

- [ ] Pour chaque autorisation : téléverser `closrm-app-review.mp4`, coller la note anglaise (section 5 de `2026-09-28-resoumission.md`), ajouter la ligne de `chapters.txt` correspondante : « In the screencast, this permission is shown at MM:SS–MM:SS ».
- [ ] Instructions de test : closrm.fr, identifiants du compte test, « Log in › Settings › Integrations › Connect Meta ».
- [ ] Relire, puis **Envoyer** (toi).
- [ ] Après validation : passer l'app en **mode Live**.
