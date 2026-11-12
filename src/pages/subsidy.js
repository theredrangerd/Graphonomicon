import { renderMiniHeader } from '../components/chrome.js';
import { computeMarket } from '../lib/marketEngine.js';
import { renderMarketChart, resolveLayers, quantityAtClientX } from '../lib/marketChart.js';
import { delay, tweenValue } from '../lib/animate.js';
import { fmtMoney, fmtPrice, setStatusPill } from '../lib/format.js';
import { getFamilyNav } from '../components/familyNav.js';
import { wireShiftAndSlopeInputs, updateShiftAndSlopeLabels, wireInterventionToggle, readCurveParams, marketFits, guardSliders, settleDown, fillSharedStats, NO_TRADE_NOTE } from '../lib/pageControls.js';
import { attachRegionExplainers } from '../lib/regionExplainers.js';
import { FEEDBACK_FORM_URL } from '../lib/feedback.js';
import { initGraphChrome, maybeAutoStartTour, interventionTourSteps } from '../components/graphChrome.js';
import { readMode, writeMode, onModeChange, readPlayView, writePlayView } from '../lib/pageMode.js';
import { mountModeLink } from '../components/modeSwitch.js';
import { mountViewSwitch, SUBSIDY_FOCUSES, SUBSIDY_FOCUS_ALIASES } from '../components/viewSwitch.js';
import { mountExplainCard } from '../components/explainCard.js';
import { whenAnimationsDone } from '../lib/animationSettle.js';
import { demandTween, explainMarket, stepDemand, fitsEveryExplainMarket, keepStepCardInView } from '../lib/explainRuntime.js';
import { SUBSIDY_STEPS, LOAF_Q, LOAF_STEP, DOT_Q_MIN, DOT_Q_MAX, TARGET_Q, TARGET_TOLERANCE, snapLoaf, advanceSweep, EXPLAIN_SUBSIDY_MAX } from './subsidyExplainSteps.js';

export const SUBSIDY_AREA_LABELS = 'full'; // 'full' | 'half' | 'none' — Ms. Patel request 3; flip after she confirms.

// Explorer focuses that only exist once the subsidy is on, and what the note calls them.
const SUBSIDY_ONLY_FOCUS = { gov: 'government spending', cs: 'the marginal consumer surplus', ps: 'the marginal producer surplus', societal: 'the marginal surpluses and the deadweight loss' };

