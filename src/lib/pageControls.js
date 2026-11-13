import { elasticityLabel, fmtMoney, fmtQty, fmtShift } from './format.js';
import { delay, tweenValue } from './animate.js';
import { computeMarket, fitsChart, pointElasticities } from './marketEngine.js';
import { getUnits, familyHref } from './units.js';

// Every curve pivots around its point at this quantity when its elasticity slider moves,
// so at zero shift both curves always pass through (PIVOT_Q, PIVOT_P): changing elasticity
// rotates the curves through the equilibrium (the standard textbook comparison) instead of
// dragging the equilibrium off-chart, and dragging right always raises the true point
// elasticity shown in the readout.
export const PIVOT_Q = 60;
export const PIVOT_P = 80;

// Default slope that makes both curves unit elastic at the default equilibrium
// (PED = PES = P/(slope·Q) = 80/(4/3·60) = 1), so the readouts start at "1.00 · unit
// elastic" — the SL-friendly baseline. It also matches two facts SL students meet: the
// default supply curve runs through the origin (unit elastic), and the equilibrium sits at
// the midpoint of the default demand curve (where PED = 1).
export const UNIT_ELASTIC_SLOPE = PIVOT_P / PIVOT_Q;

// Elasticity sliders run on a log scale where right = flatter: slope = UNIT_ELASTIC_SLOPE ·
// 10^-value, so the default 0 is unit elastic and at zero shift the equilibrium elasticity
// is exactly 10^value (0.32 at the left end, 3.16 at the right).
function slopeFromSlider(input) {
  return UNIT_ELASTIC_SLOPE * Math.pow(10, -(+input.value));
}

// Where the elasticity-panel disclaimer's "Why?" link goes: the Elasticity family page,
// resolved through units.js so it's the shared WIP stub until that family is built and
// then switches to the real page automatically.
export function elasticityInfoHref() {
  const unit = getUnits().find((u) => u.slug === 'microeconomics');
  const family = unit.families.find((f) => f.slug === 'elasticity');
  return familyHref(unit, family);
}

// Shift sliders are signed offsets where right always means MORE demand/supply: +demand
// raises the demand curve, +supply lowers the supply curve (both move the curve right).
export function readCurveParams({ demandSlider, supplySlider, slopeDSlider, slopeSSlider }) {
  const demandShift = +demandSlider.value;
  const supplyShift = +supplySlider.value;
  const slopeD = slopeFromSlider(slopeDSlider);
  const slopeS = slopeFromSlider(slopeSSlider);
  return {
    demandShift, supplyShift,
    market: {
      demand: PIVOT_P + demandShift + slopeD * PIVOT_Q,
      supply: PIVOT_P - supplyShift - slopeS * PIVOT_Q,
      slopeD, slopeS,
    },
  };
}

// The market at all-zero sliders (the page's starting curves); Explain mode always uses it.
const ZERO_SLIDER = { value: '0' };
export const DEFAULT_MARKET = Object.freeze(readCurveParams({
  demandSlider: ZERO_SLIDER, supplySlider: ZERO_SLIDER, slopeDSlider: ZERO_SLIDER, slopeSSlider: ZERO_SLIDER,
}).market);

// Stops each input at the last value where `isValid()` still holds, instead of letting it
// reach a state the chart can't draw. Must be wired before the input's render listener so
// render only ever sees a valid value.
export function guardSliders(inputs, isValid) {
  const lastValid = new Map(inputs.map((input) => [input, input.value]));
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      if (!isValid()) settleToward(input, +lastValid.get(input), isValid);
      lastValid.set(input, input.value);
    });
  });
}

// Walks `input` from `from` toward its current (invalid) value one step at a time and
// leaves it at the furthest step that is still valid.
function settleToward(input, from, isValid) {
  const target = +input.value;
  const step = +input.step || 1;
  const dir = Math.sign(target - from);
  const n = Math.round(Math.abs(target - from) / step);
  let best = from;
  for (let k = 1; k <= n; k++) {
    const v = +(from + dir * k * step).toFixed(6);
    input.value = String(v);
    if (!isValid()) break;
    best = v;
  }
  input.value = String(best);
}

