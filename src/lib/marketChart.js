import { QMAX, PMAX } from './marketEngine.js';
import { fmtMoney } from './format.js';

// The chart is drawn in real CSS pixels: the viewBox is sized to the SVG's rendered width
// (see sizeChart), so 1 user unit = 1 screen px and every font size below is the size the
// student actually sees — a fixed 780-wide viewBox scaled down to a 640px card (or a
// 340px phone) shrank 12px labels to 10px (or 5px), unreadable on a projector.
// Margins leave room for 3-digit tick labels + the rotated axis title on the left, and
// tick labels/axis symbols + the axis title underneath.
const BASE_BOTTOM = 58;
// Extra room under the x-axis for a shortage / excess-supply bracket, which hangs below the
// Qs/Qd axis symbols (with its label under it) instead of sitting on the diagram.
const GAP_BAND = 30;
// Extra room left of the y axis for a dimension line (Explain's revenue step), between the
// tick labels / price symbols and the rotated axis title.
const BASE_LEFT = 62;
const DIM_LEFT = 38;
const M = { left: BASE_LEFT, right: 18, top: 18, bottom: BASE_BOTTOM };
// Fallback width when layout gives none (jsdom, or a chart not yet in the document).
const DEFAULT_W = 780;
let VBW = DEFAULT_W, VBH = 520, plotW = 0, plotH = 0;

// Wide charts keep the familiar 3:2 frame; narrow ones (phones, where the columns stack)
// get relatively taller so the plot area doesn't collapse into a strip once the fixed-size
// margins are taken out.
// `growForBands`: the reserved bands make the frame taller instead of eating into the plot, so
// the plot height is the same with or without them.
function sizeChart(width, gapBand = false, dimBands = false, growForBands = false) {
  const bottomBand = gapBand || dimBands ? GAP_BAND : 0;
  M.bottom = BASE_BOTTOM + bottomBand;
  M.left = BASE_LEFT + (dimBands ? DIM_LEFT : 0);
  VBW = Math.round(width);
  // Blend from 3:2 at 560px to roughly square at phone width (~340px).
  const t = Math.min(1, Math.max(0, (560 - width) / 220));
  VBH = Math.round(width * ((2 / 3) + t * (1.02 - 2 / 3))) + (growForBands ? bottomBand : 0);
  plotW = VBW - M.left - M.right;
  plotH = VBH - M.top - M.bottom;
}
sizeChart(DEFAULT_W);

// Type scale in screen px (roughly 1.15 steps): ticks 13 → labels 14 → axis symbols 16.
const TICK_PX = 13;
const TICK_Y = 22; // tick-label / x-axis symbol baseline, below the plot

function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function sx(q) { return M.left + (q / QMAX) * plotW; }
// No clamping: squashing an off-chart price flattens polygon corners (e.g. the tip of a
// CS triangle whose steep demand curve starts far above PMAX), so the shading stops
// following the curve. Fills are clipped to the plot area with #plotClip instead.
function sy(p) { return M.top + plotH - (p / PMAX) * plotH; }

