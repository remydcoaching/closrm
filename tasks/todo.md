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
- [ ] Appliquer 115_highlight_story_viewers.sql et 116_story_media_storage.sql
- [ ] Déployer le code web (routes /api/instagram/*) AVANT de relancer une analyse Hiker
- [ ] Relancer l'analyse @rebmann_pierre (crédits Hiker) — le run du 20/09 n'a rien enregistré

## Avant PR
- [x] Fusion origin/develop, migrations renumérotées, doublon supprimé, electron exclu de vitest
- [ ] Dashboard Desktop : brancher l'écran sur GET /api/desktop/dashboard (snapshot serveur) au lieu des ~12 requêtes
- [ ] Dashboard serveur (v2-queries) : 3,7 s, à optimiser

## Stories (2026-09-27, vérifié en live sur le compte)
- Web API servie au client web : reels_media (stories en ligne), GraphQL profil (stories à la une), list_reel_media_viewer (spectateurs + has_liked + reply_text).
- Non servis au web : feed/user/:id/story, highlights_tray, archive/reel/day_shells (renvoient la page HTML).
- Spectateurs d'une story : uniquement pendant ~48 h après publication (story à la une de décembre → 0 user, viewer_count null). Stories plus anciennes non interrogées.
