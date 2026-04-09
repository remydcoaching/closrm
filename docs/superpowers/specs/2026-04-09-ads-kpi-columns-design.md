# Spec — Colonnes KPI avancees + Modale Closing + Indicateurs personnalises

> **Date :** 2026-04-09
> **Auteur :** Pierre
> **Statut :** En cours de design

---

## Objectif

Enrichir la page Publicites avec un systeme complet de colonnes selectionnables (comme Meta Ads Manager) couvrant tout le funnel de vente : acquisition → qualification → booking → closing → cash. Ajouter une modale de closing avec montant du deal. Preparer le terrain pour des indicateurs personnalises.

---

## 3 chantiers

### Chantier 1 : Modale Closing (montant du deal)

Quand un lead passe en statut "clos" (n'importe ou dans le CRM), une modale s'ouvre :
- Montant total du deal (€)
- Mode de paiement : unique / 2x / 3x / 4x / 6x / 12x
- Montant encaisse aujourd'hui (€)
- Notes (optionnel)

Stockage : nouvelles colonnes sur `leads` :
- `deal_amount` (numeric) — CA contracte
- `deal_installments` (integer) — nombre d'echeances
- `cash_collected` (numeric) — montant encaisse
- `closed_at` (timestamptz) — date du closing

### Chantier 2 : Colonnes selectionnables dans la table Ads

#### Colonnes Meta API (automatiques)
| Colonne | Formule | Source |
|---|---|---|
| Impressions | direct | Meta API |
| CPM | spend / impressions * 1000 | calcul |
| Clics | link_click actions | Meta API |
| CPC | spend / clics | calcul |
| CTR | clics / impressions * 100 | calcul |
| Leads | lead actions | Meta API |
| CPL | spend / leads | calcul |
| Hook rate | 3s video views / impressions * 100 | Meta API video metrics |
| Hold rate 25% | video_p25 / 3s views * 100 | Meta API |
| Hold rate 50% | video_p50 / 3s views * 100 | Meta API |
| Hold rate 75% | video_p75 / 3s views * 100 | Meta API |
| Repetition | frequency | Meta API |

#### Colonnes CRM (calculees depuis ClosRM)
| Colonne | Formule | Source |
|---|---|---|
| CR1 | leads / clics | calcul |
| Appels passes | count calls | table calls |
| Appels repondus | count calls WHERE reached=true | table calls |
| CPAr | spend / appels repondus | calcul |
| % joignabilite | appels repondus / appels passes | calcul |
| CR2 | appels repondus / leads | calcul |
| Seances bookees | count bookings | table bookings |
| CPSb | spend / seances bookees | calcul |
| CR3 | seances bookees / appels repondus | calcul |
| Seances presentes | bookings WHERE status != no_show | table bookings |
| CPSp | spend / seances presentes | calcul |
| % no show | (bookees - presentes) / bookees | calcul |
| Closing | leads WHERE status = clos | table leads |
| CPClose | spend / closings | calcul |
| % Closing | closings / seances presentes | calcul |

#### Colonnes financieres (depuis modale closing)
| Colonne | Source |
|---|---|
| CA contracte | SUM leads.deal_amount WHERE clos | table leads |
| Cash collecte | SUM leads.cash_collected WHERE clos | table leads |
| Marge Brute | CA contracte - spend | calcul |

### Chantier 3 : Indicateurs personnalises (V2 — amelioration)

Le coach peut creer ses propres KPIs avec un builder :
- Nom de l'indicateur
- Formule : choisir 2 metriques existantes + operateur (/, *, -, +)
- Format : %, €, nombre
- Seuils couleur (vert/orange/rouge)

→ Note dans ameliorations.md pour V2.

---

## Implementation envisagee

### Phase 1 : Migration + modale closing
- Migration SQL : `deal_amount`, `deal_installments`, `cash_collected`, `closed_at` sur leads
- Modale closing : s'affiche quand status → clos
- Integration dans LeadSidePanel, page leads, page closing

### Phase 2 : Enrichir l'API Meta insights
- Ajouter les champs video (3s views, p25, p50, p75, frequency) dans getInsights()
- Calculer hook rate, hold rates

### Phase 3 : API funnel KPIs par periode
- Nouvelle route ou enrichir /api/performance/follow-ads
- Retourne les counts CRM (appels, bookings, closings, cash) par periode

### Phase 4 : Column picker enrichi dans ads-table-tab
- Dropdown avec toutes les colonnes groupees par categorie
- Persistence localStorage
- Colonnes CRM fetchees en parallele des Meta insights
