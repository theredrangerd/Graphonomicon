import { describe, it, expect, beforeEach } from 'vitest';
import { initIndirectTaxPage, TAX_AREA_LABELS } from './indirect-tax.js';

function buildDom() {
  document.body.innerHTML = `
    <div id="mini-header"></div>
    <section class="chart-card">
      <div class="chart-head"><span id="status-pill"></span></div>
      <svg id="chart" class="market-chart"></svg>
    </section>
    <div class="legend">
      ${['demand', 'supply', 'cs', 'ps', 'tax-consumer', 'tax-producer', 'revenue', 'dwl'].map((k) => `<span class="item" data-legend="${k}"></span>`).join('')}
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
    <input id="tax-toggle" type="checkbox">
    <input type="radio" name="tax-mode" id="tax-mode-specific" value="specific" checked>
    <input type="radio" name="tax-mode" id="tax-mode-advalorem" value="advalorem">
    <div class="sub-slider open" id="specific-slider-wrap">
      <input id="specific-slider" type="range" min="0" max="60" step="1" value="20">
      <span id="specific-val"></span>
    </div>
    <div class="sub-slider" id="advalorem-slider-wrap">
      <input id="advalorem-slider" type="range" min="0" max="100" step="1" value="50">
      <span id="advalorem-val"></span>
    </div>
    <span id="stat-price-consumer"></span>
    <span id="stat-price-producer"></span>
    <span id="stat-qty"></span>
    <span id="stat-cs"></span>
    <span id="stat-ps"></span>
    <span id="stat-revenue"></span>
    <span id="stat-incidence-consumer"></span>
    <span id="stat-incidence-producer"></span>
    <span id="stat-dwl"></span>
    <div id="market-note"></div>
    <iframe id="feedback-form"></iframe>
  `;
}

