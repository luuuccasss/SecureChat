# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-30

### Added
- Real-time chat system with WebSocket (Socket.IO)
- End-to-end encryption (E2EE) with AES-256-GCM + RSA-2048
- Room system (public/private with password protection)
- Encrypted file upload
- Secure JWT authentication
- Moderation system (banning, message deletion, role changes)
- Complete audit logs
- Abuse detection and automatic IP blacklisting
- Legal pages (Terms of Service, Privacy Policy, Legal Mentions)
- Advanced room options (moderation, slow mode, read-only, archiving)
- Anti-spam/flood protection with rate limiting
- Real-time indicators (online status, typing, read receipts)
- Persistent message history
- Complete migration from MongoDB to MySQL with Sequelize
- Internationalization (i18n) support (English and French)
- Language switcher in UI
- Comprehensive English documentation
- Legal protection documents (DISCLAIMER.md, LEGAL_NOTICE.md)

### Security
- End-to-end encryption (zero-knowledge)
- Strict input validation (anti-XSS/injection)
- Rate limiting per route
- Suspicious activity detection
- Audit logs for all important actions
- Complete room isolation

### Technical
- Backend: Node.js + Express + Socket.IO
- Frontend: React 18
- Database: MySQL 8.0+ with Sequelize ORM
- Encryption: Web Crypto API (client-side)

[1.0.0]: https://github.com/luuuccasss/SecureChat/releases/tag/v1.0.0
