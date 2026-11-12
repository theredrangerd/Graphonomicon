import { renderMiniHeader } from '../components/chrome.js';
import { computeMarket } from '../lib/marketEngine.js';
import { renderMarketChart, resolveLayers, quantityAtClientX } from '../lib/marketChart.js';
import { delay, tweenValue } from '../lib/animate.js';
import { fmtMoney, fmtPrice, setStatusPill } from '../lib/format.js';
import { getFamilyNav } from '../components/familyNav.js';
import { wireShiftAndSlopeInputs, updateShiftAndSlopeLabels, wireInterventionToggle, readCurveParams, marketFits, guardSliders, settleDown, fillSharedStats, NO_TRADE_NOTE, DEFAULT_MARKET } from '../lib/pageControls.js';
import { attachRegionExplainers } from '../lib/regionExplainers.js';
import { FEEDBACK_FORM_URL } from '../lib/feedback.js';
import { initGraphChrome, maybeAutoStartTour, interventionTourSteps } from '../components/graphChrome.js';
import { readMode, writeMode, onModeChange, readPlayView, writePlayView } from '../lib/pageMode.js';
import { mountModeLink } from '../components/modeSwitch.js';
import { mountViewSwitch, SUBSIDY_FOCUSES, SUBSIDY_FOCUS_ALIASES } from '../components/viewSwitch.js';
import { mountExplainCard } from '../components/explainCard.js';
import { whenAnimationsDone } from '../lib/animationSettle.js';
import { SUBSIDY_STEPS, LOAF_Q, LOAF_STEP, TARGET_Q, TARGET_TOLERANCE, snapLoaf, advanceSweep } from './subsidyExplainSteps.js';

export const SUBSIDY_AREA_LABELS = 'full'; // 'full' | 'half' | 'none' — Ms. Patel request 3; flip after she confirms.

// Explorer focuses that only exist once the subsidy is on, and what the note calls them.
const SUBSIDY_ONLY_FOCUS = { gov: 'government spending and the deadweight loss', cs: 'the marginal consumer surplus', ps: 'the marginal producer surplus', societal: 'the marginal surpluses and the deadweight loss' };

// Explain's demand curve: slider positions, as the indirect-tax page does.
const ZERO = { value: '0' };
const DEMAND_SLIDER = { default: 0, inelastic: -0.5 };
function explainMarket(demandSlider) {
  return readCurveParams({ demandSlider: ZERO, supplySlider: ZERO, slopeDSlider: { value: String(demandSlider) }, slopeSSlider: ZERO }).market;
}

