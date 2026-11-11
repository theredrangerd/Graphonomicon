import { renderMiniHeader } from '../components/chrome.js';
import { computeMarket } from '../lib/marketEngine.js';
import { renderMarketChart, resolveLayers } from '../lib/marketChart.js';
import { delay, tweenValue } from '../lib/animate.js';
import { fmtMoney, fmtPrice, fmtQty, setStatusPill } from '../lib/format.js';
import { getFamilyNav } from '../components/familyNav.js';
import { wireShiftAndSlopeInputs, updateShiftAndSlopeLabels, wireInterventionToggle, readCurveParams, marketFits, guardSliders, settleDown, fillSharedStats, NO_TRADE_NOTE } from '../lib/pageControls.js';
import { attachRegionExplainers } from '../lib/regionExplainers.js';
import { FEEDBACK_FORM_URL } from '../lib/feedback.js';
import { initGraphChrome, maybeAutoStartTour, interventionTourSteps } from '../components/graphChrome.js';
import { readMode, writeMode, onModeChange, readPlayView, writePlayView } from '../lib/pageMode.js';
import { mountModeSwitch } from '../components/modeSwitch.js';
import { mountViewSwitch, TAX_FOCUSES, TAX_FOCUS_ALIASES } from '../components/viewSwitch.js';
import { mountExplainCard } from '../components/explainCard.js';
import { whenAnimationsDone } from '../lib/animationSettle.js';
import { TAX_STEPS } from './indirectTaxExplainSteps.js';

// 'full' | 'half' | 'none' — the tax's own copy of the subsidy's SUBSIDY_AREA_LABELS
// (Ms. Patel request 3): half names only the two burdens. Flip after she confirms.
export const TAX_AREA_LABELS = 'full';

// Explorer focuses that only exist once the tax is on, and what the note calls them.
const TAX_ONLY_FOCUS = {
  'consumer-lens': 'the consumer burden and deadweight loss', 'producer-lens': 'the producer burden and deadweight loss', revenue: 'tax revenue',
};

// Explain's curves: the page's default market, or (one step) a steeper, inelastic demand
// curve pivoting through the same equilibrium. Values are demand-elasticity slider positions.
const ZERO = { value: '0' };
const DEMAND_SLIDER = { default: 0, inelastic: -0.5 };
function explainMarket(demandSlider) {
  return readCurveParams({ demandSlider: ZERO, supplySlider: ZERO, slopeDSlider: { value: String(demandSlider) }, slopeSSlider: ZERO }).market;
}

