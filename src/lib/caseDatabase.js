const DATABASE_NAME = 'sudo-spandr-sentinelmail';
const DATABASE_VERSION = 1;
const CASE_STORE = 'cases';
export const MAX_DEVICE_CASES = 50;

function assertIndexedDb() {
  if (!globalThis.indexedDB) {
    throw new Error('IndexedDB is unavailable in this browser or privacy mode. Cases will remain in memory for this tab.');
  }
}

function openDatabase() {
  assertIndexedDb();
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CASE_STORE)) {
        database.createObjectStore(CASE_STORE, { keyPath: 'case_id' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('The device case database could not be opened.'));
    request.onblocked = () => reject(new Error('Another tab is blocking the device case database upgrade. Close older workspace tabs and retry.'));
  });
}

async function withCaseStore(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let result;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      database.close();
      callback(value);
    };
    const transaction = database.transaction(CASE_STORE, mode);
    const store = transaction.objectStore(CASE_STORE);
    operation(store, (value) => { result = value; });
    transaction.oncomplete = () => finish(resolve, result);
    transaction.onerror = () => finish(reject, transaction.error || new Error('Device case storage operation failed.'));
    transaction.onabort = () => finish(reject, transaction.error || new Error('Device case storage operation was aborted.'));
  });
}

export async function listDeviceCases() {
  const records = await withCaseStore('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result || []);
  });
  return records
    .filter((item) => item && typeof item.case_id === 'string')
    .sort((a, b) => String(b._workspace?.receivedAt || b.generated_at || '').localeCompare(String(a._workspace?.receivedAt || a.generated_at || '')))
    .slice(0, MAX_DEVICE_CASES);
}

export async function saveDeviceCase(caseData) {
  if (!caseData?.case_id) throw new Error('A case reference is required before saving.');
  await withCaseStore('readwrite', (store) => {
    store.put(caseData);
    // Keep the newest 50 records so long-term local use cannot grow without
    // bound. The read and deletes share one transaction.
    const request = store.getAll();
    request.onsuccess = () => {
      const oldest = (request.result || [])
        .sort((a, b) => String(b._workspace?.receivedAt || b.generated_at || '').localeCompare(String(a._workspace?.receivedAt || a.generated_at || '')))
        .slice(MAX_DEVICE_CASES);
      oldest.forEach((item) => store.delete(item.case_id));
    };
  });
  return caseData;
}

export async function deleteDeviceCase(caseId) {
  await withCaseStore('readwrite', (store) => { store.delete(caseId); });
}

export async function clearDeviceCases() {
  await withCaseStore('readwrite', (store) => { store.clear(); });
}
