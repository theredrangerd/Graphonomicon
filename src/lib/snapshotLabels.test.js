import { describe, it, expect } from 'vitest';
import { describeSnapshots, labelSnapshots } from './snapshotLabels.js';
import { createSnapshot } from './snapshot.js';
import { FLOOR_FOCUSES } from '../components/viewSwitch.js';

const BASE = { demand: 0, supply: 0, slopeD: 0, slopeS: 0, controlPrice: 90, on: true, view: 'ib', focus: null };
const snap = (over = {}) => createSnapshot({ page: 'price-floor', state: { ...BASE, ...over } });
const opts = { type: 'floor', focuses: FLOOR_FOCUSES };
const chips = (snaps, i) => describeSnapshots(snaps, opts)[i].chips;

describe('labelSnapshots', () => {
  it('calls a lone snapshot "Graph 1"', () => {
    expect(labelSnapshots([snap()], opts)).toEqual(['Graph 1']);
    expect(chips([snap()], 0)).toEqual([]);
  });

  it('numbers identical snapshots and keeps both', () => {
    expect(labelSnapshots([snap(), snap()], opts)).toEqual(['Graph 1', 'Graph 2']);
  });

  it('describes elasticity in words, from the true point elasticity', () => {
    expect(labelSnapshots([snap({ slopeD: -0.3 }), snap({ slopeD: 0.3 })], opts)).toEqual(['Inelastic demand', 'Elastic demand']);
    expect(labelSnapshots([snap({ slopeD: -0.5 }), snap({ slopeD: 0.5 })], opts)).toEqual(['Very inelastic demand', 'Very elastic demand']);
    expect(labelSnapshots([snap({ slopeD: 0 }), snap({ slopeD: 0.5 })], opts)[0]).toBe('Unit-elastic demand');
  });

  it('describes supply elasticity too, and leaves it out when only demand differs', () => {
    expect(labelSnapshots([snap({ slopeS: 0.5 }), snap()], opts)).toEqual(['Very elastic supply', 'Unit-elastic supply']);
    expect(labelSnapshots([snap({ slopeD: 0.5 }), snap()], opts).join(' ')).not.toMatch(/supply/);
  });

  it('gives each chip its curve colour kind and a size of 1 to 3', () => {
    const [d, s] = [chips([snap({ slopeD: 0.5 }), snap()], 0)[0], chips([snap({ slopeS: 0.5 }), snap()], 0)[0]];
    expect(d).toMatchObject({ kind: 'demand', text: 'Very elastic demand', n: 3 });
    expect(s).toMatchObject({ kind: 'supply', n: 3 });
    expect(chips([snap({ slopeD: 0.3 }), snap()], 0)[0].n).toBe(2);
    expect(chips([snap(), snap({ slopeD: 0.3 })], 0)[0]).toMatchObject({ text: 'Unit-elastic demand', n: 1 });
  });

  it('bands demand shifts by size and direction', () => {
    const words = (demand) => labelSnapshots([snap({ demand }), snap()], opts)[0];
    expect(words(5)).toBe('Slightly higher demand');
    expect(words(-5)).toBe('Slightly lower demand');
    expect(words(20)).toBe('Higher demand');
    expect(words(-20)).toBe('Lower demand');
    expect(words(30)).toBe('Very high demand');
    expect(words(-27)).toBe('Very low demand');
    expect(chips([snap({ demand: -27 }), snap()], 0)[0].n).toBe(3);
    expect(chips([snap({ demand: 5 }), snap()], 0)[0].n).toBe(1);
  });

  it('bands supply shifts by size and direction', () => {
    const words = (supply) => labelSnapshots([snap({ supply }), snap()], opts)[0];
    expect(words(5)).toBe('Slightly more supply');
    expect(words(-20)).toBe('Less supply');
    expect(words(30)).toBe('Much more supply');
    expect(words(-30)).toBe('Much less supply');
  });

  it('names an unshifted curve when the other graph moved it', () => {
    expect(labelSnapshots([snap({ demand: 30 }), snap()], opts)).toEqual(['Very high demand', 'Unshifted demand']);
  });

  it('joins several differences, one chip each', () => {
    const [a] = describeSnapshots([snap({ demand: 30, slopeS: 0.5 }), snap()], opts);
    expect(a.chips.map((c) => c.kind)).toEqual(['supply', 'demand']);
    expect(a.title).toBe('Very elastic supply, Very high demand');
  });

  it('names the control when it is on and its absence when off', () => {
    expect(labelSnapshots([snap(), snap({ on: false })], opts)).toEqual(['Floor at $90', 'No floor']);
    expect(chips([snap(), snap({ on: false })], 0)[0]).toMatchObject({ kind: 'policy', n: 0 });
    expect(labelSnapshots([snap({ controlPrice: 50 }), snap({ on: false })], { type: 'ceiling', focuses: FLOOR_FOCUSES })).toEqual(['Ceiling at $50', 'No ceiling']);
  });

  it('shows the price of the control only when it differs between graphs that are on', () => {
    expect(labelSnapshots([snap({ controlPrice: 90 }), snap({ controlPrice: 100 })], opts)).toEqual(['Floor at $90', 'Floor at $100']);
  });

  it('names the lens, or "Exam diagram" for none', () => {
    const [a, b] = labelSnapshots([snap({ view: 'explorer', focus: 'cs' }), snap()], opts);
    expect(a).toBe(FLOOR_FOCUSES.find(([id]) => id === 'cs')[1]);
    expect(b).toBe('Exam diagram');
    expect(chips([snap({ view: 'explorer', focus: 'cs' }), snap()], 0)[0].kind).toBe('lens');
  });

  it('tells apart identical graphs inside a set where others differ', () => {
    const described = describeSnapshots([snap(), snap(), snap({ on: false })], opts);
    expect(described.map((d) => d.title)).toEqual(['Floor at $90', 'Floor at $90 (2)', 'No floor']);
    expect(described.map((d) => d.suffix)).toEqual(['', '(2)', '']);
  });
});
