import { describe, it, expect } from 'vitest';
import { labelSnapshots } from './snapshotLabels.js';
import { createSnapshot } from './snapshot.js';
import { FLOOR_FOCUSES } from '../components/viewSwitch.js';

const BASE = { demand: 0, supply: 0, slopeD: 0, slopeS: 0, controlPrice: 90, on: true, view: 'ib', focus: null };
const snap = (over = {}) => createSnapshot({ page: 'price-floor', state: { ...BASE, ...over } });
const opts = { type: 'floor', focuses: FLOOR_FOCUSES };

describe('labelSnapshots', () => {
  it('calls a lone snapshot "Graph 1"', () => {
    expect(labelSnapshots([snap()], opts)).toEqual(['Graph 1']);
  });

  it('numbers identical snapshots and keeps both', () => {
    expect(labelSnapshots([snap(), snap()], opts)).toEqual(['Graph 1', 'Graph 2']);
  });

  it('shows true point elasticity only for the dimension that differs', () => {
    const [a, b] = labelSnapshots([snap({ slopeD: -0.3 }), snap({ slopeD: 0.3 })], opts);
    expect(a).toMatch(/^PED \d+\.\d\d$/);
    expect(b).toMatch(/^PED \d+\.\d\d$/);
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/PES|floor/);
  });

  it('flatter demand reads as the higher PED', () => {
    const [flat, steep] = labelSnapshots([snap({ slopeD: 0.3 }), snap({ slopeD: -0.3 })], opts);
    expect(parseFloat(flat.slice(4))).toBeGreaterThan(parseFloat(steep.slice(4)));
  });

  it('joins every differing dimension with commas', () => {
    const [a] = labelSnapshots([snap({ demand: 10, slopeS: 0.2 }), snap()], opts);
    expect(a).toMatch(/demand \+10/);
    expect(a).toMatch(/PES/);
    expect(a.split(', ')).toHaveLength(2);
  });

  it('names the control when it is on and its absence when off', () => {
    expect(labelSnapshots([snap(), snap({ on: false })], opts)).toEqual(['floor $90', 'no floor']);
  });

  it('shows the price of the control only when it differs between graphs that are on', () => {
    expect(labelSnapshots([snap({ controlPrice: 90 }), snap({ controlPrice: 100 })], opts)).toEqual(['floor $90', 'floor $100']);
  });

  it('names the lens, or "exam diagram" for none', () => {
    const [a, b] = labelSnapshots([snap({ view: 'explorer', focus: 'cs' }), snap()], opts);
    expect(a).toBe(FLOOR_FOCUSES.find(([id]) => id === 'cs')[1]);
    expect(b).toBe('exam diagram');
  });

  it('tells apart identical graphs inside a set where others differ', () => {
    expect(labelSnapshots([snap(), snap(), snap({ on: false })], opts)).toEqual(['floor $90', 'floor $90 (2)', 'no floor']);
  });
});
