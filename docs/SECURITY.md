# Guide de Sécurité - ChatSecure

## Vue d'ensemble

Ce document décrit les mesures de sécurité implémentées dans ChatSecure et les bonnes pratiques à suivre pour un déploiement sécurisé.

## Chiffrement End-to-End

### Principe

Le chiffrement E2EE garantit que seul l'expéditeur et le destinataire peuvent lire les messages. Le serveur ne peut jamais déchiffrer le contenu.

### Implémentation

1. **RSA-2048** pour l'échange de clés
   - Clé publique stockée sur le serveur
   - Clé privée stockée uniquement côté client
   - Utilisé pour chiffrer les clés AES

2. **AES-256-GCM** pour le chiffrement des messages
   - Clé symétrique partagée par room
   - IV unique par message (12 bytes)
   - Authentification intégrée (GCM)

### Limitations Actuelles

⚠️ **Important** : L'implémentation actuelle a des limitations :

1. **Stockage des clés privées** : Utilise localStorage (non sécurisé)
   - **Solution recommandée** : IndexedDB avec chiffrement ou Web Crypto Key Storage

2. **Échange de clés** : Manuel (à automatiser)
   - Les clés AES doivent être partagées entre membres
   - Solution future : Protocole d'échange de clés automatique

3. **Forward Secrecy** : Non implémenté
   - Les clés ne sont pas rotées régulièrement
   - Solution future : Signal Protocol ou rotation périodique

## Authentification

### JWT (JSON Web Tokens)

- **Secret** : Minimum 32 caractères, aléatoire
- **Expiration** : 7 jours (configurable)
- **Stockage** : localStorage (à améliorer avec httpOnly cookies en production)

### Mots de passe

- **Hashage** : bcrypt avec 12 rounds
- **Validation** : Minimum 8 caractères, majuscule, minuscule, chiffre
- **Stockage** : Jamais en clair

## Protection contre les Attaques

### XSS (Cross-Site Scripting)

**Mesures implémentées :**
- Échappement HTML côté serveur
- Validation stricte des entrées
- Content Security Policy (à configurer)

**Recommandations :**
```javascript
// Utiliser DOMPurify pour le HTML côté client
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

### Injection

**Mesures implémentées :**
- Validation Mongoose (schémas stricts)
- Requêtes paramétrées
- Pas de concaténation de requêtes

**Exemple :**
```javascript
// ✅ Bon
Room.findById(roomId)

// ❌ Mauvais
Room.find({ _id: roomId + userInput })
```

### CSRF (Cross-Site Request Forgery)

**Mesures implémentées :**
- CORS configuré
- Tokens JWT dans headers (pas cookies)
- Validation d'origine

### Spam/Flood

**Mesures implémentées :**
- Rate limiting par IP (100 req/15min)
- Rate limiting par route :
  - Auth : 5 tentatives/15min
  - Messages : 30/min
  - Fichiers : 10/heure

### Man-in-the-Middle

**Mesures requises :**
- ✅ HTTPS obligatoire en production
- ✅ Chiffrement E2EE (protection même si HTTPS compromis)
- ✅ Validation des certificats

## Sécurité des Fichiers

### Upload

1. **Validation du type** : Liste blanche d'extensions
2. **Validation de la taille** : Maximum 10MB (configurable)
3. **Chiffrement** : Fichiers chiffrés avant upload
4. **Checksum** : SHA-256 pour vérifier l'intégrité
5. **Expiration** : Fichiers supprimés après 30 jours

### Stockage

- Fichiers stockés dans `server/uploads/`
- Noms de fichiers aléatoires (pas de noms originaux)
- Accès restreint par room

## Isolation des Rooms

### Vérifications

Chaque action vérifie :
1. L'utilisateur est membre de la room
2. L'utilisateur a les permissions nécessaires
3. La room existe et est active

### Permissions

- **Owner** : Toutes les permissions
- **Admin** : Gestion membres, pas suppression room
- **Member** : Envoi messages, upload fichiers

## Bonnes Pratiques de Déploiement

### Variables d'Environnement

```env
# ⚠️ CRITIQUE : Changer en production
JWT_SECRET=<générer-avec-openssl-rand-hex-32>

# MongoDB avec authentification
MONGODB_URI=mongodb://user:password@host:27017/s25_testchat?authSource=admin

# HTTPS uniquement
CORS_ORIGIN=https://votre-domaine.com
```

### Génération de Secrets

```bash
# Générer un secret JWT fort
openssl rand -hex 32

# Générer un secret MongoDB
openssl rand -base64 32
```

### Configuration MongoDB

```javascript
// Activer l'authentification
use admin
db.createUser({
  user: "admin",
  pwd: "strong-password",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})
```

### Configuration Nginx (Reverse Proxy)

```nginx
server {
    listen 443 ssl http2;
    server_name votre-domaine.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Firewall

```bash
# Autoriser uniquement HTTPS et SSH
ufw allow 22/tcp
ufw allow 443/tcp
ufw enable
```

## Audit de Sécurité

### Checklist

- [ ] HTTPS activé et configuré correctement
- [ ] JWT_SECRET fort et unique
- [ ] MongoDB avec authentification
- [ ] Rate limiting activé
- [ ] Validation des entrées complète
- [ ] Logs configurés (sans secrets)
- [ ] Monitoring en place
- [ ] Backups automatiques
- [ ] Firewall configuré
- [ ] Dépendances à jour
- [ ] Tests de sécurité effectués

### Tests de Sécurité

```bash
# Vérifier les vulnérabilités npm
npm audit

# Scanner avec OWASP ZAP
# Utiliser Burp Suite pour les tests
# Tests de pénétration recommandés
```

## Gestion des Secrets

### ⚠️ Ne JAMAIS commiter

- Secrets JWT
- Mots de passe
- Clés privées
- Tokens API

### Utiliser

- Variables d'environnement
- Services de gestion de secrets (AWS Secrets Manager, HashiCorp Vault)
- `.env` dans `.gitignore`

## Incident Response

### En cas de compromission

1. **Isoler** : Couper l'accès immédiatement
2. **Analyser** : Identifier la source
3. **Corriger** : Patcher la vulnérabilité
4. **Notifier** : Informer les utilisateurs si nécessaire
5. **Documenter** : Enregistrer l'incident

### Contacts

- Équipe sécurité : security@example.com
- Urgences : +33 X XX XX XX XX

## Conformité

### RGPD

- **Données personnelles** : Email, username
- **Consentement** : Requis pour traitement
- **Droit à l'oubli** : Implémenter suppression compte
- **Portabilité** : Export des données

### Recommandations

1. Politique de confidentialité claire
2. Consentement explicite
3. Droit de suppression
4. Chiffrement des données sensibles
5. Logs d'accès

## Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Signal Protocol](https://signal.org/docs/)

