# Indirect tax Explain: rebuilt around the UK sugar levy — design

Date: 2026-11-12. Status: **built 2026-11-12** (first build; see "As built" at the end for where it differs from the plan). Replaces the "Steps" part of `2026-11-09-indirect-tax-explain-and-play-design.md` (its Play decisions all stand). The owner chose the frame (the UK Soft Drinks Industry Levy), the currency (£/pence) and both new interactions (predict, wedge), and asked for elasticity and ad valorem to be the two ways out into Play. Everything else here is Claude's call and open to revision.

This is the first page run through `docs/success-criteria.md`. The spec self-check (Instrument A) is at the end; the student probes (Instrument C) are fixed here, before building, and must not change after.

## Why

The current tax Explain (12 steps, a generic "can of soft drink", `indirectTaxExplainSteps.js`) was ported before the subsidy walkthrough's pedagogy rework (`2026-11-09-subsidy-explain-pedagogy-design.md`). It has none of what made the subsidy one work: coloured terms tied to marks, the readout, a task that gates Next, *Think* prompts, timed in-step sequences, the strips → box build of the government's money, before/after per stakeholder. It also breaks the North Star the other way round: Play's tax lenses already draw marks Explain never introduces (arrows up from S1, the Pe note riding to e2, the tax arrow, the units-traded bracket, the tax-height bracket, strips merging into the box, the grey "Captured by the government / No longer traded" split). The rebuilt Explain introduces exactly that vocabulary so Play reads as the same explanation, compressed.