export function initSubsidyPage(doc, win = window) {
  const { backHref, backLabel, siblings } = getFamilyNav('subsidy');
  renderMiniHeader(doc.querySelector('#mini-header'), { title: 'Subsidy', backHref, backLabel, siblings });

  const chart = doc.querySelector('#chart');
  const chartHead = doc.querySelector('.chart-head');
  const subsidySlider = doc.querySelector('#subsidy-slider');
  const subsidyToggle = doc.querySelector('#subsidy-toggle');
  let explainers;
  let card; // the Explain step card, mounted below
  let mode = readMode(win);
  let playView = readPlayView(win, SUBSIDY_FOCUSES.map(([id]) => id), SUBSIDY_FOCUS_ALIASES, 'explorer');

  // No detail gear on this page, and Play is Explorer only (no IB perfect option); the
  // chart is always drawn at the IB level.
  const chrome = initGraphChrome(doc, {
    chartHead,
    detailSettings: false,
    steps: (detail) => interventionTourSteps({ policyName: 'subsidy', sliderNoun: 'subsidy', clickableRegions: true, explorerOnly: true }, detail),
    onDetailChange: () => {},
  });
  const modeSwitch = mountModeLink({
    playHost: doc.querySelector('header.top') ?? chartHead,
    explainHost: chartHead,
    mode,
    onChange(next) { writeMode(next, win); applyMode(next); },
  });
  mountViewSwitch(chartHead, {
    view: playView.view,
    focus: playView.focus,
    focuses: SUBSIDY_FOCUSES,
    ibView: false,
    onChange(next) {
      playView = next;
      writePlayView(next, win);
      resetReveal();
      explainers?.close();
      // A lens picked with the subsidy already on plays its build-up, like switching the subsidy on.
      if (subsidyToggle.checked && REVEALS[next.focus]) startReveal();
      render();
    },
  });

  // ---- Play ----

  // Animates the subsidy's magnitude in/out on toggle so the supply curve and its shaded
  // regions shift smoothly instead of snapping between free-market and subsidized states.
  let toggleCtl;

  // Explorer focus, subsidy switched on: the supply line shifts at once, then each step below
  // is drawn STAGGER_MS after the one before. A step holds back the layers in `keys` until it
  // runs, then animates them in (`enter` fades, `grow` scales). PS: the per-unit arrow, then
  // the marginal band, its chip and the Pp line. CS: the band.
  // `reveal` maps held layer -> drawn yet; `pendingEnter`/`pendingGrow` animate what was just revealed.
  const STAGGER_MS = 800;
  const REVEALS = {
    ps: [
      { keys: ['subsidyArrow'], enter: ['subsidyArrow'] },
      { keys: ['prices', 'marginalPs'], enter: ['marginalPs', 'focusChip'] },
    ],
    cs: [{ keys: ['marginalCs'], enter: ['marginalCs', 'focusChip'] }],
    // Societal lens, the box then its three parts. Explain's own build-up, in Play: one strip per
    // loaf fills the government's spending box, the strips dissolve into the solid box, which
    // hands its money out as marginal CS, then marginal PS, then the grey corner ("?") that turns
    // out to be deadweight loss, and last the chips. Each step is a `stage` (see SOCIETAL_STAGES).
    societal: [
      { stage: 'strips', enter: ['govStrips'] },
      { stage: 'box', enter: ['govFill', 'wedgeBox', 'boxLabel'], exit: ['govStrips'], after: 2000 },
      { stage: 'boxHold', after: 1100 },
      { stage: 'mcs', enter: ['marginalCs'], exit: ['govFill', 'boxLabel'], after: 2200 },
      { stage: 'mps', enter: ['marginalPs'], after: 2000 },
      { stage: 'unknown', enter: ['dwlUnknown'], after: 2000 },
      { stage: 'dwl', enter: ['dwl'], after: 2400 },
      { stage: 'final', enter: ['focusChip'], after: 1600 },
    ],
  };
  // What each Societal stage draws, as changes to the finished picture (resolveLayers): layers it
  // doesn't have yet (`drop`) and transient ones it still shows (`add`).
  const FINAL_PARTS = ['wedgeBox', 'marginalCs', 'marginalPs', 'dwl', 'focusChip'];
  const SOCIETAL_STAGES = {
    start: { drop: FINAL_PARTS, add: [] },
    strips: { drop: FINAL_PARTS, add: ['govStrips'] },
    box: { drop: FINAL_PARTS.slice(1), add: ['govStrips', 'govFill', 'boxLabel'] },
    boxHold: { drop: FINAL_PARTS.slice(1), add: ['govFill', 'boxLabel'] },
    mcs: { drop: ['marginalPs', 'dwl', 'focusChip'], add: ['govFill', 'boxLabel'] },
    mps: { drop: ['dwl', 'focusChip'], add: [] },
    unknown: { drop: ['dwl', 'focusChip'], add: ['dwlUnknown'] },
    dwl: { drop: ['focusChip'], add: ['dwlUnknown'] },
    final: { drop: [], add: [] },
  };
  let societalStage = 'final'; // 'final' = the finished picture, which is also what a focus change or slider drag shows
  let reveal = {};
  let pendingEnter = [];
  let pendingGrow = [];
  let pendingExit = [];
  let cancelReveal = [];
  const stopReveal = () => { cancelReveal.forEach((c) => c()); cancelReveal = []; };
  function resetReveal() { stopReveal(); reveal = {}; societalStage = 'final'; }
  function startReveal() {
    stopReveal();
    const steps = REVEALS[playView.focus] ?? [];
    reveal = Object.fromEntries(steps.flatMap((step) => (step.keys ?? []).map((key) => [key, false])));
    societalStage = playView.focus === 'societal' ? 'start' : 'final';
    const next = (i) => {
      if (i >= steps.length) return;
      const { keys = [], stage, enter = [], grow = [], exit = [], after = STAGGER_MS } = steps[i];
      cancelReveal.push(delay(after, () => {
        for (const key of keys) reveal[key] = true;
        if (stage) societalStage = stage;
        pendingEnter = enter;
        pendingGrow = grow;
        pendingExit = exit;
        render();
        next(i + 1);
      }));
    };
    next(0);
  }

  // Only a switched-on subsidy constrains the sliders — one that's off shouldn't make the
  // curve sliders stop early for a reason the student can't see.
  function isValid() {
    const intervention = subsidyToggle.checked ? { type: 'subsidy', amount: +subsidySlider.value } : null;
    return marketFits(readCurveParams(sliders).market, intervention);
  }

  const sliders = wireShiftAndSlopeInputs(doc, () => render(), isValid);

  // A subsidised CS/PS lens also draws its marginal band, so its legend entry shows too; the
  // government perspective adds the deadweight loss beside the spending box.
  function updateLegend(focus, subsidised) {
    const shown = ['demand', 'supply', focus];
    if (subsidised && (focus === 'cs' || focus === 'ps')) shown.push(`marginal-${focus}`);
    if (subsidised && focus === 'gov') shown.push('dwl');
    if (subsidised && focus === 'societal') shown.push('marginal-cs', 'marginal-ps', 'gov', 'dwl');
    // With a subsidy on, the CS/PS triangles are the free-market ones (the marginal bands are
    // listed beside them), so the legend calls them "old" like their chips.
    const split = subsidised && (focus === 'cs' || focus === 'ps');
    doc.querySelectorAll('.legend [data-legend]').forEach((item) => {
      const key = item.dataset.legend;
      item.hidden = focus ? !shown.includes(key) : false;
      const text = item.lastChild;
      if ((key === 'cs' || key === 'ps') && text) {
        item.dataset.legendText ??= text.textContent;
        text.textContent = split ? `Old ${item.dataset.legendText.toLowerCase()}` : item.dataset.legendText;
      }
    });
  }

  // The Societal lens says what each stage of the build-up is, in the words Explain uses.
  function societalNote(result, amount) {
    if (['start', 'strips', 'box', 'boxHold'].includes(societalStage)) return `<strong>Government spending: ${fmtMoney(result.govCost)}.</strong> ${fmtMoney(amount)} on every loaf sold, so the dashed box is the government's whole bill. Where does it end up?`;
    if (societalStage === 'mcs') return `<strong>Marginal consumer surplus: ${fmtMoney(result.marginalCS)}.</strong> Buyers pay less for every loaf, and that saving comes out of the government's box.`;
    if (societalStage === 'mps') return `<strong>Marginal producer surplus: ${fmtMoney(result.marginalPS)}.</strong> The bakery receives more for every loaf: the second slice of the box.`;
    return `<strong>Deadweight loss (DWL): ${fmtMoney(result.DWL)}.</strong> The corner nobody gets. Those extra loaves cost more to make than buyers value them at, so without the subsidy nobody would have traded them; buyers wouldn't have wanted them at that price, and no one gets a benefit to match.`;
  }

  // Play's render. Inputs on the Play controls (and the toggle's tween) keep firing it in
  // Explain too, but there it would overwrite the step's picture, so it only runs in Play.
  function render() {
    if (mode !== 'play') return;
    const curve = readCurveParams(sliders);
    const { market } = curve;
    const subsidyOn = subsidyToggle.checked;
    const amount = +subsidySlider.value;
    const { focus } = playView;

    updateShiftAndSlopeLabels(doc, curve);
    doc.querySelector('#subsidy-val').textContent = '$' + amount;

    const subsidyFraction = toggleCtl.getFraction();
    const subsidyActive = subsidyFraction > 0;
    const intervention = subsidyActive ? { type: 'subsidy', amount: amount * subsidyFraction } : { type: 'none' };
    const result = computeMarket({ ...market, intervention });

    const options = { showSurplusLabels: true, detail: chrome.getDetail(), focus, areaLabels: SUBSIDY_AREA_LABELS };
    if (focus && Object.values(reveal).includes(false)) {
      const held = resolveLayers(result, options);
      // The Pc line tracks e2 throughout, so holding the prices only withholds the Pp line.
      for (const [key, drawn] of Object.entries(reveal)) {
        if (drawn) continue;
        if (key === 'prices') { if (held.delete('prices')) held.add('pricesCOnly'); } else held.delete(key);
      }
      options.layers = [...held];
    }
    if (pendingEnter.length) { options.enter = pendingEnter; pendingEnter = []; }
    if (focus === 'societal' && subsidyActive) {
      const held = resolveLayers(result, options);
      const stage = SOCIETAL_STAGES[societalStage];
      stage.drop.forEach((name) => held.delete(name));
      stage.add.forEach((name) => held.add(name));
      options.layers = [...held];
      options.captions = {
        strip: `1 loaf: ${fmtMoney(amount)}`,
        box: `Government spending ${fmtMoney(result.govCost)}`, boxShort: `Gov ${fmtMoney(result.govCost)}`,
        // The bands are named in words while they arrive; at the end the chips (which carry the
        // figures) take their place, so the words are dropped to leave them room.
        ...(societalStage === 'final' ? {} : { mcs: 'marginal CS', mps: 'marginal PS' }),
      };
      // From the first band on, the spending box's outline goes solid (Explain's "back to the box").
      if (!['start', 'strips', 'box', 'boxHold'].includes(societalStage)) options.sequence = 'box';
    }
    if (pendingExit.length) { options.exit = pendingExit; pendingExit = []; }
    if (pendingGrow.length) { options.grow = pendingGrow; pendingGrow = []; }
    renderMarketChart(chart, result, options);
    updateLegend(focus, result.mode === 'subsidy');

    setStatusPill(doc.querySelector('#status-pill'), subsidyOn ? 'Subsidy applied' : 'Free market', result.mode);
    doc.querySelector('#stat-price-consumer').textContent = result.noTrade ? '—' : fmtPrice(result.Pc);
    doc.querySelector('#stat-price-producer').textContent = result.noTrade ? '—' : fmtPrice(result.Pp);
    fillSharedStats(doc, result);
    doc.querySelector('#stat-cost').textContent = result.noTrade ? '$0' : fmtMoney(result.govCost);
    doc.querySelector('#stat-incidence-consumer').textContent = result.noTrade || !subsidyActive ? '$0' : fmtMoney(result.marginalCS);
    doc.querySelector('#stat-incidence-producer').textContent = result.noTrade || !subsidyActive ? '$0' : fmtMoney(result.marginalPS);

    let note = '';
    if (result.noTrade) note = NO_TRADE_NOTE;
    else if (!subsidyActive && SUBSIDY_ONLY_FOCUS[focus]) note = `Turn the subsidy on to see ${SUBSIDY_ONLY_FOCUS[focus]}.`;
    else if (subsidyActive && focus === 'societal') note = societalNote(result, amount);
    else if (subsidyActive) note = `<strong>Deadweight loss (DWL): ${fmtMoney(result.DWL)}.</strong> The subsidy pushes output past the efficient quantity — the last few units cost more to produce than buyers value them at.`;
    doc.querySelector('#market-note').innerHTML = note;
  }

  guardSliders([subsidySlider], isValid);
  subsidySlider.addEventListener('input', () => {
    card.refresh(); // keep the Explain slider on the same amount
    render();
  });
  toggleCtl = wireInterventionToggle(subsidyToggle, render, { beforeOn: () => settleDown(subsidySlider, isValid), duration: 650 });
  subsidyToggle.addEventListener('change', () => {
    if (subsidyToggle.checked) { startReveal(); render(); } else resetReveal();
  });

  // ---- Explain ----
  // Always the default curves; the subsidy toggle doesn't matter here, only the step does.

  // Explain's curves: the page's default market, or (the last step) a steeper, inelastic demand
  // curve pivoting through the same equilibrium. Values are demand-elasticity slider positions.
  const stepDemand = (step) => DEMAND_SLIDER[step.demand ?? 'default'];
  let sweptSliderLast = false; // the step just left had the slide-to-the-ends task
  const explainIntervention = (step) => (step.subsidy ? { type: 'subsidy', amount: +subsidySlider.value } : { type: 'none' });
  // The text always describes the step's own curves, even while the chart is still tweening to them.
  function explainResult(step) {
    return computeMarket({ ...explainMarket(stepDemand(step)), intervention: explainIntervention(step) });
  }
  // Where the Explain chart's demand curve is now; a step that changes it tweens there, redrawing
  // every frame so the bands, prices and labels move with the curve.
  let demandNow = DEMAND_SLIDER.default;
  let cancelDemandTween = () => {};
  const chartResult = (step) => computeMarket({ ...explainMarket(demandNow), intervention: explainIntervention(step) });

  // The draggable cost dot (the "every point on S1 is one loaf" step): where it is, and the
  // student has reached the halo at TARGET_Q (Next unlocks then, and stays unlocked).
  // `pos` is where the dot is drawn (smooth, it glides and follows the pointer); `q` is the
  // whole loaf it's nearest, which the words and numbers name. `touched` hides the
  // "drag me" hint once the student has taken the dot; `gliding` hides it during the intro.
  // A step with `trigger` (step 4) waits on its Subsidise! button: `armed` while it hasn't been
  // pressed, with `armedWait` a promise the card's text-reveal waits behind (resolved on press, or
  // when the student leaves the step).
  let armed = false;
  let armedWait = null;
  const dot = { q: LOAF_Q, pos: LOAF_Q, explored: false, touched: false, gliding: false };
  let cancelSettle = () => {};
  // The revenue step's slide-down-and-back-up: has the subsidy slider reached $0, then the top.
  let sweep = { low: false, high: false };
  const sweepRange = () => ({ min: +subsidySlider.min, max: +subsidySlider.max });

  function explainContext(step) {
    return {
      amount: +subsidySlider.value, result: explainResult(step),
      dotQ: dot.q, dotPos: dot.pos, explored: dot.explored, touched: dot.touched, gliding: dot.gliding,
      armed, sweepLow: sweep.low, sweepHigh: sweep.high,
    };
  }

  const currentStep = () => SUBSIDY_STEPS[card ? card.index() : 0];

  // Re-renders the current step in place (no entry animation), keeping keyboard focus on the
  // dot, since a render rebuilds it.
  function redrawStep() {
    const hadFocus = doc.activeElement?.classList?.contains('cost-dot__handle');
    renderExplain(currentStep(), { animate: false });
    if (hadFocus) chart.querySelector('.cost-dot__handle')?.focus();
  }

  const DOT_LIMITS = [snapLoaf(0), snapLoaf(Infinity)];
  function moveDot(pos, byStudent) {
    dot.pos = Math.min(DOT_LIMITS[1], Math.max(DOT_LIMITS[0], pos));
    const next = snapLoaf(dot.pos);
    if (byStudent) {
      dot.touched = true;
      // Reached when the dot lands in, or sweeps through, the halo: TARGET_TOLERANCE loaves
      // either side of its centre (how big the chart draws it) plus one loaf, so the dot's body
      // touching the ring counts, not just its centre.
      const reach = TARGET_TOLERANCE + 1;
      const [from, to] = dot.q < next ? [dot.q, next] : [next, dot.q];
      dot.explored = dot.explored || (from <= TARGET_Q + reach && TARGET_Q - reach <= to);
    }
    const crossed = next !== dot.q;
    dot.q = next;
    redrawStep();
    // The card's words only change when the dot reaches another loaf (or the gate opens).
    if (crossed || byStudent) card.refresh();
  }

  // On release, the dot eases onto the loaf its numbers name.
  function settleDot() {
    cancelSettle();
    cancelSettle = tweenValue({ from: dot.pos, to: dot.q, duration: 350, onUpdate: (p) => { dot.pos = p; redrawStep(); } });
  }

  // On arriving at the drag step (or replaying it), the dot rests at its starting loaf with the
  // "drag me" hint. Progress toward the gate is kept once earned.
  function placeDot() {
    cancelSettle();
    dot.touched = false;
    dot.gliding = false;
    dot.pos = Math.min(DOT_LIMITS[1], Math.max(DOT_LIMITS[0], LOAF_Q));
    const crossed = snapLoaf(dot.pos) !== dot.q;
    dot.q = snapLoaf(dot.pos);
    // No redraw here: the step's own (animated) render comes next and draws the dot, so its
    // entry fade isn't wiped by a second, un-animated render.
    if (crossed) card.refresh();
  }

  // Dragging: pressing anywhere on the chart puts the dot at that loaf, and it follows the
  // pointer along S1 until release. Only on a step that asks for it.
  let dragging = false;
  chart.addEventListener('pointerdown', (e) => {
    if (mode !== 'explain' || !currentStep().drag) return;
    cancelSettle();
    dragging = true;
    chart.classList.add('is-dragging');
    chart.setPointerCapture?.(e.pointerId);
    moveDot(quantityAtClientX(chart, e.clientX), true);
    e.preventDefault();
  });
  chart.addEventListener('pointermove', (e) => {
    if (dragging) moveDot(quantityAtClientX(chart, e.clientX), true);
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    chart.classList.remove('is-dragging');
    settleDot();
  };
  chart.addEventListener('pointerup', endDrag);
  chart.addEventListener('pointercancel', endDrag);
  chart.addEventListener('keydown', (e) => {
    if (!e.target.closest?.('.cost-dot__handle')) return;
    const step = LOAF_STEP * (e.shiftKey ? 5 : 1);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { moveDot(dot.q + step, true); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { moveDot(dot.q - step, true); e.preventDefault(); }
  });

  // A coloured word in the step card (or a row of the chart's readout) lights up the marks it
  // names: the chart's data-hot fades every other marked thing (pages.css).
  const setHot = (e) => {
    const key = e.target.closest?.('[data-mark]')?.dataset.mark;
    if (key && e.target.closest('.term, .readout__row, .explain-card__readout-row')) chart.dataset.hot = key;
  };
  const clearHot = () => { delete chart.dataset.hot; };
  const explainCardEl = doc.querySelector('#explain-card');
  for (const host of [explainCardEl, chart]) {
    host.addEventListener('pointerover', setHot);
    host.addEventListener('pointerout', clearHot);
    host.addEventListener('focusin', setHot);
    host.addEventListener('focusout', clearHot);
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

  function renderExplain(step, { animate }) {
    if (mode !== 'explain') return;
    const ctx = explainContext(step);
    const ib = step.view === 'ib';
    const waiting = armed && step.trigger;
    const captions = step.captions?.(ctx);
    renderMarketChart(chart, chartResult(step), {
      detail: ib ? 'ib' : 'clean',
      // The IB wrap-up draws the full IB perfect diagram, i.e. the default layer set.
      // While a step waits on its button, its readout waits too, and the button is drawn.
      layers: ib ? undefined : waiting ? step.layers.filter((l) => l !== 'readout') : step.layers,
      captions: waiting ? { ...captions, readout: undefined, subsidiseButton: 'Subsidise!' } : captions,
      ...(waiting ? { loafArmed: true } : {}),
      areaLabels: SUBSIDY_AREA_LABELS,
      reserveDimBands: true, // room outside the axes for the revenue step's dimension lines
      arrowChip: false, // Explain's price brackets already carry the amount; no chip beside the arrow
      ...(typeof step.chartOptions === 'function' ? step.chartOptions(ctx) : step.chartOptions),
      ...(animate ? { enter: [...(step.enter ?? []), ...(step.fadeIn ?? [])], grow: step.grow } : {}),
    });
    // A step with its own demand curve (the inelastic one) tweens the chart there after it draws.
    cancelDemandTween();
    cancelDemandTween = () => {};
    const target = stepDemand(step);
    if (!animate) demandNow = target;
    if (target === demandNow) return;
    cancelDemandTween = tweenValue({
      from: demandNow, to: target, duration: 700,
      onUpdate: (v) => { demandNow = v; if (mode === 'explain') renderExplain(step, { animate: false }); },
    });
  }

  function deferred() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  }

  // Pressing Subsidise!: draw the step as it normally arrives (the arrow drops, the labels follow),
  // let the card reveal its text once that has played, and unlock Next.
  function subsidise() {
    if (!armed) return;
    armed = false;
    renderExplain(currentStep(), { animate: true });
    armedWait?.resolve();
    card.refresh();
  }
  chart.addEventListener('click', (e) => { if (e.target.closest?.('.subsidise-btn')) subsidise(); });
  chart.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('.subsidise-btn')) { e.preventDefault(); subsidise(); }
  });

  card = mountExplainCard(doc.querySelector('#explain-card'), {
    steps: SUBSIDY_STEPS,
    replayHost: doc.querySelector('.chart-head'),
    // Text waits for the step's animation; a step with a button waits for the press first.
    animationsDone: () => {
      const wait = () => whenAnimationsDone(chart, { only: currentStep().textAfter });
      return armedWait ? armedWait.promise.then(wait) : wait();
    },
    amount: +subsidySlider.value,
    min: +subsidySlider.min,
    max: +subsidySlider.max,
    getContext: () => explainContext(SUBSIDY_STEPS[card ? card.index() : 0]),
    // A step with `leave` plays its exit on the chart (the step redrawn with those layers fading)
    // before the card moves on; the promise resolves when it has played.
    onLeave: (step) => {
      if (!step.leave) return null;
      explainers?.close();
      clearHot();
      cancelSettle();
      const ctx = explainContext(step);
      renderMarketChart(chart, ctx.result, {
        detail: 'clean', layers: step.layers, captions: step.captions?.(ctx), areaLabels: SUBSIDY_AREA_LABELS,
        arrowChip: false, reserveDimBands: true, exit: step.leave.exit,
      });
      return new Promise((resolve) => { delay(step.leave.ms, resolve); });
    },
    onRender: (step, opts) => {
      explainers?.close();
      clearHot();
      chart.classList.toggle('is-draggable', Boolean(step.drag));
      if (opts.animate) {
        cancelSettle();
        armedWait?.resolve(); // a step we're leaving (or replaying) no longer waits
        armed = Boolean(step.trigger);
        armedWait = armed ? deferred() : null;
        card?.refresh(); // the card painted before this; its Next lock depends on `armed`
      }
      // The revenue step sends the slider to the top and leaves it there; later steps are drawn
      // for the page's default subsidy, so put it back as the student moves on.
      if (opts.animate && sweptSliderLast && !step.sliderHalo) { subsidySlider.value = subsidySlider.defaultValue; card?.refresh(); }
      if (opts.animate) sweptSliderLast = Boolean(step.sliderHalo);
      if (opts.animate && step.sliderHalo) { sweep = advanceSweep(sweep, +subsidySlider.value, sweepRange()); card?.refresh(); }
      if (opts.animate && step.drag) placeDot();
      renderExplain(step, opts);
      if (opts.animate) keepStepCardInView();
    },
    onAmount: (amount) => {
      subsidySlider.value = String(amount);
      if (currentStep().sliderHalo) sweep = advanceSweep(sweep, amount, sweepRange());
    },
    // Both of Explain's markets (default and inelastic demand) must stay on the chart.
    isValidAmount: (amount) => Object.values(DEMAND_SLIDER).every((k) => marketFits(explainMarket(k), { type: 'subsidy', amount })),
    onFinish() {
      writeMode('play', win);
      applyMode('play');
      // Land on the diagram the student just finished: animate the subsidy on.
      if (!subsidyToggle.checked) {
        subsidyToggle.checked = true;
        subsidyToggle.dispatchEvent(new Event('change'));
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
    // The chart's title always says what's being explained while the walkthrough runs.
    const chartTitle = doc.querySelector('.chart-title');
    if (chartTitle) chartTitle.innerHTML = mode === 'explain' ? 'The <span class="chart-title__word">subsidy</span>, step by step' : 'Price &amp; quantity';
  }

  function applyMode(next) {
    if (next === mode) return;
    mode = next;
    showMode();
    explainers?.close();
    if (mode === 'explain') {
      // Arriving back in Play by the mode switch or a link follows the site rule: subsidy
      // off. Switching it off now lets the tween finish while Explain is showing.
      if (subsidyToggle.checked) {
        subsidyToggle.checked = false;
        subsidyToggle.dispatchEvent(new Event('change'));
      }
      demandNow = DEMAND_SLIDER.default; // a fresh walkthrough starts on the default curves
      card.goTo(0);
    } else {
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
