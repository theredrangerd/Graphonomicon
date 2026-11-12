// What every Explain walkthrough (subsidy, indirect tax) shares beyond the step card: its
// curves, the demand curve's tween between them, and keeping the card on screen.
import { readCurveParams } from './pageControls.js';
import { tweenValue } from './animate.js';

// Explain's curves: the page's default market, or (a step with `demand: 'inelastic'`) a
// steeper demand curve pivoting through the same equilibrium. Values are demand-elasticity
// slider positions.
export const EXPLAIN_DEMAND = { default: 0, inelastic: -0.5 };
const ZERO = { value: '0' };

export function explainMarket(demandSlider) {
  return readCurveParams({ demandSlider: ZERO, supplySlider: ZERO, slopeDSlider: { value: String(demandSlider) }, slopeSSlider: ZERO }).market;
}

export const stepDemand = (step) => EXPLAIN_DEMAND[step.demand ?? 'default'];

// Whether an amount on Explain's slider keeps every one of its markets drawable:
// `fits(market)` is the page's own check.
export const fitsEveryExplainMarket = (fits) => Object.values(EXPLAIN_DEMAND).every((k) => fits(explainMarket(k)));

// Where the chart's demand curve is now. `follow(step, animate, draw)` draws the step
// (draw(animate)), then a step that changes the curve tweens there, calling draw(false) every
// frame so the fills, prices and labels move with it. Without `animate` it jumps straight
// there. draw must only draw: calling follow again from it would drop the running tween.
export function demandTween() {
  let now = EXPLAIN_DEMAND.default;
  let cancel = () => {};
  const stop = () => { cancel(); cancel = () => {}; };
  return {
    now: () => now,
    // The step's own curve is already on the chart (no tween left to run).
    settled: (step) => now === stepDemand(step),
    stop,
    reset() { stop(); now = EXPLAIN_DEMAND.default; },
    follow(step, animate, draw) {
      stop();
      const target = stepDemand(step);
      if (!animate) now = target;
      draw(animate);
      if (target === now) return;
      cancel = tweenValue({ from: now, to: target, duration: 700, onUpdate: (v) => { now = v; draw(false); } });
    },
  };
}

// Layout A reads like a slideshow: on a step change, if the step card has dropped below the
// viewport, bring the chart card to the top so chart + card share one screen. Slider ticks
// never scroll.
export function keepStepCardInView(doc) {
  const view = doc.defaultView;
  const chartCard = doc.querySelector('.chart-card');
  const stepCard = doc.querySelector('#explain-card');
  if (!view || !stepCard || typeof chartCard?.scrollIntoView !== 'function') return;
  if (stepCard.getBoundingClientRect().bottom <= view.innerHeight) return;
  const reduceMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  chartCard.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
}
