import { describe, it, expect, beforeEach } from 'vitest';
import { computeMarket } from './marketEngine.js';
import { renderMarketChart, resolveLayers } from './marketChart.js';

function makeSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'market-chart');
  return svg;
}

const base = { demand: 140, supply: 20, slopeD: 1, slopeS: 1 };

describe('renderMarketChart', () => {
  let svg;
  beforeEach(() => { svg = makeSvg(); });

  it('draws the demand and supply curve lines for a free market', () => {
    const result = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, result);
    expect(svg.querySelectorAll('line.demand-curve')).toHaveLength(1);
    expect(svg.querySelectorAll('line.supply-curve')).toHaveLength(1);
  });

  describe('equilibrium labels (e1 / e2)', () => {
    const eqLabels = () => [...svg.querySelectorAll('.eq-label')].map((t) => t.dataset.eq);

    it('labels only e1 on a free market', () => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'none' } }));
      expect(eqLabels()).toEqual(['1']);
      expect(svg.querySelector('.eq-label').textContent).toBe('e1');
    });

    it('labels only e1 under a price ceiling or floor (no new equilibrium)', () => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } }));
      expect(eqLabels()).toEqual(['1']);
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'floor', price: 110 } }));
      expect(eqLabels()).toEqual(['1']);
    });

    it('adds e2 when a tax or subsidy moves the equilibrium', () => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } }));
      expect(eqLabels()).toEqual(['1', '2']);
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'subsidy', amount: 15 } }));
      expect(eqLabels()).toEqual(['1', '2']);
    });

    it('drops e2 at a zero tax, where it would sit on e1', () => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 0 } }));
      expect(eqLabels()).toEqual(['1']);
    });

    it('keeps e1 at a fixed offset from its point while demand shifts (no jitter)', () => {
      const offset = (demand) => {
        renderMarketChart(svg, computeMarket({ ...base, demand, intervention: { type: 'none' } }));
        const dot = [...svg.querySelectorAll('circle')].find((c) => c.getAttribute('fill') === 'var(--ink)');
        const lbl = svg.querySelector('.eq-label');
        return [+lbl.getAttribute('x') - +dot.getAttribute('cx'), +lbl.getAttribute('y') - +dot.getAttribute('cy')].map((v) => v.toFixed(1));
      };
      const first = offset(120);
      for (let demand = 121; demand <= 160; demand++) expect(offset(demand)).toEqual(first);
    });

    it('keeps the labels at the IB perfect detail level', () => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } }), { detail: 'ib' });
      expect(eqLabels()).toEqual(['1', '2']);
    });
  });

  it('draws a CS and PS fill polygon when trade occurs', () => {
    const result = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, result);
    expect(svg.querySelector('polygon.cs-fill')).not.toBeNull();
    expect(svg.querySelector('polygon.ps-fill')).not.toBeNull();
  });

  it('draws a DWL fill and outline when a ceiling binds', () => {
    const result = computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } });
    renderMarketChart(svg, result);
    expect(svg.querySelector('polygon.dwl-fill')).not.toBeNull();
    expect(svg.querySelector('polygon.dwl-outline')).not.toBeNull();
  });

  it('omits the DWL fill in a free market', () => {
    const result = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, result);
    expect(svg.querySelector('polygon.dwl-fill')).toBeNull();
  });

  it('draws two wedge reference lines and consumer/producer incidence fills for a tax', () => {
    const result = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    renderMarketChart(svg, result);
    expect(svg.querySelectorAll('line.wedge-line')).toHaveLength(2);
    expect(svg.querySelector('polygon.burden-fill--consumer')).not.toBeNull();
    expect(svg.querySelector('polygon.burden-fill--producer')).not.toBeNull();
    expect(svg.querySelector('polygon.wedge-outline')).not.toBeNull();
  });

  it('draws no price line past e2 for a subsidy: the box edge is the Pc line, as on an IB diagram', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    renderMarketChart(svg, result);
    expect(svg.querySelector('[data-layer="wedgeBox"]')).not.toBeNull();
    expect(svg.querySelectorAll('line.wedge-line')).toHaveLength(0);
  });

  it('runs both price lines from the axis to Q when the subsidy box is not drawn', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    renderMarketChart(svg, result, { focus: 'ps' });
    const lines = [...svg.querySelectorAll('line.wedge-line')];
    expect(lines.map((l) => l.getAttribute('stroke'))).toEqual(['var(--demand)', 'var(--supply)']);
    const x2s = lines.map((l) => +l.getAttribute('x2'));
    expect(x2s[0]).toBe(x2s[1]);
    lines.forEach((l) => expect(+l.getAttribute('x1')).toBeLessThan(+l.getAttribute('x2')));
  });

  it('draws a single reference line for a binding price floor', () => {
    const result = computeMarket({ ...base, intervention: { type: 'floor', price: 110 } });
    renderMarketChart(svg, result);
    expect(svg.querySelectorAll('line.wedge-line')).toHaveLength(1);
    expect(svg.querySelector('polygon.wedge-fill--consumer')).toBeNull();
  });

  it('clears previously drawn content on re-render, so dragging a slider does not accumulate elements', () => {
    const result = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, result);
    renderMarketChart(svg, result);
    expect(svg.querySelectorAll('line.demand-curve')).toHaveLength(1);
  });

  it('reuses the static grid/axes on re-render instead of rebuilding them', () => {
    const result = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, result);
    const gridLine = svg.querySelector('.tick-label');
    renderMarketChart(svg, result);
    expect(svg.querySelector('.tick-label')).toBe(gridLine);
  });

  it('fills the tax burdens in their own burden colours, never a surplus colour, and outlines the total wedge in gov color', () => {
    const result = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    renderMarketChart(svg, result);
    const consumerFill = svg.querySelector('polygon.burden-fill--consumer').getAttribute('fill');
    const producerFill = svg.querySelector('polygon.burden-fill--producer').getAttribute('fill');
    expect(consumerFill).toBe('var(--burden-consumer-fill)');
    expect(producerFill).toBe('var(--burden-producer-fill)');
    [consumerFill, producerFill].forEach((f) => expect(f).not.toMatch(/--(demand|supply)/));
    expect(svg.querySelector('polygon.wedge-outline').getAttribute('stroke')).toBe('var(--gov)');
  });

  it('splits the tax wedge at the pre-tax equilibrium price so the incidence fills track relative elasticity', () => {
    const result = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    renderMarketChart(svg, result);
    const consumerPoly = svg.querySelector('polygon.burden-fill--consumer').getAttribute('points');
    const producerPoly = svg.querySelector('polygon.burden-fill--producer').getAttribute('points');
    expect(consumerPoly).not.toBe(producerPoly);
  });

  it('draws a faint non-binding reference line when a ceiling is toggled on but set above equilibrium', () => {
    const result = computeMarket({ ...base, intervention: { type: 'ceiling', price: 100 } });
    renderMarketChart(svg, result);
    expect(svg.querySelectorAll('line.wedge-line')).toHaveLength(1);
  });

  it('draws a shifted after-tax supply curve, fading the original supply curve as a reference', () => {
    const result = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    renderMarketChart(svg, result);
    expect(svg.querySelectorAll('line.supply-curve-shifted')).toHaveLength(1);
    const original = svg.querySelector('line.supply-curve');
    expect(original.getAttribute('stroke-dasharray')).toBe('6,4');
  });

  it('draws a shifted after-subsidy supply curve below the original', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 15 } });
    renderMarketChart(svg, result);
    const shifted = svg.querySelector('line.supply-curve-shifted');
    expect(shifted).not.toBeNull();
    const y1Shifted = +shifted.getAttribute('y1');
    const y1Original = +svg.querySelector('line.supply-curve').getAttribute('y1');
    // a lower price at the same quantity draws further down the SVG (larger y)
    expect(y1Shifted).toBeGreaterThan(y1Original);
  });

  it('omits the shifted supply curve for a free market or a price control, which do not shift supply', () => {
    const free = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, free);
    expect(svg.querySelector('line.supply-curve-shifted')).toBeNull();

    const ceiling = computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } });
    renderMarketChart(svg, ceiling);
    expect(svg.querySelector('line.supply-curve-shifted')).toBeNull();
  });

  const symbols = (svg) => [...svg.querySelectorAll('text.axis-symbol')].map((t) => t.textContent);

  it('labels the equilibrium Pe/Qe on the axes and hides the numeric tick underneath', () => {
    renderMarketChart(svg, computeMarket(base));
    expect(symbols(svg).sort()).toEqual(['Pe', 'Qe']);
    const tick80 = [...svg.querySelectorAll('.tick-label[data-axis="y"]')].find((t) => t.textContent === '80');
    expect(tick80.getAttribute('visibility')).toBe('hidden');
    const tick100 = [...svg.querySelectorAll('.tick-label[data-axis="y"]')].find((t) => t.textContent === '100');
    expect(tick100.getAttribute('visibility')).toBe('visible');
  });

  it('marks both Qs and Qd plus a labelled shortage bracket under a binding ceiling', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } }));
    expect(svg.querySelectorAll('circle.control-point')).toHaveLength(2);
    expect(symbols(svg).sort()).toEqual(['Pe', 'Pmax', 'Qd', 'Qe', 'Qs']);
    const bracket = svg.querySelector('[data-region="shortage"]');
    expect(bracket).not.toBeNull();
    expect(bracket.querySelector('.bracket-label').textContent).toBe('Shortage');
  });

  it('labels the gap under a binding floor as excess supply, not "surplus"', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'floor', price: 110 } }));
    expect(symbols(svg)).toContain('Pmin');
    expect(svg.querySelector('[data-region="excess-supply"] .bracket-label').textContent).toBe('Excess supply');
  });

  it('clips the shortage bracket with an arrow when Qd lies past the chart edge, and omits the Qd symbol', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 30 } }));
    expect(svg.querySelector('[data-region="shortage"] polyline')).not.toBeNull();
    expect(symbols(svg)).not.toContain('Qd');
    expect(svg.querySelectorAll('circle.control-point')).toHaveLength(1);
  });

  it('names the tax prices Pc/Pp on the axis and the burdens as CB/PB chips, not on the lines', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 40 } }), { showSurplusLabels: true });
    expect(symbols(svg).sort()).toEqual(['Pc', 'Pe', 'Pp', 'Qe', 'Qtax']);
    expect(svg.querySelector('.region-badge--tax-consumer .region-badge__text').textContent).toBe('CB');
    expect(svg.querySelector('.region-badge--tax-producer .region-badge__text').textContent).toBe('PB');
    expect(svg.querySelector('.band-label')).toBeNull();
    expect(svg.textContent).not.toMatch(/Burden|Incidence/);
  });

  it('shows the CS/PS overlap on a subsidy as its own shade, with no chips and no opaque backing', () => {
    const r = computeMarket({ ...base, intervention: { type: 'subsidy', mode: 'specific', amount: 40 } });
    renderMarketChart(svg, r, { showSurplusLabels: true });
    const halves = [...svg.querySelectorAll('polygon.overlap-fill')].map((n) => n.getAttribute('fill'));
    expect(halves).toEqual(['url(#overlapStripesAbove)', 'url(#overlapStripesBelow)']);
    expect(svg.querySelector('polygon.wedge-backing')).toBeNull();
    const ys = r.overlapPoly.map(([, p]) => p);
    expect(Math.min(...ys)).toBeCloseTo(r.Pc);
    expect(Math.max(...ys)).toBeCloseTo(r.Pp);
  });

  it('names the subsidy areas with chips and dimensions the per-unit subsidy at Q1', () => {
    const r = computeMarket({ ...base, intervention: { type: 'subsidy', mode: 'specific', amount: 40 } });
    renderMarketChart(svg, r, { showSurplusLabels: true });
    const names = [...svg.querySelectorAll('.region-badge:not(.region-badge--plain) .region-badge__text')].map((n) => n.textContent);
    expect(names).toEqual(expect.arrayContaining(['CS', 'PS', 'Gov']));
    expect(svg.querySelector('.area-label')).toBeNull();
    expect(svg.querySelector('.region-badge--subsidy-amount .region-badge__text').textContent).toBe('$40');
    const bracketX = +svg.querySelector('.subsidy-bracket line').getAttribute('x1');
    expect(bracketX).toBeGreaterThan(+svg.querySelector('line.demand-curve').getAttribute('x1'));
  });

  it('draws no subsidy bracket for a tax or the free market', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 40 } }));
    expect(svg.querySelector('.subsidy-bracket')).toBeNull();
  });

  it('skips a wedge chip when the band is too thin to hold it', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 2 } }), { showSurplusLabels: true });
    expect(svg.querySelector('.region-badge--tax-consumer')).toBeNull();
  });

  it('keeps a ceiling/floor name inside the plot when its line sits on the bottom edge', () => {
    const r = computeMarket({ ...base, intervention: { type: 'ceiling', price: 0 } });
    renderMarketChart(svg, r);
    const lineY = +svg.querySelector('line.wedge-line').getAttribute('y1');
    // Below the line would be the tick-label row, so the name flips above it.
    expect(+svg.querySelector('text.line-label').getAttribute('y')).toBeLessThan(lineY);
  });

  it('keeps the S1/S2 names apart when both supply lines end together', () => {
    const r = computeMarket({ demand: 80, supply: 20, slopeD: 0.5, slopeS: 0.2, intervention: { type: 'subsidy', amount: 20 } });
    renderMarketChart(svg, r);
    const [s1, s2] = ['S1', 'S2'].map((t) => [...svg.querySelectorAll('text')].find((n) => n.textContent.replace(/\s/g, '') === t));
    expect(Math.abs(+s1.getAttribute('y') - +s2.getAttribute('y'))).toBeGreaterThan(14);
  });

  it('never lets two chips overlap', () => {
    for (const intervention of [{ type: 'tax', mode: 'specific', amount: 40 }, { type: 'subsidy', mode: 'specific', amount: 40 }, { type: 'ceiling', price: 20 }, { type: 'floor', price: 100 }]) {
      renderMarketChart(svg, computeMarket({ ...base, intervention }), { showSurplusLabels: true });
      const boxes = [...svg.querySelectorAll('.region-badge')].map((g) => {
        const [, x, y] = g.getAttribute('transform').match(/translate\(([-\d.]+), ([-\d.]+)\)/).map(Number);
        const pill = g.querySelector('.region-badge__pill');
        return { x0: x - pill.getAttribute('width') / 2, x1: x + +pill.getAttribute('width') / 2, y0: y - pill.getAttribute('height') / 2, y1: y + +pill.getAttribute('height') / 2 };
      });
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
        expect(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0).toBe(false);
      }));
    }
  });

  const symbolEl = (svg, name) => [...svg.querySelectorAll('text.axis-symbol')].find((t) => t.textContent === name);
  const fontSize = (svg, name) => +symbolEl(svg, name).getAttribute('font-size');

  const labelBox = (svg, name) => {
    const y = +symbolEl(svg, name).getAttribute('y');
    return { top: y - 0.7 * 16, bottom: y + 0.3 * 16 };
  };

  it('keeps Pc/Pp/Pe full size and clear of each other for a small tax, with leaders to the true lines', () => {
    for (const amount of [1, 2, 6]) {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount } }));
      for (const n of ['Pe', 'Pc', 'Pp']) expect(fontSize(svg, n)).toBe(16);
      const boxes = ['Pe', 'Pc', 'Pp'].map((n) => labelBox(svg, n)).sort((a, b) => a.top - b.top);
      expect(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);
      expect(boxes[2].top).toBeGreaterThanOrEqual(boxes[1].bottom);
      expect(svg.querySelectorAll('line.axis-leader').length).toBe(2);
    }
  });

  it('draws no leaders once the wedge is wide enough that labels sit on their own lines', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 40 } }));
    expect(fontSize(svg, 'Pc')).toBe(16);
    expect(fontSize(svg, 'Pp')).toBe(16);
    expect(svg.querySelectorAll('line.axis-leader')).toHaveLength(0);
  });

  it('drops Pc/Pp/Q1 entirely at a zero tax or subsidy, leaving only Pe/Qe', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 0 } }));
    expect(symbols(svg).sort()).toEqual(['Pe', 'Qe']);
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'subsidy', amount: 0 } }));
    expect(symbols(svg).sort()).toEqual(['Pe', 'Qe']);
  });

  it('draws Pe/Qe after the intervention symbols so they stay on top', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 6 } }));
    const names = [...svg.querySelectorAll('text.axis-symbol')].map((t) => t.textContent);
    expect(names.indexOf('Pe')).toBeGreaterThan(names.indexOf('Pc'));
    expect(names.indexOf('Pe')).toBeGreaterThan(names.indexOf('Pp'));
  });

  it('draws no price lines or Pc/Pp symbols once a tax has closed the market', () => {
    const r = computeMarket({ demand: 100, supply: 60, slopeD: 1, slopeS: 1, intervention: { type: 'tax', mode: 'specific', amount: 60 } });
    expect(r.closed).toBe(true);
    renderMarketChart(svg, r);
    expect(svg.querySelectorAll('line.wedge-line')).toHaveLength(0);
    expect(symbols(svg).sort()).toEqual(['Pe', 'Qe']);
  });

  it('sizes the viewBox to the rendered width so chart text renders at its true pixel size', () => {
    Object.defineProperty(svg, 'clientWidth', { value: 360, configurable: true });
    renderMarketChart(svg, computeMarket(base));
    const [, , w, h] = svg.getAttribute('viewBox').split(' ').map(Number);
    expect(w).toBe(360);
    // narrow charts get a taller frame than 3:2 so the plot keeps usable height
    expect(h / w).toBeGreaterThan(2 / 3);
  });

  it('rebuilds the grid when the chart width changes', () => {
    renderMarketChart(svg, computeMarket(base));
    const before = svg.querySelector('.tick-label');
    Object.defineProperty(svg, 'clientWidth', { value: 400, configurable: true });
    renderMarketChart(svg, computeMarket(base));
    expect(svg.querySelector('.tick-label')).not.toBe(before);
    expect(svg.getAttribute('viewBox').startsWith('0 0 400 ')).toBe(true);
  });

  it('colours the ceiling/floor name label itself, not with the grey tick-label style', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } }));
    const lbl = svg.querySelector('[data-region="ceiling"] .line-label');
    expect(lbl.textContent).toBe('Price ceiling');
    expect(lbl.classList.contains('tick-label')).toBe(false);
  });

  it('fades the customer/government figures and Pc, but keeps the brackets and bakery total, when leaving the two-prices step', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', mode: 'specific', amount: 40 } });
    const layers = ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'prices', 'priceBrackets', 'subsidyArrow'];
    const captions = { customer: 'customer pays', gov: '+ gov', total: 'bakery gets' };
    renderMarketChart(svg, result, { detail: 'clean', layers, captions, exit: ['priceBrackets', 'pricesC'] });
    expect(svg.querySelector('.pb-total-label').classList.contains('pb-total-label--grow')).toBe(true);
    expect(svg.querySelector('.pb-customer').classList.contains('layer-exit')).toBe(false);
    expect(svg.querySelector('.pb-gov').classList.contains('layer-exit')).toBe(false);
    expect(svg.querySelector('.pb-customer-label').classList.contains('layer-exit')).toBe(true);
    expect(svg.querySelector('.pb-gov-label').classList.contains('layer-exit')).toBe(true);
    expect(svg.querySelector('.pb-total-label').classList.contains('layer-exit')).toBe(false);
    expect(svg.querySelector('.wedge-line[data-layer="pricesC"]').classList.contains('layer-exit')).toBe(true);
    expect(svg.querySelector('.price-line--producer').classList.contains('layer-exit')).toBe(false);
  });

  it('draws the bakery total at its swollen size when captions.totalBig is set', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', mode: 'specific', amount: 40 } });
    renderMarketChart(svg, result, { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'pricesPOnly', 'priceBrackets'], captions: { total: 'bakery gets $90', totalBig: true } });
    expect(svg.querySelector('.pb-total-label').classList.contains('pb-total-label--big')).toBe(true);
  });

  it('marks where Pp meets S1 with a dot, only when asked and only while the Pp line is drawn', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    renderMarketChart(svg, result, { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq2', 'pricesPOnly'], ppDot: true });
    expect(svg.querySelectorAll('.pp-dot')).toHaveLength(1);
    renderMarketChart(svg, result, { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq2', 'pricesPOnly'] });
    expect(svg.querySelectorAll('.pp-dot')).toHaveLength(0);
    renderMarketChart(svg, result, { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq2', 'pricesCOnly'], ppDot: true });
    expect(svg.querySelectorAll('.pp-dot')).toHaveLength(0);
  });

  it('draws only the Pp line and symbol for pricesPOnly', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', mode: 'specific', amount: 40 } });
    renderMarketChart(svg, result, { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'pricesPOnly'] });
    expect(svg.querySelector('.price-line--producer')).not.toBeNull();
    expect(svg.querySelector('.wedge-line[data-layer="pricesC"]')).toBeNull();
    const syms = [...svg.querySelectorAll('.axis-symbol')].map((n) => n.textContent);
    expect(syms.some((t) => t.startsWith('Pp'))).toBe(true);
    expect(syms.some((t) => t.startsWith('Pc'))).toBe(false);
  });

  it('drops the amount chip beside the subsidy arrow when arrowChip is false', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', mode: 'specific', amount: 40 } });
    renderMarketChart(svg, result, { focus: 'ps' });
    expect(svg.querySelector('.subsidy-arrow')).not.toBeNull();
    expect(svg.querySelector('.region-badge--subsidy-amount')).not.toBeNull();
    renderMarketChart(svg, result, { focus: 'ps', arrowChip: false });
    expect(svg.querySelector('.subsidy-arrow')).not.toBeNull();
    expect(svg.querySelector('.region-badge--subsidy-amount')).toBeNull();
  });

  it('hangs the gap bracket under the x-axis, spanning Qs to Qd, with its label beneath', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } }));
    const axisY = +svg.querySelector('#plotClip rect').getAttribute('y') + +svg.querySelector('#plotClip rect').getAttribute('height');
    const bracket = svg.querySelector('[data-region="shortage"] .gap-bracket');
    const y = +bracket.getAttribute('y1');
    expect(y).toBeGreaterThan(axisY);
    expect(+svg.querySelector('[data-region="shortage"] .bracket-label').getAttribute('y')).toBeGreaterThan(y);
    // Qs (37.5) to Qd (75) on the 0-100 axis: the bracket is as wide as the gap between the dots.
    const xs = [...svg.querySelectorAll('circle.control-point')].map((c) => +c.getAttribute('cx')).sort((a, b) => a - b);
    expect(+bracket.getAttribute('x1')).toBeCloseTo(xs[0]);
    expect(+bracket.getAttribute('x2')).toBeCloseTo(xs[1]);
  });

  it('keeps the floor bracket under the axis even for a floor near the top of the chart', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'floor', price: 175 } }));
    const bracket = svg.querySelector('[data-region="excess-supply"] .gap-bracket');
    if (!bracket) return; // market may close entirely at this floor
    const axisY = +svg.querySelector('#plotClip rect').getAttribute('y') + +svg.querySelector('#plotClip rect').getAttribute('height');
    expect(+bracket.getAttribute('y1')).toBeGreaterThan(axisY);
  });

  it('draws only the control line and bracket for the gap focus', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } }), { focus: 'gap' });
    expect(svg.querySelector('[data-region="shortage"]')).not.toBeNull();
    expect(svg.querySelector('[data-region="ceiling"]')).not.toBeNull();
    expect(svg.querySelector('.cs-fill, .ps-fill, .dwl-fill')).toBeNull();
  });

  it('keeps curve names inside the plot when a curve leaves through the top edge', () => {
    renderMarketChart(svg, computeMarket({ demand: 330, supply: -170, slopeD: 4.2, slopeS: 4.2 }));
    const y = +svg.querySelector('text.curve-label').getAttribute('y');
    expect(y).toBeGreaterThanOrEqual(18 + 14);
  });

  it('clips shaded regions to the plot area instead of squashing off-chart corners', () => {
    // Demand intercept far above PMAX: the CS tip must keep its true (off-chart) position
    renderMarketChart(svg, computeMarket({ demand: 330, supply: -170, slopeD: 4.2, slopeS: 4.2 }));
    const fills = svg.querySelector('g.fills');
    expect(fills.getAttribute('clip-path')).toBe('url(#plotClip)');
    expect(fills.querySelector('polygon.cs-fill')).not.toBeNull();
    const tipY = Math.min(...svg.querySelector('polygon.cs-fill').getAttribute('points').split(' ').map((pt) => +pt.split(',')[1]));
    expect(tipY).toBeLessThan(0);
    expect(svg.querySelector('clipPath#plotClip')).not.toBeNull();
  });

  it('renders CS and PS badges when showSurplusLabels option is enabled in free market', () => {
    renderMarketChart(svg, computeMarket(base), { showSurplusLabels: true });
    const csBadge = svg.querySelector('.region-badge--cs');
    const psBadge = svg.querySelector('.region-badge--ps');
    const dwlBadge = svg.querySelector('.region-badge--dwl');
    expect(csBadge).not.toBeNull();
    expect(csBadge.querySelector('.region-badge__text').textContent).toBe('CS');
    expect(psBadge).not.toBeNull();
    expect(psBadge.querySelector('.region-badge__text').textContent).toBe('PS');
    expect(dwlBadge).toBeNull();
  });

  it('renders CS, PS, and DWL badges when showSurplusLabels is enabled under a binding ceiling', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } }), { showSurplusLabels: true });
    const csBadge = svg.querySelector('.region-badge--cs');
    const psBadge = svg.querySelector('.region-badge--ps');
    const dwlBadge = svg.querySelector('.region-badge--dwl');
    expect(csBadge).not.toBeNull();
    expect(psBadge).not.toBeNull();
    expect(dwlBadge).not.toBeNull();
    expect(dwlBadge.querySelector('.region-badge__text').textContent).toBe('DWL');
  });

  it('shrinks badges to fit squeezed regions instead of overflowing them', () => {
    const width = (opts) => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: opts } }), { showSurplusLabels: true });
      const pill = svg.querySelector('.region-badge--ps .region-badge__pill');
      return pill ? +pill.getAttribute('width') : 0;
    };
    const roomy = width(50);
    const squeezed = width(8);
    expect(roomy).toBeGreaterThan(0);
    expect(squeezed).toBeLessThan(roomy);
  });

  it('omits surplus badges by default when showSurplusLabels is false', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } }));
    expect(svg.querySelector('.region-badge--cs')).toBeNull();
    expect(svg.querySelector('.region-badge--ps')).toBeNull();
    expect(svg.querySelector('.region-badge--dwl')).toBeNull();
  });

  describe('detail levels', () => {
    const ceiling = () => computeMarket({ ...base, intervention: { type: 'ceiling', price: 50 } });
    const tax = () => computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 30 } });
    const subsidy = () => computeMarket({ ...base, intervention: { type: 'subsidy', mode: 'specific', amount: 40 } });
    const areaNames = () => [...svg.querySelectorAll('.area-name')].map((n) => n.textContent);
    const ticks = () => [...svg.querySelectorAll('.tick-label')];

    it('full keeps the chips and draws no plain area names', () => {
      renderMarketChart(svg, ceiling(), { showSurplusLabels: true, detail: 'full' });
      expect(svg.querySelectorAll('.region-badge').length).toBeGreaterThan(0);
      expect(svg.querySelector('.area-name')).toBeNull();
      expect(svg.dataset.detail).toBe('full');
    });

    it('defaults to full when no detail option is given', () => {
      renderMarketChart(svg, ceiling(), { showSurplusLabels: true });
      expect(svg.dataset.detail).toBe('full');
      expect(svg.querySelectorAll('.region-badge').length).toBeGreaterThan(0);
    });

    it('clean drops the region chips but keeps tick numbers', () => {
      renderMarketChart(svg, ceiling(), { showSurplusLabels: true, detail: 'clean' });
      expect(svg.querySelector('.region-badge--cs')).toBeNull();
      expect(svg.querySelector('.region-badge--ps')).toBeNull();
      expect(svg.querySelector('.region-badge--dwl')).toBeNull();
      expect(svg.querySelector('.area-name')).toBeNull();
      expect(ticks().some((t) => t.getAttribute('visibility') !== 'hidden')).toBe(true);
    });

    it('ib names CS, PS and the welfare loss in plain text and hides every tick number', () => {
      renderMarketChart(svg, ceiling(), { showSurplusLabels: true, detail: 'ib' });
      expect(svg.querySelector('.region-badge')).toBeNull();
      const names = areaNames();
      expect(names).toEqual(expect.arrayContaining(['CS', 'PS']));
      expect(names.some((n) => n === 'welfare loss' || n === 'WL')).toBe(true);
      expect(ticks().length).toBeGreaterThan(0);
      expect(ticks().every((t) => t.getAttribute('visibility') === 'hidden')).toBe(true);
    });

    it('ib names the consumer and producer burden on a tax', () => {
      renderMarketChart(svg, tax(), { showSurplusLabels: true, detail: 'ib' });
      const names = areaNames();
      expect(names.some((n) => n === 'consumer burden' || n === 'CB')).toBe(true);
      expect(names.some((n) => n === 'producer burden' || n === 'PB')).toBe(true);
    });

    it('ib names government spending on a subsidy and drops the per-unit amount chip and its bracket', () => {
      renderMarketChart(svg, subsidy(), { showSurplusLabels: true, detail: 'ib' });
      expect(svg.querySelector('.subsidy-bracket')).toBeNull();
      expect(svg.querySelector('.region-badge--subsidy-amount')).toBeNull();
      expect(areaNames().some((n) => n === 'government spending' || n === 'Gov')).toBe(true);
    });

    it('clean drops the subsidy per-unit amount chip and its bracket; full keeps both', () => {
      renderMarketChart(svg, subsidy(), { showSurplusLabels: true, detail: 'clean' });
      expect(svg.querySelector('.subsidy-bracket')).toBeNull();
      expect(svg.querySelector('.region-badge--subsidy-amount')).toBeNull();
      renderMarketChart(svg, subsidy(), { showSurplusLabels: true, detail: 'full' });
      expect(svg.querySelector('.subsidy-bracket')).not.toBeNull();
      expect(svg.querySelector('.region-badge--subsidy-amount')).not.toBeNull();
    });

    it('switching ib back to full removes area names and brings tick numbers back', () => {
      renderMarketChart(svg, ceiling(), { showSurplusLabels: true, detail: 'ib' });
      renderMarketChart(svg, ceiling(), { showSurplusLabels: true, detail: 'full' });
      expect(svg.querySelector('.area-name')).toBeNull();
      expect(ticks().some((t) => t.getAttribute('visibility') !== 'hidden')).toBe(true);
    });

    it('ib writes the full burden names on a wide chart with a large tax', () => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 40 } }), { detail: 'ib' });
      expect(areaNames()).toEqual(expect.arrayContaining(['consumer burden', 'producer burden']));
    });

    it('ib names government spending beside the box on a large subsidy', () => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'subsidy', mode: 'specific', amount: 40 } }), { detail: 'ib' });
      // Named just right of the box: in full if it fits the plot, else the short form.
      expect(areaNames().some((n) => n === 'government spending' || n === 'Gov')).toBe(true);
    });

    it('ib still names thin tax bands (shrunk short form) rather than dropping them', () => {
      renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } }), { detail: 'ib' });
      const names = areaNames();
      expect(names.some((n) => n === 'consumer burden' || n === 'CB')).toBe(true);
      expect(names.some((n) => n === 'producer burden' || n === 'PB')).toBe(true);
    });

    it('ib hides tick numbers even when no trade happens', () => {
      const r = computeMarket({ demand: 40, supply: 80, slopeD: 1, slopeS: 1, intervention: { type: 'none' } });
      renderMarketChart(svg, r, { detail: 'ib' });
      expect(ticks().every((t) => t.getAttribute('visibility') === 'hidden')).toBe(true);
    });
  });

  describe('layers', () => {
    const subsidy = () => computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    it('resolveLayers reproduces today\'s default set for a full-detail subsidy', () => {
      expect([...resolveLayers(subsidy(), { detail: 'full', showSurplusLabels: true })].sort()).toEqual(
        ['badges', 'cs', 'demand', 'dwl', 'eq1', 'eq2', 'overlap', 'prices', 'ps', 'subsidyBracket', 'supply', 'supply2', 'wedgeBox'].sort());
    });
    it('draws only the listed layers', () => {
      renderMarketChart(svg, subsidy(), { detail: 'clean', layers: ['demand'] });
      expect(svg.querySelectorAll('line.demand-curve')).toHaveLength(1);
      expect(svg.querySelector('line.supply-curve')).toBeNull();
      expect(svg.querySelector('[data-region="cs"]')).toBeNull();
      expect(svg.querySelector('.axis-symbol')).toBeNull();          // no eq1 → no Pe/Qe
    });
    it('ties axis symbols to their layers', () => {
      renderMarketChart(svg, subsidy(), { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq1', 'eq2'] });
      const subs = [...svg.querySelectorAll('.axis-symbol')].map((t) => t.textContent);
      expect(subs).toEqual(expect.arrayContaining(['Pe', 'Qe', 'Qsubsidy']));
      expect(subs).not.toContain('Pc');
      expect(subs).not.toContain('Q1');
    });
    it('marks entering and growing layers only on the render that asks', () => {
      renderMarketChart(svg, subsidy(), { detail: 'clean', layers: ['demand', 'supply', 'supply2'], enter: ['supply2'] });
      expect(svg.querySelector('[data-layer="supply2"].layer-enter, [data-layer="supply2"] .layer-enter')).not.toBeNull();
      renderMarketChart(svg, subsidy(), { detail: 'clean', layers: ['demand', 'supply', 'supply2'] });
      expect(svg.querySelector('.layer-enter')).toBeNull();
    });
    it('does not keep enter/grow for the resize replay, so a resize never replays the entry animation', () => {
      renderMarketChart(svg, subsidy(), { detail: 'clean', layers: ['demand', 'supply', 'supply2'], enter: ['supply2'], grow: ['supply2'] });
      expect(svg._lastOptions).toEqual({ detail: 'clean', layers: ['demand', 'supply', 'supply2'] });
      renderMarketChart(svg, svg._lastResult, svg._lastOptions);
      expect(svg.querySelector('.layer-enter, .layer-grow')).toBeNull();
    });
    it('uses captions for S1, S2 and the bracket', () => {
      renderMarketChart(svg, subsidy(), { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'subsidyBracket'],
        captions: { s1: 'S1 = what it costs to make', s2: 'S2 = what customers need to pay', bracket: '$20 paid by government' } });
      expect(svg.textContent).toContain('S1 = what it costs to make');
      expect(svg.textContent).toContain('$20 paid by government');
    });
  });
});

