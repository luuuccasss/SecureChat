// Unit tests of the client E2EE module (no server needed)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadE2EE } = require('./helpers');

test('the password derives a stable auth key that differs from the wrapping key', async () => {
  const e2ee = await loadE2EE();
  const a = await e2ee.deriveAccountKeys('Alice@Example.com ', 'correct horse');
  const b = await e2ee.deriveAccountKeys('alice@example.com', 'correct horse');
  const c = await e2ee.deriveAccountKeys('alice@example.com', 'wrong horse');
  assert.equal(a.authKey, b.authKey);
  assert.notEqual(a.authKey, c.authKey);
  assert.match(a.authKey, /^[A-Za-z0-9+/]{43}=$/);
  assert.equal(a.wrapKey.extractable, false);
});

test('the private key only unlocks with the right password', async () => {
  const e2ee = await loadE2EE();
  const good = await e2ee.deriveAccountKeys('bob@example.com', 'pw-1');
  const bad = await e2ee.deriveAccountKeys('bob@example.com', 'pw-2');
  const identity = await e2ee.generateIdentity(good.wrapKey);
  assert.equal(identity.privateKey.extractable, false);
  await e2ee.unlockPrivateKey(identity.encryptedPrivateKey, good.wrapKey);
  await assert.rejects(e2ee.unlockPrivateKey(identity.encryptedPrivateKey, bad.wrapKey));
});

test('room keys are bound to their room and version', async () => {
  const e2ee = await loadE2EE();
  const { wrapKey } = await e2ee.deriveAccountKeys('carol@example.com', 'pw');
  const id = await e2ee.generateIdentity(wrapKey);
  const roomKey = await e2ee.generateRoomKey();
  const wrapped = await e2ee.wrapRoomKey(roomKey, id.publicKeyPem, 7, 1);
  await e2ee.unwrapRoomKey(wrapped, id.privateKey, 7, 1);
  await assert.rejects(e2ee.unwrapRoomKey(wrapped, id.privateKey, 8, 1));
  await assert.rejects(e2ee.unwrapRoomKey(wrapped, id.privateKey, 7, 2));
});

test('a message cannot be moved to another room or attributed to another sender', async () => {
  const e2ee = await loadE2EE();
  const key = await e2ee.generateRoomKey();
  const ctx = { roomId: 1, version: 1, senderId: 5 };
  const sealed = await e2ee.encryptMessage(key, 'secret plan', ctx);
  assert.equal(await e2ee.decryptMessage(key, sealed, ctx), 'secret plan');
  await assert.rejects(e2ee.decryptMessage(key, sealed, { ...ctx, senderId: 6 }));
  await assert.rejects(e2ee.decryptMessage(key, sealed, { ...ctx, roomId: 2 }));
});

test('files round-trip and fingerprints are readable', async () => {
  const e2ee = await loadE2EE();
  const key = await e2ee.generateRoomKey();
  const ctx = { roomId: 3, version: 2, senderId: 9 };
  const bytes = new TextEncoder().encode('%PDF-1.7 hello');
  const sealed = await e2ee.encryptFile(key, bytes, ctx);
  assert.deepEqual(await e2ee.decryptFile(key, sealed.data, sealed.iv, ctx), bytes);
  const { wrapKey } = await e2ee.deriveAccountKeys('dave@example.com', 'pw');
  const id = await e2ee.generateIdentity(wrapKey);
  assert.match(await e2ee.fingerprint(id.publicKeyPem), /^([0-9A-F]{4} ){7}[0-9A-F]{4}$/);
});
