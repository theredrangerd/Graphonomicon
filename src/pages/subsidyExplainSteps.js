// The 19-step Explain walkthrough for the subsidy page. Each step's `layers` is the complete
// set drawn at that step (not a diff); `enter` lists the layers that fade in on it.
//
// The order follows the three places students get lost (owner, 2026-11-09):
//   1. why S2 is *below* S1: drag a dot along S1 to see each point is one loaf and its cost,
//      watch the government's $X come down off that loaf, then every loaf;
//   2. why there are two prices: what the customer pays, the government's part on top, = Pp;
//   3. why the box is government spending: one $X strip per loaf sold, lined up into the box,
//      height × width. Only then do the surplus bands appear, as where that money goes.
// The words and the chart are tied together: every number in the text is a coloured term
// (`term`) whose colour and `data-mark` key match the mark it names on the chart, and each
// step's readout (top-right of the chart) lists the same values in the same colours.
// Research notes behind it: docs/superpowers/specs/2026-11-09-subsidy-explain-pedagogy-design.md.
//
// Context each step's functions get: { amount, result, dotQ, dotPos, explored, touched, armed,
// sweepLow, sweepHigh } (see explainContext in subsidy.js).
import { fmtMoney as fmtWhole } from '../lib/format.js';

// Dollars, with cents only when there are some ($637.50, but $80), so every sum on screen
// adds up exactly: mCS + mPS + DWL really is the government's total, Pc + subsidy is Pp.
const fmtMoney = (v) => {
  const cents = Math.round(v * 100);
  return cents % 100 === 0 ? fmtWhole(cents / 100)
    : '$' + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Where the draggable dot starts: loaf 75, the point (75, $100) on S1, with a "drag me" hint.
export const LOAF_Q = 75;
// The dot's travel: it stays a little inside both ends of the axis.
export const DOT_Q_MIN = 3;
export const DOT_Q_MAX = 96;
// The halo the student is asked to bring the dot to: loaf 42 on S1 ($56), well down the curve
// from where the dot starts. Next unlocks once the dot has reached it.
export const TARGET_Q = 42;
// How close (in loaves, either side) counts as in the halo. The chart draws the halo this big,
// so "the dot is in the circle" and "Next unlocks" are the same thing.
export const TARGET_TOLERANCE = 4;
// The dot moves a whole loaf at a time (a loaf is a unit, so no fractions; the cost shown may
// carry cents, e.g. loaf 43 is $57.33).
export const LOAF_STEP = 1;
export const snapLoaf = (q) => Math.min(DOT_Q_MAX, Math.max(DOT_Q_MIN, Math.round(q / LOAF_STEP) * LOAF_STEP));

// The revenue step asks the student to slide the subsidy down to $0 and back up to the top of
// the slider (a halo marks the end to go to). Progress is kept once earned, like the dot's.
// "The top" counts within SWEEP_REACH of the slider's max, so a step short of it still counts.
export const SWEEP_REACH = 1;
export function advanceSweep(sweep, amount, { min, max }) {
  const low = Boolean(sweep.low) || amount <= min;
  const high = Boolean(sweep.high) || (low && amount >= max - SWEEP_REACH);
  return { low, high };
}

// Loaves are counted, so show whole numbers bare and halves with one decimal.
const loaves = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

// A coloured word in the card that names a mark on the chart (same colour, same key).
const t = (key, text) => `<span class="term term--${key}" data-mark="${key}" tabindex="0">${text}</span>`;
const row = (label, value, mark) => ({ label, value, mark });
// A government figure in a headline: the subsidy arrow's purple, very dark (purple means government).
const govInk = (text) => `<span class="gov-ink">${text}</span>`;
// Deadweight loss in a headline: the DWL red, very dark.
const dwlInk = (text) => `<span class="dwl-ink">${text}</span>`;

const BASE = ['demand', 'supply', 'eq1'];
const WITH_S2 = [...BASE, 'supply2'];
const AT_E2 = [...WITH_S2, 'eq2'];
const PRICED = [...AT_E2, 'prices'];
const BOXED = [...PRICED, 'wedgeBox'];

const S1 = 'S1 = what it costs to make';
const S2 = 'S2 = what customers need to pay';
const s1s2 = { s1: S1, s2: S2 };
// From the two-prices step on, students know what S1 and S2 mean, and the chart is busier
// (brackets, arrow, labels), so those steps leave the curves as plain S1/S2.

// The two marginal bands' names, wherever they're drawn.
const BANDS = { mcs: 'marginal CS', mps: 'marginal PS' };
// The subsidy arrow's chip, on the steps that turn it on.
const arrowChip = (amount) => ({ arrow: `${fmtMoney(amount)} from gov` });

const costAt = (result, q) => result.Smin + result.slopeS * q;

// The loaf the drop step follows: the one the student left the dot on, nudged right if
// needed so the government's share never takes the customer's price below $0.
export function loafQ({ amount, result, dotQ = LOAF_Q }) {
  const lowest = Math.ceil((amount - result.Smin) / result.slopeS / LOAF_STEP) * LOAF_STEP;
  return Math.min(DOT_Q_MAX, Math.max(snapLoaf(dotQ), lowest));
}

function oneLoaf(ctx) {
  const q = loafQ(ctx);
  const cost = costAt(ctx.result, q);
  return { q, cost, customer: cost - ctx.amount };
}

// The followed loaf's three labels: what it costs, the government's part, the customer's.
function loafCaptions(ctx) {
  const { cost, customer } = oneLoaf(ctx);
  return {
    loafCost: `${fmtMoney(cost)} to bake`,
    loafGov: `${fmtMoney(ctx.amount)} from government`,
    loafCustomer: `${fmtMoney(customer)} from customer`,
  };
}

// How the government's box is shared out: the bakery's and customers' bands.
const shareRows = (result) => [
  row('Bakery’s share', fmtMoney(result.marginalPS), 'mps'),
  row('Customers’ share', fmtMoney(result.marginalCS), 'mcs'),
];

export const SUBSIDY_STEPS = [
  {
    id: 'demand', headline: () => 'Demand',
    text: () => 'This is demand: how many loaves people want to buy at each price. Lower price, more loaves.',
    slider: false, subsidy: false, layers: ['demand'], enter: ['demand'],
  },
  {
    id: 'supply', headline: () => 'Supply: what it costs to bake',
    text: ({ result }) => `This is supply, ${t('cost', 'S1')}: what it costs the bakery to bake each extra loaf. Where it meets demand is the market: loaves sell for ${t('pe', `Pe = ${fmtMoney(result.Pstar)}`)}, and ${t('qe', `${loaves(result.Qstar)} loaves`)} are sold.`,
    slider: false, subsidy: false, layers: [...BASE, 'readout'], enter: ['supply', 'eq1', 'readout'],
    captions: ({ result }) => ({
      s1: S1,
      readout: [row('Market price (Pe)', fmtMoney(result.Pstar), 'pe'), row('Loaves sold (Qe)', loaves(result.Qstar), 'qe')],
    }),
  },
  {
    id: 'cost of a loaf', headline: () => 'Every point on S1 is one loaf',
    text: ({ result, dotQ }) => {
      const q = Math.round(dotQ);
      return `The dot is loaf number ${t('qty', q)}. Baking it costs the bakery ${t('cost', fmtMoney(costAt(result, q)))}. Drag it along S1: the more loaves the bakery bakes, the more the next one costs.`;
    },
    think: ({ explored }) => (explored
      ? 'Every point on S1 works like this: a number of loaves, and what the last one costs to bake.'
      : 'Drag the orange dot along S1 and put it in the halo.'),
    gate: ({ explored }) => explored,
    lockedLabel: 'Put the dot in the halo',
    // Order: headline at once, the dot seeps in, then the words, then the "drag me" hint and the
    // halo together (pages.css times them). The instruction waits to see if the student needs it.
    textAfter: '.cost-dot', textDelay: 300, thinkDelay: 6100,
    drag: true,
    slider: false, subsidy: false, layers: [...BASE, 'costDot'], enter: ['costDot'],
    // The dot is drawn where it actually is (it glides and follows the pointer smoothly);
    // the words name the whole loaf it's nearest (dotQ).
    chartOptions: ({ dotQ, dotPos = dotQ, explored }) => ({ dotQ: dotPos, dotTarget: TARGET_Q, dotTargetTolerance: TARGET_TOLERANCE, dotTargetReached: Boolean(explored) }),
    captions: ({ result, dotQ, touched, explored }) => {
      const q = Math.round(dotQ);
      const cost = fmtMoney(costAt(result, q));
      return {
        s1: S1, dotLabel: `loaf ${q}: ${cost} to bake`, dotCostTag: cost, dotQtyTag: `loaf ${q}`,
        // Until the student first takes the dot.
        ...(!touched ? { dragHint: 'drag me' } : {}),
        ...(!explored ? { targetHint: 'put the dot here' } : {}),
      };
    },
  },
  {
    id: 'one loaf', headline: ({ amount }) => `The government pays ${govInk(fmtMoney(amount))} of every loaf`,
    text: (ctx) => {
      const { q, cost, customer } = oneLoaf(ctx);
      // Owner's wording (2026-11-09), including the emphasised IB phrasing at the end.
      return `Loaf ${t('qty', q)} still costs ${t('cost', fmtMoney(cost))} to bake. The government now pays ${t('gov', fmtMoney(ctx.amount))} of it, so the bakery only needs ${t('customer', fmtMoney(customer))} from the customer to make the same amount of money. This means the bakery can offer consumers prices ${t('gov', fmtMoney(ctx.amount))} lower because <em>its cost of production is lesser by the amount of the subsidy</em>.`;
    },
    // The student presses Subsidise! on the dot to bring the drop in (the page holds the arrow, the
    // labels and the readout back until then); Next stays locked until they have.
    trigger: true,
    gate: ({ armed }) => !armed,
    lockedLabel: 'Press Subsidise!',
    slider: true, subsidy: true, layers: [...BASE, 'loafDrop', 'readout'], enter: ['loafDrop', 'readout'],
    chartOptions: (ctx) => ({ loafQ: loafQ(ctx) }),
    captions: (ctx) => {
      const { cost, customer } = oneLoaf(ctx);
      return {
        s1: S1,
        ...loafCaptions(ctx),
        readout: [
          row('Cost to bake', fmtMoney(cost), 'cost'),
          row('Government pays', fmtMoney(ctx.amount), 'gov'),
          row('Customer pays', fmtMoney(customer), 'customer'),
        ],
      };
    },
  },
  {
    id: 'every loaf', headline: () => 'The cost drops by the same amount at every point on S1',
    text: ({ amount }) => `Do the same for every loaf: each one drops by ${t('gov', fmtMoney(amount))}, so the points line up into a new line, ${t('customer', 'S2')}: what customers now need to pay. ${t('cost', 'S1')} stays where it was, because baking costs exactly what it did.`,
    think: () => 'Before you click Next: where will S2 cross demand?',
    // The student's loaf from the step before stays exactly as it was, arrow and all; the other
    // loaves' arrows draw in around it, and S2 follows.
    slider: true, subsidy: true, layers: [...WITH_S2, 'loafDrop', 'loafDrops', 'readout'], enter: ['loafDrops', 'supply2'],
    // Just the arrow, dots and labels: the dashed guides have done their job.
    chartOptions: (ctx) => ({ loafQ: loafQ(ctx), loafGuides: false }),
    captions: (ctx) => ({
      ...s1s2,
      ...loafCaptions(ctx),
      readout: [row('Government pays, every loaf', fmtMoney(ctx.amount), 'gov')],
    }),
  },
  {
    id: 'equilibrium', headline: () => 'A new equilibrium, e2',
    text: ({ result }) => `S2 meets demand at ${t('qty', 'e2')}. Customers now buy ${t('qty', `${loaves(result.Q)} loaves`)} (Q<sub>subsidy</sub>) instead of ${t('qe', loaves(result.Qstar))}, because each one costs them less.`,
    slider: true, subsidy: true, layers: [...AT_E2, 'readout'], enter: ['eq2', 'readout'],
    captions: ({ result }) => ({
      ...s1s2,
      readout: [row('Loaves before (Qe)', loaves(result.Qstar), 'qe'), row('Loaves now (Q subsidy)', loaves(result.Q), 'qty')],
    }),
  },
  {
    id: 'two prices', headline: () => 'One loaf, two prices',
    text: ({ amount, result }) => `Customers pay ${t('customer', `Pc = ${fmtMoney(result.Pc)}`)}: read it off demand. The government adds ${t('gov', fmtMoney(amount))} on top, so the bakery receives ${t('cost', `Pp = ${fmtMoney(result.Pp)}`)}, back up on S1.`,
    think: ({ amount }) => `The government pays ${fmtMoney(amount)} on every loaf sold. How much does it pay altogether?`,
    slider: true, subsidy: true, layers: [...PRICED, 'priceBrackets', 'subsidyArrow', 'readout'], enter: ['prices', 'priceBrackets', 'readout'],
    // Next doesn't cut straight to the revenue step: first the customer's and government's
    // figures, Pc, the arrow and the readout fade, while the two coloured brackets stay and
    // "bakery gets" swells (see onLeave in subsidy.js).
    leave: { exit: ['priceBrackets', 'pricesC', 'subsidyArrow', 'readout'], ms: 1150 },
    captions: ({ amount, result }) => ({
      customer: `customer pays ${fmtMoney(result.Pc)}`,
      gov: `+ ${fmtMoney(amount)} government`,
      total: `bakery gets ${fmtMoney(result.Pp)}`,
      readout: [
        row('Customer pays (Pc)', fmtMoney(result.Pc), 'customer'),
        row('Government adds', `+ ${fmtMoney(amount)}`, 'gov'),
        row('Bakery receives (Pp)', fmtMoney(result.Pp), 'cost'),
      ],
    }),
  },
  {
    // Area as revenue: the idea the box and the bands in the next steps lean on. Built slowly:
    // the height (price) rises, the width (quantity) sweeps across, the rectangle fills in,
    // then it is named. The bakery's revenue is Pp × Q (what it receives per loaf, times loaves).
    id: 'revenue', headline: () => 'Revenue is an area: P × Q = R',
    text: ({ result }) => `Revenue is ${t('cost', 'price')} × ${t('qty', 'quantity')}: what a seller takes in. On a graph, that’s an area: height is the price, width is the quantity. The bakery gets ${t('cost', `${fmtMoney(result.Pp)} a loaf`)} and sells ${t('qty', `${loaves(result.Q)} loaves`)}, so its revenue is ${t('cost', fmtMoney(result.Pp * result.Q))}.`,
    // Next is locked until the student has slid the subsidy to $0 and back up: while the
    // government's part disappears and returns, the rectangle shows who pays for what.
    think: ({ sweepLow, sweepHigh }) => {
      if (sweepHigh) return 'Before you click Next: how much of this rectangle do customers pay, and how much does the government?';
      return sweepLow ? 'Now slide the subsidy back up to the top.' : 'See what happens when the government gives a $0 subsidy per unit.';
    },
    gate: ({ sweepHigh }) => Boolean(sweepHigh),
    lockedLabel: 'Slide the subsidy down, then up',
    // A line under the slider that answers the student's move: at $0 it names what they're
    // looking at; once they've been back to the top it points at the bakery's gain.
    sliderNote: ({ amount, sweepLow, sweepHigh }) => {
      if (sweepHigh) return 'Think about how much more money the producer gets.';
      return sweepLow && amount <= 0 ? 'This is what the market looks like with no subsidy.' : '';
    },
    sliderHalo: ({ sweepLow, sweepHigh }) => (sweepHigh ? null : sweepLow ? 'max' : 'min'),
    // Pp only: the bakery's side of the story. Pc comes back with the strips, which need it.
    // The two-prices brackets carry over with no figures (blue = customer, purple = government):
    // their colours hint at the answer to the question above. "Bakery gets" stays as the anchor.
    slider: true, subsidy: true, layers: [...AT_E2, 'pricesPOnly', 'priceBrackets', 'revenueDims', 'revenueBox', 'readout'], enter: ['revenueDims', 'revenueBox', 'readout'],
    captions: ({ result }) => {
      const revenue = fmtMoney(result.Pp * result.Q);
      return {
        total: `bakery gets ${fmtMoney(result.Pp)}`,
        totalBig: true, // the size step 7's exit swelled it to
        revPrice: `price ${fmtMoney(result.Pp)}`,
        revQty: `quantity ${loaves(result.Q)}`,
        revBox: `Revenue = ${fmtMoney(result.Pp)} × ${loaves(result.Q)} = ${revenue}`,
        revBoxShort: `Revenue ${revenue}`,
        readout: [
          row('Price (Pp)', fmtMoney(result.Pp), 'cost'),
          row('Quantity (Q subsidy)', loaves(result.Q), 'qty'),
          row('Revenue = price × quantity', revenue, 'cost'),
        ],
      };
    },
  },
  {
    id: 'strips', headline: ({ amount }) => `${govInk(fmtMoney(amount))} on every loaf sold`,
    text: ({ amount }) => `Each thin strip is one loaf: ${t('gov', `${fmtMoney(amount)} tall`)}, from Pc up to Pp, paid by the government. There’s one strip for ${t('qty', 'every loaf sold')}, all the way out to Q<sub>subsidy</sub>.`,
    slider: true, subsidy: true, layers: [...PRICED, 'govStrips', 'readout'], enter: ['govStrips', 'readout'],
    fadeIn: ['pricesC'], // Pc, left out of the revenue step, comes back as the strips' floor
    captions: ({ amount, result }) => ({
      strip: `1 loaf: ${fmtMoney(amount)}`,
      readout: [row('Government pays per loaf', fmtMoney(amount), 'gov'), row('Loaves sold', loaves(result.Q), 'qty')],
    }),
  },
  {
    id: 'government', headline: () => 'This box is government spending',
    text: ({ amount, result }) => `Height ${t('gov', `${fmtMoney(amount)} per loaf`)} × width ${t('qty', `${loaves(result.Q)} loaves`)} = ${t('gov', fmtMoney(result.govCost))}. That’s exactly the government’s bill, which is why this box is always government spending.`,
    slider: true, subsidy: true, layers: [...BOXED, 'govFill', 'subsidyBracket', 'boxWidth', 'boxLabel', 'readout'],
    enter: ['wedgeBox', 'subsidyBracket', 'boxWidth', 'boxLabel', 'readout'],
    captions: ({ amount, result }) => ({
      bracket: `${fmtMoney(amount)} per loaf`,
      width: `${loaves(result.Q)} loaves`,
      box: `Government spending ${fmtMoney(result.govCost)}`,
      boxShort: `Gov ${fmtMoney(result.govCost)}`,
      readout: [
        row('Height: per loaf', fmtMoney(amount), 'gov'),
        row('Width: loaves sold', loaves(result.Q), 'qty'),
        row('Government spending', fmtMoney(result.govCost), 'gov'),
      ],
    }),
  },
  {
    // Back to the customers' side, before the subsidy: what consumer surplus is, with nothing
    // else on the chart, so the next step can show it growing.
    id: 'consumer surplus', headline: () => 'Consumer surplus before the subsidy',
    text: ({ result }) => `With no subsidy, customers pay ${t('pe', fmtMoney(result.Pstar))} a loaf. Everyone whose demand sits above that price would have been willing to pay more, and the gap is their ${t('cs', 'consumer surplus')}: the triangle between demand and the price, worth ${t('cs', fmtMoney(result.CS))}.`,
    slider: false, subsidy: false, layers: [...BASE, 'cs', 'readout'], enter: ['cs', 'readout'],
    captions: ({ result }) => ({
      cs: 'consumer surplus',
      readout: [row('Price paid (Pe)', fmtMoney(result.Pstar), 'pe'), row('Consumer surplus', fmtMoney(result.CS), 'cs')],
    }),
  },
  {
    id: 'consumer', headline: () => 'The subsidy grows consumer surplus',
    text: ({ result }) => `Customers now pay ${t('customer', fmtMoney(result.Pc))} a loaf instead of ${t('pe', fmtMoney(result.Pstar))}: ${t('customer', `${fmtMoney(result.Pstar - result.Pc)} less`)}. Their consumer surplus now reaches down to Pc, so it gains this extra band: ${t('mcs', 'marginal consumer surplus')}.`,
    slider: true, subsidy: true, layers: [...AT_E2, 'pricesCOnly', 'csTriangle', 'marginalCs', 'loafDrops', 'readout'],
    // The subsidy arrives in order: an arrow drops from S1 at every loaf and S2 fades in at their
    // tips (S1 doesn't move; the cost is what falls), the arrows clear, e2 appears, the Pc line is
    // drawn out from e2, then the extra band fills in (the `cs-grows` sequence in pages.css).
    enter: ['loafDrops', 'supply2', 'eq2', 'marginalCs', 'readout'], fadeIn: ['pricesC'],
    chartOptions: { sequence: 'cs-grows' },
    captions: ({ result }) => ({
      cs: 'CS before',
      mcs: BANDS.mcs,
      readout: [
        row('Customers paid (Pe)', fmtMoney(result.Pstar), 'pe'),
        row('Customers pay now (Pc)', fmtMoney(result.Pc), 'customer'),
        row('Saved per loaf', fmtMoney(result.Pstar - result.Pc), 'customer'),
      ],
    }),
  },
  {
    // The mirror of "consumer surplus before the subsidy": back to the free market, now the bakery's side.
    id: 'producer surplus', headline: () => 'Producer surplus before the subsidy',
    text: ({ result }) => `With no subsidy, the bakery gets ${t('pe', fmtMoney(result.Pstar))} a loaf. Every loaf it could have baked for less than that earns it a little extra, and the gap is its ${t('ps', 'producer surplus')}: the triangle between the price and supply, worth ${t('ps', fmtMoney(result.PS))}.`,
    slider: false, subsidy: false, layers: [...BASE, 'ps', 'readout'], enter: ['ps', 'readout'],
    captions: ({ result }) => ({
      ps: 'producer surplus',
      readout: [row('Price received (Pe)', fmtMoney(result.Pstar), 'pe'), row('Producer surplus', fmtMoney(result.PS), 'ps')],
    }),
  },
  {
    id: 'producer', headline: () => 'The subsidy grows producer surplus',
    text: ({ result }) => `The bakery now gets ${t('cost', fmtMoney(result.Pp))} a loaf instead of ${t('pe', fmtMoney(result.Pstar))}: ${t('cost', `${fmtMoney(result.Pp - result.Pstar)} more`)}. Its producer surplus now reaches up to Pp, so it gains this extra band: ${t('mps', 'marginal producer surplus')}.`,
    slider: true, subsidy: true, layers: [...AT_E2, 'subsidyArrow', 'pricesPOnly', 'psTriangle', 'marginalPs', 'loafDrops', 'readout'],
    // Arrives like the customers' step: arrows drop from S1 at every loaf and S2 fades in, the arrows
    // clear, e2 appears, then an arrow lifts from e2 up to S1, the Pp line is drawn out from its tip,
    // and the extra band fills up (the `ps-grows` sequence in pages.css).
    enter: ['loafDrops', 'supply2', 'eq2', 'subsidyArrow', 'marginalPs', 'readout'], fadeIn: ['prices'],
    // The arrow carries its amount (Explain turns the chip off by default).
    chartOptions: { sequence: 'ps-grows', arrowChip: true },
    captions: ({ amount, result }) => ({
      ...arrowChip(amount),
      ps: 'PS before',
      mps: BANDS.mps,
      readout: [
        row('Bakery got (Pe)', fmtMoney(result.Pstar), 'pe'),
        row('Bakery gets now (Pp)', fmtMoney(result.Pp), 'cost'),
        row('Extra per loaf', `+ ${fmtMoney(result.Pp - result.Pstar)}`, 'cost'),
      ],
    }),
  },
  {
    // Both sides on one diagram, so the next step's box doesn't arrive with two bands out of nowhere.
    // Per loaf, the customers' saving and the bakery's gain add up to the subsidy, and the two bands
    // are those two pieces stacked at Pe. The blue half arrives to meet the orange one (`join` in pages.css).
    id: 'both sides', headline: () => 'Both sides together',
    text: ({ amount, result }) => `Put the two sides together. On every loaf, customers save ${t('mcs', fmtMoney(result.Pstar - result.Pc))} and the bakery gains ${t('mps', fmtMoney(result.Pp - result.Pstar))}. Add them up and you get ${t('gov', fmtMoney(amount))}, exactly what the government pays per loaf. That’s why the two bands stack, meeting at the old price, Pe.`,
    slider: true, subsidy: true, layers: [...AT_E2, 'prices', 'subsidyArrow', 'csTriangle', 'psTriangle', 'marginalPs', 'marginalCs', 'readout'],
    enter: ['csTriangle', 'marginalCs', 'readout'], fadeIn: ['pricesC'],
    chartOptions: { sequence: 'join', arrowChip: true },
    captions: ({ amount, result }) => ({
      ...arrowChip(amount),
      ps: 'PS before',
      cs: 'CS before',
      ...BANDS,
      readout: [
        row('Customers save, per loaf', fmtMoney(result.Pstar - result.Pc), 'mcs'),
        row('Bakery gains, per loaf', fmtMoney(result.Pp - result.Pstar), 'mps'),
        row('Government pays, per loaf', fmtMoney(amount), 'gov'),
      ],
    }),
  },
  {
    // Back to the government's box: most of it lands with the bakery and customers, but the corner on
    // the right is still empty. Step 16 says why.
    id: 'box shares', headline: () => 'Back to the box: who gets the money?',
    text: ({ result }) => `Here’s the ${t('gov', 'government’s box')} again. Most of it lands with real people: ${t('mps', `${fmtMoney(result.marginalPS)} to the bakery`)} and ${t('mcs', `${fmtMoney(result.marginalCS)} to customers`)}. But the triangle in the right-hand corner of the box, past Q<sub>e</sub>, hasn’t gone to anybody yet.`,
    think: () => 'Before you click Next: who benefits from the loaves in that empty corner?',
    slider: true, subsidy: true, layers: [...BOXED, 'marginalPs', 'marginalCs', 'dwlUnknown', 'readout'],
    // Step 15 already drew both bands, so only the box is new: re-fading the rest would flash the
    // whole diagram. The triangles ("PS/CS before") drop out here, and the box's outline is a firmer
    // government purple, and the empty corner is grey with a "?" (`box` in pages.css) so it's clear what we're splitting up.
    enter: ['wedgeBox', 'dwlUnknown'], chartOptions: { sequence: 'box' },
    captions: ({ result }) => ({
      ...BANDS,
      readout: [...shareRows(result), row('Government spending', fmtMoney(result.govCost), 'gov')],
    }),
  },
  {
    id: 'deadweight loss', headline: () => `The corner nobody gets: ${dwlInk('deadweight loss')}`,
    text: ({ result }) => `That corner sits above ${t('customer', 'demand')} and below ${t('cost', 'S1')}: each loaf here costs more to bake than customers think it’s worth, so with no subsidy nobody would trade them. The government’s money pushes them through anyway, and nobody gets a benefit to match: ${t('dwl', `deadweight loss, ${fmtMoney(result.DWL)}`)}. ${t('mps', 'Bakery’s share')} + ${t('mcs', 'customers’ share')} + ${t('dwl', 'deadweight loss')} = the whole ${t('gov', fmtMoney(result.govCost))}.`,
    slider: true, subsidy: true, layers: [...BOXED, 'marginalPs', 'marginalCs', 'dwlUnknown', 'dwl', 'readout'], enter: ['dwl', 'readout'],
    captions: ({ result }) => ({
      ...BANDS,
      readout: [
        ...shareRows(result),
        row('Deadweight loss', fmtMoney(result.DWL), 'dwl'),
        row('Total: government spending', fmtMoney(result.govCost), 'gov'),
      ],
    }),
  },
  {
    id: 'wrap', headline: () => 'The full diagram',
    text: () => 'That’s the full subsidy diagram, the one you’d draw in an exam. The dashed box is still government spending: the bakery’s share, the customers’ share and the deadweight loss.',
    slider: true, subsidy: true, layers: [], view: 'ib',
  },
  {
    // The last word: the same diagram with an inelastic demand curve (it tweens steeper, pivoting
    // through e1), so the customers' band swells and the bakery's shrinks, then a push to Play.
    id: 'inelastic', headline: () => 'What if demand is inelastic?',
    text: ({ result }) => `Say people need this bread and keep buying whatever it costs: demand is inelastic, so the curve is steeper. Now the subsidy pulls the customers’ price down further: ${t('mcs', 'customers’ share')} grows to ${t('mcs', fmtMoney(result.marginalCS))} while ${t('mps', 'the bakery’s share')} shrinks to ${t('mps', fmtMoney(result.marginalPS))}. Head to Play, flatten and steepen the curves yourself, and see who captures more of the subsidy.`,
    slider: true, subsidy: true, demand: 'inelastic', layers: [], view: 'ib', finish: true,
  },
];
