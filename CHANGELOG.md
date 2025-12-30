# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère à [Semantic Versioning](https://semver.org/lang/fr/).

## [1.0.0] - 2025-12-30

### Ajouté
- Système de chat temps réel avec WebSocket (Socket.IO)
- Chiffrement end-to-end (E2EE) avec AES-256-GCM + RSA-2048
- Système de rooms (publiques/privées avec mot de passe)
- Upload de fichiers chiffrés
- Authentification JWT sécurisée
- Système de modération (bannissement, suppression de messages, changement de rôles)
- Logs d'audit complets
- Détection d'abus et blacklist IP automatique
- Pages légales (CGU, Politique de confidentialité, Mentions légales)
- Options de room avancées (modération, slow mode, lecture seule, archivage)
- Protection anti-spam/flood avec rate limiting
- Indicateurs temps réel (en ligne, en train de taper, reçus/lus)
- Historique persistant des messages
- Migration complète de MongoDB vers MySQL avec Sequelize

### Sécurité
- Chiffrement end-to-end (zero-knowledge)
- Validation stricte des entrées (anti-XSS/injection)
- Rate limiting par route
- Détection d'activités suspectes
- Logs d'audit pour toutes les actions importantes
- Isolation complète des rooms

### Technique
- Backend : Node.js + Express + Socket.IO
- Frontend : React 18
- Base de données : MySQL 8.0+ avec Sequelize ORM
- Chiffrement : Web Crypto API (côté client)

[1.0.0]: https://github.com/votre-username/ChatSecure/releases/tag/v1.0.0

