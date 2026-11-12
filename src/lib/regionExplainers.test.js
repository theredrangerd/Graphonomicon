import { describe, it, expect } from 'vitest';
import { REGION_INFO, attachRegionExplainers } from './regionExplainers.js';
import { computeMarket } from './marketEngine.js';
import { renderMarketChart } from './marketChart.js';
import { DEFAULT_MARKET } from './pageControls.js';
import { fmtMoney } from './format.js';

describe('REGION_INFO wording', () => {
  it('does not equate too little trade with a shortage (a tax or floor causes no shortage)', () => {
    expect(REGION_INFO.dwl.text).not.toMatch(/shortage/i);
    expect(REGION_INFO.dwl.text).toMatch(/tax/);
  });

  it('places the floor gap at the floor price and calls it excess supply', () => {
    expect(REGION_INFO.floor.text).not.toMatch(/below it/);
    expect(REGION_INFO.floor.text).toMatch(/excess supply/);
    expect(REGION_INFO.ceiling.text).not.toMatch(/below it/);
  });

  it('explains the shortage and excess-supply brackets', () => {
    expect(REGION_INFO.shortage.text).toMatch(/Qd − Qs/);
    expect(REGION_INFO['excess-supply'].text).toMatch(/not the same thing as producer surplus/);
  });
});

describe('attachRegionExplainers at every detail level', () => {
  const base = { demand: 140, supply: 20, slopeD: 1, slopeS: 1 };
  let svg;

  function setup(detail) {
    document.body.innerHTML = '';
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'market-chart');
    document.body.appendChild(svg);
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } }), { showSurplusLabels: true, detail });
    return attachRegionExplainers(svg);
  }
  const clickCs = () => svg.querySelector('[data-region="cs"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

  it.each(['clean', 'ib'])('still opens an explainer at %s', (detail) => {
    setup(detail);
    clickCs();
    expect(document.querySelector('.region-popover')).not.toBeNull();
  });

  it('opens an explainer at full and close() removes it', () => {
    const explainers = setup('full');
    clickCs();
    expect(document.querySelector('.region-popover')).not.toBeNull();
    explainers.close();
    expect(document.querySelector('.region-popover')).toBeNull();
    expect(svg.querySelector('.region-active')).toBeNull();
  });
});

describe('highlight survives a re-render', () => {
  const base = { demand: 140, supply: 20, slopeD: 1, slopeS: 1 };
  function setup() {
    document.body.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'market-chart');
    document.body.appendChild(svg);
    const draw = () => renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'subsidy', amount: 10 } }), { showSurplusLabels: true });
    draw();
    attachRegionExplainers(svg);
    return { svg, draw };
  }

  // The toggle tween redraws every frame and the redraw replaces the nodes, so a hovered or
  // tapped area would otherwise lose its highlight until the pointer next moves (the flash).
  it('keeps the hovered area lit through a redraw', () => {
    const { svg, draw } = setup();
    svg.querySelector('[data-region="ps"]').dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    draw();
    expect(svg.querySelector('[data-region="ps"]').classList.contains('region-hover')).toBe(true);
  });

  it('drops the highlight once the pointer has left, even across a redraw', () => {
    const { svg, draw } = setup();
    const ps = svg.querySelector('[data-region="ps"]');
    ps.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    ps.dispatchEvent(new MouseEvent('pointerout', { bubbles: true }));
    draw();
    expect(svg.querySelector('.region-hover')).toBeNull();
  });

  it('keeps a tapped area active, and tapping it again still closes the explainer', () => {
    const { svg, draw } = setup();
    svg.querySelector('[data-region="ps"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    draw();
    expect(svg.querySelector('[data-region="ps"]').classList.contains('region-active')).toBe(true);
    svg.querySelector('[data-region="ps"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.region-popover')).toBeNull();
  });
});

