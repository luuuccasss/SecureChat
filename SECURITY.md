# Security

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/luuuccasss/SecureChat/security/advisories/new),
not in public issues. You will get an answer within a few days.

Only the latest release (2.x) receives security fixes. Version 1.x derived every room key
from the room id and must be considered **not encrypted**.

## Encryption protocol (v2)

Everything below runs in the browser with the Web Crypto API
([`client/src/crypto/e2ee.js`](client/src/crypto/e2ee.js)).

| Step | What happens |
|---|---|
| Password | PBKDF2-SHA256, 600,000 iterations, salt derived from the email. HKDF splits the result into an **auth key** (sent to the server, stored as a bcrypt hash) and a **wrapping key** (never sent). The password itself never leaves the browser. |
| Identity | Each account has an RSA-OAEP 3072 key pair. The private key is stored on the server sealed with the wrapping key (AES-256-GCM), so it can be restored on any device but the server cannot open it. Once unlocked, it is kept in IndexedDB as a non-extractable key and wiped on logout. |
| Room keys | Each room has random AES-256-GCM keys, one per version, wrapped separately for every member with their public key. Wrapped keys are bound to their room and version. |
| Members | Online members automatically share the current key with newcomers. When a member leaves or is banned, the key version is bumped: the server refuses messages encrypted with the old key and the next sender creates a new key for the remaining members only. |
| Messages and files | AES-256-GCM with a random IV. The room, key version and sender are bound as additional data, so the server cannot move a message to another room or change its author. File names, types and sizes are encrypted inside the message. |
| Verification | "Verify keys" shows the fingerprint of every member's public key, to compare through another channel. |

## What the server can and cannot do

The server **cannot** read messages, files, file names, passwords, private keys or room keys,
and cannot forge or re-attribute messages without detection.

The server **can** see metadata: who is in which room, when messages are sent, their size,
usernames and emails. As in any server-managed group chat, a malicious server could also
substitute a public key or add a member to a room. Comparing key fingerprints detects the
first; the member list shows the second.

## Other protections

- Tokens: HS256 only, 12 hour lifetime, revoked on logout. The server refuses to start
  with a short or example `JWT_SECRET`.
- Rate limits on authentication, API calls, uploads and Socket.IO messages (10 per 10 seconds),
  plus per-room slow mode and read-only mode.
- Moderation: bans are enforced on join, moderators can only act on lower roles, ownership
  cannot be shared.
- Uploads: access is checked before anything is written to disk, storage names are random,
  expired files are deleted.
- Strict Content-Security-Policy on the web app (injected at build time) and Helmet defaults
  on the API. Production errors never expose internal messages or stack traces.

## Deployment checklist

- Serve the app and the API over HTTPS only (Web Crypto requires a secure context).
- Set a random `JWT_SECRET` of at least 32 characters and a dedicated MySQL user.
- Set `TRUST_PROXY` to the number of reverse proxies so rate limits see real client addresses.
- Build the client with the public `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL`, which also
  define the Content-Security-Policy.
- Keep dependencies up to date: CI runs `npm audit` on every push.