describe('IB perfect subsidy', () => {
  let svg;
  beforeEach(() => { svg = makeSvg(); });
  const r = () => computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
  const names = () => [...svg.querySelectorAll('.area-name')].map((t) => t.textContent);
  it('shades the triangles and marginal bands, with no overlap stripes', () => {
    renderMarketChart(svg, r(), { detail: 'ib' });
    expect(svg.querySelector('[data-region="subsidy-overlap"]')).toBeNull();
    expect(svg.querySelector('[data-region="marginal-cs"] polygon')).not.toBeNull();
    expect(svg.querySelector('[data-region="marginal-ps"] polygon')).not.toBeNull();
    expect(svg.querySelector('[data-region="dwl"]')).not.toBeNull();
    expect(svg.querySelector('[data-region="subsidy-cost"]')).not.toBeNull();
  });
  it('names every area at areaLabels full', () => {
    renderMarketChart(svg, r(), { detail: 'ib', areaLabels: 'full' });
    expect(names()).toEqual(expect.arrayContaining(['CS', 'PS']));
    // The subsidy says deadweight loss (DWL), never welfare loss; the triangle is small, so
    // it may use the short form.
    expect(names().some((n) => n === 'deadweight loss' || n === 'DWL')).toBe(true);
    expect(names()).not.toEqual(expect.arrayContaining(['WL']));
    expect(names().some((n) => /marginal CS|mCS/.test(n))).toBe(true);
  });
  it('gives the free-market triangles their own regions, not the post-subsidy CS/PS', () => {
    renderMarketChart(svg, r(), { detail: 'ib' });
    expect(svg.querySelector('[data-region="cs-original"] polygon')).not.toBeNull();
    expect(svg.querySelector('[data-region="ps-original"] polygon')).not.toBeNull();
    expect(svg.querySelector('[data-region="cs"]')).toBeNull();
    expect(svg.querySelector('[data-region="ps"]')).toBeNull();
  });
  it('does not name government spending when the subsidy is $0', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'subsidy', amount: 0 } }), { detail: 'ib', areaLabels: 'full' });
    expect(names().some((n) => n === 'government spending' || n === 'Gov')).toBe(false);
  });
  it('names only the marginal bands at half, and nothing at none', () => {
    renderMarketChart(svg, r(), { detail: 'ib', areaLabels: 'half' });
    expect(names().every((n) => /marginal|^m(CS|PS)$/.test(n))).toBe(true);
    renderMarketChart(svg, r(), { detail: 'ib', areaLabels: 'none' });
    expect(names()).toEqual([]);
  });
  it('leaves Full and Clean subsidy shading as before', () => {
    renderMarketChart(svg, r(), { detail: 'clean' });
    expect(svg.querySelector('[data-region="subsidy-overlap"]')).not.toBeNull();
    expect(svg.querySelector('[data-region="marginal-cs"]')).toBeNull();
  });
});

