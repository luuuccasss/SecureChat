// Client side of the end-to-end encryption protocol: account keys, room key
// synchronisation (share / rotate) and message and file encryption.
import * as e2ee from './e2ee';
import { saveIdentity, loadIdentity, clearIdentity } from './keystore';
import { authAPI, roomsAPI } from '../services/api';
import socketService from '../services/socketService';

class CryptoSession {
  constructor() {
    this.reset();
  }

  reset() {
    this.identity = null; // { userId, publicKeyPem, privateKey }
    this.roomKeys = new Map(); // `${roomId}:${version}` -> CryptoKey
    this.syncing = new Map(); // roomId -> pending sync promise
  }

  get ready() {
    return !!this.identity;
  }

  // ---------- account ----------

  async register({ username, email, password }) {
    const { authKey, wrapKey } = await e2ee.deriveAccountKeys(email, password);
    const identity = await e2ee.generateIdentity(wrapKey);
    const response = await authAPI.register({
      username,
      email,
      password: authKey,
      publicKey: identity.publicKeyPem,
      encryptedPrivateKey: identity.encryptedPrivateKey
    });
    await this.setIdentity(response.data.user.id, identity.publicKeyPem, identity.privateKey);
    return response.data;
  }

  // Throws on a wrong password before anything is unlocked
  async login({ email, password }) {
    const { authKey, wrapKey } = await e2ee.deriveAccountKeys(email, password);
    const response = await authAPI.login({ email, password: authKey });
    const { user } = response.data;
    const privateKey = await e2ee.unlockPrivateKey(user.encryptedPrivateKey, wrapKey);
    await this.setIdentity(user.id, user.publicKey, privateKey);
    return response.data;
  }

  async setIdentity(userId, publicKeyPem, privateKey) {
    this.reset();
    this.identity = { userId, publicKeyPem, privateKey };
    await saveIdentity(this.identity);
  }

  // After a page reload: true if the unlocked key of this user is still available
  async restore(userId) {
    try {
      const stored = await loadIdentity();
      if (stored && stored.userId === userId) {
        this.reset();
        this.identity = stored;
        return true;
      }
    } catch (error) {
      console.error('Keystore unavailable:', error);
    }
    return false;
  }

  async forget() {
    this.reset();
    await clearIdentity().catch(() => {});
  }

  // ---------- room keys ----------

  key(roomId, version) {
    return this.roomKeys.get(`${roomId}:${version}`) || null;
  }

  // Loads the key versions shared with us. If nobody holds the current version
  // yet (new room, or someone left), we create it for every member. Returns the
  // current version if we can encrypt with it, null if we wait for another member.
  syncRoom(roomId) {
    if (!this.syncing.has(roomId)) {
      const pending = this.doSyncRoom(roomId).finally(() => this.syncing.delete(roomId));
      this.syncing.set(roomId, pending);
    }
    return this.syncing.get(roomId);
  }

  async doSyncRoom(roomId) {
    const { data } = await roomsAPI.getKeys(roomId);
    for (const { version, wrappedKey } of data.keys) {
      if (!this.key(roomId, version)) {
        try {
          this.roomKeys.set(`${roomId}:${version}`,
            await e2ee.unwrapRoomKey(wrappedKey, this.identity.privateKey, roomId, version));
        } catch (error) {
          console.error(`Room ${roomId}: key version ${version} could not be opened`, error);
        }
      }
    }
    if (this.key(roomId, data.keyVersion)) return data.keyVersion;

    if (!data.currentVersionHasKeys) {
      const created = await this.rotate(roomId, data.keyVersion);
      if (created) return data.keyVersion;
      return this.doSyncRoom(roomId); // another member rotated first
    }

    socketService.requestRoomKey(roomId);
    return null;
  }

  async rotate(roomId, version) {
    const roomKey = await e2ee.generateRoomKey();
    const { data } = await roomsAPI.getPublicKeys(roomId);
    const keys = await Promise.all(data.members.map(async (member) => ({
      userId: member.userId,
      wrappedKey: await e2ee.wrapRoomKey(roomKey, member.publicKey, roomId, version)
    })));
    try {
      await roomsAPI.rotateKeys(roomId, { version, keys });
      this.roomKeys.set(`${roomId}:${version}`, roomKey);
      return true;
    } catch (error) {
      if (error.response?.status === 409) return false;
      throw error;
    }
  }

  // Another member asked for the current key: wrap it for them if we have it
  async shareWith(roomId, userId) {
    if (userId === this.identity?.userId) return;
    const { data: keys } = await roomsAPI.getKeys(roomId);
    const roomKey = this.key(roomId, keys.keyVersion);
    if (!roomKey) return;
    const { data } = await roomsAPI.getPublicKeys(roomId);
    const member = data.members.find(m => m.userId === userId);
    if (!member) return;
    const wrappedKey = await e2ee.wrapRoomKey(roomKey, member.publicKey, roomId, keys.keyVersion);
    await roomsAPI.shareKey(roomId, { userId, version: keys.keyVersion, wrappedKey }).catch((error) => {
      if (error.response?.status !== 409) throw error; // someone else shared it first
    });
  }

  // ---------- messages and files ----------

  async encryptText(roomId, plaintext) {
    const version = await this.syncRoom(roomId);
    if (!version) return null;
    const sealed = await e2ee.encryptMessage(this.key(roomId, version), plaintext,
      { roomId, version, senderId: this.identity.userId });
    return { ...sealed, keyVersion: version };
  }

  // Returns the plaintext, or null if the key is missing or the message was tampered with
  async decryptText(roomId, message) {
    const roomKey = this.key(roomId, message.keyVersion);
    if (!roomKey) return null;
    try {
      return await e2ee.decryptMessage(roomKey, message,
        { roomId, version: message.keyVersion, senderId: message.sender.id });
    } catch {
      return null;
    }
  }

  async encryptFile(roomId, file) {
    const version = await this.syncRoom(roomId);
    if (!version) return null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sealed = await e2ee.encryptFile(this.key(roomId, version), bytes,
      { roomId, version, senderId: this.identity.userId });
    return { ...sealed, keyVersion: version, checksum: await e2ee.sha256Hex(sealed.data) };
  }

  async decryptFile(roomId, message, bytes, iv) {
    const roomKey = this.key(roomId, message.keyVersion);
    if (!roomKey) throw new Error('Missing room key');
    return e2ee.decryptFile(roomKey, bytes, iv,
      { roomId, version: message.keyVersion, senderId: message.sender.id });
  }

  fingerprint(publicKeyPem) {
    return e2ee.fingerprint(publicKeyPem);
  }
}

const cryptoSession = new CryptoSession();
export default cryptoSession;
