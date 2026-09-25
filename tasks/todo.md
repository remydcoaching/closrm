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
- [ ] Funnels / Emails / Automations / Messages (agent en cours)
- [ ] Réseaux sociaux / Paramètres / Équipe (agent en cours)

## À faire par Pierre (prod — non fait par Claude)
- [ ] Appliquer en prod : 102/103 déjà appliquées ; appliquer 104_discovery_interactions.sql et 105_workspace_instagram_username.sql
- [ ] Déployer le code web (routes /api/instagram/*) AVANT de relancer une analyse Hiker
- [ ] Relancer l'analyse @rebmann_pierre (crédits Hiker) — le run du 20/09 n'a rien enregistré

## Avant PR
- [ ] Rebase sur origin/develop (67+ commits de retard) ; renuméroter 096–105 de cette branche après 101 ; supprimer 107 (doublon de develop 100)
- [ ] Ajouter 'electron/**' à l'exclude de vitest.config.mts
- [ ] Décision : vues de stories (identités des viewers) — impossible via API officielle, voir ameliorations.md
