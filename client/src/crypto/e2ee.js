// SecureChat end-to-end encryption (protocol v2), built on the Web Crypto API only.
//
// - The password never leaves the browser. PBKDF2 (600k iterations) turns it into a
//   master secret, split with HKDF into an auth key (the only thing sent to the
//   server) and a wrapping key (never sent).
// - Each user has an RSA-OAEP 3072 identity. The private key is stored on the server
//   encrypted with the wrapping key, so it can be restored on any device but is
//   unreadable for the server.
// - Each room has random AES-256-GCM keys, one per key version, wrapped separately
//   for every member with their public key. A new version is created whenever a
//   member leaves or is banned.
// - Messages and files are bound to their room, key version and sender through
//   AES-GCM additional data, so the server cannot move or re-attribute them.
//
// This module has no imports so it can run in browsers and in Node (tests).

const subtle = () => globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PROTOCOL = 'securechat-v2';
export const PBKDF2_ITERATIONS = 600000;
const RSA_PARAMS = { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
const RSA_IMPORT = { name: 'RSA-OAEP', hash: 'SHA-256' };

// ---------- encoding helpers ----------

export const toBase64 = (buffer) => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

export const fromBase64 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

const pemBody = (pem) => pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s/g, '');

// ---------- password → auth key + wrapping key ----------

// The salt is derived from the normalized email, so it is known before login
// without asking the server (same approach as Bitwarden).
export async function deriveAccountKeys(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const salt = new Uint8Array(await subtle().digest('SHA-256', encoder.encode(`${PROTOCOL}:${normalizedEmail}`)));
  const passwordKey = await subtle().importKey('raw', encoder.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const master = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, passwordKey, 256);
  const hkdf = await subtle().importKey('raw', master, 'HKDF', false, ['deriveBits', 'deriveKey']);

  const authBits = await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: encoder.encode(`${PROTOCOL}:auth`) }, hkdf, 256);
  const wrapKey = await subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: encoder.encode(`${PROTOCOL}:wrap`) },
    hkdf, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

  return { authKey: toBase64(authBits), wrapKey };
}

// ---------- identity keys ----------

export async function generateIdentity(wrapKey) {
  const pair = await subtle().generateKey(RSA_PARAMS, true, ['encrypt', 'decrypt']);
  const spki = await subtle().exportKey('spki', pair.publicKey);
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
  const iv = randomBytes(12);
  const sealed = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`${PROTOCOL}:identity`) }, wrapKey, pkcs8);
  // Re-imported as non-extractable: scripts can use it but never read it
  const privateKey = await unwrapPrivateKeyFromPkcs8(pkcs8);
  pkcs8.fill(0);
  return {
    publicKeyPem: `-----BEGIN PUBLIC KEY-----\n${toBase64(spki)}\n-----END PUBLIC KEY-----`,
    encryptedPrivateKey: `${toBase64(iv)}.${toBase64(sealed)}`,
    privateKey
  };
}

const unwrapPrivateKeyFromPkcs8 = (pkcs8) => subtle().importKey('pkcs8', pkcs8, RSA_IMPORT, false, ['decrypt']);

// Throws if the password is wrong (AES-GCM authentication fails)
export async function unlockPrivateKey(encryptedPrivateKey, wrapKey) {
  const [ivB64, sealedB64] = String(encryptedPrivateKey).split('.');
  const pkcs8 = await subtle().decrypt(
    { name: 'AES-GCM', iv: fromBase64(ivB64), additionalData: encoder.encode(`${PROTOCOL}:identity`) },
    wrapKey, fromBase64(sealedB64));
  return unwrapPrivateKeyFromPkcs8(pkcs8);
}

export const importPublicKey = (pem) => subtle().importKey('spki', fromBase64(pemBody(pem)), RSA_IMPORT, false, ['encrypt']);

// Short, human-comparable fingerprint of a public key: 8 groups of 4 hex digits
export async function fingerprint(publicKeyPem) {
  const digest = new Uint8Array(await subtle().digest('SHA-256', fromBase64(pemBody(publicKeyPem))));
  const hex = Array.from(digest.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
  return hex.toUpperCase().match(/.{4}/g).join(' ');
}

// ---------- room keys ----------

export const generateRoomKey = () => subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

// The raw room key is wrapped together with its room and version, so a wrapped key
// cannot be replayed into another room or version by the server
export async function wrapRoomKey(roomKey, publicKeyPem, roomId, version) {
  const raw = new Uint8Array(await subtle().exportKey('raw', roomKey));
  const payload = new Uint8Array([...encoder.encode(`${PROTOCOL}:${roomId}:${version}:`), ...raw]);
  raw.fill(0);
  const wrapped = await subtle().encrypt({ name: 'RSA-OAEP' }, await importPublicKey(publicKeyPem), payload);
  payload.fill(0);
  return toBase64(wrapped);
}

export async function unwrapRoomKey(wrappedKey, privateKey, roomId, version) {
  const payload = new Uint8Array(await subtle().decrypt({ name: 'RSA-OAEP' }, privateKey, fromBase64(wrappedKey)));
  const prefix = encoder.encode(`${PROTOCOL}:${roomId}:${version}:`);
  const matches = payload.length === prefix.length + 32 && prefix.every((b, i) => payload[i] === b);
  if (!matches) {
    payload.fill(0);
    throw new Error('Room key does not belong to this room or version');
  }
  const key = await subtle().importKey('raw', payload.slice(prefix.length), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  payload.fill(0);
  return key;
}

// ---------- messages and files ----------

const messageContext = (roomId, version, senderId) => encoder.encode(`${PROTOCOL}:msg:${roomId}:${version}:${senderId}`);
const fileContext = (roomId, version, senderId) => encoder.encode(`${PROTOCOL}:file:${roomId}:${version}:${senderId}`);

export async function encryptMessage(roomKey, plaintext, { roomId, version, senderId }) {
  const iv = randomBytes(12);
  const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: messageContext(roomId, version, senderId) },
    roomKey, encoder.encode(plaintext));
  return { content: toBase64(data), iv: toBase64(iv) };
}

export async function decryptMessage(roomKey, { content, iv }, { roomId, version, senderId }) {
  const data = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(iv), additionalData: messageContext(roomId, version, senderId) },
    roomKey, fromBase64(content));
  return decoder.decode(data);
}

export async function encryptFile(roomKey, bytes, { roomId, version, senderId }) {
  const iv = randomBytes(12);
  const data = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: fileContext(roomId, version, senderId) }, roomKey, bytes);
  return { data: new Uint8Array(data), iv: toBase64(iv) };
}

export async function decryptFile(roomKey, bytes, iv, { roomId, version, senderId }) {
  return new Uint8Array(await subtle().decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv), additionalData: fileContext(roomId, version, senderId) }, roomKey, bytes));
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await subtle().digest('SHA-256', bytes));
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}
