import { describe, it, expect } from 'vitest';
import { TAX_STEPS, LEVY, VAT_RATE, shares, wedgeFits, wedgeGap, WEDGE_START_Q } from './indirectTaxExplainSteps.js';
import { LAYERS } from '../lib/marketChart.js';
import { computeMarket } from '../lib/marketEngine.js';
import { explainMarket, EXPLAIN_DEMAND } from '../lib/explainRuntime.js';

// The real numbers each step is drawn with: Explain's market, the 24p levy (or 20% VAT).
const market = (kind = 'default') => explainMarket(EXPLAIN_DEMAND[kind]);
const levied = (amount = LEVY, kind = 'default') => computeMarket({ ...market(kind), intervention: { type: 'tax', mode: 'specific', amount } });
const free = (kind = 'default') => computeMarket({ ...market(kind), intervention: { type: 'none' } });
const ctxFor = (step, extra = {}) => {
  const kind = step.demand ?? 'default';
  const result = step.tax === 'advalorem' ? computeMarket({ ...market(kind), intervention: { type: 'tax', mode: 'advalorem', rate: VAT_RATE } })
    : step.tax ? levied(LEVY, kind) : free(kind);
  return {
    amount: LEVY, result, free: free(kind), dotQ: 45, dotPos: 45, explored: false, touched: false,
    prediction: null, revealed: false, rideT: 0, wedgeQ: WEDGE_START_Q, wedgeFit: false, wedgeTouched: false,
    sweepLow: false, sweepHigh: false, ...extra,
  };
};
const step = (id) => TAX_STEPS.find((s) => s.id === id);
const plain = (html) => html.replace(/<[^>]+>/g, '');
const layersOf = (s, extra) => (typeof s.layers === 'function' ? s.layers(ctxFor(s, extra)) : s.layers);