describe('focus', () => {
  let svg;
  beforeEach(() => { svg = makeSvg(); });
  const r = (amount = 20) => computeMarket({ ...base, intervention: { type: amount ? 'subsidy' : 'none', amount } });
  it('removes every other shaded area', () => {
    renderMarketChart(svg, r(0), { detail: 'ib', focus: 'cs' });
    const regions = [...svg.querySelectorAll('.fills [data-region]')].map((g) => g.dataset.region);
    expect(new Set(regions)).toEqual(new Set(['cs']));
  });
  it('splits a subsidised CS/PS into its free-market triangle and marginal band', () => {
    for (const [focus, parts] of [['cs', ['cs-original', 'marginal-cs']], ['ps', ['ps-original', 'marginal-ps']]]) {
      renderMarketChart(svg, r(), { detail: 'ib', focus });
      const regions = [...svg.querySelectorAll('.fills [data-region]')].map((g) => g.dataset.region);
      expect(new Set(regions)).toEqual(new Set(parts));
    }
  });
  it('fades in only the marginal band chip, never the surplus chip already on screen', () => {
    const result = r();
    for (const [focus, band] of [['cs', 'marginalCs'], ['ps', 'marginalPs']]) {
      renderMarketChart(svg, result, { detail: 'full', focus, enter: [band, 'focusChip'] });
      const chips = [...svg.querySelectorAll('.chart-focus-chip .region-badge')];
      expect(chips).toHaveLength(2);
      expect(svg.querySelector('.chart-focus-chip').classList.contains('layer-enter')).toBe(false);
      expect(chips[0].classList.contains('layer-enter')).toBe(false);
      expect(chips[1].classList.contains('layer-enter')).toBe(true);
    }
  });
  it('chips a subsidised CS/PS focus and its marginal band separately', () => {
    const result = r();
    for (const [focus, total, band, bandValue] of [['cs', 'old CS', 'mCS', result.marginalCS], ['ps', 'old PS', 'mPS', result.marginalPS]]) {
      renderMarketChart(svg, result, { detail: 'ib', focus });
      const chips = [...svg.querySelectorAll('.chart-focus-chip .region-badge')].map((b) => b.textContent);
      expect(chips).toHaveLength(2);
      expect(chips[0]).toBe(`${total} $${Math.round(focus === 'cs' ? result.csTriangleArea : result.psTriangleArea).toLocaleString('en-US')}`);
      expect(chips[1]).toBe(`${band} $${Math.round(bandValue).toLocaleString('en-US')}`);
    }
  });
  it('calls the overlap focus triangles old CS / old PS under a subsidy, plain CS / PS without one', () => {
    renderMarketChart(svg, r(), { detail: 'ib', focus: 'overlap' });
    expect([...svg.querySelectorAll('.chart-focus-chip .region-badge')].map((b) => b.textContent.split(' $')[0])).toEqual(['old CS', 'old PS']);
  });
  it('chips the societal lens by its three parts and draws only those inside the box outline', () => {
    const result = r();
    renderMarketChart(svg, result, { detail: 'ib', focus: 'societal' });
    expect(new Set([...svg.querySelectorAll('.fills [data-region]')].map((g) => g.dataset.region))).toEqual(new Set(['marginal-cs', 'marginal-ps', 'dwl']));
    expect(svg.querySelector('.wedge-outline')).not.toBeNull();
    const labels = [...svg.querySelectorAll('.chart-focus-chip .region-badge')].map((b) => b.textContent.split(' $')[0]);
    expect(labels.slice(0, 2)).toEqual(['mCS', 'mPS']);
    expect(svg.querySelector('[data-layer="govFill"]')).toBeNull();
  });
  it('draws the per-unit subsidy arrow from e2 up to S1 in the producer surplus and overlap focuses only', () => {
    const result = r();
    renderMarketChart(svg, result, { detail: 'ib', focus: 'ps' });
    const arrow = svg.querySelector('.subsidy-arrow');
    expect(arrow).not.toBeNull();
    expect(arrow.querySelector('.region-badge__text').textContent).toBe(`$${Math.round(result.Pp - result.Pc)}`);
    expect(arrow.querySelector('polygon')).not.toBeNull();
    for (const focus of ['cs', 'dwl', null]) {
      renderMarketChart(svg, result, { detail: 'ib', focus });
      expect(svg.querySelector('.subsidy-arrow')).toBeNull();
    }
    // The government's lens shows where the producer's share comes from, too.
    renderMarketChart(svg, result, { detail: 'ib', focus: 'gov' });
    expect(svg.querySelector('.subsidy-arrow')).not.toBeNull();
    renderMarketChart(svg, r(0), { detail: 'ib', focus: 'ps' });
    expect(svg.querySelector('.subsidy-arrow')).toBeNull();
  });
  it('fades ghosted marks only when an emphasis begins or ends, not on a rebuild that keeps it', () => {
    const layers = ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'wedgeBox', 'govFill'];
    const opts = (emphasis) => ({ detail: 'ib', focus: 'cs', layers, ...(emphasis ? { emphasis } : {}) });
    renderMarketChart(svg, r(), opts());
    expect(svg.querySelector('.ghost')).toBeNull();
    renderMarketChart(svg, r(), opts('consumers'));
    expect(svg.querySelector('[data-layer="supply"].ghost.ghost-in')).not.toBeNull();
    expect(svg.querySelector('[data-layer="demand"].ghost')).toBeNull();
    renderMarketChart(svg, r(), opts('consumers'));
    expect(svg.querySelector('[data-layer="supply"].ghost')).not.toBeNull();
    expect(svg.querySelector('.ghost-in')).toBeNull();
    renderMarketChart(svg, r(), opts());
    expect(svg.querySelector('.ghost')).toBeNull();
    expect(svg.querySelector('[data-layer="supply"].ghost-out')).not.toBeNull();
    // ...except a mark that is leaving: it fades on from its ghost rather than back up to full first.
    renderMarketChart(svg, r(), opts('consumers'));
    renderMarketChart(svg, r(), { ...opts(), exit: ['supply'] });
    expect(svg.querySelector('[data-layer="supply"].ghost')).not.toBeNull();
    expect(svg.querySelector('[data-layer="supply"].ghost-out')).toBeNull();
    expect(svg.querySelector('[data-layer="supply"].layer-exit')).not.toBeNull();
    renderMarketChart(svg, r(), opts());
    expect(svg.querySelector('.ghost-out')).toBeNull();
  });
  it("adding the tax's price-axis bracket (taxHeight) does not move the plot", () => {
    const taxed = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    const layers = ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'prices'];
    const plot = () => ({ clip: svg.querySelector('#plotClip rect')?.outerHTML, view: svg.getAttribute('viewBox'), size: `${svg.getAttribute('width')}x${svg.getAttribute('height')}` });
    const opts = { detail: 'ib', focus: 'societal', reserveGapBand: true, reserveDimBands: true, growForBands: true };
    renderMarketChart(svg, taxed, { ...opts, layers });
    const without = plot();
    renderMarketChart(svg, taxed, { ...opts, layers: [...layers, 'taxHeight'], captions: { taxHeight: '$20 tax' } });
    expect(svg.querySelector('.tax-height')).not.toBeNull();
    expect(plot()).toEqual(without);
  });

  it('can fill the government strips from the right', () => {
    const layers = ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'govStrips'];
    const delays = (opts) => {
      renderMarketChart(svg, r(), { detail: 'ib', focus: 'gov', layers, enter: ['govStrips'], ...opts });
      return [...svg.querySelectorAll('.gov-strip')].map((strip) => Number(strip.style.getPropertyValue('--d')));
    };
    const ltr = delays({}), rtl = delays({ stripsFromRight: true });
    expect(ltr[0]).toBe(0);
    expect(ltr.at(-1)).toBeGreaterThan(ltr[0]);
    expect(rtl.at(-1)).toBeLessThan(rtl[0]);
    expect(rtl.at(-1)).toBe(0);
  });
  it('can draw the loaf arrows faint and dotless, for Play\'s shift', () => {
    const layers = ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'loafDrops'];
    renderMarketChart(svg, r(), { detail: 'ib', focus: 'cs', layers });
    expect(svg.querySelectorAll('.loaf-drops__one circle').length).toBeGreaterThan(0);
    renderMarketChart(svg, r(), { detail: 'ib', focus: 'cs', layers, faintDrops: true });
    const arrows = [...svg.querySelectorAll('.loaf-drops__one')];
    expect(arrows.length).toBeGreaterThan(0);
    expect(svg.querySelectorAll('.loaf-drops__one circle')).toHaveLength(0);
    expect(arrows.every((a) => Number(a.getAttribute('opacity')) < 0.5)).toBe(true);
    renderMarketChart(svg, r(), { detail: 'ib', focus: 'cs', layers, faintDrops: true, exit: ['loafDrops'] });
    expect(svg.querySelector('[data-layer="loafDrops"]').classList.contains('layer-exit')).toBe(true);
  });
  it('can hold back the Pp line and symbol while keeping the Pc line that tracks e2', () => {
    const result = r();
    const layers = ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'pricesCOnly', 'psTriangle'];
    renderMarketChart(svg, result, { detail: 'ib', focus: 'ps', layers });
    expect(svg.querySelectorAll('line.wedge-line')).toHaveLength(1);
    const symbols = [...svg.querySelectorAll('.axis-symbol, text')].map((n) => n.textContent.replace(/\s/g, ''));
    expect(symbols).toContain('Pc');
    expect(symbols).not.toContain('Pp');
  });
  it('draws no producer-price line or Pp symbol in the CS focus', () => {
    renderMarketChart(svg, r(), { detail: 'ib', focus: 'cs' });
    expect(svg.querySelectorAll('line.wedge-line')).toHaveLength(1);
    const symbols = [...svg.querySelectorAll('text')].map((n) => n.textContent.replace(/\s/g, ''));
    expect(symbols).toContain('Pc');
    expect(symbols).not.toContain('Pp');
  });
  it('draws the overlap focus as labelled CS/PS, then both marginal bands and the stripes under a subsidy', () => {
    renderMarketChart(svg, r(0), { detail: 'ib', focus: 'overlap' });
    expect(new Set([...svg.querySelectorAll('.fills [data-region]')].map((g) => g.dataset.region))).toEqual(new Set(['cs', 'ps']));
    expect([...svg.querySelectorAll('.chart-focus-chip .region-badge')].map((b) => b.textContent.split(' ')[0])).toEqual(['CS', 'PS']);
    renderMarketChart(svg, r(), { detail: 'ib', focus: 'overlap' });
    expect(new Set([...svg.querySelectorAll('.fills [data-region]')].map((g) => g.dataset.region)))
      .toEqual(new Set(['cs-original', 'ps-original', 'marginal-cs', 'marginal-ps', 'subsidy-overlap']));
    expect(svg.querySelectorAll('polygon.overlap-fill').length).toBeGreaterThan(0);
    expect(svg.querySelector('.subsidy-arrow')).not.toBeNull();
  });
  it('puts a subsidised CS chip inside the free-market triangle, showing only the triangle (old CS)', () => {
    const result = r();
    renderMarketChart(svg, result, { detail: 'ib', focus: 'cs' });
    const [, tx, ty] = svg.querySelector('.chart-focus-chip .region-badge').getAttribute('transform').match(/translate\(([-\d.]+), ([-\d.]+)\)/).map(Number);
    const tri = svg.querySelector('[data-region="cs-original"] polygon').getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
    const ys = tri.map(([, y]) => y);
    expect(ty).toBeLessThan(Math.max(...ys));
    expect(ty).toBeGreaterThan(Math.min(...ys));
    expect(tx).toBeGreaterThan(Math.min(...tri.map(([x]) => x)));
    expect(svg.textContent).toContain(`old CS $${Math.round(result.csTriangleArea).toLocaleString('en-US')}`);
    expect(svg.textContent).not.toContain(`CS $${Math.round(result.CS).toLocaleString('en-US')}`);
  });
  it('fades S1 and enlarges e2', () => {
    renderMarketChart(svg, r(), { detail: 'ib', focus: 'cs' });
    expect(svg.querySelector('line.supply-curve').getAttribute('stroke-opacity')).toBe('0.35');
    expect(svg.querySelectorAll('.eq-dot--focus')).toHaveLength(1);
    expect(svg.querySelector('.eq-dot--focus').getAttribute('r')).toBe('8');
  });
  it("shows one chip with the focused area's dollar amount", () => {
    renderMarketChart(svg, r(), { detail: 'ib', focus: 'gov' });
    expect(svg.textContent).toContain('Gov $1,400');
    expect(svg.querySelectorAll('.surplus-badges, .area-name')).toHaveLength(0);
    // Its own class, so it never collides with the focus-bar buttons.
    expect(svg.querySelectorAll('.chart-focus-chip')).toHaveLength(1);
    expect(svg.querySelector('.focus-chip')).toBeNull();
  });
  it('draws nothing to highlight for gov on a free market', () => {
    renderMarketChart(svg, r(0), { detail: 'ib', focus: 'gov' });
    expect(svg.querySelector('.fills [data-region]')).toBeNull();
    expect(svg.textContent).not.toContain('Gov $');
  });
});

