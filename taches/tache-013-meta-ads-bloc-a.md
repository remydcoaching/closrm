# Tâche 013 — Intégration Meta Ads (Bloc A)

**Développeur :** Rémy
**Date de début :** 2026-03-30
**Date de fin :** 2026-03-31
**Statut :** ✅ Terminé (avec limitation Meta)

## Description

Connexion OAuth Meta Business pour importer automatiquement les leads Facebook & Instagram Ads dans ClosRM.

## Objectif

Permettre à un coach de connecter son compte Meta depuis `/parametres/integrations` et recevoir les leads en temps réel via webhook.

## Spec

Plan d'implémentation : `docs/superpowers/plans/2026-03-30-meta-ads-integration.md`

Décisions prises :
- OAuth Facebook Login (scope : leads_retrieval, pages_show_list, pages_manage_metadata, pages_read_engagement, business_management)
- Token long-lived (60 jours) chiffré en AES-256-GCM dans `integrations.credentials_encrypted`
- Webhook multi-tenant via `meta_page_id` : chaque workspace est identifié par l'ID de sa page Facebook
- Fallback `/me/businesses` pour les pages gérées via Meta Business Suite (ne remontent pas dans `/me/accounts`)
- Scope Bloc A : OAuth + webhook + page intégrations (les stats Meta sont en Bloc B = T-017)

## Fichiers créés / modifiés

- `supabase/schema.sql` — colonne `meta_page_id` ajoutée à `integrations`
- `src/types/index.ts` — champs `credentials_encrypted` + `meta_page_id` ajoutés à `Integration`
- `src/lib/supabase/service.ts` — client Supabase service role (webhook)
- `src/lib/meta/encryption.ts` — chiffrement AES-256-GCM
- `src/lib/meta/client.ts` — client Meta Graph API (OAuth, pages, leadgen, Business Manager fallback)
- `src/app/api/integrations/meta/route.ts` — initiation OAuth
- `src/app/api/integrations/meta/callback/route.ts` — callback OAuth
- `src/app/api/integrations/meta/disconnect/route.ts` — déconnexion
- `src/app/api/webhooks/meta/route.ts` — webhook réception leads
- `src/app/(dashboard)/parametres/integrations/page.tsx` — page intégrations
- `src/app/(dashboard)/parametres/integrations/meta-card.tsx` — composant Meta
- `src/components/layout/Sidebar.tsx` — ajout lien Intégrations
- `src/lib/supabase/middleware.ts` — `/api/webhooks` en route publique

## Tests effectués

| Test | Résultat |
|------|----------|
| OAuth connect (local + Vercel) | ✅ |
| Disconnect | ✅ |
| Webhook GET vérification (local + Vercel) | ✅ |
| Webhook POST (curl manuel avec vrai leadgen_id) | ✅ Lead inséré en DB |
| Webhook POST (livraison automatique par Meta) | ❌ Meta ne délivre pas en mode Development |

## Limitation connue

**Meta ne délivre pas les webhooks en mode Development.** Le Leads Testing Tool affiche "Pending" pour CLOSRM alors que Privyr et Make (apps publiées) reçoivent "Success". Le code est prouvé fonctionnel via curl manuel (lead inséré en DB). La livraison automatique fonctionnera quand l'app passera en Live mode (après App Review Meta).

## Variables d'environnement requises

- `META_APP_ID` — ID de l'app Meta
- `META_APP_SECRET` — Secret de l'app Meta
- `META_WEBHOOK_VERIFY_TOKEN` — Token de vérification webhook (choisi par nous)
- `ENCRYPTION_KEY` — 64 hex chars (32 bytes) pour AES-256-GCM
- `SUPABASE_SERVICE_ROLE_KEY` — Clé service role Supabase

## Prérequis côté Meta for Developers

1. App créée avec Facebook Login for Business
2. Webhook configuré (Page → leadgen) avec URL Vercel
3. Page subscription active (`subscribePageToLeadgen`)
4. CRM autorisé dans Gestionnaire d'accès aux prospects (si personnalisé)

## Tâches liées

- T-017 : Meta Marketing API (stats campagnes, budget, CPL) — Bloc B
- T-004 : Module Leads (déjà terminé — leads importés s'y retrouvent)
