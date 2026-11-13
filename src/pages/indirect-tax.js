import { renderMiniHeader } from '../components/chrome.js';
import { computeMarket } from '../lib/marketEngine.js';
import { renderMarketChart, resolveLayers } from '../lib/marketChart.js';
import { delay, tweenValue } from '../lib/animate.js';
import { fmtMoney, fmtPrice, fmtQty, fmtPence, setStatusPill } from '../lib/format.js';
import { getFamilyNav } from '../components/familyNav.js';
import { wireShiftAndSlopeInputs, updateShiftAndSlopeLabels, wireInterventionToggle, readCurveParams, marketFits, guardSliders, settleDown, fillSharedStats, NO_TRADE_NOTE } from '../lib/pageControls.js';
import { attachRegionExplainers } from '../lib/regionExplainers.js';
import { FEEDBACK_FORM_URL } from '../lib/feedback.js';
import { initGraphChrome, maybeAutoStartTour, interventionTourSteps } from '../components/graphChrome.js';
import { readMode, writeMode, onModeChange, readPlayView, writePlayView } from '../lib/pageMode.js';
import { mountModeLink } from '../components/modeSwitch.js';
import { mountViewSwitch, TAX_FOCUSES, TAX_FOCUS_ALIASES } from '../components/viewSwitch.js';
import { mountExplainCard } from '../components/explainCard.js';
import { whenAnimationsDone } from '../lib/animationSettle.js';
import { demandTween, explainMarket, stepDemand, fitsEveryExplainMarket, keepStepCardInView, EXPLAIN_DEMAND } from '../lib/explainRuntime.js';
import { advanceSweep, reachedTarget, wireChartDrag, wireTermHighlight } from '../lib/explainTasks.js';
import { TAX_STEPS, LEVY, EXPLAIN_LEVY_MAX, VAT_RATE, AXES, LITRE_Q, DOT_Q_MIN, DOT_Q_MAX, TARGET_Q, TARGET_TOLERANCE, snapLitre, WEDGE_START_Q, wedgeFits } from './indirectTaxExplainSteps.js';
import { replayOf } from '../lib/chain.js';
import { taxSocietyChain, taxSocietyNote, SHIFT_MS } from './taxSociety.js';

// 'full' | 'half' | 'none' — the tax's own copy of the subsidy's SUBSIDY_AREA_LABELS
// (Ms. Patel request 3): half names only the two burdens. Flip after she confirms.
export const TAX_AREA_LABELS = 'full';

