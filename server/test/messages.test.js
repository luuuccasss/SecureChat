const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, register, createRoom, connect, next } = require('./helpers');

const IV = 'AAAAAAAAAAAAAAAA'; // 12 zero bytes in base64

async function joinedSocket(user, room) {
  const socket = await connect(user);
  socket.emit('join_room', { roomId: room.id });
  await next(socket, 'room_users');
  return socket;
}

test('clients cannot send fake system messages', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  const socket = await joinedSocket(owner, room);
  socket.emit('send_message', { roomId: room.id, content: 'x', iv: IV, keyVersion: 1, type: 'system' });
  const err = await next(socket, 'error');
  assert.match(err.message, /invalide/);
  assert.equal(await next(socket, 'new_message', 500), null);
  socket.close();
});

test('malformed IVs and oversized ciphertexts are rejected', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  const socket = await joinedSocket(owner, room);
  socket.emit('send_message', { roomId: room.id, content: 'x', iv: 'not\nbase64', keyVersion: 1 });
  assert.ok(await next(socket, 'error'));
  socket.emit('send_message', { roomId: room.id, content: 'x'.repeat(20001), iv: IV, keyVersion: 1 });
  assert.ok(await next(socket, 'error'));
  socket.close();
});

test('a flood of messages is throttled', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  const socket = await joinedSocket(owner, room);
  let delivered = 0;
  let throttled = 0;
  socket.on('new_message', () => delivered++);
  socket.on('error', (e) => { if (/ralentir/.test(e.message)) throttled++; });
  for (let i = 0; i < 15; i++) socket.emit('send_message', { roomId: room.id, content: `m${i}`, iv: IV, keyVersion: 1 });
  await new Promise(r => setTimeout(r, 1500));
  assert.equal(delivered, 10);
  assert.equal(throttled, 5);
  socket.close();
});

test('non-members cannot post into a room', async () => {
  const owner = await register();
  const outsider = await register();
  const room = await createRoom(owner);
  const socket = await connect(outsider);
  socket.emit('send_message', { roomId: room.id, content: 'x', iv: IV, keyVersion: 1 });
  assert.match((await next(socket, 'error')).message, /membre/);
  socket.close();
});

test('file messages must reference an uploaded file of the same room', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  const socket = await joinedSocket(owner, room);
  socket.emit('send_message', {
    roomId: room.id, content: 'x', iv: IV, keyVersion: 1, type: 'file',
    file: { id: 999999, originalName: 'invoice.pdf.exe', path: '/etc/passwd' }
  });
  assert.match((await next(socket, 'error')).message, /introuvable/);
  socket.close();
});

test('message history pagination is bounded and validated', async () => {
  const owner = await register();
  const room = await createRoom(owner);
  assert.equal((await api('GET', `/messages/room/${room.id}?before=abc`, { token: owner.token })).status, 400);
  assert.equal((await api('GET', `/messages/room/${room.id}?limit=1000000`, { token: owner.token })).status, 200);
  const many = Array.from({ length: 101 }, (_, i) => i + 1);
  assert.equal((await api('POST', '/messages/read-multiple', { token: owner.token, body: { messageIds: many } })).status, 400);
});