describe('TAX_STEPS', () => {
  it('has the 20 steps in order', () => {
    expect(TAX_STEPS.map((s) => s.id)).toEqual([
      'demand', 'supply', 'cost of a litre', 'the levy', 'every litre', 'up is left', 'equilibrium', 'guess', 'wedge',
      'strips', 'revenue', 'burdens', 'consumer surplus', 'consumer', 'producer surplus', 'producer', 'deadweight loss',
      'wrap', 'elasticity', 'vat']);
  });

  it('only names layers the chart knows, and only brings in layers the step draws', () => {
    const known = new Set([...LAYERS, 'pricesC']); // pricesC: the Pc line's own name inside the prices layers
    TAX_STEPS.forEach((s) => {
      for (const extra of [{}, { revealed: true, prediction: 'some', wedgeFit: true }]) {
        const drawn = new Set([...(layersOf(s, extra) ?? []), ...(s.transient ?? [])]);
        drawn.forEach((n) => expect(known).toContain(n));
        if (s.view === 'ib') continue;
        const pricesDrawn = ['prices', 'pricesCOnly', 'pricesPOnly'].some((n) => drawn.has(n));
        [...(s.enter ?? []), ...(s.grow ?? [])].forEach((n) => expect(drawn.has(n) || (n === 'pricesC' && pricesDrawn) || (n === 'prices' && pricesDrawn)).toBe(true));
      }
    });
  });

  // North Star test (a): no mark before the thing that causes it.
  it('brings each mark in only after its cause', () => {
    const first = (names, extra = {}) => TAX_STEPS.findIndex((s) => s.view !== 'ib' && (layersOf(s, extra) ?? []).some((n) => names.includes(n)));
    const at = (id) => TAX_STEPS.findIndex((s) => s.id === id);
    expect(first(['supply2'])).toBe(at('every litre')); // S2 comes from the arrows up, after the one litre's levy
    expect(first(['eq2'])).toBe(at('equilibrium'));
    // Before the guess is answered, no step draws the new price; once answered, the guess step does.
    expect(first(['pricesCOnly', 'prices'])).toBe(at('wedge'));
    expect(first(['pricesCOnly', 'prices'], { revealed: true, prediction: 'some' })).toBe(at('guess'));
    // Pp (read off S1) only once the wedge fits.
    expect(layersOf(step('wedge'))).not.toContain('prices');
    expect(layersOf(step('wedge'), { wedgeFit: true })).toContain('prices');
    expect(first(['govStrips'])).toBe(at('strips'));
    expect(first(['govFill', 'wedgeBox'])).toBe(at('revenue'));
    expect(first(['taxConsumer', 'taxProducer'])).toBe(at('burdens'));
    expect(first(['dwl', 'dwlConsumer', 'dwlProducer'])).toBe(at('consumer'));
  });

  it('starts in the free market and ends on exam diagrams, the last two with a way into Play', () => {
    ['demand', 'supply', 'cost of a litre', 'consumer surplus', 'producer surplus'].forEach((id) => expect(step(id).tax).toBe(false));
    expect(TAX_STEPS.slice(-3).every((s) => s.view === 'ib')).toBe(true);
    expect(step('elasticity').demand).toBe('elastic');
    expect(step('elasticity').playLink.label).toBe('Try elasticity in Play →');
    expect(step('vat').tax).toBe('advalorem');
    expect(step('vat').finishLabel).toBe('Try ad valorem in Play →');
  });

  it('splits the 24p into 12p + 12p at the defaults, and the shares always add up to the levy', () => {
    expect(shares({ amount: 24, result: levied() })).toEqual({ consumer: 12, producer: 12 });
    const elastic = shares({ amount: 24, result: levied(24, 'elastic') });
    expect(elastic.consumer + elastic.producer).toBeCloseTo(24);
    expect(elastic.consumer).toBeCloseTo(8, 0); // about a third, as the UK studies found
    const odd = shares({ amount: 17, result: levied(17) });
    expect(odd.consumer + odd.producer).toBeCloseTo(17);
  });

  it('says the made-up numbers are made up, and names the real levy', () => {
    expect(plain(step('supply').text(ctxFor(step('supply'))))).toContain('made up');
    expect(plain(step('the levy').text(ctxFor(step('the levy'))))).toContain('In April 2018 the UK put a tax on sugary drinks: 24p on every litre');
    expect(plain(step('the levy').text(ctxFor(step('the levy'), { amount: 30 })))).toContain('30p (the real levy was 24p)');
  });

  it('reads the market off the live result: S2 offers 42m litres at 80p, Q tax is 51m', () => {
    expect(plain(step('up is left').text(ctxFor(step('up is left'))))).toContain('they offer only 42m litres');
    expect(plain(step('equilibrium').text(ctxFor(step('equilibrium'))))).toContain('51m litres');
    // e2's price stays out of the equilibrium step: the next one asks for a guess first.
    expect(plain(step('equilibrium').text(ctxFor(step('equilibrium'))))).not.toContain('92p');
  });

  it('asks before it answers, then answers the guess that was made', () => {
    const guess = step('guess');
    expect(guess.gate(ctxFor(guess))).toBe(false);
    expect(plain(guess.text(ctxFor(guess)))).not.toContain('92p');
    const answered = (prediction) => plain(guess.text(ctxFor(guess, { prediction, revealed: true, rideT: 1 })));
    expect(answered('some')).toMatch(/^Yes: some of it/);
    expect(answered('all')).toMatch(/^Not quite: not all of it/);
    expect(answered('none')).toMatch(/^Not quite: the price does go up/);
    expect(answered('some')).toContain('Pc = 92p');
    expect(answered('some')).toContain('only 12p more');
    expect(guess.gate(ctxFor(guess, { prediction: 'all', revealed: true }))).toBe(true);
    const caps = guess.captions(ctxFor(guess, { prediction: 'some', revealed: true, rideT: 1 }));
    expect(caps.passFull).toBe('if all 24p were passed on: £1.04');
    expect(caps.passGap).toBe('12p not passed on');
    expect(caps.rideNote).toBe('Pc 92p');
  });

  it('fits the wedge only at Q tax, with its foot on S1', () => {
    const r = levied();
    expect(wedgeGap(WEDGE_START_Q, r, 24)).toBeGreaterThan(0); // starts with its foot above S1
    expect(wedgeGap(r.Q, r, 24)).toBeCloseTo(0);
    expect(wedgeFits(WEDGE_START_Q, r)).toBe(false);
    expect(wedgeFits(r.Q + 2, r)).toBe(true);
    const fitted = plain(step('wedge').text(ctxFor(step('wedge'), { wedgeFit: true })));
    expect(fitted).toContain('Pc = 92p');
    expect(fitted).toContain('Pp = 68p');
    expect(step('wedge').emphasis(ctxFor(step('wedge')))).toBe('wedge');
    expect(step('wedge').emphasis(ctxFor(step('wedge'), { wedgeFit: true }))).toBeUndefined();
  });

  it('builds the revenue box from its sides, and the sums add up to the penny', () => {
    expect(plain(step('revenue').text(ctxFor(step('revenue'))))).toContain('Height 24p a litre × width 51m litres = £12.24m');
    expect(step('revenue').gate(ctxFor(step('revenue'), { sweepLow: true }))).toBe(false);
    expect(step('revenue').gate(ctxFor(step('revenue'), { sweepLow: true, sweepHigh: true }))).toBe(true);
    expect(plain(step('burdens').text(ctxFor(step('burdens'))))).toContain('12p + 12p = the whole 24p');
    const rows = step('deadweight loss').captions(ctxFor(step('deadweight loss'))).readout.map((r) => r.value);
    expect(rows).toEqual(['£13.32m', '£12.24m', '£1.08m']);
  });

  it('tells the elasticity story with the elastic curve’s numbers, and VAT with its own', () => {
    const el = plain(step('elasticity').text(ctxFor(step('elasticity'))));
    expect(el).toContain('shoppers pay only 8p of the 24p levy and the drinks company 16p');
    expect(el).toContain('about a third to a half');
    const vat = plain(step('vat').text(ctxFor(step('vat'))));
    expect(vat).toContain('shoppers pay 87.3p and the maker keeps 72.7p');
  });

  // Review 2026-11-12, finding 1: the card's height × width must give the revenue it shows, at every levy.
  it('multiplies out on the revenue step at every levy the slider allows', () => {
    for (let amount = 1; amount <= 40; amount++) {
      const ctx = { ...ctxFor(step('revenue')), amount, result: levied(amount) };
      const [, h, w, total] = plain(step('revenue').text(ctx)).match(/Height (\d+)p a litre × width ([\d.]+)m litres = £([\d.]+)m/);
      expect(Math.round(+h * +w) / 100).toBeCloseTo(+total, 2);
    }
  });

  // Review 2026-11-12, finding 4: the riding note is never called Pe once it has left e1.
  it('names the riding price Pe only on e1 and Pc only on e2', () => {
    const caps = (rideT) => step('guess').captions(ctxFor(step('guess'), { prediction: 'some', rideT })).rideNote;
    expect(caps(0)).toBe('Pe 80p');
    expect(caps(0.5)).toMatch(/^\d+(\.\d)?p$/);
    expect(caps(1)).toBe('Pc 92p');
  });

  // Review 2026-11-12, finding 6: the exam-diagram steps that quote numbers give them in a readout.
  it('gives steps 19 and 20 a readout with the numbers their words use', () => {
    const el = step('elasticity').captions(ctxFor(step('elasticity'))).readout.map((r) => r.value);
    expect(el).toEqual(['8p', '16p', '24p']);
    const vat = step('vat').captions(ctxFor(step('vat'))).readout.map((r) => r.value);
    // Re-review 2026-11-13, finding 1: the rows subtract exactly (87.3 − 14.6 = 72.7).
    expect(vat).toEqual(['87.3p', '14.6p', '72.7p']);
    const [pc, vatAmount, pp] = vat.map((v) => parseFloat(v));
    expect(Math.round((pc - vatAmount) * 10) / 10).toBe(pp);
  });
});
