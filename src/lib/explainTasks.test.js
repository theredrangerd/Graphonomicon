import { describe, it, expect, beforeEach, vi } from 'vitest';
import { advanceSweep, SWEEP_REACH, reachedTarget, wireChartDrag, wireTermHighlight } from './explainTasks.js';

describe('advanceSweep', () => {
  const range = { min: 0, max: 40 };
  it('needs the bottom first, then the top (within SWEEP_REACH of it)', () => {
    let sweep = advanceSweep({ low: false, high: false }, 40, range);
    expect(sweep).toEqual({ low: false, high: false });
    sweep = advanceSweep(sweep, 0, range);
    expect(sweep).toEqual({ low: true, high: false });
    sweep = advanceSweep(sweep, 40 - SWEEP_REACH, range);
    expect(sweep).toEqual({ low: true, high: true });
    expect(advanceSweep(sweep, 20, range)).toEqual({ low: true, high: true }); // kept once earned
  });
});

describe('reachedTarget', () => {
  it('counts landing in the halo, or passing through it, in either direction', () => {
    expect(reachedTarget(70, 44, 42, 5)).toBe(true); // landed within reach
    expect(reachedTarget(70, 20, 42, 5)).toBe(true); // swept straight through
    expect(reachedTarget(20, 70, 42, 5)).toBe(true);
    expect(reachedTarget(70, 50, 42, 5)).toBe(false); // stopped short
  });
});

describe('wireChartDrag', () => {
  let chart;
  beforeEach(() => {
    document.body.innerHTML = '<svg id="c" data-chart-w="780"><g class="handle" tabindex="0"></g></svg>';
    chart = document.querySelector('#c');
    chart.getBoundingClientRect = () => ({ left: 0, top: 0, right: 780, bottom: 500, width: 780, height: 500 });
  });
  const pointer = (type, clientX) => {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX, pointerId: 1 });
    chart.dispatchEvent(e);
  };
  it('follows the pointer only while active, and reports the release', () => {
    let active = false;
    const moves = [];
    const onRelease = vi.fn();
    wireChartDrag(chart, { isActive: () => active, handleSelector: '.handle', onMove: (q) => moves.push(q), onRelease, onKey: () => {} });
    pointer('pointerdown', 300);
    expect(moves).toEqual([]);
    active = true;
    pointer('pointerdown', 62);
    pointer('pointermove', 762);
    pointer('pointerup', 762);
    expect(moves[0]).toBeCloseTo(0);
    expect(moves[1]).toBeCloseTo(100);
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(chart.classList.contains('is-dragging')).toBe(false);
  });
  it('turns arrow keys on the handle into steps, bigger with Shift', () => {
    const keys = [];
    wireChartDrag(chart, { isActive: () => true, handleSelector: '.handle', onMove: () => {}, onRelease: () => {}, onKey: (dir, big) => keys.push([dir, big]) });
    const handle = chart.querySelector('.handle');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true }));
    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); // not on the handle
    expect(keys).toEqual([[1, false], [-1, true]]);
  });
});

describe('wireTermHighlight', () => {
  it('lights the chart up for the coloured word under the pointer, and clears it', () => {
    document.body.innerHTML = '<svg id="c"></svg><div id="card"><span class="term" data-mark="gov">24p</span><span class="plain">x</span></div>';
    const chart = document.querySelector('#c');
    const clear = wireTermHighlight(chart, [document.querySelector('#card')]);
    const term = document.querySelector('.term');
    term.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(chart.dataset.hot).toBe('gov');
    term.dispatchEvent(new Event('pointerout', { bubbles: true }));
    expect(chart.dataset.hot).toBeUndefined();
    document.querySelector('.plain').dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(chart.dataset.hot).toBeUndefined();
    chart.dataset.hot = 'gov';
    clear();
    expect(chart.dataset.hot).toBeUndefined();
  });
});
