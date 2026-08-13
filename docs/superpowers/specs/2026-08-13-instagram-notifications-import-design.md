# Import de leads depuis screenshots de notifications Instagram

## Contexte

Pierre reçoit des dizaines de notifications Instagram (likes, commentaires, nouveaux followers, follow-backs...) après chaque reel qui performe bien. Aujourd'hui, il doit ouvrir manuellement chaque notification "a commencé à vous suivre" / "a accepté votre demande de suivi" et créer le lead à la main dans ClosRM — 5 à 10 minutes de travail répétitif par jour, potentiellement plusieurs fois par jour sur un reel viral.

## Objectif

Prendre 1 à N captures d'écran du centre de notifications Instagram, extraire automatiquement les nouveaux followers et follow-backs (en ignorant likes/commentaires/republications/suggestions), présenter une liste à valider/trier, créer les leads en masse et optionnellement leur programmer une relance groupée à échéance choisie.

## Ce qui existe déjà (réutilisé, pas recréé)

- Client Claude configuré par workspace (`src/lib/ai/client.ts`, clé API dans Paramètres > Assistant IA) — Claude supporte la vision nativement, pas besoin d'un service OCR tiers.
- Source de lead `follow_ads` déjà dans l'enum `LeadSource` — conçue pour ce cas d'usage.
- `POST /api/leads` avec auto-assignation au créateur (fix récent) — réutilisé tel quel pour la création, pas de nouvelle logique d'attribution à écrire.
- `POST /api/follow-ups` existant pour la création de relance.

## Ce qui est extrait

Sur chaque capture, seuls deux patterns de texte comptent (confirmé sur captures réelles) :
- `"{handle} a commencé à vous suivre"` → nouveau follower
- `"{handle} a accepté votre demande de suivi"` → follow-back accepté

Les deux cas sont traités **de façon identique** — même type de lead créé, aucune distinction de tag ni de traitement. Le `@handle` est toujours visible en gras et cliquable dans la notification — c'est la seule donnée fiable à extraire, pas de tentative d'extraire un "nom affiché" séparé.

Tout le reste (likes reel/story, commentaires, republications, threads suggérés, trophées de vues, "reel programmé publié"...) est ignoré silencieusement par le modèle — pas remonté dans les résultats.

## Architecture

### 1. Extraction — `POST /api/leads/import-from-screenshots`

Reçoit 1 à 10 images (cap dur, upload direct multipart ou base64). Pour chaque image :
- Appel Claude vision (`claude-sonnet-4`, plus fiable que haiku pour de l'OCR structuré sur ce volume de texte dense) avec un prompt strict : extraire uniquement les paires `{handle}` où le texte contient l'un des deux patterns ci-dessus, ignorer tout le reste, répondre en JSON strict.
- Résultats agrégés sur toutes les images, dédupliqués en interne (un handle peut apparaître sur 2 captures qui se chevauchent dans le temps).
- Croisement avec la table `leads` (`workspace_id` + `instagram_handle`) pour détecter les doublons déjà en base.

Réponse : liste de `{ handle: string, already_exists: boolean, existing_lead_id?: string }`.

Pas de nouvelle table — les leads sont créés à la confirmation via la logique déjà existante de `POST /api/leads`, appelée en boucle.

### 2. Écran de review (web + mobile)

Liste des handles extraits sous forme de checklist :
- Tout **pré-coché sauf** les `already_exists` (décochés par défaut, badge "déjà en base" affiché mais sélectionnable manuellement si l'utilisateur veut quand même relancer ce lead existant).
- Toggle individuel par ligne.
- Section basse : case "Créer une relance pour les leads sélectionnés" avec :
  - Délai en jours (défaut **7**)
  - Raison en texte libre, pré-remplie **"Nouveau follower — premier contact"**, éditable, appliquée à tout le lot (pas de champ par profil)
  - Canal fixé à `instagram_dm`

### 3. Confirmation — `POST /api/leads/import-from-screenshots/confirm`

Reçoit la liste des handles cochés + les paramètres de relance batch (activé/off, délai, raison). Pour chaque handle sélectionné :
- Crée le lead via la même logique que `POST /api/leads` (`source: 'follow_ads'`, `instagram_handle`, auto-assigné au créateur).
- Si relance batch activée : crée un `follow_up` (`status: 'en_attente'`, `channel: 'instagram_dm'`, `scheduled_at: now + délai jours`, `reason` = texte du lot) pour chaque lead nouvellement créé.

### 4. Web — point d'entrée

Nouveau bouton "Importer depuis screenshots" sur la page Leads (à côté de l'import CSV existant), ouvre une modale : drop zone multi-image → extraction (loading) → écran de review → confirmation.

### 5. Mobile — point d'entrée

Nouvel écran accessible depuis l'onglet Leads (bouton dédié à côté du FAB "+"). Sélection multi-image via `expo-image-picker`, upload vers la même route API, même écran de review en React Native (réutilise les patterns de `CreateLeadSheet`).

## Erreurs et cas limites

- Image illisible / aucune notification pertinente détectée : le résultat pour cette image est vide, pas d'erreur bloquante — le batch continue avec les autres images.
- Handle malformé extrait (au-delà du regex `^[a-zA-Z0-9._]{1,30}$` déjà utilisé par la validation `instagram_handle`) : exclu silencieusement du résultat plutôt que de faire échouer tout le batch.
- Aucun profil détecté sur l'ensemble du batch : message clair "Aucun nouveau follower détecté sur ces captures", pas d'écran de review vide.

## Hors scope (V1)

- Pas de distinction de traitement entre follow-back et nouveau follower.
- Pas de gestion des captures Android (notif Instagram différente) — web/mobile mais contenu = notifs iOS Instagram uniquement pour l'instant, à valider si besoin plus tard.
- Pas d'auto-détection de la plateforme source (toujours `follow_ads`, pas de choix manuel de source à l'import).
