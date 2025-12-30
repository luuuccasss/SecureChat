# 🔐 SecureChat

End-to-end encrypted real-time messaging system with advanced moderation and complete legal protection.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.0.0-blue.svg)

## ✨ Fonctionnalités

### 🔒 Sécurité
- **Chiffrement End-to-End (E2EE)** : AES-256-GCM + RSA-2048
- **Zero-Knowledge** : Le serveur ne peut jamais déchiffrer les messages
- **Authentification JWT** sécurisée
- **Protection anti-spam/flood** avec rate limiting
- **Détection d'abus** et blacklist IP automatique
- **Validation stricte** des entrées (anti-XSS/injection)
- **Isolation complète** des rooms

### 💬 Communication
- **Temps réel** via WebSocket (Socket.IO)
- **Rooms publiques/privées** avec mot de passe
- **Historique persistant** des messages
- **Indicateurs temps réel** : en ligne, en train de taper, reçus/lus
- **Upload de fichiers** chiffrés (images, PDF, documents)
- **Notifications** en temps réel

### 🛡️ Modération
- **Système de rôles** : Owner, Admin, Member
- **Bannissement** d'utilisateurs (temporaire/permanent)
- **Suppression de messages** par modérateurs
- **Logs d'audit** complets
- **Options de room** : modération, slow mode, lecture seule, archivage

### ⚖️ Conformité Légale
- **CGU** complètes
- **Politique de confidentialité** conforme RGPD
- **Mentions légales**
- **Protection des données** utilisateurs

## 🏗️ Architecture

### Stack Technique

**Backend:**
- Node.js + Express
- Socket.IO (WebSocket)
- MySQL + Sequelize ORM
- JWT (authentification)
- bcrypt (hashage mots de passe)

**Frontend:**
- React 18
- Socket.IO Client
- Web Crypto API (chiffrement E2EE)
- Axios (HTTP)

**Base de données:**
- MySQL 8.0+

## 🚀 Installation

### Prérequis
- Node.js >= 16.0.0
- MySQL >= 8.0
- npm ou yarn

### Étapes

1. **Clone the repository**
```bash
git clone https://github.com/votre-username/securechat.git
cd securechat
```

2. **Installer les dépendances**
```bash
npm run install:all
```

3. **Configurer MySQL**
```bash
# Créer la base de données
mysql -u root -p -e "CREATE DATABASE securechat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Import the schema
mysql -u root -p securechat < server/database/schema.sql
```

4. **Configurer les variables d'environnement**
```bash
cp server/.env.example server/.env
# Éditer server/.env avec vos configurations
```

5. **Générer un JWT_SECRET sécurisé**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

6. **Lancer l'application**
```bash
# Développement (backend + frontend)
npm run dev

# Ou séparément
npm run dev:server  # Backend sur http://localhost:3001
npm run dev:client  # Frontend sur http://localhost:3000
```

## 📝 Configuration

### Variables d'environnement (`server/.env`)

```env
# Serveur
PORT=3001
NODE_ENV=development

# Base de données MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=securechat
DB_USER=root
DB_PASSWORD=votre-mot-de-passe

# JWT (⚠️ CRITIQUE : changer en production)
JWT_SECRET=votre-secret-jwt-tres-long-et-securise-minimum-32-caracteres
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000

# Upload de fichiers
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx,txt

# Synchronisation DB (développement uniquement)
SYNC_DB=false
```

### Migrations de base de données

Si vous avez une base de données existante, exécutez les migrations :

```bash
# Ajouter fileId aux messages
mysql -u root -p securechat < server/database/add_fileId_column.sql

# Add moderation columns
mysql -u root -p securechat < server/database/add_room_moderation_columns.sql

# Fix file expiration dates
mysql -u root -p securechat < server/database/fix_file_expiration.sql

# Add moderation tables
mysql -u root -p securechat < server/database/migration_moderation.sql
```

## 📁 Structure du Projet

```
securechat/
├── client/                 # Frontend React
│   ├── public/            # Fichiers statiques (CGU, etc.)
│   └── src/
│       ├── components/    # Composants React
│       ├── crypto/       # Service de chiffrement E2EE
│       └── services/      # API et Socket.IO
│
├── server/                # Backend Node.js
│   ├── config/           # Configuration (DB, etc.)
│   ├── database/         # Scripts SQL et migrations
│   ├── middleware/       # Middlewares (auth, validation, security)
│   ├── models/           # Modèles Sequelize
│   ├── routes/           # Routes Express API
│   ├── socket/           # Gestion Socket.IO
│   └── uploads/          # Fichiers uploadés (gitignored)
│
├── docs/                  # Documentation
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
│
└── README.md
```

## 🔑 Fonctionnalités Détaillées

### Chiffrement End-to-End

- **RSA-2048** pour l'échange de clés
- **AES-256-GCM** pour le chiffrement des messages
- Clés privées stockées uniquement côté client
- Le serveur ne peut jamais déchiffrer les messages

### Système de Rooms

- **Rooms publiques** : accessibles à tous
- **Rooms privées** : protégées par mot de passe
- **Permissions** : Owner, Admin, Member
- **Options** : modération, slow mode, lecture seule, archivage

### Modération

- Bannissement temporaire/permanent
- Suppression de messages
- Changement de rôles
- Logs d'audit complets

## 🔒 Sécurité

### Mesures Implémentées

- ✅ Chiffrement E2EE (AES-256-GCM + RSA-2048)
- ✅ Authentification JWT sécurisée
- ✅ Rate limiting (anti-spam/flood)
- ✅ Détection d'abus et blacklist IP
- ✅ Validation stricte des entrées
- ✅ Protection CSRF
- ✅ Isolation complète des rooms
- ✅ Logs d'audit
- ✅ Helmet.js (headers de sécurité)

### Checklist Production

- [ ] HTTPS activé
- [ ] JWT_SECRET fort et unique
- [ ] MySQL avec authentification
- [ ] Rate limiting configuré
- [ ] Logs configurés
- [ ] Monitoring (Sentry, etc.)
- [ ] Backup automatique MySQL
- [ ] Firewall configuré
- [ ] Clés privées stockées de manière sécurisée

Voir `docs/SECURITY.md` pour plus de détails.

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md) - Architecture détaillée du système
- [Sécurité](docs/SECURITY.md) - Mesures de sécurité
- [Déploiement](docs/DEPLOYMENT.md) - Guide de déploiement
- [Schéma DB](docs/SCHEMA.md) - Schéma de base de données

## 🧪 Développement

```bash
# Installer les dépendances
npm run install:all

# Lancer en développement
npm run dev

# Build pour production
npm run build

# Lancer en production
npm start
```

## 📄 Licence

MIT License - Voir [LICENSE](LICENSE) pour plus de détails.

## ⚠️ Avertissement

Ce système est conçu pour un environnement de production mais nécessite :
- Configuration HTTPS
- Secrets sécurisés (JWT_SECRET, DB_PASSWORD)
- Variables d'environnement correctement configurées
- Base de données MySQL sécurisée

**Ne jamais commiter** :
- Fichiers `.env`
- Clés privées
- Mots de passe
- Fichiers uploadés

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📧 Contact

For any questions or issues, please open an [issue](https://github.com/votre-username/securechat/issues).

---

**Fait avec ❤️ pour la sécurité et la confidentialité**
