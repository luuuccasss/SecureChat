// End-to-end encryption scenarios with the real client crypto module: several
// simulated browsers talk to the real server, and we check what the server stores.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const { api, connect, next, unique, loadE2EE } = require('./helpers');

// Minimal client, doing what the React app does with the same module
class Client {
  static async signup() {
    const e2ee = await loadE2EE();
    const client = new Client(e2ee);
    client.username = unique('e2e');
    client.email = `${client.username}@test.local`;
    client.password = 'Correct-Horse-9';
    const { authKey, wrapKey } = await e2ee.deriveAccountKeys(client.email, client.password);
    const identity = await e2ee.generateIdentity(wrapKey);
    const res = await api('POST', '/auth/register', {
      body: {
        username: client.username, email: client.email, password: authKey,
        publicKey: identity.publicKeyPem, encryptedPrivateKey: identity.encryptedPrivateKey
      }
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    client.token = res.data.token;
    client.id = res.data.user.id;
    await client.login(); // proves the private key can be restored from the server
    client.socket = await connect(client);
    client.socket.on('room_key_needed', (e) => client.shareKeyWith(e.roomId, e.userId).catch(() => {}));
    return client;
  }

  constructor(e2ee) {
    this.e2ee = e2ee;
    this.roomKeys = new Map(); // `${roomId}:${version}` -> CryptoKey
  }

  async login() {
    const { authKey, wrapKey } = await this.e2ee.deriveAccountKeys(this.email, this.password);
    const res = await api('POST', '/auth/login', { body: { email: this.email, password: authKey } });
    assert.equal(res.status, 200);
    this.token = res.data.token;
    this.publicKey = res.data.user.publicKey;
    this.privateKey = await this.e2ee.unlockPrivateKey(res.data.user.encryptedPrivateKey, wrapKey);
  }

  async createRoom() {
    const res = await api('POST', '/rooms', { token: this.token, body: { name: unique('room') } });
    assert.equal(res.status, 201);
    return res.data.room.id;
  }

  async join(roomId) {
    assert.equal((await api('POST', `/rooms/${roomId}/join`, { token: this.token })).status, 200);
  }

  async openRoom(roomId) {
    this.socket.emit('join_room', { roomId });
    await next(this.socket, 'room_users');
  }

  // Loads every key version shared with us; creates the current one if nobody has it
  async syncKeys(roomId) {
    const res = await api('GET', `/rooms/${roomId}/keys`, { token: this.token });
    assert.equal(res.status, 200);
    for (const { version, wrappedKey } of res.data.keys) {
      this.roomKeys.set(`${roomId}:${version}`, await this.e2ee.unwrapRoomKey(wrappedKey, this.privateKey, roomId, version));
    }
    if (!res.data.currentVersionHasKeys) await this.rotate(roomId, res.data.keyVersion);
    return res.data.keyVersion;
  }

  async rotate(roomId, version) {
    const key = await this.e2ee.generateRoomKey();
    const members = (await api('GET', `/rooms/${roomId}/public-keys`, { token: this.token })).data.members;
    const keys = [];
    for (const m of members) {
      keys.push({ userId: m.userId, wrappedKey: await this.e2ee.wrapRoomKey(key, m.publicKey, roomId, version) });
    }
    const res = await api('POST', `/rooms/${roomId}/keys/rotate`, { token: this.token, body: { version, keys } });
    if (res.status === 201) this.roomKeys.set(`${roomId}:${version}`, key);
    return res.status;
  }

  async shareKeyWith(roomId, userId) {
    const version = (await api('GET', `/rooms/${roomId}/keys`, { token: this.token })).data.keyVersion;
    const key = this.roomKeys.get(`${roomId}:${version}`);
    if (!key) return;
    const member = (await api('GET', `/rooms/${roomId}/public-keys`, { token: this.token })).data.members
      .find(m => m.userId === userId);
    const wrappedKey = await this.e2ee.wrapRoomKey(key, member.publicKey, roomId, version);
    await api('POST', `/rooms/${roomId}/keys`, { token: this.token, body: { userId, version, wrappedKey } });
  }

  async send(roomId, text) {
    const version = await this.syncKeys(roomId);
    const sealed = await this.e2ee.encryptMessage(this.roomKeys.get(`${roomId}:${version}`), text,
      { roomId, version, senderId: this.id });
    this.socket.emit('send_message', { roomId, ...sealed, keyVersion: version });
  }

  async read(message) {
    const key = this.roomKeys.get(`${message.room}:${message.keyVersion}`);
    if (!key) return null;
    try {
      return await this.e2ee.decryptMessage(key, message, { roomId: message.room, version: message.keyVersion, senderId: message.sender.id });
    } catch {
      return null;
    }
  }

  close() {
    this.socket.close();
  }
}

test('the server only ever sees ciphertext, members can read', async () => {
  const alice = await Client.signup();
  const bob = await Client.signup();
  const roomId = await alice.createRoom();
  await alice.syncKeys(roomId); // creates key version 1
  await alice.openRoom(roomId);

  const keyArrived = next(bob.socket, 'room_key_shared', 5000);
  await bob.join(roomId); // alice is online and shares the key automatically
  assert.ok(await keyArrived, 'bob should receive the room key from alice');
  await bob.syncKeys(roomId);
  await bob.openRoom(roomId);

  const incoming = next(bob.socket, 'new_message', 3000);
  await alice.send(roomId, 'the vault code is 4242');
  const { message } = await incoming;
  assert.equal(await bob.read(message), 'the vault code is 4242');

  // What the server stored: no plaintext anywhere
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'securechat'
  });
  const [[row]] = await db.query('SELECT content FROM messages WHERE id = ?', [message.id]);
  const [[user]] = await db.query('SELECT password, encryptedPrivateKey FROM users WHERE id = ?', [alice.id]);
  await db.end();
  assert.ok(!row.content.includes('4242'));
  assert.ok(!user.encryptedPrivateKey.includes('PRIVATE KEY'));
  assert.ok(user.password.startsWith('$2'));

  alice.close();
  bob.close();
});

