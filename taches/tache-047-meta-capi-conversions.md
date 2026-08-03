# Tâche 047 — Meta CAPI : remonter les conversions à Meta

**Statut** : à faire (planifiée, pas démarrée)
**Priorité** : haute pour le ROAS pub
**Estimation** : ~1 jour de dev

## Contexte

Aujourd'hui Meta affiche un bandeau dans Ads Manager : « You haven't connected a CRM, so your campaign is prioritizing leads using estimated signals ». L'algo de pub optimise donc pour le **volume** de leads, pas pour la **qualité** (celui qui finit par closer).

Le fichier `src/lib/workflows/actions/fb-conversions.ts` existe mais c'est un stub vide. Aucun event de conversion n'est envoyé.

## Objectif

Implémenter le **Conversions API (CAPI)** côté serveur pour que ClosRM dise à Meta :
- Lead reçu → event `Lead`
- Lead `setting_planifie` ou `closing_planifie` → event `QualifiedLead`
- Lead `clos` + `deal_amount` → event `Purchase` avec le montant
- Lead `dead` → optionnel (signal négatif)

→ Meta réoptimise ses pubs pour cibler des profils proches de ceux qui ont closé.

## Spec technique

1. **Sender CAPI** (`fb-conversions.ts`)
   - POST vers `https://graph.facebook.com/v19.0/{pixel_id}/events`
   - `event_name`, `event_time`, `event_id` (dédup avec pixel browser), `action_source: 'system_generated'`
   - `user_data` : `em` (email SHA-256), `ph` (phone SHA-256), `client_ip_address`, `client_user_agent` si dispo
   - `custom_data` : `value`, `currency`, `lead_id` (notre id ClosRM)
   - `original_event_data.lead_id` = `leads.meta_lead_id` (à ajouter ?) pour matcher la pub d'origine

2. **Workflow trigger**
   - Le trigger `lead_status_changed` existe déjà (cf. `src/app/api/leads/[id]/route.ts`)
   - Câbler l'action `facebook_conversions_api` dessus
   - Bypass si pas de pixel_id configuré dans `integrations.meta`

3. **Mapping configurable**
   - UI dans `/parametres/integrations/meta` : tableau « statut ClosRM → event Meta »
   - Stocker dans `integrations.config_jsonb` ou nouvelle table `meta_status_mapping`

4. **Pixel ID dans Meta integration**
   - Vérifier qu'on capte bien le `pixel_id` lors du connect OAuth Meta
   - Sinon ajouter un champ « Pixel ID » manuel dans la config

## Limite connue

Le bouton « Connecter le CRM » dans Meta Ads Manager (cf. capture du 2026-06-05) reste grisé sauf si ClosRM devient **CRM Partner officiel** chez Meta (dossier de candidature à soumettre, review semaines+). Sans ce statut, les events CAPI passent quand même et l'algo optimise — c'est juste qu'on n'apparaît pas dans la liste officielle Meta.

→ Décision : on commence par CAPI tout court (95 % du bénéfice). Le statut Partner viendra quand on aura plusieurs dizaines de coachs.

## Tests à prévoir

- Workspace sans Meta → action skip silencieuse, pas d'erreur
- Statut passe à `clos` avec `deal_amount = 2500` → event `Purchase` envoyé, vérifier dans Meta Events Manager > Test Events
- Statut passe à `dead` → si mappé, event envoyé avec `value = 0`
- Lead créé via Meta Lead Form → event `Lead` automatique
- Hash email/phone : vérifier que c'est bien lowercase + trim avant SHA-256 (sinon Meta dédoublonne mal)

## Dépendances

- Aucune sur le code actuel. Peut être fait après le merge de la tâche 046 (lead journey).
