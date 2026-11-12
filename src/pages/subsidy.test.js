import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initSubsidyPage, SUBSIDY_AREA_LABELS } from './subsidy.js';

function buildDom() {
  document.body.innerHTML = `
    <div id="mini-header"></div>
    <section class="chart-card">
      <div class="chart-head"><span id="status-pill"></span></div>
      <svg id="chart" class="market-chart"></svg>
    </section>
    <div class="legend">
      ${['demand', 'supply', 'cs', 'ps', 'marginal-cs', 'marginal-ps', 'overlap', 'gov', 'dwl'].map((k) => `<span class="item" data-legend="${k}"></span>`).join('')}
    </div>
    <section class="card explain-card" id="explain-card" hidden></section>
    <input id="demand-slider" type="range" min="-50" max="50" step="1" value="0">
    <span id="demand-val"></span>
    <input id="supply-slider" type="range" min="-50" max="50" step="1" value="0">
    <span id="supply-val"></span>
    <input id="slope-d-slider" type="range" min="-0.5" max="0.5" step="0.05" value="0">
    <span id="slope-d-val"></span>
    <input id="slope-s-slider" type="range" min="-0.5" max="0.5" step="0.05" value="0">
    <span id="slope-s-val"></span>
    <input id="subsidy-toggle" type="checkbox">
    <input id="subsidy-slider" type="range" min="0" max="60" step="1" value="20">
    <span id="subsidy-val"></span>
    <span id="stat-price-consumer"></span>
    <span id="stat-price-producer"></span>
    <span id="stat-qty"></span>
    <span id="stat-cs"></span>
    <span id="stat-ps"></span>
    <span id="stat-cost"></span>
    <span id="stat-incidence-consumer"></span>
    <span id="stat-incidence-producer"></span>
    <span id="stat-dwl"></span>
    <div id="market-note"></div>
    <iframe id="feedback-form"></iframe>
  `;
}

