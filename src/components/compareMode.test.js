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

  it('does not open a second gallery over an open one', () => {
    const { mode } = setup();
    toggle().click();
    mode.freeze();
    const view = document.querySelector('.compare-tray__view');
    view.click();
    view.click();
    expect(document.querySelectorAll('.compare-gallery')).toHaveLength(1);
  });

  describe('editing a frozen graph', () => {
    it('saves further changes into the frozen graph, so reopening the gallery shows them', () => {
      const ctx = setup();
      toggle().click();
      ctx.setState({ ...STATE, demand: 25 });
      ctx.mode.freeze();
      document.querySelector('.compare-tray__view').click();
      document.querySelector('.compare-card__edit').click();
      ctx.setState({ ...STATE, demand: 40 });
      ctx.mode.notifyChange();
      ctx.drawSnapshot.mockClear();
      document.querySelector('.compare-tray__view').click();
      expect(ctx.drawSnapshot.mock.calls.at(-1)[1].state.demand).toBe(40);
      expect(document.querySelectorAll('.compare-card')).toHaveLength(1);
    });

    it('says which mode it is in and stops saving when Done is pressed', () => {
      const ctx = setup();
      toggle().click();
      ctx.mode.freeze();
      document.querySelector('.compare-tray__view').click();
      document.querySelector('.compare-card__edit').click();
      expect(document.querySelector('.compare-note').textContent).toMatch(/editing/i);
      document.querySelector('.compare-done').click();
      expect(document.querySelector('.compare-note').textContent).toBe('');
      ctx.setState({ ...STATE, demand: 50 });
      ctx.mode.notifyChange();
      ctx.drawSnapshot.mockClear();
      document.querySelector('.compare-tray__view').click();
      expect(ctx.drawSnapshot.mock.calls.at(-1)[1].state.demand).toBe(0);
    });

    it('does not change any frozen graph when nothing is being edited', () => {
      const ctx = setup();
      toggle().click();
      ctx.mode.freeze();
      ctx.setState({ ...STATE, demand: 50 });
      ctx.mode.notifyChange();
      ctx.drawSnapshot.mockClear();
      document.querySelector('.compare-tray__view').click();
      expect(ctx.drawSnapshot.mock.calls.at(-1)[1].state.demand).toBe(0);
    });

    it('stops editing when the edited graph is deleted or compare mode is left', () => {
      const ctx = setup();
      toggle().click();
      ctx.mode.freeze();
      document.querySelector('.compare-tray__view').click();
      document.querySelector('.compare-card__edit').click();
      expect(document.querySelector('.compare-note').textContent).toMatch(/editing/i);
      toggle().click();
      expect(document.querySelector('.compare-note').textContent).toBe('');
      expect(document.querySelector('.compare-done').hidden).toBe(true);
    });
  });
});

