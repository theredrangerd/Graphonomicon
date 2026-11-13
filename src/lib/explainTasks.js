// The tasks an Explain walkthrough can set the student (subsidy, indirect tax): dragging a mark
// along the chart (the cost dot, the tax wedge), bringing it to a halo, and sliding the
// intervention down to nothing and back; plus the coloured words that light up their marks.
// The pages own their state and their steps; this is the wiring they share.
import { quantityAtClientX } from './marketChart.js';

// The slide-down-and-back-up task: has the slider reached its bottom, then (after that) its top.
// Progress is kept once earned. "The top" counts within SWEEP_REACH of the slider's max, so a
// step short of it still counts.
export const SWEEP_REACH = 1;
export function advanceSweep(sweep, amount, { min, max }) {
  const low = Boolean(sweep.low) || amount <= min;
  const high = Boolean(sweep.high) || (low && amount >= max - SWEEP_REACH);
  return { low, high };
}

// Whether a mark moved from `fromQ` to `toQ` has reached the halo at `target`: it landed within
// `reach` of it, or swept through it on the way.
export function reachedTarget(fromQ, toQ, target, reach) {
  const [lo, hi] = fromQ < toQ ? [fromQ, toQ] : [toQ, fromQ];
  return lo <= target + reach && target - reach <= hi;
}

// Dragging along the chart: while `isActive()`, pressing anywhere on the chart moves the mark to
// that quantity and it follows the pointer until release (`onMove(q)`, then `onRelease()`).
// Arrow keys on the mark's handle step it (`onKey(dir, big)`: dir ±1, big with Shift).
export function wireChartDrag(chart, { isActive, handleSelector, onMove, onRelease, onKey }) {
  let dragging = false;
  chart.addEventListener('pointerdown', (e) => {
    if (!isActive()) return;
    dragging = true;
    chart.classList.add('is-dragging');
    chart.setPointerCapture?.(e.pointerId);
    onMove(quantityAtClientX(chart, e.clientX));
    e.preventDefault();
  });
  chart.addEventListener('pointermove', (e) => {
    if (dragging) onMove(quantityAtClientX(chart, e.clientX));
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    chart.classList.remove('is-dragging');
    onRelease();
  };
  chart.addEventListener('pointerup', end);
  chart.addEventListener('pointercancel', end);
  chart.addEventListener('keydown', (e) => {
    if (!e.target.closest?.(handleSelector)) return;
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    onKey(dir, e.shiftKey);
    e.preventDefault();
  });
}

// A coloured word in the step card (or a row of the chart's readout) lights up the marks it
// names: the chart's data-hot fades every other marked thing (pages.css). Returns `clear`.
export function wireTermHighlight(chart, hosts) {
  const setHot = (e) => {
    const key = e.target.closest?.('[data-mark]')?.dataset.mark;
    if (key && e.target.closest('.term, .readout__row, .explain-card__readout-row')) chart.dataset.hot = key;
  };
  const clear = () => { delete chart.dataset.hot; };
  for (const host of hosts) {
    host.addEventListener('pointerover', setHot);
    host.addEventListener('pointerout', clear);
    host.addEventListener('focusin', setHot);
    host.addEventListener('focusout', clear);
  }
  return clear;
}
