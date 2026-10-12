# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-10-12

Breaking release. In 1.x every room key was derived from the room id, so messages and files
were readable by anyone who knew a room number, the server included. Run
`server/database/migrations/` in order; 1.x data is removed and accounts must register again.

### Security
- Real end-to-end encryption (protocol v2): password-derived keys that never leave the
  browser, RSA-OAEP 3072 identities sealed server-side, random per-room AES-256-GCM keys
  wrapped per member, key rotation when a member leaves or is banned, messages bound to
  room, key version and sender, encrypted file names
- Bans are enforced, moderators can only act on lower roles, ownership cannot be shared
- Socket.IO messages are validated and rate limited; clients cannot send `system` messages
  or choose file metadata; slow mode and read-only rooms are enforced
- Uploads are checked before being written to disk, never expose server paths, and expire
- 12 hour tokens pinned to HS256, revoked on logout; weak `JWT_SECRET` refused at startup
- Removed the IP blacklist that let anyone lock out every visitor
- Strict Content-Security-Policy on the web app, Helmet defaults on the API
- Internal error messages and stack traces are no longer sent to clients
- Upgraded dependencies with known vulnerabilities (socket.io, engine.io, ws, express,
  mysql2, multer)

### Added
- Key fingerprint panel to verify members out of band
- Integration and end-to-end encryption test suite, GitHub Actions CI

### Fixed
- Database schema failed on a fresh install and lacked the bans and audit tables
- Expired files were never deleted
- Socket listeners were called twice

## [1.0.0] - 2025-12-30

### Added
- Real-time chat system with WebSocket (Socket.IO)
- End-to-end encryption (E2EE) with AES-256-GCM + RSA-2048 (broken: room keys were derived from the room id, see 2.0.0)
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
