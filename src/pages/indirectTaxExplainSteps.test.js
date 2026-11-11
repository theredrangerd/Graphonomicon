import { describe, it, expect } from 'vitest';
import { TAX_STEPS } from './indirectTaxExplainSteps.js';
import { LAYERS } from '../lib/marketChart.js';

const ctx = { amount: 20, result: { Q: 52.5, Pc: 90, Pp: 70, Pstar: 80, govRevenue: 1050 } };

describe('TAX_STEPS', () => {
  it('has the 12 steps in order', () => {
    expect(TAX_STEPS.map((s) => s.id)).toEqual([
      'demand', 'supply', 'tax', 'equilibrium', 'prices', 'consumer burden', 'producer burden',
      'revenue', 'surplus', 'deadweight loss', 'elasticity', 'wrap']);
  });
  it('keeps S1 on screen from step 2 until the IB wrap-up', () => {
    TAX_STEPS.slice(1, 11).forEach((s) => expect(s.layers).toContain('supply'));
    expect(TAX_STEPS[11].view).toBe('ib');
    expect(TAX_STEPS[11].finish).toBe(true);
  });
  it('only uses known layer names, and enter/grow are subsets of layers', () => {
    TAX_STEPS.forEach((s) => {
      (s.layers ?? []).forEach((n) => expect(LAYERS).toContain(n));
      [...(s.enter ?? []), ...(s.grow ?? [])].forEach((n) => expect(s.layers).toContain(n));
    });
  });
  it('captions S2 as cost + tax and the bracket as the tax per can', () => {
    expect(TAX_STEPS[2].captions(ctx)).toEqual({ s1: 'S1 = what it costs to make', s2: 'S2 = cost + tax', bracket: '$20 tax per can' });
  });
  it('steps 1-2 have no tax, 3-12 have slider and tax', () => {
    expect(TAX_STEPS.slice(0, 2).every((s) => s.tax === false && s.slider === false)).toBe(true);
    expect(TAX_STEPS.slice(2).every((s) => s.tax && s.slider)).toBe(true);
  });
  it('uses live values: Qtax, the two burdens (adding up to the tax) and the revenue', () => {
    expect(TAX_STEPS[3].text(ctx)).toContain('52.5');
    expect(TAX_STEPS[5].text(ctx)).toContain('$10 more');
    expect(TAX_STEPS[6].text(ctx)).toContain('$10 + $10 = the whole $20 tax');
    expect(TAX_STEPS[7].text(ctx)).toContain('$1,050');
    const uneven = { amount: 20, result: { ...ctx.result, Pc: 95.2, Pp: 75.2 } };
    expect(TAX_STEPS[10].text(uneven)).toContain('Customers pay $15 of the $20 tax, and the company only $5');
  });
  it('only the elasticity step swaps in inelastic demand', () => {
    expect(TAX_STEPS.filter((s) => s.demand).map((s) => s.id)).toEqual(['elasticity']);
    expect(TAX_STEPS[10].demand).toBe('inelastic');
  });
});
