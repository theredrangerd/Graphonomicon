import { describe, it, expect } from 'vitest';
import { taxSocietyChain, taxSocietyNote } from './taxSociety.js';
import { replayOf } from '../lib/chain.js';
import { computeMarket } from '../lib/marketEngine.js';
import { fmtMoney } from '../lib/format.js';

const stages = () => taxSocietyChain().map((step) => step.stage);

// The chain-of-analysis rule (CLAUDE.md, North Star) for the tax: the cause first (arrows UP, S2 and e2 rising
// with them), then each party's loss carved out and named, then only what the tax did.
describe('taxSocietyChain', () => {
  it('opens with the shift, the arrows going up with S2 and e2 and the surplus shrinking, nothing entering', () => {
    const [shift] = taxSocietyChain();
    expect(shift.stage).toBe('shift');
    expect(shift.only).toEqual(expect.arrayContaining(['loafDrops', 'supply2', 'eq2', 'cs', 'ps']));
    // the grey gap appears as soon as the line is pushed up, growing as the surplus shrinks
    expect(shift.only).toEqual(expect.arrayContaining(['lostConsumer', 'lostProducer']));
    expect(shift.only).not.toContain('lostNote');
    expect(shift.only).not.toContain('prices');
    expect(shift.enter ?? []).toEqual([]);
    expect(shift.after).toBe(0);
  });

  it('greys the whole gap at once, then divides it: consumers\' half, then producers\'', () => {
    expect(stages()).toEqual(['shift', 'lost', 'cDivide', 'pDivide', 'tidy', 'final']);
    const [, lost, cDivide, pDivide] = taxSocietyChain();
    // both halves grey together, named, with no burden colour yet
    expect(lost.only).toEqual(expect.arrayContaining(['lostConsumer', 'lostProducer', 'lostNote']));
    expect(lost.only).not.toContain('taxConsumer');
    expect(lost.enter).not.toContain('lostConsumer'); // already there from the shift
    expect(lost.enter).toContain('lostNote');
    expect(lost.only).not.toContain('taxProducer');
    // consumers' half takes its colours while the producers' half is still grey (no white left behind)
    expect(cDivide.lens).toBe('consumer-lens');
    expect(cDivide.emphasis).toBe('consumers');
    expect(cDivide.only).toEqual(expect.arrayContaining(['taxConsumer', 'dwlConsumer', 'lostProducer']));
    expect(cDivide.exit).toContain('lostConsumer');
    expect(cDivide.exit).not.toContain('lostProducer');
    // then the producers'
    expect(pDivide.lens).toBe('producer-lens');
    expect(pDivide.emphasis).toBe('producers');
    expect(pDivide.only).toEqual(expect.arrayContaining(['taxConsumer', 'taxProducer', 'dwlProducer']));
    expect(pDivide.exit).toEqual(expect.arrayContaining(['lostProducer', 'lostNote']));
  });

  it('takes the arrows back out after the shift, and ends on the finished picture with the surplus gone', () => {
    const chain = taxSocietyChain();
    expect(chain[1].exit).toContain('loafDrops');
    expect(chain.at(-1).stage).toBe('final');
    const tidy = chain.find((s) => s.stage === 'tidy');
    expect(tidy.exit).toEqual(expect.arrayContaining(['cs', 'ps']));
  });

  it('replays without the arrows when a lens is picked with the tax already on', () => {
    const replay = replayOf(taxSocietyChain());
    expect(replay.map((s) => s.stage)).toEqual(stages());
    for (const step of replay) for (const list of [step.only, step.add, step.exit]) expect(list ?? []).not.toContain('loafDrops');
  });

  it('has words for each step, with the burdens and the loss from the market', () => {
    const result = computeMarket({ demand: 140, supply: 20, slopeD: 1, slopeS: 1, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    for (const stage of stages().filter((s) => s !== 'shift')) expect(taxSocietyNote(stage, result, fmtMoney)).toMatch(/<strong>/);
    expect(taxSocietyNote('shift', result, fmtMoney)).toBe('');
    expect(result.consumerIncidence).toBeGreaterThan(0);
    expect(taxSocietyNote('cDivide', result, fmtMoney)).toContain(fmtMoney(result.consumerIncidence));
    expect(taxSocietyNote('final', result, fmtMoney)).toContain(fmtMoney(result.DWL));
    expect(taxSocietyNote('final', result, fmtMoney)).toContain('no longer traded');
  });
});
