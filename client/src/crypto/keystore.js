// Keeps the unlocked identity in IndexedDB so a page reload does not ask for the
// password again. The private key is a non-extractable CryptoKey: it can be used
// by this origin but its bytes can never be read back, not even by a script.
const DB_NAME = 'securechat';
const STORE = 'identity';
const ENTRY = 'current';

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const run = async (mode, action) => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

export const saveIdentity = (identity) => run('readwrite', store => store.put(identity, ENTRY));
export const loadIdentity = () => run('readonly', store => store.get(ENTRY));
export const clearIdentity = () => run('readwrite', store => store.delete(ENTRY));
