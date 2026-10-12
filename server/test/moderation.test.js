const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, register, createRoom } = require('./helpers');

async function roomWithStaff() {
  const owner = await register();
  const admin = await register();
  const member = await register();
  const room = await createRoom(owner);
  for (const u of [admin, member]) {
    assert.equal((await api('POST', `/rooms/${room.id}/join`, { token: u.token })).status, 200);
  }
  const promote = await api('PATCH', `/moderation/rooms/${room.id}/members/${admin.id}/role`,
    { token: owner.token, body: { role: 'admin' } });
  assert.equal(promote.status, 200);
  return { owner, admin, member, room };
}

test('a banned user cannot rejoin the room', async () => {
  const { admin, member, room } = await roomWithStaff();
  assert.equal((await api('POST', `/moderation/rooms/${room.id}/ban/${member.id}`, { token: admin.token })).status, 200);
  const rejoin = await api('POST', `/rooms/${room.id}/join`, { token: member.token });
  assert.equal(rejoin.status, 403);
});

test('moderators can only ban users below their role', async () => {
  const { owner, admin, room } = await roomWithStaff();
  const other = await register();
  await api('POST', `/rooms/${room.id}/join`, { token: other.token });
  await api('PATCH', `/moderation/rooms/${room.id}/members/${other.id}/role`, { token: owner.token, body: { role: 'admin' } });
  assert.equal((await api('POST', `/moderation/rooms/${room.id}/ban/${owner.id}`, { token: admin.token })).status, 403);
  assert.equal((await api('POST', `/moderation/rooms/${room.id}/ban/${other.id}`, { token: admin.token })).status, 403);
});

test('an admin cannot lift a ban issued by the owner', async () => {
  const { owner, admin, member, room } = await roomWithStaff();
  await api('POST', `/moderation/rooms/${room.id}/ban/${member.id}`, { token: owner.token });
  assert.equal((await api('DELETE', `/moderation/rooms/${room.id}/ban/${member.id}`, { token: admin.token })).status, 403);
  assert.equal((await api('DELETE', `/moderation/rooms/${room.id}/ban/${member.id}`, { token: owner.token })).status, 200);
});

test('bans are not visible to other users', async () => {
  const { admin, member, room } = await roomWithStaff();
  const outsider = await register();
  await api('POST', `/moderation/rooms/${room.id}/ban/${member.id}`, { token: admin.token, body: { reason: 'spam' } });
  assert.equal((await api('GET', `/moderation/rooms/${room.id}/banned/${member.id}`, { token: outsider.token })).status, 403);
  const self = await api('GET', `/moderation/rooms/${room.id}/banned/${member.id}`, { token: member.token });
  assert.deepEqual(self.data, { banned: true });
});

test('ownership cannot be granted to another member', async () => {
  const { owner, member, room } = await roomWithStaff();
  const res = await api('PATCH', `/moderation/rooms/${room.id}/members/${member.id}/role`, { token: owner.token, body: { role: 'owner' } });
  assert.equal(res.status, 400);
});
