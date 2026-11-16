import { describe, it, expect } from 'vitest';
import { SNAPSHOT_VERSION, createSnapshot, migrateSnapshot } from './snapshot.js';

const STATE = { demand: 10, supply: 0, slopeD: 0.1, slopeS: 0, controlPrice: 110, on: true, view: 'explorer', focus: 'cs' };

describe('createSnapshot', () => {
  it('makes a current-version record for a page', () => {
    expect(createSnapshot({ page: 'price-floor', state: STATE })).toEqual({ v: SNAPSHOT_VERSION, page: 'price-floor', name: '', state: STATE });
    expect(SNAPSHOT_VERSION).toBe(1);
  });

  it('copies the state instead of aliasing it', () => {
    const state = { ...STATE };
    const snap = createSnapshot({ page: 'price-floor', state });
    state.demand = 99;
    expect(snap.state.demand).toBe(10);
  });
});

describe('migrateSnapshot', () => {
  it('round-trips a record through JSON', () => {
    const snap = createSnapshot({ page: 'price-floor', state: STATE });
    expect(migrateSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });

  it.each([
    ['null', null],
    ['a string', 'x'],
    ['a future version', { v: 2, page: 'price-floor', name: '', state: STATE }],
    ['no state', { v: 1, page: 'price-floor', name: '' }],
    ['no page', { v: 1, name: '', state: STATE }],
    ['a NaN slider', { v: 1, page: 'price-floor', name: '', state: { ...STATE, demand: NaN } }],
    ['a non-boolean toggle', { v: 1, page: 'price-floor', name: '', state: { ...STATE, on: 'yes' } }],
  ])('returns null for %s', (_label, record) => {
    expect(migrateSnapshot(record)).toBeNull();
  });
});
