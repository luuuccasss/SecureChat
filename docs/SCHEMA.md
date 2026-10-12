# Database schema

The full definition is in [`server/database/schema.sql`](../server/database/schema.sql),
upgrades in [`server/database/migrations/`](../server/database/migrations/).

| Table | Content |
|---|---|
| `users` | username, email, bcrypt hash of the client-derived auth key, RSA public key, sealed private key, `tokenVersion` (bumped on logout) |
| `rooms` | name, description, owner, privacy (bcrypt room password), limits and moderation settings, current `keyVersion` |
| `room_members` | membership and role (`owner`, `admin`, `member`) |
| `room_keys` | one wrapped room key per room, member and key version |
| `messages` | ciphertext, IV, key version, sender, type (`text`, `file`) and the id of the attached file |
| `message_recipients` | delivery and read receipts |
| `files` | encrypted upload: random storage name, size, IV, checksum, expiry (30 days) |
| `banned_users` | room bans, optional expiry |
| `audit_logs` | moderation actions (ban, unban, role change, message deletion) |

Nothing in the database is readable message content: `messages.content`, `files` on disk and
`users.encryptedPrivateKey` are AES-256-GCM ciphertext, `room_keys.wrappedKey` is RSA-OAEP
ciphertext.
