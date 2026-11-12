// The indirect tax's Society lens ("who bears the tax"): the subsidy's chain in reverse, then each party's surplus
// carved out in turn. Purple arrows go UP from S1 and S2 and e2 rise with them (the toggle's tween) while the
// consumer and producer surplus shrink; then, for consumers and for producers in turn, everything else ghosts back
// and the surplus they lost is shown in grey, named (what the government collects / no longer traded), and recoloured
// into its burden band and its half of the deadweight loss; then the leftover surplus fades, the two halves of the
// loss join into one triangle, and the chips give the figures. See CLAUDE.md, "Chain of analysis".

export const SHIFT_MS = 1000; // the arrows go up and S2 and e2 slide with them (the toggle's tween, same length)
// The step after the shift waits for the toggle's tween to finish: a tween frame landing after it would re-render
// without the step's `enter` and cut its animation short.
export const TWEEN_SETTLE_MS = 150;

const BASE = ['demand', 'supply', 'eq1'];

export function taxSocietyChain() {
  const shifted = [...BASE, 'supply2', 'eq2'];
  const surplus = ['cs', 'ps'];
  const priced = [...shifted, 'prices'];
  const shift = { stage: 'shift', only: [...shifted, ...surplus, 'loafDrops'], after: 0 };
  const thenLeave = (step) => ({ ...step, only: [...step.only, 'loafDrops'], exit: [...(step.exit ?? []), 'loafDrops'], after: SHIFT_MS + TWEEN_SETTLE_MS });
  // Each party: the surplus they lost, grey and named; then split into its burden band and its half of the loss.
  const base = [...priced, ...surplus];
  const consumerLost = ['lost', 'lostNote'];
  return [
    shift,
    thenLeave({ stage: 'cLost', lens: 'consumer-lens', emphasis: 'consumers', only: [...base, ...consumerLost], enter: ['pricesC', 'prices', 'lost', 'lostNote'] }),
    { stage: 'cBurden', lens: 'consumer-lens', emphasis: 'consumers', only: [...base, ...consumerLost, 'taxConsumer', 'dwlConsumer', 'focusChip'], enter: ['taxConsumer', 'dwlConsumer', 'focusChip'], exit: consumerLost, after: 1800 },
    { stage: 'pLost', lens: 'producer-lens', emphasis: 'producers', only: [...base, 'taxConsumer', 'dwlConsumer', ...consumerLost], enter: ['lost', 'lostNote'], after: 1400 },
    { stage: 'pBurden', lens: 'producer-lens', emphasis: 'producers', only: [...base, 'taxConsumer', 'dwlConsumer', ...consumerLost, 'taxProducer', 'dwlProducer', 'focusChip'], enter: ['taxProducer', 'dwlProducer', 'focusChip'], exit: consumerLost, after: 1800 },
    // The leftover surplus and its chips fade together, leaving the two burden bands and the two halves of the loss.
    { stage: 'tidy', lens: 'producer-lens', only: [...base, 'taxConsumer', 'taxProducer', 'dwlConsumer', 'dwlProducer', 'focusChip'], exit: [...surplus, 'focusChip'], after: 1400 },
    // The finished picture: the burdens (together the revenue box), the one deadweight-loss triangle, and their chips.
    { stage: 'final', lens: 'societal', enter: ['focusChip'], after: 1000 },
  ];
}

// The words under the chart for each step.
export function taxSocietyNote(stage, result, fmtMoney) {
  const lostC = result.consumerIncidence + result.DWLConsumer;
  const lostP = result.producerIncidence + result.DWLProducer;
  if (stage === 'shift') return '';
  if (stage === 'cLost') return `<strong>Consumers lose ${fmtMoney(lostC)} of surplus.</strong> The grey area was theirs before the tax.`;
  if (stage === 'cBurden') return `<strong>Consumer burden: ${fmtMoney(result.consumerIncidence)}.</strong> Buyers now pay more on every unit still sold, and the government collects it. The rest, ${fmtMoney(result.DWLConsumer)}, is trade that no longer happens.`;
  if (stage === 'pLost') return `<strong>Producers lose ${fmtMoney(lostP)} of surplus.</strong> The grey area was theirs before the tax.`;
  if (stage === 'pBurden') return `<strong>Producer burden: ${fmtMoney(result.producerIncidence)}.</strong> Sellers now keep less on every unit still sold, and the government collects it. The rest, ${fmtMoney(result.DWLProducer)}, is trade that no longer happens.`;
  if (stage === 'tidy') return `<strong>Only the burdens and the lost trades are the tax's doing.</strong> The surplus left over was there anyway.`;
  return `<strong>Deadweight loss: ${fmtMoney(result.DWL)}.</strong> These units are no longer traded: buyers value them more than they cost to make, but with the tax on top neither side will do the deal. The two burdens are not lost; they become tax revenue.`;
}
