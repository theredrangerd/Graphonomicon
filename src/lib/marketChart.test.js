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
    expect(svg.querySelector('polygon.wedge-fill--consumer')).not.toBeNull();
    expect(svg.querySelector('polygon.wedge-fill--producer')).not.toBeNull();
    expect(svg.querySelector('polygon.wedge-outline')).not.toBeNull();
  });

  it('draws only the consumer-price reference line for a subsidy', () => {
    const result = computeMarket({ ...base, intervention: { type: 'subsidy', amount: 20 } });
    renderMarketChart(svg, result);
    const lines = svg.querySelectorAll('line.wedge-line');
    expect(lines).toHaveLength(1);
    expect(lines[0].getAttribute('stroke')).toBe('var(--demand)');
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

  it('tints the consumer/producer incidence fills with the demand/supply colors, and outlines the total wedge in gov color', () => {
    const result = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    renderMarketChart(svg, result);
    const consumerFill = svg.querySelector('polygon.wedge-fill--consumer').getAttribute('fill');
    const producerFill = svg.querySelector('polygon.wedge-fill--producer').getAttribute('fill');
    const psFill = svg.querySelector('polygon.ps-fill').getAttribute('fill');
    expect(consumerFill).toContain('--demand');
    expect(producerFill).toContain('--supply');
    expect(producerFill).not.toBe(psFill);
    expect(svg.querySelector('polygon.wedge-outline').getAttribute('stroke')).toBe('var(--gov)');
  });

  it('splits the tax wedge at the pre-tax equilibrium price so the incidence fills track relative elasticity', () => {
    const result = computeMarket({ ...base, intervention: { type: 'tax', mode: 'specific', amount: 20 } });
    renderMarketChart(svg, result);
    const consumerPoly = svg.querySelector('polygon.wedge-fill--consumer').getAttribute('points');
    const producerPoly = svg.querySelector('polygon.wedge-fill--producer').getAttribute('points');
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
    expect(symbols(svg).sort()).toEqual(['Pc', 'Pe', 'Pp', 'Q1', 'Qe']);
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

  it('flips the excess-supply bracket below a floor set near the top of the chart', () => {
    renderMarketChart(svg, computeMarket({ ...base, intervention: { type: 'floor', price: 175 } }));
    const bracket = svg.querySelector('[data-region="excess-supply"] .gap-bracket');
    if (!bracket) return; // market may close entirely at this floor
    const lineY = +svg.querySelector('[data-region="floor"] .wedge-line').getAttribute('y1');
    expect(+bracket.getAttribute('y1')).toBeGreaterThan(lineY);
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
  it('chips a subsidised CS/PS focus and its marginal band separately', () => {
    const result = r();
    for (const [focus, total, band, bandValue] of [['cs', 'CS', 'mCS', result.marginalCS], ['ps', 'PS', 'mPS', result.marginalPS]]) {
      renderMarketChart(svg, result, { detail: 'ib', focus });
      const chips = [...svg.querySelectorAll('.chart-focus-chip .region-badge')].map((b) => b.textContent);
      expect(chips).toHaveLength(2);
      expect(chips[0]).toMatch(new RegExp(`^${total} `));
      expect(chips[1]).toBe(`${band} $${Math.round(bandValue).toLocaleString('en-US')}`);
    }
  });
  it('draws the per-unit subsidy arrow from e2 up to S1 in the producer surplus and overlap focuses only', () => {
    const result = r();
    renderMarketChart(svg, result, { detail: 'ib', focus: 'ps' });
    const arrow = svg.querySelector('.subsidy-arrow');
    expect(arrow).not.toBeNull();
    expect(arrow.querySelector('.region-badge__text').textContent).toBe(`$${Math.round(result.Pp - result.Pc)}`);
    expect(arrow.querySelector('polygon')).not.toBeNull();
    for (const focus of ['cs', 'gov', 'dwl', null]) {
      renderMarketChart(svg, result, { detail: 'ib', focus });
      expect(svg.querySelector('.subsidy-arrow')).toBeNull();
    }
    renderMarketChart(svg, r(0), { detail: 'ib', focus: 'ps' });
    expect(svg.querySelector('.subsidy-arrow')).toBeNull();
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
  it('puts a subsidised CS chip inside the free-market triangle, still showing total CS', () => {
    const result = r();
    renderMarketChart(svg, result, { detail: 'ib', focus: 'cs' });
    const [, tx, ty] = svg.querySelector('.chart-focus-chip .region-badge').getAttribute('transform').match(/translate\(([-\d.]+), ([-\d.]+)\)/).map(Number);
    const tri = svg.querySelector('[data-region="cs-original"] polygon').getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
    const ys = tri.map(([, y]) => y);
    expect(ty).toBeLessThan(Math.max(...ys));
    expect(ty).toBeGreaterThan(Math.min(...ys));
    expect(tx).toBeGreaterThan(Math.min(...tri.map(([x]) => x)));
    expect(svg.textContent).toContain(`CS $${Math.round(result.CS).toLocaleString('en-US')}`);
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