describe('tax: IB perfect, Explain layers and Explorer foci', () => {
  let svg;
  beforeEach(() => { svg = makeSvg(); });
  const tax = (amount = 20) => computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount } });
  const names = () => [...svg.querySelectorAll('.area-name')].map((t) => t.textContent);
  const regions = () => [...svg.querySelectorAll('.fills [data-region]')].map((g) => g.dataset.region);

  it('IB perfect names the deadweight loss (not welfare loss); the label setting thins the names', () => {
    renderMarketChart(svg, tax(), { detail: 'ib' });
    expect(names().some((n) => n === 'deadweight loss' || n === 'DWL')).toBe(true);
    expect(names()).not.toContain('welfare loss');
    renderMarketChart(svg, tax(), { detail: 'ib', areaLabels: 'half' });
    expect(names().every((n) => ['consumer burden', 'CB', 'producer burden', 'PB'].includes(n))).toBe(true);
    expect(names().length).toBe(2);
    renderMarketChart(svg, tax(), { detail: 'ib', areaLabels: 'none' });
    expect(names()).toEqual([]);
  });

  it('labels the traded quantity Qtax, ending at its own line left of Qe', () => {
    renderMarketChart(svg, tax(), { detail: 'ib' });
    const q = [...svg.querySelectorAll('.axis-symbol')].find((t) => t.textContent === 'Qtax');
    expect(q.getAttribute('text-anchor')).toBe('end');
  });

  it('draws each burden band as its own layer, and the tax bracket with its caption', () => {
    renderMarketChart(svg, tax(), { layers: ['demand', 'supply', 'supply2', 'taxConsumer'] });
    expect(regions()).toEqual(['tax-consumer']);
    expect(svg.querySelector('[data-layer="taxConsumer"]')).not.toBeNull();
    renderMarketChart(svg, tax(), { layers: ['demand', 'supply', 'supply2', 'taxBracket'], captions: { bracket: '$20 tax per can' } });
    expect(svg.querySelector('[data-layer="taxBracket"]').textContent).toContain('$20 tax per can');
  });

  it('focus layers: CS/PS show only the surplus, each burden is its own focus, revenue is the per-unit strips and their box, a closed market draws none', () => {
    const cs = resolveLayers(tax(), { focus: 'cs' });
    expect([...cs]).toEqual(expect.arrayContaining(['cs', 'focusChip']));
    expect(cs.has('taxConsumer')).toBe(false);
    expect(resolveLayers(tax(), { focus: 'ps' }).has('taxProducer')).toBe(false);
    const cb = resolveLayers(tax(), { focus: 'consumer-burden' });
    expect([...cb]).toEqual(expect.arrayContaining(['taxConsumer', 'pricesCOnly', 'focusChip']));
    expect(cb.has('cs')).toBe(false);
    expect(cb.has('taxProducer')).toBe(false);
    expect([...resolveLayers(tax(), { focus: 'producer-burden' })]).toEqual(expect.arrayContaining(['taxProducer', 'prices', 'focusChip']));
    const revenue = resolveLayers(tax(), { focus: 'revenue' });
    expect([...revenue]).toEqual(expect.arrayContaining(['taxArrow', 'govStrips', 'wedgeBox', 'focusChip']));
    expect(revenue.has('cs')).toBe(false);
    expect(revenue.has('taxConsumer')).toBe(false);
    const closed = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 200 } });
    expect(closed.closed).toBe(true);
    renderMarketChart(svg, closed, { detail: 'ib', focus: 'revenue' });
    expect(regions()).toEqual([]);
  });
});

