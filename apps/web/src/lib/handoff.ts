// Carries a file dropped on the home page to the tool picked for it. The file goes into this
// browser's IndexedDB (on this device), and the tool takes it out again as soon as it opens.

const DB = "tools-handoff";
const STORE = "files";
const KEY = "next";
/** A file not taken within this time is dropped, so nothing lingers on a shared computer. */
const MAX_AGE_MS = 5 * 60_000;
/** Query flag on the destination URL: a file is waiting. */
export const HANDOFF_PARAM = "file";

function openHandoffDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function runRequest<T>(
  mode: IDBTransactionMode,
  op: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openHandoffDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

/** Keeps `file` for the next page. False if this browser can't (private mode, storage off). */
export async function saveHandoff(file: File): Promise<boolean> {
  try {
    await runRequest("readwrite", (s) => s.put({ file, at: Date.now() }, KEY));
    return true;
  } catch {
    return false;
  }
}

/** The waiting file, removed from storage in the same step. */
export async function takeHandoff(): Promise<File | undefined> {
  try {
    const entry = await runRequest<{ file: File; at: number } | undefined>(
      "readonly",
      (s) => s.get(KEY),
    );
    await runRequest("readwrite", (s) => s.delete(KEY));
    if (!entry || Date.now() - entry.at > MAX_AGE_MS) return undefined;
    return entry.file;
  } catch {
    return undefined;
  }
}

export const isHandoffUrl = (search = location.search) =>
  new URLSearchParams(search).has(HANDOFF_PARAM);

/** Drops the flag from the address bar so a reload doesn't look for the file again. */
export function clearHandoffUrl() {
  const url = new URL(location.href);
  url.searchParams.delete(HANDOFF_PARAM);
  history.replaceState(history.state, "", url);
}