export function initIndirectTaxPage(doc, win = window) {
  const { backHref, backLabel, siblings } = getFamilyNav('indirect-tax');
  renderMiniHeader(doc.querySelector('#mini-header'), { title: 'Indirect tax', backHref, backLabel, siblings });

  const chart = doc.querySelector('#chart');
  const chartHead = doc.querySelector('.chart-head');
  const taxToggle = doc.querySelector('#tax-toggle');
  const modeSpecific = doc.querySelector('#tax-mode-specific');
  const modeAdvalorem = doc.querySelector('#tax-mode-advalorem');
  const specificSlider = doc.querySelector('#specific-slider');
  const advaloremSlider = doc.querySelector('#advalorem-slider');
  const specificSliderWrap = doc.querySelector('#specific-slider-wrap');
  const advaloremSliderWrap = doc.querySelector('#advalorem-slider-wrap');
  let explainers;
  let card; // the Explain step card, mounted below
  let mode = readMode(win);
  let playView = readPlayView(win, TAX_FOCUSES.map(([id]) => id), TAX_FOCUS_ALIASES);

  // No detail gear on this page: Play's IB perfect / Explorer switch replaces it, and the
  // chart is always drawn at the IB level.
  const chrome = initGraphChrome(doc, {
    chartHead,
    detailSettings: false,
    steps: (detail) => interventionTourSteps({ policyName: 'tax', sliderNoun: 'tax', clickableRegions: true, viewSwitch: true }, detail),
    onDetailChange: () => {},
  });
  const modeSwitch = mountModeSwitch(chartHead, {
    mode,
    onChange(next) { writeMode(next, win); applyMode(next); },
  });
  mountViewSwitch(chartHead, {
    view: playView.view,
    focus: playView.focus,
    focuses: TAX_FOCUSES,
    onChange(next) {
      playView = next;
      writePlayView(next, win);
      explainers?.close();
      // A newly picked area builds itself up the same way it does when the tax goes on.
      if (taxToggle.checked && next.focus) startReveal();
      else { stopReveal(); reveal = {}; render(); }
    },
  });

  // ---- Play ----

  function taxMode() {
    return modeAdvalorem.checked ? 'advalorem' : 'specific';
  }

  // The tax at `fraction` of its slider value (the toggle's tween runs it 0 -> 1).
  function taxAt(fraction = 1, kind = taxMode()) {
    return kind === 'advalorem'
      ? { type: 'tax', mode: 'advalorem', rate: ((+advaloremSlider.value) / 100) * fraction }
      : { type: 'tax', mode: 'specific', amount: (+specificSlider.value) * fraction };
  }

  // Animates the tax's magnitude in/out on toggle so the supply curve and its shaded
  // regions shift smoothly instead of snapping between free-market and taxed states.
  let toggleCtl;

  // Explorer focus, tax switched on (or a focus picked while it's on): the supply line shifts
  // at once, then each step below is drawn STAGGER_MS after the one before. A step holds back
  // the layers in `keys` until it runs, then animates them in (`enter` fades, `grow` wipes).
  // CS / PS need no reveal: the surplus already shrinks as the tax tweens on.
  // Consumer burden wipes up from Pe to Pc, producer burden down from Pe to Pp, each with its chip.
  // Revenue: the consumer burden wipes up, the producer burden down, then the box.
  // Each lens: its burden band wipes in, then its half of the DWL grows out from Qtax, then the chips.
  // `reveal` maps held layer -> drawn yet; `pendingEnter`/`pendingGrow` animate what was just revealed.
  // startReveal draws the held-back picture itself, so callers don't render after it.
  // Each step waits `wait` ms after the one before (the first, after `lead`): a band is
  // followed by its chip once the wipe (WIPE_MS) has finished, so the chip never floats over
  // an area that hasn't been drawn yet.
  const STAGGER_MS = 800;
  const WIPE_MS = 900;
  const TOGGLE_MS = 750; // the toggle's 650ms tween plus a frame: a render during the wipe would restart it
  const REVEALS = {
    'consumer-lens': [
      { keys: ['taxConsumer'], grow: ['taxConsumer'] },
      { keys: ['dwlConsumer'], grow: ['dwlConsumer'], wait: WIPE_MS },
      { keys: ['focusChip'], enter: ['focusChip'], wait: STAGGER_MS },
    ],
    'producer-lens': [
      { keys: ['taxProducer'], grow: ['taxProducer'] },
      { keys: ['dwlProducer'], grow: ['dwlProducer'], wait: WIPE_MS },
      { keys: ['focusChip'], enter: ['focusChip'], wait: STAGGER_MS },
    ],
    revenue: [
      { keys: ['taxConsumer'], grow: ['taxConsumer'] },
      { keys: ['taxProducer'], grow: ['taxProducer'], wait: WIPE_MS },
      { keys: ['wedgeBox', 'focusChip'], enter: ['wedgeBox', 'focusChip'], wait: WIPE_MS },
    ],
  };
  let reveal = {};
  let pendingEnter = [];
  let pendingGrow = [];
  let cancelReveal = [];
  const stopReveal = () => { cancelReveal.forEach((c) => c()); cancelReveal = []; };
  // `lead`: how long before the first step. A focus picked with the tax already on starts at
  // once; the toggle waits for its own tween.
  function startReveal(lead = 0) {
    stopReveal();
    const steps = REVEALS[playView.focus] ?? [];
    reveal = Object.fromEntries(steps.flatMap((step) => step.keys.map((key) => [key, false])));
    render();
    const run = (i, wait) => {
      if (i >= steps.length) return;
      const go = () => {
        const { keys, enter = [], grow = [] } = steps[i];
        for (const key of keys) reveal[key] = true;
        pendingEnter = enter;
        pendingGrow = grow;
        render();
        run(i + 1, steps[i + 1]?.wait ?? STAGGER_MS);
      };
      if (wait > 0) cancelReveal.push(delay(wait, go)); else go();
    };
    run(0, lead);
  }

  // Only a switched-on tax constrains the sliders — a tax that's off shouldn't make the
  // curve sliders stop early for a reason the student can't see.
  function isValid() {
    return marketFits(readCurveParams(sliders).market, taxToggle.checked ? taxAt() : null);
  }

  const sliders = wireShiftAndSlopeInputs(doc, () => render(), isValid);

  // The legend keeps demand, supply and the focused area; revenue draws both burdens inside its box.
  const LEGEND_FOR = { 'consumer-lens': ['cs', 'tax-consumer', 'dwl'], 'producer-lens': ['ps', 'tax-producer', 'dwl'], revenue: ['tax-consumer', 'tax-producer', 'revenue'] };
  function updateLegend(focus) {
    const shown = ['demand', 'supply', ...(LEGEND_FOR[focus] ?? [focus])];
    doc.querySelectorAll('.legend [data-legend]').forEach((item) => {
      item.hidden = focus ? !shown.includes(item.dataset.legend) : false;
    });
  }

  // Play's render. Inputs on the Play controls (and the toggle's tween) keep firing it in
  // Explain too, but there it would overwrite the step's picture, so it only runs in Play.
  function render() {
    if (mode !== 'play') return;
    const curve = readCurveParams(sliders);
    const { market } = curve;
    const taxOn = taxToggle.checked;
    const kind = taxMode();
    const { focus } = playView;

    specificSliderWrap.classList.toggle('open', kind === 'specific');
    advaloremSliderWrap.classList.toggle('open', kind === 'advalorem');

    updateShiftAndSlopeLabels(doc, curve);
    doc.querySelector('#specific-val').textContent = '$' + specificSlider.value;
    doc.querySelector('#advalorem-val').textContent = advaloremSlider.value + '%';

    const taxFraction = toggleCtl.getFraction();
    const taxActive = taxFraction > 0;
    const result = computeMarket({ ...market, intervention: taxActive ? taxAt(taxFraction, kind) : { type: 'none' } });

    const options = { showSurplusLabels: true, detail: chrome.getDetail(), focus, areaLabels: TAX_AREA_LABELS };
    if (focus && Object.values(reveal).includes(false)) {
      const held = resolveLayers(result, options);
      for (const [key, drawn] of Object.entries(reveal)) if (!drawn) held.delete(key);
      options.layers = [...held];
    }
    if (pendingEnter.length) { options.enter = pendingEnter; pendingEnter = []; }
    if (pendingGrow.length) { options.grow = pendingGrow; pendingGrow = []; }
    renderMarketChart(chart, result, options);
    updateLegend(focus);

    setStatusPill(doc.querySelector('#status-pill'), taxOn ? 'Tax applied' : 'Free market', result.mode);
    // A tax big enough to close the market leaves no traded price to report.
    const noPrice = result.noTrade || result.closed;
    doc.querySelector('#stat-price-consumer').textContent = noPrice ? '—' : fmtPrice(result.Pc);
    doc.querySelector('#stat-price-producer').textContent = noPrice ? '—' : fmtPrice(result.Pp);
    fillSharedStats(doc, result);
    doc.querySelector('#stat-revenue').textContent = result.noTrade ? '$0' : fmtMoney(result.govRevenue);
    doc.querySelector('#stat-incidence-consumer').textContent = result.noTrade || !taxActive ? '$0' : fmtMoney(result.consumerIncidence);
    doc.querySelector('#stat-incidence-producer').textContent = result.noTrade || !taxActive ? '$0' : fmtMoney(result.producerIncidence);

    let note = '';
    if (result.noTrade) {
      note = NO_TRADE_NOTE;
    } else if (result.closed) {
      note = `<strong>No units are traded.</strong> The tax is at least as big as the gap between the most any buyer will pay and the least any seller will accept, so the market shuts down and all ${fmtMoney(result.DWL)} of surplus is lost.`;
    } else if (!taxActive && TAX_ONLY_FOCUS[focus]) {
      note = `Turn the tax on to see ${TAX_ONLY_FOCUS[focus]}.`;
    } else if (taxActive) {
      // The lost units run from Q to Q*: buyers value them between P* and Pc, and they
      // cost sellers between Pp and P* — worth more than they cost, but not worth Pc.
      const taxText = kind === 'advalorem' ? `${advaloremSlider.value}% tax` : `$${specificSlider.value} tax`;
      note = `<strong>${fmtMoney(result.DWL)} of surplus is lost.</strong> ${fmtQty(result.Qstar - result.Q)} fewer units are traded. Buyers value each of them at $${result.Pstar.toFixed(0)}–$${result.Pc.toFixed(0)}, more than the $${result.Pp.toFixed(0)}–$${result.Pstar.toFixed(0)} they cost sellers to make — but with the ${taxText} on top, those trades no longer happen.`;
    }
    doc.querySelector('#market-note').innerHTML = note;
  }

  const settleActiveSlider = () => settleDown(taxMode() === 'advalorem' ? advaloremSlider : specificSlider, isValid);
  guardSliders([specificSlider, advaloremSlider], isValid);
  specificSlider.addEventListener('input', () => {
    card.refresh(); // keep the Explain slider on the same amount
    render();
  });
  advaloremSlider.addEventListener('input', render);
  [modeSpecific, modeAdvalorem].forEach((input) => input.addEventListener('change', () => {
    settleActiveSlider();
    render();
  }));
  toggleCtl = wireInterventionToggle(taxToggle, render, { beforeOn: settleActiveSlider, duration: 650 });
  taxToggle.addEventListener('change', () => {
    if (taxToggle.checked) startReveal(TOGGLE_MS); else { stopReveal(); reveal = {}; }
  });

  // ---- Explain ----
  // Always a specific tax on the default curves (one step swaps in inelastic demand); the
  // Play toggle and tax-mode radios don't matter here, only the step does.

  const stepDemand = (step) => DEMAND_SLIDER[step.demand ?? 'default'];
  const explainTax = (step) => (step.tax ? { type: 'tax', mode: 'specific', amount: +specificSlider.value } : { type: 'none' });

  // The step text always describes the step's own curves, even while the chart is still
  // tweening toward them.
  function explainContext(step) {
    return { amount: +specificSlider.value, result: computeMarket({ ...explainMarket(stepDemand(step)), intervention: explainTax(step) }) };
  }

  // Layout A reads like a slideshow: on a step change, if the step card has dropped below the
  // viewport, bring the chart card to the top so chart + card share one screen. Slider ticks
  // never scroll.
  function keepStepCardInView() {
    const view = doc.defaultView;
    const chartCard = doc.querySelector('.chart-card');
    const stepCard = doc.querySelector('#explain-card');
    if (mode !== 'explain' || !view || typeof chartCard?.scrollIntoView !== 'function') return;
    if (stepCard.getBoundingClientRect().bottom <= view.innerHeight) return;
    const reduceMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    chartCard.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  // Where the Explain chart's demand curve is now (slider units). A step that changes it
  // tweens there, redrawing every frame so the fills, prices and labels move with the curve.
  let demandNow = DEMAND_SLIDER.default;
  let cancelDemandTween = () => {};

  function drawExplain(step, animate) {
    const ib = step.view === 'ib';
    const result = computeMarket({ ...explainMarket(demandNow), intervention: explainTax(step) });
    renderMarketChart(chart, result, {
      detail: ib ? 'ib' : 'clean',
      // The IB wrap-up draws the full IB perfect diagram, i.e. the default layer set.
      layers: ib ? undefined : step.layers,
      captions: step.captions?.(explainContext(step)),
      areaLabels: TAX_AREA_LABELS,
      ...(animate ? { enter: step.enter, grow: step.grow } : {}),
    });
  }

  function renderExplain(step, { animate }) {
    if (mode !== 'explain') return;
    cancelDemandTween();
    cancelDemandTween = () => {};
    const target = stepDemand(step);
    if (!animate) demandNow = target;
    drawExplain(step, animate);
    if (target === demandNow) return;
    cancelDemandTween = tweenValue({
      from: demandNow, to: target, duration: 700,
      onUpdate: (v) => { demandNow = v; if (mode === 'explain') drawExplain(step, false); },
    });
  }

  // Explain's slider must keep both of its markets (default and inelastic demand) on the
  // chart and still trading.
  const explainFits = (amount) => Object.values(DEMAND_SLIDER).every((k) => {
    const market = explainMarket(k);
    const tax = { type: 'tax', mode: 'specific', amount };
    return marketFits(market, tax) && !computeMarket({ ...market, intervention: tax }).closed;
  });

  card = mountExplainCard(doc.querySelector('#explain-card'), {
    steps: TAX_STEPS,
    replayHost: doc.querySelector('.chart-head'),
    animationsDone: () => whenAnimationsDone(chart),
    amount: +specificSlider.value,
    min: +specificSlider.min,
    max: +specificSlider.max,
    sliderLabel: 'Tax per can',
    getContext: () => explainContext(TAX_STEPS[card ? card.index() : 0]),
    onRender: (step, opts) => {
      explainers?.close();
      renderExplain(step, opts);
      if (opts.animate) keepStepCardInView();
    },
    onAmount: (amount) => { specificSlider.value = String(amount); },
    isValidAmount: explainFits,
    onFinish() {
      writeMode('play', win);
      // Explain taught the specific tax, so Play picks up the same one.
      modeSpecific.checked = true;
      applyMode('play');
      // Land on the diagram the student just finished: animate the tax on.
      if (!taxToggle.checked) {
        taxToggle.checked = true;
        taxToggle.dispatchEvent(new Event('change'));
      }
    },
  });

  // ---- Modes ----

  let tourChecked = false;
  function maybeTour() {
    if (tourChecked) return;
    tourChecked = true;
    maybeAutoStartTour(chrome);
  }

  function showMode() {
    doc.body.dataset.mode = mode;
    modeSwitch.setMode(mode);
    doc.querySelector('#explain-card').hidden = mode !== 'explain';
  }

  function applyMode(next) {
    if (next === mode) return;
    mode = next;
    showMode();
    explainers?.close();
    if (mode === 'explain') {
      // Arriving back in Play by the mode switch or a link follows the site rule: tax off.
      // Switching it off now lets the tween finish while Explain is showing.
      if (taxToggle.checked) {
        taxToggle.checked = false;
        taxToggle.dispatchEvent(new Event('change'));
      }
      card.goTo(0);
    } else {
      cancelDemandTween();
      render();
      maybeTour();
    }
  }

  onModeChange(applyMode, win);

  showMode();
  if (mode === 'explain') card.goTo(0); else render();
  explainers = attachRegionExplainers(chart);
  if (mode === 'play') maybeTour();
  doc.querySelector('#feedback-form').src = FEEDBACK_FORM_URL;
}
