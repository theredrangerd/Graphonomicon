import { renderMiniHeader } from '../components/chrome.js';
import { renderMarketChart } from '../lib/marketChart.js';
import { fmtPrice, setStatusPill } from '../lib/format.js';
import { getFamilyNav } from '../components/familyNav.js';
import { buildControlChart, readControlState } from '../lib/controlChart.js';
import { wireShiftAndSlopeInputs, updateShiftAndSlopeLabels, wireInterventionToggle, readCurveParams, marketFits, fillSharedStats, NO_TRADE_NOTE } from '../lib/pageControls.js';
import { attachRegionExplainers } from '../lib/regionExplainers.js';
import { FEEDBACK_FORM_URL } from '../lib/feedback.js';
import { initGraphChrome, maybeAutoStartTour, interventionTourSteps } from '../components/graphChrome.js';
import { readPlayView, writePlayView } from '../lib/pageMode.js';
import { mountViewSwitch, CONTROL_FOCUS_ALIASES } from '../components/viewSwitch.js';
import { mountCompareMode } from '../components/compareMode.js';

// Shared controller for the price ceiling and price floor pages, which differ only in the
// intervention type, their element ids (`#<type>-toggle`, `#<type>-slider`, `#<type>-val`),
// and wording. Separate pages per CLAUDE.md (the regions differ); one implementation.
// Explorer foci that only exist once the control is on, and what the note calls them.
const CONTROL_ONLY_FOCUS = { societal: 'the deadweight loss' };

export function initPriceControlPage(doc, { slug, title, type, bindingPill, gapNote, notBindingNote, focuses, questions, showRegionLabels = false, tour }, win = window) {
  const { backHref, backLabel, siblings } = getFamilyNav(slug);
  renderMiniHeader(doc.querySelector('#mini-header'), { title, backHref, backLabel, siblings });

  const chart = doc.querySelector('#chart');
  const chartHead = doc.querySelector('.chart-head');
  let explainers;
  let playView = readPlayView(win, focuses.map(([id]) => id), CONTROL_FOCUS_ALIASES, 'explorer');
  // No detail gear: the lens tiles replace it, and the chart is always drawn at the IB level.
  // Created before the first render so the tour can find the tiles.
  const chrome = initGraphChrome(doc, {
    chartHead,
    detailSettings: false,
    steps: (detail) => interventionTourSteps({ ...tour, clickableRegions: true, explorerOnly: true }, detail),
    onDetailChange: () => {},
  });
  const viewSwitch = mountViewSwitch(chartHead, {
    view: playView.view,
    focus: playView.focus,
    focuses,
    questions,
    ibView: false,
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
  let compare;

  // A ceiling/floor never pushes quantity past the free-market Q*, so only the free
  // market itself needs to stay on-chart.
  const sliders = wireShiftAndSlopeInputs(doc, () => render(), () => marketFits(readCurveParams(sliders).market));

  function render() {
    const state = readControlState({ sliders, controlSlider: slider, toggle, playView });
    const { result, curve, options } = buildControlChart(state, { type, showRegionLabels, fraction: toggleCtl.getFraction() });

    updateShiftAndSlopeLabels(doc, curve);
    doc.querySelector(`#${type}-val`).textContent = '$' + state.controlPrice;

    const { focus } = playView;
    const chartFocus = options.focus;
    renderMarketChart(chart, result, options);
    updateLegend(chartFocus);

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
    } else if (!toggle.checked && CONTROL_ONLY_FOCUS[focus]) {
      note.innerHTML = `Turn the ${type} on to see ${CONTROL_ONLY_FOCUS[focus]}.`;
    } else {
      note.innerHTML = '';
    }
    compare?.notifyChange();
  }

  slider.addEventListener('input', render);
  toggleCtl = wireInterventionToggle(toggle, render);

  // Puts a frozen state back on the live page. The toggle goes through its own change event
  // so it tweens in like any other switch-on; the sliders are set before the one render.
  function applyControlState(state) {
    sliders.demandSlider.value = String(state.demand);
    sliders.supplySlider.value = String(state.supply);
    sliders.slopeDSlider.value = String(state.slopeD);
    sliders.slopeSSlider.value = String(state.slopeS);
    slider.value = String(state.controlPrice);
    playView = { view: state.view, focus: state.focus };
    viewSwitch.set(playView);
    writePlayView(playView, win);
    explainers?.close();
    if (toggle.checked !== state.on) {
      toggle.checked = state.on;
      toggle.dispatchEvent(new Event('change'));
    }
    render();
  }

  render();
  explainers = attachRegionExplainers(chart);
  compare = mountCompareMode(doc, {
    chartHead,
    chart,
    page: slug,
    getState: () => readControlState({ sliders, controlSlider: slider, toggle, playView }),
    drawSnapshot(svg, snapshot) {
      const { result, options } = buildControlChart(snapshot.state, { type, showRegionLabels });
      renderMarketChart(svg, result, options);
    },
    applyState: applyControlState,
    labelOptions: { type, focuses },
  });
  maybeAutoStartTour(chrome);
  doc.querySelector('#feedback-form').src = FEEDBACK_FORM_URL;
}
