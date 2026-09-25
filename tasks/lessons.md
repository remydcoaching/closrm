# Leçons — ClosRM

- 2026-09-24 | Une session a supprimé les migrations 102–106 juste après leur application en prod ("redondantes, les tables existent") : le schéma discovery_profiles/discovery_contents n'existait plus que dans la base. | Ne JAMAIS supprimer un fichier de migration appliqué. Une migration déjà présente ailleurs (autre branche) se renumérote au rebase, elle ne se supprime pas.
- 2026-09-25 | Le run Hiker du 20/09 (1406 profils, crédits payés) n'a rien persisté : le code de persistance n'était pas déployé et aucune erreur n'a été remontée. | Tout traitement payant doit sauvegarder le résultat brut quand la persistance échoue (discovery_runs.metadata.backup) et ne jamais être lancé contre une prod dont le code n'est pas déployé.
- 2026-09-25 | Travail de 5 jours laissé non commité dans un worktree (180 fichiers). | Commit WIP local à chaque fin d'étape, même sur une branche feature non poussée.
- 2026-09-25 | Des sous-agents en parallèle ont tous été coupés par la limite de session du compte. | Lancer au plus 2-3 agents à la fois ; chacun écrit dans son propre dossier ; les relancer via SendMessage (ils gardent leur contexte).
