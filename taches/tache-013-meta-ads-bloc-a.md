# Tâche 013 — Intégration Meta Ads (Bloc A)

**Développeur :** Rémy
**Date de début :** 2026-03-30
**Statut :** En cours

## Description

Connexion OAuth Meta Business pour importer automatiquement les leads Facebook & Instagram Ads dans ClosRM.

## Objectif

Permettre à un coach de connecter son compte Meta depuis `/parametres/integrations` et recevoir les leads en temps réel via webhook.

## Spec

Plan d'implémentation : `docs/superpowers/plans/2026-03-30-meta-ads-integration.md`

Décisions prises :
- OAuth Facebook Login (scope : leads_retrieval, pages_show_list, pages_manage_metadata, pages_read_engagement)
- Token long-lived (60 jours) chiffré en AES-256-GCM dans `integrations.credentials_encrypted`
- Webhook multi-tenant via `meta_page_id` : chaque workspace est identifié par l'ID de sa page Facebook
- Scope Bloc A : OAuth + webhook + page intégrations (les stats Meta sont en Bloc B = T-017)

## Fichiers créés / modifiés

- `supabase/schema.sql` — colonne `meta_page_id` ajoutée à `integrations`
- `src/types/index.ts` — champs `credentials_encrypted` + `meta_page_id` ajoutés à `Integration`
- `src/lib/supabase/service.ts` — client Supabase service role (webhook)
- `src/lib/meta/encryption.ts` — chiffrement AES-256-GCM
- `src/lib/meta/client.ts` — client Meta Graph API
- `src/app/api/integrations/meta/route.ts` — initiation OAuth
- `src/app/api/integrations/meta/callback/route.ts` — callback OAuth
- `src/app/api/integrations/meta/disconnect/route.ts` — déconnexion
- `src/app/api/webhooks/meta/route.ts` — webhook réception leads
- `src/app/(dashboard)/parametres/integrations/page.tsx` — page intégrations
- `src/app/(dashboard)/parametres/integrations/meta-card.tsx` — composant Meta

## Tâches liées

- T-017 : Meta Marketing API (stats campagnes, budget, CPL) — Bloc B
- T-004 : Module Leads (déjà terminé — leads importés s'y retrouvent)
