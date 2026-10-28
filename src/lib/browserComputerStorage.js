const DATABASE_NAME = 'sudo-spandr-browser-computer';
const DATABASE_VERSION = 1;
const WORKSPACE_STORE = 'workspace';
const WORKSPACE_KEY = 'project';

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WORKSPACE_STORE)) request.result.createObjectStore(WORKSPACE_STORE);
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('Browser computer storage could not be opened.'));
    request.onblocked = () => reject(new Error('Another tab is blocking the browser computer storage upgrade.'));
  });
}

async function withWorkspace(mode, operation) {
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
    const transaction = database.transaction(WORKSPACE_STORE, mode);
    operation(transaction.objectStore(WORKSPACE_STORE), (value) => { result = value; });
    transaction.oncomplete = () => finish(resolve, result);
    transaction.onerror = () => finish(reject, transaction.error || new Error('Browser computer storage failed.'));
    transaction.onabort = () => finish(reject, transaction.error || new Error('Browser computer storage was aborted.'));
  });
}

export async function loadBrowserWorkspace() {
  return withWorkspace('readonly', (store, setResult) => {
    const request = store.get(WORKSPACE_KEY);
    request.onsuccess = () => setResult(request.result?.files || null);
  });
}

export async function saveBrowserWorkspace(files) {
  await withWorkspace('readwrite', (store) => {
    store.put({ files, updatedAt: new Date().toISOString() }, WORKSPACE_KEY);
  });
}
