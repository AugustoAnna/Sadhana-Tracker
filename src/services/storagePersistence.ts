let request: Promise<boolean | null> | null = null;

/**
 * Ask the browser to keep this app's storage when the device runs low on
 * space. Unpersisted, IndexedDB is "best effort": the browser may wipe it,
 * taking any tick whose upload has not gone through yet. Chrome decides
 * without a prompt (installed apps are usually granted); Safari supports it
 * from 17.
 *
 * Resolves to whether storage is persisted, or null when the browser cannot
 * say. Asked once per launch; later calls share the answer.
 */
export function requestPersistentStorage(): Promise<boolean | null> {
  request ??= (async () => {
    try {
      const storage = navigator.storage;
      if (!storage?.persisted) return null;
      if (await storage.persisted()) return true;
      return storage.persist ? await storage.persist() : false;
    } catch {
      return null;
    }
  })();
  return request;
}

/** Test seam: forget the answer so the next call asks again. */
export function resetPersistentStorageRequest(): void {
  request = null;
}
