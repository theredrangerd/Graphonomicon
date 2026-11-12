// A Play "chain of analysis" is a list of steps, each drawn when the one before has been held for its `after` ms.
// (See subsidy.js `subsidyChain` and taxSociety.js `taxSocietyChain`.)

const without = (names, drop) => names?.filter((name) => name !== drop);

// The chain for a lens picked while the intervention is already on: the curves have already shifted, so there are no
// arrows to show. The shifted picture comes up at once, then the lens's own steps follow shortly after.
export function replayOf(chain) {
  if (!chain.length) return []; // no lens (the exam diagram) has no chain
  const bare = (step) => ({ ...step, only: without(step.only, 'loafDrops'), add: without(step.add, 'loafDrops'), exit: without(step.exit, 'loafDrops') });
  const [shifted, ...rest] = chain.map(bare);
  return rest.length ? [shifted, { ...rest[0], after: 300 }, ...rest.slice(1)] : [shifted];
}
