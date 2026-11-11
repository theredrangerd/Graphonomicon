# Subsidy Explain: pedagogy rework — design

Date: 2026-11-09. Status: implemented (2026-11-09); revised three times the same day after owner review (drag step, readout + coloured terms, bracket-based two prices).
Supersedes the "Steps" section of `2026-10-27-subsidy-explain-and-play-design.md` (everything else there still stands: layout A, the bakery frame, S1 never moves, deep links, the Play side).

## Why

The owner named three places G11 students get lost on the subsidy diagram:

1. **Why supply moves *down*.** Students expect "more supply" to mean a shift right; a vertical drop by the subsidy feels arbitrary.
2. **Two prices.** That the customer pays Pc while the producer receives Pp, and that both are "the price", is unintuitive.
3. **The box.** It must be *obvious* that the rectangle is government spending, and that it can't be anything else; this nuance is often missed. Students should understand the graph, not memorise areas.

The owner also said surplus shading crowds the diagram, and agreed the box should come **before** the surplus steps.

## What the research found

Common features of the strongest explanations (sources below):

- **The subsidy is a fixed-height gap between what buyers pay and what sellers get** (MRU's "subsidy wedge": push a wedge the height of the subsidy between S and D; top = seller price, bottom = buyer price; government spending = subsidy × quantity, a rectangle). Built that way, the two prices and the box are consequences, not facts to memorise.
- **The shifted curve is a helper, not a cost change.** True costs don't move, so Pp is read off the original S (Occidental handout); NZAE teaching paper warns materials get this wrong.
- **"Down" and "right" must be reconciled explicitly**, because sources say both and students read them as different effects.
- **Concrete numbers** make Pp − Pc = subsidy simple arithmetic and head off the "buyers get the whole subsidy" error.
- Learning-science fit: Mayer's segmenting (learner-paced steps), signalling (highlight exactly what the text names), worked examples with numbers. Predict-before-reveal (POE) evidence is promising but small-study, so it's used lightly (two prompts).

Sources: [MRU subsidy wedge](https://learn.mru.org/lessons/subsidies-definition-subsidy-wedge) · [Whitney, Occidental](https://sites.oxy.edu/whitney/_private/classes/ec102old/handouts/txsub.htm) · [Agnew, NZAE](https://www.nzae.org.nz/wp-content/uploads/2011/Session1/15_Agnew.pdf) · [The IB Trainer](https://www.theibtrainer.com/ib-econ-subsidies) · [Mayer's principles (Dartmouth)](https://services.dartmouth.edu/TDClient/1806/Portal/KB/PrintArticle?ID=171655) · [POE + simulation preprint](https://easychair.org/publications/preprint/rfTZ)

## The 14 steps (revised same day after owner review)

Default curves, $20 subsidy: Pe $80, Qe 60, Pc $70, Pp $90, Q 67.5, spending $1,350. All numbers are live with the slider. Every step from 2 on has a **readout** (top-right of the chart; in the card on phones) listing its key values, and every number in the card text is a **coloured term** whose colour matches its mark; hovering/focusing a term (or readout row) fades every other marked thing on the chart. Owner's ask: "the English explanation should feel entangled and inseparable from the graph", and it should be obvious that e.g. Pe is $80.

1. **Demand.**
2. **Supply: what it costs to bake.** Curve labelled "S1 = what it costs to make" from here (owner). Readout: Pe $80, Qe 60.
3. **Every point on S1 is one loaf** (new, owner). A dot on S1 with dashed guides and axis tags ("$60", "loaf 45") glides slowly up S1 and back (~5s), then the student must drag it (mouse, touch, or arrow keys); Next stays locked until they've covered 20 loaves. Snaps every 3 loaves so costs are whole dollars.
4. **The government pays $20 of every loaf.** From the loaf the student left the dot on (nudged so the customer's price stays ≥ $0), a purple arrow draws down slowly by $20; the landing point and labels follow. Slider appears here.
5. **Every loaf drops by the same amount: that's S2.** Unchanged (owner: "perfect").
6. **Down by $20 is the same as right.** Readout names the old price and both quantities. *Think:* where will S2 cross demand?
7. **A new equilibrium, e2.**
8. **One loaf, two prices** (reworked, owner). A blue bracket rises from $0 to Pc ("customer pays $70"), then a purple bracket on top to Pp ("+ $20 government"), then the arrow from e2 up to S1 with the Pp line and "bakery gets $90". *Think:* how much does the government pay altogether?
9. **$20 on every loaf sold.** Strips, one picked out ("1 loaf: $20"). From here curves are plain S1/S2.
10. **This box is government spending.** Height × width.
11–13. **Where the money goes:** marginal PS, marginal CS, DWL; the DWL readout shows cents so the three shares add to exactly the total.
14. **The full diagram.**

### Third owner review (same day): "down is right" step removed

The owner cut step 6 ("Down by $20 is the same as right"): "it doesn't add much and is more likely to be confusing." The walkthrough is now **13 steps**; the step list above still shows it as step 6 for history. Its prediction prompt ("where will S2 cross demand?") moved to the "every loaf" step, so students still predict before e2 appears. The `downRight` chart layer was deleted with it.

### Second owner review (same day)

- **Everything in Explain is slower** (owner: "jagged and very quick" for a first-time learner). One knob: `--pace` (2.2 in Explain mode, 1 in Play) multiplies every Explain animation duration and delay, including the inline per-arrow/per-strip delays (`--d`, ms at 1×). The intro glide is 7s up S1 + 3s back. The dot is drawn at its true, smooth position; only the words snap to whole-dollar loaves, and on release the dot eases onto that loaf (no more 3-loaf jumps).
- **The drag is made obvious** (owner: "not obvious ... that the user is meant to drag the dot"): after the glide, a bobbing "drag me" pill points at the dot with a chevron either side along S1 nudging outward; the chart shows a grab cursor; the card's instruction becomes a highlighted call to action; the locked Next button reads "Drag the dot first". The hint disappears once the student touches the dot.
- **Step 4 copy is the owner's wording:** "…so the bakery only needs $X from the customer to make the same amount of money. This means the bakery can offer consumers prices $20 lower because *its cost of production is lesser by the amount of the subsidy*." Flagged to the owner: this says production cost falls, while the same paragraph says the loaf "still costs" the same and S1 stays put; kept verbatim as the standard IB phrasing.

## Decisions (Claude's calls, flagged for the owner)

- **The old "Notice the overlap" step is cut from Explain.** Box-first plus "where the money goes" shows the same point (consumer and producer gains are paid out of the government's box) without full CS/PS shading, which the owner said crowds the diagram. The overlap story is still in Play → Explorer → Overlap, which animates it. Easy to restore as a step if the owner wants it back.
- **No free-market CS/PS triangles in steps 10–12** (they were in the old PS/CS steps): only the marginal bands inside the box, to keep the box readable. The wrap-up's IB diagram shows the triangles.
- Two "think" prompts (steps 6 and 8), each answered by the next step; step 3's think line is its drag instruction. Kept to two because the POE evidence is thin.
- Explain's curves are fixed with equal elasticities, so the split is always 50/50 there; the elasticity point is left to Play.
- On phone-width charts (plot < 420px) the worded S1/S2 captions fall back to bare S1/S2, the receipt bar drops its labels, and the box label uses its short form; the card text carries the words.

## Implementation notes

- New chart layers (Explain only, never drawn by default): `costDot`, `loafDrop`, `loafDrops`, `downRight`, `priceBrackets`, `govStrips`, `boxWidth`, `boxLabel`, `readout`; caption keys `dotLabel/dotCostTag/dotQtyTag`, `loafCost/loafGov/loafCustomer`, `down/right`, `customer/gov/total`, `strip`, `width`, `box/boxShort`, `mps/mcs`, `readout` ([{label, value, mark}]). Marks carry `data-mark` (cost | gov | customer | pe | qty | dwl); the chart's `data-hot` fades the rest. `quantityAtClientX` maps a pointer to a quantity for dragging.
- Steps may set `gate(ctx)` (locks Next/ArrowRight until true; page calls `card.refresh()`), `drag: true`, and `chartOptions` as an object or a function of ctx (`dotQ`, `loafQ`). All numbers come from the step's captions, never computed in the chart.
- S1 is drawn dashed only when the `supply2` layer is on (was: whenever the result had a shift).
- Steps may set `think` (prompt line in the card) and `chartOptions` (spread into the render; `loafQ`).

## 2026-11-11 additions (supersede the numbering above)

The walkthrough is now **14 steps**: a **"Revenue is an area"** step sits between "One loaf, two prices" and "$20 on every loaf sold" (so the strips/box steps are 9 and 10, the money steps 11–13, the wrap 14). Other decisions made since the list above was written:

- **Revenue step (8).** Starts from the definition (price × quantity, what a seller takes in) and builds it on the graph in four slow beats (Explain pace): a height bracket rises from the axis to Pp, a width bracket sweeps from 0 to Q, the rectangle fills in left to right, then it's named ("Revenue = $90 × 67.5 = $6,075"). Layers `revenueDims` + `revenueBox` in `marketChart.js`; timings in `pages.css` (`.rev-*`). *Calls made without asking:* the rectangle is the **bakery's** revenue (Pp × Q), not customers' spending, so the next steps can show the government's slice of it; it is not split into customer/government parts here (that would give away the box step). The *Think:* prompt asks how much of it customers pay and how much the government.
- **Step 3 (drag the dot).** The dot starts at loaf 75 ($100) with "drag me" (no more glide). A pulsing halo on S1 at **loaf 42** ($56) says "put the dot here"; Next unlocks once the dot lands on or sweeps past it. The dot moves one loaf at a time, so costs can carry cents.
- **Hover isolation.** Pe and Qe are separate marks (`pe`, `qe`); the equilibrium point answers to both. A hovered term turns its dashed guides solid and bold. Marks may carry several space-separated keys.
- **"Think:" prompts** grow (on/off, +45%) while the pointer is within 220px of Next.
- **Layout (wide screens).** Explain puts the chart on the left at full height and the step card on the right filling the rest; the page title block is hidden. A **Replay** button in the chart header re-runs the current step's animation.
- **Animation first, then words (owner, 2026-11-11).** When a step animates, the headline stays, and the rest of the card text (description, think, readout, slider) stays hidden, with its space kept, until every finite animation in the chart has finished, then fades in. Replay never hides the text. Mechanism: `whenAnimationsDone(chart)` (`src/lib/animationSettle.js`) passed as `animationsDone` to `mountExplainCard`; steps with no animation show their text at once. Measured at 1440×800: step 2 ~0.9s, step 4 ~4.9s, revenue step ~8.4s.
- **Halo (step 3).** Drawn ±4 loaves around loaf 42; the gate is ±5 so the dot's body touching the ring counts.
- **Step 4 is student-triggered (owner, 2026-11-11).** The dot waits on S1 with a raised purple **Subsidise!** button (it stays still; a ring pings outward from it); the card adds no instruction (owner: the pulsing button is cue enough). The button fades in 1.3s after the step arrives so the purple catches the eye on its own. The arrow, labels and readout are held back and Next is locked until it's pressed (click, Enter or Space); pressing it plays the usual drop, then the text fades in. Arriving or replaying re-arms it. Mechanism: step field `trigger` + `gate`, page state `armed`, chart option `loafArmed`.
