import { describe, it, expect } from 'vitest';
import { subsidyChain } from './subsidy.js';

const stages = (focus) => subsidyChain(focus).map((step) => step.stage);
const FOCUSES = ['gov', 'cs', 'ps', 'societal'];

// The chain-of-analysis rule (CLAUDE.md, North Star): every lens plays the subsidy's cause first,
// and no mark arrives before the thing that causes it.
describe('subsidyChain', () => {
  it.each(FOCUSES)('%s opens with the shift: arrows, S2 and e2 moving together, nothing entering', (focus) => {
    const [shift] = subsidyChain(focus);
    expect(shift.stage).toBe('shift');
    expect(shift.only).toEqual(expect.arrayContaining(['loafDrops', 'supply2', 'eq2']));
    expect(shift.only).not.toContain('prices');
    expect(shift.enter ?? []).toEqual([]);
    expect(shift.after).toBe(0);
  });

  it('carries the Pc line with e2 during the consumer and producer shifts, and not on the others', () => {
    expect(subsidyChain('cs')[0].only).toContain('pricesCOnly');
    expect(subsidyChain('ps')[0].only).toContain('pricesCOnly');
    expect(subsidyChain('gov')[0].only).not.toContain('pricesCOnly');
    expect(subsidyChain('societal')[0].only).not.toContain('pricesCOnly');
  });

  it.each(FOCUSES)('%s ends on the finished picture and takes the arrows back out after the shift', (focus) => {
    const chain = subsidyChain(focus);
    expect(chain.at(-1).stage).toBe('final');
    expect(chain[1].exit).toContain('loafDrops');
    expect([...(chain[1].only ?? []), ...(chain[1].add ?? [])]).toContain('loafDrops');
  });

  it('gives the consumer lens nothing between the shift and its band', () => {
    expect(stages('cs')).toEqual(['shift', 'final']);
    expect(subsidyChain('cs')[1].enter).toEqual(expect.arrayContaining(['marginalCs']));
  });

  it('gives the producer lens the arrow up to what the bakery receives, before the band', () => {
    expect(stages('ps')).toEqual(['shift', 'received', 'final']);
    expect(subsidyChain('ps')[1].only).toEqual(expect.arrayContaining(['subsidyArrow', 'prices']));
    expect(subsidyChain('ps')[1].only).not.toContain('marginalPs');
  });

  it('builds the government lens as Pc, the arrow up to what the bakery receives with its Pp line, strips, then the box, with no deadweight loss', () => {
    expect(stages('gov')).toEqual(['shift', 'pc', 'received', 'strips', 'box', 'unlabel', 'final']);
    for (const step of subsidyChain('gov')) {
      expect(step.only ?? []).not.toContain('dwl');
      expect(step.add ?? []).not.toContain('dwl');
      expect(step.enter ?? []).not.toContain('dwl');
    }
    expect(subsidyChain('gov')[1].only).not.toContain('subsidyArrow');
    expect(subsidyChain('gov')[2].only).toEqual(expect.arrayContaining(['subsidyArrow', 'prices']));
    expect(subsidyChain('gov')[3].only).not.toContain('govFill');
  });

  it('plays the society lens quickly: the box, then consumers\' share, producers\' share, and what is left as deadweight loss', () => {
    expect(stages('societal')).toEqual(['shift', 'box', 'consumers', 'producers', 'leftover', 'final']);
    const [, box, consumers, producers, leftover] = subsidyChain('societal');
    expect(box.only).toEqual(expect.arrayContaining(['govFill', 'wedgeBox']));
    expect(box.only).not.toContain('marginalCs');
    expect(consumers.only).toContain('marginalCs');
    expect(consumers.only).not.toContain('marginalPs');
    expect(consumers.emphasis).toBe('demand');
    expect(producers.only).toEqual(expect.arrayContaining(['marginalCs', 'marginalPs']));
    expect(producers.only).not.toContain('dwl');
    expect(producers.emphasis).toBe('supply');
    expect(leftover.enter).toContain('dwl');
    expect(leftover.exit).toContain('govFill');
  });

  it('keeps the consumer and producer baseline triangles on screen during the shift', () => {
    expect(subsidyChain('cs')[0].only).toContain('csTriangle');
    expect(subsidyChain('ps')[0].only).toContain('psTriangle');
    expect(subsidyChain('gov')[0].only).not.toContain('csTriangle');
  });
});
