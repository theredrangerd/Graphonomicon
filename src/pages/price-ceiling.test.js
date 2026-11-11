import { describe, it, expect, beforeEach } from 'vitest';
import { initPriceCeilingPage } from './price-ceiling.js';

function buildDom() {
  document.body.innerHTML = `
    <div id="mini-header"></div>
    <svg id="chart" class="market-chart"></svg>
    <div class="chart-head"><span id="status-pill"></span></div>
    <input id="demand-slider" type="range" min="-50" max="50" step="1" value="0">
    <span id="demand-val"></span>
    <input id="supply-slider" type="range" min="-50" max="50" step="1" value="0">
    <span id="supply-val"></span>
    <input id="slope-d-slider" type="range" min="-0.5" max="0.5" step="0.05" value="0">
    <span id="slope-d-val"></span>
    <input id="slope-s-slider" type="range" min="-0.5" max="0.5" step="0.05" value="0">
    <span id="slope-s-val"></span>
    <input id="ceiling-toggle" type="checkbox">
    <input id="ceiling-slider" type="range" min="0" max="180" step="1" value="50">
    <span id="ceiling-val"></span>
    <span id="stat-price"></span>
    <span id="stat-qty"></span>
    <span id="stat-cs"></span>
    <span id="stat-ps"></span>
    <span id="stat-dwl"></span>
    <div id="market-note"></div>
    <iframe id="feedback-form"></iframe>
  `;
}

describe('initPriceCeilingPage', () => {
  beforeEach(() => {
    buildDom();
    initPriceCeilingPage(document);
  });

  it('renders the free-market baseline stats with the ceiling toggled off', () => {
    expect(document.querySelector('#stat-price').textContent).toBe('$80.00');
    expect(document.querySelector('#stat-qty').textContent).toBe('60.0');
    expect(document.querySelector('#stat-dwl').textContent).toBe('$0');
  });

  it('shows the binding-ceiling stats once the toggle is switched on', () => {
    document.querySelector('#ceiling-toggle').checked = true;
    document.querySelector('#ceiling-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelector('#stat-price').textContent).toBe('$50.00');
    expect(document.querySelector('#stat-qty').textContent).toBe('37.5');
    expect(document.querySelector('#stat-dwl').textContent).toBe('$675');
    expect(document.querySelector('#status-pill').textContent).toBe('Price ceiling binding');
    expect(document.querySelector('#status-pill').classList.contains('ceiling')).toBe(true);
  });

  it('draws demand and supply curves onto the chart', () => {
    expect(document.querySelectorAll('#chart line.demand-curve')).toHaveLength(1);
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

  it('shows a non-binding note when the ceiling toggle is on but set above equilibrium', () => {
    document.querySelector('#ceiling-slider').value = '170';
    document.querySelector('#ceiling-toggle').checked = true;
    document.querySelector('#ceiling-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelector('#market-note').innerHTML).toContain('Not binding');
  });

  it('renders a mini-header back link to the Government Intervention family page', () => {
    const back = document.querySelector('#mini-header a.mini-header__back');
    expect(back).not.toBeNull();
    expect(back.getAttribute('href')).toBe('/units/microeconomics/government-intervention.html');
  });

  it('renders sibling diagram links (excluding itself) in the mini-header', () => {
    const links = document.querySelectorAll('#mini-header .mini-header__siblings a');
    expect(links.length).toBeGreaterThan(0);
    expect([...links].some((a) => a.textContent === 'Price ceiling')).toBe(false);
    expect([...links].some((a) => a.textContent === 'Price floor')).toBe(true);
  });

  it('draws IB area names (no chips), adding the welfare loss once the ceiling is imposed', () => {
    const names = () => [...document.querySelectorAll('#chart .area-name')].map((n) => n.textContent);
    expect(document.querySelector('#chart .region-badge')).toBeNull();
    expect(names()).not.toContain('welfare loss');

    document.querySelector('#ceiling-toggle').checked = true;
    document.querySelector('#ceiling-toggle').dispatchEvent(new Event('change'));

    expect(document.querySelector('#chart .region-badge')).toBeNull();
    expect(names()).toContain('welfare loss');
  });

  it('opens an explainer popover with live values and context when a shaded area is clicked', () => {
    document.querySelector('#ceiling-toggle').checked = true;
    document.querySelector('#ceiling-toggle').dispatchEvent(new Event('change'));

    document.querySelector('#chart [data-region="dwl"]').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }));

    const popover = document.querySelector('.region-popover');
    expect(popover).not.toBeNull();
    expect(popover.querySelector('h4').textContent).toBe('Deadweight Loss');
    expect(popover.querySelector('.region-popover__stat .v').textContent).toBe('$675');
    expect(popover.querySelector('.region-popover__callout').textContent).toContain('Restricting output');
  });

  describe('Explorer', () => {
    const pickFocus = (id) => document.querySelector(`.focus-chip[data-focus="${id}"]`).click();

    it('offers the four ceiling foci, hidden until Explorer is picked', () => {
      const chips = [...document.querySelectorAll('.focus-chip')].map((c) => c.dataset.focus);
      expect(chips).toEqual(['cs', 'ps', 'gap', 'dwl']);
      expect(document.querySelector('.focus-bar').hidden).toBe(true);
    });

    it('focusing the shortage draws the control line and bracket, but no shaded area', () => {
      document.querySelector('#ceiling-toggle').checked = true;
      document.querySelector('#ceiling-toggle').dispatchEvent(new Event('change'));
      pickFocus('gap');
      const chart = document.querySelector('#chart');
      expect(chart.dataset.focus).toBe('gap');
      expect(chart.querySelector('[data-region="shortage"]')).not.toBeNull();
      expect(chart.querySelector('.cs-fill')).toBeNull();
      expect(history.state ?? location.search).toContain('focus=gap');
    });

    it('says to turn the ceiling on when a ceiling-only focus is picked with it off', () => {
      pickFocus('dwl');
      expect(document.querySelector('#market-note').textContent).toBe('Turn the ceiling on to see the deadweight loss.');
    });
  });
});
