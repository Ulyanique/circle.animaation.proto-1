const DB_NAME = 'circle-archive-media-v1';
const STORE_NAME = 'slots';

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (_) {
      resolve(null);
    }
  });
}

/** @param {number} index @param {File|Blob} file */
export async function saveArchiveMediaFile(index, file) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({
        blob: file,
        name: /** @type {any} */ (file).name || `slot-${index + 1}`,
        type: file.type || 'application/octet-stream',
      }, `slot-${index}`);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
    } catch (_) {
      db.close();
      resolve(false);
    }
  });
}

/** @param {number} index @returns {Promise<File|null>} */
export async function loadArchiveMediaFile(index) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(`slot-${index}`);
      req.onsuccess = () => {
        db.close();
        const rec = req.result;
        if (!rec?.blob) { resolve(null); return; }
        try {
          resolve(new File([rec.blob], rec.name || `slot-${index + 1}`, { type: rec.type || rec.blob.type || '' }));
        } catch (_) {
          resolve(null);
        }
      };
      req.onerror = () => { db.close(); resolve(null); };
    } catch (_) {
      db.close();
      resolve(null);
    }
  });
}

/** @param {number} index */
export async function deleteArchiveMediaFile(index) {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(`slot-${index}`);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
    } catch (_) {
      db.close();
      resolve(false);
    }
  });
}

/** Переставить два сохранённых медиафайла в IndexedDB при перемещении слотов.
 * @param {number} a @param {number} b */
export async function swapArchiveMediaFiles(a, b) {
  if (a === b) return;
  const [fileA, fileB] = await Promise.all([loadArchiveMediaFile(a), loadArchiveMediaFile(b)]);
  await Promise.all([
    fileB ? saveArchiveMediaFile(a, fileB) : deleteArchiveMediaFile(a),
    fileA ? saveArchiveMediaFile(b, fileA) : deleteArchiveMediaFile(b),
  ]);
}
