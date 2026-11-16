import { computeMarket } from './marketEngine.js';
import { readCurveParams } from './pageControls.js';

// The draw path of the price ceiling/floor pages as a pure function of state, so the live
// chart, the compare tray's thumbnails and the gallery cards all redraw the same picture.

// Society's lens is the chart's deadweight-loss view.
const CHART_FOCUS = { societal: 'dwl' };

export function chartFocusFor(focus) {
  return CHART_FOCUS[focus] ?? focus;
}

// The slider values are stored raw (what the student set), and `on` is the toggle's target
// (`checked`), not the tween's current fraction, so a state read mid-animation is the
// finished picture.
export function readControlState({ sliders, controlSlider, toggle, playView }) {
  return {
    demand: +sliders.demandSlider.value,
    supply: +sliders.supplySlider.value,
    slopeD: +sliders.slopeDSlider.value,
    slopeS: +sliders.slopeSSlider.value,
    controlPrice: +controlSlider.value,
    on: toggle.checked,
    view: playView.view,
    focus: playView.focus,
  };
}

// `fraction` ramps the control from the free-market price (no effect) to its slider price;
// the live page passes the toggle's tween fraction, everything else the default.
export function buildControlChart(state, { type, showRegionLabels = false, fraction = state.on ? 1 : 0 }) {
  const curve = readCurveParams({
    demandSlider: { value: state.demand },
    supplySlider: { value: state.supply },
    slopeDSlider: { value: state.slopeD },
    slopeSSlider: { value: state.slopeS },
  });
  const { market } = curve;
  const { Pstar } = computeMarket({ ...market, intervention: { type: 'none' } });
  const displayPrice = Pstar + (state.controlPrice - Pstar) * fraction;
  const intervention = fraction > 0 ? { type, price: displayPrice } : { type: 'none' };
  const result = computeMarket({ ...market, intervention });
  return {
    result,
    curve,
    options: { showSurplusLabels: showRegionLabels, detail: 'ib', focus: chartFocusFor(state.focus), reserveGapBand: true },
  };
}
