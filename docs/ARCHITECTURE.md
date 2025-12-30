# Architecture du Système ChatSecure

## Vue d'ensemble

ChatSecure est un système de chat temps réel avec chiffrement end-to-end (E2EE) conçu pour la sécurité et la scalabilité. L'architecture suit le principe de **zero-knowledge** : le serveur ne peut jamais déchiffrer les messages.

## Architecture Générale

```
┌─────────────────┐         ┌─────────────────┐
│   Client React  │ ◄─────► │  Backend Node.js │
│  (Chiffrement)  │ WebSocket│   (Transport)   │
└─────────────────┘         └─────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │    MongoDB       │
                            │  (Persistance)   │
                            └─────────────────┘
```

## Stack Technologique

### Backend
- **Node.js** avec Express
- **Socket.IO** pour WebSocket temps réel
- **MongoDB** avec Mongoose
- **JWT** pour l'authentification
- **bcrypt** pour le hashage des mots de passe

### Frontend
- **React** 18 avec Hooks
- **Socket.IO Client** pour la communication temps réel
- **Web Crypto API** pour le chiffrement E2EE
- **Axios** pour les requêtes HTTP

## Architecture de Sécurité

### Chiffrement End-to-End

#### 1. Génération des Clés

**Côté Client (Inscription)**
```
1. Génération paire RSA-2048 (public/private)
2. Stockage clé privée côté client (localStorage - à améliorer en production)
3. Envoi clé publique au serveur lors de l'inscription
```

#### 2. Échange de Clés

**Pour chaque Room:**
```
1. Client A génère clé AES-256
2. Client A chiffre la clé AES avec la clé publique RSA de chaque membre
3. Envoi des clés chiffrées via le serveur
4. Chaque membre déchiffre avec sa clé privée
```

#### 3. Chiffrement des Messages

**Envoi:**
```
Message texte → Chiffrement AES-256-GCM → Envoi au serveur
```

**Réception:**
```
Message chiffré → Déchiffrement AES-256-GCM → Affichage
```

**Paramètres AES:**
- Algorithme: AES-GCM
- Taille de clé: 256 bits
- IV: 12 bytes (aléatoire, unique par message)
- Authentification: GCM (intégrité garantie)

### Flux de Communication

```
┌──────────┐                    ┌──────────┐
│ Client A │                    │ Client B │
└────┬─────┘                    └────┬─────┘
     │                               │
     │ 1. Génère clé AES             │
     │ 2. Chiffre avec RSA(B.pub)    │
     │ 3. Envoie clé chiffrée ──────►│
     │                               │ 4. Déchiffre avec RSA(B.priv)
     │                               │ 5. Stocke clé AES
     │                               │
     │ 6. Chiffre message (AES)      │
     │ 7. Envoie message ───────────►│
     │         (via serveur)         │ 8. Déchiffre message (AES)
     │                               │ 9. Affiche message
```

## Structure des Données

### Modèle User

```javascript
{
  _id: ObjectId,
  username: String (unique, 3-30 chars),
  email: String (unique),
  password: String (hashé bcrypt),
  publicKey: String (PEM format),
  isOnline: Boolean,
  lastSeen: Date,
  createdAt: Date
}
```

### Modèle Room

```javascript
{
  _id: ObjectId,
  name: String (1-100 chars),
  description: String (max 500 chars),
  creator: ObjectId (ref: User),
  members: [{
    user: ObjectId (ref: User),
    role: 'owner' | 'admin' | 'member',
    joinedAt: Date
  }],
  isPrivate: Boolean,
  password: String (hashé, si privée),
  maxMembers: Number (2-1000),
  settings: {
    allowFileUpload: Boolean,
    allowInvites: Boolean
  },
  createdAt: Date
}
```

### Modèle Message

```javascript
{
  _id: ObjectId,
  room: ObjectId (ref: Room),
  sender: ObjectId (ref: User),
  content: String (chiffré, base64),
  type: 'text' | 'file' | 'image' | 'system',
  file: {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    encrypted: Boolean
  },
  encrypted: Boolean,
  iv: String (base64),
  recipients: [{
    user: ObjectId (ref: User),
    delivered: Boolean,
    read: Boolean,
    deliveredAt: Date,
    readAt: Date
  }],
  createdAt: Date
}
```

### Modèle File

```javascript
{
  _id: ObjectId,
  filename: String,
  originalName: String,
  mimeType: String,
  size: Number,
  path: String,
  uploader: ObjectId (ref: User),
  room: ObjectId (ref: Room),
  encrypted: Boolean,
  iv: String (base64),
  checksum: String (SHA-256),
  createdAt: Date,
  expiresAt: Date (30 jours)
}
```

## Flux de Communication Socket.IO

### Événements Émis (Client → Serveur)

| Événement | Données | Description |
|-----------|---------|-------------|
| `join_room` | `{ roomId }` | Rejoindre une room |
| `leave_room` | `{ roomId }` | Quitter une room |
| `send_message` | `{ roomId, content, iv, type, file }` | Envoyer un message |
| `typing` | `{ roomId, isTyping }` | Indicateur de frappe |
| `mark_read` | `{ messageId }` | Marquer comme lu |

### Événements Reçus (Serveur → Client)

