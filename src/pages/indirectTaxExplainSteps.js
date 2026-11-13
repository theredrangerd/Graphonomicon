// The 20-step Explain walkthrough for the indirect tax page, grounded in a real tax: the UK's
// sugar levy (the Soft Drinks Industry Levy), 24p a litre on full-sugar drinks from April 2018.
// Only the 24p (and step 20's 20% VAT) are real; the curves are made up, and step 2 says so.
// Design and research: docs/superpowers/specs/2026-11-12-indirect-tax-explain-sugar-levy-design.md.
//
// The order follows where students get lost: why S2 is above S1 (and that up means supply has
// fallen); that the price rises by less than the tax (they guess first); that Pp is read off S1
// (they fit a 24p wedge between demand and S1 themselves); that the revenue box is the two
// burdens; and that the deadweight loss is nobody's. It ends on the exam diagram, then two ways
// into Play: elasticity, and an ad valorem tax (VAT).
//
// Each step's `layers` is the complete set drawn once it has played (a function of the context
// where it depends on what the student has done); `transient` layers are drawn only while the
// step's entry plays and leave as part of it; `enter` fades layers in, `grow` wipes them;
// `sequence` names the step's timing in pages.css ([data-seq]). Every number in the card is a
// coloured term (`t`) matching its mark on the chart, and each step's readout lists the same values.
//
// Context: { amount, result, free, dotQ, dotPos, explored, touched, prediction, revealed, rideT,
// wedgeQ, wedgeFit, wedgeTouched, sweepLow, sweepHigh } (see explainContext in indirect-tax.js).
import { fmtPence, fmtPounds, fmtLitres } from '../lib/format.js';

// The real levy, and Explain's slider (Play's tax slider is a separate, generic $ market).
export const LEVY = 24;
export const EXPLAIN_LEVY_MAX = 40;
export const VAT_RATE = 0.2;

// The draggable cost dot (step 3), as on the subsidy page: it starts at litre 75 (million) and
// Next unlocks once it reaches the halo at litre 42, TARGET_TOLERANCE either side.
export const LITRE_Q = 75;
export const DOT_Q_MIN = 3;
export const DOT_Q_MAX = 96;
export const TARGET_Q = 42;
export const TARGET_TOLERANCE = 4;
export const snapLitre = (q) => Math.min(DOT_Q_MAX, Math.max(DOT_Q_MIN, Math.round(q)));

// The wedge (step 9) starts left of Q_tax, where demand is more than the levy above S1, so its
// foot hangs above S1; it fits within WEDGE_TOLERANCE (million litres) of Q_tax.
export const WEDGE_START_Q = 25;
export const WEDGE_TOLERANCE = 2.5;
export const wedgeFits = (q, result) => Math.abs(q - result.Q) <= WEDGE_TOLERANCE;
// How far the wedge's foot is above S1 (negative: below it) at quantity q.
export const wedgeGap = (q, result, amount) => (result.Dmax - result.slopeD * q) - amount - (result.Smin + result.slopeS * q);

// Where step 19's "a third to a half" comes from: the study's authors (MRC Epidemiology Unit, Cambridge)
// summarising Scarborough et al., PLOS Medicine 2020 (verified 2026-11-12; see the spec).
export const PASS_THROUGH_SOURCE = 'https://www.epi.ims.cam.ac.uk/blog/2020/02/11/sugar-uk-soft-drinks-lowered-levy/';

// The units the chart's axes are named in, on every step.
export const AXES = { x: 'Quantity (millions of litres)', y: 'Price (pence per litre)' };

// A coloured word in the card that names a mark on the chart (same colour, same key).
const t = (key, text) => `<span class="term term--${key}" data-mark="${key}" tabindex="0">${text}</span>`;
const row = (label, value, mark) => ({ label, value, mark });
const govInk = (text) => `<span class="gov-ink">${text}</span>`;
const dwlInk = (text) => `<span class="dwl-ink">${text}</span>`;

const p = fmtPence;
const litres = (q) => `${fmtLitres(q)} litres`;
// Millions of litres as exactly as the card's sums need ("48.75m"), so height × width really gives the revenue shown.
const exactLitres = (q) => `${+q.toFixed(3)}m`;
const costAt = (result, q) => result.Smin + result.slopeS * q;
// The levy as a name: the real 24p, or the slider's amount with the real one beside it.
const levyName = (amount) => (amount === LEVY ? '24p' : `${p(amount)} (the real levy was 24p)`);

