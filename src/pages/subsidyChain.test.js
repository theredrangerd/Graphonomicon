import { describe, it, expect } from 'vitest';
import { subsidyChain, replayOf } from './subsidy.js';

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

  it('plays the society lens as the box, then each party\'s surplus growing by its marginal band, then only the bands, then the DWL', () => {
    expect(stages('societal')).toEqual(['shift', 'box', 'cs', 'mcs', 'ps', 'mps', 'tidy', 'leftover', 'final']);
    const [, box, cs, mcs, ps, mps, tidy, leftover] = subsidyChain('societal');
    expect(box.only).toEqual(expect.arrayContaining(['govFill', 'wedgeBox']));
    expect(box.only).not.toContain('csTriangle');
    // consumers: the old triangle first, then the marginal band, with everything else ghosted
    expect(cs.only).toContain('csTriangle');
    expect(cs.only).not.toContain('marginalCs');
    expect(mcs.only).toEqual(expect.arrayContaining(['csTriangle', 'marginalCs']));
    expect([cs.emphasis, mcs.emphasis]).toEqual(['consumers', 'consumers']);
    expect([cs.lens, mcs.lens]).toEqual(['cs', 'cs']);
    // producers: the same
    expect(ps.only).toContain('psTriangle');
    expect(ps.only).not.toContain('marginalPs');
    expect(mps.only).toEqual(expect.arrayContaining(['psTriangle', 'marginalPs']));
    expect([ps.emphasis, mps.emphasis]).toEqual(['producers', 'producers']);
    // only after both marginal bands are shown do the old triangles go; the DWL comes last
    expect(tidy.exit).toEqual(expect.arrayContaining(['csTriangle', 'psTriangle']));
    expect(tidy.only).toEqual(expect.arrayContaining(['marginalCs', 'marginalPs']));
    expect(tidy.only).not.toContain('dwl');
    expect(tidy.exit).toContain('govFill');
    expect(leftover.only).not.toContain('govFill');
    expect(leftover.only).not.toContain('csTriangle');
    expect(leftover.enter).toContain('dwl');
    expect(leftover.only).toContain('focusChip'); // chips, not plain text, name the bands and the loss
    expect(leftover.lens).toBe('societal');
  });

  it('keeps the consumer and producer baseline triangles on screen during the shift', () => {
    expect(subsidyChain('cs')[0].only).toContain('csTriangle');
    expect(subsidyChain('ps')[0].only).toContain('psTriangle');
    expect(subsidyChain('gov')[0].only).not.toContain('csTriangle');
  });

  it.each(FOCUSES)('%s: picking the lens with the subsidy already on replays it without the arrows', (focus) => {
    const chain = subsidyChain(focus);
    const replay = replayOf(chain);
    expect(replay.map((s) => s.stage)).toEqual(chain.map((s) => s.stage));
    for (const step of replay) {
      for (const list of [step.only, step.add, step.exit]) expect(list ?? []).not.toContain('loafDrops');
    }
    expect(replay[1].after).toBe(300);
    expect(replay[0].only).toEqual(expect.arrayContaining(['supply2', 'eq2']));
  });

  it('has nothing to replay for the exam diagram (no lens)', () => {
    expect(subsidyChain(null)).toEqual([]);
    expect(replayOf(subsidyChain(null))).toEqual([]);
  });
});
