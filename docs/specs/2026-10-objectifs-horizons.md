# Objectifs (horizons) — spec

> Analyse de Timestripe faite le 15 oct. 2026 dans Chrome, sur le compte de Pierre (objet de test créé puis supprimé). On reproduit le **comportement**, ni le code ni les assets.
> **Livré en v1 (tâche 050), version simple voulue par Pierre** : des colonnes par période, sans éditeur riche, sans glisser-déposer à la position près, sans défilement infini.

## Ce qu'on a observé dans Timestripe
- **Vues** : Jours, Semaines, Mois, Années, avec une colonne d'environ 300 px par période.
  - L'en-tête tient sur deux lignes, par exemple « S42, 2026 » au-dessus de « 12–18 oct. ».
  - La période courante est écrite en couleur.
  - Une pastille « ‹ Aujourd'hui › » se trouve en bas à droite.
- **Colonne de l'horizon parent** : elle est sur le bord droit, par exemple « MONTH » en vue Semaines, et montre la période parente en cours.
- **Ligne d'un objectif** :
  - une case à cocher et le titre ;
  - dessous, en gris, le **titre de l'objectif parent** (c'est un fil d'Ariane, pas une description) ;
  - un repli « N sous-objectifs » qui liste les enfants, chacun avec sa date.
- **Lien entre horizons** : un objectif appartient à un seul horizon et une seule période. Le lien passe uniquement par la relation parent → enfants. Un objectif du mois n'est jamais recopié dans les semaines.
- **Saisie** : sur « Ajouter… », Entrée crée l'objectif et laisse le champ ouvert pour le suivant ; Échap le ferme.
- **Cocher** : l'effet est immédiat.
- **Supprimer** : il n'y a pas de confirmation, et les sous-objectifs partent avec l'objectif.
- **Menu ⋯** : couleurs, Replanifier, Déplacer vers l'Inbox, Ajouter un sous-objectif, Détacher du parent, Supprimer.

## Ce qui est construit dans ClosRM
- **Table `goals`** (migration 127). Champs principaux :
  - `horizon` : day, week, month, quarter, year ou inbox ;
  - `period_start` : normalisée sur le premier jour de la période, et nulle pour l'Inbox (contraintes SQL) ;
  - `position` : un nombre à virgule (double) ;
  - `parent_id` : en `on delete cascade` ;
  - `done_at`.

  La RLS est appliquée par `workspace_id`.
- **API** :
  - `GET /api/goals?horizon&from&to` renvoie les objectifs de la plage, avec leurs parents et leurs enfants directs.
  - `POST /api/goals` crée un objectif.
  - `PATCH /api/goals/:id` le modifie. `done` est converti en `done_at` ; un parent qui créerait une boucle est refusé.
  - `DELETE /api/goals/:id` le supprime.
  - Si la migration n'est pas appliquée, l'API renvoie une 503 avec un message clair.
- **Page desktop `/objectifs`** :
  - onglets Jours, Semaines, Mois, Trimestres, Années, Inbox, avec le dernier onglet utilisé gardé en mémoire ;
  - 8 colonnes, de la période précédente à six périodes plus loin, et la colonne de l'horizon parent à droite ;
  - « ‹ Aujourd'hui › », et les touches T, ← et → ;
  - case à cocher, titre modifiable par un clic, fil vers le parent, sous-objectifs ;
  - menu : couleur, période précédente ou suivante, Inbox (ou « planifier » depuis l'Inbox), sous-objectif, détacher, supprimer ;
  - un objectif glissé vers une autre colonne se place en fin de colonne ;
  - mise à jour optimiste, avec retour arrière et message en cas d'erreur.
- **Écarts assumés avec Timestripe** :
  - un onglet Trimestres en plus ;
  - pas de vue Heures, puisque l'Agenda de ClosRM la couvre déjà ;
  - pas de vue Horizons d'ensemble ;
  - pas de fenêtre de détail avec éditeur riche ;
  - pas de confettis : une petite animation de la case à la place ;
  - pas d'assignation ni de partage.