describe('tax government perspective marks', () => {
  it('draws one tax-revenue strip per unit out to Qtax, and the note on the Pe dot only when asked', () => {
    const svg = makeSvg();
    const result = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 30 } });
    renderMarketChart(svg, result, { detail: 'ib', focus: 'revenue', captions: { strip: '1 unit = $30', taxArrow: '$30 tax', qtyBracket: '50.0 units traded', taxHeight: '$30 tax' } });
    expect(svg.querySelectorAll('.gov-strip').length).toBe(Math.ceil(result.Q));
    expect(svg.querySelector('[data-layer="govStrips"]').dataset.region).toBe('tax-revenue');
    expect(svg.textContent).toContain('1 unit = $30');
    expect(svg.querySelector('.qty-bracket__label').textContent).toBe('50.0 units traded');
    expect(svg.querySelector('.tax-height').textContent).toBe('$30 tax');
    expect(svg.querySelector('.tax-arrow').textContent).toBe('$30 tax');
    expect(svg.querySelector('.qty-bracket')).not.toBeNull();
    expect(svg.textContent).not.toContain('price being traded');
    const free = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, free, { detail: 'ib', layers: ['demand', 'supply', 'eq1', 'eq1Note'], captions: { eq1Note: 'Pe $60: the price being traded' } });
    expect(svg.textContent).toContain('the price being traded');
  });
});

