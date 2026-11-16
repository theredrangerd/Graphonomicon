# Compare mode: freeze graphs, view them in a sliding gallery

Status: approved; phase 1 built on the price ceiling and floor pages (2026-11-16), then parked on the `compare` branch and removed from `development`. Date: 2026-11-16. Phase 1 of a larger direction (compare → export → saved library → accounts).

## Intent and why

The owner (an IB Economics teacher) wants students to see how one graph state compares to another, e.g. a price floor in a PED > 1 market vs a PED < 1 market, to learn under what conditions the welfare loss outgrows the transfer to the favoured side. Longer term this is a route to students using Graphonomicon for their Economics IA and ordinary assignments: clean, exportable graphs instead of hand-drawn graphs that are then screenshotted. The owner also wants graphs to be saveable (browser storage now, accounts later).

This phase builds only the **freeze → tray → gallery** system. The owner explicitly deferred numeric comparison ("I'll sort that out later"), export, and saving.

## The experience

1. A **Compare** button on a graph page enters compare mode. The page works as normal.
2. The student adjusts the graph and presses **Freeze**. The live chart animates shrinking into a corner **tray** as a thumbnail. The live graph stays where it is, so they can change it and freeze again.
3. Repeat for as many states as they like.
4. **View** opens the **gallery**: the frozen graphs expand to fill the screen, **two on screen at once, each half the width**, and the student slides sideways through them like a gallery (swipe, trackpad, arrow buttons, keyboard).
5. A way back to the live graph / out of compare mode.

## Goals

- Let a student set up several states of one graph and see them side by side, two at a time, at full quality.
- A frozen graph is a small serializable **snapshot record** that later phases (export, browser-saved library, accounts, share links) reuse unchanged.
- Fits the existing page architecture, North Star and conventions (see Constraints).

## Non-goals (this phase)

- Numeric comparison (tables, deltas, "DWL > transfer" readouts). Owner will specify later.
- Image/SVG export, saving to localStorage, accounts, share links. The snapshot record must make them easy; they are not built here.
- Comparing across different pages (floor vs subsidy). Frozen graphs belong to one page.
- Pages other than price ceiling and price floor (tax, subsidy follow once the pattern works; their lenses and chains need extra handling).
- Overlaying two states on one chart (rejected: recreates the illegible-mess problem the site exists to solve).

## Anti-goals

- A frozen graph must not be a lens fragment that could be mistaken for, or submitted as, an exam diagram without the full picture (see constraints on lenses).
- No dynamics the model doesn't claim; freezing does not replay the chain.

## Constraints from the repo (CLAUDE.md)

- Chart text is real-pixel sized: `renderMarketChart` sizes its viewBox to the rendered width and redraws on resize. Gallery cards must therefore **redraw** at their own width, not scale a copy.
- Any drawn element belongs to a named layer; `renderMarketChart` options (`layers`, `focus`, `detail`, `reserveGapBand`) apply.
- Intervention toggle defaults off; toggles tween via `tweenValue`; "never call `render()` directly from the toggle handler" (relevant to how restored state is applied).
- Mode/view/focus URL state lives in `pageMode.js`, never localStorage. Saved graphs are user data and are a separate concern from that rule.
- Two-column layout, matched column heights, and the `.main-col`/`.sidebar` structure must not break when the tray and Compare button are added.
- Below the `880px` breakpoint layouts stack; the gallery shows one graph per screen there.
- Never leave the exam-diagram principle: the bare URL is the exam diagram; students must never draw a lens as their exam answer.

## Approaches considered

1. **Store the state, redraw it (chosen).** A snapshot is the record of slider values, toggles and view; the gallery calls `renderMarketChart` per card from it. Crisp at any size, tiny, restorable ("reopen in live graph"), and the same record is the saved-library / account / share-link format. Cost: each page's `render()` currently reads sliders straight from the DOM and must be split into read-state / draw-state. For price-control this is small: `render()` already goes sliders → `computeMarket` → `renderMarketChart`.
2. **Clone the finished SVG.** No refactor, but the clone is a picture: text would scale (breaking real-pixel sizing), and nothing can be restored or saved meaningfully.
3. **Screenshot to a raster image.** Blurry, heavy, uneditable; fails the "high quality" goal. Dropped.