// Pulls an intervention slider back toward its minimum until the state is valid — used
// when switching an intervention on (or changing its mode) would otherwise put the result
// off-chart, since toggles/radios have no drag to stop.
export function settleDown(input, isValid) {
  const step = +input.step || 1;
  while (!isValid() && +input.value > +input.min) {
    input.value = String(+Math.max(+input.min, +input.value - step).toFixed(6));
  }
}

// True when both the free market and the market with `intervention` applied fit the chart.
export function marketFits(market, intervention) {
  if (!fitsChart(computeMarket({ ...market, intervention: { type: 'none' } }))) return false;
  return !intervention || fitsChart(computeMarket({ ...market, intervention }));
}

// Wires the demand/supply shift + elasticity sliders that every intervention page shares:
// guarded by `isValid`, then firing `render` on input. Returns the slider elements so
// pages can read them via readCurveParams() inside render().
export function wireShiftAndSlopeInputs(doc, render, isValid) {
  const sliders = {
    demandSlider: doc.querySelector('#demand-slider'),
    supplySlider: doc.querySelector('#supply-slider'),
    slopeDSlider: doc.querySelector('#slope-d-slider'),
    slopeSSlider: doc.querySelector('#slope-s-slider'),
  };
  const inputs = Object.values(sliders);
  const moreLink = doc.querySelector('#elasticity-more');
  if (moreLink) moreLink.setAttribute('href', elasticityInfoHref());
  guardSliders(inputs, isValid);
  inputs.forEach((input) => input.addEventListener('input', render));
  return sliders;
}

// Updates the value labels next to the shift/elasticity sliders wired above. The elasticity
// readouts show true point elasticity at the free-market equilibrium, not the slope.
export function updateShiftAndSlopeLabels(doc, { demandShift, supplyShift, market }) {
  const { ped, pes } = pointElasticities(computeMarket({ ...market, intervention: { type: 'none' } }));
  doc.querySelector('#demand-val').textContent = fmtShift(demandShift);
  doc.querySelector('#supply-val').textContent = fmtShift(supplyShift);
  doc.querySelector('#slope-d-val').textContent = elasticityLabel(ped);
  doc.querySelector('#slope-s-val').textContent = elasticityLabel(pes);
}

export const NO_TRADE_NOTE = '<strong>No trade occurs.</strong> Shift the sliders so demand sits above supply.';

// Fills the "Market outcome" tiles every intervention page shares (quantity, CS, PS, DWL).
// Price tiles differ per page (one price vs. Pc/Pp), so pages fill those themselves.
export function fillSharedStats(doc, result) {
  const set = (id, text) => { doc.querySelector(id).textContent = text; };
  set('#stat-qty', result.noTrade ? '0.0' : fmtQty(result.Q));
  set('#stat-cs', result.noTrade ? '$0' : fmtMoney(result.CS));
  set('#stat-ps', result.noTrade ? '$0' : fmtMoney(result.PS));
  set('#stat-dwl', result.noTrade ? '$0' : fmtMoney(result.DWL));
}

// Wires an intervention on/off toggle to tween its fraction (0 = off, 1 = fully on)
// from wherever it currently sits to its new target over ~400ms, re-rendering on every
// frame via `render` — this is the CLAUDE.md "toggle animates in/out" rule, centralized
// so every future intervention page picks it up automatically instead of re-copying the
// tween/cancel bookkeeping. `beforeOn` runs just before switching on, so a page can pull
// its intervention slider back into range first.
export function wireInterventionToggle(toggle, render, { beforeOn, duration, holdOn } = {}) {
  let fraction = toggle.checked ? 1 : 0;
  let cancelAnim = null;
  toggle.addEventListener('change', () => {
    if (toggle.checked && beforeOn) beforeOn();
    if (cancelAnim) cancelAnim();
    // `holdOn()` ms (a page that opens with a beat before the intervention moves anything):
    // the intervention stays at its current fraction until then.
    const hold = toggle.checked && holdOn ? holdOn() : 0;
    const run = () => {
      cancelAnim = tweenValue({
        from: fraction,
        to: toggle.checked ? 1 : 0,
        ...(duration ? { duration: typeof duration === 'function' ? duration() : duration } : {}), // a page may vary it by lens
        onUpdate(v) { fraction = v; render(); },
        onComplete() { cancelAnim = null; },
      });
    };
    if (hold > 0) cancelAnim = delay(hold, run); else run();
  });
  return { getFraction: () => fraction };
}
