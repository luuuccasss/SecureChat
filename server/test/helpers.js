// Helpers for the integration tests: they talk to a running server (SC_URL)
// backed by a real database, exactly like the web client does.
const { io } = require('socket.io-client');

const BASE = process.env.SC_URL || 'http://localhost:3001';
let counter = 0;

const unique = (prefix) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

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

async function register(fields = {}) {
  const username = unique('u');
  const body = {
    username,
    email: `${username}@test.local`,
    password: 'Passw0rd-test',
    publicKey: 'test-public-key',
    ...fields
  };
  const res = await api('POST', '/auth/register', { body });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.data)}`);
  return { ...res.data.user, token: res.data.token, password: body.password };
}

async function createRoom(owner, fields = {}) {
  const res = await api('POST', '/rooms', { token: owner.token, body: { name: unique('room'), ...fields } });
  if (res.status !== 201) throw new Error(`createRoom failed: ${res.status} ${JSON.stringify(res.data)}`);
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

module.exports = { api, register, createRoom, connect, next, unique };
