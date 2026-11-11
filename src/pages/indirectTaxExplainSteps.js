// The 12-step Explain walkthrough for the indirect tax page: a specific tax on cans of soft
// drink. Each step's `layers` is the complete set drawn at that step (not a diff); `enter`
// lists the layers that fade in on it and `grow` the ones that wipe in. `demand: 'inelastic'`
// swaps in the steeper demand curve (the page tweens to it).
import { fmtMoney, fmtQty } from '../lib/format.js';

const L1 = ['demand'];
const L2 = [...L1, 'supply', 'eq1'];
const L3 = [...L2, 'supply2', 'taxBracket'];
const L4 = [...L3, 'eq2'];
const L5 = [...L4, 'prices'];
const L6 = [...L5.filter((n) => n !== 'taxBracket'), 'taxConsumer'];
const L7 = [...L6, 'taxProducer'];
const L8 = [...L7, 'wedgeBox'];
const L9 = [...L8, 'cs', 'ps'];
const L10 = [...L9, 'dwl'];

const S1 = 'S1 = what it costs to make';
const S2 = 'S2 = cost + tax';

const s1Only = () => ({ s1: S1 });
const s1s2 = () => ({ s1: S1, s2: S2 });
const withBracket = ({ amount }) => ({ s1: S1, s2: S2, bracket: `${fmtMoney(amount)} tax per can` });

// Per-can shares of the tax, rounded to whole dollars so the two always add up to the tax.
function shares({ amount, result }) {
  const consumer = Math.round(result.Pc - result.Pstar);
  return { consumer: fmtMoney(consumer), producer: fmtMoney(amount - consumer) };
}

export const TAX_STEPS = [
  {
    id: 'demand', headline: () => 'Demand',
    text: () => 'This is demand: how many cans of soft drink people want to buy at each price. Lower price, more cans.',
    slider: false, tax: false, layers: L1, enter: ['demand'],
  },
  {
    id: 'supply', headline: () => 'Supply',
    text: () => 'This is supply: what it costs the drinks company to make each extra can. Where it meets demand is the market price, Pe.',
    slider: false, tax: false, layers: L2, enter: ['supply', 'eq1'], captions: s1Only,
  },
  {
    id: 'tax', headline: () => 'The tax is added to the cost of every can',
    text: ({ amount }) => `The company must pay the government ${fmtMoney(amount)} for each can it sells, so it now needs ${fmtMoney(amount)} more from each customer. That’s S2: S1 plus the tax.`,
    slider: true, tax: true, layers: L3, enter: ['supply2', 'taxBracket'], captions: withBracket,
  },
  {
    id: 'equilibrium', headline: () => 'A new equilibrium',
    text: ({ result }) => `Fewer cans are sold, Q<sub>tax</sub> (${fmtQty(result.Q)}) instead of Qe, because customers face a higher price.`,
    slider: true, tax: true, layers: L4, enter: ['eq2'], captions: withBracket,
  },
  {
    id: 'prices', headline: () => 'Two prices',
    text: ({ amount }) => `Customers pay Pc. The company keeps Pp: what the customer pays, minus the ${fmtMoney(amount)} it hands to the government.`,
    slider: true, tax: true, layers: L5, enter: ['prices'], captions: withBracket,
  },
  {
    id: 'consumer burden', headline: () => 'The price rises by less than the tax',
    text: (ctx) => `Customers pay ${shares(ctx).consumer} more per can than before (Pe up to Pc). That’s their share of the tax: the consumer burden.`,
    slider: true, tax: true, layers: L6, enter: ['taxConsumer'], grow: ['taxConsumer'], captions: s1s2,
  },
  {
    id: 'producer burden', headline: () => 'Producers pay the rest',
    text: (ctx) => `The company keeps ${shares(ctx).producer} less per can than before (Pe down to Pp): the producer burden. ${shares(ctx).consumer} + ${shares(ctx).producer} = the whole ${fmtMoney(ctx.amount)} tax.`,
    slider: true, tax: true, layers: L7, enter: ['taxProducer'], grow: ['taxProducer'], captions: s1s2,
  },
  {
    id: 'revenue', headline: () => 'Tax revenue',
    text: ({ amount, result }) => `The government collects ${fmtMoney(amount)} × Q<sub>tax</sub> = ${fmtMoney(result.govRevenue)}. That’s this whole box: both burdens together.`,
    slider: true, tax: true, layers: L8, enter: ['wedgeBox'], captions: s1s2,
  },
  {
    id: 'surplus', headline: () => 'What’s left of the surplus',
    text: () => 'Consumer surplus now stops at Pc, and producer surplus at Pp. Some of what they lost became tax revenue. The rest became…',
    slider: true, tax: true, layers: L9, enter: ['cs', 'ps'], captions: s1s2,
  },
  {
    id: 'deadweight loss', headline: () => 'Deadweight loss',
    text: () => '…nobody’s. The cans between Q<sub>tax</sub> and Qe were worth more to buyers (D) than they cost to make (S1). With the tax they’re no longer sold, so society loses this triangle.',
    slider: true, tax: true, layers: L10, enter: ['dwl'], grow: ['dwl'], captions: s1s2,
  },
  {
    id: 'elasticity', headline: () => 'Elasticity decides who pays more',
    text: (ctx) => `Now demand is inelastic: people keep buying even when the price rises. Customers pay ${shares(ctx).consumer} of the ${fmtMoney(ctx.amount)} tax, and the company only ${shares(ctx).producer}.`,
    slider: true, tax: true, demand: 'inelastic', layers: L10, captions: s1s2,
  },
  {
    id: 'wrap', headline: () => 'The full diagram',
    text: () => 'That’s the full tax diagram, the one you’d draw in an exam. In Play you can also try an ad valorem (percentage) tax.',
    slider: true, tax: true, layers: [], view: 'ib', finish: true,
  },
];
