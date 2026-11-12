import { describe, it, expect } from 'vitest';
import { subsidyChain } from './subsidy.js';

const stages = (focus) => subsidyChain(focus).map((step) => step.stage);
const FOCUSES = ['gov', 'cs', 'ps', 'societal'];

// The chain-of-analysis rule (CLAUDE.md, North Star): every lens plays the subsidy's cause first,
// in Explain's order, and no mark arrives before the thing that causes it.
describe('subsidyChain', () => {
  it.each(FOCUSES)('%s opens with the arrows down S1, then S2, then e2', (focus) => {
    expect(stages(focus).slice(0, 3)).toEqual(['arrows', 'shift', 'e2']);
  });

  it.each(FOCUSES)('%s ends on the finished picture and starts at once', (focus) => {
    const chain = subsidyChain(focus);
    expect(chain.at(-1).stage).toBe('final');
    expect(chain[0].after).toBe(0);
  });

  it('draws the arrows before S2 and S2 before e2', () => {
    for (const focus of FOCUSES) {
      const [arrows, shift, e2] = subsidyChain(focus);
      expect(arrows.only).toContain('loafDrops');
      expect(arrows.only).not.toContain('supply2');
      expect(shift.only).toEqual(expect.arrayContaining(['loafDrops', 'supply2']));
      expect(shift.only).not.toContain('eq2');
      expect(e2.only).toContain('eq2');
    }
  });

  it('gives the consumer lens a beat where the price buyers face drops, before the band', () => {
    expect(stages('cs')).toEqual(['arrows', 'shift', 'e2', 'pc', 'final']);
    expect(subsidyChain('cs')[3].only).toContain('pricesCOnly');
    expect(subsidyChain('cs')[3].only).not.toContain('marginalCs');
  });

  it('gives the producer lens the arrow up to what the bakery receives, before the band', () => {
    expect(stages('ps')).toEqual(['arrows', 'shift', 'e2', 'received', 'final']);
    expect(subsidyChain('ps')[3].only).toEqual(expect.arrayContaining(['subsidyArrow', 'prices']));
    expect(subsidyChain('ps')[3].only).not.toContain('marginalPs');
  });

  it('builds the government lens as prices, strips, then the box, with no deadweight loss', () => {
    expect(stages('gov')).toEqual(['arrows', 'shift', 'e2', 'prices', 'strips', 'box', 'unlabel', 'final']);
    for (const step of subsidyChain('gov')) {
      expect(step.only ?? []).not.toContain('dwl');
      expect(step.add ?? []).not.toContain('dwl');
      expect(step.enter ?? []).not.toContain('dwl');
    }
    expect(subsidyChain('gov')[4].only).not.toContain('govFill');
  });

  it("keeps the societal lens's build-up after the shared opening and the two prices", () => {
    expect(stages('societal')).toEqual(['arrows', 'shift', 'e2', 'prices', 'strips', 'box', 'boxHold', 'mcs', 'mps', 'unknown', 'dwl', 'final']);
  });

  it('keeps the consumer and producer baseline triangles on screen while the arrows play', () => {
    expect(subsidyChain('cs')[0].only).toContain('csTriangle');
    expect(subsidyChain('ps')[0].only).toContain('psTriangle');
    expect(subsidyChain('gov')[0].only).not.toContain('csTriangle');
  });
});
