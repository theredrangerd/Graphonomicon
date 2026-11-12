// The indirect tax's Society lens ("who bears the tax"): the subsidy's chain in reverse, then each party's surplus
// carved out in turn. Purple arrows go UP from S1 and S2 and e2 rise with them (the toggle's tween) while the
// consumer and producer surplus shrink; then the whole gap the tax opened goes grey at once, named (what the
// government collects / no longer traded), and each party's half in turn is recoloured into its burden band and its
// half of the deadweight loss (everything else ghosting back); then the leftover surplus fades, the two halves of the
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
  // The grey gap is drawn from the first frame of the tween, growing exactly as the surplus shrinks, so it appears
  // the moment the line is pushed up.
  const grey = ['lostConsumer', 'lostProducer'];
  // The tax per unit as a bracket outside the y axis (Pp to Pc), growing with the tax, so what the grey is from is
  // clear from the start. It sits in the margin the page reserves, so it never moves the plot.
  const bracket = ['taxHeight'];
  const shift = { stage: 'shift', only: [...shifted, ...surplus, ...grey, ...bracket, 'loafDrops'], after: 0 };
  const thenLeave = (step) => ({ ...step, only: [...step.only, 'loafDrops'], exit: [...(step.exit ?? []), 'loafDrops'], after: SHIFT_MS + TWEEN_SETTLE_MS });
  // The whole gap the tax opened goes grey at once (no white left between the two halves), split at Qtax into what
  // the government collects and what is no longer traded; then each party's half takes its own colours in turn.
  const base = [...priced, ...surplus, ...bracket];
  const lost = [...grey, 'lostNote'];
  return [
    shift,
    thenLeave({ stage: 'lost', lens: 'societal', only: [...base, ...lost], enter: ['pricesC', 'prices', 'lostNote'] }), // the gap is already grey; now the lines and its names
    { stage: 'cDivide', lens: 'consumer-lens', emphasis: 'consumers', only: [...base, ...lost, 'taxConsumer', 'dwlConsumer', 'focusChip'], enter: ['taxConsumer', 'dwlConsumer', 'focusChip'], exit: ['lostConsumer'], after: 2200 },
    { stage: 'pDivide', lens: 'producer-lens', emphasis: 'producers', only: [...base, 'taxConsumer', 'dwlConsumer', 'lostProducer', 'lostNote', 'taxProducer', 'dwlProducer', 'focusChip'], enter: ['taxProducer', 'dwlProducer', 'focusChip'], exit: ['lostProducer', 'lostNote'], after: 1700 },
    // The leftover surplus and its chips fade together, leaving the two burden bands and the two halves of the loss.
    { stage: 'tidy', lens: 'producer-lens', only: [...base, 'taxConsumer', 'taxProducer', 'dwlConsumer', 'dwlProducer', 'focusChip'], exit: [...surplus, 'focusChip'], after: 1800 },
    // The finished picture: the burdens (together the revenue box), the one deadweight-loss triangle, and their chips.
    { stage: 'final', lens: 'societal', enter: ['focusChip'], after: 1000 },
  ];
}

// The words under the chart for each step.
export function taxSocietyNote(stage, result, fmtMoney) {
  const lostC = result.consumerIncidence + result.DWLConsumer;
  const lostP = result.producerIncidence + result.DWLProducer;
  if (stage === 'shift') return '';
  if (stage === 'lost') return `<strong>${fmtMoney(lostC + lostP)} of surplus is lost.</strong> Left of the line, the government collects it as tax revenue. Right of it, those trades no longer happen.`;
  if (stage === 'cDivide') return `<strong>Consumer burden: ${fmtMoney(result.consumerIncidence)}.</strong> The upper half of the grey is consumers': buyers now pay more on every unit still sold, and the government collects it. The rest, ${fmtMoney(result.DWLConsumer)}, is trade that no longer happens.`;
  if (stage === 'pDivide') return `<strong>Producer burden: ${fmtMoney(result.producerIncidence)}.</strong> The lower half is producers': sellers now keep less on every unit still sold, and the government collects it. The rest, ${fmtMoney(result.DWLProducer)}, is trade that no longer happens.`;
  if (stage === 'tidy') return `<strong>Only the burdens and the lost trades are the tax's doing.</strong> The surplus left over was there anyway.`;
  return `<strong>Deadweight loss: ${fmtMoney(result.DWL)}.</strong> These units are no longer traded: buyers value them more than they cost to make, but with the tax on top neither side will do the deal. The two burdens are not lost; they become tax revenue.`;
}
