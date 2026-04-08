# Spec : Refonte page Messages Instagram

## Contexte

La page Messages (`/acquisition/messages`) fonctionne mais a un design basique et un problème de latence : les nouveaux messages n'apparaissent pas en temps réel car le polling lit depuis Supabase (vide sans sync manuelle).

## Décisions prises

### 1. Layout 3 colonnes — Style CRM/Intercom

| Colonne | Contenu | Largeur |
|---------|---------|---------|
| Gauche | Liste conversations (recherche, badges non-lus, indicateur actif avec barre rouge) | 300px |
| Centre | Thread messages (bulles asymétriques, séparateurs de date, input avec bouton envoi) | flex |
| Droite | Panel infos contact (statut pipeline, tags, prochain RDV, actions rapides, notes) | 280px |

### 2. Design premium dark theme

- Avatars avec gradient (`linear-gradient(135deg, #E53E3E, #C53030)`)
- Bulles envoyées : gradient rouge, `border-radius: 18px 18px 6px 18px`
- Bulles reçues : `background: #151515`, border subtile, `border-radius: 18px 18px 18px 6px`
- Séparateurs de date : pill avec bordure `#1f1f1f`
- Conversation active : barre rouge à gauche (`3px`, gradient)
- Boutons d'action avec hover states
- Cards RDV avec icône et sous-texte
- Labels uppercase `9px` avec letter-spacing
- Zone notes : textarea intégrée au panel contact

### 3. Panel contact — Contexte vente

Visible en permanence à droite avec :
- Avatar + nom + @handle
- Statut pipeline (badge coloré)
- Tags
- Prochain RDV (card avec date)
- Actions rapides : "Planifier un RDV", "Fiche complète"
- Zone de notes libre

"Fiche complète" ouvre un side panel avec historique d'appels, source publicitaire, historique statuts.

### 4. Temps réel — Approche hybride

**Phase 1 (maintenant) : Polling Meta API direct**
- Quand une conversation est ouverte, le polling toutes les 5s va chercher les messages directement sur l'API Meta (pas Supabase)
- Les messages reçus apparaissent en ~5 secondes
- On stocke en Supabase en parallèle pour le cache

**Phase 2 (après Advanced Access) : Webhook + Supabase Realtime**
- Configurer le webhook Instagram dans Meta Developer
- Messages arrivent en temps réel dans Supabase via le webhook
- Frontend écoute via Supabase Realtime (WebSocket)
- Le polling Meta devient fallback

### 5. Hors scope (V2)

- Chat inter-équipe setter/closer sur un contact
- Inbox multi-canal (WhatsApp + Email + Instagram unifié)

## Fichiers impactés

- `src/app/(dashboard)/acquisition/messages/page.tsx` — refonte complète layout + polling Meta
- `src/components/messages/ConversationList.tsx` — redesign liste
- `src/components/messages/ConversationThread.tsx` — redesign bulles
- `src/components/messages/MessageInput.tsx` — redesign input
- `src/components/messages/ContactPanel.tsx` — nouveau composant
- `src/app/api/instagram/messages/route.ts` — polling Meta API direct
