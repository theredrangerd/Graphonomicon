import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openCompareGallery } from './compareGallery.js';
import { createCompareStore } from '../lib/compareStore.js';
import { createSnapshot } from '../lib/snapshot.js';
import { buildControlChart } from '../lib/controlChart.js';
import { renderMarketChart } from '../lib/marketChart.js';
import { FLOOR_FOCUSES } from './viewSwitch.js';

const BASE = { demand: 0, supply: 0, slopeD: 0, slopeS: 0, controlPrice: 90, on: true, view: 'ib', focus: null };
const snap = (over = {}) => createSnapshot({ page: 'price-floor', state: { ...BASE, ...over } });
const labelOptions = { type: 'floor', focuses: FLOOR_FOCUSES };

function setup(snapshots, extra = {}) {
  const store = createCompareStore();
  snapshots.forEach((s) => store.add(s));
  const drawSnapshot = vi.fn();
  const onClose = vi.fn();
  const onEdit = vi.fn();
  const gallery = openCompareGallery(document, { store, drawSnapshot, labelOptions, onClose, onEdit, ...extra });
  return { store, drawSnapshot, onClose, onEdit, gallery };
}
const cards = () => [...document.querySelectorAll('.compare-card')];
const titles = () => cards().map((c) => c.querySelector('.compare-card__title').textContent);

describe('openCompareGallery', () => {
  beforeEach(() => { document.body.innerHTML = '<button id="opener">Open</button>'; });

  it('shows one titled card per snapshot and draws each into its own svg', () => {
    const { drawSnapshot } = setup([snap(), snap({ slopeD: 0.3 }), snap({ slopeD: -0.3 })]);
    expect(cards()).toHaveLength(3);
    expect(titles().every((t) => /^PED /.test(t))).toBe(true);
    expect(drawSnapshot).toHaveBeenCalledTimes(3);
    cards().forEach((card, i) => {
      expect(drawSnapshot.mock.calls[i][0]).toBe(card.querySelector('svg.market-chart'));
    });
    expect(document.querySelector('.compare-gallery').getAttribute('role')).toBe('dialog');
  });

  it('deleting a card removes it from the store and relabels the rest', () => {
    const { store } = setup([snap(), snap({ on: false }), snap({ on: false })]);
    expect(titles()).toEqual(['floor $90', 'no floor', 'no floor (2)']);
    cards()[1].querySelector('.compare-card__delete').click();
    expect(store.list()).toHaveLength(2);
    expect(titles()).toEqual(['floor $90', 'no floor']);
  });

  it('shows an empty state with no cards', () => {
    setup([]);
    expect(cards()).toHaveLength(0);
    expect(document.querySelector('.compare-gallery__empty')).not.toBeNull();
  });

  it('closes on Escape, removes itself, calls onClose and restores focus', () => {
    const opener = document.querySelector('#opener');
    opener.focus();
    const { onClose } = setup([snap()]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.compare-gallery')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(opener);
  });

  it('"Edit this graph" hands the snapshot to onEdit and closes', () => {
    const s = snap({ demand: 10 });
    const { onEdit } = setup([s]);
    cards()[0].querySelector('.compare-card__edit').click();
    expect(onEdit).toHaveBeenCalledWith(s);
    expect(document.querySelector('.compare-gallery')).toBeNull();
  });

  it('skips a corrupt record and still shows the rest', () => {
    const store = createCompareStore();
    store.add(snap());
    store.add({ v: 99 });
    openCompareGallery(document, { store, drawSnapshot: vi.fn(), labelOptions, onClose: vi.fn(), onEdit: vi.fn() });
    expect(cards()).toHaveLength(1);
  });

  it('arrow keys scroll the track by one card', () => {
    setup([snap(), snap({ on: false })]);
    const track = document.querySelector('.compare-gallery__track');
    track.scrollBy = vi.fn();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(track.scrollBy).toHaveBeenCalledTimes(1);
    expect(track.scrollBy.mock.calls[0][0].left).toBeGreaterThanOrEqual(0);
  });

  it('draws a closed (no-trade) market and a non-binding control without throwing', () => {
    const real = (svg, s) => {
      const { result, options } = buildControlChart(s.state, { type: 'floor' });
      renderMarketChart(svg, result, options);
    };
    // Demand and supply pushed apart at the slider limits: demand never exceeds supply.
    const closed = snap({ demand: -50, supply: -50, slopeD: 0.5, slopeS: 0.5 });
    expect(buildControlChart(closed.state, { type: 'floor' }).result.noTrade).toBe(true);
    const loose = snap({ controlPrice: 10 });
    expect(buildControlChart(loose.state, { type: 'floor' }).result.mode).toBe('free');
    expect(() => setup([closed, loose], { drawSnapshot: real })).not.toThrow();
    expect(cards()).toHaveLength(2);
    cards().forEach((c) => expect(c.querySelector('svg .dynamic-layer')).not.toBeNull());
  });

  it('puts the scroll position back after a card is deleted (a rebuild resets it in a real browser)', () => {
    setup([snap(), snap({ on: false }), snap({ slopeD: 0.3 })]);
    const track = document.querySelector('.compare-gallery__track');
    const writes = [];
    Object.defineProperty(track, 'scrollLeft', { get: () => 650, set: (v) => writes.push(v), configurable: true });
    cards()[2].querySelector('.compare-card__delete').click();
    expect(writes).toContain(650);
  });

  it('moves focus to the next card\'s Delete when the focused card is deleted, or Close when none is left', () => {
    setup([snap(), snap({ on: false })]);
    cards()[0].querySelector('.compare-card__delete').focus();
    cards()[0].querySelector('.compare-card__delete').click();
    expect(document.activeElement).toBe(cards()[0].querySelector('.compare-card__delete'));
    document.activeElement.click();
    expect(document.activeElement).toBe(document.querySelector('.compare-gallery__close'));
  });

  it('makes the page behind inert while open and restores it on close', () => {
    document.body.insertAdjacentHTML('beforeend', '<main id="page"></main><div id="already" inert></div>');
    const { gallery } = setup([snap()]);
    expect(document.querySelector('#page').hasAttribute('inert')).toBe(true);
    expect(document.querySelector('.compare-gallery').hasAttribute('inert')).toBe(false);
    gallery.close();
    expect(document.querySelector('#page').hasAttribute('inert')).toBe(false);
    expect(document.querySelector('#already').hasAttribute('inert')).toBe(true);
  });
});

