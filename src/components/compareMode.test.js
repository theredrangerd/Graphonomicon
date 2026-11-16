import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountCompareMode } from './compareMode.js';
import { FLOOR_FOCUSES } from './viewSwitch.js';

const STATE = { demand: 0, supply: 0, slopeD: 0, slopeS: 0, controlPrice: 90, on: true, view: 'ib', focus: null };

function setup() {
  document.body.innerHTML = '<div class="chart-head"></div><svg id="chart"></svg>';
  let state = { ...STATE };
  const drawSnapshot = vi.fn();
  const applyState = vi.fn();
  const mode = mountCompareMode(document, {
    chartHead: document.querySelector('.chart-head'),
    chart: document.querySelector('#chart'),
    page: 'price-floor',
    getState: () => state,
    drawSnapshot,
    applyState,
    labelOptions: { type: 'floor', focuses: FLOOR_FOCUSES },
  });
  return { mode, drawSnapshot, applyState, setState: (s) => { state = s; } };
}
const toggle = () => document.querySelector('.compare-toggle');
const freezeBtn = () => document.querySelector('.compare-freeze');
const trayThumbs = () => document.querySelectorAll('.compare-tray__thumb');

describe('mountCompareMode', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('adds a Compare button that reveals Freeze while active', () => {
    setup();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(freezeBtn().hidden).toBe(true);
    toggle().click();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(freezeBtn().hidden).toBe(false);
  });

  it('freezing adds a thumbnail to the tray', () => {
    const { mode } = setup();
    toggle().click();
    expect(mode.freeze()).toMatchObject({ ok: true });
    expect(trayThumbs()).toHaveLength(1);
  });

  it('refuses the ninth freeze with a visible message', () => {
    const { mode } = setup();
    toggle().click();
    for (let i = 0; i < 8; i++) mode.freeze();
    expect(mode.freeze()).toEqual({ ok: false, reason: 'full' });
    expect(trayThumbs()).toHaveLength(8);
    expect(document.querySelector('.compare-note').textContent).toMatch(/up to 8/);
  });

  it('keeps frozen graphs when compare mode is left, hiding the tray', () => {
    const { mode } = setup();
    toggle().click();
    mode.freeze();
    toggle().click();
    expect(document.querySelector('.compare-tray').hidden).toBe(true);
    toggle().click();
    expect(document.querySelector('.compare-tray').hidden).toBe(false);
    expect(trayThumbs()).toHaveLength(1);
  });

  it('"Edit this graph" in the gallery applies that state to the page', () => {
    const { mode, setState, applyState } = setup();
    toggle().click();
    setState({ ...STATE, demand: 25 });
    mode.freeze();
    document.querySelector('.compare-tray__view').click();
    document.querySelector('.compare-card__edit').click();
    expect(applyState).toHaveBeenCalledWith({ ...STATE, demand: 25 });
  });
});