describe('initSubsidyPage', () => {
  beforeEach(() => {
    buildDom();
    initSubsidyPage(document);
  });

  it('renders the free-market baseline stats with the subsidy toggled off', () => {
    expect(document.querySelector('#stat-price-consumer').textContent).toBe('$80.00');
    expect(document.querySelector('#stat-qty').textContent).toBe('60.0');
    expect(document.querySelector('#stat-cost').textContent).toBe('$0');
    expect(document.querySelector('#status-pill').textContent).toBe('Free market');
  });

  it('shows the subsidy outcome once the toggle is switched on', () => {
    document.querySelector('#subsidy-toggle').checked = true;
    document.querySelector('#subsidy-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelector('#stat-price-consumer').textContent).toBe('$70.00');
    expect(document.querySelector('#stat-price-producer').textContent).toBe('$90.00');
    expect(document.querySelector('#stat-qty').textContent).toBe('67.5');
    expect(document.querySelector('#stat-cost').textContent).toBe('$1,350');
    expect(document.querySelector('#status-pill').textContent).toBe('Subsidy applied');
  });

  it('updates the outcome when the subsidy amount slider changes', () => {
    document.querySelector('#subsidy-toggle').checked = true;
    document.querySelector('#subsidy-toggle').dispatchEvent(new Event('change'));
    document.querySelector('#subsidy-slider').value = '40';
    document.querySelector('#subsidy-slider').dispatchEvent(new Event('input'));
    expect(document.querySelector('#stat-qty').textContent).not.toBe('67.5');
  });

  it('draws a wedge fill rectangle for the government cost once toggled on', () => {
    document.querySelector('#subsidy-toggle').checked = true;
    document.querySelector('#subsidy-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelector('#chart polygon.wedge-outline')).not.toBeNull();
  });

  it('shows the true point elasticity at equilibrium, rising as the elasticity slider is dragged right (flatter)', () => {
    expect(document.querySelector('#slope-d-val').textContent).toBe('1.00 · unit elastic');
    document.querySelector('#slope-d-slider').value = '0.5';
    document.querySelector('#slope-d-slider').dispatchEvent(new Event('input'));
    expect(document.querySelector('#slope-d-val').textContent).toBe('3.16 · elastic');
    document.querySelector('#slope-d-slider').value = '-0.5';
    document.querySelector('#slope-d-slider').dispatchEvent(new Event('input'));
    expect(document.querySelector('#slope-d-val').textContent).toBe('0.32 · inelastic');
  });

  it('shows a supply readout that rises as the slider is dragged right toward more supply', () => {
    document.querySelector('#supply-slider').value = '10';
    document.querySelector('#supply-slider').dispatchEvent(new Event('input'));
    expect(document.querySelector('#supply-val').textContent).toBe('+10');
    expect(document.querySelector('#stat-qty').textContent).toBe('63.8');
  });

  it('stops the elasticity sliders before the subsidised quantity runs off the chart', () => {
    document.querySelector('#subsidy-toggle').checked = true;
    document.querySelector('#subsidy-toggle').dispatchEvent(new Event('change'));
    document.querySelector('#subsidy-slider').value = '60';
    document.querySelector('#subsidy-slider').dispatchEvent(new Event('input'));
    document.querySelector('#slope-d-slider').value = '0.5';
    document.querySelector('#slope-d-slider').dispatchEvent(new Event('input'));
    document.querySelector('#slope-s-slider').value = '0.5';
    document.querySelector('#slope-s-slider').dispatchEvent(new Event('input'));
    expect(+document.querySelector('#stat-qty').textContent).toBeLessThanOrEqual(100);
    expect(+document.querySelector('#slope-s-slider').value).toBeLessThan(0.5);
  });

  it('pulls the subsidy back into range when switched on with flat curves', () => {
    document.querySelector('#slope-d-slider').value = '0.5';
    document.querySelector('#slope-d-slider').dispatchEvent(new Event('input'));
    document.querySelector('#slope-s-slider').value = '0.5';
    document.querySelector('#slope-s-slider').dispatchEvent(new Event('input'));
    document.querySelector('#subsidy-slider').value = '60';
    document.querySelector('#subsidy-slider').dispatchEvent(new Event('input'));
    document.querySelector('#subsidy-toggle').checked = true;
    document.querySelector('#subsidy-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelector('#subsidy-val').textContent).toBe('$33');
    expect(+document.querySelector('#stat-qty').textContent).toBeLessThanOrEqual(100);
  });

  it('shows consumer and producer surplus stats alongside government cost', () => {
    expect(document.querySelector('#stat-cs').textContent).not.toBe('');
    expect(document.querySelector('#stat-ps').textContent).not.toBe('');
  });

  it('renders a mini-header back link to the Government Intervention family page', () => {
    const back = document.querySelector('#mini-header a.mini-header__back');
    expect(back).not.toBeNull();
    expect(back.getAttribute('href')).toBe('/units/microeconomics/government-intervention.html');
  });

  it('renders sibling diagram links (excluding itself) in the mini-header', () => {
    const links = document.querySelectorAll('#mini-header .mini-header__siblings a');
    expect(links.length).toBeGreaterThan(0);
    expect([...links].some((a) => a.textContent === 'Subsidy')).toBe(false);
    expect([...links].some((a) => a.textContent === 'Indirect tax')).toBe(true);
  });
});

// A stand-in window whose URL the test controls; history.replaceState rewrites it and
// fire('hashchange') plays a hand-edited hash.
function fakeWin(url) {
  const listeners = {};
  const win = {
    location: {},
    history: { replaceState(_s, _t, next) { setUrl(next); } },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    fire(type) { (listeners[type] || []).forEach((fn) => fn()); },
  };
  function setUrl(next) {
    const u = new URL(next, 'http://test.local/units/microeconomics/government-intervention/subsidy.html');
    Object.assign(win.location, { pathname: u.pathname, search: u.search, hash: u.hash });
  }
  setUrl(url);
  return win;
}

const $ = (sel) => document.querySelector(sel);
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text);
const toggleOn = () => { $('#subsidy-toggle').checked = true; $('#subsidy-toggle').dispatchEvent(new Event('change')); };

describe('initSubsidyPage — Explain and Play', () => {
  beforeEach(() => { buildDom(); });

  it('does not start the tour in Explain, then starts it on the first switch to Play', () => {
    localStorage.clear();
    try {
      initSubsidyPage(document, fakeWin('subsidy.html#explain'));
      expect(document.querySelector('.tour-bubble')).toBeNull();
      $('.mode-switch input[value="play"]').click();
      expect(document.querySelector('.tour-bubble')).not.toBeNull();
    } finally {
      document.querySelectorAll('.tour-bubble, .tour-backdrop, .tour-spotlight').forEach((n) => n.remove());
      localStorage.clear();
    }
  });

  it('exports the area-label setting', () => {
    expect(SUBSIDY_AREA_LABELS).toBe('full');
  });

  it('lands a bare URL in Play on Explorer, with the focus bar, no IB perfect option and no detail gear', () => {
    initSubsidyPage(document, fakeWin('subsidy.html'));
    expect(document.body.dataset.mode).toBe('play');
    expect($('.detail-gear')).toBeNull();
    expect($('.view-switch')).toBeNull();
    expect($('.mode-switch')).not.toBeNull();
    expect($('.focus-bar').hidden).toBe(false);
    expect($('#chart').dataset.detail).toBe('ib');
    expect($('#chart [data-region="subsidy-overlap"]')).toBeNull();
  });

  it('opens #explain on step 1, drawing only demand', () => {
    initSubsidyPage(document, fakeWin('subsidy.html#explain'));
    expect(document.body.dataset.mode).toBe('explain');
    expect($('#explain-card .explain-card__count').textContent).toBe('Step 1 of 19');
    expect($('#chart line.demand-curve')).not.toBeNull();
    expect($('#chart line.supply-curve')).toBeNull();
  });

  it('opens a shared Explorer link on its focus: only the CS fill is drawn', () => {
    initSubsidyPage(document, fakeWin('subsidy.html?view=explorer&focus=cs#play'));
    const fills = [...document.querySelectorAll('#chart .region--fill')];
    expect(fills.length).toBeGreaterThan(0);
    fills.forEach((f) => expect(f.dataset.region).toBe('cs'));
  });

  it('shows only demand, supply and the focused item in the legend', () => {
    initSubsidyPage(document, fakeWin('subsidy.html?focus=ps#play'));
    const shown = () => [...document.querySelectorAll('.legend [data-legend]')].filter((i) => !i.hidden).map((i) => i.dataset.legend);
    expect(shown()).toEqual(['demand', 'supply', 'ps']);
  });

  it('keeps the view in the URL when the student switches it', () => {
    const win = fakeWin('subsidy.html#play');
    initSubsidyPage(document, win);
    $('.focus-chip[data-focus="ps"]').click();
    expect(win.location.search).toBe('?view=explorer&focus=ps');
  });

  it('offers the government perspective, the two lenses and the societal lens, and opens retired links on their replacements', () => {
    initSubsidyPage(document, fakeWin('subsidy.html?view=explorer&focus=dwl#play'));
    expect([...document.querySelectorAll('.focus-chip')].map((c) => c.dataset.focus)).toEqual(['gov', 'cs', 'ps', 'societal']);
    expect($('.focus-chip[aria-pressed="true"]').dataset.focus).toBe('gov');
    initSubsidyPage(document, fakeWin('subsidy.html?view=explorer&focus=overlap#play'));
    expect($('.focus-chip[aria-pressed="true"]').dataset.focus).toBe('cs');
  });

  it('offers a Societal lens last', () => {
    initSubsidyPage(document, fakeWin('subsidy.html?view=explorer&focus=societal#play'));
    expect([...document.querySelectorAll('.focus-chip')].map((c) => c.dataset.focus)).toEqual(['gov', 'cs', 'ps', 'societal']);
    expect($('.focus-chip[aria-pressed="true"]').dataset.focus).toBe('societal');
    expect($('#market-note').textContent).toContain('Turn the subsidy on');
  });

  it('Societal lens ends on just the marginal CS, marginal PS and deadweight loss inside the spending box outline', () => {
    initSubsidyPage(document, fakeWin('subsidy.html?view=explorer&focus=societal#play'));
    toggleOn(); // the page's timers run at once under Vitest, so this is the finished sequence
    const regions = new Set([...document.querySelectorAll('#chart [data-region]')].map((e) => e.dataset.region));
    // 'subsidy-cost' is the dashed box outline (tappable), not a fill.
    expect(regions).toEqual(new Set(['marginal-cs', 'marginal-ps', 'dwl', 'subsidy-cost']));
    expect($('#chart .gov-fill')).toBeNull();
    expect($('#chart .wedge-outline')).not.toBeNull();
    expect($('#chart .gov-strips')).toBeNull();
    expect($('#chart [data-layer="govFill"]')).toBeNull();
    expect($('#market-note').textContent).toContain('nobody would have traded');
  });

  it('Societal lens lists only what it shows in the legend', () => {
    initSubsidyPage(document, fakeWin('subsidy.html?view=explorer&focus=societal#play'));
    toggleOn();
    const shown = [...document.querySelectorAll('.legend [data-legend]')].filter((i) => !i.hidden).map((i) => i.dataset.legend);
    expect(shown).toEqual(['demand', 'supply', 'marginal-cs', 'marginal-ps', 'gov', 'dwl']);
  });

  it('draws the deadweight loss in the government perspective once the subsidy is on', () => {
    initSubsidyPage(document, fakeWin('subsidy.html?view=explorer&focus=gov#play'));
    expect($('#chart [data-region="dwl"]')).toBeNull();
    toggleOn();
    expect($('#chart [data-region="dwl"]')).not.toBeNull();
    expect($('#chart [data-region="subsidy-cost"]')).not.toBeNull();
    const shown = [...document.querySelectorAll('.legend [data-legend]')].filter((i) => !i.hidden).map((i) => i.dataset.legend);
    expect(shown).toEqual(['demand', 'supply', 'gov', 'dwl']);
    expect($('#market-note').textContent).not.toContain('Turn the subsidy on');
  });

  it('says to turn the subsidy on when the Explorer focus has nothing to show', () => {
    initSubsidyPage(document, fakeWin('subsidy.html?view=explorer&focus=gov#play'));
    expect($('#market-note').textContent).toContain('Turn the subsidy on');
    expect($('#market-note').textContent).toContain('government spending and the deadweight loss');
    toggleOn();
    expect($('#market-note').textContent).not.toContain('Turn the subsidy on');
  });

  it('step 4 waits on a Subsidise! button on the dot, then drops the arrow and unlocks Next', async () => {
    initSubsidyPage(document, fakeWin('subsidy.html#explain'));
    document.querySelectorAll('.explain-card .explain-dot')[3].click();
    expect($('#explain-card .explain-card__count').textContent).toBe('Step 4 of 19');
    // Armed: the dot and its cost are there, the drop, its labels and the readout are not.
    expect($('#chart .subsidise-btn')).not.toBeNull();
    expect($('#chart .loaf-drop circle')).not.toBeNull();
    expect($('#chart .loaf-drop__arrow')).toBeNull();
    expect($('#chart .readout')).toBeNull();
    expect($('#chart').textContent).not.toContain('from government');
    expect(button('Press Subsidise!').disabled).toBe(true);
    expect($('#explain-card').classList.contains('explain-card--waiting')).toBe(true);
    // The pulsing button is the only cue: the card says nothing extra while it waits.
    expect($('#explain-card .explain-card__think').hidden).toBe(true);
    // Pressing it brings the step in as it normally arrives.
    $('#chart .subsidise-btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect($('#chart .subsidise-btn')).toBeNull();
    expect($('#chart .loaf-drop__arrow')).not.toBeNull();
    expect($('#chart .readout')).not.toBeNull();
    expect($('#chart').textContent).toContain('from government');
    expect(button('Next').disabled).toBe(false);
    expect($('#explain-card .explain-card__think').hidden).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect($('#explain-card').classList.contains('explain-card--waiting')).toBe(false);
  });

  it('Enter on the Subsidise! button also presses it, and leaving the step lets go of the wait', async () => {
    initSubsidyPage(document, fakeWin('subsidy.html#explain'));
    document.querySelectorAll('.explain-card .explain-dot')[3].click();
    $('#chart .subsidise-btn').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect($('#chart .loaf-drop__arrow')).not.toBeNull();
    // Re-arrives armed (Back then forward), and moving on without pressing never leaves text hidden.
    document.querySelectorAll('.explain-card .explain-dot')[2].click();
    document.querySelectorAll('.explain-card .explain-dot')[3].click();
    expect($('#chart .subsidise-btn')).not.toBeNull();
    document.querySelectorAll('.explain-card .explain-dot')[1].click();
    await new Promise((r) => setTimeout(r, 0));
    expect($('#explain-card').classList.contains('explain-card--waiting')).toBe(false);
  });

  it('a slider tick on step 4 redraws without re-running the step animation', () => {
    initSubsidyPage(document, fakeWin('subsidy.html#explain'));
    document.querySelectorAll('.explain-card .explain-dot')[3].click();
    $('#chart .subsidise-btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const slider = $('.explain-slider');
    slider.value = '30';
    slider.dispatchEvent(new Event('input'));
    expect($('#chart .layer-enter')).toBeNull();
    expect($('#chart .subsidise-btn')).toBeNull();
  });

  it('shares one subsidy amount between the Explain slider and the Play slider', () => {
    initSubsidyPage(document, fakeWin('subsidy.html#explain'));
    $('.explain-card .explain-dot:nth-child(4)').click();
    const slider = $('.explain-slider');
    slider.value = '30';
    slider.dispatchEvent(new Event('input'));
    expect($('#subsidy-slider').value).toBe('30');
    $('#subsidy-slider').value = '25';
    $('#subsidy-slider').dispatchEvent(new Event('input'));
    expect(slider.value).toBe('25');
  });

  it('follows a hand-edited hash, and entering Explain always restarts at step 1', () => {
    const win = fakeWin('subsidy.html#explain');
    initSubsidyPage(document, win);
    button('Next').click();
    win.location.hash = '#play';
    win.fire('hashchange');
    expect(document.body.dataset.mode).toBe('play');
    expect($('.mode-switch input[value="play"]').checked).toBe(true);
    $('.mode-switch input[value="explain"]').click();
    expect(document.body.dataset.mode).toBe('explain');
    expect(win.location.hash).toBe('#explain');
    expect($('#explain-card .explain-card__count').textContent).toBe('Step 1 of 19');
  });

  it('Try it in Play → on step 19 switches to Play with the subsidy animated on', () => {
    const win = fakeWin('subsidy.html#explain');
    initSubsidyPage(document, win);
    document.querySelectorAll('.explain-card .explain-dot')[18].click();
    button('Try it in Play →').click();
    expect(document.body.dataset.mode).toBe('play');
    expect(win.location.hash).toBe('#play');
    expect($('#subsidy-toggle').checked).toBe(true);
    expect($('#stat-cost').textContent).toBe('$1,350');
  });

  it('draws the IB perfect diagram on the wrap-up step', () => {
    initSubsidyPage(document, fakeWin('subsidy.html#explain'));
    document.querySelectorAll('.explain-card .explain-dot')[18].click();
    expect($('#chart').dataset.detail).toBe('ib');
    expect($('#chart line.supply-curve')).not.toBeNull();
    expect($('#chart [data-region="dwl"]')).not.toBeNull();
  });

  it('locks Next on the drag step until the student has moved the cost dot along S1', () => {
    initSubsidyPage(document, fakeWin('subsidy.html#explain'));
    document.querySelectorAll('.explain-card .explain-dot')[2].click();
    expect($('#explain-card .explain-card__count').textContent).toBe('Step 3 of 19');
    expect(button('Put the dot in the halo').disabled).toBe(true);
    expect($('#chart .cost-dot__handle')).not.toBeNull();
    expect($('#chart .drag-hint')).not.toBeNull();
    expect($('#explain-card .explain-card__text').textContent).toContain('loaf number 75');
    // Keyboard drag: each arrow moves the dot one loaf; the handle is redrawn every time.
    const press = (n) => {
      for (let i = 0; i < n; i++) {
        $('#chart .cost-dot__handle').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      }
    };
    // The halo is drawn 42 ± 4 and the dot's body touching it counts (± 5). 27 presses from loaf 75 is
    // loaf 48: outside, so
    // Next stays locked; one more lands in it.
    expect($('#chart .dot-target')).not.toBeNull();
    press(27);
    expect($('#explain-card .explain-card__text').textContent).toContain('loaf number 48');
    expect(button('Put the dot in the halo').disabled).toBe(true);
    press(1);
    expect($('#explain-card .explain-card__text').textContent).toContain('loaf number 47');
    expect($('#explain-card .explain-card__text').textContent).toContain('$62.67');
    expect(button('Next').disabled).toBe(false);
    expect($('#chart .drag-hint')).toBeNull();
    expect($('#chart .dot-target--reached')).not.toBeNull();
    button('Next').click();
    // The government's share comes off the loaf the student left the dot on.
    expect($('#explain-card .explain-card__text').textContent).toContain('Loaf 47 still costs $62.67');
  });

  it('lights up the marks a coloured word in the card names', () => {
    initSubsidyPage(document, fakeWin('subsidy.html#explain'));
    document.querySelectorAll('.explain-card .explain-dot')[1].click();
    const term = $('#explain-card .term--pe');
    term.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect($('#chart').dataset.hot).toBe('pe');
    term.dispatchEvent(new Event('pointerout', { bubbles: true }));
    expect($('#chart').dataset.hot).toBeUndefined();
  });

  describe('keeping the step card on screen', () => {
    const setup = (cardBottom) => {
      initSubsidyPage(document, fakeWin('subsidy.html#play'));
      const chartCard = $('.chart-card');
      chartCard.scrollIntoView = vi.fn();
      $('#explain-card').getBoundingClientRect = () => ({ top: cardBottom - 200, bottom: cardBottom, left: 0, right: 0, width: 0, height: 200 });
      return chartCard;
    };

    it('scrolls the chart card to the top when a step change leaves the step card below the viewport', () => {
      const chartCard = setup(window.innerHeight + 50);
      $('.mode-switch input[value="explain"]').click();
      expect(chartCard.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
      chartCard.scrollIntoView.mockClear();
      button('Next').click();
      expect(chartCard.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('does not scroll when the step card already fits, nor on a slider tick', () => {
      const chartCard = setup(window.innerHeight - 10);
      $('.mode-switch input[value="explain"]').click();
      button('Next').click();
      expect(chartCard.scrollIntoView).not.toHaveBeenCalled();
      $('#explain-card').getBoundingClientRect = () => ({ bottom: window.innerHeight + 50 });
      button('Next').click();
      chartCard.scrollIntoView.mockClear();
      const slider = $('.explain-slider');
      slider.value = '30';
      slider.dispatchEvent(new Event('input'));
      expect(chartCard.scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it('fills the marginal CS / PS tiles from the engine, $0 with the subsidy off', () => {
    initSubsidyPage(document, fakeWin('subsidy.html'));
    expect($('#stat-incidence-consumer').textContent).toBe('$0');
    toggleOn();
    expect($('#stat-incidence-consumer').textContent).toBe('$638');
    expect($('#stat-incidence-producer').textContent).toBe('$638');
  });
});