describe('explainer context notes', () => {
  const base = { demand: 140, supply: 20, slopeD: 1, slopeS: 1 };

  // Opens every clickable region in turn and returns each popover's text.
  function allPopoverText(intervention) {
    document.body.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'market-chart');
    document.body.appendChild(svg);
    renderMarketChart(svg, computeMarket({ ...base, intervention }), { showSurplusLabels: true });
    const explainers = attachRegionExplainers(svg);
    const keys = [...new Set([...svg.querySelectorAll('[data-region]')].map((n) => n.dataset.region))];
    return keys.map((key) => {
      svg.querySelector(`[data-region="${key}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const text = document.querySelector('.region-popover')?.textContent ?? '';
      explainers.close();
      return text;
    });
  }

  it.each([
    ['a binding ceiling', { type: 'ceiling', price: 50 }],
    ['the free market', { type: 'none' }],
  ])('prints prices with a single dollar sign and no raw symbols under %s', (_, intervention) => {
    const texts = allPopoverText(intervention);
    expect(texts.some((t) => /\$\d/.test(t))).toBe(true);
    for (const t of texts) {
      expect(t).not.toContain('$$');
      expect(t).not.toContain('P_e');
    }
  });
});

describe('subsidy explainers', () => {
  const base = { demand: 140, supply: 20, slopeD: 1, slopeS: 1 };

  function popoverFor(key, detail = 'full') {
    document.body.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'market-chart');
    document.body.appendChild(svg);
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } }), { showSurplusLabels: true, detail });
    attachRegionExplainers(svg);
    svg.querySelector(`[data-region="${key}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return document.querySelector('.region-popover');
  }

  it('explains the explain-mode revenue box with its value', () => {
    document.body.innerHTML = '';
    const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(chart);
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    renderMarketChart(chart, result, { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'pricesPOnly', 'revenueBox'] });
    attachRegionExplainers(chart);
    chart.querySelector('[data-region="bakery-revenue"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const pop = document.querySelector('.region-popover');
    expect(pop.textContent).toContain('Bakery Revenue');
    expect(pop.querySelector('.region-popover__stat .v').textContent).toBe(fmtMoney(result.Pp * result.Q));
  });

  it('defines marginal CS and PS regions', () => {
    for (const key of ['marginal-cs', 'marginal-ps']) {
      expect(REGION_INFO[key].title).toBeTruthy();
      expect(REGION_INFO[key].text).toBeTruthy();
    }
  });

  it('shows the marginal CS value', () => {
    const pop = popoverFor('marginal-cs', 'ib');
    expect(pop.querySelector('.region-popover__stat .v').textContent).toBe('$650');
    expect(pop.querySelector('.region-popover__pill').textContent).toBe('mCS');
  });

  it('explains government spending with the live amount, quantity and total', () => {
    const text = popoverFor('subsidy-cost').textContent;
    expect(text).toContain('$20');
    expect(text).toContain('70.0');
    expect(text).toContain('$1,400');
    expect(text).toContain('three places');
    expect(text.match(/three places/g)).toHaveLength(1);
  });

  it('keeps the static government-spending text to the definition', () => {
    expect(REGION_INFO['subsidy-cost'].text).toBe('The total the government pays: the subsidy per unit multiplied by the quantity sold.');
  });

  it('explains the IB perfect triangles as the surplus before the subsidy, valued at Pe', () => {
    document.body.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'market-chart');
    document.body.appendChild(svg);
    renderMarketChart(svg, computeMarket({ ...DEFAULT_MARKET, intervention: { type: 'subsidy', amount: 20 } }), { detail: 'ib' });
    attachRegionExplainers(svg);
    expect(svg.querySelector('[data-region="cs"]')).toBeNull();
    for (const [key, pill, title] of [['cs-original', 'old CS', 'Consumer Surplus (before the subsidy)'], ['ps-original', 'old PS', 'Producer Surplus (before the subsidy)']]) {
      svg.querySelector(`[data-region="${key}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const pop = document.querySelector('.region-popover');
      expect(pop.querySelector('h4').textContent).toBe(title);
      expect(pop.querySelector('.region-popover__pill').textContent).toBe(pill);
      expect(pop.querySelector('.region-popover__stat .v').textContent).toBe('$2,400');
      expect(pop.textContent).toContain('Pe');
    }
  });
});
