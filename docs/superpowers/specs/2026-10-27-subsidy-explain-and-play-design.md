# Subsidy page: Explain and Play modes — design

Date: 2026-10-27. Status: implemented (2026-10-27).
Scope: **the subsidy page only.** Every other graph page keeps working exactly as today. Whatever we learn here gets carried to the other pages later as a separate piece of work.

Related: the main site spec (`2026-09-24-ib-econ-graph-site-design.md`), the detail-settings/onboarding spec (`2026-10-25-graph-onboarding-and-detail-settings-design.md`), and Ms. Patel's open requests in `docs/teacher-feedback.md`. This design covers request 1 (marginal CS/PS), part of request 4 (the government spending box) and the subsidy part of request 3 (IB perfect labels).

## Why

The owner is an IB Economics teacher. On a subsidy diagram, students reliably get one thing wrong. They understand that a subsidy makes the good "cheaper", but they can't see why **S1 stays where it is**. A subsidy doesn't change the producer's real cost of production, and most of the confusion on the graph follows from missing that.

Today's page is a sandbox: drag sliders, watch regions change. That suits revision, but the page never *teaches* the diagram. The owner wants each graph to have two modes:

- **Explain** builds the diagram one step at a time, with words, so a student understands it.
- **Play** is the sandbox, opening on the exam-ready (IB perfect) diagram, plus a way to focus on one area at a time.

Explain also has to teach a student how to use the site's controls (its subsidy slider behaves like Play's). Moving on to Play then feels like revision, not like learning a new tool.

## Goals

- A student who has never seen a subsidy diagram can click through Explain and come out understanding why S1 stays, how Pc and Pp arise, what marginal CS and marginal PS are, why CS and PS overlap, what the government spends, and where the welfare loss comes from.
- The IB perfect subsidy diagram shows what Ms. Patel says the IB actually cares about: the **marginal CS and marginal PS added by the subsidy**.
- From Play, a student can isolate one area (e.g. consumer surplus) and see it with nothing else competing for attention.
- Deep links keep working. A teacher can share a link to exactly Explain or exactly Play.

## Non-goals

- Doing any of this on the price ceiling, price floor or tax pages.
- Final Explain copy. The owner said "we'll workshop and actually build this out later". The step copy in this doc is a working draft the builder implements as-is, but it's expected to change.
- Changing the detail gear on any page other than subsidy. On the tax, ceiling and floor pages it stays exactly as today until this design is carried over.
- Ms. Patel's request 2 (tax quantity-axis labels / axis audit).

## Anti-goals (would make this a failure even if it works)

- Any Explain step that **moves S1**, or animates "supply sliding down" as if costs fell. S1 must stay on screen as the real cost of production for the whole walkthrough after it's introduced.
- Explain turning into a wall of text. Each step is a short card: a bold one-line headline plus at most ~2 sentences.
- Extra pages or extra navigation levels. The owner explicitly cut a "choose Explain or Play" sub-page because "we're going to have too many pages".
- Breaking an existing shared link to `subsidy.html`.

## How the student gets there: the split tile

On the **Government Intervention family page** (`units/microeconomics/government-intervention.html`), clicking the **Subsidy** tile does not navigate. Instead the tile visually dissolves and **two smaller tiles appear in its place: Explain and Play**. Each one links into the subsidy page in that mode.

- The Subsidy tile is on the family page, not the Microeconomics unit page. The owner described it as "on the microeconomics page"; this is the same tile, one level down.
- Only tiles whose diagram declares modes split. For now that's just Subsidy (data lives on the diagram entry in `src/lib/units.js`, e.g. `modes: ['explain', 'play']`). Other tiles keep linking straight to their page.
- Animation and dismissal details are the builder's call. The baseline: roughly 250–350ms; both new tiles together fill the original tile's footprint so the grid doesn't reflow; Escape or a click outside restores the tile; it must work by keyboard (Enter on the tile splits it, focus moves to Explain); `prefers-reduced-motion` swaps instantly.

## The subsidy page: two modes, one page

Both modes live on the existing `units/microeconomics/government-intervention/subsidy.html`. There's no new page.