const svgns = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, className) {
  const e = document.createElementNS(svgns, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (className) e.setAttribute('class', className);
  return e;
}
function pts(arr) { return arr.map(([q, p]) => `${sx(q)},${sy(p)}`).join(' '); }

// Renders e.g. "S" + subscript "1" as a real SVG subscript, not a unicode digit
// (keeps curve labels short and unambiguous once a second supply line is on screen).
function subscriptLabel(base, sub, attrs, className = 'curve-label') {
  const t = el('text', attrs, className);
  t.textContent = base;
  const tspan = el('tspan', { 'baseline-shift': 'sub', 'font-size': '0.75em' });
  tspan.textContent = sub;
  t.appendChild(tspan);
  return t;
}

function clipDemand(Dmax, slopeD) {
  const qAtPmax = (Dmax - PMAX) / slopeD, qAtP0 = Dmax / slopeD;
  const q0 = clampN(qAtPmax, 0, QMAX), q1 = clampN(qAtP0, 0, QMAX);
  return [[q0, Dmax - slopeD * q0], [q1, Dmax - slopeD * q1]];
}
function clipSupply(Smin, slopeS) {
  const qAtP0 = -Smin / slopeS, qAtPmax = (PMAX - Smin) / slopeS;
  const q0 = clampN(qAtP0, 0, QMAX), q1 = clampN(qAtPmax, 0, QMAX);
  return [[q0, Smin + slopeS * q0], [q1, Smin + slopeS * q1]];
}

// After a specific tax or subsidy, supply shifts by a constant amount (parallel line);
// after an ad valorem tax, it shifts by a constant multiple (the line pivots at the price axis).
function shiftedSupplyParams(result) {
  const { Smin, slopeS, Pc, Pp } = result;
  // Pc/Pp only feed the specific-tax/subsidy branches — the ad valorem pivot comes from
  // taxRate directly, since Pc / Pp divides by zero whenever the producer price hits $0.
  if (result.mode === 'tax') {
    if (result.interventionMode === 'advalorem') {
      const k = 1 + result.taxRate;
      return { Smin: Smin * k, slopeS: slopeS * k };
    }
    const wedge = Pc - Pp;
    return { Smin: Smin + wedge, slopeS };
  }
  if (result.mode === 'subsidy') {
    const wedge = Pp - Pc;
    return { Smin: Smin - wedge, slopeS };
  }
  return null;
}

// Overlap stripes sit well above the 0.20 CS/PS fills so the two colours separate clearly,
// while staying pale enough not to read as a solid band.
const STRIPE_OPACITY = 0.24;

function drawGridAndAxes(svg) {
  const defs = el('defs');
  const pattern = el('pattern', { id: 'dwlHatch', width: 6, height: 6, patternTransform: 'rotate(45)', patternUnits: 'userSpaceOnUse' });
  pattern.appendChild(el('rect', { width: 6, height: 6, fill: 'var(--dwl-fill)' }));
  pattern.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--dwl-hatch)', 'stroke-width': 1.4 }));
  defs.appendChild(pattern);
  // Subsidy CS/PS overlap: alternating demand-blue and supply-orange stripes, so the band
  // reads as belonging to both surpluses rather than as a third, blended one.
  // Opaque base first, so the stripes aren't tinted by the CS/PS fills underneath.
  for (const [id, angle] of [['overlapStripesBelow', 45], ['overlapStripesAbove', -45]]) {
    const stripes = el('pattern', { id, width: 10, height: 10, patternTransform: `rotate(${angle})`, patternUnits: 'userSpaceOnUse' });
    stripes.appendChild(el('rect', { width: 10, height: 10, fill: 'var(--surface)' }));
    stripes.appendChild(el('rect', { width: 5, height: 10, fill: 'var(--demand)', 'fill-opacity': STRIPE_OPACITY }, 'overlap-stripe overlap-stripe--cs'));
    stripes.appendChild(el('rect', { x: 5, width: 5, height: 10, fill: 'var(--supply)', 'fill-opacity': STRIPE_OPACITY }, 'overlap-stripe overlap-stripe--ps'));
    defs.appendChild(stripes);
  }
  const clip = el('clipPath', { id: 'plotClip' });
  clip.appendChild(el('rect', { x: M.left, y: M.top, width: plotW, height: plotH }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  svg.appendChild(el('rect', { x: M.left, y: M.top, width: plotW, height: plotH, fill: 'var(--surface)', stroke: 'none' }));

  const g = el('g');
  for (let qq = 0; qq <= QMAX; qq += 20) {
    g.appendChild(el('line', { x1: sx(qq), y1: M.top, x2: sx(qq), y2: M.top + plotH, stroke: 'var(--hairline)', 'stroke-width': 1 }));
    const lbl = el('text', { x: sx(qq), y: M.top + plotH + TICK_Y, 'text-anchor': 'middle', 'data-axis': 'x', 'data-pos': sx(qq) }, 'tick-label');
    lbl.textContent = qq;
    g.appendChild(lbl);
  }
  for (let pp = 0; pp <= PMAX; pp += 20) {
    g.appendChild(el('line', { x1: M.left, y1: sy(pp), x2: M.left + plotW, y2: sy(pp), stroke: 'var(--hairline)', 'stroke-width': 1 }));
    const plbl = el('text', { x: M.left - 10, y: sy(pp) + TICK_PX * 0.35, 'text-anchor': 'end', 'data-axis': 'y', 'data-pos': sy(pp) }, 'tick-label');
    plbl.textContent = pp;
    g.appendChild(plbl);
  }
  svg.appendChild(g);

  svg.appendChild(el('line', { x1: M.left, y1: M.top, x2: M.left, y2: M.top + plotH, stroke: 'var(--hairline-2)', 'stroke-width': 1.5 }));
  svg.appendChild(el('line', { x1: M.left, y1: M.top + plotH, x2: M.left + plotW, y2: M.top + plotH, stroke: 'var(--hairline-2)', 'stroke-width': 1.5 }));

  const xl = el('text', { x: M.left + plotW / 2, y: VBH - 8, 'text-anchor': 'middle' }, 'axis-label');
  xl.textContent = 'Quantity (units)';
  svg.appendChild(xl);
  const yl = el('text', { x: 14, y: M.top + plotH / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${M.top + plotH / 2})` }, 'axis-label');
  yl.textContent = 'Price ($ / unit)';
  svg.appendChild(yl);
}

// A binding ceiling/floor: one control-price line, with Qs/Qd either side of it.
function isPriceControl(result) {
  return result.mode === 'ceiling' || result.mode === 'floor';
}

// A tax or subsidy that still trades: separate Pc/Pp lines and a Q1 point. A tax big
// enough to close the market has no traded price, so none of these marks are drawn.
function hasOpenWedge(result) {
  return (result.mode === 'tax' && !result.closed) || result.mode === 'subsidy';
}

// 'pricesPOnly' is the mirror image (just the Pp line and symbol; Explain's revenue step).
// 'pricesCOnly' is 'prices' minus the producer price: just the Pc line (the one that tracks e2)
// and its axis symbol, for a caller that holds the Pp line back.
// Named layers: every mark the renderer draws belongs to exactly one, so a caller (the
// subsidy page's Explain steps) can build the diagram up piece by piece. With no `layers`
// option, resolveLayers returns exactly what the chart has always drawn for that result.
export const LAYERS = Object.freeze([
  'demand', 'supply', 'supply2', 'eq1', 'eq2', 'prices', 'pricesCOnly', 'pricesPOnly', 'control', 'wedgeBox',
  'cs', 'ps', 'overlap', 'taxWedges', 'taxConsumer', 'taxProducer', 'dwl', 'dwlConsumer', 'dwlProducer',
  'csTriangle', 'psTriangle', 'marginalCs', 'marginalPs', 'govFill', 'dwlUnknown',
  'subsidyBracket', 'subsidyArrow', 'taxBracket', 'badges', 'areaNames', 'focusChip',
  // Subsidy Explain teaching marks, never drawn by default (see drawSubsidyTeachingMarks).
  'eq1Note', 'eq2Note', 'taxArrow', 'qtyBracket', 'taxHeight', 'lost', 'lostConsumer', 'lostProducer', 'lostNote', 'costDot', 'loafDrop', 'loafDrops', 'priceBrackets', 'revenueDims', 'revenueBox', 'govStrips', 'boxWidth', 'boxLabel', 'readout',
]);

// Every Explorer focus the renderer knows. Each page offers its own subset (subsidy: cs, ps,
// overlap, gov, dwl; tax: cs, ps, consumer-burden, producer-burden, revenue, dwl); one that
// doesn't apply to the result draws nothing.
// 'gap' is the ceiling/floor page's shortage / excess-supply bracket, which has no area of its own.
export const FOCUS_IDS = Object.freeze(['cs', 'ps', 'overlap', 'gov', 'consumer-burden', 'producer-burden', 'revenue', 'dwl', 'gap', 'consumer-lens', 'producer-lens', 'societal']);

// The layer a single-area focus draws, where it isn't named after the focus itself.
const FOCUS_LAYER = { gov: 'govFill', 'consumer-burden': 'taxConsumer', 'producer-burden': 'taxProducer' };

// The tax page's lenses: one side of the market at a time — its surplus, its burden band and
// its half of the deadweight loss (cut across Pe), each with its own chip.
const LENSES = {
  'consumer-lens': {
    layers: ['cs', 'taxConsumer', 'dwlConsumer', 'lost', 'lostNote'],
    chips: (r) => [
      ['cs', { label: 'CS', value: r.CS, colorVar: 'demand' }, r.csPoly],
      ['consumer-burden', { label: 'CB', value: r.consumerIncidence, colorVar: 'burden-consumer' }, r.consumerWedgePoly],
      ['dwl', { label: 'DWL', value: r.DWLConsumer, colorVar: 'dwl-line' }, r.dwlConsumerPoly],
    ],
  },
  'producer-lens': {
    layers: ['ps', 'taxProducer', 'dwlProducer', 'lost', 'lostNote'],
    chips: (r) => [
      ['ps', { label: 'PS', value: r.PS, colorVar: 'supply' }, r.psPoly],
      ['producer-burden', { label: 'PB', value: r.producerIncidence, colorVar: 'burden-producer' }, r.producerWedgePoly],
      ['dwl', { label: 'DWL', value: r.DWLProducer, colorVar: 'dwl-line' }, r.dwlProducerPoly],
    ],
  },
};

// A tax that still trades: its burden bands and revenue box exist.
function isOpenTax(result) {
  return result.mode === 'tax' && !result.closed;
}

// What a focus draws: its polygon, chip label/value, and chip colour. Overlap, gov and DWL
// only exist when the result has them, so on a free market they yield no fill and no chip.
// Under a subsidy the CS/PS chip sits in the free-market triangle (`chipPoly`), since the
// marginal band beside it is drawn as its own area.
function focusSpec(result, focus) {
  const isSubsidy = result.mode === 'subsidy';
  const specs = {
    cs: { poly: result.csPoly, chipPoly: isSubsidy ? result.csTrianglePoly : null, label: 'CS', value: result.CS, colorVar: 'demand' },
    ps: { poly: result.psPoly, chipPoly: isSubsidy ? result.psTrianglePoly : null, label: 'PS', value: result.PS, colorVar: 'supply' },
    overlap: { poly: isSubsidy ? result.overlapPoly : null, label: 'Overlap', value: result.overlapArea, colorVar: 'ink' },
    gov: { poly: isSubsidy ? result.wedgePoly : null, label: 'Gov', value: result.govCost, colorVar: 'gov' },
    revenue: { poly: isOpenTax(result) ? result.wedgePoly : null, label: 'Revenue', value: result.govRevenue, colorVar: 'gov' },
    'consumer-burden': { poly: isOpenTax(result) ? result.consumerWedgePoly : null, label: 'CB', value: result.consumerIncidence, colorVar: 'burden-consumer' },
    'producer-burden': { poly: isOpenTax(result) ? result.producerWedgePoly : null, label: 'PB', value: result.producerIncidence, colorVar: 'burden-producer' },
    dwl: { poly: result.dwlPoly, label: 'DWL', value: result.DWL, colorVar: 'dwl-line' },
  };
  return specs[focus] ?? null;
}

export function resolveLayers(result, { detail = 'full', layers, focus = null, showSurplusLabels = false } = {}) {
  if (layers) return new Set(layers);
  if (focus && FOCUS_IDS.includes(focus)) {
    const on = new Set(['demand', 'supply', 'eq1']);
    if (shiftedSupplyParams(result)) on.add('supply2');
    // Every ceiling/floor view keeps its control line (and Qs/Qd), the thing the areas are bounded by.
    if (isPriceControl(result) || (!hasOpenWedge(result) && result.requestedControl)) on.add('control');
    // The CS and consumer-burden views have no use for the producer price, so they keep only the Pc line.
    if (hasOpenWedge(result)) {
      on.add('eq2');
      on.add(focus === 'cs' || focus === 'consumer-burden' || focus === 'consumer-lens' ? 'pricesCOnly' : focus === 'producer-lens' ? 'pricesPOnly' : 'prices');
    }
    if (LENSES[focus]) {
      for (const name of LENSES[focus].layers) on.add(name);
      on.add('focusChip');
      return on;
    }
    if (focus === 'societal') {
      // The subsidy's societal lens: where the government's money ends up, with nothing else.
      // The two marginal bands and the deadweight loss sit inside the spending box's outline;
      // the page adds the strips and the solid box itself while it plays the build-up.
      if (result.mode === 'subsidy' && hasOpenWedge(result)) {
        for (const name of ['wedgeBox', 'marginalCs', 'marginalPs']) on.add(name);
        if (result.dwlPoly?.length >= 3) on.add('dwl');
        on.add('focusChip');
      }
      // The tax's Society lens: the two burden bands (which together are the revenue box) and the deadweight loss.
      if (isOpenTax(result)) {
        for (const name of ['taxConsumer', 'taxProducer', 'taxHeight']) on.add(name);
        if (result.dwlPoly?.length >= 3) on.add('dwl');
        on.add('focusChip');
      }
      return on;
    }
    if (focus === 'overlap') {
      // The overlap view starts as the plain labelled diagram, then shows CS and PS each growing
      // into the other's area: the free-market triangles, both marginal bands, the stripes.
      for (const name of result.mode === 'subsidy' ? ['csTriangle', 'psTriangle', 'marginalCs', 'marginalPs', 'overlap'] : ['cs', 'ps']) on.add(name);
      if (hasOpenWedge(result)) on.add('subsidyArrow');
      on.add('focusChip');
      return on;
    }
    const hasPoly = focusSpec(result, focus)?.poly?.length >= 3;
    // Producer surplus only: the arrow from e2 up to S1 that shows where the subsidy lifts PS.
    if (focus === 'ps' && hasOpenWedge(result)) on.add('subsidyArrow');
    // A subsidised CS/PS is split as IB perfect draws it: the free-market triangle plus its
    // marginal band in that band's own colour, so the band visibly grows as the subsidy does.
    // A taxed CS/PS is just the surplus left after the tax: its burden is a focus of its own,
    // so a surplus view never shows a burden band. Tax revenue is the box, split into the two burdens.
    const split = (result.mode === 'subsidy' && {
      cs: ['csTriangle', 'marginalCs'], ps: ['psTriangle', 'marginalPs'],
    }[focus]) || (isOpenTax(result) && {
      revenue: ['taxArrow', 'qtyBracket', 'taxHeight', 'govStrips', 'govFill', 'wedgeBox'],
    }[focus]);
    if (hasPoly && split) {
      for (const name of split) on.add(name);
      if (focusSpec(result, focus).value > 0.005) on.add('focusChip');
    } else if (hasPoly) {
      on.add(FOCUS_LAYER[focus] ?? focus);
      if (focus === 'gov') on.add('wedgeBox');
      // The government's lens also shows where the producer's share comes from: the arrow from e2 up to S1.
      if (focus === 'gov' && result.mode === 'subsidy' && hasOpenWedge(result)) on.add('subsidyArrow');
      const spec = focusSpec(result, focus);
      if (spec.value > 0.005) on.add('focusChip');
    }
    return on;
  }
  const on = new Set(['demand', 'supply', 'eq1']);
  if (shiftedSupplyParams(result)) on.add('supply2');
  if (hasOpenWedge(result)) { on.add('eq2'); on.add('prices'); on.add('wedgeBox'); }
  // A binding ceiling/floor, or the muted line of one that doesn't bind.
  if (isPriceControl(result) || (!hasOpenWedge(result) && result.requestedControl)) on.add('control');
  // IB perfect subsidy: the free-market triangles plus the two marginal bands, never the
  // translucent CS/PS with striped overlap an exam diagram doesn't draw.
  const ibSubsidy = result.mode === 'subsidy' && detail === 'ib';
  if (ibSubsidy) {
    for (const name of ['csTriangle', 'psTriangle', 'marginalCs', 'marginalPs']) on.add(name);
  } else {
    on.add('cs');
    on.add('ps');
    if (result.mode === 'subsidy') on.add('overlap');
  }
  if (result.mode === 'tax') on.add('taxWedges');
  if (result.dwlPoly) on.add('dwl');
  if (detail === 'full' && showSurplusLabels) on.add('badges');
  if (result.mode === 'subsidy' && detail === 'full') on.add('subsidyBracket');
  if (detail === 'ib') on.add('areaNames');
  return on;
}

// Per-render layer state: which layers are drawn, and which fade in / grow on this render.
let layerOn = new Set();
let layerEnter = new Set();
let layerGrow = new Set();
let layerExit = new Set();

// Tags an element with its layer, plus the entry-animation classes this render asked for.
// A shaded region's own transform is its hover scale (pages.css .region--fill), so a fill
// group's grow goes on its shapes instead, keeping the two transforms on separate elements.
// What each layer stands for, for the Explain card's word-to-mark highlighting (see MARK_COLOR).
const LAYER_MARKS = {
  demand: 'customer', supply: 'cost', supply2: 'customer', eq1: 'pe', eq2: 'qty', pricesC: 'customer', prices: 'cost',
  cs: 'cs', csTriangle: 'cs', ps: 'ps', psTriangle: 'ps', wedgeBox: 'gov', revenueBox: 'cost', govFill: 'gov', subsidyBracket: 'gov', subsidyArrow: 'gov', marginalPs: 'mps', marginalCs: 'mcs', dwl: 'dwl', dwlConsumer: 'dwl', dwlProducer: 'dwl',
};
function tag(node, name) {
  node.setAttribute('data-layer', name);
  if (LAYER_MARKS[name] && !node.hasAttribute('data-mark')) node.setAttribute('data-mark', LAYER_MARKS[name]);
  if (layerEnter.has(name)) node.classList.add('layer-enter');
  if (layerExit.has(name)) node.classList.add('layer-exit');
  if (layerGrow.has(name)) {
    const isFill = node.classList.contains('region--fill');
    const targets = isFill ? [...node.children] : [node];
    for (const t of targets) t.classList.add('layer-grow');
  }
  return node;
}

const MODE_LABELS = {
  ceiling: 'Price ceiling',
  floor: 'Price floor',
};

// Distance from its equilibrium symbol (Pe/Qe) at which an intervention symbol reaches
// full size. Chosen so two symbols centred on their lines stop overlapping at ~40% size
// (below that they're tiny, fading, and drawn under Pe/Qe's halo).
// Both scale with SYMBOL_PX: a symbol with its subscript is ~1.3em tall and ~1.1em wide,
// plus clearance. (Kept tight enough that the default $20 tax shows Pc/Pp at full size.)
const SYMBOL_PX = 16;
// Y_GAP is the minimum centre-to-centre pitch of stacked price symbols (see spreadY).
const Y_GAP = Math.round(SYMBOL_PX * 1.65);
const X_GAP = Math.round(SYMBOL_PX * 1.75);
// Growth starts this far out from Pe/Qe: Pe's hanging subscript needs ~3px more room than
// the centred-glyph estimate, and at this distance the symbol would be <1px tall anyway.
const SYMBOL_DEAD_ZONE = 3;

// The IB-style symbols a result puts on each axis: Pe/Qe for the free-market equilibrium
// (always, so the before/after comparison stays readable), plus whatever prices and
// quantities the intervention creates (`ref: false`).
function axisSymbols(result) {
  // `layer` ties each symbol to the mark it names: Pe/Qe to e1, Pc/Pp to the price lines,
  // Q1 to e2, and Pmax/Pmin/Qs/Qd to the control line.
  const y = [{ base: 'P', sub: 'e', v: result.Pstar, ref: true, layer: 'eq1' }];
  const x = [{ base: 'Q', sub: 'e', v: result.Qstar, ref: true, layer: 'eq1' }];
  if (isPriceControl(result)) {
    y.push({ base: 'P', sub: result.mode === 'ceiling' ? 'max' : 'min', v: result.Pc, layer: 'control' });
    x.push({ base: 'Q', sub: 's', v: result.qs, layer: 'control' }, { base: 'Q', sub: 'd', v: result.qd, layer: 'control' });
  } else if (hasOpenWedge(result)) {
    y.push({ base: 'P', sub: 'c', v: result.Pc, layer: 'pricesC' }, { base: 'P', sub: 'p', v: result.Pp, layer: 'prices' });
    // The traded quantity is named after the policy (teacher's request): Q_subsidy, Q_tax.
    x.push({ base: 'Q', sub: result.mode === 'subsidy' ? 'subsidy' : 'tax', v: result.Q, layer: 'eq2' });
  }
  const place = (syms, pos, gap) => {
    const withPos = syms.map((s) => ({ ...s, pos: pos(s.v) }));
    const refPos = withPos[0].pos;
    // Every symbol stays exactly on its own line. An intervention symbol closing in on its
    // equilibrium symbol shrinks in proportion to the distance instead of being pushed
    // aside, so it never sits off its line or covers Pe/Qe, and it vanishes at exactly
    // zero intervention (e.g. tax = 0, where Pc = Pp = Pe).
    return withPos
      .map((s) => ({ ...s, scale: s.ref ? 1 : Math.min(1, Math.max(0, Math.abs(s.pos - refPos) - SYMBOL_DEAD_ZONE) / (gap - SYMBOL_DEAD_ZONE)) }))
      .filter((s) => s.scale > 0.05);
  };
  // Positions are worked out with every symbol present, then the ones whose layer is off
  // are dropped, so a symbol doesn't jump when an Explain step brings its neighbour in.
  const drawn = (s) => (s.layer === 'pricesC' ? layerOn.has('prices') || layerOn.has('pricesCOnly') : s.layer === 'prices' ? layerOn.has('prices') || layerOn.has('pricesPOnly') : layerOn.has(s.layer));
  return {
    y: spreadY(y.map((s) => ({ ...s, pos: sy(s.v) }))).filter(drawn),
    x: place(x.filter((s) => s.v >= 0 && s.v <= QMAX), sx, X_GAP).filter(drawn),
  };
}

// Price symbols never shrink: they keep full size and, when their lines are closer together
// than a label is tall, are spread apart around Pe (which stays on its own line). Each
// displaced label records its true line in `pos` and its drawn centre in `labelY`, and
// drawAxisSymbols joins the two with a short leader. Only an exactly-zero intervention
// (Pc = Pp = Pe) drops a symbol, since it would sit on top of Pe.
function spreadY(syms) {
  const ref = syms[0];
  const top = M.top, bottom = M.top + plotH;
  const out = [{ ...ref, labelY: ref.pos, scale: 1 }];
  const side = (list, dir) => {
    let prev = ref.pos;
    for (const s of list.sort((a, b) => dir * (a.pos - b.pos))) {
      let labelY = dir > 0 ? Math.max(s.pos, prev + Y_GAP) : Math.min(s.pos, prev - Y_GAP);
      // No room on this side of the chart (a price near $0 or the top): tuck the label
      // to the other side of Pe rather than let it run off the plot.
      if (labelY < top || labelY > bottom) labelY = dir > 0 ? ref.pos - Y_GAP : ref.pos + Y_GAP;
      out.push({ ...s, labelY, scale: 1 });
      prev = labelY;
    }
  };
  const others = syms.slice(1).filter((s) => Math.abs(s.pos - ref.pos) >= 0.5);
  side(others.filter((s) => s.pos > ref.pos), 1);   // lower prices: further down the screen
  side(others.filter((s) => s.pos < ref.pos), -1);
  return out;
}

function drawAxisSymbols(svg, layer, result) {
  const { x, y } = axisSymbols(result);
  const refX = x.find((s) => s.ref)?.pos;
  // Equilibrium symbols last, with a halo in the card colour, so a shrinking intervention
  // symbol that brushes Pe/Qe passes underneath rather than over it.
  const order = (syms) => [...syms].sort((a, b) => Number(a.ref ?? false) - Number(b.ref ?? false));
  const cls = (s) => (s.ref ? 'axis-symbol axis-symbol--ref' : s.sub === 'p' ? 'axis-symbol axis-symbol--pp' : 'axis-symbol');
  // Fade in the last stretch before vanishing, so a symbol too small to read doesn't
  // linger as a speck.
  const size = (s) => ({ 'font-size': (SYMBOL_PX * s.scale).toFixed(2), opacity: Math.min(1, 2 * s.scale).toFixed(2) });
  // Baseline 0.2em below the line centres the glyphs (cap height ~0.7em above the
  // baseline, subscript ~0.3em below) on the price they label.
  for (const s of order(y)) {
    layer.appendChild(tag(subscriptLabel(s.base, s.sub, { x: M.left - 10, y: s.labelY + 0.2 * SYMBOL_PX * s.scale, 'text-anchor': 'end', ...size(s) }, cls(s)), s.layer));
    // A label pushed off its line gets a leader back to the axis point it names.
    if (Math.abs(s.labelY - s.pos) > 1) {
      layer.appendChild(tag(el('line', { x1: M.left - 8, y1: s.labelY, x2: M.left, y2: s.pos }, s.sub === 'p' ? 'axis-leader axis-symbol--pp' : 'axis-leader'), s.layer));
    }
  }
  // A word subscript (Q_subsidy, Q_tax) would straddle its line and run into Qe, so it
  // grows away from Qe: right of Qe it keeps its Q on the line (half a Q glyph ≈ 0.35em)
  // and lets the word trail right; left of Qe (a tax) the whole symbol ends at its line.
  for (const s of order(x)) {
    const word = s.sub.length > 2;
    const pin = !word ? { x: s.pos, 'text-anchor': 'middle' }
      : s.pos < refX ? { x: s.pos + 0.15 * SYMBOL_PX * s.scale, 'text-anchor': 'end' }
        : { x: s.pos - 0.35 * SYMBOL_PX * s.scale, 'text-anchor': 'start' };
    const qLabel = subscriptLabel(s.base, s.sub, { ...pin, y: M.top + plotH + TICK_Y, ...size(s) }, cls(s));
    if (s.ref) mark(qLabel, 'qe'); // Qe, not the layer's Pe mark; the others take their layer's
    layer.appendChild(tag(qLabel, s.layer));
  }
  // Hide any numeric tick that a symbol now sits on top of. On y the symbol isn't
  // symmetric about its line: the subscript (e.g. "max") hangs ~0.5em further below, so a
  // tick just under a symbol needs more clearance than one just above it.
  const clear = (s, tickPos) => {
    const d = tickPos - s.pos; // > 0: tick is below the symbol
    return d > 0 ? d >= SYMBOL_PX * s.scale * 0.6 + TICK_PX : -d >= TICK_PX + 3;
  };
  svg.querySelectorAll('.tick-label[data-axis]').forEach((tick) => {
    const pos = +tick.dataset.pos;
    const hidden = tick.dataset.axis === 'x'
      ? x.some((s) => Math.abs(s.pos - pos) < X_GAP || (s.sub.length > 2 && (s.pos < refX ? pos < s.pos && s.pos - pos < 2.4 * X_GAP : pos > s.pos && pos - s.pos < 2.4 * X_GAP)))
      : y.some((s) => !clear({ ...s, pos: s.labelY }, pos) || Math.abs(s.pos - pos) < TICK_PX * 0.6);
    tick.setAttribute('visibility', hidden ? 'hidden' : 'visible');
  });
}

// The shortage (ceiling) or excess supply (floor): a bracket from Qs to Qd (the smaller to
// the larger) hung below the x-axis, under the Qs/Qd axis symbols, with its label beneath it
// — never on the diagram itself, where it would crowd the curves and the shaded areas.
// Clipped with an arrow at the chart edge when Qd/Qs lies past it; the note still reports
// the full amount.
// Room the line's name needs on one side of the control line.
const NAME_ROOM = 22;
const BRACKET_DROP = 38; // axis -> bracket line, clear of the tick / symbol row

// The control line's name sits on the side away from the curves' crowding: above a ceiling,
// below a floor, flipping across the line when that side has no room (a line at $0 or the top).
function nameAbove(result) {
  const yLine = sy(result.Pc);
  const roomBelow = M.top + plotH - yLine, roomAbove = yLine - M.top;
  if (result.mode === 'ceiling') return roomAbove >= NAME_ROOM || roomAbove >= roomBelow;
  return !(roomBelow >= NAME_ROOM || roomBelow >= roomAbove);
}

// Label placement. Names that sit in the plot (line labels, curve names) are registered
// here as they're placed, so each later one can step to an alternative position instead of
// printing over an earlier label, a curve, or the plot edge. The surplus chips then avoid
// the same rectangles. Reset on every render.
const LABEL_PX = 13;
const CHAR_PX = 0.5 * LABEL_PX;  // average glyph width of the semi-bold label face
let placedLabels = [];
let curvePoints = [];
let controlPlan = null;

function labelRect(x, y, text, anchor) {
  const w = text.length * CHAR_PX;
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: y - LABEL_PX, y1: y + 3 };
}

function rectsOverlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }

function sampleCurve(x1, y1, x2, y2) {
  for (let i = 0; i <= 24; i++) curvePoints.push([x1 + ((x2 - x1) * i) / 24, y1 + ((y2 - y1) * i) / 24]);
}

// Picks the first candidate baseline position that stays inside the plot and clear of
// everything placed so far (falling back to the first one that's merely inside the plot,
// then the first). `own` skips curve-crossing checks the label's own curve can't avoid.
function placeLabel(cands, text, anchor = 'end') {
  const inPlot = (r) => r.x0 >= M.left && r.x1 <= M.left + plotW && r.y0 >= M.top && r.y1 <= M.top + plotH;
  const clear = (r) => !placedLabels.some((o) => rectsOverlap(r, o))
    && !curvePoints.some(([px, py]) => px > r.x0 - 2 && px < r.x1 + 2 && py > r.y0 - 2 && py < r.y1 + 2);
  const rects = cands.map((c) => labelRect(c.x, c.y, text, anchor));
  let i = rects.findIndex((r) => inPlot(r) && clear(r));
  if (i < 0) i = rects.findIndex(inPlot);
  if (i < 0) i = 0;
  placedLabels.push(rects[i]);
  return cands[i];
}

function gapBracketSpec(result) {
  const q0 = Math.min(result.qd, result.qs), q1 = Math.max(result.qd, result.qs);
  const x0 = sx(q0), x1 = sx(Math.min(q1, QMAX));
  if (x1 - x0 < 2) return null;
  const y = M.top + plotH + BRACKET_DROP;
  return { x0, x1, y, clipped: q1 > QMAX, labelX: (x0 + x1) / 2, labelY: y + 16 };
}

// The line's name hugs the right edge; if a curve or another label is there, slide it left
// along the line (first on its preferred side, then the other) until it's clear.
function lineLabelCands(x, y1, y2) {
  return [0, -90, -180, -270].flatMap((dx) => [{ x: x + dx, y: y1 }, { x: x + dx, y: y2 }]);
}

// Reserves the ceiling/floor marks (gap bracket, then the line's own name) before the
// curve names are placed, so those are the ones that move out of the way. The name sits on
// the side of the line away from the bracket, flipping to the other side when that would
// leave the plot (a line at $0 or the top edge).
function planControlLabels(result) {
  controlPlan = null;
  if (result.noTrade || !layerOn.has('control')) return;
  const x = M.left + plotW - 6;
  if (isPriceControl(result)) {
    const y = sy(result.Pc);
    const aboveY = y - 7, belowY = y + 17;
    const pref = nameAbove(result) ? aboveY : belowY;
    controlPlan = placeLabel(lineLabelCands(x, pref, pref === aboveY ? belowY : aboveY), MODE_LABELS[result.mode]);
  } else if (!hasOpenWedge(result) && result.requestedControl) {
    const { type, price } = result.requestedControl;
    const y = sy(price);
    controlPlan = placeLabel(lineLabelCands(x, y - 7, y + 17), (type === 'floor' ? 'Price floor' : 'Price ceiling') + ' (not binding)');
  }
}

function drawGapBracket(layer, result) {
  const isCeiling = result.mode === 'ceiling';
  const spec = gapBracketSpec(result);
  if (!spec) return;
  const { x0, x1, y, clipped } = spec;
  const g = el('g', { 'data-region': isCeiling ? 'shortage' : 'excess-supply' }, 'region region--line');
  g.appendChild(el('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: 'transparent', 'stroke-width': 16 }, 'region-hit'));
  const stroke = { stroke: 'var(--ink)', 'stroke-width': 1.4 };
  g.appendChild(el('line', { x1: x0, y1: y, x2: x1, y2: y, ...stroke }, 'gap-bracket region-visible'));
  g.appendChild(el('line', { x1: x0, y1: y - 4, x2: x0, y2: y + 4, ...stroke }, 'region-visible'));
  if (clipped) {
    g.appendChild(el('polyline', { points: `${x1 - 6},${y - 4} ${x1},${y} ${x1 - 6},${y + 4}`, fill: 'none', ...stroke }, 'region-visible'));
  } else {
    g.appendChild(el('line', { x1: x1, y1: y - 4, x2: x1, y2: y + 4, ...stroke }, 'region-visible'));
  }
  const lbl = el('text', { x: spec.labelX, y: spec.labelY, 'text-anchor': 'middle', fill: 'var(--ink)' }, 'bracket-label');
  lbl.textContent = isCeiling ? 'Shortage' : 'Excess supply';
  g.appendChild(lbl);
  layer.appendChild(tag(g, 'control'));
}

function drawWedgeLines(svg, result) {
  if (isPriceControl(result)) {
    if (!layerOn.has('control')) return;
    const y = sy(result.Pc);
    // Grouped under data-region so regionExplainers.js can hover/click it as a unit; the
    // wide transparent line gives the thin dashed line a comfortably large hit target.
    const g = el('g', { 'data-region': result.mode }, 'region region--line');
    g.appendChild(el('line', { x1: M.left, y1: y, x2: M.left + plotW, y2: y, stroke: 'transparent', 'stroke-width': 18 }, 'region-hit'));
    g.appendChild(el('line', { x1: M.left, y1: y, x2: M.left + plotW, y2: y, stroke: 'var(--dwl-line)', 'stroke-width': 1.6, 'stroke-dasharray': '6,3' }, 'wedge-line region-visible'));
    // Name label above a ceiling / below a floor (see nameAbove).
    // (Its own class, not .tick-label: that rule's grey fill would override this red.)
    const lbl = el('text', { x: controlPlan.x, y: controlPlan.y, 'text-anchor': 'end', fill: 'var(--dwl-line)' }, 'line-label');
    lbl.textContent = MODE_LABELS[result.mode];
    g.appendChild(lbl);
    svg.appendChild(tag(g, 'control'));
    drawGapBracket(svg, result);
  } else if (hasOpenWedge(result)) {
    // The consumer/producer reference lines only run from Q to the right edge — inside
    // the box (0 to Q) they'd sit exactly on top of the wedge outline's top/bottom edges,
    // and since these are drawn after the outline (see below) they'd paint over its dashes.
    // They're named on the axis (Pc/Pp, see drawAxisSymbols) — they mark prices, not the
    // burden/benefit, which is the shaded band between each line and Pe.
    const yc = sy(result.Pc), yp = sy(result.Pp);
    const xQ = sx(result.Q);
    const drawPc = layerOn.has('prices') || layerOn.has('pricesCOnly');
    const drawPp = layerOn.has('prices') || layerOn.has('pricesPOnly');
    if ((drawPc || drawPp) && !layerOn.has('wedgeBox')) {
      // No box (Explorer foci, early Explain steps): nothing else ties the Pc/Pp axis
      // symbols to the diagram, so each price runs from the axis to where it meets Q.
      // The Pc line shares its layer name with the Pc axis symbol ('pricesC'), so a step can fade
      // the two in or out together without touching the Pp line.
      if (drawPc) svg.appendChild(tag(el('line', { x1: M.left, y1: yc, x2: xQ, y2: yc, stroke: 'var(--demand)', 'stroke-width': 1.6, 'stroke-dasharray': '6,3', 'data-mark': 'customer' }, 'wedge-line'), 'pricesC'));
      if (drawPp) {
        // The Pp line can be drawn out from the axis on its own (the overlap view), without the
        // Pc line beside it redrawing, so it takes `producerPrice` as a grow name of its own.
        const ppLine = el('line', { x1: M.left, y1: yp, x2: xQ, y2: yp, stroke: 'var(--supply)', 'stroke-width': 1.6, 'stroke-dasharray': '6,3' }, 'wedge-line price-line--producer');
        if (layerGrow.has('producerPrice')) ppLine.classList.add('layer-grow');
        svg.appendChild(tag(ppLine, 'prices'));
      }
    } else if (drawPc && result.mode !== 'subsidy') {
      // (A subsidy's box edge is its Pc line: a continuation past e2 isn't on an IB diagram.)
      svg.appendChild(tag(el('line', { x1: xQ, y1: yc, x2: M.left + plotW, y2: yc, stroke: 'var(--demand)', 'stroke-width': 1.6, 'stroke-dasharray': '6,3', 'data-mark': 'customer' }, 'wedge-line'), 'pricesC'));
      // A subsidy's Pp line would run off past S1 and read as a stray mark; the box's
      // top edge and the Pp axis symbol already mark that price.
      if (result.mode !== 'subsidy' && layerOn.has('prices')) {
        svg.appendChild(tag(el('line', { x1: xQ, y1: yp, x2: M.left + plotW, y2: yp, stroke: 'var(--supply)', 'stroke-width': 1.6, 'stroke-dasharray': '6,3' }, 'wedge-line'), 'prices'));
      }
    }
    // Outline drawn last so it renders on top of the reference lines above at their
    // shared corners (x=Q), keeping the box border crisp instead of getting erased. Grouped
    // under data-region (with a wide invisible hit-stroke, same trick as the ceiling/floor
    // line) so clicking the border explains total revenue/cost, distinct from clicking
    // inside either colored half which explains that side's incidence.
    if (!layerOn.has('wedgeBox')) return;
    const revenueG = el('g', { 'data-region': result.mode === 'subsidy' ? 'subsidy-cost' : 'tax-revenue' }, 'region region--line');
    revenueG.appendChild(el('polygon', { points: pts(result.wedgePoly), fill: 'none', stroke: 'transparent', 'stroke-width': 14 }, 'region-hit'));
    revenueG.appendChild(el('polygon', { points: pts(result.wedgePoly), fill: 'none', stroke: 'var(--gov)', 'stroke-width': 2.2, 'stroke-dasharray': '5,4' }, 'wedge-outline region-visible'));
    svg.appendChild(tag(revenueG, 'wedgeBox'));
  } else if (result.requestedControl && layerOn.has('control')) {
    const { type, price } = result.requestedControl;
    const y = sy(price);
    svg.appendChild(tag(el('line', { x1: M.left, y1: y, x2: M.left + plotW, y2: y, stroke: 'var(--ink-muted)', 'stroke-width': 1.4, 'stroke-dasharray': '4,4' }, 'wedge-line'), 'control'));
    const lbl = el('text', { x: controlPlan.x, y: controlPlan.y, 'text-anchor': 'end', fill: 'var(--ink-secondary)' }, 'line-label line-label--muted');
    lbl.textContent = (type === 'floor' ? 'Price floor' : 'Price ceiling') + ' (not binding)';
    svg.appendChild(tag(lbl, 'control'));
  }
}

// Names an incidence band ("Consumer burden", ...) inside the band itself, only when the
// band is big enough to hold the text — a squeezed label is worse than none, and the
// legend + click-to-explain still name it.

// A curve that leaves the chart through the top edge would put its name above the plot,
// clipped by the card; keep the baseline one label-height inside instead.
const CURVE_LABEL_PX = 14;
function labelY(y) { return Math.max(y, M.top + CURVE_LABEL_PX); }

// The Demand name sits at the curve's top-left end, which is exactly where a high floor's
// line runs. If they'd overlap, lift the name just above the line so the two never print
// over each other.
function demandLabelY(result, y) {
  y = labelY(y);
  if (!isPriceControl(result) || result.noTrade) return y;
  const yLine = sy(result.Pc);
  if (y <= yLine - 5 || y >= yLine + 16) return y;
  return labelY(yLine - 9);
}

function measuredWidth(svg) {
  const w = svg.clientWidth || (svg.getBoundingClientRect ? svg.getBoundingClientRect().width : 0);
  return w > 0 ? w : DEFAULT_W;
}

// Computes the visual centroid of a polygon in screen coordinates so that region labels
// (CS, PS, DWL) can sit inside their respective areas. Clamps to the visible plot bounds.
function polygonCentroid(poly, avoid = [], fit = {}) {
  if (!poly || poly.length < 3) return null;
  const pts = poly.map(([q, p]) => [sx(q), sy(p)]);
  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    const a = x0 * y1 - x1 * y0;
    signedArea += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }
  signedArea *= 0.5;
  const absArea = Math.abs(signedArea);
  if (absArea < 1) return null;
  let x = cx / (6 * signedArea);
  let y = cy / (6 * signedArea);
  x = Math.max(M.left + 22, Math.min(M.left + plotW - 22, x));
  y = Math.max(M.top + 14, Math.min(M.top + plotH - 14, y));
  return { x, y, area: absArea, scale: badgeFitScale(pts, x, y, { avoid, ...fit }) };
}

const BADGE_MIN_SCALE = 0.5;
const BADGE_PAD = 2;

function pointInPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Largest scale (<= 1) at which a full-size badge centred on (x, y) keeps all four corners
// inside both the region and the plot area, so it shrinks with the region instead of
// spilling over the curves that bound it, and clear of chips already placed (`avoid`).
// Returns null if even the minimum doesn't fit.
function badgeFitScale(pts, x, y, { halfW = 20, halfH = 11, avoid = [], min = BADGE_MIN_SCALE } = {}) {
  const fits = (k) => {
    const hw = halfW * k + BADGE_PAD;
    const hh = halfH * k + BADGE_PAD;
    if (avoid.some((r) => x - hw < r.x1 && x + hw > r.x0 && y - hh < r.y1 && y + hh > r.y0)) return false;
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([dx, dy]) => {
      const px = x + dx * hw;
      const py = y + dy * hh;
      return px >= M.left && px <= M.left + plotW && py >= M.top && py <= M.top + plotH && pointInPoly(pts, px, py);
    });
  };
  if (fits(1)) return 1;
  if (!fits(min)) return null;
  let lo = min;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

// Renders an interactive pill-badge with category styling inside a chart region.
function drawRegionBadge(layer, { id, text, center, colorVar, textVar = colorVar, title, plain = false, minChars = 0 }) {
  if (!center || center.scale == null) return null;
  const k = center.scale;
  // `plain` chips are labels only: no region key, so no hover/click explainer.
  const g = el('g', {
    ...(plain ? { 'aria-label': `${title}: ${text}` } : {
      'data-region': id,
      role: 'button',
      tabindex: '0',
      'aria-label': `${title} (${text}) — click for explanation`,
    }),
    transform: `translate(${center.x.toFixed(1)}, ${center.y.toFixed(1)})`,
  }, `region-badge region-badge--${id}${plain ? ' region-badge--plain' : ' region'}`);

  // CSS hover-scale lives on the inner body: a CSS transform on the outer group would
  // replace its translate() attribute and fling the chip to the plot's top-left corner.
  const body = el('g', {}, 'region-badge__body');
  g.appendChild(body);

  const pillW = (plain ? Math.max(text.length, minChars) * 8 + 14 : text.length > 2 ? 40 : 34) * k;
  const pillH = 22 * k;
  const r = pillH / 2;

  // Larger transparent hit area
  body.appendChild(el('rect', {
    x: -pillW / 2 - 6,
    y: -pillH / 2 - 6,
    width: pillW + 12,
    height: pillH + 12,
    fill: 'transparent',
  }, 'region-hit'));

  // Crisp pill background
  body.appendChild(el('rect', {
    x: -pillW / 2,
    y: -pillH / 2,
    width: pillW,
    height: pillH,
    rx: r,
    ry: r,
    fill: 'var(--surface)',
    stroke: `var(--${colorVar})`,
    'stroke-width': (1.6 * Math.max(k, 0.7)).toFixed(2),
  }, 'region-badge__pill'));

  // Label text
  const txt = el('text', {
    x: 0,
    y: 0.5,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    fill: `var(--${textVar})`,
    'font-size': `${(11.5 * k).toFixed(2)}px`,
    'font-weight': '700',
    'font-family': '"IBM Plex Sans", sans-serif',
    'letter-spacing': `${(0.5 * k).toFixed(2)}px`,
  }, 'region-badge__text');
  txt.textContent = text;
  body.appendChild(txt);

  layer.appendChild(g);
  return { x0: center.x - pillW / 2, x1: center.x + pillW / 2, y0: center.y - pillH / 2, y1: center.y + pillH / 2 };
}

// Dimension line for the per-unit subsidy or tax, just right of Q1: it spans Pc to Pp there,
// which is exactly the vertical gap between the original and shifted supply curves at Q1, so it
// tracks the new equilibrium as the sliders move. The amount sits in a chip beside it that
// shrinks with the gap, and drops out when the gap or the room to the plot edge is too small.
// `caption` replaces the money text; without one the amount is a computed number, shown
// only at full detail (resolveLayers only turns the bracket on there by default).
function drawWedgeBracket(layer, result, caption, detail, { arrow = false, chip = true } = {}) {
  const isTax = result.mode === 'tax';
  const amount = Math.abs(result.Pp - result.Pc);
  if (!(amount > 0)) return;
  // The arrow runs up the Q1 line itself, from e2 (just clear of its dot) to S1, instead of
  // standing beside it like the bracket (subsidy only).
  const x = sx(result.Q) + (arrow ? 0 : 12);
  const yTop = sy(Math.max(result.Pp, result.Pc)), yBot = sy(Math.min(result.Pp, result.Pc)) - (arrow ? 9 : 0);
  if (yBot - yTop < 8 || x + 8 > M.left + plotW) return;
  // The subsidy arrow is the government's money, so it takes the government's purple.
  const ink = arrow ? 'var(--gov)' : 'var(--ink)';
  const stroke = { stroke: ink, 'stroke-width': arrow ? 2 : 1.4 };
  const g = el('g', {}, arrow ? 'subsidy-arrow' : 'subsidy-bracket');
  if (arrow) {
    g.appendChild(el('line', { x1: x, y1: yBot, x2: x, y2: yTop + 7, ...stroke }));
    g.appendChild(el('polygon', { points: `${x},${yTop} ${x - 5},${yTop + 10} ${x + 5},${yTop + 10}`, fill: ink }));
  } else {
    g.appendChild(el('line', { x1: x, y1: yTop, x2: x, y2: yBot, ...stroke }));
    g.appendChild(el('line', { x1: x - 4, y1: yTop, x2: x + 4, y2: yTop, ...stroke }));
    g.appendChild(el('line', { x1: x - 4, y1: yBot, x2: x + 4, y2: yBot, ...stroke }));
  }
  layer.appendChild(tag(g, arrow ? 'subsidyArrow' : isTax ? 'taxBracket' : 'subsidyBracket'));
  const text = caption ?? (detail === 'full' ? fmtMoney(amount) : null);
  if (!text || !chip) return;
  const halfW = (text.length * 8 + 14) / 2;
  const k = Math.min(1, (yBot - yTop - 2 * BADGE_PAD) / 22);
  const cy = (yTop + yBot) / 2;
  // The chip goes right of the bracket, or left of it when a label is in the way there.
  const spots = [x + 10 + halfW, x - 10 - halfW];
  const free = (cx) => {
    const r = { x0: cx - halfW * k, x1: cx + halfW * k, y0: cy - 11 * k, y1: cy + 11 * k };
    return r.x0 >= M.left && r.x1 <= M.left + plotW && !placedLabels.some((o) => rectsOverlap(r, o));
  };
  const cx = spots.find(free);
  if (k >= BADGE_MIN_SCALE && cx != null) {
    drawRegionBadge(g, { id: isTax ? 'tax-amount' : 'subsidy-amount', text, center: { x: cx, y: cy, scale: k }, colorVar: arrow ? 'gov' : 'ink', textVar: arrow ? 'gov' : undefined, title: isTax ? 'Tax per unit' : 'Subsidy per unit', plain: true });
  }
}

// A lens's lost surplus before it is explained: the whole gap the tax opened, one neutral
// colour, split at Qtax into the part the government collects (the burden) and the part
// nobody gets (the deadweight loss). Fades out as each half takes its own colour.
function drawLostSurplus(fills, layer, result, lens) {
  const consumer = lens === 'consumer-lens';
  const polys = consumer ? [result.consumerWedgePoly, result.dwlConsumerPoly] : [result.producerWedgePoly, result.dwlProducerPoly];
  if (!isOpenTax(result) || !(polys[0]?.length >= 3)) return;
  const g = el('g', {}, 'lost-surplus');
  g.style.pointerEvents = 'none';
  for (const poly of polys) {
    if (!(poly?.length >= 3)) continue;
    g.appendChild(el('polygon', { points: pts(poly), fill: 'var(--surface)' }));
    g.appendChild(el('polygon', { points: pts(poly), fill: 'color-mix(in srgb, var(--ink) 22%, transparent)' }, 'lost-surplus__fill'));
  }
  fills.appendChild(tag(g, 'lost'));
  // The split goes on top of the curves and guide lines, so it isn't lost under the Qtax one.
  const x = sx(result.Q);
  const split = el('line', { x1: x, y1: sy(result.Pc), x2: x, y2: sy(result.Pstar), stroke: 'var(--ink)', 'stroke-width': 2.4 }, 'lost-surplus__split');
  split.style.pointerEvents = 'none';
  layer.appendChild(tag(split, 'lost'));
}

// The Society lens's lost surplus, a side at a time so the whole gap can be grey (no white left between the two)
// and each side then takes its own colours: the burden band and its half of the deadweight loss, grey, with the
// split at Qtax running from Pc down to Pe (consumers) or from Pe down to Pp (producers).
function drawLostHalf(fills, layer, result, side) {
  const consumer = side === 'consumer';
  const polys = consumer ? [result.consumerWedgePoly, result.dwlConsumerPoly] : [result.producerWedgePoly, result.dwlProducerPoly];
  if (!isOpenTax(result) || !(polys[0]?.length >= 3)) return;
  const name = consumer ? 'lostConsumer' : 'lostProducer';
  const g = el('g', {}, 'lost-surplus');
  g.style.pointerEvents = 'none';
  for (const poly of polys) {
    if (!(poly?.length >= 3)) continue;
    g.appendChild(el('polygon', { points: pts(poly), fill: 'var(--surface)' }));
    g.appendChild(el('polygon', { points: pts(poly), fill: 'color-mix(in srgb, var(--ink) 22%, transparent)' }, 'lost-surplus__fill'));
  }
  fills.appendChild(tag(g, name));
  const x = sx(result.Q);
  const split = el('line', { x1: x, y1: sy(consumer ? result.Pc : result.Pstar), x2: x, y2: sy(consumer ? result.Pstar : result.Pp), stroke: 'var(--ink)', 'stroke-width': 2.4 }, 'lost-surplus__split');
  split.style.pointerEvents = 'none';
  layer.appendChild(tag(split, name));
}

// The two halves named, each on a short leader on the empty side of Pe (below it for the
// consumer lens, above it for the producer lens). The right-hand note sits a line further out.
function drawLostNotes(layer, result, lens, captions) {
  if (!captions.lostLeft && !captions.lostRight) return;
  // The Society lens names the whole grey gap from below it: the box from under Pp, the loss from under its slanted edge.
  if (lens === 'societal') {
    const g = el('g', {}, 'lost-notes');
    const xQ = sx(result.Q), xE = sx(result.Qstar), xMid = (xQ + xE) / 2;
    const leader = (x, yFrom, text, anchor, extra) => {
      const yText = yFrom + 26 + extra;
      g.appendChild(el('line', { x1: x, y1: yFrom + 2, x2: x, y2: yText - 14, stroke: 'var(--ink)', 'stroke-width': 1.2 }));
      g.appendChild(teachingLabel(anchor === 'start' ? x - 6 : x, yText, text, anchor));
    };
    if (captions.lostLeft) leader((sx(0) + xQ) / 2, sy(result.Pp), captions.lostLeft, 'middle', 0);
    if (captions.lostRight) leader(xMid, sy(s1Cost(result, result.Q + (result.Qstar - result.Q) / 2)), captions.lostRight, 'start', 20);
    layer.appendChild(tag(g, 'lostNote'));
    return;
  }
  const dir = lens === 'consumer-lens' ? 1 : -1;
  const yEdge = sy(result.Pstar);
  const g = el('g', {}, 'lost-notes');
  const note = (xLead, text, row, anchor) => {
    const yText = yEdge + dir * (26 + row * 20);
    g.appendChild(el('line', { x1: xLead, y1: yEdge + dir * 2, x2: xLead, y2: yText - dir * 14 + (dir > 0 ? 0 : 4), stroke: 'var(--ink)', 'stroke-width': 1.2 }));
    g.appendChild(teachingLabel(anchor === 'start' ? xLead - 6 : xLead, yText, text, anchor));
  };
  const xQ = sx(result.Q), xE = sx(result.Qstar);
  if (captions.lostLeft) note((sx(0) + xQ) / 2, captions.lostLeft, 0, 'middle');
  if (captions.lostRight) note((xQ + xE) / 2, captions.lostRight, 1, 'start');
  layer.appendChild(tag(g, 'lostNote'));
}

// The quantity the tax is collected on: a purple bracket under the x axis from 0 to Qtax with
// "$20 tax × 52.5 units traded" beneath it, so the box that follows reads as tax times units.
// Needs the band the page reserves under the axis (`reserveGapBand`).
function drawQtyBracket(layer, result, text) {
  const x0 = sx(0), x1 = sx(result.Q), y = M.top + plotH + BRACKET_DROP;
  if (x1 - x0 < 2) return;
  const stroke = { stroke: 'var(--gov)', 'stroke-width': 2.2 };
  const g = mark(el('g', {}, 'qty-bracket'), 'gov');
  g.appendChild(el('line', { x1: x0, y1: y, x2: x1, y2: y, ...stroke }));
  g.appendChild(el('line', { x1: x0, y1: y - 5, x2: x0, y2: y + 5, ...stroke }));
  g.appendChild(el('line', { x1, y1: y - 5, x2: x1, y2: y + 5, ...stroke }));
  layer.appendChild(tag(g, 'qtyBracket'));
  if (!text) return;
  // The label fades in rather than wiping, so it isn't squashed by the bracket's grow.
  const lbl = el('text', { x: ((x0 + x1) / 2).toFixed(1), y: y + 20, 'text-anchor': 'middle', fill: 'var(--gov)' }, 'bracket-label qty-bracket__label');
  lbl.textContent = text;
  lbl.setAttribute('data-layer', 'qtyBracket');
  if (layerEnter.has('qtyBracket')) lbl.classList.add('layer-enter');
  layer.appendChild(lbl);
}

// The other side of the box: the tax per unit as a purple bracket left of the price axis,
// Pp to Pc, named in its own rotated label. Needs the left band `reserveDimBands` makes.
function drawTaxHeight(layer, result, text) {
  const x = 46, yTop = sy(Math.max(result.Pc, result.Pp)), yBot = sy(Math.min(result.Pc, result.Pp));
  if (yBot - yTop < 2) return;
  const stroke = { stroke: 'var(--gov)', 'stroke-width': 2.2 };
  const g = mark(el('g', {}, 'tax-height'), 'gov');
  g.appendChild(el('line', { x1: x, y1: yTop, x2: x, y2: yBot, ...stroke }));
  g.appendChild(el('line', { x1: x - 5, y1: yTop, x2: x + 5, y2: yTop, ...stroke }));
  g.appendChild(el('line', { x1: x - 5, y1: yBot, x2: x + 5, y2: yBot, ...stroke }));
  if (text) {
    // Outside the plot, so it skips teachingLabel (which keeps labels inside it).
    const lx = x - 9, ly = (yTop + yBot) / 2;
    const t = el('text', { x: lx.toFixed(1), y: ly.toFixed(1), 'text-anchor': 'middle', fill: 'var(--gov)', transform: `rotate(-90 ${lx} ${ly})` }, 'teach-label');
    t.textContent = text;
    g.appendChild(t);
  }
  layer.appendChild(tag(g, 'taxHeight'));
}

// The government perspective's per-unit tax: a purple arrow down the Q line from Pc to Pp
// (the tax is the gap between what buyers pay and what sellers keep), named to its left,
// over the box the strips then fill. `text` is "$20 tax" or "8% tax".
function drawTaxArrow(layer, result, text) {
  const x = sx(result.Q), yTop = sy(result.Pc) + 9, yBot = sy(result.Pp);
  if (yBot - yTop < 10) return;
  const g = mark(el('g', {}, 'tax-arrow'), 'gov');
  g.appendChild(arrowMark(x, yTop, x, yBot, { color: 'var(--gov)', width: 2.4, head: 10 }));
  if (text) g.appendChild(teachingLabel(x - 10, (yTop + yBot) / 2 + 5, text, 'end', 'var(--gov)'));
  layer.appendChild(tag(g, 'taxArrow'));
}

// ---- Subsidy Explain teaching marks ----
// Marks that only the subsidy page's Explain steps ask for (by layer name). Every number
// they print comes from the step's `captions`, so the chart never invents a figure.

// The loaves the "every loaf" step drops an arrow from (Qe = 60 among them, so one arrow
// starts at e1).
const DROP_QS = [15, 30, 45, 60, 75, 90];
const NARROW_PLOT_W = 420;
const DEFAULT_LOAF_Q = 45;

function arrowMark(x1, y1, x2, y2, { color = 'var(--ink)', width = 2, head = 9 } = {}) {
  const g = el('g');
  const a = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - head * Math.cos(a), by = y2 - head * Math.sin(a);
  const px = -Math.sin(a) * head * 0.5, py = Math.cos(a) * head * 0.5;
  g.appendChild(el('line', { x1, y1, x2: bx, y2: by, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' }));
  g.appendChild(el('polygon', { points: `${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`, fill: color }));
  return g;
}

// Kept inside the plot: a label that would run past an edge slides back in along its line.
function teachingLabel(x, y, text, anchor = 'start', color = 'var(--ink)') {
  const r = labelRect(x, y, text, anchor);
  if (r.x1 > M.left + plotW - 2) x -= r.x1 - (M.left + plotW - 2);
  else if (r.x0 < M.left + 2) x += M.left + 2 - r.x0;
  const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': anchor, fill: color }, 'teach-label');
  t.textContent = text;
  placedLabels.push(labelRect(x, y, text, anchor));
  return t;
}

// What it costs to bake loaf q: its point on S1.
const s1Cost = (result, q) => result.Smin + result.slopeS * q;

// Loaf q's cost, and what the bakery still needs from the customer once the government pays
// its share (the point on S2 straight below).
function loafPoint(result, q) {
  const cost = s1Cost(result, q);
  return { cost, customer: cost - (result.Pp - result.Pc) };
}

// Where a loaf's price lands for the customer (on S2): a hollow blue dot.
const customerDot = (x, y, cls) => mark(el('circle', { cx: x, cy: y, r: 5, fill: 'var(--surface)', stroke: 'var(--demand)', 'stroke-width': 2 }, cls), 'customer');

// A dimension line from (x1, y1) to (x2, y2), horizontal or vertical, with a tick `tick` px
// either side across each end. Appended to g, which is returned.
function dimLine(g, x1, y1, x2, y2, tick, style) {
  const [ax, ay] = x1 === x2 ? [tick, 0] : [0, tick];
  g.appendChild(el('line', { x1, y1, x2, y2, ...style }));
  for (const [x, y] of [[x1, y1], [x2, y2]]) g.appendChild(el('line', { x1: x - ax, y1: y - ay, x2: x + ax, y2: y + ay, ...style }));
  return g;
}

// A teaching name centred in a polygon (a surplus triangle or marginal band), if it fits there.
function nameArea(layer, poly, text, layerName, markKey) {
  if (!text || !(poly?.length >= 3)) return;
  const c = polygonCentroid(poly, placedLabels, { halfW: (text.length * CHAR_PX) / 2 + 2, halfH: 8, min: 0.9 });
  if (c?.scale != null) layer.appendChild(mark(tag(teachingLabel(c.x, c.y + 5, text, 'middle'), layerName), markKey));
}

// Every teaching mark carries a `data-mark` naming what it stands for (the bakery's cost, the
// government's money, the customer's price, the old market price, a quantity). The Explain
// card colours the same words in its text with the same key, and hovering one lights up its
// marks on the chart, so the sentence and the picture point at each other.
const MARK_COLOR = { cost: 'var(--supply)', gov: 'var(--gov)', customer: 'var(--demand)', cs: 'var(--demand)', mcs: 'var(--demand)', ps: 'var(--supply)', mps: 'var(--supply)', pe: 'var(--ink)', qe: 'var(--ink)', qty: 'var(--ink)', dwl: 'var(--dwl-line)' };
// `key` may name several terms (space-separated): the equilibrium point answers to both Pe and Qe.
function mark(node, key) { node.setAttribute('data-mark', key); return node; }

// The draggable cost dot: one point on S1 with guides to both axes, a value tag on each
// axis (which loaf, what it costs), and a ring that says "grab me".
const DRAG_CHAR_PX = 11; // average glyph width of the enlarged (22px) dragging labels
function drawCostDot(layer, result, captions, q, target) {
  const x = sx(q), y = sy(s1Cost(result, q));
  const g = tag(el('g', {}, 'cost-dot'), 'costDot');
  const guide = { stroke: 'var(--supply)', 'stroke-width': 1.2, 'stroke-dasharray': '4,3' };
  if (target) drawDotTarget(g, result, captions, target);
  g.appendChild(mark(el('line', { x1: M.left, y1: y, x2: x, y2: y, ...guide }), 'cost'));
  g.appendChild(mark(el('line', { x1: x, y1: y, x2: x, y2: M.top + plotH, ...guide }), 'qty'));
  if (captions.dotCostTag) g.appendChild(mark(teachingLabel(M.left + 6, y - 6, captions.dotCostTag, 'start', 'var(--supply)'), 'cost'));
  // While the student drags, pages.css enlarges these labels (DRAG_CHAR_PX per character), so
  // they're placed with room for the big size: they flip to the other side of the dot or guide
  // instead of running off the plot.
  const roomLeft = (text, ax) => ax - text.length * DRAG_CHAR_PX >= M.left + 2;
  if (captions.dotQtyTag) {
    const fitsRight = x + 6 + captions.dotQtyTag.length * DRAG_CHAR_PX <= M.left + plotW - 2;
    g.appendChild(mark(teachingLabel(fitsRight ? x + 6 : x - 6, M.top + plotH - 8, captions.dotQtyTag, fitsRight ? 'start' : 'end'), 'qty'));
  }
  const handle = el('g', { tabindex: '0', role: 'slider', 'aria-label': 'Loaf on the supply curve', 'aria-valuemin': '0', 'aria-valuemax': String(QMAX), 'aria-valuenow': String(Math.round(q)) }, 'cost-dot__handle');
  handle.appendChild(el('circle', { cx: x, cy: y, r: 22, fill: 'transparent' }));
  handle.appendChild(el('circle', { cx: x, cy: y, r: 13, fill: 'none', stroke: 'var(--supply)', 'stroke-width': 1.5, 'stroke-opacity': 0.5 }, 'cost-dot__ring'));
  handle.appendChild(mark(el('circle', { cx: x, cy: y, r: 7, fill: 'var(--supply)', stroke: 'var(--surface)', 'stroke-width': 2 }), 'cost'));
  g.appendChild(handle);
  if (captions.dotLabel) {
    const left = roomLeft(captions.dotLabel, x - 18);
    g.appendChild(mark(teachingLabel(left ? x - 18 : x + 18, y - 14, captions.dotLabel, left ? 'end' : 'start', 'var(--supply)'), 'cost'));
  }
  if (captions.dragHint) drawDragHint(g, result, x, y, captions.dragHint);
  layer.appendChild(g);
}

// The halo on S1 the student is asked to bring the dot to (a nudge, like a game's "go here"
// marker): a pulsing ring with a short label under it. Once reached it settles into a solid ring.
function drawDotTarget(g, result, captions, { q, tolerance, reached }) {
  const x = sx(q), y = sy(s1Cost(result, q));
  // Big enough to hold `tolerance` loaves either side along S1 (never smaller than the old 20px),
  // so a dot that looks inside the circle is inside it.
  const r = Math.max(20, tolerance * Math.hypot(plotW / QMAX, (result.slopeS * plotH) / PMAX));
  const t = el('g', {}, reached ? 'dot-target dot-target--reached' : 'dot-target');
  t.appendChild(el('circle', { cx: x, cy: y, r, fill: 'color-mix(in srgb, var(--supply) 16%, transparent)', stroke: 'var(--supply)', 'stroke-width': 2.5, 'stroke-dasharray': reached ? 'none' : '5,4' }, 'dot-target__ring'));
  if (captions.targetHint) {
    // S1 runs up-right, so the space under the ring is clear.
    t.appendChild(teachingLabel(x, y + r + 20, captions.targetHint, 'middle', 'var(--supply)')).classList.add('dot-target__label');
  }
  g.appendChild(mark(t, 'cost'));
}

// Until the student first grabs the dot: a bobbing "drag me" pill pointing at it, and a
// chevron either side of it along S1, nudging outward to show which way it moves.
function drawDragHint(g, result, x, y, text) {
  const hint = el('g', {}, 'drag-hint');
  // S1's direction on screen (up and to the right), as a unit vector.
  const dx = plotW / QMAX, dy = -(result.slopeS * plotH) / PMAX;
  const len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  for (const dir of [1, -1]) {
    const cx = x + dir * 30 * ux, cy = y + dir * 30 * uy;
    // A chevron pointing along the line, away from the dot.
    const tip = [cx + dir * 6 * ux, cy + dir * 6 * uy];
    const back = [cx - dir * 2 * ux, cy - dir * 2 * uy];
    const px = -uy * 6, py = ux * 6;
    const ch = el('polyline', {
      points: `${back[0] + px},${back[1] + py} ${tip[0]},${tip[1]} ${back[0] - px},${back[1] - py}`,
      fill: 'none', stroke: 'var(--supply)', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }, 'drag-hint__chevron');
    ch.style.setProperty('--nx', `${(dir * 6 * ux).toFixed(1)}px`);
    ch.style.setProperty('--ny', `${(dir * 6 * uy).toFixed(1)}px`);
    hint.appendChild(ch);
  }
  // The pill sits below-right of the dot: S1 runs up-right, so the space under it is clear,
  // and the dot's own label is above-left.
  const w = text.length * 7.6 + 20, h = 24;
  const bx = clampN(x + 16, M.left + 4, M.left + plotW - w - 4), by = clampN(y + 30, M.top + 4, M.top + plotH - h - 4);
  const bob = el('g', {}, 'drag-hint__bob');
  bob.appendChild(el('line', { x1: bx + 10, y1: by + 2, x2: x + 8, y2: y + 9, stroke: 'var(--supply)', 'stroke-width': 2, 'stroke-linecap': 'round' }));
  bob.appendChild(el('rect', { x: bx, y: by, width: w, height: h, rx: h / 2 }, 'drag-hint__pill'));
  const t = el('text', { x: bx + w / 2, y: by + h / 2 + 4.5, 'text-anchor': 'middle' }, 'drag-hint__text');
  t.textContent = text;
  bob.appendChild(t);
  hint.appendChild(bob);
  placedLabels.push({ x0: bx, x1: bx + w, y0: by, y1: by + h });
  g.appendChild(hint);
}

// The "Subsidise!" button the loaf waits on (an SVG button: pointer, Enter and Space all work; the
// page listens for clicks on `.subsidise-btn`). A raised purple pill below-right of the dot, in the
// clear space between S1 above and demand below, joined to the dot by a short tail. It stays put (a
// moving target is harder to press); a ring pinging outward from it (a sibling, so it doesn't count
// as the button's own box) is what says "press me".
function drawSubsidiseButton(g, x, y, text) {
  const w = text.length * 11 + 40, h = 42;
  const bx = clampN(x + 16, M.left + 4, M.left + plotW - w - 4), by = clampN(y + 24, M.top + 4, M.top + plotH - h - 4);
  const wrap = mark(el('g', {}, 'subsidise'), 'gov');
  wrap.appendChild(el('line', { x1: bx + 16, y1: by + 3, x2: x + 5, y2: y + 6, stroke: 'var(--gov)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
  wrap.appendChild(el('rect', { x: bx - 3, y: by - 3, width: w + 6, height: h + 6, rx: (h + 6) / 2, fill: 'none' }, 'subsidise-ring'));
  const btn = el('g', { tabindex: '0', role: 'button', 'aria-label': text }, 'subsidise-btn');
  btn.appendChild(el('rect', { x: bx, y: by, width: w, height: h, rx: h / 2 }, 'subsidise-btn__pill'));
  const t = el('text', { x: bx + w / 2, y: by + h / 2 + 6, 'text-anchor': 'middle' }, 'subsidise-btn__text');
  t.textContent = text;
  btn.appendChild(t);
  wrap.appendChild(btn);
  placedLabels.push({ x0: bx, x1: bx + w, y0: by, y1: by + h });
  g.appendChild(wrap);
}

// One loaf: a dot on S1 (its cost), an arrow straight down by the subsidy, and a hollow dot
// where it lands (what the customer has to pay), with dashed guides back to the price axis.
// On the step that brings it in, the arrow draws down slowly and the landing point and its
// labels follow once it arrives.
function drawLoafDrop(layer, result, captions, q, armed = false, guides = true) {
  const { cost, customer } = loafPoint(result, q);
  const x = sx(q), yTop = sy(cost), yBot = sy(Math.max(0, customer));
  const entering = layerEnter.has('loafDrop');
  const g = el('g', { 'data-layer': 'loafDrop' }, 'loaf-drop');
  const later = (node) => { if (entering) node.classList.add('loaf-drop__later'); return node; };
  const guide = { stroke: 'var(--ink-muted)', 'stroke-width': 1, 'stroke-dasharray': '3,3' };
  if (guides) {
    g.appendChild(mark(el('line', { x1: M.left, y1: yTop, x2: x, y2: yTop, ...guide }), 'cost'));
    // The loaf's number on the quantity axis: what the card's "loaf 45" lights up.
    g.appendChild(mark(el('line', { x1: x, y1: yTop, x2: x, y2: M.top + plotH, ...guide }), 'qty'));
  }
  // Armed: the dot waits on S1 with a Subsidise! button; nothing drops until it's pressed.
  const dropped = !armed && yBot - yTop > 14;
  if (dropped) {
    if (guides) g.appendChild(later(mark(el('line', { x1: M.left, y1: yBot, x2: x, y2: yBot, ...guide }), 'customer')));
    const arrow = mark(arrowMark(x, yTop + 6, x, yBot - 6, { width: 2.4, color: 'var(--gov)' }), 'gov');
    if (entering) arrow.classList.add('loaf-drop__arrow');
    g.appendChild(arrow);
    g.appendChild(later(customerDot(x, yBot)));
  }
  g.appendChild(mark(el('circle', { cx: x, cy: yTop, r: 5, fill: 'var(--supply)' }), 'cost qty'));
  if (captions.loafCost) g.appendChild(mark(teachingLabel(x - 10, yTop - 9, captions.loafCost, 'end', 'var(--supply)'), 'cost'));
  // Labels sit right of the arrow, or left of it when the plot edge is too close.
  const longest = Math.max((captions.loafGov ?? '').length, (captions.loafCustomer ?? '').length);
  const right = x + 10 + longest * CHAR_PX <= M.left + plotW - 2;
  const lx = right ? x + 10 : x - 10, anchor = right ? 'start' : 'end';
  if (dropped && captions.loafGov) {
    const t = mark(teachingLabel(lx, (yTop + yBot) / 2 + 4, captions.loafGov, anchor, 'var(--gov)'), 'gov');
    if (entering) t.classList.add('loaf-drop__arrow-label');
    g.appendChild(t);
  }
  if (dropped && captions.loafCustomer) g.appendChild(later(mark(teachingLabel(lx, yBot + 18, captions.loafCustomer, anchor, 'var(--demand)'), 'customer')));
  if (armed && captions.subsidiseButton) drawSubsidiseButton(g, x, yTop, captions.subsidiseButton);
  layer.appendChild(g);
}

// Every loaf: the same drop from several points on S1. The arrow tips line up into S2,
// which is why S2 is parallel to S1 and exactly the subsidy lower. On the step that brings
// them in, the arrows draw down one after another.
// `faint` (Play's shift): just a whisper of an arrow, no dots, since S2 slides down with it.
function drawLoafDrops(layer, result, skipQ = null, faint = false) {
  // Clipped to the plot, so an arrow whose tip would land below zero runs under the x axis and
  // is cut off there instead of vanishing.
  const g = el('g', { 'clip-path': 'url(#plotClip)' }, 'loaf-drops');
  const entering = layerEnter.has('loafDrops');
  DROP_QS.forEach((q, i) => {
    // The student's own loaf (still drawn, as it was, by the loafDrop layer) has its arrow already.
    if (skipQ != null && Math.abs(q - skipQ) < DROP_QS[0] / 2) return;
    // A subsidy's arrows go down from S1 to S2; a tax's go up (S2 is S1 plus the tax, which for an ad valorem tax grows with q).
    const taxed = result.mode === 'tax';
    const s2 = shiftedSupplyParams(result);
    const { cost, customer } = taxed ? { cost: s1Cost(result, q), customer: s2.Smin + s2.slopeS * q } : loafPoint(result, q);
    if (cost > PMAX || (taxed && customer > PMAX)) return;
    const x = sx(q), yTop = sy(cost), yBot = sy(customer);
    const one = mark(el('g', {}, 'loaf-drops__one'), 'gov');
    if (!faint) one.appendChild(el('circle', { cx: x, cy: yTop, r: 3.5, fill: 'var(--supply)' }));
    if (faint) one.setAttribute('opacity', '0.28');
    if (taxed) {
      if (yTop - yBot > 12) one.appendChild(arrowMark(x, yTop - 4, x, yBot + 2, { width: 1.8, head: 8, color: 'var(--gov)' }));
    } else if (yBot - yTop > 12) one.appendChild(arrowMark(x, yTop + 4, x, yBot - 2, { width: 1.8, head: 8, color: 'var(--gov)' }));
    if (entering) {
      one.classList.add('layer-drop');
      one.style.setProperty('--d', String(i * 250)); // ms at 1× pace; pages.css scales it
    }
    g.appendChild(one);
    // The same hollow blue dot the single loaf ends on: where the customer's price lands (S2).
    if (!faint && !taxed && yBot - yTop > 12 && customer >= 0) {
      const tip = customerDot(x, yBot, 'loaf-drops__tip');
      if (entering) {
        tip.classList.add('loaf-drops__tip--enter');
        tip.style.setProperty('--d', String(i * 250));
      }
      g.appendChild(tip);
    }
  });
  g.setAttribute('data-layer', 'loafDrops');
  if (layerExit.has('loafDrops')) g.classList.add('layer-exit'); // Play's shift: the arrows fade once S2 has landed
  layer.appendChild(g);
}

// Revenue is an area: price (height) × quantity (width). Two dimension lines name the sides,
// each drawn outside the plot and parallel to its own axis, like the gap bracket: the height
// left of the price axis (rising from 0 to Pp), the width below the quantity axis (sweeping
// from 0 to Q_subsidy), then the rectangle fills in left to right and says what it is. The
// bakery's revenue is what it receives per loaf (Pp) times the loaves sold (Q_subsidy).
// pages.css times the four beats; on re-render without `enter` they all just sit there.
// Needs the margins `reserveDimBands` makes.
function drawRevenueDims(layer, result, captions) {
  const x0 = sx(0), x1 = sx(result.Q), yBase = sy(0), yTop = sy(result.Pp);
  const stroke = { 'stroke-width': 1.6, 'stroke-linecap': 'round' };
  const entering = layerEnter.has('revenueDims');
  // Height: left of the tick labels and price symbols, from the x axis level up to Pp.
  const hx = 46;
  const h = dimLine(mark(el('g', {}, 'rev-dim rev-dim--height'), 'cost'), hx, yBase, hx, yTop, 5, { stroke: 'var(--supply)', ...stroke });
  // Width: under the Q symbols, from 0 out to Q.
  const wy = yBase + BRACKET_DROP;
  const w = dimLine(mark(el('g', {}, 'rev-dim rev-dim--width'), 'qty'), x0, wy, x1, wy, 5, { stroke: 'var(--ink)', ...stroke });
  // Outside the plot, so these skip teachingLabel (which keeps labels inside it).
  const outside = (x, y, text, color, extra = {}) => {
    const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), fill: color, ...extra }, 'teach-label');
    t.textContent = text;
    return t;
  };
  const labels = [];
  if (captions.revPrice) {
    const ly = (yBase + yTop) / 2, lx = hx - 9;
    labels.push(mark(outside(lx, ly, captions.revPrice, 'var(--supply)', { 'text-anchor': 'middle', transform: `rotate(-90 ${lx} ${ly})` }), 'cost'));
    labels[0].classList.add('rev-dim__label--height');
  }
  if (captions.revQty) {
    const lbl = mark(outside((x0 + x1) / 2, wy + 18, captions.revQty, 'var(--ink)', { 'text-anchor': 'middle' }), 'qty');
    lbl.classList.add('rev-dim__label--width');
    labels.push(lbl);
  }
  const g = el('g', {}, 'rev-dims');
  g.append(h, w, ...labels);
  if (entering) g.classList.add('rev-dims--enter');
  layer.appendChild(tag(g, 'revenueDims'));
}

function drawRevenueBox(fills, layer, result, captions) {
  if (!(result.Pp > 0) || !(result.Q > 0)) return;
  const x0 = sx(0), x1 = sx(result.Q), yTop = sy(result.Pp), yBase = sy(0);
  const g = el('g', { 'data-layer': 'revenueBox', 'data-mark': 'cost', 'data-region': 'bakery-revenue' }, 'region region--fill rev-box');
  g.appendChild(el('rect', { x: x0, y: yTop, width: x1 - x0, height: yBase - yTop, fill: 'var(--supply)', 'fill-opacity': 0.16, stroke: 'var(--supply)', 'stroke-width': 1.6 }, 'rev-box__rect'));
  if (layerEnter.has('revenueBox')) g.classList.add('rev-box--enter');
  fills.appendChild(g);
  const text = captions.revBox && (captions.revBox.length * CHAR_PX + 40 <= x1 - x0 ? captions.revBox : captions.revBoxShort);
  if (text) {
    // Just under the customer-price line, left of the curves: clear of the Pp/Pe/Pc lines
    // above it, and above S1/S2, which are still low down this far left.
    const lbl = mark(teachingLabel(x0 + 34, Math.max(yTop, sy(result.Pc)) + 24, text, 'start', 'var(--supply)'), 'cost');
    lbl.classList.add('rev-box__label');
    if (layerEnter.has('revenueBox')) lbl.classList.add('rev-box__label--enter');
    layer.appendChild(lbl);
  }
}

// One loaf, two prices, as two stacked brackets beside Q_subsidy: first what the customer
// pays (0 up to Pc, rising from the axis), then the government's part on top (Pc up to Pp),
// then the arrow from e2 up to S1 (layer subsidyArrow) with what the bakery receives.
function drawPriceBrackets(layer, result, captions) {
  const x = sx(result.Q) + 14;
  const y0 = sy(0), yc = sy(result.Pc), yp = sy(result.Pp);
  const entering = layerEnter.has('priceBrackets');
  // Leaving the step: the brackets stay (their colours carry on into the revenue step), but the
  // customer's and government's figures fade, and the bakery's total swells; the next step
  // draws it at that size (captions.totalBig) so it doesn't snap back.
  const leaving = layerExit.has('priceBrackets');
  const g = el('g', { 'data-layer': 'priceBrackets' }, entering ? 'price-brackets price-brackets--enter' : 'price-brackets');
  const bracket = (yA, yB, color, cls, key) => dimLine(mark(el('g', {}, `price-bracket ${cls}`), key), x, yA, x, yB, 5, { stroke: color, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
  g.appendChild(bracket(y0 - 1, yc + 2, 'var(--demand)', 'pb-customer', 'customer'));
  if (yc - yp > 4) g.appendChild(bracket(yc - 2, yp, 'var(--gov)', 'pb-gov', 'gov'));
  // Labels right of the brackets; on a phone they don't fit, and the readout carries them.
  const longest = Math.max(...[captions.customer, captions.gov, captions.total].map((t) => (t ?? '').length));
  const lx = x + 12;
  if (lx + longest * CHAR_PX <= M.left + plotW) {
    const exiting = leaving ? ' layer-exit' : '';
    if (captions.customer) g.appendChild(mark(teachingLabel(lx, yc + 20, captions.customer, 'start', 'var(--demand)'), 'customer')).setAttribute('class', `teach-label pb-customer-label${exiting}`);
    if (captions.gov && yc - yp > 16) g.appendChild(mark(teachingLabel(lx, (yp + yc) / 2 + 5, captions.gov, 'start', 'var(--gov)'), 'gov')).setAttribute('class', `teach-label pb-gov-label${exiting}`);
    if (captions.total) g.appendChild(mark(teachingLabel(lx, yp - 7, captions.total, 'start', 'var(--supply)'), 'cost')).setAttribute('class', `teach-label pb-total-label${leaving ? ' pb-total-label--grow' : captions.totalBig ? ' pb-total-label--big' : ''}`);
  }
  layer.appendChild(g);
}

// Government spending, one loaf at a time: a strip the height of the subsidy for each loaf
// sold, side by side out to Q_subsidy. On the step that brings them in they fill in left to
// right, so the box is seen being paid for loaf by loaf.
// One strip, a quarter of the way along, is picked out and named (captions.strip) so
// "a strip = one loaf" can be seen before the eye takes in the whole row.
// `fromRight`: the strips fill in from Q_subsidy back to the axis instead of from the axis out (Play's Government lens).
function drawGovStrips(fills, layer, result, captions, fromRight = false) {
  const perUnit = Math.abs(result.Pp - result.Pc);
  if (!(perUnit > 0) || !(result.Q > 0)) return;
  const g = el('g', { 'data-region': result.mode === 'tax' ? 'tax-revenue' : 'subsidy-cost', 'data-layer': 'govStrips', 'data-mark': 'gov' }, 'region region--fill gov-strips');
  const n = Math.ceil(result.Q);
  const pick = Math.floor(n / 4);
  const entering = layerEnter.has('govStrips');
  // Leaving: the strips fade out together (the page crossfades them into the solid fill).
  if (layerExit.has('govStrips')) g.classList.add('layer-exit');
  const yTop = sy(Math.max(result.Pp, result.Pc)), h = sy(Math.min(result.Pp, result.Pc)) - yTop;
  const gap = sx(1) - sx(0) >= 5 ? 1 : 0.5;
  for (let i = 0; i < n; i++) {
    const xa = sx(i), xb = sx(Math.min(i + 1, result.Q));
    const r = el('rect', {
      x: xa, y: yTop, width: Math.max(0, xb - xa), height: h, stroke: 'var(--surface)', 'stroke-width': gap,
      fill: 'var(--gov)', 'fill-opacity': i === pick ? 0.6 : 0.2,
    }, i === pick ? 'gov-strip gov-strip--pick' : 'gov-strip');
    if (entering) {
      r.classList.add('layer-enter');
      r.style.setProperty('--d', String(Math.round(((fromRight ? n - 1 - i : i) / n) * 1400))); // ms at 1× pace
    }
    g.appendChild(r);
  }
  fills.appendChild(g);
  if (captions.strip) {
    const x = (sx(pick) + sx(pick + 1)) / 2;
    const lbl = el('g', { 'data-layer': 'govStrips', 'data-mark': 'gov' }, 'gov-strips__name');
    lbl.appendChild(el('line', { x1: x, y1: yTop - 3, x2: x, y2: yTop - 14, stroke: 'var(--gov)', 'stroke-width': 1.4 }));
    lbl.appendChild(teachingLabel(x, yTop - 19, captions.strip, 'middle', 'var(--gov)'));
    if (entering) lbl.classList.add('layer-enter');
    if (layerExit.has('govStrips')) lbl.classList.add('layer-exit');
    layer.appendChild(lbl);
  }
}

// The box's width as a dimension line just under it, 0 to Q_subsidy, so "height × width"
// reads straight off the picture alongside the height bracket at Q_subsidy.
function drawBoxWidth(layer, result, captions) {
  const x0 = sx(0), x1 = sx(result.Q), y = sy(result.Pc) + 14;
  const g = dimLine(mark(el('g', {}, 'box-width'), 'gov'), x0 + 2, y, x1, y, 4, { stroke: 'var(--gov)', 'stroke-width': 1.4 });
  if (captions.width) g.appendChild(teachingLabel((x0 + x1) / 2, y + 17, captions.width, 'middle', 'var(--gov)'));
  layer.appendChild(tag(g, 'boxWidth'));
}

// The box's name and total, centred in it; the short form (`boxShort`) when the full one is
// wider than the box (phones).
function drawBoxLabel(layer, result, captions) {
  if (!captions.box || !(result.govCost > 0.005)) return;
  const x = (sx(0) + sx(result.Q)) / 2, y = (sy(result.Pc) + sy(result.Pp)) / 2 + 5;
  const fits = (text) => text.length * CHAR_PX + 8 <= sx(result.Q) - sx(0);
  const text = fits(captions.box) ? captions.box : captions.boxShort;
  if (text) layer.appendChild(mark(tag(teachingLabel(x, y, text, 'middle', 'var(--gov)'), 'boxLabel'), 'gov'));
}

// The readout: the step's key values in a small table in the plot's top-right corner, each
// row in the colour of the mark it describes. `captions.readout` is [{ label, value, mark }].
// Its rectangle is reserved before the curve names are placed, so they step around it.
const READOUT = { pad: 8, rowH: 19, fontPx: 13, gapPx: 14 };
function readoutBox(rows) {
  const labelW = Math.max(...rows.map((r) => r.label.length)) * 6.3;
  const valueW = Math.max(...rows.map((r) => r.value.length)) * 7.4;
  const w = Math.min(plotW - 16, labelW + valueW + READOUT.gapPx + 2 * READOUT.pad + 10);
  const h = rows.length * READOUT.rowH + 2 * READOUT.pad - 4;
  const x1 = M.left + plotW - 6;
  return { x0: x1 - w, x1, y0: M.top + 6, y1: M.top + 6 + h, w, h };
}
function drawReadout(layer, rows) {
  const b = readoutBox(rows);
  const g = el('g', { 'data-layer': 'readout' }, layerEnter.has('readout') ? 'readout layer-enter' : 'readout');
  g.appendChild(el('rect', { x: b.x0, y: b.y0, width: b.w, height: b.h, rx: 6, fill: 'var(--surface)', stroke: 'var(--hairline-2)', 'stroke-width': 1 }, 'readout__box'));
  rows.forEach((r, i) => {
    const y = b.y0 + READOUT.pad + i * READOUT.rowH + 10;
    const row = mark(el('g', {}, 'readout__row'), r.mark ?? 'none');
    row.appendChild(el('rect', { x: b.x0 + READOUT.pad, y: y - 9, width: 4, height: 12, rx: 1, fill: MARK_COLOR[r.mark] ?? 'var(--ink)' }));
    const lbl = el('text', { x: b.x0 + READOUT.pad + 10, y: y + 1 }, 'readout__label');
    lbl.textContent = r.label;
    const val = el('text', { x: b.x1 - READOUT.pad, y: y + 1, 'text-anchor': 'end', fill: MARK_COLOR[r.mark] ?? 'var(--ink)' }, 'readout__value');
    val.textContent = r.value;
    row.append(lbl, val);
    g.appendChild(row);
  });
  layer.appendChild(g);
}

function drawSubsidyTeachingMarks(layer, result, captions, options) {
  if (layerOn.has('costDot')) drawCostDot(layer, result, captions, options.dotQ ?? DEFAULT_LOAF_Q, options.dotTarget == null ? null : { q: options.dotTarget, tolerance: options.dotTargetTolerance ?? 0, reached: Boolean(options.dotTargetReached) });
  // A surplus triangle's name (before the subsidy: the plain CS / PS region).
  for (const [key, tri, plainPoly, triPoly] of [
    ['cs', 'csTriangle', result.csPoly, result.csTrianglePoly],
    ['ps', 'psTriangle', result.psPoly, result.psTrianglePoly],
  ]) {
    const name = layerOn.has(tri) ? tri : layerOn.has(key) ? key : null;
    if (name) nameArea(layer, result.mode === 'subsidy' ? triPoly : plainPoly, captions[key], name, key);
  }
  // A tax's arrows (the Society lens's shift) go up from S1; it has no other teaching marks.
  if (result.mode === 'tax' && layerOn.has('loafDrops')) { drawLoafDrops(layer, result, null, Boolean(options.faintDrops)); return; }
  if (result.mode !== 'subsidy') return;
  if (layerOn.has('loafDrops')) drawLoafDrops(layer, result, layerOn.has('loafDrop') ? (options.loafQ ?? DEFAULT_LOAF_Q) : null, Boolean(options.faintDrops));
  if (layerOn.has('loafDrop')) drawLoafDrop(layer, result, captions, options.loafQ ?? DEFAULT_LOAF_Q, Boolean(options.loafArmed), options.loafGuides !== false);
  if (layerOn.has('priceBrackets')) drawPriceBrackets(layer, result, captions);
  if (layerOn.has('revenueDims')) drawRevenueDims(layer, result, captions);
  if (layerOn.has('boxWidth')) drawBoxWidth(layer, result, captions);
  if (layerOn.has('boxLabel')) drawBoxLabel(layer, result, captions);
  // A marginal band's name, centred in it, once the band is drawn.
  for (const [key, layerName, poly] of [['mps', 'marginalPs', result.marginalPsPoly], ['mcs', 'marginalCs', result.marginalCsPoly]]) {
    if (layerOn.has(layerName)) nameArea(layer, poly, captions[key], layerName, key);
  }
}

// Turns a pointer's screen x into a quantity on the chart's axis (for the draggable cost
// dot). The chart is drawn 1 unit = 1 CSS px from the svg's left edge.
export function quantityAtClientX(svg, clientX) {
  const width = +svg.dataset.chartW || measuredWidth(svg);
  const pw = width - M.left - M.right;
  const x = clientX - svg.getBoundingClientRect().left;
  return ((x - M.left) / pw) * QMAX;
}

// Where a tax/subsidy wedge band's chip goes: the band's left end, mid-height. The curves
// cross the band's right end (at Q), so the left end is the part of the band they never touch.
// `fit` overrides the chip's size for other labels (IB perfect's plain area names).
function wedgeChipCenter(poly, text, avoid, fit = {}) {
  if (!poly || poly.length < 4) return null;
  const pts = poly.map(([q, p]) => [sx(q), sy(p)]);
  const ys = pts.map((pt) => pt[1]);
  const halfW = fit.halfW ?? (text.length > 2 ? 40 : 34) / 2;
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  // Start at the band's left end and step right until a label or chip isn't in the way,
  // keeping the first spot where the chip fits full size (or else the largest fit seen).
  const xEnd = Math.max(...pts.map((pt) => pt[0]));
  let best = { x: pts[0][0] + halfW + 10, y, scale: null };
  for (let x = best.x; x <= xEnd - halfW; x += 12) {
    const scale = badgeFitScale(pts, x, y, { ...fit, halfW, avoid });
    if (scale === 1) return { x, y, scale };
    if (scale != null && (best.scale == null || scale > best.scale)) best = { x, y, scale };
  }
  return best;
}

// Draws the region badges (CS/PS/DWL, plus the consumer/producer wedge badges on a tax or
// subsidy) when enabled. Each is sized against the badges already placed so none overlap.
function drawSurplusBadges(layer, result) {
  const badgeLayer = el('g', {}, 'surplus-badges');
  const placed = [...placedLabels];
  const add = (spec, center) => {
    const rect = drawRegionBadge(badgeLayer, { ...spec, center });
    if (rect) { placed.push(rect); placedLabels.push(rect); }
  };
  if (result.mode === 'tax') {
    add({ id: 'tax-consumer', text: 'CB', colorVar: 'burden-consumer', textVar: 'ink', title: 'Consumer Burden' },
      wedgeChipCenter(result.consumerWedgePoly, 'CB', placed));
    add({ id: 'tax-producer', text: 'PB', colorVar: 'burden-producer', textVar: 'ink', title: 'Producer Burden' },
      wedgeChipCenter(result.producerWedgePoly, 'PB', placed));
  }
  if (result.mode === 'subsidy') {
    add({ id: 'subsidy-cost', text: 'Gov', colorVar: 'gov', title: 'Government Spending' },
      wedgeChipCenter(result.wedgePoly, 'Gov', placed));
  }
  // On a subsidy CS/PS also span the striped band, so their chips go in the part outside it.
  const surplus = [
    ['cs', 'CS', result.csOnlyPoly || result.csPoly, 'demand', 'Consumer Surplus'],
    ['ps', 'PS', result.psOnlyPoly || result.psPoly, 'supply', 'Producer Surplus'],
    ['dwl', 'DWL', result.dwlPoly, 'dwl-line', 'Deadweight Loss'],
  ];
  for (const [id, text, poly, colorVar, title] of surplus) {
    if (!(poly && poly.length >= 3)) continue;
    add({ id, text, colorVar, title }, polygonCentroid(poly, placed));
  }
  layer.appendChild(tag(badgeLayer, 'badges'));
}

// Explorer focus: one value chip on the focused area, in its own group (not the surplus
// badges) so a focused view never carries the badge set. It is a label, not a region.
function drawFocusChip(layer, result, focus) {
  const g = el('g', {}, 'chart-focus-chip');
  if (focus === 'overlap') {
    // Just names the two free-market surplus triangles; the growing areas carry no figures.
    const sub = result.mode === 'subsidy';
    placeFocusChip(g, sub ? OLD_SURPLUS_CHIPS.cs(result) : { label: 'CS', value: result.CS, colorVar: 'demand' }, sub ? 'cs-original' : 'cs', sub ? result.csTrianglePoly : result.csPoly);
    placeFocusChip(g, sub ? OLD_SURPLUS_CHIPS.ps(result) : { label: 'PS', value: result.PS, colorVar: 'supply' }, sub ? 'ps-original' : 'ps', sub ? result.psTrianglePoly : result.psPoly);
    if (g.childNodes.length) layer.appendChild(tag(g, 'focusChip'));
    return;
  }
  if (LENSES[focus]) {
    for (const [id, spec, poly] of LENSES[focus].chips(result)) placeFocusChip(g, spec, id, poly);
    if (g.childNodes.length) layer.appendChild(tag(g, 'focusChip'));
    return;
  }
  if (focus === 'societal') {
    const chips = result.mode === 'tax' ? [
      ['taxConsumer', 'consumer-burden', 'CB', result.consumerIncidence, result.consumerWedgePoly, 'burden-consumer'],
      ['taxProducer', 'producer-burden', 'PB', result.producerIncidence, result.producerWedgePoly, 'burden-producer'],
      ['dwl', 'dwl', 'DWL', result.DWL, result.dwlPoly, 'dwl-line'],
    ] : [
      ['marginalCs', 'marginal-cs', 'mCS', result.marginalCS, result.marginalCsPoly, 'demand-alt', 'ink'],
      ['marginalPs', 'marginal-ps', 'mPS', result.marginalPS, result.marginalPsPoly, 'supply-alt', 'ink'],
      ['dwl', 'dwl', 'DWL', result.DWL, result.dwlPoly, 'dwl-line'],
    ];
    for (const [layerName, id, label, value, poly, colorVar, textVar] of chips) {
      if (layerOn.has(layerName)) placeFocusChip(g, { label, value, colorVar, textVar }, id, poly);
    }
    if (g.childNodes.length) layer.appendChild(tag(g, 'focusChip'));
    return;
  }
  const spec = focusSpec(result, focus);
  if (!spec) return;
  // A subsidised CS/PS lens splits the surplus in two, and each chip names only its own area:
  // the free-market triangle is "old CS/PS" (its figure excludes the band), the band is mCS/mPS.
  const oldChip = result.mode === 'subsidy' && OLD_SURPLUS_CHIPS[focus];
  if (oldChip) placeFocusChip(g, oldChip(result), `${focus}-original`, spec.chipPoly?.length >= 3 ? spec.chipPoly : spec.poly);
  else placeFocusChip(g, spec, focus, spec.chipPoly?.length >= 3 ? spec.chipPoly : spec.poly);
  // A subsidised CS/PS also names its marginal band, so both areas read in the one view
  // (once the band is drawn).
  const band = result.mode === 'subsidy' ? MARGINAL_BANDS[focus] : null;
  const surplusChips = g.childNodes.length;
  if (band && layerOn.has(band.layer)) {
    placeFocusChip(g, { label: band.label, value: result[band.value], colorVar: band.colorVar, textVar: 'ink' }, band.region, result[band.poly]);
  }
  if (!g.childNodes.length) return;
  tag(g, 'focusChip');
  // The band's chip arrives with the band; the surplus chip beside it is already on screen, so
  // only the newcomer fades in (fading the whole group made the old chip vanish and come back).
  if (surplusChips && g.childNodes.length > surplusChips && g.classList.contains('layer-enter')) {
    g.classList.remove('layer-enter');
    g.lastChild.classList.add('layer-enter');
  }
  layer.appendChild(g);
}

const FOCUS_CHIP_CHARS = 10;   // "mCS $2,250"
const OLD_CHIP_CHARS = 13;    // "old CS $2,250"

// The free-market triangle's chip once a subsidy has added its marginal band: only the triangle's
// own area, called "old" because the IB-perfect diagram's CS/PS counts the band too.
const OLD_SURPLUS_CHIPS = {
  cs: (r) => ({ label: 'old CS', value: r.csTriangleArea, colorVar: 'demand', minChars: OLD_CHIP_CHARS }),
  ps: (r) => ({ label: 'old PS', value: r.psTriangleArea, colorVar: 'supply', minChars: OLD_CHIP_CHARS }),
};

const MARGINAL_BANDS = {
  cs: { label: 'mCS', value: 'marginalCS', poly: 'marginalCsPoly', colorVar: 'demand-alt', region: 'marginal-cs', layer: 'marginalCs' },
  ps: { label: 'mPS', value: 'marginalPS', poly: 'marginalPsPoly', colorVar: 'supply-alt', region: 'marginal-ps', layer: 'marginalPs' },
};

function placeFocusChip(g, spec, id, chipPoly) {
  if (!(spec.value > 0.005) || !(chipPoly?.length >= 3)) return;
  const text = `${spec.label} ${fmtMoney(spec.value)}`;
  // Sized as if for FOCUS_CHIP_CHARS characters, so the pill stays one width as the figure
  // gains digits; otherwise it would fail to fit the band at each digit boundary and jump.
  const fit = { halfW: (Math.max(text.length, FOCUS_CHIP_CHARS) * 8 + 14) / 2 };
  // Centred in its area, shrinking with it; drawRegionBadge drops the chip once it can't fit.
  const c = polygonCentroid(chipPoly, placedLabels, fit);
  if (!c) return;
  drawRegionBadge(g, { id, text, center: c, colorVar: spec.colorVar, textVar: spec.textVar, title: spec.label, plain: true, minChars: spec.minChars ?? FOCUS_CHIP_CHARS });
}

// IB perfect: the areas named in plain text, as a student would write them on an exam
// diagram — no pill, not clickable. Each name falls back to its short form when the full
// one doesn't fit its region, and is left off if neither does.
const AREA_NAME_PX = 7;   // rough advance width per character at 13px
const AREA_NAME_HALF_H = 9;
// Names may shrink a little to fit a thin band (exam diagrams name them regardless) but no
// further, so they stay readable on a projector.
const AREA_NAME_MIN_SCALE = 0.8;
function drawAreaNames(layer, result, areaLabels = 'full') {
  const g = el('g', {}, 'area-names');
  const placed = [...placedLabels];
  const halfW = (text) => (text.length * AREA_NAME_PX + 4) / 2;
  const place = (forms, centerFor) => {
    for (const text of forms) {
      const c = centerFor(text);
      if (!c || c.scale == null) continue;
      const k = c.scale;
      const t = el('text', { x: c.x.toFixed(1), y: c.y.toFixed(1), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, 'area-name');
      if (k < 1) t.setAttribute('style', `font-size: ${(13 * k).toFixed(1)}px`);
      t.textContent = text;
      g.appendChild(t);
      const rect = { x0: c.x - halfW(text) * k, x1: c.x + halfW(text) * k, y0: c.y - AREA_NAME_HALF_H * k, y1: c.y + AREA_NAME_HALF_H * k };
      placed.push(rect);
      placedLabels.push(rect);
      return;
    }
  };
  const fit = (text) => ({ halfW: halfW(text), halfH: AREA_NAME_HALF_H, min: AREA_NAME_MIN_SCALE });
  const inPoly = (poly) => (text) => polygonCentroid(poly, placed, fit(text));
  const inWedge = (poly) => (text) => wedgeChipCenter(poly, text, placed, fit(text));
  const isSubsidy = result.mode === 'subsidy';
  const isTax = result.mode === 'tax';
  // Subsidy and tax names follow the area-label setting: full names everything, half only
  // the bands the policy adds (marginal CS/PS, or the two burdens), none nothing. Other
  // modes ignore it.
  const names = isSubsidy || isTax ? areaLabels : 'full';
  if (names === 'none') { layer.appendChild(tag(g, 'areaNames')); return; }
  if (isTax) {
    place(['consumer burden', 'CB'], inWedge(result.consumerWedgePoly));
    place(['producer burden', 'PB'], inWedge(result.producerWedgePoly));
  }
  if (isSubsidy && names === 'full' && result.govCost > 0.005) {
    // Just right of the box, centred between Pc and Pp; dropped if it leaves the plot or
    // runs into another label.
    const y = (sy(result.Pc) + sy(result.Pp)) / 2;
    const x = sx(result.Q) + 12;
    for (const text of ['government spending', 'Gov']) {
      const w = text.length * AREA_NAME_PX + 4;
      const rect = { x0: x, x1: x + w, y0: y - AREA_NAME_HALF_H, y1: y + AREA_NAME_HALF_H };
      if (rect.x1 > M.left + plotW) continue;
      if (placed.some((r) => rect.x0 < r.x1 && rect.x1 > r.x0 && rect.y0 < r.y1 && rect.y1 > r.y0)) continue;
      const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'start', 'dominant-baseline': 'central' }, 'area-name');
      t.textContent = text;
      g.appendChild(t);
      placed.push(rect);
      placedLabels.push(rect);
      break;
    }
  }
  const surplus = [];
  if (!isSubsidy && names === 'full') {
    surplus.push([['CS'], result.csOnlyPoly || result.csPoly], [['PS'], result.psOnlyPoly || result.psPoly]);
  } else if (names === 'full') {
    surplus.push(
      [['CS'], layerOn.has('csTriangle') ? result.csTrianglePoly : (result.csOnlyPoly || result.csPoly)],
      [['PS'], layerOn.has('psTriangle') ? result.psTrianglePoly : (result.psOnlyPoly || result.psPoly)],
    );
  }
  if (names === 'full') surplus.push([isSubsidy || isTax ? ['deadweight loss', 'DWL'] : ['welfare loss', 'WL'], result.dwlPoly]);
  if (isSubsidy) {
    if (layerOn.has('marginalCs')) surplus.push([['marginal CS', 'mCS'], result.marginalCsPoly]);
    if (layerOn.has('marginalPs')) surplus.push([['marginal PS', 'mPS'], result.marginalPsPoly]);
  }
  for (const [forms, poly] of surplus) {
    if (poly && poly.length >= 3) place(forms, inPoly(poly));
  }
  layer.appendChild(tag(g, 'areaNames'));
}

// IB convention: the equilibrium point is named e1, and a second equilibrium e2 appears only
// when the intervention moves it (a tax or subsidy that still trades). A ceiling/floor leaves
// the market in disequilibrium at the control price, so it gets no e2.
//
// Placement is computed, not searched: every line through the point (both curves, and the
// dashed guide/price lines) is a ray, the label goes on the bisector of the widest gap
// between neighbouring rays, and just far enough out to clear both rays bounding it. That
// moves continuously with the sliders. An earlier version tried a ring of fixed spots and
// took the first clear one, which made the label flick between spots on every slider step
// (a 1px curve move changed which marginal spot was "clear").
// Half-extents of "e" + its hanging subscript (the text is drawn so its ink is centred on
// the computed point, see EQ_BASELINE), the dot's radius, and the clearance kept from both.
const EQ_HALF_W = 8, EQ_HALF_H = 7, EQ_PAD = 3, EQ_DOT_R = 5, EQ_BASELINE = 2;
// A gap opening rightward wins a near-tie, so e1 stays on the free-market side by default.
const EQ_RIGHT_BONUS = 0.15; // radians
function eqLabelCenter(pt, rays) {
  const angs = rays.map((r) => ((r % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((m, n) => m - n);
  let best = null;
  angs.forEach((a0, i) => {
    const a1 = i + 1 < angs.length ? angs[i + 1] : angs[0] + 2 * Math.PI;
    const gap = a1 - a0;
    if (gap < 1e-3) return;
    const mid = a0 + gap / 2;
    const score = gap + (Math.cos(mid) > 0.2 ? EQ_RIGHT_BONUS : 0);
    if (!best || score > best.score) best = { score, gap, mid };
  });
  const h = Math.min(best.gap / 2, Math.PI / 2);
  // Distance from the label's centre to each bounding ray is t·sin(h); it must exceed the
  // label box's half-extent measured along that ray's normal.
  let t = 0;
  for (const edge of [best.mid - h, best.mid + h]) {
    const nx = -Math.sin(edge), ny = Math.cos(edge);
    t = Math.max(t, (EQ_HALF_W * Math.abs(nx) + EQ_HALF_H * Math.abs(ny) + EQ_PAD) / Math.max(Math.sin(h), 0.15));
  }
  // ...and the label must clear the dot itself, which matters when the gap is wide (flat
  // curves) and the rays alone would let it sit right on top of the point.
  const bx = Math.cos(best.mid), by = Math.sin(best.mid);
  t = Math.max(t, EQ_HALF_W * Math.abs(bx) + EQ_HALF_H * Math.abs(by) + EQ_DOT_R + EQ_PAD);
  t = Math.min(t, 50);
  return {
    x: clampN(pt.x + t * bx, M.left + EQ_HALF_W, M.left + plotW - EQ_HALF_W),
    y: clampN(pt.y + t * by, M.top + EQ_HALF_H, M.top + plotH - EQ_HALF_H),
  };
}

function drawEquilibriumLabels(layer, result, segs) {
  const dir = ([x1, y1, x2, y2]) => Math.atan2(y2 - y1, x2 - x1);
  const both = (seg) => [dir(seg), dir(seg) + Math.PI];
  const LEFT = Math.PI, RIGHT = 0, DOWN = Math.PI / 2, UP = -Math.PI / 2;
  // e1: both curves, plus the dashed guides to Pe (left) and Qe (down).
  const points = [{ sub: '1', x: sx(result.Qstar), y: sy(result.Pstar), opacity: 1, rays: [...both(segs.d), ...both(segs.s), LEFT, DOWN] }];
  if (hasOpenWedge(result)) {
    const x = sx(result.Q), y = sy(result.Pc);
    // e2 grows out of e1 as the intervention tweens on, rather than popping in on top of it.
    const d = Math.hypot(x - points[0].x, y - points[0].y);
    const opacity = Math.min(1, Math.max(0, (d - 8) / 16));
    // e2 sits on D and S2, where the Pc line (wedge outline to the left, price line to the
    // right) crosses the drop line to Q1. A subsidy's wedge box also has its edge running up
    // to Pp, and its dimension line just up and to the right (drawWedgeBracket).
    const rays = [...both(segs.d), ...both(segs.s2), LEFT, RIGHT, DOWN];
    if (result.mode === 'subsidy') rays.push(UP, -Math.PI / 4);
    // A tax's dimension line runs down and to the right of e2, to Pp.
    if (result.mode === 'tax' && layerOn.has('taxBracket')) rays.push(Math.PI / 4);
    if (opacity > 0) points.push({ sub: '2', x, y, opacity, rays });
  }
  for (const pt of points) {
    const name = `eq${pt.sub}`;
    if (!layerOn.has(name)) continue;
    const c = eqLabelCenter(pt, pt.rays);
    layer.appendChild(tag(subscriptLabel('e', pt.sub, {
      x: (c.x - 7).toFixed(1), y: (c.y + EQ_BASELINE).toFixed(1), 'data-eq': pt.sub,
      ...(pt.opacity < 1 ? { opacity: pt.opacity.toFixed(2) } : {}),
    }, 'eq-label'), name));
    // Registered so the surplus chips placed afterwards step around it.
    placedLabels.push({ x0: c.x - EQ_HALF_W, x1: c.x + EQ_HALF_W, y0: c.y - EQ_HALF_H, y1: c.y + EQ_HALF_H });
  }
}

// Redraws at the new pixel size whenever the card changes width (window resize, the
// columns stacking at the mobile breakpoint), replaying the last result.
function watchSize(svg) {
  if (svg._chartObserver || typeof ResizeObserver === 'undefined') return;
  svg._chartObserver = new ResizeObserver(() => {
    if (!svg._lastResult || Math.abs(measuredWidth(svg) - +svg.dataset.chartW) < 1) return;
    renderMarketChart(svg, svg._lastResult, svg._lastOptions);
  });
  svg._chartObserver.observe(svg);
}

function ensureDynamicLayer(svg, gapBand, dimBands = false, growForBands = false) {
  const width = measuredWidth(svg);
  // sizeChart() sets module-level geometry, so run it on every render: two charts of
  // different widths on one page must each draw against their own size.
  sizeChart(width, gapBand, dimBands, growForBands);
  const bands = `${gapBand}${dimBands}${growForBands}`;
  if (svg.dataset.chartInit === 'true' && Math.abs(width - +svg.dataset.chartW) < 1 && svg.dataset.gapBand === bands) return svg.querySelector('.dynamic-layer');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.dataset.chartW = String(width);
  svg.dataset.gapBand = bands;
  svg.setAttribute('viewBox', `0 0 ${VBW} ${VBH}`);
  drawGridAndAxes(svg);
  const layer = el('g', {}, 'dynamic-layer');
  svg.appendChild(layer);
  svg.dataset.chartInit = 'true';
  return layer;
}

// Draws a curve's name. A caption replaces the short name ("S1") with the caller's text,
// keeping a leading "S1"/"S2" as S + subscript so it still reads as the curve's symbol.
function curveName(text, base, sub, attrs) {
  if (text == null) return subscriptLabel(base, sub, attrs);
  const sym = base + sub;
  if (!text.startsWith(sym)) {
    const t = el('text', attrs, 'curve-label');
    t.textContent = text;
    return t;
  }
  const t = subscriptLabel(base, sub, attrs);
  if (text.length > sym.length) t.appendChild(document.createTextNode(text.slice(sym.length)));
  return t;
}

export function renderMarketChart(svg, result, options = {}) {
  svg._lastResult = result;
  // The resize replay redraws the same picture, so it must not replay the entry animation.
  const { enter: _enter, grow: _grow, exit: _exit, ...replayOptions } = options;
  svg._lastOptions = replayOptions;
  // 'full' = every chip and explainer; 'clean' = no chips; 'ib' = exactly what an exam
  // diagram shows (plain area names, no numbers). See the onboarding/detail-settings spec.
  const detail = options.detail ?? 'full';
  svg.dataset.detail = detail;
  watchSize(svg);
  // A ceiling/floor page reserves the band for its gap bracket even while the control is off,
  // so switching it on doesn't resize the plot.
  // Explain reserves room outside the axes (left and below) for the revenue step's price and
  // quantity dimension lines, on every step, so the plot doesn't resize when they arrive.
  const layer = ensureDynamicLayer(svg, Boolean(options.reserveGapBand) || isPriceControl(result), Boolean(options.reserveDimBands), Boolean(options.growForBands));
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  placedLabels = [];
  curvePoints = [];
  controlPlan = null;
  const showSurplusLabels = options.showSurplusLabels ?? result.showSurplusLabels ?? false;
  const on = resolveLayers(result, { ...options, detail, showSurplusLabels });
  layerOn = on;
  // enter/grow apply to this render only: the dynamic layer is rebuilt every time, so a
  // later render without them (a slider tick) draws no animation classes.
  layerEnter = new Set(options.enter ?? []);
  layerGrow = new Set(options.grow ?? []);
  layerExit = new Set(options.exit ?? []);   // layers fading out on this render, about to be dropped
  const captions = { ...(options.captions ?? {}) };
  // A worded curve caption ("S1 = what it costs to make") can't fit a phone-width plot without
  // running over the other curves, so narrow charts keep the bare symbol; the Explain card's
  // text says the same thing.
  // A lone S1 still has room for its words; the readout moves into the Explain card (whose
  // own copy pages.css shows at phone width), and the dot keeps just its axis tags.
  const narrow = plotW < NARROW_PLOT_W;
  if (narrow && on.has('supply2')) { delete captions.s1; delete captions.s2; }
  if (narrow) { delete captions.readout; delete captions.dotLabel; }
  const focusId = FOCUS_IDS.includes(options.focus) ? options.focus : null;
  if (focusId) svg.dataset.focus = focusId; else delete svg.dataset.focus;
  // A named entry sequence for the Explain steps whose marks arrive one after another (pages.css, [data-seq]).
  if (options.sequence) svg.dataset.seq = options.sequence; else delete svg.dataset.seq;
  // A curve a step is pointing at ('demand' | 'supply'): pages.css thickens it (Play's Society lens).
  const prevEmphasis = svg.dataset.emphasis;
  if (options.emphasis) svg.dataset.emphasis = options.emphasis; else delete svg.dataset.emphasis;

  if (!result.noTrade) {
    // All shaded regions go in one group clipped to the plot area, so a region whose true
    // shape runs past the axes (steep curves) is cut off at the edge rather than distorted.
    const fills = el('g', { 'clip-path': 'url(#plotClip)' }, 'fills');
    layer.appendChild(fills);
    // Grouped under data-region so regionExplainers.js can hover/click the whole shaded
    // area as one unit (currently wired up on the price-ceiling page only).
    if (on.has('cs')) {
      const csG = el('g', { 'data-region': 'cs' }, 'region region--fill');
      csG.appendChild(el('polygon', { points: pts(result.csPoly), fill: 'var(--demand-fill)' }, 'cs-fill'));
      fills.appendChild(tag(csG, 'cs'));
    }
    if (on.has('ps')) {
      const psG = el('g', { 'data-region': 'ps' }, 'region region--fill');
      psG.appendChild(el('polygon', { points: pts(result.psPoly), fill: 'var(--supply-fill)' }, 'ps-fill'));
      fills.appendChild(tag(psG, 'ps'));
    }
    // IB perfect subsidy: the free-market triangles, then the two marginal bands over an
    // opaque backing. Degenerate (zero-amount) polygons are skipped, so no NaN or empty shapes.
    const bandFill = (layerName, region, poly, fill, backing, cls) => {
      if (!on.has(layerName) || !(poly && poly.length >= 3)) return;
      const g = el('g', { 'data-region': region }, 'region region--fill');
      if (backing) g.appendChild(el('polygon', { points: pts(poly), fill: 'var(--surface)' }, 'wedge-backing'));
      g.appendChild(el('polygon', { points: pts(poly), fill }, cls));
      fills.appendChild(tag(g, layerName));
    };
    // The triangles are the surplus before the subsidy (bounded by Pe), so they get their own
    // regions: tapping one explains and values the pre-subsidy CS/PS, not the subsidised one.
    bandFill('csTriangle', 'cs-original', result.csTrianglePoly, 'var(--demand-fill)', false, 'cs-fill');
    bandFill('psTriangle', 'ps-original', result.psTrianglePoly, 'var(--supply-fill)', false, 'ps-fill');
    // Each half's stripes run the way its surplus is growing: the consumer half (below Pe) top-left
    // to bottom-right, parallel to demand; the producer half (above Pe) bottom-left to top-right,
    // parallel to supply. Measured on screen so they track the sliders and the chart size.
    if (result.mode === 'subsidy') {
      const pxSlope = (slope) => (sy(0) - sy(slope)) / (sx(1) - sx(0));  // magnitude, px per px
      const stripeAngle = (m) => (-Math.atan(1 / m) * 180) / Math.PI;       // m = on-screen dy/dx
      svg.querySelector('#overlapStripesBelow')?.setAttribute('patternTransform', `rotate(${stripeAngle(pxSlope(result.slopeD)).toFixed(2)})`);
      svg.querySelector('#overlapStripesAbove')?.setAttribute('patternTransform', `rotate(${stripeAngle(-pxSlope(result.slopeS)).toFixed(2)})`);
    }
    // In the overlap view each band is the old CS/PS simply extended: its own colour, no backing,
    // so it blends with the surplus it grows into.
    if (focusId === 'overlap') {
      bandFill('marginalCs', 'marginal-cs', result.marginalCsPoly, 'var(--demand-fill)', false, 'cs-fill');
      bandFill('marginalPs', 'marginal-ps', result.marginalPsPoly, 'var(--supply-fill)', false, 'ps-fill');
    } else {
      bandFill('marginalCs', 'marginal-cs', result.marginalCsPoly, 'var(--demand-alt-fill)', true, 'wedge-fill wedge-fill--consumer');
      bandFill('marginalPs', 'marginal-ps', result.marginalPsPoly, 'var(--supply-alt-fill)', true, 'wedge-fill wedge-fill--producer');
    }
    if (result.mode === 'tax' || result.mode === 'subsidy') {
      // The wedge is split at the pre-intervention price into a consumer-incidence portion
      // (tinted with the demand color) and a producer-incidence portion (tinted with the
      // supply color), so the split itself — not just its dollar value in the stats panel —
      // visibly tracks relative elasticity as the sliders move.
      // For a subsidy the CS/PS surplus regions grow past the free-market baseline and
      // geometrically overlap this same band (unlike a tax, where they shrink away from
      // it), so an opaque backing polygon goes down first — otherwise the translucent
      // wedge tint would blend with the translucent surplus fill underneath and read
      // muddy on the subsidy page even though the tokens are identical to the tax page.
      // This fill step runs before both the DWL hatch (the DWL triangle sits inside this
      // same wedge rectangle, so it must be drawn after or the opaque backing erases it)
      // and the curves/gridlines/equilibrium dot (unlike the wedge outline and price
      // lines, which stay layered on top of those in drawWedgeLines below).
      const isSubsidy = result.mode === 'subsidy';
      if (isSubsidy && on.has('overlap')) {
        // CS and PS genuinely overlap inside the subsidy band, so both stay translucent and
        // the overlap is striped in both colours rather than an opaque backing that would
        // hide where each surplus really ends.
        const overlapG = el('g', { 'data-region': 'subsidy-overlap' }, 'region region--fill');
        // Stripes run parallel to the curve bounding each half: demand above Pe, supply below
        // (angles set above, with the extension patterns).
        // `overlapHalves` lets the overlap view draw one half at a time, and a half takes its own
        // grow name so its stripes can wipe in alongside the band it belongs to.
        const halves = options.overlapHalves ?? ['above', 'below'];
        for (const [half, poly, id] of [['above', result.overlapAbovePoly, 'overlapStripesAbove'], ['below', result.overlapBelowPoly, 'overlapStripesBelow']]) {
          if (!halves.includes(half) || !(poly && poly.length >= 3)) continue;
          const node = el('polygon', { points: pts(poly), fill: `url(#${id})` }, `overlap-fill overlap-fill--${half}`);
          if (layerGrow.has(half === 'above' ? 'overlapAbove' : 'overlapBelow')) node.classList.add('layer-grow');
          overlapG.appendChild(node);
        }
        if (overlapG.childNodes.length) fills.appendChild(tag(overlapG, 'overlap'));
      } else if (!isSubsidy) {
        // 'taxWedges' draws both burden bands; 'taxConsumer'/'taxProducer' draw one each, so
        // the tax page's Explain steps and Explorer foci can bring them in one at a time.
        for (const [half, region, poly, fill, cls] of [
          ['taxConsumer', 'tax-consumer', result.consumerWedgePoly, 'var(--burden-consumer-fill)', 'burden-fill burden-fill--consumer'],
          ['taxProducer', 'tax-producer', result.producerWedgePoly, 'var(--burden-producer-fill)', 'burden-fill burden-fill--producer'],
        ]) {
          if (!on.has(half) && !on.has('taxWedges')) continue;
          const g = el('g', { 'data-region': region }, 'region region--fill');
          g.appendChild(el('polygon', { points: pts(poly), fill: 'var(--surface)' }, 'wedge-backing'));
          g.appendChild(el('polygon', { points: pts(poly), fill }, cls));
          fills.appendChild(tag(g, on.has(half) ? half : 'taxWedges'));
        }
      }
    }
    if (on.has('lost') && LENSES[focusId]) drawLostSurplus(fills, layer, result, focusId);
    if (on.has('lostConsumer')) drawLostHalf(fills, layer, result, 'consumer');
    if (on.has('lostProducer')) drawLostHalf(fills, layer, result, 'producer');
    // Explain: the corner of the box nobody has been given yet, drawn grey with a question mark
    // until the deadweight loss step names it. Sits under the DWL hatch so that step cross-fades.
    if (on.has('dwlUnknown') && result.dwlPoly?.length >= 3) {
      const unknownG = el('g', {}, 'dwl-unknown');
      unknownG.style.pointerEvents = 'none';
      unknownG.appendChild(el('polygon', { points: pts(result.dwlPoly), fill: 'color-mix(in srgb, var(--ink) 20%, transparent)' }, 'dwl-unknown__fill'));
      const sp = result.dwlPoly.map(([q, p]) => [sx(q), sy(p)]);
      const ys = sp.map((pt) => pt[1]);
      const size = Math.min(24, (Math.max(...ys) - Math.min(...ys)) * 0.75);
      if (size >= 11) {
        const cx = sp.reduce((a, pt) => a + pt[0], 0) / sp.length, cy = sp.reduce((a, pt) => a + pt[1], 0) / sp.length;
        const q = el('text', { x: cx, y: cy + size * 0.35, 'text-anchor': 'middle', fill: 'var(--ink-secondary)', 'font-size': size.toFixed(1) }, 'dwl-unknown__mark');
        q.textContent = '?';
        unknownG.appendChild(q);
      }
      fills.appendChild(tag(unknownG, 'dwlUnknown'));
    }
    // The whole triangle, or (tax lenses) just the half above / below Pe.
    for (const [layerName, poly] of [['dwl', result.dwlPoly], ['dwlConsumer', result.dwlConsumerPoly], ['dwlProducer', result.dwlProducerPoly]]) {
      if (!(poly && poly.length >= 3) || !on.has(layerName)) continue;
      // For a tax or subsidy the DWL triangle sits inside the consumer/producer wedge
      // fill drawn above, and both are translucent — without an opaque backing the
      // wedge's demand-alt/supply-alt tint shows through the DWL hatch, reading as a
      // yellowish/bluish tinge instead of plain DWL red.
      const dwlG = el('g', { 'data-region': 'dwl' }, 'region region--fill');
      dwlG.appendChild(el('polygon', { points: pts(poly), fill: 'var(--surface)' }, 'dwl-backing'));
      dwlG.appendChild(el('polygon', { points: pts(poly), fill: 'url(#dwlHatch)' }, 'dwl-fill'));
      dwlG.appendChild(el('polygon', { points: pts(poly), fill: 'none', stroke: 'var(--dwl-line)', 'stroke-width': 1.8 }, 'dwl-outline'));
      fills.appendChild(tag(dwlG, layerName));
    }
    if (on.has('govFill') && result.wedgePoly && result.wedgePoly.length >= 3) {
      const govG = el('g', { 'data-region': result.mode === 'tax' ? 'tax-revenue' : 'subsidy-cost' }, 'region region--fill');
      govG.appendChild(el('polygon', { points: pts(result.wedgePoly), fill: 'var(--gov-fill)' }, 'gov-fill'));
      fills.appendChild(tag(govG, 'govFill'));
    }
    if ((result.mode === 'subsidy' || isOpenTax(result)) && on.has('govStrips')) drawGovStrips(fills, layer, result, captions, Boolean(options.stripsFromRight));
    if (result.mode === 'subsidy' && on.has('revenueBox')) drawRevenueBox(fills, layer, result, captions);
  }

  const shifted = shiftedSupplyParams(result);
  // S1 goes thin and dashed only once S2 is on screen to take over as the traded line (an
  // Explain step can draw a subsidy result with S1 alone).
  const s1Muted = shifted && on.has('supply2');

  const dSeg = clipDemand(result.Dmax, result.slopeD), sSeg = clipSupply(result.Smin, result.slopeS);
  if (on.has('demand')) {
    layer.appendChild(tag(el('line', { x1: sx(dSeg[0][0]), y1: sy(dSeg[0][1]), x2: sx(dSeg[1][0]), y2: sy(dSeg[1][1]), stroke: 'var(--demand)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, 'demand-curve'), 'demand'));
  }
  if (on.has('supply')) {
    layer.appendChild(tag(el('line', {
      x1: sx(sSeg[0][0]), y1: sy(sSeg[0][1]), x2: sx(sSeg[1][0]), y2: sy(sSeg[1][1]),
      stroke: 'var(--supply)', 'stroke-width': s1Muted ? 1.6 : 2.5, 'stroke-linecap': 'round',
      ...(s1Muted ? { 'stroke-dasharray': '6,4', 'stroke-opacity': focusId ? '0.35' : '0.55' } : {}),
    }, 'supply-curve'), 'supply'));
  }

  const s2Seg = shifted ? clipSupply(shifted.Smin, shifted.slopeS) : null;
  const screenSeg = (seg) => [sx(seg[0][0]), sy(seg[0][1]), sx(seg[1][0]), sy(seg[1][1])];
  // Only curves actually drawn push labels aside.
  for (const [seg, name] of [[dSeg, 'demand'], [sSeg, 'supply'], [s2Seg, 'supply2']]) if (seg && on.has(name)) sampleCurve(...screenSeg(seg));
  planControlLabels(result);
  // The readout's corner is spoken for before any curve name picks its spot.
  if (on.has('readout') && captions.readout?.length) placedLabels.push(readoutBox(captions.readout));

  if (on.has('demand')) {
    const dCand = { x: sx(dSeg[0][0]) + 10, y: demandLabelY(result, sy(dSeg[0][1]) - 7) };
    // Slides right if a steep curve would run through the text beside its start.
    const dPos = placeLabel([0, 14, 28, 42].map((dx) => ({ x: dCand.x + dx, y: dCand.y })), 'Demand', 'start');
    const dLbl = el('text', { x: dPos.x, y: dPos.y, fill: 'var(--demand)' }, 'curve-label');
    dLbl.textContent = 'Demand';
    layer.appendChild(tag(dLbl, 'demand'));
  }

  // A supply name sits just above its line's right-hand end; if that spot is taken (two
  // lines ending together, a ceiling/floor name, ...) it tries just below the end instead.
  const supplyPos = (seg, text, preferBelow) => {
    const x = sx(seg[1][0]) - 10, yEnd = sy(seg[1][1]);
    // Nearest-first: just above/below the end, then further down and further left. A spot
    // on the curve itself, a taken one, or one outside the plot is skipped by placeLabel.
    const dys = preferBelow ? [20, -8, 36, -24, 52] : [-8, 20, -24, 36, 52];
    const cands = [];
    for (const dx of [0, -60, -120]) for (const dy of dys) cands.push({ x: x + dx, y: labelY(yEnd + dy) });
    return placeLabel(cands, text);
  };

  if (shifted) {
    // Two supply lines on screen: label them S1 (original) / S2 (after the intervention)
    // instead of prose ("Supply (before)" / "Supply + tax") — shorter labels are far less
    // likely to collide with the Pc/Pp wedge labels once curves are dragged around.
    // Both sit at their own line's right-hand endpoint (not S1 on the left, S2 on the
    // right) so they read as a matched pair and never land near the Demand label on the left.
    // The upper of the two lines takes the spot above its end, the lower one below its end.
    const s2Lower = sy(s2Seg[1][1]) > sy(sSeg[1][1]);
    if (on.has('supply')) {
      const p1 = supplyPos(sSeg, captions.s1 ?? 'S1', s2Lower === false);
      layer.appendChild(tag(curveName(captions.s1, 'S', '1', { x: p1.x, y: p1.y, fill: 'var(--supply)', 'text-anchor': 'end', ...(s1Muted ? { 'fill-opacity': '0.6' } : {}) }), 'supply'));
    }
    if (on.has('supply2')) {
      layer.appendChild(tag(el('line', { x1: sx(s2Seg[0][0]), y1: sy(s2Seg[0][1]), x2: sx(s2Seg[1][0]), y2: sy(s2Seg[1][1]), stroke: 'var(--supply)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, 'supply-curve-shifted'), 'supply2'));
      const p2 = supplyPos(s2Seg, captions.s2 ?? 'S2', s2Lower === true);
      layer.appendChild(tag(curveName(captions.s2, 'S', '2', { x: p2.x, y: p2.y, fill: 'var(--supply)', 'text-anchor': 'end' }), 'supply2'));
    }
  } else if (on.has('supply')) {
    // An Explain step can name the lone supply curve ("S1 = what it costs to make").
    const pos = supplyPos(sSeg, captions.s1 ?? 'Supply', false);
    const sLbl = captions.s1 ? curveName(captions.s1, 'S', '1', { x: pos.x, y: pos.y, fill: 'var(--supply)', 'text-anchor': 'end' })
      : el('text', { x: pos.x, y: pos.y, fill: 'var(--supply)', 'text-anchor': 'end' }, 'curve-label');
    if (!captions.s1) sLbl.textContent = 'Supply';
    layer.appendChild(tag(sLbl, 'supply'));
  }

  if (!result.noTrade) {
    if (on.has('eq1')) {
      // Pe lights the point and the line across to the price axis; Qe the point and the line
      // down to the quantity axis (the point answers to both).
      layer.appendChild(tag(mark(el('line', { x1: sx(result.Qstar), y1: sy(result.Pstar), x2: sx(result.Qstar), y2: M.top + plotH, stroke: 'var(--ink-muted)', 'stroke-width': 1, 'stroke-dasharray': '3,3' }), 'qe'), 'eq1'));
      layer.appendChild(tag(mark(el('line', { x1: M.left, y1: sy(result.Pstar), x2: sx(result.Qstar), y2: sy(result.Pstar), stroke: 'var(--ink-muted)', 'stroke-width': 1, 'stroke-dasharray': '3,3' }), 'pe'), 'eq1'));
      const e1Focus = (focusId && !hasOpenWedge(result)) || (on.has('eq1Note') && captions.eq1Note);
      layer.appendChild(tag(mark(el('circle', { cx: sx(result.Qstar), cy: sy(result.Pstar), r: e1Focus ? 8 : 4.5, fill: 'var(--ink)' }, e1Focus ? 'eq-dot--focus' : undefined), 'pe qe'), 'eq1'));
      // "This is the price being traded": a note beside the dot, up and to the right where the
      // curves leave room.
      if (on.has('eq1Note') && captions.eq1Note) {
        const note = tag(mark(teachingLabel(sx(result.Qstar) + 16, sy(result.Pstar) - 14, captions.eq1Note, 'start'), 'pe qe'), 'eq1Note');
        layer.appendChild(note);
      }
    }

    drawWedgeLines(layer, result);

    if (isPriceControl(result)) {
      // Both ends of the shortage/excess supply: the point on each curve at the control
      // price, each dropped to its Qs/Qd label on the axis (Qd can sit past the edge).
      for (const q of [result.qs, result.qd]) {
        if (q > QMAX || !on.has('control')) continue;
        layer.appendChild(tag(el('line', { x1: sx(q), y1: sy(result.Pc), x2: sx(q), y2: M.top + plotH, stroke: 'var(--ink-muted)', 'stroke-width': 1, 'stroke-dasharray': '1,3' }), 'control'));
        layer.appendChild(tag(el('circle', { cx: sx(q), cy: sy(result.Pc), r: 4, fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 1.8 }, 'control-point'), 'control'));
      }
    } else if (hasOpenWedge(result) && on.has('eq2')) {
      layer.appendChild(tag(el('line', { x1: sx(result.Q), y1: sy(result.Pc), x2: sx(result.Q), y2: M.top + plotH, stroke: 'var(--ink-muted)', 'stroke-width': 1, 'stroke-dasharray': '1,3' }, 'eq2-line'), 'eq2'));
      const e2Note = on.has('eq2Note') && captions.eq2Note;
      layer.appendChild(tag(el('circle', { cx: sx(result.Q), cy: sy(result.Pc), r: focusId || e2Note ? 8 : 4, fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 1.8 }, focusId || e2Note ? 'eq2-dot eq-dot--focus' : 'eq2-dot'), 'eq2'));
      // The note that was on e1 moves here once the tax has moved the market.
      if (e2Note) layer.appendChild(tag(mark(teachingLabel(sx(result.Q) + 16, sy(result.Pc) - 14, captions.eq2Note, 'start'), 'qty'), 'eq2Note'));
    }

    // Explain's Pp dot: where the price the bakery receives meets S1. It rides on the Pp line's layer,
    // so it appears with the line and stays on every step that keeps it.
    if (options.ppDot && result.mode === 'subsidy' && hasOpenWedge(result) && (on.has('prices') || on.has('pricesPOnly'))) {
      layer.appendChild(tag(el('circle', { cx: sx(result.Q), cy: sy(result.Pp), r: 4.5, fill: 'var(--supply)', stroke: 'var(--surface)', 'stroke-width': 1.5 }, 'pp-dot'), 'prices'));
    }

    drawEquilibriumLabels(layer, result, { d: screenSeg(dSeg), s: screenSeg(sSeg), s2: s2Seg && screenSeg(s2Seg) });

    drawSubsidyTeachingMarks(layer, result, captions, options);
    if (on.has('readout') && captions.readout?.length) drawReadout(layer, captions.readout);
    if (on.has('badges')) drawSurplusBadges(layer, result);
    // By default the bracket exists only to carry the per-unit amount, so Clean and IB
    // perfect (no chips, no numbers on the diagram) drop both. A caption from the caller
    // is drawn at any detail level.
    if (result.mode === 'subsidy' && on.has('subsidyBracket')) drawWedgeBracket(layer, result, captions.bracket, detail);
    if (result.mode === 'subsidy' && on.has('subsidyArrow')) drawWedgeBracket(layer, result, captions.arrow, 'full', { arrow: true, chip: options.arrowChip !== false });
    if (isOpenTax(result) && on.has('lostNote') && (LENSES[focusId] || options.lostNotesAt)) drawLostNotes(layer, result, options.lostNotesAt ?? focusId, captions);
    if (isOpenTax(result) && on.has('taxArrow')) drawTaxArrow(layer, result, captions.taxArrow);
    if (isOpenTax(result) && on.has('qtyBracket')) drawQtyBracket(layer, result, captions.qtyBracket);
    if (isOpenTax(result) && on.has('taxHeight')) drawTaxHeight(layer, result, captions.taxHeight);
    if (isOpenTax(result) && on.has('taxBracket')) drawWedgeBracket(layer, result, captions.bracket, detail);
    if (on.has('focusChip')) drawFocusChip(layer, result, focusId);
    if (on.has('areaNames')) drawAreaNames(layer, result, options.areaLabels ?? 'full');
  }

  if (result.noTrade) {
    svg.querySelectorAll('.tick-label[data-axis]').forEach((tick) => tick.setAttribute('visibility', 'visible'));
  } else {
    drawAxisSymbols(svg, layer, result);
  }
  // No numbers on an exam diagram: drawAxisSymbols sets tick visibility per render, so
  // this has to run after it.
  if (detail === 'ib') svg.querySelectorAll('.tick-label').forEach((tick) => tick.setAttribute('visibility', 'hidden'));
  ghostLayers(svg, prevEmphasis, options.emphasis);
  // The nodes above are new: restore any hover/tap highlight the old ones carried.
  svg._restoreRegionState?.();
}

// What an emphasis step ghosts back: everything that isn't the emphasised party's. The chart is rebuilt on every
// step, so a mark's ghosting is a class: `ghost` holds it faint, and it fades only on the step the emphasis begins
// (`ghost-in`) or ends (`ghost-out`), never again on a rebuild that keeps it as it was; a ghost that is leaving
// (exit) just fades on from where it is.
const GHOSTED = {
  consumers: ['supply', 'supply2', 'govFill', 'wedgeBox', 'ps', 'taxProducer', 'dwlProducer'],
  producers: ['demand', 'supply2', 'govFill', 'wedgeBox', 'csTriangle', 'marginalCs', 'cs', 'taxConsumer', 'dwlConsumer'],
};
function ghostLayers(svg, was, now) {
  const wasSet = new Set(GHOSTED[was] ?? []), nowSet = new Set(GHOSTED[now] ?? []);
  if (!wasSet.size && !nowSet.size) return;
  svg.querySelectorAll('[data-layer]').forEach((node) => {
    if (node.parentElement.closest('[data-layer]')) return; // the outermost node of a layer carries it
    const name = node.getAttribute('data-layer');
    if (nowSet.has(name)) node.classList.add('ghost', ...(wasSet.has(name) ? [] : ['ghost-in']));
    else if (wasSet.has(name)) node.classList.add(layerExit.has(name) ? 'ghost' : 'ghost-out'); // a mark leaving fades from its ghost, not back up to full first
  });
}
