import { describe, it, expect, vi } from 'vitest';
import { createCompareStore, MAX_FROZEN } from './compareStore.js';
import { createSnapshot } from './snapshot.js';

const STATE = { demand: 0, supply: 0, slopeD: 0, slopeS: 0, controlPrice: 90, on: true, view: 'ib', focus: null };
const snap = () => createSnapshot({ page: 'price-floor', state: STATE });

describe('createCompareStore', () => {
  it('hands out increasing ids and lists in order', () => {
    const store = createCompareStore();
    const a = store.add(snap());
    const b = store.add(snap());
    expect(a.ok && b.ok).toBe(true);
    expect(b.id).toBeGreaterThan(a.id);
    expect(store.list().map((e) => e.id)).toEqual([a.id, b.id]);
  });

  it('keeps identical snapshots as separate entries', () => {
    const store = createCompareStore();
    store.add(snap());
    store.add(snap());
    expect(store.list()).toHaveLength(2);
  });

  it('rejects the ninth add without notifying, and a removal frees a slot', () => {
    const store = createCompareStore();
    const ids = Array.from({ length: MAX_FROZEN }, () => store.add(snap()).id);
    expect(MAX_FROZEN).toBe(8);
    const fn = vi.fn();
    store.subscribe(fn);
    expect(store.add(snap())).toEqual({ ok: false, reason: 'full' });
    expect(store.list()).toHaveLength(8);
    expect(fn).not.toHaveBeenCalled();
    store.remove(ids[0]);
    expect(store.add(snap()).ok).toBe(true);
  });

  it('never reuses an id after a removal', () => {
    const store = createCompareStore();
    const a = store.add(snap());
    store.remove(a.id);
    expect(store.add(snap()).id).toBeGreaterThan(a.id);
  });

  it('notifies subscribers once per change until they unsubscribe', () => {
    const store = createCompareStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);
    const { id } = store.add(snap());
    store.remove(id);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    store.add(snap());
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clear empties the store and notifies', () => {
    const store = createCompareStore();
    store.add(snap());
    const fn = vi.fn();
    store.subscribe(fn);
    store.clear();
    expect(store.list()).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns a copy from list()', () => {
    const store = createCompareStore();
    store.add(snap());
    store.list().pop();
    expect(store.list()).toHaveLength(1);
  });
});