describe('initIndirectTaxPage', () => {
  beforeEach(() => {
    buildDom();
    initIndirectTaxPage(document);
  });

  it('renders the free-market baseline stats with the tax toggled off', () => {
    expect(document.querySelector('#stat-price-consumer').textContent).toBe('$80.00');
    expect(document.querySelector('#stat-qty').textContent).toBe('60.0');
    expect(document.querySelector('#stat-revenue').textContent).toBe('$0');
    expect(document.querySelector('#status-pill').textContent).toBe('Free market');
  });

  it('shows the specific-tax outcome once the toggle is switched on', () => {
    document.querySelector('#tax-toggle').checked = true;
    document.querySelector('#tax-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelector('#stat-price-consumer').textContent).toBe('$90.00');
    expect(document.querySelector('#stat-price-producer').textContent).toBe('$70.00');
    expect(document.querySelector('#stat-qty').textContent).toBe('52.5');
    expect(document.querySelector('#stat-revenue').textContent).toBe('$1,050');
    expect(document.querySelector('#status-pill').textContent).toBe('Tax applied');
  });

  it('switches to the ad valorem outcome when that mode is selected', () => {
    document.querySelector('#tax-toggle').checked = true;
    document.querySelector('#tax-toggle').dispatchEvent(new Event('change'));
    document.querySelector('#tax-mode-advalorem').checked = true;
    document.querySelector('#tax-mode-advalorem').dispatchEvent(new Event('change'));
    expect(document.querySelector('#stat-price-producer').textContent).toBe('$64.00');
    expect(document.querySelector('#stat-price-consumer').textContent).toBe('$96.00');
    expect(document.querySelector('#stat-qty').textContent).toBe('48.0');
    expect(document.querySelector('#stat-revenue').textContent).toBe('$1,536');
  });

  it('draws two wedge reference lines on the chart once the tax is toggled on', () => {
    document.querySelector('#tax-toggle').checked = true;
    document.querySelector('#tax-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelectorAll('#chart line.wedge-line')).toHaveLength(2);
  });

  it('toggles slider visibility based on tax mode', () => {
    expect(document.querySelector('#specific-slider-wrap').classList.contains('open')).toBe(true);
    expect(document.querySelector('#advalorem-slider-wrap').classList.contains('open')).toBe(false);

    document.querySelector('#tax-mode-advalorem').checked = true;
    document.querySelector('#tax-mode-advalorem').dispatchEvent(new Event('change'));

    expect(document.querySelector('#specific-slider-wrap').classList.contains('open')).toBe(false);
    expect(document.querySelector('#advalorem-slider-wrap').classList.contains('open')).toBe(true);
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

  it('shifts the tax burden toward producers when demand is made more elastic', () => {
    document.querySelector('#tax-toggle').checked = true;
    document.querySelector('#tax-toggle').dispatchEvent(new Event('change'));
    document.querySelector('#slope-d-slider').value = '0.5';
    document.querySelector('#slope-d-slider').dispatchEvent(new Event('input'));
    const money = (id) => +document.querySelector(id).textContent.replace(/[$,]/g, '');
    expect(money('#stat-incidence-consumer')).toBeLessThan(money('#stat-incidence-producer'));
  });

  it('describes the lost trades using the correct price bands', () => {
    document.querySelector('#tax-toggle').checked = true;
    document.querySelector('#tax-toggle').dispatchEvent(new Event('change'));
    const note = document.querySelector('#market-note').textContent;
    expect(note).toContain('$75 of surplus is lost.');
    expect(note).toContain('7.5 fewer units are traded');
    expect(note).toContain('$80–$90');
    expect(note).toContain('$70–$80');
    expect(note).toContain('$20 tax');
  });

  it('shows consumer and producer surplus stats alongside tax revenue', () => {
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
    expect([...links].some((a) => a.textContent === 'Indirect tax')).toBe(false);
    expect([...links].some((a) => a.textContent === 'Subsidy')).toBe(true);
  });

  it('reports no prices and explains why once the tax closes the market', () => {
    document.querySelector('#tax-toggle').checked = true;
    document.querySelector('#tax-toggle').dispatchEvent(new Event('change'));
    for (const [id, v] of [['#demand-slider', '-50'], ['#supply-slider', '-50'], ['#specific-slider', '60']]) {
      document.querySelector(id).value = v;
      document.querySelector(id).dispatchEvent(new Event('input'));
    }
    expect(document.querySelector('#stat-qty').textContent).toBe('0.0');
    expect(document.querySelector('#stat-price-consumer').textContent).toBe('—');
    expect(document.querySelector('#stat-price-producer').textContent).toBe('—');
    expect(document.querySelector('#market-note').textContent).toContain('No units are traded');
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
    const u = new URL(next, 'http://test.local/units/microeconomics/government-intervention/indirect-tax.html');
    Object.assign(win.location, { pathname: u.pathname, search: u.search, hash: u.hash });
  }
  setUrl(url);
  return win;
}

const $ = (sel) => document.querySelector(sel);
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text);
const dot = (i) => document.querySelectorAll('.explain-card .explain-dot')[i];
const stepCount = () => $('#explain-card .explain-card__count').textContent;
const regions = () => [...document.querySelectorAll('#chart .region--fill')].map((f) => f.dataset.region);
const toggleTax = (on = true) => { $('#tax-toggle').checked = on; $('#tax-toggle').dispatchEvent(new Event('change')); };
const qSymbols = () => [...document.querySelectorAll('#chart .axis-symbol')].map((t) => t.textContent).filter((t) => t.startsWith('Q'));

describe('initIndirectTaxPage — Explain and Play', () => {
  beforeEach(() => { buildDom(); });

  it('exports the area-label setting', () => {
    expect(TAX_AREA_LABELS).toBe('full');
  });

  it('lands a bare URL in Play on Explorer, with the focus bar, no IB perfect option and no detail gear', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html'));
    expect(document.body.dataset.mode).toBe('play');
    expect($('.detail-gear')).toBeNull();
    expect($('.view-switch')).toBeNull();
    expect($('.focus-bar').hidden).toBe(false);
    expect($('#chart').dataset.detail).toBe('ib');
    expect([...document.querySelectorAll('.focus-chip')].map((c) => c.dataset.focus)).toEqual(['revenue', 'consumer-lens', 'producer-lens', 'societal']);
  });

  it('draws the IB perfect tax diagram with the quantity axis reading Qe and Qtax', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html#play'));
    toggleTax();
    expect(regions().sort()).toEqual(['cs', 'dwl', 'ps', 'tax-consumer', 'tax-producer']);
    expect($('#chart [data-region="tax-revenue"]')).not.toBeNull();
    expect(qSymbols().sort()).toEqual(['Qe', 'Qtax']);
  });

  it('ignores a subsidy-only focus in a shared link', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html?view=explorer&focus=overlap#play'));
    expect($('.focus-chip[aria-pressed="true"]')).toBeNull();
    expect($('.focus-bar').hidden).toBe(false);
  });

  const chipTexts = () => [...document.querySelectorAll('#chart .chart-focus-chip text')].map((t) => t.textContent);
  const shownLegend = () => [...document.querySelectorAll('.legend [data-legend]')].filter((i) => !i.hidden).map((i) => i.dataset.legend);

  it('consumer lens, tax on: CS, the consumer burden and only the DWL above Pe, each with a chip', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html?view=explorer&focus=consumer-lens#play'));
    expect($('#market-note').textContent).toContain('Turn the tax on to see the consumer burden and deadweight loss');
    toggleTax();
    expect(regions().sort()).toEqual(['cs', 'dwl', 'tax-consumer']);
    expect($('#chart .burden-fill--consumer').getAttribute('fill')).toBe('var(--burden-consumer-fill)');
    expect($('#chart [data-layer="dwlConsumer"]')).not.toBeNull();
    expect($('#chart [data-layer="dwlProducer"]')).toBeNull();
    // The DWL half's chip only appears when the half is big enough to hold it.
    expect(chipTexts().map((t) => t.split(' ')[0]).slice(0, 2)).toEqual(['CS', 'CB']);
    expect(shownLegend()).toEqual(['demand', 'supply', 'cs', 'tax-consumer', 'dwl']);
  });

  it('producer lens, tax on: PS, the producer burden and only the DWL below Pe', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html?view=explorer&focus=producer-lens#play'));
    toggleTax();
    expect(regions().sort()).toEqual(['dwl', 'ps', 'tax-producer']);
    expect($('#chart [data-layer="dwlProducer"]')).not.toBeNull();
    expect($('#chart [data-layer="dwlConsumer"]')).toBeNull();
    expect(chipTexts().map((t) => t.split(' ')[0]).slice(0, 2)).toEqual(['PS', 'PB']);
    expect(shownLegend()).toEqual(['demand', 'supply', 'ps', 'tax-producer', 'dwl']);
  });

  it('societal lens, tax on: the two burdens and the whole deadweight loss, with a chip each, and no surplus left over', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html?view=explorer&focus=societal#play'));
    expect($('#market-note').textContent).toContain('Turn the tax on to see the burdens and the deadweight loss');
    toggleTax();
    expect(regions().sort()).toEqual(['dwl', 'tax-consumer', 'tax-producer']);
    expect($('#chart [data-layer="dwl"]')).not.toBeNull();
    expect($('#chart [data-layer="dwlConsumer"]')).toBeNull();
    expect($('#chart [data-layer="cs"]')).toBeNull();
    expect($('#chart [data-layer="loafDrops"]')).toBeNull(); // the arrows were only for the shift
    expect(chipTexts().map((t) => t.split(' ')[0]).slice(0, 2)).toEqual(['CB', 'PB']);
    expect(shownLegend()).toEqual(['demand', 'supply', 'tax-consumer', 'tax-producer', 'dwl']);
    expect($('#market-note').textContent).toContain('no longer traded');
  });

  it('switching to another lens with the tax on does not bring the arrows back', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html?view=explorer&focus=consumer-lens#play'));
    toggleTax();
    $('.focus-chip[data-focus="societal"]').click();
    expect($('#chart [data-layer="loafDrops"]')).toBeNull();
    expect($('.focus-chip[aria-pressed="true"]').dataset.focus).toBe('societal');
  });

  it('opens an old ?focus=cs link on the consumer lens', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html?view=explorer&focus=cs#play'));
    expect($('.focus-chip[aria-pressed="true"]').dataset.focus).toBe('consumer-lens');
  });

  it('government perspective builds the box from per-unit strips, with its revenue chip', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html?view=explorer&focus=revenue#play'));
    expect($('#market-note').textContent).toContain('Turn the tax on to see tax revenue');
    toggleTax();
    expect(regions()).toEqual(['tax-revenue']);
    expect($('#chart .gov-strip')).toBeNull(); // the strips have merged into the solid box
    expect($('#chart .gov-fill')).not.toBeNull();
    expect($('#chart .tax-arrow').textContent).toBe(''); // its name moved to the price-axis bracket
    expect($('#chart .tax-height').textContent).toBe('$20 tax');
    expect($('#chart .qty-bracket__label').textContent).toMatch(/^[\d.]+ units traded$/);
    expect($('#chart .chart-focus-chip').textContent).toBe('Revenue $1,050');
    const shown = [...document.querySelectorAll('.legend [data-legend]')].filter((i) => !i.hidden).map((i) => i.dataset.legend);
    expect(shown).toEqual(['demand', 'supply', 'revenue']);
  });

  it('government perspective names an ad valorem tax by its rate', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html?view=explorer&focus=revenue#play'));
    $('#tax-mode-advalorem').checked = true;
    $('#tax-mode-advalorem').dispatchEvent(new Event('change'));
    toggleTax();
    expect($('#chart .tax-height').textContent).toContain(`${$('#advalorem-slider').value}% tax`);
  });

  it('picking the government perspective with the tax on keeps the tax on and shows the revenue box', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html#play'));
    toggleTax();
    $('.focus-chip[data-focus="revenue"]').click();
    expect($('#tax-toggle').checked).toBe(true);
    expect($('#chart .tax-height')).not.toBeNull();
  });

  // Animations are skipped under Vitest, so every reveal step has run by now: the band is
  // drawn and its chip has followed it (in the browser the chip waits for the wipe to end).
  it('draws the lens, then its chips, when a focus is picked with the tax already on', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html#play'));
    toggleTax();
    $('.focus-chip[data-focus="producer-lens"]').click();
    expect(regions().sort()).toEqual(['dwl', 'ps', 'tax-producer']);
    expect(chipTexts()[0]).toMatch(/^PS/);
  });

  it('opens #explain on step 1 of 12, drawing only demand', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html#explain'));
    expect(document.body.dataset.mode).toBe('explain');
    expect(stepCount()).toBe('Step 1 of 12');
    expect($('#chart line.demand-curve')).not.toBeNull();
    expect($('#chart line.supply-curve')).toBeNull();
    expect($('.explain-slider').getAttribute('aria-label')).toBe('Tax per can');
  });

  it('brings the burdens in one at a time, each wiping in', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html#explain'));
    dot(5).click();
    expect(regions()).toEqual(['tax-consumer']);
    expect($('#chart [data-region="tax-consumer"] .layer-grow')).not.toBeNull();
    button('Next').click();
    expect(regions().sort()).toEqual(['tax-consumer', 'tax-producer']);
    expect($('#chart [data-region="tax-consumer"] .layer-grow')).toBeNull();
    expect($('#explain-card').textContent).toContain('$10 + $10 = the whole $20 tax');
  });

  it('the elasticity step steepens demand so consumers carry most of the tax, and the wrap-up restores it', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html#explain'));
    const demandY1 = () => +$('#chart line.demand-curve').getAttribute('y1');
    dot(9).click();
    const before = demandY1();
    button('Next').click();
    expect(stepCount()).toBe('Step 11 of 12');
    expect(demandY1()).not.toBe(before);
    expect($('#explain-card').textContent).toContain('Customers pay $15 of the $20 tax, and the company only $5');
    button('Next').click();
    expect($('#chart').dataset.detail).toBe('ib');
    expect(demandY1()).toBe(before);
  });

  it('shares one tax amount between the Explain slider and the Play specific-tax slider', () => {
    initIndirectTaxPage(document, fakeWin('indirect-tax.html#explain'));
    dot(2).click();
    const slider = $('.explain-slider');
    slider.value = '30';
    slider.dispatchEvent(new Event('input'));
    expect($('#specific-slider').value).toBe('30');
    expect($('#explain-card').textContent).toContain('$30');
  });

  it('Try it in Play → switches to Play with the specific tax animated on', () => {
    const win = fakeWin('indirect-tax.html#explain');
    initIndirectTaxPage(document, win);
    $('#tax-mode-advalorem').checked = true;
    dot(11).click();
    button('Try it in Play →').click();
    expect(document.body.dataset.mode).toBe('play');
    expect(win.location.hash).toBe('#play');
    expect($('#tax-toggle').checked).toBe(true);
    expect($('#tax-mode-specific').checked).toBe(true);
    expect($('#stat-revenue').textContent).toBe('$1,050');
  });

  it('entering Explain switches the tax off and restarts at step 1', () => {
    const win = fakeWin('indirect-tax.html#play');
    initIndirectTaxPage(document, win);
    toggleTax();
    $('.mode-link').click();
    expect(win.location.hash).toBe('#explain');
    expect($('#tax-toggle').checked).toBe(false);
    expect(stepCount()).toBe('Step 1 of 12');
    expect($('.mode-link').textContent).toBe('← Back to Play');
    $('.mode-link').click();
    expect(win.location.hash).toBe('#play');
    expect($('.mode-switch')).toBeNull();
  });
});