| Événement | Données | Description |
|-----------|---------|-------------|
| `new_message` | `{ message }` | Nouveau message reçu |
| `user_joined` | `{ userId, username, timestamp }` | Utilisateur rejoint |
| `user_left` | `{ userId, username, timestamp }` | Utilisateur quitté |
| `typing` | `{ userId, username, isTyping }` | Indicateur de frappe |
| `room_users` | `{ roomId, users }` | Liste utilisateurs en ligne |
| `message_read` | `{ messageId, userId }` | Message lu |
| `error` | `{ message }` | Erreur |

## API REST

### Authentification

```
POST   /api/auth/register     - Inscription
POST   /api/auth/login         - Connexion
GET    /api/auth/verify        - Vérifier token
POST   /api/auth/logout        - Déconnexion
GET    /api/auth/user/:id/public - Clé publique utilisateur
```

### Rooms

```
POST   /api/rooms              - Créer room
GET    /api/rooms/public       - Rooms publiques
GET    /api/rooms/my-rooms     - Mes rooms
GET    /api/rooms/:id          - Détails room
POST   /api/rooms/:id/join     - Rejoindre
POST   /api/rooms/:id/leave    - Quitter
DELETE /api/rooms/:id          - Supprimer
```

### Messages

```
GET    /api/messages/room/:id  - Messages d'une room
POST   /api/messages/:id/read  - Marquer comme lu
POST   /api/messages/read-multiple - Marquer plusieurs
```

### Fichiers

```
POST   /api/files/upload       - Upload fichier
GET    /api/files/:id/download - Télécharger
GET    /api/files/room/:id     - Fichiers d'une room
```

## Sécurité

### Authentification

1. **JWT** avec expiration (7 jours par défaut)
2. **bcrypt** pour les mots de passe (12 rounds)
3. **Validation stricte** des entrées (express-validator)
4. **Rate limiting** sur toutes les routes

### Protection contre les Attaques

#### XSS (Cross-Site Scripting)
- Échappement HTML côté serveur
- Validation stricte des entrées
- Content Security Policy (CSP)

#### Injection
- Validation Mongoose
- Requêtes paramétrées
- Pas de concaténation SQL (MongoDB)

#### CSRF (Cross-Site Request Forgery)
- CORS configuré
- Tokens JWT dans headers
- SameSite cookies (si cookies utilisés)

#### Spam/Flood
- Rate limiting par IP
- Rate limiting par utilisateur
- Limite de messages/minute
- Limite de fichiers/heure

#### Man-in-the-Middle
- HTTPS obligatoire en production
- Chiffrement E2EE (même si HTTPS compromis)
- Validation des certificats

### Isolation des Rooms

- Vérification d'appartenance avant chaque action
- Messages isolés par room
- Fichiers isolés par room
- Permissions par rôle (owner/admin/member)

## Scalabilité

### Optimisations Actuelles

1. **Index MongoDB** sur champs fréquemment interrogés
2. **Pagination** des messages (50 par défaut)
3. **Lazy loading** des messages
4. **Compression** Socket.IO

### Améliorations Futures

1. **Redis** pour cache et sessions
2. **Load balancing** avec plusieurs instances
3. **CDN** pour les fichiers statiques
4. **Clustering** Node.js
5. **Database sharding** si nécessaire
6. **Message queue** (RabbitMQ/Kafka) pour haute charge

## Déploiement

### Variables d'Environnement Requises

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/s25_testchat
JWT_SECRET=<secret-min-32-chars>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,txt
NODE_ENV=production
```

### Checklist Production

- [ ] HTTPS activé
- [ ] JWT_SECRET fort et unique
- [ ] MongoDB avec authentification
- [ ] Rate limiting configuré
- [ ] Logs configurés
- [ ] Monitoring (Sentry, etc.)
- [ ] Backup automatique MongoDB
- [ ] Firewall configuré
- [ ] Clés privées stockées de manière sécurisée (pas localStorage)
- [ ] Tests de charge effectués

## Bonnes Pratiques

### Code

1. **Validation** : Toujours valider les entrées
2. **Erreurs** : Gestion d'erreurs complète
3. **Logs** : Logging approprié (pas de secrets)
4. **Tests** : Tests unitaires et d'intégration
5. **Documentation** : Code commenté et README

### Sécurité

1. **Principle of Least Privilege** : Permissions minimales
2. **Defense in Depth** : Plusieurs couches de sécurité
3. **Zero Trust** : Ne jamais faire confiance aux données
4. **Regular Updates** : Mettre à jour les dépendances
5. **Security Audits** : Audits réguliers

### Performance

1. **Lazy Loading** : Charger à la demande
2. **Caching** : Cache quand approprié
3. **Optimization** : Optimiser les requêtes DB
4. **Monitoring** : Surveiller les performances
5. **Scaling** : Planifier la montée en charge

## Limitations Actuelles

1. **Stockage clés privées** : localStorage (à améliorer)
2. **Échange de clés** : Pas encore implémenté automatiquement
3. **Forward Secrecy** : Pas de rotation de clés
4. **Group Key Management** : Simplifié (une clé par room)
5. **File Encryption** : Chiffrement côté client uniquement

## Améliorations Futures

1. **Web Workers** pour le chiffrement (non-bloquant)
2. **IndexedDB** pour stockage clés privées
3. **Signal Protocol** pour forward secrecy
4. **Key Rotation** automatique
5. **End-to-End File Encryption** amélioré
6. **Mobile Apps** (React Native)
7. **Voice/Video Calls** avec WebRTC
8. **Message Reactions** et éditions