test('a member who leaves cannot read messages sent afterwards', async () => {
  const alice = await Client.signup();
  const bob = await Client.signup();
  const roomId = await alice.createRoom();
  await alice.syncKeys(roomId);
  await alice.openRoom(roomId);
  const keyArrived = next(bob.socket, 'room_key_shared', 5000);
  await bob.join(roomId);
  await keyArrived;
  await bob.syncKeys(roomId);
  const oldKey = bob.roomKeys.get(`${roomId}:1`);

  assert.equal((await api('POST', `/rooms/${roomId}/leave`, { token: bob.token })).status, 200);

  // Alice's old key is now stale: the server refuses it and she rotates
  const sealed = await alice.e2ee.encryptMessage(alice.roomKeys.get(`${roomId}:1`), 'old key', { roomId, version: 1, senderId: alice.id });
  alice.socket.emit('send_message', { roomId, ...sealed, keyVersion: 1 });
  assert.equal((await next(alice.socket, 'error')).code, 'STALE_KEY');

  const incoming = next(alice.socket, 'new_message', 3000);
  await alice.send(roomId, 'bob is gone');
  const { message } = await incoming;
  assert.equal(message.keyVersion, 2);
  assert.equal(await alice.read(message), 'bob is gone');

  // Bob kept the old key, but it does not open the new message
  await assert.rejects(alice.e2ee.decryptMessage(oldKey, message, { roomId, version: 2, senderId: alice.id }));
  assert.equal((await api('GET', `/rooms/${roomId}/keys`, { token: bob.token })).status, 403);

  alice.close();
  bob.close();
});

test('the server cannot re-attribute a message to another sender', async () => {
  const alice = await Client.signup();
  const roomId = await alice.createRoom();
  await alice.syncKeys(roomId);
  await alice.openRoom(roomId);
  const incoming = next(alice.socket, 'new_message', 3000);
  await alice.send(roomId, 'signed by alice');
  const { message } = await incoming;
  const forged = { ...message, sender: { ...message.sender, id: message.sender.id + 1 } };
  assert.equal(await alice.read(forged), null);
  alice.close();
});

test('only one rotation wins when two members race', async () => {
  const alice = await Client.signup();
  const bob = await Client.signup();
  const roomId = await alice.createRoom();
  await bob.join(roomId);
  const [a, b] = await Promise.all([alice.rotate(roomId, 1), bob.rotate(roomId, 1)]);
  assert.deepEqual([a, b].sort(), [201, 409]);
  alice.close();
  bob.close();
});

test('the wrong password cannot unlock the private key', async () => {
  const alice = await Client.signup();
  alice.password = 'Wrong-Horse-9';
  const { authKey } = await alice.e2ee.deriveAccountKeys(alice.email, alice.password);
  assert.equal((await api('POST', '/auth/login', { body: { email: alice.email, password: authKey } })).status, 401);
  alice.close();
});
