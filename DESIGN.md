# Design: Graphonomicon

Brand world: **Isotype wall chart** (Neurath-style classroom chart). Flat ink, bold condensed caps, three-colour bar mark.

## Brand tokens (`src/styles/tokens.css`)
- `--font-display`: Barlow Condensed 800, uppercase. Used for the wordmark, the homepage headline and tile titles. UI text stays IBM Plex Sans; chart/sans body unchanged.
- `--brand-ground` #f2ead7 (poster stock, homepage background only); `--brand-ink` #1d1d1b (rules, wordmark, search border).
- Colour roles are unchanged: `--demand` blue, `--supply` orange, `--gov` purple, plus the unit accent tokens.

## Mark
Three rising bars in `--demand`, `--supply`, `--gov` (`BRAND_MARK` in `src/components/chrome.js`; favicon at `public/favicon.svg`). Always paired with the wordmark "Graphonomicon" (capitalised in copy, uppercase via CSS).

## Rules
- Homepage: `.site-bar` with 6px ink rule, left-aligned condensed headline, 3px-bordered search. Diagram pages keep their existing look; only the mini-header wordmark and its 3px ink rule carry the brand.
- Every page shows the footer note: unofficial, not affiliated with the International Baccalaureate (`renderFooter`).
- No eyebrow above the homepage headline.
- Titles read "<Page> — Graphonomicon".