- `subsidy.html#explain` opens Explain; `subsidy.html#play` opens Play.
- **A bare `subsidy.html` (no hash) opens Play.** Old shared links and homepage search results land where they always did.
- A small **Explain | Play** switch sits in the chart card's top bar next to Play's view switch *(Claude's call: the owner expects it to be rarely used and left placement to Claude)*. Switching updates the hash via `history.replaceState`, so the link always reflects the current mode. Changing the hash by hand also switches mode without a reload.
- Switching modes keeps the student's subsidy amount *(Claude's call)*. Curve shift/elasticity sliders exist only in Play; Explain always uses the default curves.
- Subsidy toggle state across modes *(Claude's call, from the builder check)*: arriving in Play by link, tile or the mode switch follows the site rule (toggle off). The one exception is Explain's final **Try it in Play →** button: it switches to Play and animates the subsidy on at the current amount, so the student lands on the same diagram they just finished. Entering Explain always starts at step 1, whatever Play's state.

## Explain mode

Layout **A** (owner's pick from mockups): the chart, with a **step card directly underneath it**, in one column. It reads like a slideshow.

- The step card shows: "Step n of N", a bold headline, one or two sentences, and **Back / Next** buttons with step dots between them. Arrow keys also move between steps.
- The chart builds up step by step: each step adds to what's drawn and never resets the picture.
- From the subsidy step onward, a **subsidy slider sits inside the step card**. Dragging it re-renders the chart *and* the numbers in the step text live (e.g. "$20 per loaf", Pc, Pp). This is how Explain teaches the site's controls.
- What else is on screen in Explain *(Claude's call)*: the sidebar (intervention toggle, curve sliders, elasticity, real-world examples) and the "Market outcome" panel are **hidden**. The step card is the only text, so the student's eyes stay on chart + words. The header, hero and feedback form stay.
- Play's IB perfect / Explorer view switch is hidden in Explain *(Claude's call)*. Explain draws its own picture per step.
- The first-visit tour does **not** auto-run in Explain *(Claude's call)*: Explain is already self-guiding. It still auto-runs the first time a student opens Play.
- Tapping a shaded area that's currently visible still opens its explainer popover, same as everywhere else.
- Step changes animate (~400ms via `tweenValue`), driving the same `computeMarket` call so curves, fills and labels move together. Respect `prefers-reduced-motion`.

### The teaching frame: the bakery

One concrete producer, a bakery, carries the whole walkthrough *(Claude's call; the owner said "you decide")*:

> Flour, ovens and wages still cost exactly what they did, so S1, the real cost of making bread, doesn't move. What changes is that the government now pays the bakery $X for every loaf it sells. To be just as willing to bake a loaf, the bakery now needs $X less *from the customer*. S2 is that "what customers need to pay" line, sitting $X below S1.

Short form used on the chart and in step text: **S1 = what it costs to make. S2 = what customers need to pay.** The per-unit gap between S1 and S2 is drawn as a bracket labelled as the government's share, never as "costs fell".

### Steps (working draft; the builder implements these as written, the owner will revise the copy later)

> **Superseded 2026-11-09:** the step sequence below was replaced by a 13-step, box-before-surplus version. See `2026-11-09-subsidy-explain-pedagogy-design.md`. Kept here for history.

`$X` = the current slider amount; Pc/Pp/Q₁ = live values.

1. **Demand.** Only D is drawn. "This is demand: how many loaves people want to buy at each price. Lower price, more loaves."
2. **Supply (S1).** Add S1, labelled "S1 = what it costs to make", plus e₁, Pe and Qe. "This is supply: what it costs the bakery to bake each extra loaf. Where it meets demand is the market price, Pe."
3. **The government adds a subsidy.** S1 stays fully drawn and labelled. S2 fades in $X below it, labelled "S2 = what customers need to pay", and a bracket between S1 and S2 is labelled "$X paid by government". The **subsidy slider appears in the card here**. Headline: "The bakery's costs don't change, so S1 stays put." Text: "The government pays $X per loaf, so the bakery needs $X less from each customer. That's S2."
4. **New equilibrium.** e₂ appears where S2 meets D; Q₁ is marked on the quantity axis; the e₁→e₂ movement animates. "More loaves are sold, Q₁ instead of Qe, because customers pay less."
5. **Two prices.** Pc (on D at Q₁) and Pp (on S1 at Q₁) are drawn as price lines. "Customers pay Pc. The bakery receives Pp: what the customer pays plus $X from the government."
6. **Producer surplus shifts.** First the original PS triangle (above S1, below Pe) is shaded. Then the **marginal PS** band (Pe up to Pp, above S1, out to Q₁) grows in, animated. "Producers gain this extra band: they now receive Pp instead of Pe."
7. **Consumer surplus shifts.** Same for the consumer side: the original CS triangle (below D, above Pe), then the **marginal CS** band (Pe down to Pc, below D, out to Q₁) grows in. "Consumers gain this band: they now pay Pc instead of Pe."
8. **Notice the overlap.** Full CS (down to Pc) and full PS (up to Pp) are both shown, and the region they share fades into today's two-colour stripes. "Look: part of the area is counted as both consumer *and* producer surplus. It's the same money, and the government pays for it." The owner stressed this must be "super, super clear" and animated: show PS shifting, then CS shifting, *then* reveal that they overlap.
9. **Government spending.** The government spending box (Pc to Pp, out to Q₁) is outlined and its parts called out. "The government pays $X × Q₁ in total. That's this whole box: the consumers' gain, the producers' gain, plus one more piece…"
10. **Welfare loss.** The DWL triangle is shaded. "…this triangle. Those last loaves cost more to make (S1) than buyers value them (D), so society loses this much."
11. **Wrap-up.** The chart shows the IB perfect diagram. "That's the full subsidy diagram, the one you'd draw in an exam." A button reads **Try it in Play →** and switches to Play mode.

## Play mode

Today's sandbox (sidebar controls, Market outcome panel, tour), with the changes below.

### 1. Two views replace the detail gear on this page (owner's decision, 2026-10-27)

On the subsidy page the three-stop detail gear (Full · Clean · IB perfect) is **removed** and replaced by a two-way view switch in the same spot on the chart card: **IB perfect · Explorer**.

- **IB perfect** is the default, every time Play opens.
- **Explorer** is entered by clicking it; the student then picks what to highlight (section 3). Explorer is where all the focus behaviour lives.
- **Shared links win:** a teacher's link can set the view and highlight, e.g. `subsidy.html?view=explorer&focus=cs#play`. Exact param names are the builder's call. Without them, Play opens on IB perfect. The view is **not** saved to `localStorage` and does not read or write the site-wide `econ.detail` preference, so nothing a student does here changes the other pages, and the other pages' saved level doesn't change this one.
- The renderer still receives a detail level: IB perfect renders as `detail: 'ib'` with the new subsidy shading; Explorer renders as described in section 3.
- The first-visit tour's "detail gear" step is replaced on this page by a step targeting the view switch, with copy that says what a student can do (e.g. "Switch views. IB perfect is the diagram to draw in an exam; Explorer lets you highlight one area at a time.").
- *Naming:* "Explorer" was chosen by the owner so it doesn't clash with the **Explain** tab.

### 2. New IB perfect subsidy diagram (Ms. Patel request 1, owner-confirmed 2026-10-27)

The striped CS/PS overlap does **not** appear in the IB perfect view. Exactly these areas are shaded:

| Area | Region | Fill |
|---|---|---|
| Consumer surplus | the original **top triangle** only: below D, above Pe, out to Qe | normal CS fill (`--demand-fill`) |
| Producer surplus | the original **bottom triangle** only: above S1, below Pe, out to Qe | normal PS fill (`--supply-fill`) |
| Marginal CS | below D, between Pe and Pc, out to Q₁ | the tax page's lighter consumer-burden fill (`--demand-alt-fill`) |
| Marginal PS | above S1, between Pe and Pp, out to Q₁ | the tax page's lighter producer-burden fill (`--supply-alt-fill`) |
| Government spending | the box Pc to Pp, out to Q₁ | outlined, as today's `subsidy-cost` wedge outline |
| Welfare loss | the DWL triangle | as today |

Nothing else is shaded. Geometry note (useful for the government spending explainer and for request 4): **marginal CS + marginal PS + the DWL triangle exactly fill the government spending box.** The marginal bands are not today's `consumerWedgePoly`/`producerWedgePoly` rectangles. Those include the part of the box beyond demand/S1 between Qe and Q₁, which belongs to the DWL. The engine needs new polygons for the two triangles and the two marginal bands.

**Area labels: a three-way setting** (owner's decision, 2026-10-27, as a contingency until Ms. Patel confirms request 3). One constant in the code, not a control students see *(Claude's call)*:

- `full` (**default**): every shaded area is named: "CS", "PS", "marginal CS", "marginal PS", "government spending", "welfare loss".
- `half`: only "marginal CS" and "marginal PS" are named.
- `none`: no area names.

The same setting governs Explain's wrap-up step, which shows this diagram.

### 3. Explorer: pick what to highlight

Inside Explorer the student picks one highlight: **Consumer surplus · Producer surplus · Overlap · Government spending · Welfare loss**. Until they pick, Explorer shows the IB perfect diagram with a short prompt to choose something to highlight *(Claude's call)*. Exact control (segmented row vs. chips vs. dropdown) is the builder's call; it must fit at phone width.

Number chips in Explorer *(Claude's call; the owner didn't say)*: only the highlighted area shows a chip with its own dollar amount (e.g. "CS $3,120"). No other number chips appear, and axis tick values stay hidden as on IB perfect.

When a focus is on:

- **Every shaded area except the focused one is removed completely**, not just dimmed (owner's words: "should be removed completely actually").
- **S1 is drawn more transparent** than it is today.
- **The equilibrium dot is enlarged**: e₂ while the subsidy is on, e₁ otherwise.
- All sliders stay live, so the focused area grows and shrinks as the student drags.

What each focus shows:

- **Consumer surplus:** the area below D, above Pc, out to Q₁ (the post-subsidy CS: top triangle + marginal CS). The teaching point is "this is what's below demand and above the price consumers pay: the gap between what they'd be willing to pay and what they pay."
- **Producer surplus:** the area above S1, below Pp, out to Q₁ (top-triangle analogue + marginal PS).
- **Overlap:** today's two-colour stripes, as they are now (owner: "I'm actually okay with the section that there is now").
- **Government spending:** only the Pc–Pp × Q₁ box.
- **Welfare loss:** only the DWL triangle.

With the subsidy toggled off, CS and PS focus show the free-market triangles; Overlap, Government spending and Welfare loss show nothing to highlight and say so in the market note *(Claude's call)*.

### 4. Government spending box and explainer (Ms. Patel request 4, partial)

Ms. Patel said the box is unclear as drawn and its popover text needs rewriting; she didn't say what was unclear. This design addresses it by: (a) the IB perfect view now shows the box as the outline around marginal CS + marginal PS + DWL, so its parts are visible; (b) rewriting the `subsidy-cost` explainer in `src/lib/regionExplainers.js` to say that, in bakery terms, with live numbers. Draft text:

> **Government spending.** The government pays $X on each of the Q₁ loaves sold, $total in all. That money ends up in three places: lower prices for consumers (marginal CS), higher prices for producers (marginal PS), and a welfare loss nobody gets.

Add explainer entries for the two new region ids (marginal CS, marginal PS), in the same style.

## Constraints (from the project rules in CLAUDE.md)

- Shared engine stays shared: new polygons go in `marketEngine.js`, drawing options in `marketChart.js`. No page-specific copy of the renderer.
- The existing subsidy toggle, `tweenValue` animation, slider guards, header nav and two-column layout (in Play) stay as specified. Other pages' detail-level contract (Clean = no number chips, gated `detail === 'full'`) is untouched; the shared renderer must keep honouring it for them.
- Shaded areas stay clickable at every detail level and in every focus.
- No runtime dependencies (vanilla JS + Vite). Tests colocated with Vitest + jsdom. `tweenValue` already no-ops under test.
- Every page must still work with `localStorage` unavailable.

## Left to the builder

- Module structure for Explain (step definitions as data vs. code), how the chart renderer accepts "draw only these layers" and the focus setting, and the tile-split component's internals.
- Exact animation timings/easing within the ~250–400ms range above.
- Exact focus-control styling, and the on-chart text and styling of the S1/S2 annotations in Explain.
- How "Step n of N" and step dots render on mobile.

## Open questions for the owner / Ms. Patel

- **IB perfect area names (Ms. Patel request 3).** Built as the three-way label setting above, defaulting to `full`; the owner confirms with Ms. Patel and flips it. Whether it applies to price controls too is still open.
- Whether the IB perfect / Explorer split replaces the detail gear sitewide is decided later, when this design is carried to the other pages.
