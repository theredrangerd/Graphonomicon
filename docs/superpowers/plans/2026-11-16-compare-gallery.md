# Compare Mode (Freeze → Tray → Gallery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the price ceiling and price floor pages, let a student freeze graph states into a corner tray, then open a full-screen gallery showing two frozen graphs at a time that they slide through.

**Architecture:** A frozen graph is a small versioned *snapshot record* (raw slider values, toggle, lens), not a picture. The live page's draw path is extracted into a pure `buildControlChart(state, config)` so the live chart, the tray thumbnails and the gallery cards all redraw from the same state through `renderMarketChart`. Compare mode is in-memory only (an in-page store), mounted by `price-control.js`.

**Tech Stack:** Vanilla JS ES modules, Vite multi-page, Vitest + jsdom (colocated `*.test.js`), no new dependencies; styles appended to `src/styles/pages.css` using existing tokens.

**Spec:** `docs/superpowers/specs/2026-11-16-compare-gallery-design.md` (read it, especially "Resolved after the builder check"). Repo rules: `CLAUDE.md`.

## Global Constraints

- Chart text is real-pixel sized: cards and thumbnails **redraw** with `renderMarketChart` at their own width; never scale a copy (only the short-lived freeze animation may use a scaled transient copy).
- Pages in scope: `price-ceiling` and `price-floor` only, via the shared `src/pages/price-control.js`. Tax/subsidy are out of scope.
- Snapshot record shape (versioned, page-named, no geometry): `{ v: 1, page, name, state }`, state stores **raw slider values**, not resolved prices.
- A frozen graph freezes the **lens as seen** (`view` + `focus` in the record); no "partial diagram" warning.
- Compare mode is **in-memory only**: no URL state, no localStorage. Tray cap **8**. Each card has a delete button; zero graphs shows an empty state.
- Gallery: native horizontal CSS scroll-snap, **two cards on screen (each half width)**, prev/next buttons, dots, keyboard arrows, Esc closes; **one card per screen below the 880px breakpoint**.
- Tray is a **fixed corner overlay**, never in the layout flow (the matched-column-height rule must not change).
- Labels show only what differs between frozen graphs, using **true point elasticity at equilibrium** (`pointElasticities`), never slope words. Lone/identical graphs are "Graph N".
- Intervention toggle rule: never call `render()` directly from a toggle handler; apply a restored toggle by setting `checked` and dispatching `change` (the existing `wireInterventionToggle` tweens it).
- Respect `prefers-reduced-motion`: no shrink animation, instant placement. Every new drawn/hoverable class follows `pages.css` conventions; use existing tokens, no ad hoc colours.
- `tweenValue`/`delay` no-op under Vitest; do not add per-test workarounds.
- Commit after each task. Co-author trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Inputs/conditions most likely to bite that no happy-path test would hit (each is pinned by a test in the owning task):

1. Freezing while the toggle is **mid-tween** (fraction between 0 and 1): the snapshot must record the toggle's target (`on: true`), not the half-way price. → Task 1.
2. Freezing a state where the market is closed (**no trade**) or the control is **not binding**: the card must draw without throwing. → Task 5.
3. Freezing the **same state twice**: both kept, labels numbered "Graph 1"/"Graph 2", nothing deduplicated. → Tasks 3, 4.
4. A **9th freeze at the cap**: rejected with a visible message, existing graphs intact; deleting one frees a slot. → Tasks 4, 7.
5. A **corrupt or future-version** snapshot record: `migrateSnapshot` returns `null` and the gallery skips it instead of throwing. → Tasks 2, 5.

---

### Task 1: Extract the draw path into a pure `buildControlChart`

Behaviour-preserving refactor so live chart, tray and gallery share one draw path.

**Files:**
- Create: `src/lib/controlChart.js`
- Test: `src/lib/controlChart.test.js`
- Modify: `src/pages/price-control.js` (use the new functions inside `render()`, lines ~71-107; move `CHART_FOCUS` out)

