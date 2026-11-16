import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountCompareTray } from './compareTray.js';
import { createCompareStore } from '../lib/compareStore.js';
import { createSnapshot } from '../lib/snapshot.js';

const STATE = { demand: 0, supply: 0, slopeD: 0, slopeS: 0, controlPrice: 90, on: true, view: 'ib', focus: null };
const snap = () => createSnapshot({ page: 'price-floor', state: STATE });

function setup() {
  const store = createCompareStore();
  const drawSnapshot = vi.fn();
  const onView = vi.fn();
  const tray = mountCompareTray(document, { store, drawSnapshot, onView });
  return { store, drawSnapshot, onView, tray };
}
const el = () => document.querySelector('.compare-tray');

describe('mountCompareTray', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('is hidden while the store is empty', () => {
    const { tray } = setup();
    tray.setVisible(true);
    expect(el().hidden).toBe(true);
  });

  it('shows one drawn thumbnail per frozen graph and counts them on the View button', () => {
    const { store, drawSnapshot, tray } = setup();
    tray.setVisible(true);
    store.add(snap());
    store.add(snap());
    expect(el().hidden).toBe(false);
    const thumbs = [...document.querySelectorAll('.compare-tray__thumb')];
    expect(thumbs).toHaveLength(2);
    expect(drawSnapshot.mock.calls.at(-1)[0]).toBe(thumbs.at(-1).querySelector('svg.market-chart'));
    expect(document.querySelector('.compare-tray__view').textContent).toBe('View (2)');
  });

  it('calls onView when View is pressed', () => {
    const { store, onView, tray } = setup();
    tray.setVisible(true);
    store.add(snap());
    document.querySelector('.compare-tray__view').click();
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('stays hidden when setVisible(false) even with frozen graphs', () => {
    const { store, tray } = setup();
    store.add(snap());
    tray.setVisible(false);
    expect(el().hidden).toBe(true);
  });

  it('flyIn resolves without leaving a transient copy behind', async () => {
    const { store, tray } = setup();
    tray.setVisible(true);
    store.add(snap());
    const live = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.append(live);
    await tray.flyIn(live);
    expect(document.querySelectorAll('.compare-tray__flyer')).toHaveLength(0);
  });

  it('destroy removes the tray', () => {
    const { tray } = setup();
    tray.destroy();
    expect(el()).toBeNull();
  });

  it('draws each thumbnail only once the tray is visible, so it measures its real width', () => {
    const store = createCompareStore();
    const visibleWhenDrawn = [];
    const tray = mountCompareTray(document, {
      store,
      drawSnapshot: () => visibleWhenDrawn.push(document.querySelector('.compare-tray').hidden === false),
      onView: () => {},
    });
    tray.setVisible(true);
    store.add(snap());
    tray.setVisible(false);
    store.add(snap());
    tray.setVisible(true);
    // The add made while the tray was hidden is redrawn when it is shown again.
    expect(visibleWhenDrawn.at(-1)).toBe(true);
    expect(visibleWhenDrawn[0]).toBe(true);
    expect(visibleWhenDrawn.filter(Boolean).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps page content reachable by marking the body while the tray is showing', () => {
    const { store, tray } = setup();
    tray.setVisible(true);
    expect(document.body.classList.contains('has-compare-tray')).toBe(false);
    store.add(snap());
    expect(document.body.classList.contains('has-compare-tray')).toBe(true);
    tray.setVisible(false);
    expect(document.body.classList.contains('has-compare-tray')).toBe(false);
    tray.setVisible(true);
    tray.destroy();
    expect(document.body.classList.contains('has-compare-tray')).toBe(false);
  });
});

