import { describe, it, expect } from 'vitest';
import { buildControlChart, readControlState, chartFocusFor } from './controlChart.js';

const ZERO = { demand: 0, supply: 0, slopeD: 0, slopeS: 0, controlPrice: 110, on: false, view: 'explorer', focus: null };

describe('buildControlChart', () => {
  it('draws the free market when the control is off', () => {
    const { result } = buildControlChart(ZERO, { type: 'floor' });
    expect(result.mode).not.toBe('floor');
    expect(result.Pstar).toBeCloseTo(80);
    expect(result.Qstar).toBeCloseTo(60);
  });

  it('draws the control fully on when state.on is true', () => {
    const { result } = buildControlChart({ ...ZERO, on: true }, { type: 'floor' });
    expect(result.mode).toBe('floor');
    expect(result.Pc).toBe(110);
  });

  it('draws part-way when a tween fraction is given', () => {
    const { result } = buildControlChart({ ...ZERO, on: true }, { type: 'floor', fraction: 0.5 });
    expect(result.Pc).toBeGreaterThan(80);
    expect(result.Pc).toBeLessThan(110);
  });

  it('returns options for renderMarketChart at the IB level with the gap band reserved', () => {
    const { options } = buildControlChart({ ...ZERO, focus: 'societal' }, { type: 'floor', showRegionLabels: true });
    expect(options).toEqual({ showSurplusLabels: true, detail: 'ib', focus: 'dwl', reserveGapBand: true });
  });
});

describe('readControlState', () => {
  it('records the toggle target, never a mid-tween fraction', () => {
    const state = readControlState({
      sliders: { demandSlider: { value: '10' }, supplySlider: { value: '-5' }, slopeDSlider: { value: '0.1' }, slopeSSlider: { value: '0' } },
      controlSlider: { value: '110' },
      toggle: { checked: true },
      playView: { view: 'explorer', focus: 'cs' },
    });
    expect(state).toEqual({ demand: 10, supply: -5, slopeD: 0.1, slopeS: 0, controlPrice: 110, on: true, view: 'explorer', focus: 'cs' });
  });
});

describe('chartFocusFor', () => {
  it('maps the societal lens to the chart dwl focus and passes the rest through', () => {
    expect(chartFocusFor('societal')).toBe('dwl');
    expect(chartFocusFor('cs')).toBe('cs');
    expect(chartFocusFor(null)).toBe(null);
  });
});
