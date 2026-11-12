import { renderMiniHeader } from '../components/chrome.js';
import { computeMarket } from '../lib/marketEngine.js';
import { renderMarketChart, resolveLayers } from '../lib/marketChart.js';
import { delay } from '../lib/animate.js';
import { fmtMoney, fmtPrice, fmtQty, setStatusPill } from '../lib/format.js';
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
import { demandTween, explainMarket, stepDemand, fitsEveryExplainMarket, keepStepCardInView } from '../lib/explainRuntime.js';
import { TAX_STEPS } from './indirectTaxExplainSteps.js';
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
      options.captions = { lostLeft: 'Captured by the government (tax revenue)', lostRight: 'No longer traded: deadweight loss' };
    }
    if (pendingExit.length) { options.exit = pendingExit; pendingExit = []; }
    if (focus === GOV_FOCUS) {
      const perUnit = fmtMoney(result.Pc - result.Pp);
      const taxName = kind === 'advalorem' ? `${advaloremSlider.value}% tax` : `${perUnit} tax`;
      options.captions = {
        eq1Note: `Pe1 ${fmtPrice(result.Pstar)}: the price being traded`,
        eq2Note: `Pe2 ${fmtPrice(result.Pc)}: the price being traded`,
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
  specificSlider.addEventListener('input', () => {
    card.refresh(); // keep the Explain slider on the same amount
    render();
  });
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
  // Always a specific tax on the default curves (one step swaps in inelastic demand); the
  // Play toggle and tax-mode radios don't matter here, only the step does.

  const explainTax = (step) => (step.tax ? { type: 'tax', mode: 'specific', amount: +specificSlider.value } : { type: 'none' });

  // The step text always describes the step's own curves, even while the chart is still
  // tweening toward them.
  function explainContext(step) {
    return { amount: +specificSlider.value, result: computeMarket({ ...explainMarket(stepDemand(step)), intervention: explainTax(step) }) };
  }

  const demand = demandTween();

  function drawExplain(step, animate) {
    if (mode !== 'explain') return;
    const ctx = explainContext(step);
    // Mid-tween the chart is on curves of its own; otherwise it's the step's, already computed.
    const result = demand.settled(step) ? ctx.result : computeMarket({ ...explainMarket(demand.now()), intervention: explainTax(step) });
    const ib = step.view === 'ib';
    renderMarketChart(chart, result, {
      detail: ib ? 'ib' : 'clean',
      // The IB wrap-up draws the full IB perfect diagram, i.e. the default layer set.
      layers: ib ? undefined : step.layers,
      captions: step.captions?.(ctx),
      areaLabels: TAX_AREA_LABELS,
      ...(animate ? { enter: step.enter, grow: step.grow } : {}),
    });
  }

  function renderExplain(step, { animate }) {
    if (mode !== 'explain') return;
    demand.follow(step, animate, (first) => drawExplain(step, first));
  }

  // Explain's slider must keep both of its markets (default and inelastic demand) on the
  // chart and still trading.
  const explainFits = (amount) => fitsEveryExplainMarket((market) => {
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
      if (opts.animate) keepStepCardInView(doc);
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
