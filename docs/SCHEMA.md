# Schéma de Base de Données - ChatSecure

## Vue d'ensemble

Ce document décrit le schéma de base de données MongoDB utilisé par ChatSecure.

## Collections

### Users

Stocke les informations des utilisateurs et leurs clés publiques RSA.

```javascript
{
  _id: ObjectId,
  username: String (unique, indexé, 3-30 chars),
  email: String (unique, indexé),
  password: String (hashé bcrypt, non retourné par défaut),
  publicKey: String (PEM format, clé publique RSA-2048),
  avatar: String (URL, optionnel),
  isOnline: Boolean (indexé, défaut: false),
  lastSeen: Date (défaut: maintenant),
  createdAt: Date,
  updatedAt: Date
}
```

**Index:**
- `username`: unique
- `email`: unique
- `isOnline`: pour les requêtes de présence

**Relations:**
- Référencé par `Room.creator`
- Référencé par `Room.members.user`
- Référencé par `Message.sender`
- Référencé par `File.uploader`

---

### Rooms

Stocke les informations des rooms de chat.

```javascript
{
  _id: ObjectId,
  name: String (1-100 chars),
  description: String (max 500 chars, défaut: ''),
  creator: ObjectId (ref: User, indexé, requis),
  members: [{
    user: ObjectId (ref: User, indexé, requis),
    role: String ('owner' | 'admin' | 'member', défaut: 'member'),
    joinedAt: Date (défaut: maintenant)
  }],
  isPrivate: Boolean (défaut: false, indexé),
  password: String (hashé bcrypt, non retourné par défaut, optionnel),
  maxMembers: Number (2-1000, défaut: 100),
  settings: {
    allowFileUpload: Boolean (défaut: true),
    allowInvites: Boolean (défaut: true)
  },
  createdAt: Date (indexé),
  updatedAt: Date
}
```

**Index:**
- `creator`: pour trouver les rooms créées par un utilisateur
- `members.user`: pour trouver les rooms d'un utilisateur
- `isPrivate`: pour filtrer les rooms publiques/privées
- `createdAt`: pour trier par date

**Méthodes:**
- `isMember(userId)`: vérifie si un utilisateur est membre
- `getUserRole(userId)`: retourne le rôle d'un utilisateur
- `hasPermission(userId, permission)`: vérifie les permissions

---

### Messages

Stocke les messages chiffrés des rooms.

```javascript
{
  _id: ObjectId,
  room: ObjectId (ref: Room, indexé, requis),
  sender: ObjectId (ref: User, indexé, requis),
  content: String (chiffré base64, requis),
  type: String ('text' | 'file' | 'image' | 'system', défaut: 'text'),
  file: {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    path: String,
    encrypted: Boolean (défaut: true)
  } (optionnel),
  encrypted: Boolean (défaut: true),
  iv: String (base64, requis, IV pour AES-GCM),
  recipients: [{
    user: ObjectId (ref: User, indexé),
    delivered: Boolean (défaut: false),
    read: Boolean (défaut: false),
    deliveredAt: Date,
    readAt: Date
  }],
  createdAt: Date (indexé),
  updatedAt: Date
}
```

**Index:**
- `room` + `createdAt`: index composé pour les requêtes de messages par room
- `sender` + `createdAt`: pour l'historique d'un utilisateur
- `recipients.user`: pour trouver les messages d'un utilisateur

**Méthodes:**
- `markAsDelivered(userId)`: marque comme livré
- `markAsRead(userId)`: marque comme lu

---

### Files

Stocke les métadonnées des fichiers uploadés.

```javascript
{
  _id: ObjectId,
  filename: String (requis, nom sur le serveur),
  originalName: String (requis, nom original),
  mimeType: String (requis),
  size: Number (requis, en bytes),
  path: String (requis, chemin sur le serveur),
  uploader: ObjectId (ref: User, indexé, requis),
  room: ObjectId (ref: Room, indexé, requis),
  encrypted: Boolean (défaut: true),
  iv: String (base64, requis, IV pour AES-GCM),
  checksum: String (SHA-256, requis, pour vérifier l'intégrité),
  createdAt: Date,
  expiresAt: Date (défaut: +30 jours, indexé),
  updatedAt: Date
}
```

**Index:**
- `room` + `createdAt`: pour les fichiers d'une room
- `uploader`: pour les fichiers d'un utilisateur
- `expiresAt`: pour le nettoyage automatique

---

## Relations

```
User (1) ──< (N) Room.members
User (1) ──< (N) Room.creator
User (1) ──< (N) Message.sender
User (1) ──< (N) File.uploader

Room (1) ──< (N) Message.room
Room (1) ──< (N) File.room
```

## Requêtes Fréquentes

### Obtenir les rooms d'un utilisateur

```javascript
Room.find({ 'members.user': userId })
  .populate('creator', 'username')
  .populate('members.user', 'username')
  .sort({ createdAt: -1 })
```

### Obtenir les messages d'une room (paginés)

```javascript
Message.find({ room: roomId })
  .populate('sender', 'username')
  .sort({ createdAt: -1 })
  .limit(50)
  .skip(offset)
```

### Obtenir les utilisateurs en ligne d'une room

```javascript
Room.findById(roomId)
  .populate({
    path: 'members.user',
    match: { isOnline: true },
    select: 'username isOnline'
  })
```

### Obtenir les fichiers d'une room

```javascript
File.find({ room: roomId })
  .populate('uploader', 'username')
  .sort({ createdAt: -1 })
  .limit(50)
```

## Optimisations

1. **Index composés** pour les requêtes fréquentes
2. **Pagination** pour les grandes collections
3. **Populate sélectif** pour limiter les données retournées
4. **Projection** pour exclure les champs sensibles (password, etc.)

## Maintenance

### Nettoyage automatique

- **Fichiers expirés** : Suppression automatique après `expiresAt`
- **Messages anciens** : Archivage recommandé après 1 an (non implémenté)

### Backup

- Backup quotidien recommandé
- Conserver les backups chiffrés
- Tester la restauration régulièrement