The owner wants this walkthrough to differ from the subsidy one in one way: a real, famous tax instead of a generic example (the subsidy's bakery).

## Where students get lost (owner confirmed, 2026-11-12)

- **C1. Why S moves up, and that "up" means supply has decreased ("left").**
- **C2. The price rises by the whole tax.** A 50¢ tax on a $1 item is assumed to make it $1.50 ([Econ Happy Hour](https://www.econhappyhour.com/p/why-is-it-tough-to-teach-students)).
- **C3. Whoever pays the government bears the tax** (legal vs economic incidence; [MRU](https://learn.mru.org/lessons/taxes-subsidies-definition-tax-wedge), [GSU EconPort](https://econport.gsu.edu/content/handbook/Elasticity/taxincidence.html), [econlearn](https://www.econlearn.org/glossary/tax-incidence)).
- **C4. Pp is read off S1, not S2.**
- **C5. The revenue box *is* the two burdens; deadweight loss is not revenue.**
- **C6. The elasticity rule is memorised, not seen** (the side that can escape the tax pays less; [MRU](https://mruniversity.com/courses/principles-economics-microeconomics/tax-burden-elasticity-affordable-care-act-health-insurance-mandate)).

## Teaching moves taken from the research

- **The wedge** (MRU): the tax is a fixed-height gap pushed between D and S until it fits; its top is the buyer's price, its bottom the seller's, read off the original S. Built as a drag task (step 9).
- **Predict, then reveal**, used once, aimed at C2 (step 8). Evidence for predict-observe-explain is promising but small, as the subsidy spec noted, so it isn't used everywhere.
- **Specific is parallel, ad valorem fans out** ([Save My Exams](https://savemyexams.co.uk/dp/economics/sl/22/revision-notes/2-microeconomics/2-7-role-of-government-in-microeconomics/2-7-2-government-intervention-indirect-taxes-and-subsidies/)): the levy's arrows are all the same height (step 5), so the VAT step (20) can show its arrows growing with price.
- No controlled studies on fixing tax-incidence misconceptions turned up; the design leans on the owner's classroom experience.

## The frame: the UK sugar levy

- **What it is:** the Soft Drinks Industry Levy, charged from April 2018 on drinks with 8g+ sugar per 100ml at **24p per litre** (18p for 5–8g). Paid to HMRC by producers and importers. Rates rose to 25.9p / 19.4p from 1 April 2025 and now rise each April ([gov.uk](https://www.gov.uk/government/publications/increasing-the-rates-of-the-soft-drinks-industry-levy)). Further changes (4.5g threshold, bottled milkshakes) are planned for 2028.
- **Explain uses the launch rate, 24p per litre, on a full-sugar drink** ("In April 2018 the UK put a tax on sugary drinks: 24p on every litre"). Round, real, and the moment the tax starts is the moment the diagram shows. Only the top band is modelled; the 18p band isn't mentioned.
- **Unit: one litre.** The levy is legally per litre, and against a pre-levy price of 80p a litre it is a visible wedge (30%, similar to today's $20 on $80). Quantity axis: millions of litres.
- **The curves are illustrative, and the page says so.** Only the 24p levy and the 20% VAT are real. Step 2 says it in one line ("The prices and amounts here are made up to keep things simple. The 24p is real."), and copy never calls the model's prices, quantities or revenue the UK's. No "per week": the quantity is just millions of litres, so the revenue figure can't be mistaken for the real levy's take.
- **Reformulation is out of scope.** In reality most makers cut sugar to escape the levy. That's a change in the product, not a move along these curves, so the walkthrough follows a drink that keeps its sugar and does not mention reformulation. No brand names.
- **Real-world check (step 19):** studies found only part of the levy reached shelf prices: about 31% for high-levy drinks ([Oxford / PLOS Medicine, Scarborough et al. 2020](https://www.ndph.ox.ac.uk/publications/1081057)), around half for branded drinks ([Action on Sugar](https://www.actiononsugar.org/news-centre/sugar-in-the-news/2020/2020-stories/sugar-levels-in-uk-soft-drinks-lowered-following-government-levy.html)). **Verified while building (2026-11-12):** the paper's abstract gives £0.075 a litre, "a 31% pass through rate", for high-levy drinks (via its indexed abstract; the full text was blocked), an independent expert quoted it as "only one-third of the cost of the levy was passed on to consumers for high sugar drinks" ([NutritionInsight](https://www.nutritioninsight.com/news/sugar-tax-analysis-soft-drinks-levy-does-reduce-consumption-while-prompting-speedy-reformulation.html)), and the authors' unit summarises it as "for branded drinks, around half of the levy was passed onto consumers in higher prices" ([MRC Epidemiology Unit](https://www.epi.ims.cam.ac.uk/blog/2020/02/11/sugar-uk-soft-drinks-lowered-levy/)). Step 19 says "about a third to a half"; probe 8 keeps its main form.
- **Ad valorem (step 20):** soft drinks are standard-rated for VAT at 20% ([HMRC VFOOD7520](https://www.gov.uk/hmrc-internal-manuals/vat-food/vfood7520)), separate from the levy. In the model the VAT is 20% on top of the price the maker gets (Pc = 1.2 × Pp), which is how VAT is charged.

### Numbers at the defaults (Explain's market, 24p levy)

Free market: Pe 80p, Qe 60 (million litres). With the levy: Pc 92p, Pp 68p, Q<sub>tax</sub> 51; consumer burden 12p + producer burden 12p = 24p; revenue £12.24m; CS and PS £17.34m each; DWL £1.08m. With 20% VAT instead (step 20): Pc 87.3p, Pp 72.7p, Q 54.5. Explain's levy slider runs 0–40p and must keep the market open in every Explain market (default, elastic, VAT).

## The steps (20)

Rules for every step:
- From step 2, the readout lists the step's values, and every number in the card is a coloured term (`t(key, …)`) matching its mark, hover-linked, as in the subsidy.
- Curves are labelled "S1 = what it costs to make" and "S2 = cost + levy" until step 9, then plain S1/S2.
- A step introduces at most three marks the student hasn't seen before. Marks the student already knows may re-enter, in order, as a timed sequence (steps 14 and 16 replay the levy's arrival this way).
- A term is explained in plain words the first time it's used: "burden" (12), "consumer/producer surplus" (13/15), "deadweight loss" (17), "elastic" (19), "ad valorem" (20).
- The card never tells the student what a task will show before they do it; the conclusion appears after.

1. **Demand.** Litres of sugary drink people want to buy at each price. Marks: D.
2. **Supply: what it costs to make.** S1; where it meets demand: Pe 80p, Qe 60m litres. The "made up except the 24p" line. Marks: S1, e<sub>1</sub>, Pe/Qe; readout.
3. **Every point on S1 is one litre.** The subsidy's drag-the-dot task on S1 (halo target, Next locked until reached). Before: "The dot is litre number 45 million. Drag it along S1." After reaching the halo: "The more litres they make, the more the next one costs." Marks: dot with guides and axis tags, halo.
4. **The levy: 24p on every litre.** "In April 2018 the UK put a tax on sugary drinks: 24p on every litre. The drinks company pays it to the government." From the litre the student left the dot on, a purple arrow rises 24p: to keep what they had, the maker now needs its cost plus 24p. Slider appears. Marks: the arrow and its "24p levy" chip.
5. **The same 24p at every litre.** Arrows rise from every point on S1 and S2 fades in through their tips. All the same height: S2 is parallel. Marks: arrows up, S2.
6. **Up by 24p is the same as left.** A horizontal arrow at 80p from S1 to S2: at that price, fewer litres are offered. Supply has decreased. *Think:* where will S2 cross demand? Marks: the leftward arrow.
7. **A new equilibrium.** e<sub>2</sub> appears where S2 meets D, with Q<sub>tax</sub> (51m) on the axis: fewer litres are sold. The Pe note ("Pe 80p") stays on e<sub>1</sub>; no new price yet, and the readout shows only Qe and Q<sub>tax</sub>. Marks: e<sub>2</sub>, Q<sub>tax</sub>.
8. **Predict: will the price rise by the whole 24p?** Buttons: *All 24p* / *Some of it* / *None of it*; Next locked until one is picked. Then the reveal, in order: the Pe note rides from e<sub>1</sub> up to e<sub>2</sub>, counting 80p → 92p (Play's riding note), and becomes Pc with its line to the axis; a dashed line appears at 104p ("if all 24p were passed on"); a bracket between 92p and 104p reads "12p not passed on". The card answers the choice ("Some of it: shoppers pay 12p more, not 24p"), with no scoring. Re-entering keeps the choice. Marks: Pc line and symbol, the dashed "all 24p" line, the bracket.
9. **One litre, two prices: the wedge.** S2 and e<sub>2</sub> ghost back. A purple bar exactly 24p tall hangs from D, starting left of Q<sub>tax</sub> (where D − S1 > 24p, so its foot hangs above S1). The student drags it along D (pointer, touch, arrow keys); its foot shows the gap to S1. At Q<sub>tax</sub> it lands on S1 (snaps within a tolerance) and the foot lights up. Next locked until it fits. On landing: S2 and e<sub>2</sub> brighten right above it ("S2 was a way of finding this spot"), and the foot's line gives Pp ("the maker keeps 68p", read off S1). The bar stays as the tax arrow from Pc down to Pp. Marks: the wedge (becomes the tax arrow), Pp line and symbol.
10. **24p on every litre sold.** One strip per litre up to Q<sub>tax</sub> ("1 litre = 24p"), the units-traded bracket under the axis ("51m litres sold") and the 24p height bracket left of the price axis. Marks: strips, quantity bracket, height bracket.
11. **The box is tax revenue.** The strips merge into one box (the `stripsMerged` hand-over): 24p × 51m = £12.24m. Task (subsidy-style sweep, gated): slide the levy down to 0p and back up to 40p; the box shrinks to nothing and grows again. After: "No tax, no revenue: the box is the tax times the litres sold." Next returns the slider to 24p, so the numbers in later steps match the frame. Marks: the box and its revenue chip.
12. **Who really pays the box?** The box splits at Pe: shoppers' part above (Pe → Pc, 12p a litre), the maker's below (Pp → Pe, 12p a litre); 12p + 12p = 24p. "A burden is the part of the tax someone really pays. The drinks company sends the government all 24p, but shoppers pay 12p of it through the higher price." Burden colours, `--burden-consumer`/`--burden-producer`. Marks: the two burden bands.
13. **Consumer surplus before the levy.** Free market (no levy, no slider): "Consumer surplus is what buyers would have paid but didn't have to." The plain CS triangle, named. Marks: CS triangle.
14. **The levy shrinks consumer surplus.** The levy arrives again in order (arrows up, S2, e<sub>2</sub>, Pc line), then the part of the triangle lost turns grey, splits at Q<sub>tax</sub> and each half is named: "Captured by the government" (becomes the consumer burden) and "No longer traded" (becomes its half of the deadweight loss). The consumer lens's `lost`/`lostNote` rendering. Marks: grey lost area, the two notes.
15. **Producer surplus before the levy.** "Producer surplus is what sellers get above what it cost them." Marks: PS triangle.
16. **The levy shrinks producer surplus.** Mirror of 14, notes below Pe. Marks: as 14, for producers.
17. **The corner nobody gets: deadweight loss.** The two "no longer traded" halves join into one triangle. "These litres were worth more to drinkers than they cost to make, but with the levy they aren't sold. Nobody gets that value: it's the deadweight loss." Sum, in the readout to the penny: surplus lost = revenue + DWL. Marks: DWL triangle.
18. **The full diagram.** The IB exam diagram (CS, PS, both burdens, DWL, all symbols); "This is what you draw in the exam." Marks: none new.
19. **Elasticity decides who pays.** Still the full diagram. "Drinkers can easily switch to diet versions or water." Demand tweens flatter (more elastic at e<sub>1</sub>, pivoting through it); the shoppers' band shrinks and the maker's grows (target ≈ 8p and 16p of 24p). Real-world line, if verified. Button **"Try elasticity in Play →"**: Play with the tax on; Next continues to 20.
20. **A percentage tax: VAT.** "Sugary drinks also pay 20% VAT. To compare, take the levy off and put VAT on instead." Default curves. Arrows rise from S1 again, each 20% of the cost at that point, taller where the cost is higher, and S2 fans out instead of moving in parallel. "A tax that's a percentage of the price is called ad valorem." It ends as the full exam diagram for an ad valorem tax (Pc 87.3p, Pp 72.7p, both burdens, DWL). Last step; button **"Try ad valorem in Play →"**: Play with ad valorem selected at 20%.

## Chain table

What a student could say at each step. Read in order, it's an exam answer.

| Step | Sentence |
|---|---|
| 1 | Demand shows how many litres people buy at each price. |
| 2 | Supply shows what each extra litre costs to make, and the market settles at 80p and 60m litres. |
| 3 | Every point on S1 is one litre and what it costs to make. |
| 4 | The levy adds 24p to what the maker needs for each litre. |
| 5 | It adds 24p at every quantity, so the supply curve moves up by 24p, parallel. |
| 6 | Up by 24p means fewer litres offered at every price: supply has decreased. |
| 7 | The new equilibrium is where S2 meets demand, so fewer litres are sold. |
| 8 | The price rises to 92p: only 12p of the 24p reaches shoppers. |
| 9 | The 24p sits between what shoppers pay and what the maker keeps, 68p, read off S1. |
| 10 | The government gets 24p on each of the 51m litres sold. |
| 11 | So tax revenue is 24p × 51m litres, the box. |
| 12 | Shoppers pay 12p a litre of the tax and the maker 12p, and those two parts make up the box. |
| 13 | Before the levy, consumer surplus is the triangle under demand and above 80p. |
| 14 | The levy takes part of it: some goes to the government, some is no longer traded. |
| 15 | Before the levy, producer surplus is the triangle above supply and below 80p. |
| 16 | The levy takes part of it in the same two ways. |
| 17 | The litres no longer traded are a loss nobody gets: deadweight loss. |
| 18 | Together: the exam diagram for a specific tax. |
| 19 | The more easily buyers can switch away, the less of the tax they pay. |
| 20 | A percentage tax rises with the price, so S2 fans out from S1. |

## Mark inventory

| Mark | First appears | Its cause (shown earlier) | Named on screen as |
|---|---|---|---|
| D | 1 | — | D |
| S1, e<sub>1</sub>, Pe, Qe | 2 | — | S1 = what it costs to make; e<sub>1</sub>; Pe; Qe |
| Dot on S1 | 3 | S1 | litre number, cost tags |
| Single 24p arrow | 4 | the levy (text) | "24p levy" |
| Arrows up at every litre, S2 | 5 | step 4's arrow | S2 = cost + levy |
| Leftward arrow | 6 | S2 | "fewer litres at 80p" |
| e<sub>2</sub>, Q<sub>tax</sub> | 7 | S2 meets D | e<sub>2</sub>; Q<sub>tax</sub> |
| Pc line, riding note | 8 | e<sub>2</sub> | Pc |
| Dashed "all 24p" line, gap bracket | 8 | Pe + levy | "if all 24p were passed on"; "12p not passed on" |
| Wedge → tax arrow, Pp line | 9 | Pc, S1 | "24p levy"; Pp |
| Strips, quantity bracket, height bracket | 10 | tax arrow, Q<sub>tax</sub> | "1 litre = 24p"; "51m litres sold"; "24p levy" |
| Revenue box | 11 | strips | tax revenue |
| Burden bands | 12 | box, Pe | consumer burden; producer burden |
| CS / PS triangles | 13 / 15 | D, S1, Pe | consumer surplus; producer surplus |
| Grey lost areas, notes | 14 / 16 | levy's arrival | "Captured by the government"; "No longer traded" |
| DWL triangle | 17 | the two "no longer traded" halves | deadweight loss |
| Flatter D | 19 | "drinkers can switch" | D (more elastic) |
| VAT arrows, fanned S2 | 20 | "20% VAT" | S2 = cost + 20% VAT |

## Interactions and what each one earns

| Task | Step | Insight it produces | Gated? |
|---|---|---|---|
| Drag the dot along S1 | 3 | A point on S1 is a quantity and the cost of the last unit; costs rise along S1. | Yes (halo) |
| Predict the price rise | 8 | Commits the student before seeing the price rises by less than the tax (C2). | Yes (a choice) |
| Fit the wedge | 9 | The 24p gap only fits at Q<sub>tax</sub>; its foot on S1 gives Pp (C4); the S2 shift and the wedge are the same thing. | Yes (fit) |
| Sweep the levy 0 → 40p | 11 | Revenue is tax × quantity: no tax, no box. | Yes (sweep) |
| Levy slider (steps 4–17) | — | Every mark moves together with the tax. | No |
| Exits into Play | 19, 20 | Try other elasticities / an ad valorem rate. | — |

## Confusions met

| Confusion | Step(s) |
|---|---|
| C1 up = left = supply decreased | 4, 5, 6 |
| C2 price rises by the whole tax | 8 (predict) |
| C3 who pays the government bears it | 4, 12 |
| C4 Pp read off S1 | 9 (wedge) |
| C5 box = burdens; DWL ≠ revenue | 11, 12, 14, 16, 17 |
| C6 elasticity rule | 19, then Play |

## Student probes (Instrument C; fixed 2026-11-12, do not edit after building starts)

| # | Kind | Probe | Expected answer | Where it should become visible |
|---|---|---|---|---|
| 1 | Identify | (Pointing at the purple rectangle on the exam diagram) What does this show, and why is it that size? | Tax revenue: 24p a litre × the 51m litres sold. | 10, 11 |
| 2 | Explain | Why is S2 24p above S1 at every quantity? | The maker needs its cost plus the 24p it pays the government, for every litre. | 4, 5 |
| 3 | Read | The drinks company pays the government all 24p. How much of it do shoppers really pay per litre, and how much does the maker? | Shoppers 12p (80p → 92p), the maker 12p (80p → 68p). | 8, 9, 12 |
| 4 | Calculate | If the levy were 30p, what would the government collect? | 30p × the new quantity, read from the readout at 30p (the box). | 11 (slider) |
| 5 | Predict | If shoppers could easily switch to diet drinks, who would pay more of the levy? | The maker; buyers' share falls as demand becomes more elastic. | 19, Play |
| 6 | Predict | With a 20% tax instead of 24p, is the gap between S1 and S2 bigger at high or low quantities? | Bigger at high quantities (higher cost, bigger 20%). | 20 |
| 7 | Evaluate | Who is worse off because of the levy, and where on the diagram do you see each loss? | Consumers (lost CS: their burden + their half of DWL), producers (lost PS: their burden + their half of DWL); the government gains the box; society loses the DWL triangle. | 13–17 |
| 8 | Apply | UK studies found only part of the levy showed up in shop prices. What does the diagram suggest about demand for sugary drinks? *(If the figure can't be verified: "Why might a drinks maker not raise its price by the full 24p?")* | Demand is fairly elastic (people can switch), so producers carry much of the tax. | 19 (8 for the fallback) |

## Play consistency

Explain introduces every mark Play's tax chains use: arrows up from S1 with S2 (5), the Pe note riding to e<sub>2</sub> (8), the tax arrow Pc → Pp (9), strips, the quantity bracket and the height bracket (10), strips merging into the box (11), burden bands (12), the grey split with "Captured by the government" / "No longer traded" (14, 16), the halves joining into one DWL triangle (17). Explain-only marks (the dot, the dashed "all 24p" line and its bracket, the wedge's drag state, the leftward arrow) aren't needed in Play. Known difference: Play's market is generic ($, "units"), Explain's is pence and litres (see Open).

## Mechanism (how it gets built)

- **Shared Explain runtime.** The drag-the-dot task, the halo/gate logic, the slider sweep (`advanceSweep`) and the trigger/armed state currently live in `subsidy.js` / `subsidyExplainSteps.js`. They move to `src/lib/explainRuntime.js` (or a new `explainTasks.js`) with generic names, and both pages use them. Subsidy behaviour must not change; its tests are the guard.
- **New: predict.** Step field `predict: { options, reveal(choice, ctx) }`; the card renders the buttons and gates on a choice; page state holds the choice for the visit (no storage). The riding note reuses Play's `eq2Note` behaviour.
- **New: wedge.** A chart layer `wedgeDrag` (bar, foot gap, fit glow), pointer/touch/keyboard handling like the dot's, and a pure helper `wedgeFit(q, result, amount)` for "landed" (tested). Gate on fit.
- **New: leftward arrow** (step 6) as a layer.
- **Elastic demand.** `EXPLAIN_DEMAND` gains an `elastic` position, tuned so the consumer share is about a third (≈ +0.3; +0.5 gives 24%), and checked with `pointElasticities()` to really be elastic at e<sub>1</sub>. `fitsEveryExplainMarket` then checks it too, which may lower the subsidy Explain slider's ceiling; if it does, scope the check per page.
- **Ad valorem in Explain.** Step field `tax: 'advalorem'` with rate 0.2; the arrows-up layer sized per point.
- **Two exits to Play.** The card gains a per-step `playLink` (label + Play state) besides `finish`. Play's URL/state must open with the tax on, and with ad valorem at a given rate; add that to `pageMode.js` if it isn't there.
- **Pence formatting.** `fmtPence` in `format.js`: under £1 "80p", from £1 "£1.04", totals "£12.24m", two decimals where a sum must add up. Explain only.
- **Steps file** rewritten (`indirectTaxExplainSteps.js`, `TAX_STEPS`); the old 12-step copy goes in its own commit after a checkpoint (removal convention).
- **Docs.** On build, update CLAUDE.md's Indirect tax Explain summary and this spec's status.

## Risks (known failure modes most likely here)

- **Prose unchecked against the diagram** (main spec failure mode 6): every sentence with a price or quantity is generated from the live result, never typed in.
- **Line labelled as an area** (7): the burdens are the bands, not the Pc/Pp lines.
- **Degenerate tax** (5): the 0–40p slider must keep every Explain market open, including the elastic one and VAT.
- **Elasticity in words** (1): "more elastic" in step 19 must be true point elasticity at e<sub>1</sub>.
- **A computed number leaking into a lens or level that shouldn't show it** (CLAUDE.md, the subsidy chip): Explain-only labels stay on Explain layers.
- **Phone width:** the wedge and the dot need touch targets that work at 390px, and the card must not cover the marks a step names.
- **Too much at once:** steps 8, 9 and 14 are the busiest; their sequences must stay one mark at a time.

## Spec self-check (Instrument A, run by Claude, 2026-11-12)

| Item | Result | Note |
|---|---|---|
| A1 Confusions named | Pass | C1–C6, owner confirmed, with sources. |
| A2 Chain table | Pass | 20 sentences; read in order they make an exam answer. |
| A3 Mark inventory | Pass | Every mark after its cause. Fixed while checking: the riding note no longer gives away Pc before the prediction (it now moves in step 8, not 7). |
| A4 Interactions earn their place | Pass | Four gated tasks, each producing its insight. Fixed while checking: step 3's conclusion now appears after the drag, not before. |
| A5 Confusions met | Pass | Every confusion mapped. |
| A6 Exam landing and exits | Pass | Steps 18–20 are all full exam diagrams (specific, then elastic, then ad valorem); two exits, each with its question. |
| A7 Real-world frame | Pass | Sourced; pass-through figures flagged for verification with a fallback; illustrative numbers said to be made up; reformulation left out on purpose. |
| A8 Probes written | Pass | 8 probes, all seven kinds. |
| A9 Play consistency | Pass, with one known difference | Play's $ market vs Explain's pence (Open). |
| A10 Risks named | Pass | See Risks. |

## Open

- **Play stays in $.** Explain is in pence; Play keeps its generic $ market, so "Try it in Play" lands on different numbers. Claude's call to keep the change small; the owner may want Play in pence too.
- The 2020 pass-through figures (step 19, probe 8) need verifying while building.
- Copy is a working draft, as with every Explain; the review and the owner check it on screen.

## As built (2026-11-12)

Where the build differs from the plan above, and why:

- **Predict's locked label** is "Guess first" (the longer label wrapped onto three lines).
- **The price note** sits higher above the point than Play's (clear of the e1/e2 labels and S2).
- **Step 20's arrows** leave once S2 has fanned out, so the step ends on the exam diagram itself; Replay plays them again.
- **The grey's names** are "Captured by the government (tax revenue)" and "No longer traded" (Play's lens says "No longer traded: deadweight loss"; here the term waits for step 17, where it is explained). On a phone-width plot they shorten to "To the government" / "Not traded".
- **Readouts arrive last** in every sequenced step, after the marks whose numbers they give.
- **Shared code:** `src/lib/explainTasks.js` (drag wiring, halo reach, slider sweep, coloured-word highlighting) is used by both pages; `explainCard.js` gained `predict`, `playLink`, `finishLabel`, `waitFor` and a function `slider`; `explainRuntime.js` gained the `elastic` curve, per-page market lists and `enterAfter`; `marketChart.js` gained the tax teaching layers (`shiftLeft`, `rideNote`, `passFull`, `passGap`, `wedgeDrag`, `csLost`, `psLost`, the levy lift on `loafDrop`), `axisLabels` and `<key>Narrow` captions.

### After the first review (2026-11-12, `docs/reviews/indirect-tax-2026-11-12.md`)

Fixed: the revenue step's height × width now multiplies out at every levy (widths shown exactly, e.g. 48.75m); curve names step around the readout, and S1/S2 are plain from step 7 (long names only on steps 2-6); the riding price is "Pe" only on e1, bare while it rides, "Pc" once it lands, in ink until then; Q<sub>tax</sub> is full size on a phone (a word-subscript symbol only needs Qe's half-width of room); steps 19 and 20 have readouts; Play's Government perspective note says Pe / Pc, not Pe1 / Pe2, and step 12 introduces "CB" / "PB" for Play's chips; step 14/16 readouts wait for the grey; step 19's words wait for its curve; burden names fade in rather than wipe; labels moved off e1 and the arrows; hover links fixed (S2 and what it offers are `need`, the litres sold are the government's purple, the 9m lost litres are DWL's); step 9 says why the wedge only fits where it does, both ways ("to spare" / "short of S1"); a visible "Levy per litre: 24p" above the slider; keyboard focus goes to Next once the wedge fits; step 2 names the equilibrium; step 18 ties CS / PS / DWL to their names; step 19 links its source and says "That fits what happened"; Play entered from Explain skips the first-visit tour; the words on steps 14, 16 and 20 come in once the step's key mark is in, while the rest finishes.

Left for the owner (decisions, not bugs):
- **The consumer burden is the same violet as the levy and the revenue box** (`--burden-consumer` = `--gov`, `#7c3aed`): the owner's pick on 2026-11-09 (option B). The review's point: "shoppers pay 12p" and "the 24p levy" are the same colour, so the box can read as "the government's half + the producer's half".
- **Pc / Pp dashed lines run on past Q<sub>tax</sub> to the chart's edge** once the box is drawn (the engine's convention on every tax/subsidy view); the review says exam diagrams stop them at the curves.
- **e<sub>2</sub>'s height can be read off the grid before the guess** (step 7-8). Kept: the guess is about "all, some or none", and checking it against the grid is fine.
- **Headline caps** render "e2" as "E2" and "24p" as "24P" (the display face is caps-only).
- Out of this page's scope, seen by the reviewer in Play: a slider press doesn't cancel the Societal chain; the tax page has no "Only part of the diagram" strip; the consumer/producer lenses label their half of the DWL.

### After the second review (2026-11-13, `docs/reviews/indirect-tax-2026-11-13.md`)

Fixed: step 20's VAT row is the difference of the two rounded prices (87.3p − 14.6p = 72.7p); step 6 uses plain S1/S2 (only steps 2-5 carry the long names); a word-subscript symbol (Q<sub>tax</sub>) never drops below 13px: too close to Qe, it drops a row under it instead; the tax's arrow at Qe is left out (it ran through e1's label); the one litre's levy label sits left of its arrow and "needs …" lifts off the Pe line; a wedge pushed past Q<sub>tax</sub> labels its shortfall away from demand; DWL is named on step 17 (and introduced as "DWL" there); step 11 at 0p says there's no box; step 17's lost litres are exact (11.25m at 30p); step 5 says S1 is now drawn dashed as the original supply curve; phone captions for step 6's arrow and step 9's prices; the words on steps 14 and 16 come in once the new price line is drawn (about 5s); coming back to Explain after an exit resumes at the step left from, and the ad valorem exit resets Play's curves; Play's riding note is a bare price until it lands as Pc.

Still open (minor): area names (PS, the grey's long name) can sit across S2 on the exam diagram and step 14; e<sub>2</sub>'s label can hide under e<sub>1</sub>'s on a phone at step 20; the DWL is too small to name on step 20's VAT diagram; Play's revenue chip says "Revenue", where Explain says "Tax revenue".