**Interfaces:**
- Produces:
  - `readControlState({ sliders, controlSlider, toggle, playView }) -> ControlState` where `ControlState = { demand: number, supply: number, slopeD: number, slopeS: number, controlPrice: number, on: boolean, view: 'ib'|'explorer', focus: string|null }`. `demand`/`supply`/`slopeD`/`slopeS` are the **raw slider values** (`+slider.value`); `on` is `toggle.checked` (the toggle's *target*, not the tween fraction).
  - `buildControlChart(state: ControlState, { type: 'ceiling'|'floor', showRegionLabels?: boolean, fraction?: number }) -> { result, options, curve }`. `fraction` defaults to `state.on ? 1 : 0`; the live page passes the toggle's tween fraction. `curve` is `readCurveParams(...)` output (so the live page can still call `updateShiftAndSlopeLabels`). `options` is the object to spread into `renderMarketChart`: `{ showSurplusLabels, detail: 'ib', focus, reserveGapBand: true }` where `focus` applies the existing `CHART_FOCUS = { societal: 'dwl' }` mapping.
  - `chartFocusFor(focus: string|null) -> string|null`.
- Consumes: `readCurveParams` (accepts objects with `.value`), `computeMarket` from `marketEngine.js`.

- [ ] **Step 1: Write failing tests** in `controlChart.test.js`:
  - `buildControlChart` at all-zero state, `on:false`, type `'floor'` → `result.mode !== 'floor'` and equals `computeMarket` free-market Pstar 80 / Qstar 60.
  - `on:true, controlPrice:110`, type floor → `result.mode === 'floor'`, `result.Pc === 110`.
  - `fraction: 0.5` with `on:true` → `result.Pc` strictly between Pstar (80) and 110 (pins the tween path).
  - `readControlState` with a toggle whose `checked` is true while a fake `fraction` is 0.3 → `state.on === true` (review focus 1: the state never carries the mid-tween price).
  - `chartFocusFor('societal') === 'dwl'`, `chartFocusFor('cs') === 'cs'`, `chartFocusFor(null) === null`.
- [ ] **Step 2: Run** `npx vitest run src/lib/controlChart.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement** `controlChart.js` with the signatures above. Move the Pstar → displayPrice → intervention logic from `price-control.js` `render()` into `buildControlChart` unchanged.
- [ ] **Step 4: Refactor `price-control.js`** `render()` to call `readControlState` then `buildControlChart(state, { type, showRegionLabels, fraction: toggleCtl.getFraction() })` and spread `options` into `renderMarketChart`. Keep every other behaviour (labels, status pill, stats, notes, legend).
- [ ] **Step 5: Run** `npm run test` → all existing tests (570+) plus the new ones PASS. Floor/ceiling page tests are the regression net; do not edit them to make them pass.
- [ ] **Step 6: Commit** `refactor(price-control): extract buildControlChart so frozen graphs redraw from state`.

### Task 2: Snapshot record

**Files:**
- Create: `src/lib/snapshot.js`
- Test: `src/lib/snapshot.test.js`

**Interfaces:**
- Consumes: `ControlState` (Task 1).
- Produces:
  - `SNAPSHOT_VERSION = 1`.
  - `createSnapshot({ page: string, state: ControlState }) -> { v: 1, page, name: '', state }` (state copied, not aliased).
  - `migrateSnapshot(record: unknown) -> Snapshot | null`: returns a current-version record, or `null` for anything not an object, an unknown/future `v`, a missing `page`, or a `state` missing/with non-finite numbers or wrong types (review focus 5). Never throws.

- [ ] **Step 1: Write failing tests**: `createSnapshot` returns `v: 1` and a copy (mutating the source state doesn't change the record); `migrateSnapshot` round-trips a created record through `JSON.parse(JSON.stringify(...))`; returns `null` for `null`, `'x'`, `{ v: 2, ... }`, `{ v: 1 }` (no state), and a state with `demand: NaN`.
- [ ] **Step 2: Run** `npx vitest run src/lib/snapshot.test.js` → FAIL.
- [ ] **Step 3: Implement** both functions in `snapshot.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(compare): versioned snapshot record`.

### Task 3: Snapshot labels

**Files:**
- Create: `src/lib/snapshotLabels.js`
- Test: `src/lib/snapshotLabels.test.js`

**Interfaces:**
- Consumes: `Snapshot` (Task 2), `computeMarket`/`pointElasticities` (`marketEngine.js`), `readCurveParams` (`pageControls.js`).
- Produces: `labelSnapshots(snapshots: Snapshot[], { type: 'ceiling'|'floor', focuses: [id, label][] }) -> string[]` (same order/length). Dimensions compared across the set, each shown only if the value differs between any two snapshots: `PED x.xx` and `PES x.xx` (free-market point elasticity at equilibrium, 2 dp), demand shift, supply shift (signed, e.g. `demand +10`), control (`floor $90` when on, `no floor` when off; "ceiling" for ceilings; the price is shown only if on), and lens (the focus label from `focuses`, or `exam diagram` for no lens). Joined by `, `.
  A set of one, or a set with no differing dimension, yields `Graph N` (1-based index) for each entry.

- [ ] **Step 1: Write failing tests**: lone snapshot → `['Graph 1']`; two snapshots differing only in `slopeD` slider → each label contains `PED` with different values and no `PES`/`floor`; differing in several dimensions → all appear, comma-separated; two identical snapshots → `['Graph 1','Graph 2']` (review focus 3); one on and one off → `floor $90` and `no floor`; differing lens → focus label vs `exam diagram`.
- [ ] **Step 2: Run** `npx vitest run src/lib/snapshotLabels.test.js` → FAIL.
- [ ] **Step 3: Implement** `labelSnapshots`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(compare): label frozen graphs by what differs`.

### Task 4: Compare store

**Files:**
- Create: `src/lib/compareStore.js`
- Test: `src/lib/compareStore.test.js`

**Interfaces:**
- Produces: `MAX_FROZEN = 8`; `createCompareStore() -> { add(snapshot) -> { ok: true, id: number } | { ok: false, reason: 'full' }, remove(id: number) -> void, list() -> { id: number, snapshot: Snapshot }[], subscribe(fn: () => void) -> unsubscribe, clear() -> void }`. Ids are increasing, never reused. Subscribers fire on every successful add/remove/clear (not on a rejected add). `list()` returns a copy.

- [ ] **Step 1: Write failing tests**: add returns increasing ids; the 9th add returns `{ ok:false, reason:'full' }`, leaves 8 and does not notify (review focus 4); remove frees a slot so the next add succeeds; subscriber is called once per change and not after unsubscribe; two adds of identical snapshots both stay (review focus 3).
- [ ] **Step 2: Run** `npx vitest run src/lib/compareStore.test.js` → FAIL.
- [ ] **Step 3: Implement** `compareStore.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(compare): in-memory store of frozen graphs`.

### Task 5: Gallery overlay

**Files:**
- Create: `src/components/compareGallery.js`
- Test: `src/components/compareGallery.test.js`
- Modify: `src/styles/pages.css` (append a `/* Compare gallery */` section)

**Interfaces:**
- Consumes: store (Task 4), `labelSnapshots` (Task 3).
- Produces: `openCompareGallery(doc, { store, drawSnapshot, labelOptions, onClose, onEdit }) -> { close(): void }`.
  - `drawSnapshot(svg: SVGElement, snapshot: Snapshot): void`, supplied by the page; it must call `renderMarketChart` on that svg (cards create their own empty `<svg class="market-chart">`).
  - `labelOptions` is passed straight to `labelSnapshots`; `onEdit(snapshot)` is called when a card's "Edit this graph" button is pressed (the gallery then closes); `onClose()` after any close.
  - DOM contract (tests rely on it): root `.compare-gallery[role="dialog"][aria-modal="true"]`; scroll track `.compare-gallery__track`; one `.compare-card` per snapshot with `.compare-card__title` (its label), an `svg.market-chart`, `.compare-card__delete` and `.compare-card__edit` buttons; `.compare-gallery__prev`/`__next`; `.compare-gallery__dots > button`; empty state `.compare-gallery__empty` when the store is empty; close button `.compare-gallery__close`.
  - Behaviour: re-renders on store changes (delete removes the card and relabels the rest); Esc and close button close it and return focus to the element focused before opening; ArrowLeft/ArrowRight scroll by one card; records failing `migrateSnapshot` are skipped.

- [ ] **Step 1: Write failing tests** (jsdom; stub `drawSnapshot` with `vi.fn`): three snapshots → three `.compare-card` with titles from `labelSnapshots` and `drawSnapshot` called once per card with its svg; clicking `.compare-card__delete` on card 2 removes it, calls the store's `remove`, and the remaining titles are recomputed; empty store shows `.compare-gallery__empty` and no cards; Escape closes, removes the root and calls `onClose`; `.compare-card__edit` calls `onEdit` with that snapshot then closes; a store entry whose snapshot is corrupt (`{ v: 99 }`) is skipped, other cards still render (review focus 5); a snapshot for a no-trade market (`controlPrice: 0` floor with extreme demand shift) makes `drawSnapshot` run without throwing the gallery (review focus 2; use the real `buildControlChart`+`renderMarketChart` in one test).
- [ ] **Step 2: Run** `npx vitest run src/components/compareGallery.test.js` → FAIL.
- [ ] **Step 3: Implement** `openCompareGallery`. Track is `display:flex; overflow-x:auto; scroll-snap-type:x mandatory`; cards `flex: 0 0 50%; scroll-snap-align:start`; at `max-width: 879px` cards are `flex-basis:100%`. Prev/next call `track.scrollBy` one card width; dots track the leftmost visible card via the track's `scroll` event.
- [ ] **Step 4: Add styles** in `pages.css`: full-viewport fixed overlay on `--paper`/existing surface tokens, `.compare-card` as the existing `.card` look, buttons reuse existing button classes. Hover opacity rules for any new fill class are not needed (cards draw no new fills).
- [ ] **Step 5: Run** the test file → PASS; run `npm run test` → no regressions.
- [ ] **Step 6: Commit** `feat(compare): sliding two-up gallery overlay`.

### Task 6: Tray and freeze animation

**Files:**
- Create: `src/components/compareTray.js`
- Test: `src/components/compareTray.test.js`
- Modify: `src/styles/pages.css` (append `/* Compare tray */`)

**Interfaces:**
- Consumes: store (Task 4).
- Produces: `mountCompareTray(doc, { store, drawSnapshot, onView }) -> { setVisible(visible: boolean): void, flyIn(fromSvg: SVGElement): Promise<void>, destroy(): void }`.
  - DOM: fixed-corner `.compare-tray` (hidden attribute when `setVisible(false)` or the store is empty); one `.compare-tray__thumb` per frozen graph containing an `svg.market-chart` redrawn via `drawSnapshot` at thumbnail width; `.compare-tray__view` button reading `View (n)`; it re-renders on store changes.
  - `flyIn(fromSvg)`: clones `fromSvg` into a fixed-position transient element at the svg's `getBoundingClientRect()`, animates it (Web Animations `element.animate`, ~400ms, transform + opacity) toward the tray's rect, then removes it and resolves. Resolves immediately without animating when `matchMedia('(prefers-reduced-motion: reduce)').matches` or when `element.animate` is unavailable (jsdom/Vitest).

- [ ] **Step 1: Write failing tests**: empty store → tray hidden; two adds → two thumbs, each `drawSnapshot`-ed, and the button reads `View (2)`; clicking the button calls `onView`; `setVisible(false)` hides it even when non-empty; `flyIn` resolves in jsdom and leaves no transient element in the DOM.
- [ ] **Step 2: Run** `npx vitest run src/components/compareTray.test.js` → FAIL.
- [ ] **Step 3: Implement** `compareTray.js`.
- [ ] **Step 4: Add styles**: `position: fixed` bottom-right with a higher stacking order than the page chrome but below `.compare-gallery`; thumbs a fixed small size; no effect on `.layout` or column heights; reduced-motion rule for any transition.
- [ ] **Step 5: Run** the test file → PASS.
- [ ] **Step 6: Commit** `feat(compare): corner tray with freeze fly-in`.

### Task 7: Compare mode wiring on the price-control pages

**Files:**
- Create: `src/components/compareMode.js`
- Test: `src/components/compareMode.test.js`
- Modify: `src/pages/price-control.js` (mount compare mode; add `applyControlState`), `src/pages/price-floor.test.js` and `src/pages/price-ceiling.test.js` (compare flow tests), `src/styles/pages.css` (button styles)

**Interfaces:**
- Consumes: Tasks 1-6; `mountViewSwitch(...).set({ view, focus })` (already returned by `viewSwitch.js`).
- Produces: `mountCompareMode(doc, { chartHead, chart, page, getState, drawSnapshot, applyState, labelOptions }) -> { enter(), exit(), freeze() -> { ok: boolean, reason?: 'full' }, isActive(): boolean, destroy(): void }`.
  - Injects into `chartHead` a `.compare-toggle` button ("Compare", `aria-pressed`). When active it also shows a `.compare-freeze` button ("Freeze"); the tray is visible only when active and non-empty. `freeze()` builds `createSnapshot({ page, state: getState() })`, adds it to a page-scoped `createCompareStore()`, and on success runs `tray.flyIn(chart)`. On `{ ok:false, reason:'full' }` it shows a visible message in a `.compare-note[role="status"]` ("You can freeze up to 8 graphs. Delete one in the gallery to add another.") and does not animate.
  - The tray's View button opens the gallery (`openCompareGallery`); `onEdit(snapshot)` calls `applyState(snapshot.state)`.
- In `price-control.js`:
  - `getState = () => readControlState({ sliders, controlSlider: slider, toggle, playView })`.
  - `drawSnapshot = (svg, snap) => { const { result, options } = buildControlChart(snap.state, { type, showRegionLabels }); renderMarketChart(svg, result, options); }`.
  - `applyControlState(state)`: set the four slider values and the control slider, set `toggle.checked = state.on` and dispatch a `change` event only if it changed (never call `render()` from the toggle path), update `playView` and the view switch via the object returned by `mountViewSwitch` (`.set`), `writePlayView`, then `render()`.
  - `labelOptions = { type, focuses }`.

- [ ] **Step 1: Write failing tests** in `compareMode.test.js` (stub `getState`/`drawSnapshot`/`applyState`): Compare toggles `aria-pressed` and shows/hides the Freeze button; `freeze()` adds to the store and the tray shows one thumb; nine freezes → 9th returns `{ ok:false, reason:'full' }` and `.compare-note` shows the message (review focus 4); after `exit()` the tray is hidden but frozen graphs are kept; "Edit this graph" in the gallery calls `applyState` with that state.
- [ ] **Step 2: Write failing page tests** in `price-floor.test.js` (add alongside the existing page tests): on the real page, turn the floor toggle on, press Freeze, move the demand slider, press Freeze, open View → two `.compare-card`s with differing titles; freezing mid-toggle records `state.on === true` (review focus 1: dispatch the toggle `change` and freeze immediately; assert the snapshot's `on` and that its card's chart equals the fully-on result, e.g. `svg._lastResult.Pc === 110` for a $110 floor); "Edit this graph" on card 1 restores the first state's demand slider value and re-renders `#stat-price`. In `price-ceiling.test.js` add a smaller test that a ceiling page can freeze and open the gallery (asserts `type` is wired).
- [ ] **Step 3: Run** `npx vitest run src/components/compareMode.test.js src/pages/price-floor.test.js src/pages/price-ceiling.test.js` → FAIL.
- [ ] **Step 4: Implement** `compareMode.js`, then wire it into `price-control.js` as described. Keep it off the first render path (mount after `render()` and the tour start order stay as-is) and keep the bare URL unchanged.
- [ ] **Step 5: Add styles** for `.compare-toggle`, `.compare-freeze`, `.compare-note` in `pages.css` (reuse existing button/chip tokens). Verify `.chart-head` still wraps cleanly with the status pill at the 880px and phone breakpoints.
- [ ] **Step 6: Run** `npm run test` → all PASS.
- [ ] **Step 7: Commit** `feat(compare): freeze and compare on the price ceiling and floor pages`.

### Task 8: Verify in the browser, review, document

**Files:**
- Modify: `CLAUDE.md` (add a short "Compare mode" bullet to the done-definition/codebase layout: modules, in-memory scope, snapshot record, phase-1 pages), `docs/superpowers/specs/2026-11-16-compare-gallery-design.md` (status → built phase 1)
- Create: `docs/reviews/compare-gallery-2026-11-16.md` (by the reviewer)

- [ ] **Step 1: Run the app** (`npm run dev`) and, in the browser, on `price-floor.html` and `price-ceiling.html`: freeze 3 states (toggle on/off, PED > 1 vs < 1, one lens); confirm the fly-in, tray thumbnails, two-up gallery sliding by swipe/trackpad/arrows/keys, delete, Edit-this-graph, Esc; confirm chart text is crisp and unscaled in cards and thumbs; confirm one card per screen at <880px; confirm `prefers-reduced-motion` gives no animation; confirm the two columns still end at the same bottom edge with the tray visible; confirm the tour still highlights the right targets. Report anything not checked.
- [ ] **Step 2: Dispatch the `graph-reviewer` subagent fresh** on `units/microeconomics/government-intervention/price-floor.html` with the spec path; save its report to `docs/reviews/compare-gallery-2026-11-16.md`. Fix material findings (each its own commit), re-run `npm run test`.
- [ ] **Step 3: Update `CLAUDE.md` and the spec status.**
- [ ] **Step 4: Commit** `docs: compare mode phase 1`. Do not push; report that pushing was not attempted (known SSH gap).

## Self-Review

- **Spec coverage:** Compare button/freeze/tray/gallery (Tasks 5-7); two-up half-width + scroll-snap + 880px rule (Task 5); snapshot record + versioning (Task 2); redraw-from-state (Task 1); lens-as-seen (state carries `view`/`focus`, Tasks 1, 7); labels (Task 3); cap/delete/empty (Tasks 4, 5, 7); fixed overlay tray + reduced motion (Task 6); in-memory only, no URL state (Global Constraints, Task 7); edit-this-graph restore with the toggle rule (Task 7); success-criteria review (Task 8). Non-goals (numbers, export, saving, accounts, other pages) have no tasks, by design.
- **Type consistency:** `ControlState` (Task 1) is the `state` in `Snapshot` (Task 2), read by `labelSnapshots` (Task 3), drawn by `drawSnapshot` (Tasks 5-7); `createCompareStore` API (Task 4) is what Tasks 5-7 call; `openCompareGallery` options match its use in Task 7.
- **Open for the executor to settle** (spec "left to the builder"): exact tray size/position and Isotype styling (`DESIGN.md`), the scroll/dot sync maths, and the animation easing.