// The Play chain of analysis for a lens (see initSubsidyPage): one entry per step, each held for the
// next entry's `after` ms. A step draws either exactly the layers in `only`, or the finished picture
// changed by `drop` and `add`; `enter`/`grow`/`exit` animate layers on that step (marketChart.js).
const BASE = ['demand', 'supply', 'eq1'];
const BASELINE = { cs: ['csTriangle', 'focusChip'], ps: ['psTriangle', 'focusChip'] }; // already there before the toggle
// The step after the shift waits for the toggle's tween to finish: a tween frame landing after it would
// re-render without the step's `enter` and cut its animation short.
const TWEEN_SETTLE_MS = 150;
const SHIFT_MS = 1000; // the arrows grow down and S2 and e2 slide with them (the toggle's tween, same length)
const FINAL_PARTS = ['wedgeBox', 'marginalCs', 'marginalPs', 'dwl', 'focusChip'];
export function subsidyChain(focus) {
  const keep = [...BASE, ...(BASELINE[focus] ?? [])];
  const withS2 = [...keep, 'supply2'];
  const atE2 = [...withS2, 'eq2'];
  const priced = [...atE2, 'prices'];
  // One motion, not three: the arrows grow down from S1 as S2 slides down with them, and e2 (already
  // on S2, with its line to the quantity axis) slides along. The page's toggle tween drives it, so no
  // layer enters here; the next step brings the arrows back out.
  const shift = { stage: 'shift', only: [...atE2, 'loafDrops'], after: 0 };
  const thenLeave = (step) => ({ ...step, only: [...step.only, 'loafDrops'], exit: [...(step.exit ?? []), 'loafDrops'], after: SHIFT_MS + TWEEN_SETTLE_MS });
  const finish = (extra = {}) => ({ stage: 'final', ...extra });
  if (focus === 'cs') {
    return [shift,
      thenLeave({ stage: 'pc', only: [...atE2, 'pricesCOnly'], enter: ['pricesC'] }),
      finish({ enter: ['marginalCs', 'focusChip'], after: 1000 })];
  }
  if (focus === 'ps') {
    return [shift,
      thenLeave({ stage: 'received', only: [...atE2, 'prices', 'subsidyArrow'], enter: ['subsidyArrow', 'prices', 'pricesC'] }),
      finish({ enter: ['marginalPs', 'focusChip'], after: 1100 })];
  }
  const prices = thenLeave({ stage: 'prices', only: priced, enter: ['pricesC', 'prices'] });
  if (focus === 'gov') {
    // The budget: customers pay Pc, the government's payment lifts that to what the bakery receives
    // (the arrow from e2 up to S1, then the Pp line), and it pays that on every loaf sold, one strip
    // per loaf, which make up the spending box.
    const received = [...priced, 'subsidyArrow'];
    return [shift,
      thenLeave({ stage: 'pc', only: [...atE2, 'pricesCOnly'], enter: ['pricesC'] }),
      { stage: 'received', only: received, enter: ['subsidyArrow', 'prices'], after: 1100 },
      { stage: 'strips', only: [...received, 'govStrips'], enter: ['govStrips'], after: 1300 },
      { stage: 'box', only: [...received, 'govStrips', 'govFill', 'wedgeBox', 'boxLabel'], enter: ['govFill', 'wedgeBox', 'boxLabel'], exit: ['govStrips'], after: 2000 },
      // The label gives way before the chip arrives: the chip is placed around whatever labels are up.
      { stage: 'unlabel', only: [...received, 'govFill', 'wedgeBox', 'boxLabel'], exit: ['boxLabel'], after: 2000 },
      finish({ enter: ['focusChip'], after: 800 })];
  }
  if (focus === 'societal') {
    // Explain's build-up: the box, which hands its money out as marginal CS, then marginal PS, then
    // the grey corner ("?") that turns out to be deadweight loss, and last the chips.
    return [shift, prices,
      { stage: 'strips', drop: FINAL_PARTS, add: ['govStrips'], enter: ['govStrips'], after: 1000 },
      { stage: 'box', drop: FINAL_PARTS.slice(1), add: ['govStrips', 'govFill', 'boxLabel'], enter: ['govFill', 'wedgeBox', 'boxLabel'], exit: ['govStrips'], after: 2000 },
      { stage: 'boxHold', drop: FINAL_PARTS.slice(1), add: ['govFill', 'boxLabel'], after: 1100 },
      { stage: 'mcs', drop: ['marginalPs', 'dwl', 'focusChip'], add: ['govFill', 'boxLabel'], enter: ['marginalCs'], exit: ['govFill', 'boxLabel'], after: 2200 },
      { stage: 'mps', drop: ['dwl', 'focusChip'], enter: ['marginalPs'], after: 2000 },
      { stage: 'unknown', drop: ['dwl', 'focusChip'], add: ['dwlUnknown'], enter: ['dwlUnknown'], after: 2000 },
      { stage: 'dwl', drop: ['focusChip'], add: ['dwlUnknown'], enter: ['dwl'], after: 2400 },
      finish({ enter: ['focusChip'], after: 1600 })];
  }
  return [];
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
      if (subsidyToggle.checked) startReveal(); else { resetReveal(); render(); }
    },
  });

  // ---- Play ----

  // Animates the subsidy's magnitude in/out on toggle so the supply curve and its shaded
  // regions shift smoothly instead of snapping between free-market and subsidized states.
  let toggleCtl;

  // Explorer focus, subsidy switched on: the page plays the lens's chain (subsidyChain). Every lens
  // opens with the shift (arrows down from S1, S2 and e2 sliding with them), then runs its own
  // stakeholder's part. The last step is the finished picture, which is also what a slider drag shows.
  const CHAINS = Object.fromEntries(SUBSIDY_FOCUSES.map(([id]) => [id, subsidyChain(id)]));
  let chainStep = null; // the step being shown; null = the finished picture
  let pendingEnter = [];
  let pendingGrow = [];
  let pendingExit = [];
  let cancelReveal = [];
  const stopReveal = () => { cancelReveal.forEach((c) => c()); cancelReveal = []; };
  function resetReveal() { stopReveal(); chainStep = null; pendingEnter = []; pendingGrow = []; pendingExit = []; }
  // Plays the focus's chain from its first step (each step renders itself), or just draws the
  // finished picture when the focus has none.
  function startReveal() {
    stopReveal();
    const steps = CHAINS[playView.focus] ?? [];
    if (!steps.length) { chainStep = null; render(); return; }
    const run = (i) => {
      const step = steps[i];
      chainStep = step;
      pendingEnter = step.enter ?? [];
      pendingGrow = step.grow ?? [];
      pendingExit = step.exit ?? [];
      render();
      if (step.stage === 'final') chainStep = null; // from here on a slider drag shows the finished picture
      else cancelReveal.push(delay(steps[i + 1].after, () => run(i + 1)));
    };
    run(0);
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
    const stage = chainStep?.stage ?? 'final';
    if (['shift', 'prices'].includes(stage)) return '';
    if (['strips', 'box', 'boxHold'].includes(stage)) return `<strong>Government spending: ${fmtMoney(result.govCost)}.</strong> ${fmtMoney(amount)} on every loaf sold, so the dashed box is the government's whole bill. Where does it end up?`;
    if (stage === 'mcs') return `<strong>Marginal consumer surplus: ${fmtMoney(result.marginalCS)}.</strong> Buyers pay less for every loaf, and that saving comes out of the government's box.`;
    if (stage === 'mps') return `<strong>Marginal producer surplus: ${fmtMoney(result.marginalPS)}.</strong> The bakery receives more for every loaf: the second slice of the box.`;
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

    // Government's arrow (e2 up to S1) is a length, not a figure: a chip would put the number there too.
    const options = { showSurplusLabels: true, detail: chrome.getDetail(), focus, areaLabels: SUBSIDY_AREA_LABELS, arrowChip: focus !== 'gov' };
    const step = subsidyActive && !result.noTrade ? chainStep : null;
    if (step) {
      const held = step.only ? new Set(step.only) : resolveLayers(result, options);
      (step.drop ?? []).forEach((name) => held.delete(name));
      (step.add ?? []).forEach((name) => held.add(name));
      options.layers = [...held];
      options.captions = {};
      options.faintDrops = true; // the line slides with the arrows, so they only need to hint at the drop
      if (focus === 'gov' || focus === 'societal') {
        Object.assign(options.captions, {
          strip: `1 loaf: ${fmtMoney(amount)}`,
          box: `Government spending ${fmtMoney(result.govCost)}`, boxShort: `Gov ${fmtMoney(result.govCost)}`,
        });
      }
      if (focus === 'societal') {
        // The bands are named in words while they arrive; at the end the chips (which carry the
        // figures) take their place, so the words are dropped to leave them room.
        if (step.stage !== 'final') Object.assign(options.captions, { mcs: 'marginal CS', mps: 'marginal PS' });
        // From the first band on, the spending box's outline goes solid (Explain's "back to the box").
        if (!['shift', 'prices', 'strips', 'box', 'boxHold'].includes(step.stage)) options.sequence = 'box';
      }
    }
    if (pendingEnter.length) { options.enter = pendingEnter; pendingEnter = []; }
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
    doc.querySelector('#market-note').innerHTML = note;
  }

  guardSliders([subsidySlider], isValid);
  subsidySlider.addEventListener('input', () => {
    card.refresh(); // keep the Explain slider on the same amount
    render();
  });
  // Switching on tweens the subsidy in over the chain's first step: the arrows grow down as S2 and e2 slide with them.
  toggleCtl = wireInterventionToggle(subsidyToggle, render, { beforeOn: () => settleDown(subsidySlider, isValid), duration: SHIFT_MS });
  subsidyToggle.addEventListener('change', () => {
    if (subsidyToggle.checked) startReveal(); else resetReveal();
  });

  // ---- Explain ----
  // Always the default curves; the subsidy toggle doesn't matter here, only the step does.

  const demand = demandTween();
  const explainIntervention = (step) => (step.subsidy ? { type: 'subsidy', amount: +subsidySlider.value } : { type: 'none' });

  // The draggable cost dot (the "every point on S1 is one loaf" step): `pos` is where the dot
  // is drawn (smooth, it follows the pointer and eases onto a loaf on release); `q` is the
  // whole loaf it's nearest, which the words and numbers name. `explored`: the student has
  // reached the halo at TARGET_Q (Next unlocks then, and stays unlocked). `touched` hides the
  // "drag me" hint once the student has taken the dot.
  // A step with `trigger` (step 4) waits on its Subsidise! button: `armed` while it hasn't been
  // pressed, with `armedWait` a promise the card's text-reveal waits behind (resolved on press, or
  // when the student leaves the step).
  let armed = false;
  let armedWait = null;
  const dot = { q: LOAF_Q, pos: LOAF_Q, explored: false, touched: false };
  let cancelSettle = () => {};
  // The revenue step's slide-down-and-back-up: has the subsidy slider reached $0, then the top.
  let sweep = { low: false, high: false };
  const sweepRange = () => ({ min: +subsidySlider.min, max: EXPLAIN_SUBSIDY_MAX });

  // The text always describes the step's own curves, even while the chart is still tweening to them.
  function explainContext(step) {
    return {
      amount: +subsidySlider.value,
      result: computeMarket({ ...explainMarket(stepDemand(step)), intervention: explainIntervention(step) }),
      dotQ: dot.q, dotPos: dot.pos, explored: dot.explored, touched: dot.touched,
      armed, sweepLow: sweep.low, sweepHigh: sweep.high,
    };
  }

  const currentStep = () => SUBSIDY_STEPS[card ? card.index() : 0];

  // Draws one frame of a step. `animate` plays its entry; `exit` fades those layers out.
  function drawExplain(step, { animate = false, exit } = {}) {
    if (mode !== 'explain') return;
    const ctx = explainContext(step);
    // Mid-tween the chart is on curves of its own; otherwise it's the step's, already computed.
    const result = demand.settled(step) ? ctx.result : computeMarket({ ...explainMarket(demand.now()), intervention: explainIntervention(step) });
    const ib = step.view === 'ib';
    // While a step waits on its button, its readout waits too, and the button is drawn.
    const waiting = armed && step.trigger;
    const captions = step.captions?.(ctx);
    renderMarketChart(chart, result, {
      detail: ib ? 'ib' : 'clean',
      // The IB wrap-up draws the full IB perfect diagram, i.e. the default layer set.
      layers: ib ? undefined : waiting ? step.layers.filter((l) => l !== 'readout') : step.layers,
      captions: waiting ? { ...captions, readout: undefined, subsidiseButton: 'Subsidise!' } : captions,
      ...(waiting ? { loafArmed: true } : {}),
      areaLabels: SUBSIDY_AREA_LABELS,
      reserveDimBands: true, // room outside the axes for the revenue step's dimension lines
      ppDot: true, // the price the bakery receives, marked where it meets S1, from "One loaf, two prices" on
      arrowChip: false, // Explain's price brackets already carry the amount; no chip beside the arrow
      ...(typeof step.chartOptions === 'function' ? step.chartOptions(ctx) : step.chartOptions),
      ...(animate ? { enter: [...(step.enter ?? []), ...(step.fadeIn ?? [])], grow: step.grow } : {}),
      ...(exit ? { exit } : {}),
    });
  }

  // A step with its own demand curve (the inelastic one) tweens the chart there after it draws.
  function renderExplain(step, { animate }) {
    if (mode !== 'explain') return;
    demand.follow(step, animate, (first) => drawExplain(step, { animate: first }));
  }

  // Re-renders the current step in place (no entry animation), keeping keyboard focus on the
  // dot, since a render rebuilds it.
  function redrawStep() {
    const hadFocus = doc.activeElement?.classList?.contains('cost-dot__handle');
    renderExplain(currentStep(), { animate: false });
    if (hadFocus) chart.querySelector('.cost-dot__handle')?.focus();
  }

  function moveDot(pos, byStudent) {
    dot.pos = Math.min(DOT_Q_MAX, Math.max(DOT_Q_MIN, pos));
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
  for (const host of [doc.querySelector('#explain-card'), chart]) {
    host.addEventListener('pointerover', setHot);
    host.addEventListener('pointerout', clearHot);
    host.addEventListener('focusin', setHot);
    host.addEventListener('focusout', clearHot);
  }

  function deferred() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  }

  // Arriving on a step (or replaying it): reset whatever the step before left behind and set up
  // this step's task. Progress toward a gate (the dot's halo, the sweep) is kept once earned.
  function arriveAt(step) {
    cancelSettle();
    armedWait?.resolve(); // a step we're leaving (or replaying) no longer waits
    armed = Boolean(step.trigger);
    armedWait = armed ? deferred() : null;
    if (step.sliderHalo) sweep = advanceSweep(sweep, +subsidySlider.value, sweepRange());
    // The dot rests at its starting loaf with the "drag me" hint. No redraw here: the step's own
    // (animated) render comes next and draws it, so its entry fade isn't wiped.
    if (step.drag) Object.assign(dot, { q: LOAF_Q, pos: LOAF_Q, touched: false });
    card?.refresh(); // the card painted before this; its Next lock and words depend on the above
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
    max: EXPLAIN_SUBSIDY_MAX,
    getContext: () => explainContext(currentStep()),
    // A step with `leave` plays its exit on the chart (the step redrawn with those layers fading)
    // before the card moves on; the promise resolves when it has played.
    onLeave: (step) => {
      if (!step.leave) return null;
      explainers?.close();
      clearHot();
      cancelSettle();
      drawExplain(step, { exit: step.leave.exit });
      return new Promise((resolve) => { delay(step.leave.ms, resolve); });
    },
    onRender: (step, opts) => {
      explainers?.close();
      clearHot();
      chart.classList.toggle('is-draggable', Boolean(step.drag));
      if (opts.animate) arriveAt(step);
      renderExplain(step, opts);
      if (opts.animate) keepStepCardInView(doc);
    },
    onAmount: (amount) => {
      subsidySlider.value = String(amount);
      if (currentStep().sliderHalo) sweep = advanceSweep(sweep, amount, sweepRange());
    },
    // Both of Explain's markets (default and inelastic demand) must stay on the chart.
    isValidAmount: (amount) => fitsEveryExplainMarket((market) => marketFits(market, { type: 'subsidy', amount })),
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
      demand.reset(); // a fresh walkthrough starts on the default curves
      card.goTo(0);
    } else {
      demand.stop();
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