// Explorer focuses that only exist once the tax is on, and what the note calls them.
const GOV_FOCUS = 'revenue'; // the "Government perspective" chip (id kept so shared links work)
const SOCIETY = 'societal'; // the Societal lens: who bears the tax, then what is lost (see taxSociety.js)
const TAX_ONLY_FOCUS = {
  'consumer-lens': 'the consumer burden and deadweight loss', 'producer-lens': 'the producer burden and deadweight loss', [GOV_FOCUS]: 'tax revenue',
  [SOCIETY]: 'the burdens and the deadweight loss',
};

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
  let playView = readPlayView(win, TAX_FOCUSES.map(([id]) => id), TAX_FOCUS_ALIASES, 'explorer');

  // No detail gear on this page, and Play is Explorer only (no IB perfect option); the
  // chart is always drawn at the IB level.
  const chrome = initGraphChrome(doc, {
    chartHead,
    detailSettings: false,
    steps: (detail) => interventionTourSteps({ policyName: 'tax', sliderNoun: 'tax', clickableRegions: true, explorerOnly: true }, detail),
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
    focuses: TAX_FOCUSES,
    ibView: false,
    onChange(next) {
      const prevFocus = playView.focus;
      playView = next;
      writePlayView(next, win);
      explainers?.close();
      // A newly picked area builds itself up the same way it does when the tax goes on. The
      // government perspective picked with the tax already on skips the steps the student has
      // already seen (the tax sliding in, its name, the bracket) and opens on the strips.
      if (taxToggle.checked && next.focus) startReveal(0, next.focus === GOV_FOCUS && prevFocus !== GOV_FOCUS ? GOV_STRIPS_STEP : 0);
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
  // Government perspective, tax switched on: a beat on the dot at Pe (the price being traded),
  // then the tax slides S1 up to S2, then the per-unit tax is named, then one strip per unit
  // fills in left to right out to Qtax, and last the box is outlined and its revenue chip drawn.
  const DOT_MS = 1700;
  const STRIPS_MS = 2000; // the strips' staggered fade (marketChart) plus a beat
  // Each lens, once the surplus has shrunk: the whole lost gap fills in one neutral colour, is
  // split at Qtax and named (captured by the government / no longer traded), then each half
  // takes its own colour (burden, deadweight loss) as the neutral fades, and last the chips.
  const READ_MS = 3000; // time to read the two names before the halves recolour
  const lensSteps = (burden, dwl) => [
    // The grey itself isn't held back: it is drawn from the first frame of the tax tween, growing
    // exactly as consumer / producer surplus shrinks, so it reads as that surplus turning grey.
    { keys: ['lostNote'], enter: ['lostNote'] },
    { keys: [burden, dwl], enter: [burden, dwl], exit: ['lost'], wait: READ_MS },
    { keys: ['focusChip'], enter: ['focusChip'], wait: 1200, before: () => { lostDone = true; } },
  ];
  const REVEALS = {
    'consumer-lens': lensSteps('taxConsumer', 'dwlConsumer'),
    'producer-lens': lensSteps('taxProducer', 'dwlProducer'),
    [GOV_FOCUS]: [
      { keys: ['taxArrow'], enter: ['taxArrow'] },
      { keys: ['qtyBracket'], enter: ['qtyBracket'], grow: ['qtyBracket'], wait: 1400 },
      { keys: ['taxHeight'], enter: ['taxHeight'], wait: 1400, before: () => { arrowNamed = false; } },
      { keys: ['govStrips'], enter: ['govStrips'], wait: 1500, before: () => { noteActive = false; } },
      // The solid box fades in over the strips while they fade out, so the seams dissolve rather than snap away.
      { keys: ['govFill', 'wedgeBox', 'focusChip'], enter: ['govFill', 'wedgeBox', 'focusChip'], exit: ['govStrips'], wait: STRIPS_MS },
      { keys: [], wait: 1000, before: () => { stripsMerged = true; } },
    ],
  };
  const GOV_STRIPS_STEP = REVEALS[GOV_FOCUS].findIndex((step) => step.keys.includes('govStrips'));
  let reveal = {};
  // The "this is the price being traded" note: on e1 before the tax moves, then it rides e2 as S1 slides up to S2.
  let noteActive = false;
  let lostDone = true; // a lens's neutral gap and its two names are gone once the halves have their colours
  let arrowNamed = true; // the arrow carries the tax's name until the price-axis bracket takes it over
  let stripsMerged = false; // the strips' seams have faded into the one solid box
  let pendingEnter = [];
  let pendingGrow = [];
  let pendingExit = [];
  let cancelReveal = [];
  let chainStep = null; // the Societal lens's step being shown; null = the finished picture
  const stopReveal = () => { cancelReveal.forEach((c) => c()); cancelReveal = []; chainStep = null; };
  const SOCIETY_CHAIN = taxSocietyChain();
  // The Societal lens plays its own chain (taxSociety.js), one step per entry. Picked with the tax already on
  // (`replay`) there is no shift to show, so it starts from the shifted picture without the arrows.
  function startSociety(replay) {
    stopReveal();
    reveal = {}; // nothing a previous lens held back applies here
    const steps = replay ? replayOf(SOCIETY_CHAIN) : SOCIETY_CHAIN;
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
  // `lead`: how long before the first step. A focus picked with the tax already on starts at
  // once; the toggle waits for its own tween.
  // `from`: the step to open on; earlier steps are shown as already done.
  function startReveal(lead = 0, from = 0) {
    if (playView.focus === SOCIETY) { startSociety(lead === 0); return; }
    stopReveal();
    const steps = REVEALS[playView.focus] ?? [];
    stripsMerged = false;
    arrowNamed = true;
    lostDone = false;
    noteActive = playView.focus === GOV_FOCUS && lead > 0;
    if (noteActive) pendingEnter = ['eq1Note'];
    reveal = Object.fromEntries(steps.flatMap((step, i) => step.keys.map((key) => [key, i < from])));
    steps.slice(0, from).forEach((step) => step.before?.());
    render();
    const run = (i, wait) => {
      if (i >= steps.length) return;
      const go = () => {
        const { keys, enter = [], grow = [], exit = [], before } = steps[i];
        before?.();
        for (const key of keys) reveal[key] = true;
        pendingEnter = enter;
        pendingGrow = grow;
        pendingExit = exit;
        render();
        run(i + 1, steps[i + 1]?.wait ?? STAGGER_MS);
      };
      if (wait > 0) cancelReveal.push(delay(wait, go)); else go();
    };
    run(from, lead);
  }

  // Only a switched-on tax constrains the sliders — a tax that's off shouldn't make the
  // curve sliders stop early for a reason the student can't see.
  function isValid() {
    return marketFits(readCurveParams(sliders).market, taxToggle.checked ? taxAt() : null);
  }

  const sliders = wireShiftAndSlopeInputs(doc, () => render(), isValid);

  // The legend keeps demand, supply and the focused area; revenue draws both burdens inside its box.
  const LEGEND_FOR = { 'consumer-lens': ['cs', 'tax-consumer', 'dwl'], 'producer-lens': ['ps', 'tax-producer', 'dwl'], [GOV_FOCUS]: ['revenue'], [SOCIETY]: ['tax-consumer', 'tax-producer', 'dwl'] };
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

    // The government perspective hangs its brackets outside the axes. That room is reserved in every view and added around the plot (growForBands), so the plot keeps its size across lenses.
    const options = { reserveGapBand: true, reserveDimBands: true, growForBands: true, showSurplusLabels: true, detail: chrome.getDetail(), focus, areaLabels: TAX_AREA_LABELS };
    if (focus && Object.values(reveal).includes(false)) {
      const held = resolveLayers(result, options);
      for (const [key, drawn] of Object.entries(reveal)) if (!drawn) held.delete(key);
      options.layers = [...held];
    }
    if (lostDone) options.layers = (options.layers ?? [...resolveLayers(result, options)]).filter((name) => name !== 'lost' && name !== 'lostNote');
    if (stripsMerged) options.layers = (options.layers ?? [...resolveLayers(result, options)]).filter((name) => name !== 'govStrips');
    if (noteActive) options.layers = [...(options.layers ?? resolveLayers(result, options)), taxActive ? 'eq2Note' : 'eq1Note'];
    if (focus === 'consumer-lens' || focus === 'producer-lens') {
      options.captions = { lostLeft: 'Captured by the government (tax revenue)', lostRight: 'No longer traded: deadweight loss' };
    }
    const step = focus === SOCIETY && taxActive && !result.noTrade && !result.closed ? chainStep : null;
    if (step) {
      const held = step.only ? new Set(step.only) : resolveLayers(result, { ...options, focus: SOCIETY });
      (step.drop ?? []).forEach((name) => held.delete(name));
      (step.add ?? []).forEach((name) => held.add(name));
      options.layers = [...held];
      options.focus = step.lens ?? SOCIETY; // the chips of the party being shown
      options.faintDrops = true; // the line rises with the arrows, so they only need to hint at the lift
      if (step.emphasis) options.emphasis = step.emphasis;
      const perUnit = fmtMoney(result.Pc - result.Pp);
      const taxName = kind === 'advalorem' ? `${advaloremSlider.value}% tax` : `${perUnit} tax`;
      options.captions = {
        lostLeft: 'Captured by the government (tax revenue)', lostRight: 'No longer traded: deadweight loss',
        taxHeight: kind === 'advalorem' ? `${taxName} (${perUnit})` : taxName,
      };
      options.lostNotesAt = SOCIETY; // the names sit under the whole grey gap
    }
    if (pendingExit.length) { options.exit = pendingExit; pendingExit = []; }
    if (focus === GOV_FOCUS) {
      const perUnit = fmtMoney(result.Pc - result.Pp);
      const taxName = kind === 'advalorem' ? `${advaloremSlider.value}% tax` : `${perUnit} tax`;
      options.captions = {
        // Explain's names: Pe stays the old price; the new one buyers pay is Pc.
        eq1Note: `Pe ${fmtPrice(result.Pstar)}: the price being traded`,
        // While the tax is still sliding on, the price is on its way (Explain shows it bare too); Pc once it's there.
        eq2Note: taxFraction < 1 ? fmtPrice(result.Pc) : `Pc ${fmtPrice(result.Pc)}: the price buyers pay`,
        taxArrow: arrowNamed ? taxName : undefined,
        taxHeight: kind === 'advalorem' ? `${taxName} (${perUnit})` : taxName, strip: `1 unit = ${perUnit}`,
        qtyBracket: `${fmtQty(result.Q)} units traded`,
      };
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
    } else if (taxActive && focus === SOCIETY) {
      note = taxSocietyNote(chainStep?.stage ?? 'final', result, fmtMoney);
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
  specificSlider.addEventListener('input', render);
  advaloremSlider.addEventListener('input', render);
  [modeSpecific, modeAdvalorem].forEach((input) => input.addEventListener('change', () => {
    settleActiveSlider();
    render();
  }));
  toggleCtl = wireInterventionToggle(taxToggle, render, { beforeOn: settleActiveSlider, duration: () => (playView.focus === SOCIETY ? SHIFT_MS : 650), holdOn: () => (playView.focus === GOV_FOCUS ? DOT_MS : 0) });
  taxToggle.addEventListener('change', () => {
    if (taxToggle.checked) startReveal(TOGGLE_MS + (playView.focus === GOV_FOCUS ? DOT_MS : 0)); else { stopReveal(); reveal = {}; lostDone = true; }
  });

  // ---- Explain ----
  // The UK sugar levy, step by step (indirectTaxExplainSteps.js): its own market in pence a litre
  // and millions of litres, with its own levy amount. Play's toggle, radios and $ slider don't
  // matter here, only the step and what the student has done on it.

  let levy = LEVY;
  const explainTax = (step) => (step.tax === 'advalorem' ? { type: 'tax', mode: 'advalorem', rate: VAT_RATE }
    : step.tax ? { type: 'tax', mode: 'specific', amount: levy } : { type: 'none' });
  const NO_TAX = { type: 'none' };
  const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2);
  const demand = demandTween();

  // What the student has done, kept for the visit (progress toward a gate is kept once earned):
  // the cost dot (step 3: `pos` is where it's drawn, `q` the whole litre it names), the guess
  // (step 8: `prediction`, and `revealed` once the chart has answered it, with `rideT` the price
  // note's ride from e1 to e2), the wedge (step 9) and the slide-down-and-up (step 11).
  const dot = { q: LITRE_Q, pos: LITRE_Q, explored: false, touched: false };
  let prediction = null;
  let revealed = false;
  let rideT = 1;
  const wedge = { q: WEDGE_START_Q, fit: false, touched: false };
  let sweep = { low: false, high: false };
  const sweepRange = { min: 0, max: EXPLAIN_LEVY_MAX };
  let cancelMotion = () => {}; // the dot's settle or the guess's ride, whichever is running
  let entering = null; // the promise a step's held entry resolves (step 20 waits for its curve)
  let settleToken = 0;

  const currentStep = () => TAX_STEPS[card ? card.index() : 0];
  const valueOf = (field, ctx) => (typeof field === 'function' ? field(ctx) : field);

  // The text always describes the step's own curves, even while the chart is still tweening to them.
  function explainContext(step) {
    const market = explainMarket(stepDemand(step));
    return {
      amount: levy,
      result: computeMarket({ ...market, intervention: explainTax(step) }),
      free: computeMarket({ ...market, intervention: NO_TAX }),
      dotQ: dot.q, dotPos: dot.pos, explored: dot.explored, touched: dot.touched,
      prediction, revealed, rideT: revealed ? 1 : rideT,
      wedgeQ: wedge.q, wedgeFit: wedge.fit, wedgeTouched: wedge.touched,
      sweepLow: sweep.low, sweepHigh: sweep.high,
    };
  }

  // Draws one frame of a step. `animate` plays its entry (its `transient` layers come and go as
  // part of it); `reveal` plays what a student's action brings in instead (step.reveal). A step
  // that tweens its demand curve with `enterAfterDemand` shows the bare market until the curve
  // has arrived, then plays its entry.
  function drawExplain(step, { animate = false, reveal = false } = {}) {
    if (mode !== 'explain') return;
    const ctx = explainContext(step);
    const settled = demand.settled(step);
    const bare = !settled && step.enterAfterDemand;
    const result = settled ? ctx.result : computeMarket({ ...explainMarket(demand.now()), intervention: bare ? NO_TAX : explainTax(step) });
    const ib = step.view === 'ib';
    const playing = animate && !bare;
    const captions = bare ? {} : step.captions?.(ctx) ?? {};
    let layers;
    if (bare) layers = ['demand', 'supply', 'eq1'];
    // An exam-diagram step draws the exam diagram, plus its readout (the numbers its words use) and whatever passes through.
    else if (ib) layers = [...resolveLayers(result, { detail: 'ib' }), ...(captions.readout ? ['readout'] : []), ...(playing ? step.transient ?? [] : [])];
    else layers = [...valueOf(step.layers, ctx), ...(playing ? step.transient ?? [] : [])];
    // An exam-diagram step's entry brings in everything after the curves it starts from.
    // (The Pc line and its symbol are named 'pricesC' inside the prices layer, so they come in with it.)
    const enter = reveal ? step.reveal.enter
      : !playing ? undefined
        : ib ? (step.sequence ? [...layers.filter((name) => !['demand', 'supply', 'eq1'].includes(name)), 'pricesC'] : undefined)
          : step.enter;
    renderMarketChart(chart, result, {
      detail: ib ? 'ib' : 'clean',
      layers,
      captions,
      areaLabels: TAX_AREA_LABELS,
      axisLabels: AXES,
      // Room outside the axes, on every step, for the brackets steps 10-11 hang there, so the plot never resizes.
      reserveGapBand: true, reserveDimBands: true,
      emphasis: valueOf(step.emphasis, ctx),
      ...valueOf(step.chartOptions, ctx),
      ...(reveal ? { enter, sequence: step.reveal.sequence } : {}),
      ...(playing ? { enter, grow: step.grow, exit: step.transient, sequence: step.sequence } : {}),
    });
  }

  // Once a step's entry has played, it's drawn again as it rests, without the marks that only
  // passed through it (a rebuilt chart would otherwise bring them back, e.g. on a resize).
  function settleWhenDone(step) {
    const mine = ++settleToken;
    const settle = () => { if (mine === settleToken && currentStep() === step) drawExplain(step); };
    const done = whenAnimationsDone(chart);
    if (done) done.then(settle); else settle();
  }

  function renderExplain(step, { animate }) {
    if (mode !== 'explain') return;
    ++settleToken;
    entering = demand.follow(step, animate, (first) => drawExplain(step, { animate: first }), { enterAfter: Boolean(step.enterAfterDemand) });
    if (animate && (step.transient || step.sequence)) {
      if (entering) entering.then(() => settleWhenDone(step)); else settleWhenDone(step);
    }
  }

  // Re-renders the current step in place (no entry), keeping keyboard focus on a dragged mark.
  function redrawStep() {
    const focused = doc.activeElement?.closest?.('.cost-dot__handle, .wedge-drag__handle')?.classList[0];
    drawExplain(currentStep());
    if (focused) chart.querySelector(`.${focused}`)?.focus();
  }

  // The cost dot (step 3): it follows the pointer smoothly, names the whole litre it's nearest,
  // and on release eases onto that litre.
  function moveDot(pos, byStudent) {
    dot.pos = Math.min(DOT_Q_MAX, Math.max(DOT_Q_MIN, pos));
    const next = snapLitre(dot.pos);
    if (byStudent) {
      dot.touched = true;
      dot.explored = dot.explored || reachedTarget(dot.q, next, TARGET_Q, TARGET_TOLERANCE + 1);
    }
    const crossed = next !== dot.q;
    dot.q = next;
    redrawStep();
    if (crossed || byStudent) card.refresh();
  }
  function settleDot() {
    cancelMotion();
    cancelMotion = tweenValue({ from: dot.pos, to: dot.q, duration: 350, onUpdate: (v) => { dot.pos = v; redrawStep(); } });
  }

  // The wedge (step 9): it follows the pointer along demand until it fits at Q_tax, then locks
  // there, the chart answers (S2 comes back above it, Pp is drawn out from its foot) and the words follow.
  function moveWedge(q) {
    if (wedge.fit) return;
    wedge.touched = true;
    wedge.q = Math.min(DOT_Q_MAX, Math.max(DOT_Q_MIN, q));
    const step = currentStep();
    if (wedgeFits(wedge.q, explainContext(step).result)) {
      wedge.fit = true;
      drawExplain(step, { reveal: true });
      card.refresh();
      const answered = whenAnimationsDone(chart) ?? Promise.resolve();
      card.waitFor(answered);
      // A keyboard user carries straight on from the handle (rebuilt by the redraw) to Next.
      answered.then(() => { if (currentStep() === step) doc.querySelector('#explain-card .explain-btn--primary')?.focus(); });
      return;
    }
    redrawStep();
    card.refresh();
  }

  const dragging = () => mode === 'explain' && currentStep().drag;
  wireChartDrag(chart, {
    isActive: () => Boolean(dragging()),
    handleSelector: '.cost-dot__handle, .wedge-drag__handle',
    onMove: (q) => { cancelMotion(); if (dragging() === 'wedge') moveWedge(q); else moveDot(q, true); },
    onRelease: () => { if (dragging() === 'dot') settleDot(); },
    onKey: (dir, big) => {
      if (dragging() === 'wedge') moveWedge(wedge.q + dir * (big ? 5 : 1));
      else moveDot(dot.q + dir * (big ? 5 : 1), true);
    },
  });

  // The guess (step 8): once made, the price note rides along demand from e1 to e2, counting up to
  // Pc, then the chart answers (the Pc line, the "all of it" line and the gap), and the words follow.
  function guess(choice) {
    if (prediction != null) return;
    prediction = choice;
    const step = currentStep();
    card.refresh();
    let landed;
    card.waitFor(new Promise((resolve) => { landed = resolve; }));
    cancelMotion();
    cancelMotion = tweenValue({
      from: 0, to: 1, duration: 1600, easing: easeInOut,
      onUpdate: (v) => { rideT = v; drawExplain(step); },
      onComplete: () => {
        revealed = true;
        drawExplain(step, { reveal: true });
        card.refresh();
        const done = whenAnimationsDone(chart);
        if (done) done.then(landed); else landed();
      },
    });
  }

  const clearHot = wireTermHighlight(chart, [doc.querySelector('#explain-card'), chart]);

  // Arriving on a step (or replaying it): set up its task. Progress toward a gate is kept once earned.
  function arriveAt(step) {
    cancelMotion();
    if (step.sliderHalo) sweep = advanceSweep(sweep, levy, sweepRange);
    if (step.drag === 'dot') Object.assign(dot, { q: LITRE_Q, pos: LITRE_Q, touched: false });
    if (step.drag === 'wedge' && !wedge.fit) Object.assign(wedge, { q: WEDGE_START_Q, touched: false });
    // A guess the chart hadn't finished answering (the student left mid-ride) can be made again.
    if (step.predict && !revealed) { prediction = null; rideT = 0; }
    card?.refresh();
  }

  // Explain's levy slider must keep both of its markets (default and elastic demand) on the chart and trading.
  const explainFits = (amount) => fitsEveryExplainMarket((market) => {
    const tax = { type: 'tax', mode: 'specific', amount };
    return marketFits(market, tax) && !computeMarket({ ...market, intervention: tax }).closed;
  }, ['default', 'elastic']);

  // Out of Explain into Play, onto the diagram the student just finished, with the tax animated on.
  // A student who leaves for Play from the middle of the walkthrough comes back to the step they left.
  let resumeAt = 0;
  function goToPlay(setUp) {
    resumeAt = card.index();
    tourChecked = true; // they came to try something: the first-visit tour would cover it
    writeMode('play', win);
    applyMode('play');
    setUp();
    if (!taxToggle.checked) {
      taxToggle.checked = true;
      taxToggle.dispatchEvent(new Event('change'));
    } else render();
  }

  card = mountExplainCard(doc.querySelector('#explain-card'), {
    steps: TAX_STEPS,
    replayHost: doc.querySelector('.chart-head'),
    // The words wait for the step's animation (and a step that tweens its curve first, for that).
    animationsDone: () => {
      const wait = () => whenAnimationsDone(chart, { only: currentStep().textAfter });
      return entering ? entering.then(wait) : wait();
    },
    amount: levy,
    min: 0,
    max: EXPLAIN_LEVY_MAX,
    sliderLabel: 'Levy per litre',
    formatAmount: fmtPence,
    getContext: () => explainContext(currentStep()),
    onRender: (step, opts) => {
      explainers?.close();
      clearHot();
      chart.classList.toggle('is-draggable', Boolean(step.drag));
      if (opts.animate) arriveAt(step);
      // Arriving on the guess after it has been answered shows the answer straight away.
      renderExplain(step, opts);
      if (opts.animate) keepStepCardInView(doc);
    },
    onLeave: (step) => {
      if (step.resetAmountOnLeave) levy = LEVY;
      return null;
    },
    onAmount: (amount) => {
      levy = amount;
      if (currentStep().sliderHalo) sweep = advanceSweep(sweep, amount, sweepRange);
    },
    onPredict: guess,
    isValidAmount: explainFits,
    // Mid-walkthrough, "Try elasticity in Play →": the specific tax on, demand as elastic as Explain's.
    onPlayLink: () => goToPlay(() => {
      modeSpecific.checked = true;
      const slopeD = doc.querySelector('#slope-d-slider');
      slopeD.value = String(EXPLAIN_DEMAND.elastic);
      slopeD.dispatchEvent(new Event('input'));
      slopeD.scrollIntoView?.({ block: 'center' });
      slopeD.focus?.({ preventScroll: true });
    }),
    // The last step, "Try ad valorem in Play →": a 20% ad valorem tax on the default curves (as on that step),
    // even if an earlier exit left Play's demand elastic.
    onFinish: () => goToPlay(() => {
      for (const id of ['#demand-slider', '#supply-slider', '#slope-d-slider', '#slope-s-slider']) {
        const input = doc.querySelector(id);
        if (input.value !== '0') { input.value = '0'; input.dispatchEvent(new Event('input')); }
      }
      modeAdvalorem.checked = true;
      advaloremSlider.value = String(VAT_RATE * 100);
      modeAdvalorem.dispatchEvent(new Event('change'));
    }),
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
    // The chart's title says what's being explained while the walkthrough runs.
    const chartTitle = doc.querySelector('.chart-title');
    if (chartTitle) chartTitle.innerHTML = mode === 'explain' ? 'The <span class="chart-title__word">sugar levy</span>, step by step' : 'Price &amp; quantity';
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
      demand.reset(); // a fresh walkthrough starts on the default curves
      card.goTo(resumeAt);
      resumeAt = 0;
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
