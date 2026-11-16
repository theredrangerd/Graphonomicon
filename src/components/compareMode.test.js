import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountCompareMode } from './compareMode.js';
import { FLOOR_FOCUSES } from './viewSwitch.js';

const STATE = { demand: 0, supply: 0, slopeD: 0, slopeS: 0, controlPrice: 90, on: true, view: 'ib', focus: null };

function setup() {
  document.body.innerHTML = '<div class="chart-head"><h2>Price &amp; quantity</h2></div><svg id="chart"></svg>';
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
const freezeBtn = () => document.querySelector('.compare-freeze');
const trayThumbs = () => document.querySelectorAll('.compare-tray__thumb');
const openFirstForEdit = () => {
  document.querySelector('.compare-tray__view').click();
  document.querySelector('.compare-card__edit').click();
};

describe('mountCompareMode', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('puts an always-visible Freeze graph button in the chart header, with no Compare toggle', () => {
    setup();
    expect(freezeBtn().textContent).toBe('Freeze graph');
    expect(freezeBtn().hidden).toBe(false);
    expect(freezeBtn().closest('.chart-head')).not.toBeNull();
    expect(document.querySelector('.compare-toggle')).toBeNull();
  });

  it('shows no tray until something is frozen, then one thumbnail per freeze', () => {
    setup();
    expect(document.querySelector('.compare-tray').hidden).toBe(true);
    freezeBtn().click();
    freezeBtn().click();
    expect(document.querySelector('.compare-tray').hidden).toBe(false);
    expect(trayThumbs()).toHaveLength(2);
  });

  it('refuses the ninth freeze with a visible message', () => {
    const { mode } = setup();
    for (let i = 0; i < 8; i++) mode.freeze();
    expect(mode.freeze()).toEqual({ ok: false, reason: 'full' });
    expect(trayThumbs()).toHaveLength(8);
    expect(document.querySelector('.compare-note').textContent).toMatch(/up to 8/);
  });

  it('does not open a second gallery over an open one', () => {
    setup().mode.freeze();
    const view = document.querySelector('.compare-tray__view');
    view.click();
    view.click();
    expect(document.querySelectorAll('.compare-gallery')).toHaveLength(1);
  });

  it('"Edit this graph" in the gallery applies that state to the page', () => {
    const { mode, setState, applyState } = setup();
    setState({ ...STATE, demand: 25 });
    mode.freeze();
    openFirstForEdit();
    expect(applyState).toHaveBeenCalledWith({ ...STATE, demand: 25 });
  });

  describe('editing a frozen graph', () => {
    it('saves further changes into the frozen graph, so reopening the gallery shows them', () => {
      const ctx = setup();
      ctx.setState({ ...STATE, demand: 25 });
      ctx.mode.freeze();
      openFirstForEdit();
      ctx.setState({ ...STATE, demand: 40 });
      ctx.mode.notifyChange();
      ctx.drawSnapshot.mockClear();
      document.querySelector('.compare-tray__view').click();
      expect(ctx.drawSnapshot.mock.calls.at(-1)[1].state.demand).toBe(40);
      expect(document.querySelectorAll('.compare-card')).toHaveLength(1);
    });

    it('says which mode it is in and stops saving when Done is pressed', () => {
      const ctx = setup();
      ctx.mode.freeze();
      openFirstForEdit();
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
      ctx.mode.freeze();
      ctx.setState({ ...STATE, demand: 50 });
      ctx.mode.notifyChange();
      ctx.drawSnapshot.mockClear();
      document.querySelector('.compare-tray__view').click();
      expect(ctx.drawSnapshot.mock.calls.at(-1)[1].state.demand).toBe(0);
    });

    it('stops editing when the edited graph is deleted', () => {
      const ctx = setup();
      ctx.mode.freeze();
      openFirstForEdit();
      expect(document.querySelector('.compare-note').textContent).toMatch(/editing/i);
      document.querySelector('.compare-tray__view').click();
      document.querySelector('.compare-card__delete').click();
      expect(document.querySelector('.compare-note').textContent).toBe('');
      expect(document.querySelector('.compare-done').hidden).toBe(true);
    });
  });
});
