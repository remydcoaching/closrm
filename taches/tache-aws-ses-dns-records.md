# AWS SES — Enregistrements DNS à ajouter pour `closrm.fr`

> Récupérés depuis console AWS SES le 2026-04-19
> Région : eu-west-3 (Paris)
> Compte AWS : 7656-0752-4650

## Enregistrements DKIM (3 CNAME)

| Type | Nom (Hostname) | Valeur (Target) |
|------|----------------|-----------------|
| CNAME | `yvpcgcrxelvvefseuk4r75at4ciaipnx._domainkey.closrm.fr` | `yvpcgcrxelvvefseuk4r75at4ciaipnx.dkim.amazonses.com` |
| CNAME | `f4ak4ygw5odbnfi4u7nuf25q46doeq5g._domainkey.closrm.fr` | `f4ak4ygw5odbnfi4u7nuf25q46doeq5g.dkim.amazonses.com` |
| CNAME | `wv2heqqg2k6xd522hcvwlstyubguu462._domainkey.closrm.fr` | `wv2heqqg2k6xd522hcvwlstyubguu462.dkim.amazonses.com` |

## Enregistrement DMARC (1 TXT) — recommandé

| Type | Nom | Valeur |
|------|-----|--------|
| TXT | `_dmarc.closrm.fr` | `"v=DMARC1; p=none;"` |

## MAIL FROM
Non configuré (pas nécessaire pour commencer). À ajouter plus tard si besoin de MAIL FROM personnalisé.

---

## Comment ajouter chez ton registrar

**Important** : selon le registrar, la saisie du "Nom" diffère :
- **OVH/Gandi** : tu mets juste la partie avant `.closrm.fr` (ex: `yvpcgcrxelvvefseuk4r75at4ciaipnx._domainkey`)
- **Namecheap/Hostinger** : pareil, juste la partie avant le domaine
- **Cloudflare** : tu peux mettre le FQDN complet, il reconnaît automatiquement

Exemple OVH :
```
Sous-domaine : yvpcgcrxelvvefseuk4r75at4ciaipnx._domainkey
Type : CNAME
Cible : yvpcgcrxelvvefseuk4r75at4ciaipnx.dkim.amazonses.com.
```
(noter le point final après `.com` pour les targets CNAME chez OVH)

## Vérification

1. Ajouter les 4 enregistrements chez registrar
2. Attendre 5-30 min (propagation DNS)
3. Dans AWS SES → Configuration → Identities → `closrm.fr` → statut passe à **Verified**
4. Une fois vérifié, retourner sur "Configurer" et le bouton **"Demander un accès à la production"** sera actif
