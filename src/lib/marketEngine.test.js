import { describe, it, expect } from 'vitest';
import { computeMarket, fitsChart, pointElasticities } from './marketEngine.js';

const base = { demand: 140, supply: 20, slopeD: 1, slopeS: 1 };

describe('computeMarket — free market', () => {
  it('clears at the textbook equilibrium with no deadweight loss', () => {
    const r = computeMarket({ ...base, intervention: { type: 'none' } });
    expect(r.mode).toBe('free');
    expect(r.Q).toBe(60);
    expect(r.Pc).toBe(80);
    expect(r.Pp).toBe(80);
    expect(r.CS).toBe(1800);
    expect(r.PS).toBe(1800);
    expect(r.DWL).toBe(0);
  });

  it('short-circuits to noTrade with zero surplus when demand never exceeds supply', () => {
    const r = computeMarket({ demand: 10, supply: 50, slopeD: 1, slopeS: 1, intervention: { type: 'none' } });
    expect(r.noTrade).toBe(true);
    expect(r.CS).toBe(0);
    expect(r.PS).toBe(0);
    expect(r.DWL).toBe(0);
  });
});

describe('computeMarket — price ceiling', () => {
  it('rations quantity down to the shorter side of the market when binding', () => {
    const r = computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } });
    expect(r.mode).toBe('ceiling');
    expect(r.Q).toBe(30);
    expect(r.Pc).toBe(50);
    expect(r.Pp).toBe(50);
    expect(r.gap).toBe(60);
    expect(r.CS).toBe(2250);
    expect(r.PS).toBe(450);
    expect(r.DWL).toBe(900);
  });

  it('falls back to the free-market result when the ceiling is set above equilibrium', () => {
    const r = computeMarket({ ...base, intervention: { type: 'ceiling', price: 100 } });
    expect(r.mode).toBe('free');
    expect(r.Q).toBe(60);
    expect(r.DWL).toBe(0);
  });

  it('short-circuits to noTrade even with a ceiling active, instead of dividing by a meaningless denominator', () => {
    const r = computeMarket({ demand: 10, supply: 50, slopeD: 1, slopeS: 1, intervention: { type: 'ceiling', price: 5 } });
    expect(r.noTrade).toBe(true);
    expect(r.DWL).toBe(0);
  });

  it('reports the true shortage even when demanded quantity would exceed QMAX at an extreme ceiling price', () => {
    const r = computeMarket({ ...base, intervention: { type: 'ceiling', price: 30 } });
    expect(r.gap).toBe(100);
  });

  it('carries the requested control price through even when the ceiling does not bind, so the UI can still show a reference line', () => {
    const r = computeMarket({ ...base, intervention: { type: 'ceiling', price: 100 } });
    expect(r.mode).toBe('free');
    expect(r.requestedControl).toEqual({ type: 'ceiling', price: 100 });
  });

  it('has no requestedControl when no intervention is requested', () => {
    const r = computeMarket({ ...base, intervention: { type: 'none' } });
    expect(r.requestedControl).toBeNull();
  });
});

describe('computeMarket — price floor', () => {
  it('rations quantity down to the shorter side of the market when binding', () => {
    const r = computeMarket({ ...base, intervention: { type: 'floor', price: 110 } });
    expect(r.mode).toBe('floor');
    expect(r.Q).toBe(30);
    expect(r.Pc).toBe(110);
    expect(r.Pp).toBe(110);
    expect(r.gap).toBe(60);
    expect(r.CS).toBe(450);
    expect(r.PS).toBe(2250);
    expect(r.DWL).toBe(900);
  });

  it('falls back to the free-market result when the floor is set below equilibrium', () => {
    const r = computeMarket({ ...base, intervention: { type: 'floor', price: 50 } });
    expect(r.mode).toBe('free');
    expect(r.Q).toBe(60);
    expect(r.DWL).toBe(0);
  });

  it('correctly divides by slopeD/slopeS when computing shortage under a binding ceiling with non-unit elasticity', () => {
    const r = computeMarket({ demand: 140, supply: 20, slopeD: 1, slopeS: 2, intervention: { type: 'ceiling', price: 50 } });
    expect(r.Q).toBe(15);
    expect(r.gap).toBe(75);
  });

  it('correctly divides by slopeD/slopeS when computing surplus under a binding floor with non-unit elasticity', () => {
    const r = computeMarket({ demand: 140, supply: 20, slopeD: 2, slopeS: 1, intervention: { type: 'floor', price: 80 } });
    expect(r.Q).toBe(30);
    expect(r.gap).toBe(30);
  });

  it('does not overstate the gap when the control price falls below the supply intercept', () => {
    const r = computeMarket({ demand: 140, supply: 50, slopeD: 1, slopeS: 1, intervention: { type: 'ceiling', price: 40 } });
    expect(r.gap).toBe(100);
  });
});

