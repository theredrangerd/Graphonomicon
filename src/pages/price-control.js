import { renderMiniHeader } from '../components/chrome.js';
import { computeMarket } from '../lib/marketEngine.js';
import { renderMarketChart } from '../lib/marketChart.js';
import { fmtPrice, setStatusPill } from '../lib/format.js';
import { getFamilyNav } from '../components/familyNav.js';
import { wireShiftAndSlopeInputs, updateShiftAndSlopeLabels, wireInterventionToggle, readCurveParams, marketFits, fillSharedStats, NO_TRADE_NOTE } from '../lib/pageControls.js';
import { attachRegionExplainers } from '../lib/regionExplainers.js';
import { FEEDBACK_FORM_URL } from '../lib/feedback.js';
import { initGraphChrome, maybeAutoStartTour, interventionTourSteps } from '../components/graphChrome.js';
import { readPlayView, writePlayView } from '../lib/pageMode.js';
import { mountViewSwitch } from '../components/viewSwitch.js';

// Shared controller for the price ceiling and price floor pages, which differ only in the
// intervention type, their element ids (`#<type>-toggle`, `#<type>-slider`, `#<type>-val`),
// and wording. Separate pages per CLAUDE.md (the regions differ); one implementation.
// Explorer foci that only exist once the control is on, and what the note calls them.
const CONTROL_ONLY_FOCUS = { dwl: 'the deadweight loss' };

export function initPriceControlPage(doc, { slug, title, type, bindingPill, gapNote, notBindingNote, gapName, focuses, showRegionLabels = false, tour }, win = window) {
  const { backHref, backLabel, siblings } = getFamilyNav(slug);
  renderMiniHeader(doc.querySelector('#mini-header'), { title, backHref, backLabel, siblings });

  const chart = doc.querySelector('#chart');
  const chartHead = doc.querySelector('.chart-head');
  let explainers;
  let playView = readPlayView(win, focuses.map(([id]) => id));
  // No detail gear: the IB perfect / Explorer switch replaces it, and the chart is always
  // drawn at the IB level. Created before the first render so the tour can find the switch.
  const chrome = initGraphChrome(doc, {
    chartHead,
    detailSettings: false,
    steps: (detail) => interventionTourSteps({ ...tour, clickableRegions: true, viewSwitch: true }, detail),
    onDetailChange: () => {},
  });
  mountViewSwitch(chartHead, {
    view: playView.view,
    focus: playView.focus,
    focuses,
    onChange(next) {
      playView = next;
      writePlayView(next, win);
      explainers?.close();
      render();
    },
  });

  // The legend keeps demand, supply and the focused area; the gap bracket has no swatch.
  function updateLegend(focus) {
    const shown = ['demand', 'supply', focus];
    doc.querySelectorAll('.legend [data-legend]').forEach((item) => {
      item.hidden = focus ? !shown.includes(item.dataset.legend) : false;
    });
  }

  const toggle = doc.querySelector(`#${type}-toggle`);
  const slider = doc.querySelector(`#${type}-slider`);

  // Animates the control in/out on toggle: it slides from the free-market equilibrium
  // price (where a ceiling/floor has zero effect) to its slider price, so the shortage or
  // excess supply grows in smoothly instead of the line snapping straight to its target.
  let toggleCtl;

  // A ceiling/floor never pushes quantity past the free-market Q*, so only the free
  // market itself needs to stay on-chart.
  const sliders = wireShiftAndSlopeInputs(doc, () => render(), () => marketFits(readCurveParams(sliders).market));

  function render() {
    const curve = readCurveParams(sliders);
    const { market } = curve;
    const controlPrice = +slider.value;

    updateShiftAndSlopeLabels(doc, curve);
    doc.querySelector(`#${type}-val`).textContent = '$' + controlPrice;

    const { Pstar } = computeMarket({ ...market, intervention: { type: 'none' } });
    const fraction = toggleCtl.getFraction();
    const displayPrice = Pstar + (controlPrice - Pstar) * fraction;
    const intervention = fraction > 0 ? { type, price: displayPrice } : { type: 'none' };
    const result = computeMarket({ ...market, intervention });

    const { focus } = playView;
    renderMarketChart(chart, result, { showSurplusLabels: showRegionLabels, detail: chrome.getDetail(), focus, reserveGapBand: true });
    updateLegend(focus);

    setStatusPill(doc.querySelector('#status-pill'), result.mode === type ? bindingPill : 'Free market', result.mode);

    doc.querySelector('#stat-price').textContent = result.noTrade ? '—' : fmtPrice(result.Pc);
    fillSharedStats(doc, result);

    const note = doc.querySelector('#market-note');
    if (result.noTrade) {
      note.innerHTML = NO_TRADE_NOTE;
    } else if (result.mode === type) {
      note.innerHTML = gapNote(result.gap);
    } else if (result.requestedControl) {
      note.innerHTML = notBindingNote;
    } else if (!toggle.checked && (focus === 'gap' || CONTROL_ONLY_FOCUS[focus])) {
      note.innerHTML = `Turn the ${type} on to see ${focus === 'gap' ? `the ${gapName}` : CONTROL_ONLY_FOCUS[focus]}.`;
    } else {
      note.innerHTML = '';
    }
  }

  slider.addEventListener('input', render);
  toggleCtl = wireInterventionToggle(toggle, render);

  render();
  explainers = attachRegionExplainers(chart);
  maybeAutoStartTour(chrome);
  doc.querySelector('#feedback-form').src = FEEDBACK_FORM_URL;
}