The owner chose approach 1.

## Decisions made with the owner

- Compare is opt-in via a button; freeze animates the chart shrinking into a corner tray.
- The gallery view has **two graphs on screen at once, each half the screen**, sliding like a gallery.
- Numeric comparison is deferred.
- Saved graphs will, in the long run, be a library of snapshot records (not code, not images).

## Calls I made (owner to check)

- **Snapshot record** (versioned, page-named, no geometry): `{ v: 1, page: 'price-floor', name, state: { demandShift, supplyShift, slopeD/slopeS slider values, control price, on, view, focus } }`. Stores slider values, not derived curve numbers, so the record survives engine tweaks via migration on `v`.
- **Label** each thumbnail/card automatically by what differs from the other frozen graphs (e.g. "PED 2.0, floor $90"); renaming is later.
- **Frozen graphs are the finished picture** (no chain replay). A snapshot taken with the intervention on is drawn with it fully on.
- **Tray** is held in memory for the page session in phase 1 (no persistence yet); cap ~8 frozen graphs, with a clear message at the cap.
- **Gallery mechanics:** native horizontal CSS scroll-snap (free swipe/trackpad/keyboard support), plus prev/next buttons and dot position indicator; each card is half the viewport width; one card per screen below 880px.
- **Phase 1 pages:** price ceiling and price floor (the owner's example), through the shared `price-control.js`. Tax and subsidy later.
- Cards are drawn at the IB-exam level (no lens/focus) unless the student was in a lens when freezing; if frozen in a lens, the card shows the exam diagram with the same lens treatment the live page uses, labelled as a lens. (Builder may simplify to always freezing the exam diagram if the lens case complicates things; flag it.)
- Reduced-motion users get no shrink animation (instant placement).

## Resolved after the builder check

Decided by the owner:
- **A snapshot freezes the lens as seen.** `view` and `focus` are part of the record, and the card renders with the same lens treatment the live page uses, labelled with its lens. No "partial diagram" warning: the owner's view is that a lens image pasted into an IA is a legitimate illustration of one stakeholder's part of the diagram. This supersedes the earlier anti-goal about lens fragments and the "always freeze the exam diagram" simplification.

Builder-check calls (mine, owner may override):
- The record stores **raw slider values**, not the resolved price. Restore sets all sliders at once from a state that was valid when frozen; the existing guard still clamps if the engine later changes.
- **Shrink animation** runs on a transient scaled copy, replaced by a real redraw at thumbnail width. The tray is a **fixed corner overlay**, not in-flow, so the matched-column layout is untouched.
- **Labels** show only what differs between frozen graphs, using true point elasticity at equilibrium (never raw slider values or slope words). Identical graphs are numbered; a lone graph is "Graph 1".
- **Gallery edge cases:** each card has a delete button (this also frees the cap); zero graphs shows an empty state; one or an odd number works normally.
- **Placement:** the Compare button sits in the chart header beside the view switch. Compare mode is in-memory only, no URL state. The gallery is a full-screen overlay closed with Esc.
- **Detail level:** not part of the record (the price-control pages have no detail gear and always draw at IB level).
- **Leaving the page** loses the tray, with no warning in phase 1.
- The working tree's uncommitted price-control changes were committed as a checkpoint before this work starts.

## Left to the builder

- The exact split of `price-control.js` `render()` into state-reading and drawing, and where the snapshot module lives (suggest `src/lib/snapshot.js` with read/apply/serialize/migrate, plus `src/components/compareTray.js` and `src/components/compareGallery.js`).
- Shrink-to-tray animation technique, tray placement and visual styling within the Isotype identity (`DESIGN.md`).
- Applying a snapshot back to the live page without breaking `guardSliders`/`fitsChart` and the toggle's tween rule.
- Tests (Vitest + jsdom, colocated); `tweenValue` no-ops under test as usual.
- Follow `docs/success-criteria.md` and run the `graph-reviewer` on the built pages.