describe('computeMarket — specific (per-unit) tax', () => {
  it('opens a wedge between what consumers pay and producers receive', () => {
    const r = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    expect(r.mode).toBe('tax');
    expect(r.Q).toBe(50);
    expect(r.Pc).toBe(90);
    expect(r.Pp).toBe(70);
    expect(r.govRevenue).toBe(1000);
  });

  it('short-circuits to noTrade instead of computing a nonsense quantity', () => {
    const r = computeMarket({ demand: 10, supply: 50, slopeD: 1, slopeS: 1, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    expect(r.noTrade).toBe(true);
    expect(r.govRevenue).toBe(0);
  });

  it('cuts the deadweight loss across Pe: the half above comes out of CS, the half below out of PS', () => {
    const r = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    expect(r.DWL).toBeGreaterThan(0);
    expect(r.DWLConsumer + r.DWLProducer).toBeCloseTo(r.DWL, 9);
    expect(Math.min(...r.dwlConsumerPoly.map(([, p]) => p))).toBeGreaterThanOrEqual(r.Pstar - 1e-9);
    expect(Math.max(...r.dwlProducerPoly.map(([, p]) => p))).toBeLessThanOrEqual(r.Pstar + 1e-9);
  });
});

describe('computeMarket — ad valorem tax', () => {
  it('opens a proportional wedge based on the rate', () => {
    const r = computeMarket({ ...base, intervention: { type: 'tax', mode: 'advalorem', rate: 0.5 } });
    expect(r.mode).toBe('tax');
    expect(r.Q).toBe(44);
    expect(r.Pp).toBe(64);
    expect(r.Pc).toBe(96);
    expect(r.govRevenue).toBe(1408);
  });

  it('degenerates to the free-market result at a 0% rate', () => {
    const r = computeMarket({ ...base, intervention: { type: 'tax', mode: 'advalorem', rate: 0 } });
    expect(r.Q).toBe(60);
    expect(r.Pc).toBe(80);
    expect(r.Pp).toBe(80);
    expect(r.govRevenue).toBe(0);
  });
});

describe('computeMarket — subsidy', () => {
  it('widens the wedge the other way, increasing quantity above equilibrium', () => {
    const r = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    expect(r.mode).toBe('subsidy');
    expect(r.Q).toBe(70);
    expect(r.Pc).toBe(70);
    expect(r.Pp).toBe(90);
    expect(r.govCost).toBe(1400);
    expect(r.DWL).toBeGreaterThan(0);
  });

  it('short-circuits to noTrade instead of computing a nonsense quantity', () => {
    const r = computeMarket({ demand: 10, supply: 50, slopeD: 1, slopeS: 1, intervention: { type: 'subsidy', amount: 20 } });
    expect(r.noTrade).toBe(true);
    expect(r.govCost).toBe(0);
  });
});

describe('computeMarket — no clamping inside the economics', () => {
  it('keeps the equilibrium on both curves even when it lies past the chart edge', () => {
    const r = computeMarket({ demand: 140, supply: 20, slopeD: 0.3, slopeS: 0.3 });
    expect(r.Qstar).toBeCloseTo(200);
    expect(r.Pd(r.Qstar)).toBeCloseTo(r.Ps(r.Qstar));
    expect(fitsChart(r)).toBe(false);
  });

  it('reports fitsChart true for the default market', () => {
    expect(fitsChart(computeMarket(base))).toBe(true);
  });
});

describe('pointElasticities', () => {
  it('measures elasticity from P/Q at equilibrium, not from slope alone', () => {
    const { ped, pes } = pointElasticities(computeMarket(base));
    // slope 1 on both curves, but P*/Q* = 80/60 — elastic, not "unit elastic"
    expect(ped).toBeCloseTo(4 / 3);
    expect(pes).toBeCloseTo(4 / 3);
  });

  it('returns nulls when no trade occurs', () => {
    expect(pointElasticities(computeMarket({ demand: 10, supply: 50, slopeD: 1, slopeS: 1 }))).toEqual({ ped: null, pes: null });
  });
});

describe('computeMarket — a tax that closes the market', () => {
  const closing = { demand: 100, supply: 60, slopeD: 1, slopeS: 1, intervention: { type: 'tax', mode: 'specific', amount: 60 } };

  it('flags the result as closed with nothing traded and the whole surplus lost', () => {
    const r = computeMarket(closing);
    expect(r.closed).toBe(true);
    expect(r.Q).toBe(0);
    expect(r.govRevenue).toBe(0);
    expect(r.DWL).toBeCloseTo(computeMarket({ ...closing, intervention: { type: 'none' } }).CS * 2);
  });

  it('still fits the chart even though its notional Pp is meaningless', () => {
    expect(fitsChart(computeMarket(closing))).toBe(true);
  });

  it('is not flagged for an ordinary tax', () => {
    expect(computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } }).closed).toBe(false);
  });
});

