import { describe, expect, it, vi } from 'vitest';
import { ConnectionStore } from './connection-store';

describe('ConnectionStore', () => {
  it('starts empty and keeps the token only in its in-memory snapshot', () => {
    const store = new ConnectionStore();
    const connection = { baseUrl: 'http://127.0.0.1:4000', token: 'private-token' };

    expect(store.get()).toBeUndefined();
    store.set(connection);

    expect(store.get()).toEqual(connection);
    expect(JSON.stringify(store)).not.toContain('private-token');
  });

  it('removes the token when cleared and notifies subscribers', () => {
    const store = new ConnectionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set({ baseUrl: 'http://127.0.0.1:4000', token: 'private-token' });
    store.clear();

    expect(store.get()).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('does not notify a listener removed during notification', () => {
    const store = new ConnectionStore();
    const removed = vi.fn();
    let remove: () => void;
    store.subscribe(() => remove());
    remove = store.subscribe(removed);

    store.set({ baseUrl: 'http://127.0.0.1:4000', token: 'private-token' });

    expect(removed).not.toHaveBeenCalled();
  });
});
