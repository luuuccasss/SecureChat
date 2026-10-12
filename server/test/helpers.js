// Helpers for the integration tests: they talk to a running server (SC_URL)
// backed by a real database, exactly like the web client does.
const { io } = require('socket.io-client');

const BASE = process.env.SC_URL || 'http://localhost:3001';
let counter = 0;

const unique = (prefix) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}${require('crypto').randomBytes(3).toString('hex')}`;

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

// One real identity shared by the server tests (generating RSA-3072 keys is slow);
// the end-to-end tests create their own identities instead
let sharedIdentity = null;
async function testIdentity() {
  if (!sharedIdentity) {
    const e2ee = await loadE2EE();
    const { wrapKey } = await e2ee.deriveAccountKeys('shared@test.local', 'shared');
    sharedIdentity = await e2ee.generateIdentity(wrapKey);
  }
  return sharedIdentity;
}

const randomAuthKey = () => require('crypto').randomBytes(32).toString('base64');

async function register(fields = {}) {
  const username = unique('u');
  const identity = await testIdentity();
  const body = {
    username,
    email: `${username}@test.local`,
    password: randomAuthKey(),
    publicKey: identity.publicKeyPem,
    encryptedPrivateKey: identity.encryptedPrivateKey,
    ...fields
  };
  const res = await api('POST', '/auth/register', { body });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.data)}`);
  return { ...res.data.user, token: res.data.token, password: body.password };
}

async function createRoom(owner, fields = {}) {
  const res = await api('POST', '/rooms', { token: owner.token, body: { name: unique('room'), ...fields } });
  if (res.status !== 201) throw new Error(`createRoom failed: ${res.status} ${JSON.stringify(res.data)}`);
  // Server tests do not decrypt anything: a placeholder key version 1 is enough
  const rotate = await api('POST', `/rooms/${res.data.room.id}/keys/rotate`, {
    token: owner.token,
    body: { version: 1, keys: [{ userId: owner.id, wrappedKey: 'A'.repeat(512) }] }
  });
  if (rotate.status !== 201) throw new Error(`createRoom key failed: ${rotate.status} ${JSON.stringify(rotate.data)}`);
  return res.data.room;
}

function connect(user) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token: user.token }, transports: ['websocket'], forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

// Resolves with the payload of the next `event`, or null after `ms`
function next(socket, event, ms = 1500) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, ms);
    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, handler);
  });
}

module.exports = { api, register, createRoom, connect, next, unique, randomAuthKey };

// Loads the browser E2EE module (client/src/crypto/e2ee.js) in Node: it is plain
// ES module code with no imports, so a copy with an .mjs extension is enough
let e2eePromise = null;
function loadE2EE() {
  if (!e2eePromise) {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { pathToFileURL } = require('url');
    const source = path.join(__dirname, '../../client/src/crypto/e2ee.js');
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'e2ee-')), 'e2ee.mjs');
    fs.copyFileSync(source, copy);
    e2eePromise = import(pathToFileURL(copy).href);
  }
  return e2eePromise;
}

module.exports.loadE2EE = loadE2EE;
