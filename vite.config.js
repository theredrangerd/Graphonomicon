import { defineConfig } from 'vitest/config';

// Served as a GitHub Pages project site (https://theredrangerd.github.io/Graphonomicon/),
// not from the domain root, so production asset/script URLs need the repo name prefixed.
// Only applied to `vite build`; dev/test keep the default root base.
const base = process.env.GITHUB_PAGES ? '/Graphonomicon/' : '/';

export default defineConfig({
  base,
  test: {
    environment: 'jsdom',
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        wip: 'units/wip.html',
        microeconomics: 'units/microeconomics.html',
        governmentIntervention: 'units/microeconomics/government-intervention.html',
        priceCeiling: 'units/microeconomics/government-intervention/price-ceiling.html',
        priceFloor: 'units/microeconomics/government-intervention/price-floor.html',
        indirectTax: 'units/microeconomics/government-intervention/indirect-tax.html',
        subsidy: 'units/microeconomics/government-intervention/subsidy.html',
      },
    },
  },
});
