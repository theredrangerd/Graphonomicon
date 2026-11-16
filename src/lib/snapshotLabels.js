import { computeMarket, pointElasticities } from './marketEngine.js';
import { buildControlChart } from './controlChart.js';

// Names frozen graphs by what differs between them, in words a student can read ("Very
// elastic demand", "Higher supply", "Floor at $90"). A dimension appears only when its value
// differs between at least two graphs; with nothing to tell them apart they are just
// "Graph N". Each change is a chip { kind, text, n }: `kind` is the colour (demand, supply,
// policy, lens) and `n` (1 to 3, or 0 for none) is how many Isotype squares show its size.

const cap = (word) => word[0].toUpperCase() + word.slice(1);

function freeMarketElasticity(state) {
  const { curve } = buildControlChart(state, { type: 'floor' });
  const { Pstar, Qstar, slopeD, slopeS, noTrade } = computeMarket({ ...curve.market, intervention: { type: 'none' } });
  return pointElasticities({ Pstar, Qstar, slopeD, slopeS, noTrade });
}

// True point elasticity (never a slope) in bands; the squares count distance from unit elastic.
function elasticityChip(kind, e) {
  if (e == null) return { kind, text: 'No market to measure', n: 0 };
  const [word, n] = e < 0.5 ? ['Very inelastic', 3] : e < 0.95 ? ['Inelastic', 2] : e <= 1.05 ? ['Unit-elastic', 1] : e <= 2 ? ['Elastic', 2] : ['Very elastic', 3];
  return { kind, text: `${word} ${kind}`, n };
}

const shiftSize = (v) => (Math.abs(v) <= 10 ? 0 : Math.abs(v) <= 25 ? 1 : 2);

function shiftChip(kind, v, [up, down]) {
  if (!v) return { kind, text: `Unshifted ${kind}`, n: 0 };
  const size = shiftSize(v);
  return { kind, text: `${(v > 0 ? up : down)[size]} ${kind}`, n: size + 1 };
}

const DEMAND_WORDS = [['Slightly higher', 'Higher', 'Very high'], ['Slightly lower', 'Lower', 'Very low']];
const SUPPLY_WORDS = [['Slightly more', 'More', 'Much more'], ['Slightly less', 'Less', 'Much less']];

// Each dimension: the raw value that decides "differs", and the chip for one state.
function dimensions({ type, focuses }) {
  const focusLabel = (id) => (id ? focuses.find(([fid]) => fid === id)?.[1] ?? id : 'Exam diagram');
  return [
    { key: (s) => s.slopeD, chip: (s) => elasticityChip('demand', freeMarketElasticity(s).ped) },
    { key: (s) => s.slopeS, chip: (s) => elasticityChip('supply', freeMarketElasticity(s).pes) },
    { key: (s) => s.demand, chip: (s) => shiftChip('demand', s.demand, DEMAND_WORDS) },
    { key: (s) => s.supply, chip: (s) => shiftChip('supply', s.supply, SUPPLY_WORDS) },
    { key: (s) => (s.on ? s.controlPrice : null), chip: (s) => ({ kind: 'policy', text: s.on ? `${cap(type)} at $${s.controlPrice}` : `No ${type}`, n: 0 }) },
    { key: (s) => s.focus ?? null, chip: (s) => ({ kind: 'lens', text: focusLabel(s.focus), n: 0 }) },
  ];
}

// One entry per snapshot: its chips, a plain-text `title` (for screen readers and tests), and a
// `suffix` ("(2)") that tells identical graphs apart inside a set where others differ.
export function describeSnapshots(snapshots, options) {
  const states = snapshots.map((snap) => snap.state);
  const differing = dimensions(options).filter((d) => new Set(states.map(d.key)).size > 1);
  const seen = new Map();
  return states.map((state, i) => {
    if (!differing.length) return { chips: [], title: `Graph ${i + 1}`, suffix: '' };
    const chips = differing.map((d) => d.chip(state));
    const base = chips.map((c) => c.text).join(', ');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const suffix = n > 1 ? `(${n})` : '';
    return { chips, title: suffix ? `${base} ${suffix}` : base, suffix };
  });
}

export const labelSnapshots = (snapshots, options) => describeSnapshots(snapshots, options).map((d) => d.title);
