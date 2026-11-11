import { fmtQty } from '../lib/format.js';
import { initPriceControlPage } from './price-control.js';
import { FLOOR_FOCUSES } from '../components/viewSwitch.js';

export function initPriceFloorPage(doc, win = window) {
  initPriceControlPage(doc, {
    slug: 'price-floor',
    title: 'Price floor',
    type: 'floor',
    showRegionLabels: true,
    gapName: 'excess supply',
    focuses: FLOOR_FOCUSES,
    tour: { policyName: 'price floor', sliderNoun: 'floor' },
    bindingPill: 'Price floor binding',
    gapNote: (gap) => `<strong>${fmtQty(gap)} units of excess supply.</strong> Sellers want to supply more than buyers demand at this price, so the extra output goes unsold.`,
    notBindingNote: '<strong>Not binding.</strong> This floor is set below the equilibrium price, so it has no effect — the market clears exactly as it would without it.',
  }, win);
}
