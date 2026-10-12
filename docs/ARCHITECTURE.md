# Architecture

```
client/ (React)                        server/ (Node.js)                    MySQL
┌─────────────────────────┐   HTTPS    ┌──────────────────────────┐        ┌───────────────┐
│ crypto/e2ee.js          │──REST────▶│ routes/  auth, rooms,    │───────▶│ users         │
│   keys, AES-GCM, RSA    │           │   messages, files,       │        │ rooms         │
│ crypto/session.js       │◀─Socket.IO│   moderation             │        │ room_members  │
│   room key sync         │           │ socket/socketHandler.js  │        │ room_keys     │
│ crypto/keystore.js      │           │ services/roomKeys.js     │        │ messages      │
│   IndexedDB identity    │           │ middleware/ auth, limits │        │ files, bans,  │
└─────────────────────────┘           └──────────────────────────┘        │ audit_logs    │
                                                                           └───────────────┘
```

The server stores and relays ciphertext and wrapped keys. All encryption and decryption
happens in the browser. See [SECURITY.md](../SECURITY.md) for the protocol and threat model.

## Main flows

**Sign-up / sign-in.** The browser derives an auth key and a wrapping key from the password
(`deriveAccountKeys`). Sign-up sends the auth key, the public key and the sealed private key.
Sign-in sends the auth key and gets the sealed private key back, which only the wrapping key
can open.

**Opening a room.** `session.syncRoom()` calls `GET /rooms/:id/keys` and unwraps every key
version shared with the user. If no member holds the current version yet (new room, or a
member just left), it creates one for all current members with `POST /rooms/:id/keys/rotate`;
the first client wins, others retry. If others hold it, it emits `request_room_key` and waits.

**Sharing keys.** The server sends `room_key_needed` to every member's personal Socket.IO
channel (`user:<id>`). Any online member who has the key wraps it for the newcomer with
`POST /rooms/:id/keys`, and the newcomer receives `room_key_shared`.

**Sending.** The message is encrypted with the current key version and sent with
`send_message`. The server checks membership, rate limits, slow mode, read-only mode and that
the sender holds that key version, otherwise it answers `STALE_KEY` and the client re-syncs
and resends.

**Files.** The file is encrypted in the browser and uploaded as `encrypted.bin`
(`POST /files/upload?roomId=`); its real name, type and size go inside an encrypted `file`
message.

## Socket.IO events

| Client → server | Server → client |
|---|---|
| `join_room`, `leave_room` | `room_users`, `user_joined`, `user_left` |
| `send_message` | `new_message`, `error` (`code: STALE_KEY`) |
| `typing`, `mark_read` | `typing`, `message_read` |
| `request_room_key` | `room_key_needed`, `room_key_shared`, `room_key_rotated`, `room_key_rotation_needed` |