// Each side's share of a specific tax, to the tenth of a penny, so the two always add up to it.
export function shares({ amount, result }) {
  const consumer = Math.round((result.Pc - result.Pstar) * 10) / 10;
  return { consumer, producer: Math.round((amount - consumer) * 10) / 10 };
}

// The quantity S2 offers at the old price (step 6): fewer litres than S1 did.
const s2QtyAt = (result, price) => (price - (result.Smin + (result.Pc - result.Pp))) / result.slopeS;

const BASE = ['demand', 'supply', 'eq1'];
const S2ON = [...BASE, 'supply2'];
const AT_E2 = [...S2ON, 'eq2'];
const S1 = 'S1 = what it costs to make';
const S2 = 'S2 = cost + levy';
const s1s2 = { s1: S1, s2: S2 };
const LOST_NAMES = {
  lostLeft: 'Captured by the government (tax revenue)', lostRight: 'No longer traded',
  lostLeftNarrow: 'To the government', lostRightNarrow: 'Not traded',
};

export const TAX_STEPS = [
  {
    id: 'demand', headline: () => 'Demand',
    text: () => 'This is demand for sugary drinks: how many litres people want to buy at each price. The lower the price, the more they buy.',
    slider: false, tax: false, layers: ['demand'], enter: ['demand'],
  },
  {
    id: 'supply', headline: () => 'Supply: what it costs to make',
    text: ({ result }) => `This is supply, ${t('cost', 'S1')}: what it costs the drinks makers to make each extra litre. Where it meets demand is the market’s equilibrium, ${t('pe', 'e1')}: drinks sell for ${t('pe', `Pe = ${p(result.Pstar)}`)} a litre, and ${t('qe', litres(result.Qstar))} are sold. These numbers are made up to keep things simple; the tax you’re about to meet is real.`,
    slider: false, tax: false, layers: [...BASE, 'readout'], enter: ['supply', 'eq1', 'readout'],
    captions: ({ result }) => ({
      s1: S1,
      readout: [row('Market price (Pe)', p(result.Pstar), 'pe'), row('Litres sold (Qe)', fmtLitres(result.Qstar), 'qe')],
    }),
  },
  {
    id: 'cost of a litre', headline: () => 'Every point on S1 is one litre',
    // The conclusion waits until the student has dragged the dot to the halo: they find it first.
    text: ({ result, dotQ, explored }) => {
      const q = Math.round(dotQ);
      const found = explored ? ' The further along S1, the more the next litre costs to make: every point on S1 is a number of litres and what the last one costs.' : ' Drag it along S1.';
      return `This dot is litre number ${t('qty', `${q} million`)}. Making it costs ${t('cost', p(costAt(result, q)))}.${found}`;
    },
    think: ({ explored }) => (explored ? null : 'Drag the orange dot along S1 and put it in the halo.'),
    gate: ({ explored }) => explored,
    lockedLabel: 'Put the dot in the halo',
    textAfter: '.cost-dot', textDelay: 300, thinkDelay: 6100,
    drag: 'dot',
    slider: false, tax: false, layers: [...BASE, 'costDot'], enter: ['costDot'],
    chartOptions: ({ dotQ, dotPos = dotQ, explored }) => ({ dotQ: dotPos, dotTarget: TARGET_Q, dotTargetTolerance: TARGET_TOLERANCE, dotTargetReached: Boolean(explored) }),
    captions: ({ result, dotQ, touched, explored }) => {
      const q = Math.round(dotQ);
      const cost = p(costAt(result, q));
      return {
        s1: S1, dotLabel: `litre ${q}m: ${cost} to make`, dotCostTag: cost, dotQtyTag: `litre ${q}m`, dotAria: 'Litre on the supply curve',
        ...(!touched ? { dragHint: 'drag me' } : {}),
        ...(!explored ? { targetHint: 'put the dot here' } : {}),
      };
    },
  },
  {
    id: 'the levy', headline: ({ amount }) => `The levy: ${govInk(p(amount))} on every litre`,
    text: ({ amount, result, dotQ }) => {
      const q = Math.round(dotQ);
      const cost = costAt(result, q);
      return `In April 2018 the UK put a tax on sugary drinks: ${t('gov', levyName(amount))} on every litre, paid to the government by the drinks company. Litre ${t('qty', `${q} million`)} still costs ${t('cost', p(cost))} to make, so to keep what it made before, the company now needs ${t('need', p(cost + amount))} for it: its cost plus the levy.`;
    },
    slider: true, tax: 'specific', layers: [...BASE, 'loafDrop', 'readout'], enter: ['loafDrop', 'readout'],
    chartOptions: ({ dotQ }) => ({ loafQ: Math.round(dotQ) }),
    captions: ({ amount, result, dotQ }) => {
      const cost = costAt(result, Math.round(dotQ));
      return {
        s1: S1, loafCost: `${p(cost)} to make`, loafGov: `+ ${p(amount)} levy`, loafNeed: `needs ${p(cost + amount)}`,
        readout: [row('Cost to make', p(cost), 'cost'), row('Levy', `+ ${p(amount)}`, 'gov'), row('Company needs', p(cost + amount), 'need')],
      };
    },
  },
  {
    id: 'every litre', headline: ({ amount }) => `The same ${govInk(p(amount))} on every litre`,
    text: ({ amount }) => `Do the same for every litre: each one now needs ${t('gov', p(amount))} more. The points line up into a new line, ${t('need', 'S2')}: cost plus the levy. It’s ${t('gov', p(amount))} above S1 everywhere, so the two lines are parallel. ${t('cost', 'S1')}, now drawn dashed as the original supply curve, stays where it was: a litre costs exactly what it did to make.`,
    slider: true, tax: 'specific', layers: [...S2ON, 'loafDrop', 'loafDrops', 'readout'], enter: ['loafDrops', 'supply2', 'readout'],
    chartOptions: ({ dotQ }) => ({ loafQ: Math.round(dotQ), loafGuides: false }),
    captions: ({ amount, result, dotQ }) => {
      const cost = costAt(result, Math.round(dotQ));
      return {
        s1: 'S1', s2: S2, loafGov: `+ ${p(amount)} levy`, loafNeed: `needs ${p(cost + amount)}`,
        readout: [row('Levy, on every litre', `+ ${p(amount)}`, 'gov')],
      };
    },
  },
  {
    id: 'up is left', headline: ({ amount }) => `Up by ${p(amount)} is the same as left`,
    text: ({ amount, result }) => `Look along the old price, ${t('pe', p(result.Pstar))}. Before the levy, makers offered ${t('qe', litres(result.Qstar))} at that price. Now they need ${t('gov', p(amount))} more on every litre, so at ${p(result.Pstar)} they offer only ${t('need', litres(s2QtyAt(result, result.Pstar)))}. S2 is above S1, and it’s also to the left of it: supply has decreased.`,
    think: () => 'Before you click Next: where will S2 cross demand?',
    slider: true, tax: 'specific', layers: [...S2ON, 'shiftLeft', 'readout'], enter: ['shiftLeft', 'readout'],
    captions: ({ result }) => ({
      shiftLeft: `fewer litres at ${p(result.Pstar)}`, shiftLeftNarrow: 'fewer litres',
      readout: [row(`Offered at ${p(result.Pstar)} before`, fmtLitres(result.Qstar), 'qe'), row(`Offered at ${p(result.Pstar)} now`, fmtLitres(s2QtyAt(result, result.Pstar)), 'need')],
    }),
  },
  {
    // e2 and the new quantity, but not yet the new price: the next step asks for a guess first.
    id: 'equilibrium', headline: () => 'A new equilibrium, e2',
    text: ({ result }) => `S2 meets demand at ${t('qty', 'e2')}. Shoppers now buy ${t('qty', litres(result.Q))} (Q<sub>tax</sub>) instead of ${t('qe', fmtLitres(result.Qstar))}.`,
    slider: true, tax: 'specific', layers: [...AT_E2, 'rideNote', 'readout'], enter: ['eq2', 'rideNote', 'readout'],
    chartOptions: { rideT: 0 },
    captions: ({ result }) => ({
      rideNote: `Pe ${p(result.Pstar)}`,
      readout: [row('Litres before (Qe)', fmtLitres(result.Qstar), 'qe'), row('Litres now (Q tax)', fmtLitres(result.Q), 'qty')],
    }),
  },
  {
    // Predict, then reveal: the student commits to a guess, then the price note rides along demand
    // from e1 to e2 (counting up to Pc), and the gap to "all of it passed on" is drawn and named.
    id: 'guess', headline: ({ amount }) => `Will the price rise by the whole ${p(amount)}?`,
    text: (ctx) => {
      const { amount, result, prediction, revealed } = ctx;
      if (!prediction || !revealed) {
        return `Before the levy, shoppers paid ${t('pe', p(result.Pstar))} a litre. Now the drinks company hands the government ${t('gov', p(amount))} on every litre it sells. What do you think shoppers pay now?`;
      }
      const { consumer, producer } = shares(ctx);
      const opening = { all: 'Not quite: not all of it.', some: 'Yes: some of it, not all.', none: 'Not quite: the price does go up.' }[prediction];
      return `${opening} Shoppers now pay ${t('customer', `Pc = ${p(result.Pc)}`)}, where S2 meets demand: only ${t('customer', `${p(consumer)} more`)}, not ${p(amount)} more. The other ${t('pass', p(producer))} of the levy isn’t passed on to them.`;
    },
    predict: { options: [['all', 'All of it'], ['some', 'Some of it'], ['none', 'None of it']] },
    gate: ({ prediction, revealed }) => prediction != null && revealed,
    lockedLabel: 'Guess first',
    slider: ({ revealed }) => Boolean(revealed), tax: 'specific',
    layers: ({ revealed }) => [...AT_E2, 'rideNote', ...(revealed ? ['pricesCOnly', 'passFull', 'passGap'] : []), 'readout'],
    enter: ['readout'],
    // What the reveal brings in once the note has ridden to e2 (pages.css, [data-seq="pass"]).
    reveal: { enter: ['pricesC', 'passFull', 'passGap', 'readout'], sequence: 'pass' },
    chartOptions: ({ rideT }) => ({ rideT }),
    captions: (ctx) => {
      const { amount, result, rideT, revealed } = ctx;
      const q = result.Qstar + rideT * (result.Q - result.Qstar);
      const price = result.Dmax - result.slopeD * q;
      const { producer } = shares(ctx);
      // Pe on e1 before the guess, the bare price while it rides (it isn't Pe any more), Pc once it lands on e2.
      return {
        rideNote: rideT >= 1 ? `Pc ${p(result.Pc)}` : rideT > 0 ? p(price) : `Pe ${p(result.Pstar)}`,
        passFull: `if all ${p(amount)} were passed on: ${p(result.Pstar + amount)}`,
        passFullNarrow: `all ${p(amount)}: ${p(result.Pstar + amount)}`,
        passGap: `${p(producer)} not passed on`,
        readout: revealed
          ? [row('Shoppers paid (Pe)', p(result.Pstar), 'pe'), row('Shoppers pay now (Pc)', p(result.Pc), 'customer'), row('Levy', p(amount), 'gov')]
          : [row('Shoppers paid (Pe)', p(result.Pstar), 'pe'), row('Levy', p(amount), 'gov')],
      };
    },
  },
  {
    // MRU's wedge: the levy as a bar exactly the tax tall, which the student fits between demand
    // and S1 themselves. It only fits at Q_tax, and its foot gives Pp, read off S1.
    id: 'wedge', headline: () => 'One litre, two prices',
    text: (ctx) => {
      const { amount, result, wedgeFit } = ctx;
      if (!wedgeFit) {
        return `Here’s the levy as a wedge: a bar exactly ${t('gov', p(amount))} tall. Its top sits on demand, at the price shoppers pay; its foot is what the maker keeps. Where the foot is above ${t('cost', 'S1')}, the maker keeps more than that litre costs, so more litres would be made. Where it’s below S1, the maker keeps less than the litre costs, so it isn’t made. Drag the wedge along demand to where it just fits.`;
      }
      return `It only fits at ${t('qty', 'Q<sub>tax</sub>')}, right under e2: S2 was a way of finding this spot. The top is what shoppers pay, ${t('customer', `Pc = ${p(result.Pc)}`)}. The foot, on S1, is what the maker keeps, ${t('cost', `Pp = ${p(result.Pp)}`)}: the shoppers’ ${p(result.Pc)} minus the ${t('gov', p(amount))} levy.`;
    },
    think: ({ wedgeFit }) => (wedgeFit ? null : 'Drag the purple wedge along demand until its foot touches S1.'),
    gate: ({ wedgeFit }) => wedgeFit,
    lockedLabel: 'Fit the wedge',
    thinkDelay: 6000,
    drag: 'wedge',
    slider: true, tax: 'specific',
    layers: ({ wedgeFit }) => [...AT_E2, wedgeFit ? 'prices' : 'pricesCOnly', 'wedgeDrag', 'readout'],
    enter: ['wedgeDrag', 'readout'],
    // Until it fits, S2 and what it found (e2, Pc) step back, and demand and S1 are drawn bold.
    emphasis: ({ wedgeFit }) => (wedgeFit ? undefined : 'wedge'),
    // What fitting it brings in (pages.css, [data-seq="fit"]).
    reveal: { enter: ['prices', 'readout'], sequence: 'fit' },
    chartOptions: ({ wedgeQ, wedgeFit }) => ({ wedgeQ, wedgeFit }),
    captions: ({ amount, result, wedgeQ, wedgeFit, wedgeTouched }) => {
      const gap = wedgeGap(wedgeQ, result, amount);
      return {
        wedgeName: `${p(amount)} levy`, wedgeAria: `The ${p(amount)} levy as a wedge`,
        wedgeGap: gap > 0 ? `${p(gap)} to spare` : `${p(-gap)} short of S1`,
        wedgeTop: `shoppers pay ${p(result.Pc)}`, wedgeFoot: `the maker keeps ${p(result.Pp)}`,
        wedgeTopNarrow: p(result.Pc), wedgeFootNarrow: p(result.Pp),
        ...(!wedgeTouched ? { dragHint: 'drag me' } : {}),
        readout: wedgeFit
          ? [row('Shoppers pay (Pc)', p(result.Pc), 'customer'), row('Levy', `− ${p(amount)}`, 'gov'), row('Maker keeps (Pp)', p(result.Pp), 'cost')]
          : [row('The wedge (the levy)', p(amount), 'gov')],
      };
    },
  },
  {
    id: 'strips', headline: ({ amount }) => `${govInk(p(amount))} on every litre sold`,
    text: ({ amount }) => `The government gets ${t('gov', p(amount))} on every litre sold. Each thin strip is a million litres, ${t('gov', `${p(amount)} tall`)}: from Pp up to Pc. There’s one for ${t('gov', 'every million litres sold')}, all the way out to Q<sub>tax</sub>.`,
    slider: true, tax: 'specific',
    layers: [...AT_E2, 'prices', 'taxArrow', 'govStrips', 'taxHeight', 'qtyBracket', 'readout'],
    enter: ['govStrips', 'taxHeight', 'qtyBracket', 'readout'], grow: ['qtyBracket'], sequence: 'strips',
    captions: ({ amount, result }) => ({
      strip: `1m litres × ${p(amount)}`,
      taxHeight: `${p(amount)} levy`,
      qtyBracket: `${exactLitres(result.Q)} litres sold`,
      readout: [row('Levy per litre', p(amount), 'gov'), row('Litres sold (Q tax)', exactLitres(result.Q), 'qty')],
    }),
  },
  {
    id: 'revenue', headline: () => 'This box is the tax revenue',
    text: ({ amount, result }) => (amount <= 0
      ? `With no levy there’s no box: the government collects ${t('gov', '£0')}, and the market is back at Pe and Qe.`
      : `Height ${t('gov', `${p(amount)} a litre`)} × width ${t('gov', `${exactLitres(result.Q)} litres`)} = ${t('gov', fmtPounds(result.govRevenue))}. That’s exactly what the government collects, which is why this box is always the tax revenue.`),
    // Next is locked until the student has slid the levy to 0p and back up: the box goes and comes back.
    think: ({ sweepLow, sweepHigh }) => {
      if (sweepHigh) return 'Before you click Next: who really pays for this box, shoppers or the drinks company?';
      return sweepLow ? 'Now slide the levy back up to the top.' : 'See what happens to the box with a 0p levy.';
    },
    gate: ({ sweepHigh }) => Boolean(sweepHigh),
    lockedLabel: 'Slide the levy down, then up',
    sliderNote: ({ amount, sweepLow, sweepHigh }) => {
      if (sweepHigh) return 'The bigger the levy, the taller the box, but the fewer litres are sold.';
      return sweepLow && amount <= 0 ? 'No levy, no box: the market is back at Pe and Qe.' : '';
    },
    sliderHalo: ({ sweepLow, sweepHigh }) => (sweepHigh ? null : sweepLow ? 'max' : 'min'),
    // Leaving puts the levy back to the real 24p, so the numbers from here on are the UK's.
    resetAmountOnLeave: true,
    slider: true, tax: 'specific',
    layers: [...AT_E2, 'prices', 'taxArrow', 'govFill', 'wedgeBox', 'boxLabel', 'taxHeight', 'qtyBracket', 'readout'],
    transient: ['govStrips'],
    enter: ['govFill', 'wedgeBox', 'boxLabel', 'readout'], sequence: 'tax-box',
    captions: ({ amount, result }) => ({
      taxHeight: `${p(amount)} levy`,
      qtyBracket: `${exactLitres(result.Q)} litres sold`,
      box: `Tax revenue ${fmtPounds(result.govRevenue)}`, boxShort: fmtPounds(result.govRevenue),
      readout: [row('Height: levy per litre', p(amount), 'gov'), row('Width: litres sold', exactLitres(result.Q), 'gov'), row('Tax revenue', fmtPounds(result.govRevenue), 'gov')],
    }),
  },
  {
    id: 'burdens', headline: () => 'Who really pays for the box?',
    text: (ctx) => {
      const { amount } = ctx;
      const { consumer, producer } = shares(ctx);
      return `A tax’s burden is the part someone really pays. The box splits at the old price, Pe. Shoppers pay ${t('cb', `${p(consumer)} a litre`)} more (Pe up to Pc): the ${t('cb', 'consumer burden')} (CB). The company keeps ${t('pb', `${p(producer)} a litre`)} less (Pe down to Pp): the ${t('pb', 'producer burden')} (PB). ${p(consumer)} + ${p(producer)} = the whole ${t('gov', p(amount))}. So the company sends the government the money, but shoppers really pay ${p(consumer)} of every litre’s levy.`;
    },
    slider: true, tax: 'specific',
    layers: [...AT_E2, 'prices', 'taxConsumer', 'taxProducer', 'wedgeBox', 'readout'],
    enter: ['taxConsumer', 'taxProducer', 'readout'], grow: ['taxConsumer', 'taxProducer'], sequence: 'burdens',
    captions: (ctx) => {
      const { consumer, producer } = shares(ctx);
      return {
        cb: 'consumer burden', pb: 'producer burden',
        readout: [row('Shoppers pay', p(consumer), 'cb'), row('Company pays', p(producer), 'pb'), row('The levy', p(ctx.amount), 'gov')],
      };
    },
  },
  {
    // Back to the free market, the shoppers' side: what consumer surplus is, alone, so the next step can show it shrink.
    id: 'consumer surplus', headline: () => 'Consumer surplus before the levy',
    text: ({ result }) => `Consumer surplus is what buyers would have been willing to pay, but didn’t have to. Before the levy, everyone on demand above ${t('pe', p(result.Pstar))} gets some: together it’s the triangle between demand and the price, ${t('cs', fmtPounds(result.CS))}.`,
    slider: false, tax: false, layers: [...BASE, 'cs', 'readout'], enter: ['cs', 'readout'],
    captions: ({ result }) => ({
      s1: 'S1', cs: 'consumer surplus',
      readout: [row('Price paid (Pe)', p(result.Pstar), 'pe'), row('Consumer surplus', fmtPounds(result.CS), 'cs')],
    }),
  },
  {
    id: 'consumer', headline: () => 'The levy shrinks consumer surplus',
    text: ({ result, free }) => `The levy arrives: shoppers pay ${t('customer', p(result.Pc))} instead of ${t('pe', p(result.Pstar))}, so consumer surplus shrinks to the triangle above Pc, ${t('cs', fmtPounds(result.CS))} (it was ${fmtPounds(free.CS)}). The part it lost goes two ways. Over the litres still sold it’s ${t('cb', 'captured by the government')}: the consumer burden. Over the litres no longer sold it’s ${t('dwl', 'not traded at all')}: nobody gets it.`,
    slider: true, tax: 'specific',
    layers: [...AT_E2, 'pricesCOnly', 'cs', 'taxConsumer', 'dwlConsumer', 'lostNote', 'readout'],
    // The levy arrives again in order (arrows up, S2, e2, Pc), then the lost part of the old triangle goes grey,
    // is named, and takes its colours (pages.css, [data-seq="cs-shrinks"]).
    transient: ['loafDrops', 'csLost', 'lostConsumer'],
    enter: ['loafDrops', 'supply2', 'eq2', 'pricesC', 'lostConsumer', 'lostNote', 'taxConsumer', 'dwlConsumer', 'readout'],
    sequence: 'cs-shrinks', textAfter: 'line.wedge-line',
    chartOptions: { lostNotesAt: 'consumer-lens' },
    captions: ({ result }) => ({
      ...LOST_NAMES,
      readout: [row('Shoppers paid (Pe)', p(result.Pstar), 'pe'), row('Shoppers pay now (Pc)', p(result.Pc), 'customer'), row('Consumer surplus now', fmtPounds(result.CS), 'cs')],
    }),
  },
  {
    id: 'producer surplus', headline: () => 'Producer surplus before the levy',
    text: ({ result }) => `Producer surplus is what sellers get above what each litre cost them to make. Before the levy, every litre sells for ${t('pe', p(result.Pstar))}, and the gap down to S1 adds up to the triangle between the price and supply: ${t('ps', fmtPounds(result.PS))}.`,
    slider: false, tax: false, layers: [...BASE, 'ps', 'readout'], enter: ['ps', 'readout'],
    captions: ({ result }) => ({
      s1: 'S1', ps: 'producer surplus',
      readout: [row('Price received (Pe)', p(result.Pstar), 'pe'), row('Producer surplus', fmtPounds(result.PS), 'ps')],
    }),
  },
  {
    id: 'producer', headline: () => 'The levy shrinks producer surplus',
    text: ({ result, free }) => `The maker now keeps ${t('cost', p(result.Pp))} a litre instead of ${t('pe', p(result.Pstar))}: the shoppers’ ${p(result.Pc)} minus the levy. Producer surplus shrinks to the triangle below Pp, ${t('ps', fmtPounds(result.PS))} (it was ${fmtPounds(free.PS)}). Again the part it lost goes two ways: ${t('pb', 'captured by the government')} (the producer burden), and ${t('dwl', 'not traded at all')}.`,
    slider: true, tax: 'specific',
    layers: [...AT_E2, 'pricesPOnly', 'taxArrow', 'ps', 'taxProducer', 'dwlProducer', 'lostNote', 'readout'],
    transient: ['loafDrops', 'psLost', 'lostProducer'],
    enter: ['loafDrops', 'supply2', 'eq2', 'taxArrow', 'prices', 'lostProducer', 'lostNote', 'taxProducer', 'dwlProducer', 'readout'],
    sequence: 'ps-shrinks', textAfter: 'line.wedge-line',
    chartOptions: { lostNotesAt: 'producer-lens' },
    captions: ({ result }) => ({
      ...LOST_NAMES,
      readout: [row('Maker got (Pe)', p(result.Pstar), 'pe'), row('Maker keeps now (Pp)', p(result.Pp), 'cost'), row('Producer surplus now', fmtPounds(result.PS), 'ps')],
    }),
  },
  {
    id: 'deadweight loss', headline: () => `The corner nobody gets: ${dwlInk('deadweight loss')}`,
    text: ({ result }) => {
      const revenue = Math.round(result.govRevenue), dwl = Math.round(result.DWL);
      return `These ${t('dwl', `${exactLitres(result.Qstar - result.Q)} litres`)} were worth more to drinkers than they cost to make, so before the levy they were bought and sold. With the levy they aren’t, and nobody gets that value: it’s the ${t('dwl', `deadweight loss (DWL), ${fmtPounds(dwl)}`)}. Everything the levy took from shoppers and makers is the government’s ${t('gov', fmtPounds(revenue))} plus this ${t('dwl', fmtPounds(dwl))}.`;
    },
    slider: true, tax: 'specific',
    layers: [...AT_E2, 'prices', 'cs', 'ps', 'taxConsumer', 'taxProducer', 'dwl', 'wedgeBox', 'readout'],
    transient: ['dwlConsumer', 'dwlProducer'],
    enter: ['dwl', 'readout'], sequence: 'join-dwl',
    captions: ({ result }) => {
      const revenue = Math.round(result.govRevenue), dwl = Math.round(result.DWL);
      return {
        dwlName: 'DWL',
        readout: [
          row('Surplus lost (CS + PS)', fmtPounds(revenue + dwl), 'lost'),
          row('= tax revenue', fmtPounds(revenue), 'gov'),
          row('+ deadweight loss', fmtPounds(dwl), 'dwl'),
        ],
      };
    },
  },
  {
    id: 'wrap', headline: () => 'The full diagram',
    text: () => 'That’s the full diagram for a specific tax, the one you’d draw in an exam: S1 and S2, the prices Pe, Pc and Pp, the quantities Qe and Q<sub>tax</sub>, consumer surplus (CS), producer surplus (PS), the two burdens (together, the tax revenue) and the deadweight loss (DWL).',
    slider: true, tax: 'specific', layers: [], view: 'ib',
  },
  {
    id: 'elasticity', headline: () => 'Elasticity decides who pays',
    text: (ctx) => {
      const { consumer, producer } = shares(ctx);
      return `Now say drinkers can easily switch to diet drinks or water: demand is more elastic, so the curve is flatter. The price can’t rise much before people switch, so shoppers pay only ${t('cb', p(consumer))} of the ${t('gov', p(ctx.amount))} levy and the drinks company ${t('pb', p(producer))}. That fits what happened: when the UK levy started, <a href="${PASS_THROUGH_SOURCE}" target="_blank" rel="noopener noreferrer">studies found</a> only about a third to a half of it showed up in shop prices.`;
    },
    slider: true, tax: 'specific', demand: 'elastic', layers: [], view: 'ib',
    captions: (ctx) => {
      const { consumer, producer } = shares(ctx);
      return { readout: [row('Shoppers pay (CB)', p(consumer), 'cb'), row('Company pays (PB)', p(producer), 'pb'), row('The levy', p(ctx.amount), 'gov')] };
    },
    playLink: { label: 'Try elasticity in Play →', state: { play: 'elasticity' } },
  },
  {
    // An ad valorem tax, from the free market: arrows rise from S1, each 20% of the cost there, and S2 fans out
    // through their tips; then the exam diagram for it (pages.css, [data-seq="vat"]).
    id: 'vat', headline: () => 'A percentage tax: VAT',
    text: ({ result }) => `Sugary drinks also pay VAT: 20% on top of the price. To compare, take the levy off and put VAT on instead. Each arrow is 20% of what that litre costs, so the arrows get longer as the cost rises, and S2 fans out from S1 instead of running parallel. A tax that’s a percentage of the price is called ad valorem. Here shoppers pay ${t('customer', p(result.Pc))} and the maker keeps ${t('cost', p(result.Pp))}.`,
    slider: false, tax: 'advalorem', layers: [], view: 'ib',
    transient: ['loafDrops'], sequence: 'vat', enterAfterDemand: true, textAfter: '[data-layer="supply2"]',
    captions: ({ result }) => ({
      readout: (() => {
        const pc = Math.round(result.Pc * 10) / 10, pp = Math.round(result.Pp * 10) / 10;
        return [row('Shoppers pay (Pc)', p(pc), 'customer'), row('VAT, 20% of Pp', p(Math.round((pc - pp) * 10) / 10), 'gov'), row('Maker keeps (Pp)', p(pp), 'cost')];
      })(),
    }),
    finishLabel: 'Try ad valorem in Play →',
  },
];
