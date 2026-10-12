// Server side of end-to-end encryption: the server stores and routes opaque,
// per-member wrapped room keys. It never sees a password, a private key or a
// room key in clear.
const { RoomKey, RoomMember } = require('../models');

// Shapes of the client-generated material (protocol v2)
const AUTH_KEY_PATTERN = /^[A-Za-z0-9+/]{43}=$/; // 32 bytes, HKDF output
const PUBLIC_KEY_PATTERN = /^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=]{500,700}\n-----END PUBLIC KEY-----$/; // RSA-3072 SPKI
const SEALED_PRIVATE_KEY_PATTERN = /^[A-Za-z0-9+/]{16}\.[A-Za-z0-9+/=]{1000,4000}$/; // IV.AES-GCM(PKCS#8)
const WRAPPED_KEY_PATTERN = /^[A-Za-z0-9+/]{512}$/; // RSA-OAEP-3072 output

const isWrappedKey = (value) => typeof value === 'string' && WRAPPED_KEY_PATTERN.test(value);

const hasKey = async (roomId, userId, version) =>
  !!(await RoomKey.findOne({ where: { roomId, userId, version } }));

const versionHasKeys = async (roomId, version) =>
  !!(await RoomKey.findOne({ where: { roomId, version } }));

// A member left or was banned: the next sender must create a key they do not have,
// and their open sockets stop receiving the room's traffic
async function revokeMember(io, room, userId) {
  room.keyVersion += 1;
  await room.save();
  if (io) {
    io.in(`user:${userId}`).socketsLeave(String(room.id));
    io.to(String(room.id)).emit('room_key_rotation_needed', { roomId: room.id, version: room.keyVersion });
  }
}

// Asks every other member (on their personal channel, whatever room they are
// looking at) to wrap the current room key for this user
async function requestKeyFor(io, roomId, userId) {
  if (!io) return;
  const members = await RoomMember.findAll({ where: { roomId }, attributes: ['userId'] });
  for (const member of members) {
    if (member.userId !== Number(userId)) {
      io.to(`user:${member.userId}`).emit('room_key_needed', { roomId: Number(roomId), userId: Number(userId) });
    }
  }
}

module.exports = {
  requestKeyFor,
  AUTH_KEY_PATTERN,
  PUBLIC_KEY_PATTERN,
  SEALED_PRIVATE_KEY_PATTERN,
  isWrappedKey,
  hasKey,
  versionHasKeys,
  revokeMember
};