describe('subsidy Explain teaching marks', () => {
  let svg;
  beforeEach(() => { svg = makeSvg(); });
  // base curves: Pe 80, Qe 60; a $20 subsidy gives Pc 70, Pp 90, Q 70.
  const sub = () => computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
  const texts = (sel) => [...svg.querySelectorAll(`${sel} .teach-label, ${sel}.teach-label`)].map((t) => t.textContent);

  it('draws none of them by default', () => {
    renderMarketChart(svg, sub(), { detail: 'full' });
    for (const cls of ['.loaf-drop', '.loaf-drops', '.price-brackets', '.cost-dot', '.readout', '.gov-strips', '.box-width']) {
      expect(svg.querySelector(cls)).toBeNull();
    }
  });

  it('keeps S1 solid when a subsidy result is drawn without S2', () => {
    renderMarketChart(svg, sub(), { detail: 'clean', layers: ['demand', 'supply', 'loafDrop'] });
    expect(svg.querySelector('.supply-curve').getAttribute('stroke-dasharray')).toBeNull();
    renderMarketChart(svg, sub(), { detail: 'clean', layers: ['demand', 'supply', 'supply2'] });
    expect(svg.querySelector('.supply-curve').getAttribute('stroke-dasharray')).toBe('6,4');
  });

  it('follows one loaf down by the subsidy with the step’s captions', () => {
    renderMarketChart(svg, sub(), {
      detail: 'clean', layers: ['demand', 'supply', 'loafDrop'], loafQ: 30,
      captions: { loafCost: '$50 to bake', loafGov: '$20 from government', loafCustomer: '$30 from customer' },
    });
    const g = svg.querySelector('[data-layer="loafDrop"]');
    expect(g).not.toBeNull();
    expect(g.querySelectorAll('circle')).toHaveLength(2);
    expect(texts('.loaf-drop')).toEqual(['$50 to bake', '$20 from government', '$30 from customer']);
  });

  it('drops an arrow from every sample loaf that stays on the chart, animating only on entry', () => {
    renderMarketChart(svg, sub(), { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'loafDrops'], enter: ['loafDrops'] });
    const ones = svg.querySelectorAll('.loaf-drops__one');
    expect(ones.length).toBeGreaterThan(3);
    expect([...ones].every((o) => o.classList.contains('layer-drop'))).toBe(true);
    renderMarketChart(svg, sub(), { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'loafDrops'] });
    expect(svg.querySelector('.layer-drop')).toBeNull();
  });

  it('keeps every loaf arrow when a big subsidy lands below the x axis, clipped to the plot', () => {
    const small = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    const big = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 90 } });
    const opts = { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'loafDrops'] };
    renderMarketChart(svg, small, opts);
    const before = svg.querySelectorAll('.loaf-drops__one').length;
    renderMarketChart(svg, big, opts);
    expect(svg.querySelectorAll('.loaf-drops__one').length).toBe(before);
    expect(svg.querySelector('.loaf-drops').getAttribute('clip-path')).toBe('url(#plotClip)');
  });

  it('splits the free-market equilibrium by term: Pe lights its line, Qe its own, the point both', () => {
    renderMarketChart(svg, sub(), { detail: 'clean', layers: ['demand', 'supply', 'eq1'] });
    const marks = (sel) => [...svg.querySelectorAll(sel)].map((n) => n.dataset.mark);
    const eq1 = [...svg.querySelectorAll('[data-layer="eq1"]')];
    expect(eq1.some((n) => n.dataset.mark === 'pe' && n.tagName === 'line')).toBe(true);
    expect(eq1.some((n) => n.dataset.mark === 'qe' && n.tagName === 'line')).toBe(true);
    expect(eq1.some((n) => n.dataset.mark === 'pe qe' && n.tagName === 'circle')).toBe(true);
    expect(marks('.axis-symbol--ref')).toEqual(expect.arrayContaining(['pe', 'qe']));
    expect(svg.querySelectorAll('[data-mark="undefined"]')).toHaveLength(0);
  });

  it('builds the two prices as stacked brackets (customer, then government), animating only on entry', () => {
    const opts = {
      detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq1', 'eq2', 'prices', 'priceBrackets', 'subsidyArrow'],
      captions: { customer: 'customer pays $70', gov: '+ $20 government', total: 'bakery gets $90' },
    };
    renderMarketChart(svg, sub(), { ...opts, enter: ['priceBrackets'] });
    expect(svg.querySelector('.price-brackets--enter')).not.toBeNull();
    expect(svg.querySelector('.pb-customer').dataset.mark).toBe('customer');
    expect(svg.querySelector('.pb-gov').dataset.mark).toBe('gov');
    expect(svg.querySelector('.subsidy-arrow')).not.toBeNull();
    expect(svg.querySelector('.price-line--producer')).not.toBeNull();
    expect(texts('.price-brackets')).toEqual(['customer pays $70', '+ $20 government', 'bakery gets $90']);
    renderMarketChart(svg, sub(), opts);
    expect(svg.querySelector('.price-brackets--enter')).toBeNull();
  });

  it('draws the draggable cost dot on a free market, with axis tags from captions', () => {
    const free = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, free, {
      detail: 'clean', layers: ['demand', 'supply', 'costDot'], dotQ: 30,
      captions: { s1: 'S1 = what it costs to make', dotLabel: 'loaf 30: $50 to bake', dotCostTag: '$50', dotQtyTag: 'loaf 30' },
    });
    const handle = svg.querySelector('.cost-dot__handle');
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-valuenow')).toBe('30');
    expect(texts('.cost-dot')).toEqual(['$50', 'loaf 30', 'loaf 30: $50 to bake']);
    expect(svg.querySelector('.drag-hint')).toBeNull();
    // The lone supply curve carries the step's S1 caption instead of "Supply".
    expect([...svg.querySelectorAll('.curve-label')].map((t) => t.textContent)).toContain('S1 = what it costs to make');
  });

  it('adds a "drag me" pill and a chevron either side along S1 when the step asks for the hint', () => {
    const free = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, free, { detail: 'clean', layers: ['demand', 'supply', 'costDot'], dotQ: 30, captions: { dragHint: 'drag me' } });
    expect(svg.querySelector('.drag-hint__text').textContent).toBe('drag me');
    expect(svg.querySelectorAll('.drag-hint__chevron')).toHaveLength(2);
  });

  it('draws the readout rows in their marks’ colours and reserves its corner', () => {
    renderMarketChart(svg, sub(), {
      detail: 'clean', layers: ['demand', 'supply', 'supply2', 'readout'],
      captions: { readout: [{ label: 'Customer pays (Pc)', value: '$70', mark: 'customer' }, { label: 'Government adds', value: '+ $20', mark: 'gov' }] },
    });
    const rows = [...svg.querySelectorAll('.readout__row')];
    expect(rows.map((r) => r.dataset.mark)).toEqual(['customer', 'gov']);
    expect(rows[1].querySelector('.readout__value').textContent).toBe('+ $20');
    expect(rows[1].querySelector('.readout__value').getAttribute('fill')).toBe('var(--gov)');
  });

  it('marks base layers with what they stand for, for word-to-mark highlighting', () => {
    renderMarketChart(svg, sub(), { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'eq1', 'wedgeBox', 'eq2', 'prices'] });
    expect(svg.querySelector('.demand-curve').dataset.mark).toBe('customer');
    expect(svg.querySelector('.supply-curve').dataset.mark).toBe('cost');
    expect(svg.querySelector('[data-region="subsidy-cost"]').closest('[data-mark]').dataset.mark).toBe('gov');
  });

  it('builds government spending from one strip per loaf sold, filling in left to right', () => {
    renderMarketChart(svg, sub(), { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'govStrips'], enter: ['govStrips'] });
    const strips = svg.querySelectorAll('[data-layer="govStrips"] .gov-strip');
    expect(strips).toHaveLength(70);
    expect(svg.querySelector('[data-layer="govStrips"]').dataset.region).toBe('subsidy-cost');
    // Delays are set at 1× pace (ms) as --d; pages.css scales them by --pace.
    expect(strips[0].style.getPropertyValue('--d')).toBe('0');
    expect(+strips[69].style.getPropertyValue('--d')).toBeGreaterThan(1000);
  });

  it('labels the box’s width and total', () => {
    renderMarketChart(svg, sub(), {
      detail: 'clean', layers: ['demand', 'supply', 'supply2', 'wedgeBox', 'govFill', 'boxWidth', 'boxLabel'],
      captions: { width: '70 loaves', box: 'Government spending $1,400' },
    });
    expect(texts('.box-width')).toEqual(['70 loaves']);
    expect(svg.querySelector('[data-layer="boxLabel"]').textContent).toBe('Government spending $1,400');
  });

  it('names the marginal bands by caption once they are drawn', () => {
    renderMarketChart(svg, sub(), {
      detail: 'clean', layers: ['demand', 'supply', 'supply2', 'wedgeBox', 'marginalPs', 'marginalCs'],
      captions: { mps: 'marginal PS', mcs: 'marginal CS' },
    });
    expect(svg.querySelector('text[data-layer="marginalPs"]').textContent).toBe('marginal PS');
    expect(svg.querySelector('text[data-layer="marginalCs"]').textContent).toBe('marginal CS');
  });

  it('fades the cost dot in when its layer enters', () => {
    const r = computeMarket({ ...base, intervention: { type: 'none' } });
    renderMarketChart(svg, r, { detail: 'clean', layers: ['demand', 'supply', 'costDot'], enter: ['costDot'] });
    expect(svg.querySelector('.cost-dot').classList.contains('layer-enter')).toBe(true);
    renderMarketChart(svg, r, { detail: 'clean', layers: ['demand', 'supply', 'costDot'] });
    expect(svg.querySelector('.cost-dot').classList.contains('layer-enter')).toBe(false);
  });

  it('keeps the student\'s loaf arrow and draws the other loaves\' arrows around it', () => {
    const r = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    const opts = { detail: 'clean', layers: ['demand', 'supply', 'supply2', 'loafDrop', 'loafDrops'], loafQ: 44 };
    renderMarketChart(svg, r, { ...opts, enter: ['loafDrops', 'supply2'] });
    expect(svg.querySelectorAll('[data-layer="loafDrop"]')).toHaveLength(1);
    expect(svg.querySelector('[data-layer="loafDrop"]').querySelector('.loaf-drop__arrow')).toBeNull(); // drawn as it was, not re-animated
    expect(svg.querySelectorAll('.loaf-drops__one')).toHaveLength(5); // loaf 45's arrow is the student's own
    expect(svg.querySelectorAll('.loaf-drops__tip')).toHaveLength(5); // a blue dot at the end of each arrow
  });
});
