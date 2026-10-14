import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestPersistentStorage, resetPersistentStorageRequest } from './storagePersistence';

function stubStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { ...navigator, storage });
}

beforeEach(() => resetPersistentStorageRequest());
afterEach(() => vi.unstubAllGlobals());

describe('requestPersistentStorage', () => {
  it('does not ask again when storage is already persisted', async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persisted: async () => true, persist });

    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks the browser and reports its answer', async () => {
    stubStorage({ persisted: async () => false, persist: async () => false });

    expect(await requestPersistentStorage()).toBe(false);
  });

  it('asks once per launch', async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persisted: async () => false, persist });

    await requestPersistentStorage();
    await requestPersistentStorage();

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('reports null when the browser has no storage manager', async () => {
    stubStorage(undefined);

    expect(await requestPersistentStorage()).toBeNull();
  });

  it('reports null when the browser throws', async () => {
    stubStorage({ persisted: async () => { throw new Error('denied'); } });

    expect(await requestPersistentStorage()).toBeNull();
  });
});
