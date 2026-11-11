import { describe, it, expect } from 'vitest';
import { SUBSIDY_STEPS, LOAF_Q, loafQ, snapLoaf } from './subsidyExplainSteps.js';
import { LAYERS } from '../lib/marketChart.js';
import { computeMarket } from '../lib/marketEngine.js';
import { DEFAULT_MARKET } from '../lib/pageControls.js';

// The default curves with the default $20 subsidy: Pe $80, Qe 60, Pc $70, Pp $90, Q 67.5.
const result = computeMarket({ ...DEFAULT_MARKET, intervention: { type: 'subsidy', amount: 20 } });
const free = computeMarket({ ...DEFAULT_MARKET, intervention: { type: 'none' } });
const ctx = { amount: 20, result, dotQ: LOAF_Q, explored: false };
const step = (id) => SUBSIDY_STEPS.find((s) => s.id === id);
// The card's text with the coloured-term markup stripped, as a student reads it.
const plain = (html) => html.replace(/<[^>]+>/g, '');

describe('SUBSIDY_STEPS', () => {
  it('has the 14 steps in order: why S2 is lower, the two prices, revenue as an area, the box, then where the money goes', () => {
    expect(SUBSIDY_STEPS.map((s) => s.id)).toEqual([
      'demand', 'supply', 'cost of a loaf', 'one loaf', 'every loaf', 'equilibrium',
      'two prices', 'revenue', 'strips', 'government', 'producer', 'consumer', 'deadweight loss', 'wrap']);
  });
  it('never drops supply (S1 never moves) before the IB wrap-up', () => {
    SUBSIDY_STEPS.slice(1, -1).forEach((s) => expect(s.layers).toContain('supply'));
    const last = SUBSIDY_STEPS.at(-1);
    expect(last.view).toBe('ib');
    expect(last.finish).toBe(true);
  });
  it('only uses known layer names, and enter/grow are subsets of layers', () => {
    SUBSIDY_STEPS.forEach((s) => {
      (s.layers ?? []).forEach((n) => expect(LAYERS).toContain(n));
      (s.enter ?? []).forEach((n) => expect(s.layers).toContain(n));
      (s.grow ?? []).forEach((n) => expect(s.layers).toContain(n));
    });
  });
  it('steps 1-3 have no subsidy; from "one loaf" on, the slider and subsidy are on', () => {
    expect(SUBSIDY_STEPS.slice(0, 3).every((s) => s.subsidy === false && s.slider === false)).toBe(true);
    expect(SUBSIDY_STEPS.slice(3).every((s) => s.subsidy && s.slider)).toBe(true);
  });
  it('names supply "S1 = what it costs to make" from step 2, with Pe and Qe in the readout', () => {
    const c = step('supply').captions({ ...ctx, result: free });
    expect(c.s1).toBe('S1 = what it costs to make');
    expect(c.readout).toEqual([
      { label: 'Market price (Pe)', value: '$80', mark: 'pe' },
      { label: 'Loaves sold (Qe)', value: '60', mark: 'qe' },
    ]);
    expect(plain(step('supply').text({ ...ctx, result: free }))).toContain('loaves sell for Pe = $80');
  });
  it('the cost-of-a-loaf step is a drag step that stays locked until the student has explored', () => {
    const s = step('cost of a loaf');
    expect(s.drag).toBe(true);
    expect(s.gate({ ...ctx, explored: false })).toBe(false);
    expect(s.gate({ ...ctx, explored: true })).toBe(true);
    expect(s.chartOptions({ ...ctx, dotQ: 30, dotPos: 30 })).toMatchObject({ dotQ: 30 });
    expect(plain(s.text({ ...ctx, result: free, dotQ: 30 }))).toContain('loaf number 30. Baking it costs the bakery $40');
    expect(s.captions({ ...ctx, result: free, dotQ: 30 })).toMatchObject({ dotCostTag: '$40', dotQtyTag: 'loaf 30' });
    expect(s.think({ ...ctx, explored: false })).toContain('halo');
    expect(s.lockedLabel).toBe('Put the dot in the halo');
    // The "drag me" hint shows until the student touches the dot, and not while it glides.
    expect(s.captions({ ...ctx, result: free, touched: false, gliding: false }).dragHint).toBe('drag me');
    expect(s.captions({ ...ctx, result: free, touched: true, gliding: false }).dragHint).toBeUndefined();
    expect(s.captions({ ...ctx, result: free, touched: false, gliding: true }).dragHint).toBeUndefined();
    // The dot is drawn where it is; the words name its whole-dollar loaf.
    expect(s.chartOptions({ ...ctx, dotQ: 45, dotPos: 44.2 })).toEqual({ dotQ: 44.2, dotTarget: 42, dotTargetTolerance: 4, dotTargetReached: false });
    expect(s.chartOptions({ ...ctx, explored: true }).dotTargetReached).toBe(true);
    // The halo's label goes away once the dot has been there.
    expect(s.captions({ ...ctx, result: free }).targetHint).toBe('put the dot here');
    expect(s.captions({ ...ctx, result: free, explored: true }).targetHint).toBeUndefined();
  });
  it('snaps the dot to whole loaves, one at a time, inside the axis', () => {
    expect(snapLoaf(44.2)).toBe(44);
    expect(snapLoaf(42.6)).toBe(43);
    expect(snapLoaf(-5)).toBe(3);
    expect(snapLoaf(500)).toBe(96);
  });
  it('drops the government’s share off the loaf the student left the dot on', () => {
    const s = step('one loaf');
    expect(s.layers).not.toContain('supply2');
    expect(s.chartOptions({ ...ctx, dotQ: 66 })).toEqual({ loafQ: 66 });
    expect(plain(s.text({ ...ctx, dotQ: 66 }))).toBe('Loaf 66 still costs $88 to bake. The government now pays $20 of it, so the bakery only needs $68 from the customer to make the same amount of money. This means the bakery can offer consumers prices $20 lower because its cost of production is lesser by the amount of the subsidy.');
    expect(s.text({ ...ctx, dotQ: 66 })).toContain('<em>its cost of production is lesser by the amount of the subsidy</em>');
    expect(s.captions({ ...ctx, dotQ: 66 }).readout.map((r) => r.value)).toEqual(['$88', '$20', '$68']);
  });
  it('never lets the government’s share take the customer’s price below $0', () => {
    expect(loafQ({ ...ctx, dotQ: 6 })).toBe(15); // loaf 15 costs $20, exactly the subsidy
    expect(loafQ({ ...ctx, amount: 40, dotQ: 6 })).toBe(30);
  });
  it('S2 arrives with the arrows that build it', () => {
    expect(step('every loaf').enter).toEqual(['loafDrops', 'supply2']);
    expect(step('every loaf').think()).toContain('where will S2 cross demand');
  });
  it('builds the two prices as brackets: customer, then government on top, then the subsidy arrow', () => {
    const s = step('two prices');
    expect(s.layers).toEqual(expect.arrayContaining(['priceBrackets', 'subsidyArrow']));
    expect(plain(s.text(ctx))).toContain('Customers pay Pc = $70');
    expect(plain(s.text(ctx))).toContain('receives Pp = $90');
    expect(s.captions(ctx)).toMatchObject({ customer: 'customer pays $70', gov: '+ $20 government', total: 'bakery gets $90' });
  });
  it('builds the government box strip by strip, then as height × width, before any surplus', () => {
    const order = SUBSIDY_STEPS.map((s) => s.id);
    expect(order.indexOf('strips')).toBeLessThan(order.indexOf('producer'));
    expect(step('strips').enter).toEqual(['govStrips', 'readout']);
    expect(plain(step('government').text(ctx))).toContain('$20 per loaf × width 67.5 loaves = $1,350');
    expect(step('government').captions(ctx)).toMatchObject({ bracket: '$20 per loaf', width: '67.5 loaves', box: 'Government spending $1,350' });
    ['strips', 'government'].forEach((id) => {
      ['cs', 'ps', 'csTriangle', 'psTriangle', 'marginalCs', 'marginalPs', 'overlap'].forEach((n) => expect(step(id).layers).not.toContain(n));
    });
  });
  it('splits the box into shares that add up exactly to government spending', () => {
    ['producer', 'consumer', 'deadweight loss'].forEach((id) => expect(step(id).layers).toContain('wedgeBox'));
    expect(plain(step('producer').text(ctx))).toContain('$10 more');
    expect(plain(step('consumer').text(ctx))).toContain('$10 less');
    expect(plain(step('deadweight loss').text(ctx))).toContain('the whole $1,350');
    expect(step('deadweight loss').captions(ctx).readout.map((r) => r.value)).toEqual(['$637.50', '$637.50', '$75', '$1,350']);
  });
  it('colours every term with a known mark key', () => {
    SUBSIDY_STEPS.forEach((s) => {
      const html = s.text({ ...ctx, result: s.subsidy ? result : free });
      for (const [, key] of html.matchAll(/data-mark="([^"]+)"/g)) expect(['cost', 'gov', 'customer', 'pe', 'qe', 'qty', 'dwl']).toContain(key);
    });
  });
  it('asks students to predict before the reveal on three steps (plus the drag step’s instruction)', () => {
    expect(SUBSIDY_STEPS.filter((s) => s.think).map((s) => s.id)).toEqual(['cost of a loaf', 'every loaf', 'two prices', 'revenue']);
  });

  it('leaves "one loaf, two prices" by fading everything but the bakery total, and the revenue step shows only Pp', () => {
    const two = SUBSIDY_STEPS.find((s) => s.id === 'two prices');
    expect(two.leave.exit).toEqual(expect.arrayContaining(['priceBrackets', 'pricesC', 'readout']));
    const rev = SUBSIDY_STEPS.find((s) => s.id === 'revenue');
    expect(rev.layers).toContain('pricesPOnly');
    expect(rev.layers).not.toContain('prices');
    // The brackets carry over unlabelled: only the bakery's total keeps its words.
    expect(rev.layers).toContain('priceBrackets');
    const caps = rev.captions({ result: { Pp: 95, Pc: 70, Q: 60 } });
    expect(caps.total).toBe('bakery gets $95');
    expect(caps.customer).toBeUndefined();
    expect(caps.gov).toBeUndefined();
    expect(SUBSIDY_STEPS.find((s) => s.id === 'strips').fadeIn).toEqual(['pricesC']);
  });
});
