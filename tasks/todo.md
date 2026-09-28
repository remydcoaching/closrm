# Todo — branche feature/pierre-lead-journey (ClosRM Desktop + Instagram Intelligence)

## Fait (session 2026-09-25)
- [x] Restauration migrations 102/103 supprimées
- [x] Leads = une page à onglets (Leads/Pipeline/Closing/Relances/Deals) + page Closing
- [x] Design system Insyder : StatCard, TableCard, Tabs segmentés, Chips — appliqué partout
- [x] Top bar Insyder (pastille @compte · Connecté, menu utilisateur) + onboarding pseudo IG
- [x] Contenu (graphique engagement×vues log, filtres) + page détail contenu (likers/commentateurs, Cibler)
- [x] Audience (segments, quand publier, réels, stories)
- [x] Fiche lead : StatCards, niveau de confiance, Parcours par défaut
- [x] Résultats de ciblage complets (pagination, filtres, recherche, export)
- [x] Persistance Ciblage par lots + interactions par contenu + backup en cas d'échec
- [x] Agenda, Dashboard, Statistiques/Finance, Publicités (parité web)
- [x] Funnels / Emails / Automations / Messages
- [x] Viewers de stories via la session Instagram du coach (comme Insyder)
- [x] Réseaux sociaux / Paramètres / Équipe
- [x] Cache Electron (stale-while-revalidate) + endpoints agrégés (fiche lead, dashboard)
- [x] Spectateurs nominatifs des stories à la une
- [x] Fusion develop + renumérotation des migrations (102–115)

## À faire par Pierre (prod — non fait par Claude)
- [x] 104 et 105 appliquées par Pierre (2026-09-25)
- [x] 106/108/109 appliquées (numéros 112/113/114 après renumérotation)
- [x] 115 et 116 appliquées (colonnes présentes en prod, vérifié 2026-09-27)
- [ ] Déployer le code web (routes /api/instagram/*) AVANT de relancer une analyse Hiker
- [ ] Relancer l'analyse @rebmann_pierre (crédits Hiker) — le run du 20/09 n'a rien enregistré

## Avant PR
- [x] Fusion origin/develop, migrations renumérotées, doublon supprimé, electron exclu de vitest
- [x] Dashboard Desktop : cache + 13 appels par lead supprimés (liste leads renvoie last_activity_at)
- [ ] Emails / Réseaux sociaux : passer au cache (encore en appels directs)
- [ ] Dashboard serveur (v2-queries) : 3,7 s, à optimiser

## Stories (2026-09-27, vérifié en live sur le compte)
- Web API servie au client web : reels_media (stories en ligne), GraphQL profil (stories à la une), list_reel_media_viewer (spectateurs + has_liked + reply_text).
- Non servis au web : feed/user/:id/story, highlights_tray, archive/reel/day_shells (renvoient la page HTML).
- Spectateurs d'une story : uniquement pendant ~48 h après publication (story à la une de décembre → 0 user, viewer_count null). Stories plus anciennes non interrogées.

## Session 2026-09-27 (soir) — stories à la une, photos IG, logo
Constat : les stories à la une du compte ont > 48 h → Instagram ne liste plus leurs spectateurs (limite plateforme, vérifiée). Seules les vues captées pendant les 48 h existent.
- [x] Collecte sur toute la fenêtre de 48 h (story expirée à 24 h mais encore lisible jusqu'à 48 h) + relecture finale
- [x] Une relecture ne doit plus écraser vignette / collection (highlight_id) avec null
- [x] Rattacher les stories déjà collectées à leur collection à la une (tagging depuis le tray)
- [x] Spectateurs agrégés par collection (personne → nb de stories vues, lead ou non) dans « Vos stories à la une »
- [x] État clair par story : N spectateurs collectés / hors fenêtre Instagram
- [x] macOS : fermer la fenêtre la masque (la collecte continue)
- [x] Photos IG : en-tête CORP same-origin du CDN bloque les images → retiré pour les hôtes IG dans Electron
- [x] Leads enrichis par les spectateurs (instagram_user_id, photo) quand absents
- [x] Logo de l'app (icône Dock/.icns + sidebar)
- [x] Tests + typecheck + docs (etat, ameliorations, tâche)
- [x] Photos partout où un avatar est affiché (pipeline, deals, dashboard, finance, RDV) + ta photo IG dans la barre du haut
- [ ] Pierre : appliquer 117_backfill_lead_instagram_pictures.sql (remplit les photos des leads depuis spectateurs + DM)
- [ ] À valider : j'aime des stories à la une (A-049-3), photos IG en Storage (A-049-4/5)
- [x] Insyder analysé (Hiker pour le public, session pour les stories, webhook Meta pour les réponses) ; réveils aléatoires + caches disque repris
- [ ] Pierre : lancer « Photos manquantes » dans Leads (Hiker, ~1 requête par lead, confirmation demandée)
- [ ] À décider : collecte serveur (session en vault + proxy, comme Insyder) pour collecter app fermée

## Suivi des publications (modèle Insyder) — 2026-09-28
Hiker relit périodiquement likers + commentaires des publications récentes ; les nouveaux gestes entre deux passages sont datés de l'intervalle.
- [x] Migration 118 : réglages (désactivé par défaut, budget/jour), contenus suivis (état de scan), observations (toutes personnes), journal des passages, cron pg_cron horaire + purge
- [x] Politique pure : cadence par âge, sélection sous budget, relecture seulement si compteurs changés, diff des observations
- [x] Passage : liste des contenus récents → likers/commentaires des contenus dus → observations → interactions des leads connus
- [x] Routes : /api/instagram/monitor (état, réglages, lancer) + /api/cron/instagram-monitor
- [x] UI desktop : carte « Suivi des publications » + derniers gestes détectés
- [x] Tests + docs
- [ ] Pierre : appliquer 118_instagram_monitoring.sql (projet hsnqmjsckekbmmwneybb), déployer le code (route /api/cron/instagram-monitor) AVANT d'activer le suivi, puis Contenu › Activer le suivi