describe('computeMarket — steep (inelastic) supply that crosses the quantity axis', () => {
  // Supply P = -40 + 2Q hits the quantity axis at Q = 20; the first 20 units would be
  // supplied even at $0, so their minimum acceptable price is $0, not negative.
  const steep = { demand: 160, supply: -40, slopeD: 2, slopeS: 2 };

  it('floors the supply curve at $0 when measuring producer surplus', () => {
    const r = computeMarket(steep);
    expect(r.Qstar).toBe(50);
    expect(r.Pstar).toBe(60);
    // rectangle 0–20 at $60 + triangle 20–50 rising to $60 = 1200 + 900
    expect(r.PS).toBeCloseTo(2100);
    expect(Math.min(...r.psPoly.map(([, p]) => p))).toBe(0);
  });

  it('floors the deadweight-loss region at $0 too', () => {
    const r = computeMarket({ ...steep, intervention: { type: 'floor', price: 140 } });
    // qd = 10, where supply is below $0: the DWL region must stop at the axis
    expect(Math.min(...r.dwlPoly.map(([, p]) => p))).toBe(0);
    // ∫ demand − floored supply over Q 10–50: 4000 (demand, avg $100 × 40) − 900 (supply triangle)
    expect(r.DWL).toBeCloseTo(3100);
  });
});

describe('subsidy marginal surplus', () => {
  const sub = (amount, m = { demand: 140, supply: 20, slopeD: 1, slopeS: 1 }) =>
    computeMarket({ ...m, intervention: { type: 'subsidy', amount } });

  it('returns the free-market CS and PS triangles', () => {
    const r = sub(20);
    expect(r.csTrianglePoly).toEqual([[0, 140], [60, 80], [60, 80], [0, 80]]);
    expect(r.psTrianglePoly.length).toBeGreaterThanOrEqual(3);
  });
  it('measures the free-market CS and PS triangle areas', () => {
    const r = sub(20);
    expect(r.csTriangleArea).toBeCloseTo(1800);
    expect(r.psTriangleArea).toBeCloseTo(1800);
  });
  it('measures marginal CS and PS under the curves, not the wedge rectangles', () => {
    const r = sub(20);
    expect(r.marginalCS).toBeCloseTo(650);
    expect(r.marginalPS).toBeCloseTo(650);
    expect(r.DWL).toBeCloseTo(100);
    expect(r.overlapArea).toBeGreaterThan(0);
  });
  it.each([
    [{ demand: 140, supply: 20, slopeD: 1, slopeS: 1 }],
    [{ demand: 160, supply: 0, slopeD: 4 / 3, slopeS: 4 / 3 }],
    [{ demand: 120, supply: -40, slopeD: 0.5, slopeS: 3 }],
  ])('marginal CS + marginal PS + DWL = government spending (%o)', (m) => {
    const r = sub(15, m);
    expect(r.marginalCS + r.marginalPS + r.DWL).toBeCloseTo(r.govCost, 6);
  });
  it('collapses cleanly at a $0 subsidy', () => {
    const r = sub(0);
    expect(r.marginalCS).toBeCloseTo(0);
    expect(r.marginalPS).toBeCloseTo(0);
    expect(r.overlapArea).toBeCloseTo(0);
    [...r.marginalCsPoly, ...r.marginalPsPoly].flat().forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });
});
