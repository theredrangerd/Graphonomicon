import { fmtQty } from '../lib/format.js';
import { initPriceControlPage } from './price-control.js';
import { CEILING_FOCUSES, CEILING_QUESTIONS } from '../components/viewSwitch.js';

export function initPriceCeilingPage(doc, win = window) {
  initPriceControlPage(doc, {
    slug: 'price-ceiling',
    title: 'Price ceiling',
    type: 'ceiling',
    gapNote: (gap) => `<strong>${fmtQty(gap)} units of shortage.</strong> Buyers want more than sellers are willing to provide at this price — expect queues or rationing.`,
    notBindingNote: '<strong>Not binding.</strong> This ceiling is set above the equilibrium price, so it has no effect — the market clears exactly as it would without it.',
    showRegionLabels: true,
    focuses: CEILING_FOCUSES,
    questions: CEILING_QUESTIONS,
    tour: { policyName: 'price ceiling', sliderNoun: 'ceiling' },
  }, win);
}
