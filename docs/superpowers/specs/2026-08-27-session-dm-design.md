# Session DM — Design

## Contexte et objectif

ClosRM Mobile a aujourd'hui un écran "Relances" (`mobile/src/app/follow-ups/FollowUpsScreen.tsx`) qui liste les follow-ups par onglet (today/overdue/upcoming/done), mais le setter doit encore : ouvrir chaque lead manuellement, chercher le contexte, décider du message, revenir marquer le follow-up comme fait, et recommencer.

**Session DM** transforme ça en un mode de travail dédié : le setter choisit combien de DM il veut faire, ClosRM sélectionne automatiquement les leads les plus prioritaires, et les présente un par un dans un flow linéaire optimisé pour la vitesse — jusqu'à ce que la liste soit traitée.

Objectif produit : réduire la charge mentale et le temps de décision du setter (aujourd'hui : "qui je relance, avec quel message, où j'en étais"), sans dupliquer la logique de données déjà existante (leads, follow_ups, instagram_interactions, pipeline de statuts).

## Hors scope (explicitement exclu de cette itération)

- **Génération de message par IA.** Le message recommandé vient de templates statiques choisis par règle (voir section Templates), pas d'un modèle de langage. Motif : simplicité, prévisibilité, pas de coût/latence IA récurrents sur un usage quotidien (~40 leads/jour).
- **Icebreaker A/B testing et taux de réponse par message.** Le suivi actuel se fait manuellement sur un sheet externe ; l'automatiser est un sujet à part entière, à traiter séparément.
- **Taux de réponse automatisé dans Session DM.** Un lead ne peut pas "avoir répondu" à l'instant où on vient de lui envoyer un message — la réponse arrive des heures/jours plus tard. Tant que ClosRM n'est pas Meta Partner (API Instagram Messaging officielle), il n'y a pas de webhook fiable sur les DM entrants ; seul le scraping Apify des likes/commentaires publics existe. Cette feature attend l'obtention du statut Meta Partner.
- **Messagerie native in-app (lire/répondre aux DM directement dans ClosRM).** Attend aussi le statut Meta Partner. En attendant, "Ouvrir Instagram" continue d'ouvrir le profil (deep link existant), pas la conversation.
- **Multi-setter / verrouillage concurrent de session.** V1 = un coach/setter solo par workspace (cf. CLAUDE.md, rôles V2). Pas de gestion de conflit "deux personnes piochent le même lead en même temps".

## Point d'entrée

Bouton **"Lancer une session DM"** dans l'écran **Relances** mobile existant (`mobile/src/app/follow-ups/FollowUpsScreen.tsx`, tab `FollowUpsTab`), pas un nouvel onglet séparé.

Note de correction (post-brainstorming initial) : l'app a un écran `InboxScreen`/`MessagesStack` (conversations Instagram) dans le code, mais il n'est monté dans aucun tab actuellement — feature laissée de côté au profit du tab Relance. Le point d'entrée retenu est donc l'écran Relance, le seul réellement accessible aujourd'hui.

Le bouton affiche le nombre de leads actuellement éligibles (badge). Si une session est déjà en cours (non terminée), il affiche "Reprendre la session (12/30)" à la place de la configuration initiale.

## Sélection et priorisation des leads

Pas de nouvelle table de leads ni de duplication de données : la sélection interroge `leads`, `follow_ups`, et `instagram_interactions` existants.

**Catégories de priorité (ordre de traitement dans la session) :**

1. **Relance en retard** — `follow_ups.status = 'en_attente'` et `follow_ups.scheduled_at` déjà passé.
2. **Engagement Instagram récent non traité** — lead avec une ligne récente dans `instagram_interactions` (like/commentaire) sans follow-up ni contact déclenché depuis.
3. **Jamais recontacté depuis longtemps** — `leads.last_activity_at` (ou équivalent dernier contact) antérieur au seuil configuré (14/30/60/90 jours), sans follow-up programmé.
4. **Premier message jamais envoyé** — nouveaux leads sans aucune interaction sortante enregistrée.

Ces catégories sont calculées, pas stockées : une requête au lancement de la config agrège les compteurs par catégorie (affichés dans l'écran de configuration) et construit la file dans cet ordre, tronquée au nombre de profils choisi (10/20/30/45/tous).

**Configuration de session (écran avant démarrage) :**
- Nombre de profils (10/20/30/45/tous)
- Seuil "ancien lead" (14/30/60/90 jours, personnalisé)
- Récapitulatif de la composition de la file par catégorie (lecture seule, transparence sur ce qui va être traité)

## Écran de session (un lead à la fois)

Pour chaque lead affiché :

- **En-tête** : avatar/initiales, prénom/nom, handle Instagram, pastille de priorité (ex. "Relance en retard").
- **Stats rapides** : dernier contact (délai relatif), statut pipeline actuel.
- **Historique récent (timeline unifiée)** : réutilise la logique de `LeadJourneyBlock` / route `/api/leads/[id]/journey` déjà existante côté web (à exposer côté mobile si pas déjà fait), fusionnant chronologiquement : événements Instagram (`instagram_interactions` — like/commentaire, avec aperçu et lien "voir le reel"), changements de statut pipeline, et deals/calls pertinents. Pas de nouvelle table : agrégation en lecture des sources existantes.
- **Message recommandé** : voir section Templates ci-dessous. Actions : Copier (presse-papier), Ouvrir Instagram (réutilise `openInstagram` de `LeadDetailScreen.tsx` — deep link `instagram://user?username=...` avec fallback web).
- **Note optionnelle** : champ texte court, enregistré sur le follow-up créé/mis à jour (`follow_ups.notes`).

**Actions de fin de traitement (bas d'écran, fixe) :**
- **Relancé** → ouvre le sélecteur de délai de prochaine relance (2j/3j/7j/14j/30j/personnalisé), crée ou met à jour un `follow_ups` (réutilise le système existant, pas de nouveau concept), avance le statut du lead dans le pipeline (`leads.status`), passe au profil suivant.
- **À archiver** → marque le lead comme sorti du cycle de relance (à définir précisément avec l'équipe : nouveau statut ou flag distinct du pipeline existant — investiguer avant migration), passe au suivant.
- **Passer pour l'instant** → aucune écriture, le lead reste dans la file, passe au suivant ; en fin de session, les leads "passés" sans autre action restent visibles comme non traités (pas retirés silencieusement).

## Templates de message (sans IA)

Règles simples, pas de génération dynamique :

| Situation du lead | Template |
|---|---|
| Jamais contacté (catégorie 4) | Premier message / icebreaker statique avec `{{prenom}}` |
| Déjà contacté, follow-up en retard normal (catégorie 1) | Relance standard avec `{{prenom}}` |
| Ancien lead, longtemps sans nouvelles (catégorie 3, seuil dépassé) | Reprise après longtemps, avec `{{prenom}}` et éventuellement `{{jours_depuis_dernier_contact}}` |

Le template appliqué est affiché explicitement (badge, ex. "Template · Reprise après 61 jours") pour que le setter comprenne pourquoi ce texte est proposé. Le setter peut copier tel quel ; pas d'édition inline prévue en V1 (le message est tapé/adapté directement dans Instagram si besoin).

Les textes des 3 templates sont à écrire par Pierre — pas de contenu par défaut inventé par l'implémentation.

## Persistance de session

Une session (config choisie, liste ordonnée de leads, position courante, leads déjà traités avec leur issue) doit survivre à la fermeture de l'app. Stockage : une table légère dédiée (ex. `dm_sessions` + `dm_session_items`) plutôt que de dupliquer l'état des leads — à détailler dans le plan d'implémentation avec la structure minimale nécessaire (pas de sur-ingénierie : l'objectif est juste de reprendre où on s'était arrêté, pas un historique riche).

## Fin de session

Écran récapitulatif avec uniquement des faits vérifiables à l'instant T :
- Nombre de leads relancés
- Nombre de prochaines relances programmées (= relancés, en V1, puisque chaque "Relancé" en crée une)
- Nombre archivés
- **Aucune mention de taux de réponse** (voir Hors scope)

## Ce qui est réutilisé tel quel (ne pas dupliquer)

- `follow_ups` (table, validations `src/lib/validations/follow-ups.ts`, action `create-followup.ts`) pour toute planification de prochaine relance.
- `instagram_interactions` et le pipeline Apify existant (`process-likers.ts`, crons `apify-instagram-likes`, `apify-poll-results`) pour le signal d'engagement — rien à construire ici, uniquement consommer.
- `LeadJourneyBlock` / route journey pour la timeline (à porter/exposer côté mobile si l'équivalent mobile n'existe pas déjà en détail).
- `openInstagram` de `LeadDetailScreen.tsx` pour l'ouverture du profil.
- Le pipeline de statuts `leads.status` existant (`nouveau`, `setting_planifie`, `no_show_setting`, `closing_planifie`, `no_show_closing`, `clos`, `dead`) — la transition exacte déclenchée par "Relancé"/"À archiver" est à confirmer avec Pierre au moment du plan (aujourd'hui aucune route ne fait de update direct de statut ; à investiguer avant migration).

## Points à trancher pendant l'implémentation (pas bloquants pour la spec, mais à ne pas deviner)

- Mapping exact "Relancé" / "À archiver" → quelle valeur de `leads.status` (ou nouveau champ dédié si le pipeline actuel ne couvre pas "archivé hors cycle de relance").
- Schéma minimal des tables de persistance de session.
- Emplacement exact du bouton d'entrée dans l'écran Messages mobile actuel (au-dessus de la liste, dans un header, etc.) — à caler sur la structure réelle du composant.
