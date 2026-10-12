const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, register, connect } = require('./helpers');

test('logging out revokes the token for HTTP and sockets', async () => {
  const user = await register();
  assert.equal((await api('GET', '/auth/verify', { token: user.token })).status, 200);
  assert.equal((await api('POST', '/auth/logout', { token: user.token })).status, 200);
  assert.equal((await api('GET', '/auth/verify', { token: user.token })).status, 401);
  await assert.rejects(connect(user));
});

test('public keys are only served to signed-in users', async () => {
  const user = await register();
  assert.equal((await api('GET', `/auth/user/${user.id}/public`)).status, 401);
  assert.equal((await api('GET', `/auth/user/${user.id}/public`, { token: user.token })).status, 200);
});

test('tokens signed with another algorithm are rejected', async () => {
  const user = await register();
  const [, payload] = user.token.split('.');
  const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${payload}.`;
  assert.equal((await api('GET', '/auth/verify', { token: unsigned })).status, 401);
});

test('unknown emails and wrong passwords get the same answer', async () => {
  const user = await register();
  const wrong = await api('POST', '/auth/login', { body: { email: user.email, password: 'Wrong-pass1' } });
  const unknown = await api('POST', '/auth/login', { body: { email: 'nobody@test.local', password: 'Wrong-pass1' } });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.data, unknown.data);
});
