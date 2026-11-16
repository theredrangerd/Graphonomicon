import { computeMarket, pointElasticities } from './marketEngine.js';
import { buildControlChart } from './controlChart.js';

// Names frozen graphs by what differs between them, so the labels double as the comparison
// ("PED 2.00" next to "PED 0.50"). A dimension appears only when its value differs between
// at least two graphs; with nothing to tell them apart they are just "Graph N".

const signed = (v) => (v > 0 ? '+' : '') + v;

function freeMarketElasticity(state) {
  const { curve } = buildControlChart(state, { type: 'floor' });
  const { Pstar, Qstar, slopeD, slopeS, noTrade } = computeMarket({ ...curve.market, intervention: { type: 'none' } });
  return pointElasticities({ Pstar, Qstar, slopeD, slopeS, noTrade });
}

const fmtE = (e) => (e == null ? '—' : e.toFixed(2));

// Each dimension: the raw value that decides "differs", and how to print it for one state.
function dimensions({ type, focuses }) {
  const focusLabel = (id) => (id ? focuses.find(([fid]) => fid === id)?.[1] ?? id : 'exam diagram');
  return [
    { key: (s) => s.slopeD, show: (s) => `PED ${fmtE(freeMarketElasticity(s).ped)}` },
    { key: (s) => s.slopeS, show: (s) => `PES ${fmtE(freeMarketElasticity(s).pes)}` },
    { key: (s) => s.demand, show: (s) => `demand ${signed(s.demand)}` },
    { key: (s) => s.supply, show: (s) => `supply ${signed(s.supply)}` },
    { key: (s) => (s.on ? s.controlPrice : null), show: (s) => (s.on ? `${type} $${s.controlPrice}` : `no ${type}`) },
    { key: (s) => s.focus ?? null, show: (s) => focusLabel(s.focus) },
  ];
}

export function labelSnapshots(snapshots, options) {
  const states = snapshots.map((snap) => snap.state);
  const differing = dimensions(options).filter((d) => new Set(states.map(d.key)).size > 1);
  const seen = new Map();
  return states.map((state, i) => {
    if (!differing.length) return `Graph ${i + 1}`;
    const label = differing.map((d) => d.show(state)).join(', ');
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return n > 1 ? `${label} (${n})` : label;
  });
}
