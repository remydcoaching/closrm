# Passage sur Vercel — Checklist

> Guide pour déployer ClosRM en production sur Vercel avec toutes les intégrations.

---

## 1. Pré-requis

- [ ] PR mergée dans `main` (ou Vercel configuré pour déployer depuis `develop`)
- [ ] Toutes les migrations SQL exécutées dans Supabase (sections 1 à 5 de `sql-a-executer.md`)
- [ ] Domaine custom configuré (optionnel) ou utiliser `closrm.vercel.app`

---

## 2. Variables d'environnement à ajouter dans Vercel

**Vercel > Project > Settings > Environment Variables**

### Supabase (obligatoire)
| Variable | Valeur | Où la trouver |
|----------|--------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hsnqmjsckekbmmwneybb.supabase.co/` | Supabase > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase > Settings > API > anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase > Settings > API > service_role key |

### App URL (obligatoire)
| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://closrm.vercel.app` (ou ton domaine custom) |

### Encryption (obligatoire)
| Variable | Valeur | Comment la générer |
|----------|--------|-------------------|
| `ENCRYPTION_KEY` | Clé hex 32 bytes | `openssl rand -hex 32` dans le terminal |

**IMPORTANT** : utiliser la **même** `ENCRYPTION_KEY` qu'en local, sinon les credentials déjà chiffrées (intégrations Telegram, WhatsApp, Google) ne pourront pas être déchiffrées.

### Google OAuth (pour Google Calendar)
| Variable | Valeur | Où la trouver |
|----------|--------|---------------|
| `GOOGLE_CLIENT_ID` | `814437841687-...apps.googleusercontent.com` | Google Cloud Console > Clients |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Google Cloud Console > Clients |

### WhatsApp (optionnel — si configuré)
| Variable | Valeur |
|----------|--------|
| `WHATSAPP_PHONE_NUMBER_ID` | ID du numéro Meta Business |
| `WHATSAPP_ACCESS_TOKEN` | Token Meta Cloud API |

### Resend / Email (optionnel)
| Variable | Valeur |
|----------|--------|
| `RESEND_API_KEY` | Clé API Resend |

---

## 3. Google Cloud Console — Ajouter l'URI Vercel

**Google Cloud Console > CLOSRM > Auth Platform > Clients > ton client OAuth**

Ajouter dans **URI de redirection autorisés** :
```
https://closrm.vercel.app/api/integrations/google/callback
```

(L'URI localhost:3000 peut rester pour le dev local)

---

## 4. Côté code — Ce que Claude doit faire

- [ ] Vérifier que `NEXT_PUBLIC_APP_URL` est bien utilisé partout (pas de `localhost` en dur)
- [ ] Vérifier que le `vercel.json` est correct (cron jobs)
- [ ] Vérifier que le `middleware.ts` / `proxy.ts` fonctionne en production
- [ ] S'assurer que le build passe (`npm run build` sans erreurs)
- [ ] Commit + push sur la branche qui sera déployée

---

## 5. Après le déploiement — Vérifications

- [ ] Se connecter sur `https://closrm.vercel.app/login`
- [ ] Vérifier que le dashboard charge (connexion Supabase OK)
- [ ] Aller dans Paramètres > Intégrations > Connecter Google Agenda (test OAuth en prod)
- [ ] Aller dans Agenda > vérifier que les événements Google Calendar apparaissent
- [ ] Créer un RDV dans ClosRM > vérifier qu'il apparaît dans Google Calendar
- [ ] Tester la page de booking publique `/book/[slug]/[calendar-slug]`
- [ ] Vérifier le dark/light mode
- [ ] Vérifier le branding (couleur d'accent)

---

## 6. Supabase — Variables à vérifier

Dans **Supabase > Settings > API** :

- `Site URL` : mettre `https://closrm.vercel.app`
- `Redirect URLs` : ajouter `https://closrm.vercel.app/**` (pour l'auth callback)

---

## 7. Ordre des opérations

1. **Pierre** : ajouter toutes les env vars dans Vercel
2. **Pierre** : ajouter l'URI Google OAuth pour Vercel
3. **Pierre** : mettre à jour le Site URL dans Supabase
4. **Claude** : vérifier le build, commit, push
5. **Pierre ou Rémy** : merger dans la branche de production (main ou develop selon config Vercel)
6. **Pierre** : tester toutes les fonctionnalités en prod

---

## 8. Variables d'environnement en résumé (copier-coller)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hsnqmjsckekbmmwneybb.supabase.co/
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# App
NEXT_PUBLIC_APP_URL=https://closrm.vercel.app

# Encryption (MEME CLÉ QU'EN LOCAL)
ENCRYPTION_KEY=xxx

# Google OAuth
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# WhatsApp (optionnel)
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx

# Resend (optionnel)
RESEND_API_KEY=xxx
```

---

*Créé le 2026-03-31 — ClosRM*
