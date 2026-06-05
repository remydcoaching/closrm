# Lead Journey — guide de test

## 0. Préparation (à faire **une seule fois**)

Avant de tester, applique la migration sur ton Supabase :

```sql
-- À copier-coller dans Supabase SQL Editor
alter table public.leads
  add column if not exists visitor_id text,
  add column if not exists form_answers jsonb default '{}'::jsonb;

create index if not exists idx_leads_visitor_id
  on public.leads (visitor_id)
  where visitor_id is not null;
```

Fichier source : `supabase/migrations/083_lead_journey_tracking.sql`.

L'app tourne sur **http://localhost:3100**.

---

## 1. Dédoublonnage Meta webhook ↔ Booking (le bug initial)

**Avant** : ton lead form Meta + ta page calendrier créaient 2 leads.

### Test 1.1 — Même email, casse différente
1. Sur ta page funnel publique, soumets le formulaire avec `pierre@example.com`.
2. Sur la même page, re-soumets avec `Pierre@Example.com`.
3. **Attendu** : 1 seul lead dans `/leads`. Le 2e submit a rattaché les infos au 1er.

### Test 1.2 — Même téléphone, format différent
1. Soumets le formulaire avec téléphone `06 12 34 56 78`.
2. Re-soumets avec `+33612345678`.
3. **Attendu** : 1 seul lead.

### Test 1.3 — Lead form Meta puis booking
1. Simule un lead Meta (ou attends-en un réel sur ta page Meta connectée).
2. Va sur ta page calendrier publique et booke un créneau avec **le même email**.
3. **Attendu** : 1 seul lead, qui a maintenant et l'attribution Meta et le booking rattaché.

---

## 2. Affichage des réponses du calendrier sur la fiche lead

**Avant** : les réponses aux questions personnalisées du calendrier étaient invisibles.

### Test 2.1
1. Crée un calendrier avec une question custom (ex : « Quel est ton budget mensuel ? »).
2. Booke un créneau publique en répondant à la question.
3. Ouvre la fiche du lead créé (`/leads/[id]`).
4. **Attendu** : un bloc « Parcours du lead » apparaît avec une section « Réservation … » qui liste la question + ta réponse.

---

## 3. Réponses du Lead Form Meta visibles

**Avant** : seuls nom/email/tél étaient gardés, les questions custom Meta étaient jetées.

### Test 3.1
1. Si tu as un Lead Form Meta avec des questions personnalisées : soumets-le.
2. Ouvre la fiche du lead créé.
3. **Attendu** : bloc « Réponses Lead Form Meta » avec toutes tes questions custom.

---

## 4. Tracking d'attribution publicitaire (fbclid / utm)

### Test 4.1 — Capture d'un fbclid simulé
1. Ouvre une page funnel publique avec un paramètre simulant un clic Meta :
   `http://localhost:3100/f/<workspace_slug>/<funnel_slug>?fbclid=ABC123&utm_campaign=test_camp_1`
2. Soumets le formulaire de la page.
3. Ouvre la fiche du lead.
4. **Attendu** :
   - Pavé « Première pub » → `fbclid = ABC123` (ou `utm_campaign = test_camp_1`)
   - Pavé « Dernière pub » → idem (s'il n'y a eu qu'une visite)
   - Section « Activité chronologique » → l'événement « A consulté la page X » avec horodatage.

### Test 4.2 — First-touch ≠ Last-touch
1. Visite ton funnel avec `?fbclid=FIRST_AD` (sans rien soumettre).
2. Reviens **plus tard** sur le même funnel (même navigateur) avec `?fbclid=LAST_AD`.
3. Soumets le formulaire.
4. **Attendu** :
   - « Première pub » → `fbclid = FIRST_AD`
   - « Dernière pub » → `fbclid = LAST_AD`

> Astuce : pour simuler le « plus tard » sans purger les cookies, ouvre les 2 URLs dans le même navigateur. Le cookie `_closrm_vid` est partagé donc le visitor_id reste constant.

### Test 4.3 — Visiteur sans attribution
1. Va directement sur le funnel sans paramètre dans l'URL.
2. Soumets le formulaire.
3. **Attendu** : sur la fiche lead, les 2 pavés affichent « Non disponible » (sauf si le lead a quand même un `meta_ad_id` venant d'un webhook Meta antérieur — auquel cas c'est ça qui s'affiche en fallback).

---

## 5. Timeline complète (parcours détaillé)

### Test 5.1 — Suite d'actions
1. Visite ton funnel avec `?utm_campaign=full_journey`.
2. Clique sur un bouton CTA (`[data-cta]`).
3. Regarde une vidéo YouTube de la page jusqu'à 50 %.
4. Soumets le formulaire.
5. Ouvre la fiche lead.
6. **Attendu** dans « Activité chronologique » :
   - A consulté la page X — 15:42
   - A cliqué sur « Réserver » — 15:43
   - A regardé une vidéo jusqu'à 25 % — 15:44
   - A regardé une vidéo jusqu'à 50 % — 15:45
   - A rempli le formulaire — 15:46

---

## 6. Régression — ne pas casser l'existant

### Test 6.1 — Booking direct (slug)
- Va sur `/book/<workspaceSlug>/<calendarSlug>` (page calendrier directe hors funnel) et réserve.
- **Attendu** : la réservation se crée comme avant, le lead est dédupliqué si l'email/tel existe déjà.

### Test 6.2 — Booking via funnel BookingBlock
- Va sur une page funnel contenant un BookingBlock et réserve.
- **Attendu** : même comportement, dédup OK, et la réservation est visible dans le bloc « Parcours » de la fiche lead.

### Test 6.3 — Création manuelle de lead
- Ouvre `/leads`, crée un lead manuellement (bouton « Ajouter »).
- **Attendu** : pas de régression, le lead est créé sans bloc « Parcours » (rien à afficher).

---

## Si tu vois encore 2 leads pour la même personne

Vérifie dans Supabase :

```sql
select id, first_name, last_name, email, phone, source, created_at
from leads
where workspace_id = '<ton-ws-id>'
order by created_at desc
limit 10;
```

- Si les 2 leads ont des emails différents (`@gmail.com` vs `@icloud.com`), la dédup ne peut rien faire — c'est une vraie 2e personne ou 2 adresses.
- Si l'email **est** le même mais la dédup n'a pas marché → ouvrir une issue, partager les 2 lignes.
