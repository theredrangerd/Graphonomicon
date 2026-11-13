// What every Explain walkthrough (subsidy, indirect tax) shares beyond the step card: its
// curves, the demand curve's tween between them, and keeping the card on screen.
import { readCurveParams } from './pageControls.js';
import { tweenValue } from './animate.js';

// Explain's curves: the page's default market, or (a step with `demand: 'inelastic'` / `'elastic'`)
// a steeper / flatter demand curve pivoting through the same equilibrium. Values are
// demand-elasticity slider positions. `elastic` is tuned for the indirect tax's sugar levy: with
// supply unit elastic, shoppers carry a third of a specific tax (point elasticity at e1 ≈ 2).
export const EXPLAIN_DEMAND = { default: 0, inelastic: -0.5, elastic: 0.3 };
const ZERO = { value: '0' };

export function explainMarket(demandSlider) {
  return readCurveParams({ demandSlider: ZERO, supplySlider: ZERO, slopeDSlider: { value: String(demandSlider) }, slopeSSlider: ZERO }).market;
}

export const stepDemand = (step) => EXPLAIN_DEMAND[step.demand ?? 'default'];

// Whether an amount on Explain's slider keeps every one of its markets drawable:
// `fits(market)` is the page's own check; `kinds` the markets that page's steps use.
export const fitsEveryExplainMarket = (fits, kinds = Object.keys(EXPLAIN_DEMAND)) => kinds.every((k) => fits(explainMarket(EXPLAIN_DEMAND[k])));

// Where the chart's demand curve is now. `follow(step, animate, draw)` draws the step
// (draw(animate)), then a step that changes the curve tweens there, calling draw(false) every
// frame so the fills, prices and labels move with it. Without `animate` it jumps straight
// there. draw must only draw: calling follow again from it would drop the running tween.
// `enterAfter`: a step whose own marks animate in holds that entry until the curve has
// arrived (a tween frame would cut it short): the tween's frames draw(false), and its end
// draw(true). Returns a promise that resolves once the curve has arrived (and any held entry
// has been drawn), or null when there was no tween, for the step card to wait on.
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
    follow(step, animate, draw, { enterAfter = false } = {}) {
      stop();
      const target = stepDemand(step);
      if (!animate) now = target;
      const hold = enterAfter && animate && target !== now;
      draw(animate && !hold);
      if (target === now) return null;
      let arrived;
      const entered = new Promise((resolve) => { arrived = resolve; });
      cancel = tweenValue({
        from: now, to: target, duration: 700,
        onUpdate: (v) => { now = v; draw(false); },
        onComplete: () => { if (hold) draw(true); arrived(); },
      });
      return entered;
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
