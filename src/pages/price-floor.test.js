import { describe, it, expect, beforeEach } from 'vitest';
import { initPriceFloorPage } from './price-floor.js';

function buildDom() {
  document.body.innerHTML = `
    <div id="mini-header"></div>
    <svg id="chart" class="market-chart"></svg>
    <div class="chart-head"></div>
    <input id="demand-slider" type="range" min="-50" max="50" step="1" value="0">
    <span id="demand-val"></span>
    <input id="supply-slider" type="range" min="-50" max="50" step="1" value="0">
    <span id="supply-val"></span>
    <input id="slope-d-slider" type="range" min="-0.5" max="0.5" step="0.05" value="0">
    <span id="slope-d-val"></span>
    <input id="slope-s-slider" type="range" min="-0.5" max="0.5" step="0.05" value="0">
    <span id="slope-s-val"></span>
    <input id="floor-toggle" type="checkbox">
    <input id="floor-slider" type="range" min="0" max="180" step="1" value="110">
    <span id="floor-val"></span>
    <span id="stat-price"></span>
    <span id="stat-qty"></span>
    <span id="stat-cs"></span>
    <span id="stat-ps"></span>
    <span id="stat-dwl"></span>
    <div id="market-note"></div>
    <iframe id="feedback-form"></iframe>
  `;
}

describe('initPriceFloorPage', () => {
  beforeEach(() => {
    buildDom();
    initPriceFloorPage(document);
  });

  it('renders the free-market baseline stats with the floor toggled off', () => {
    expect(document.querySelector('#stat-price').textContent).toBe('$80.00');
    expect(document.querySelector('#stat-dwl').textContent).toBe('$0');
  });

  it('shows the binding-floor stats once the toggle is switched on', () => {
    document.querySelector('#floor-toggle').checked = true;
    document.querySelector('#floor-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelector('#stat-price').textContent).toBe('$110.00');
    expect(document.querySelector('#stat-qty').textContent).toBe('37.5');
    expect(document.querySelector('#stat-dwl').textContent).toBe('$675');
    expect(document.querySelector('#market-note').innerHTML).toContain('excess supply');
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

  it('shows a non-binding note when the floor toggle is on but set below equilibrium', () => {
    document.querySelector('#floor-slider').value = '20';
    document.querySelector('#floor-toggle').checked = true;
    document.querySelector('#floor-toggle').dispatchEvent(new Event('change'));
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
    expect([...links].some((a) => a.textContent === 'Price floor')).toBe(false);
    expect([...links].some((a) => a.textContent === 'Price ceiling')).toBe(true);
  });
});
