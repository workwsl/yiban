const DB_NAME = 'yiban_translation_cache';
const STORE_NAME = 'translations';
const DB_VERSION = 1;

export interface TranslationCacheRecord {
  key: string;
  sourceText: string;
  translatedText: string;
  targetLanguage: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  hitCount: number;
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('modelId', 'modelId');
        store.createIndex('targetLanguage', 'targetLanguage');
        store.createIndex('createdAt', 'createdAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openCacheDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function createTranslationCacheKey(
  sourceText: string,
  targetLanguage: string,
  modelId: string,
  promptProfileId: string,
  promptFingerprint: string,
): Promise<string> {
  const data = new TextEncoder().encode(
    `${sourceText}\n${targetLanguage}\n${modelId}\n${promptFingerprint}\n${promptProfileId}`,
  );
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCachedTranslation(key: string): Promise<TranslationCacheRecord | undefined> {
  const record = await withStore<TranslationCacheRecord | undefined>('readonly', (store) => store.get(key));
  return record;
}

export async function setCachedTranslation(record: TranslationCacheRecord): Promise<void> {
  await withStore<IDBValidKey>('readwrite', (store) => store.put(record));
}
