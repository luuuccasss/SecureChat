const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, register, createRoom } = require('./helpers');

const BASE = process.env.SC_URL || 'http://localhost:3001';
const IV = 'AAAAAAAAAAAAAAAA';

async function upload(user, roomId, { iv = IV, name = 'photo.png', bytes = 64 } = {}) {
  const form = new FormData();
  form.append('iv', iv);
  form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), name);
  const res = await fetch(`${BASE}/api/files/upload?roomId=${roomId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: form
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

test('non-members cannot upload into a room', async () => {
  const owner = await register();
  const outsider = await register();
  const room = await createRoom(owner);
  assert.equal((await upload(outsider, room.id)).status, 403);
});

test('uploads are stored as opaque ciphertext with a clean name', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  const res = await upload(owner, room.id, { name: '../../etc/<passwd>.png' });
  assert.equal(res.status, 201);
  assert.equal(res.data.file.mimeType, 'application/octet-stream');
  assert.ok(!res.data.file.originalName.includes('/'));
  assert.ok(!/[\u0000-\u001f]/.test(res.data.file.originalName));
});

test('a malformed multipart upload is a client error, not a crash', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  assert.equal((await upload(owner, room.id, { name: 'a\u0001b.png' })).status, 400);
});

test('an invalid IV is rejected', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  assert.equal((await upload(owner, room.id, { iv: 'bad\niv' })).status, 400);
});

test('file listings never expose server paths', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  await upload(owner, room.id);
  const res = await api('GET', `/files/room/${room.id}`, { token: owner.token });
  assert.equal(res.status, 200);
  for (const f of res.data.files) {
    assert.equal(f.path, undefined);
    assert.equal(f.filename, undefined);
  }
});
