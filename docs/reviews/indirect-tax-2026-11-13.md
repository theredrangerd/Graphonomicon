# Review: indirect-tax.html, Explain (2026-11-13)
Spec: `docs/superpowers/specs/2026-11-12-indirect-tax-explain-sugar-levy-design.md`   Reviewer: graph-reviewer   Verdict: **Rework** (by the rubric: one blocker. It is a one-line rounding fix on step 20's readout; every other finding has a clear fix.)

Re-review after the fixes in the spec's "After the first review" section. Scope: the Explain walkthrough (`#explain`), all 20 steps, at 1280×800 and at 390×844 (touch). Play was checked only for Explain's two exits and for whether Play's chains reuse Explain's marks (P10).

Screens: `docs/reviews/screens/indirect-tax-2026-11-13/` (shortened to `screens/` below).

Test conditions: the Vite dev server restarted on its own twice during the run, which reloaded the page. So every step was captured from a fresh load, reached through its step dot, and each task was run on its own load. Gates were tested in full: the dot, guess, wedge and sweep tasks, by pointer, keyboard and touch.

## Summary
Yes, mostly. This is a clearly better page than the one reviewed yesterday. The chain reads correctly from start to finish:
- S2 sits 24p up, which also means it moves left.
- The student guesses, then the price rides up to 92p, shown as a bare price while it moves.
- The wedge now explains both ways why it only fits at Q<sub>tax</sub> ("69.3p to spare" / "56p short of S1").
- The revenue sum works out at every levy.
- The box splits into two burdens, and the surplus losses add up to revenue plus DWL.

15 of the 22 earlier findings are fixed (counting #19's equilibrium part), and the owner has kept 3 more as decisions.

Three problems are left:
1. **Step 20's readout doesn't add up.** It shows "Shoppers pay 87.3p / VAT 14.5p / Maker keeps 72.7p", but 87.3 − 14.5 = 72.8. This is the same kind of rounding slip as last time's blocker, and it's on the last diagram of the walkthrough.
2. **On step 6, the "S1 = what it costs to make" label sits on the S2 line.** This is the step whose point is that S2 is above and to the left of S1.
3. **On a phone, step 20's Q<sub>tax</sub> shrinks to 7px.** That step is the final exam diagram.

The rest is polish: label collisions, two long waits for the card's words, and a few loose ends in the exits.

## Findings
| # | Severity | Principle | Where | Finding | Evidence | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | Blocker | P4 | Step 20, readout | The VAT readout is laid out like step 9's subtraction ("Shoppers pay (Pc) / VAT, 20% of Pp / Maker keeps (Pp)"), but its rows don't add up: 87.3p − 14.5p = 72.8p, not the 72.7p shown. Each row is rounded on its own (Pc 87.27, VAT 14.545, Pp 72.73). This happens at the only VAT values the page shows, and the slider is off on this step. | `screens/step20-final-diagram.png` (readout: 87.3p / 14.5p / 72.7p) | Work out the VAT row from the rounded prices (Pc − Pp = 14.6p), the way `shares()` already does for the burdens. Or show all three to 2 dp, also worked out by subtraction. Add a test that the three rows add up. |
| 2 | Major | P1 | Step 6 (1280px) | The long label "S1 = what it costs to make" is drawn at chart (588–756, 98–122), straight over the solid S2 line and touching the "S2 = cost + levy" label above it. The dashed S1 line is about 60px lower. A student who reads only the screen names the solid line S1, on the very step whose card says "S2 is above S1, and it's also to the left of it". This is the same failure as earlier finding 2, now on a step the fix didn't cover. | `screens/step06-s1-label-on-s2.png`, `screens/step06-s1-label-zoom.png` | Anchor each curve label to its own line's end (S1 ends lower right, as on steps 7+), or use plain S1/S2 from step 6 as steps 7+ already do. |
| 3 | Major | P12, P1, P6 | Step 20 at 390px | On the last diagram of the walkthrough, Q<sub>tax</sub> is drawn at **7.27px** (Qe is 16px). The e<sub>2</sub> label is hidden under e<sub>1</sub>'s, and the burden bands are too thin to carry a name. On steps 7–19 Q<sub>tax</sub> is 14–16px, so earlier finding 5 is fixed everywhere except here: the VAT gap (Q 54.5 vs 60) is narrower than the levy's. | `screens/phone-step20-qtax-7px.png`. Measured at 16s: `Qtax fs=7.27px op=0.91`, `Qe fs=16px` | Apply the step-7 fix (a floor of about 13px, then stack Q<sub>tax</sub> under Qe when they would touch) to every gap size, not only the levy's. Give e<sub>1</sub>/e<sub>2</sub> labels the same collision rule. |
| 4 | Minor | P1, P6 | Steps 17 and 20 | The DWL triangle has no label on the chart at step 17, where it is introduced (only the card and readout name it), or on step 20's final ad valorem diagram. The spec says that diagram ends with "both burdens, DWL". Steps 18–19 do label it "DWL". | `screens/step17-dwl.png`, `screens/step20-final-diagram.png` | Label small areas with a leader line, as the lost-surplus notes already are. |
| 5 | Minor | P1 | Step 5 | The levy arrow at Q = 60 runs up through the e<sub>1</sub> label, between the "e" and the "1". | `screens/step05-e1-cut-by-arrow.png` | Skip the arrow at Qe, or move e<sub>1</sub>'s label left on this step. |
| 6 | Minor | P1 | Steps 4–5, on the path a student takes (dot left at 42m) | "needs 80p" sits exactly on the Pe guide line, which strikes through it. "+ 24p levy" touches S1. | `screens/step04-05-student-path.png` | Run the teaching labels through the same collision check as the curve labels, including the guide lines. |
| 7 | Minor | P1 | Step 9, before the fit | With the wedge right of Q<sub>tax</sub>, "56p short of S1" lies across the demand line next to e<sub>1</sub>, and the demand line crosses "24p levy". | `screens/step09-wedge-short-of-s1.png` | Put the gap chip on the side of the bar away from demand. |
| 8 | Minor | P1 | Steps 18–19 (exam diagram), step 14 | The S2 line runs through the "PS" area name on steps 18–19. On step 14, S2 crosses "(tax revenue)" in "Captured by the government (tax revenue)". | `screens/step18-exam-diagram.png`, `screens/step19-elastic.png`, `screens/step14-late-sheet.png` | Keep area names off curves; move PS down-left into the open triangle. |
| 9 | Minor | P12 | Steps 6 and 9 at 390px | On a phone, "fewer litres at 80p" sits over S2 and e<sub>1</sub> (step 6). On step 9 after the fit, "shoppers pay 92p" covers e<sub>2</sub>'s label and "the maker keeps 68p" runs under the bar, at the key moment of C4. | `screens/phone-steps-6-9-14-20.png`, `screens/phone-step09-touch-fit.png` | Use the narrow captions (as step 14 does) and stack price labels left of the axis on a narrow plot. |
| 10 | Minor | P2 (pace) | Steps 14 and 16 | The card's words still wait about 9.5s (step 14: hidden at 9.1s, shown at 9.6s); the halves then take their colours about 1.5s later. Step 20 is now 6.2s and step 10 7.3s. | `screens/step14-late-sheet.png`; card-waiting timeline for step 14: hidden until 9.1s | Show the first sentence when the levy has arrived (S2/e<sub>2</sub>), and the rest when the grey is named. |
| 11 | Minor | P7 | Exits | (a) After "Try elasticity in Play →", going back to Explain restarts it at **Step 1 of 20**. Nothing takes the student back to step 20 (VAT), which the spec says "Next continues to". (b) If they then reach step 20 and press "Try ad valorem in Play →", Play keeps the elastic demand from the first exit: Pc $84.71 / Pp $70.59 instead of the $87.27 / $72.73 that matches the diagram they just finished. From a fresh load it does land at $87.27 / $72.73. | Log: "back in explain at Step 1 of 20"; `screens/play-exit-advalorem-after-elastic-exit.png` vs `screens/play-exit-advalorem.png` | Return to the step the student left from. Have the ad valorem exit reset the curve sliders to their defaults. |
| 12 | Minor | P10 | Play, Government perspective chain | The riding note is called "Pc" while it is still moving ("Pc $87.97: the price buyers pay" mid-tween). Explain shows a bare price until it lands, on purpose. The box chip says "Revenue $1,050" (Explain: "Tax revenue"), and the strips say "1 unit = $20" (Explain: "1m litres × 24p"). | `screens/play-gov-riding-note.png`; label log at 2.0s: "Pc $88.22: the price buyers pay" | Use Explain's names and its bare-price-while-riding rule in Play. |
| 13 | Minor | P4 | Step 11 at 0p; step 17 at other levies | At 0p the card reads "Height 0p a litre × width 60m litres = £0.00m. That's exactly what the government collects, which is why this box is always the tax revenue", with no box on the chart. At 30p, step 17 says "These 11.3m litres", while ½ × 30p × 11.3m gives £1.70m, not the £1.69m shown (the true width is 11.25m). | `screens/step11-zero.png`; step 17 at 30p: "11.3m litres … deadweight loss, £1.69m" | Give 0p its own sentence ("No levy, no revenue"). Show the lost litres exactly, as step 11 now does (11.25m). |
| 14 | Minor | P1 | Steps 5–17 | From step 5, S1 turns pale and dashed, which reads as "the old line, gone". Yet the card says "S1 stays where it was", and step 9 asks the student to read Pp off it. Nothing on screen says what the dashing means. | `screens/step09-after.png` (S1 faint dashed under the wedge's foot) | Keep S1 solid (with S2 solid too, as an exam diagram draws them), or say once on step 5 that the dashed line is the original supply curve. |

Counts: 1 blocker, 2 major, 11 minor.

## Probes
| Probe | Pass/Fail | Where the answer is visible | Answer as read from the page |
|---|---|---|---|
| 1 Identify (the purple rectangle) | Pass | Step 10 (strips "1m litres × 24p" out to the "51m litres sold" bracket), step 11 (box "Tax revenue £12.24m"), step 18 ("the two burdens (together, the tax revenue)"). | Tax revenue: 24p a litre × 51m litres sold = £12.24m. |
| 2 Explain (why S2 is 24p above S1) | Pass | Step 4 ("56p to make", "+ 24p levy", "needs 80p"), step 5 (equal arrows at every litre, S2 through their tips; "24p above S1 everywhere"). | The maker needs its cost plus the 24p it pays the government, for every litre. |
| 3 Read (per-litre burdens) | Pass | Step 8 ("Pc = 92p … only 12p more"), step 9 ("Pp = 68p", on S1), step 12 (bands and readout 12p / 12p / 24p). | Shoppers 12p (80p → 92p); the maker 12p (80p → 68p). |
| 4 Calculate (levy 30p) | Pass | Step 11, slider at 30p: card "Height 30p a litre × width 48.75m litres = £14.63m", readout the same, box drawn. | £14.63m (30p × 48.75m = £14.625m). Earlier finding 1 is fixed. |
| 5 Predict (diet-drink switching) | Pass | Step 19: demand tweens flatter; readout "Shoppers pay (CB) 8p / Company pays (PB) 16p"; "Try elasticity in Play →" lands with "2.00 · elastic", the tax on and burdens $334 / $666 (1/3 : 2/3). | The maker pays more; shoppers' share falls when they can switch. |
| 6 Predict (20% tax: gap at high or low Q) | Pass | Step 20: arrows grow with cost ("the arrows get longer as the cost rises") and S2 fans out (`screens/step20-sequence-sheet.png`). | Bigger at high quantities, where cost (and 20% of it) is higher. |
| 7 Evaluate (who loses, where) | Pass | Steps 13–17: CS and PS triangles; the grey lost parts named "Captured by the government (tax revenue)" / "No longer traded", then coloured as burden and DWL; step 17's readout "Surplus lost £13.32m = tax revenue £12.24m + deadweight loss £1.08m". | Consumers lose CS (their burden + their half of the DWL), producers lose PS (likewise), the government gains the box, and the DWL triangle goes to nobody. |
| 8 Apply (UK pass-through) | Pass | Step 19: "That fits what happened: when the UK levy started, studies found (linked) only about a third to a half of it showed up in shop prices", next to the elastic diagram where shoppers pay 8p of 24p. | Demand is fairly elastic (drinkers can switch), so producers carry much of the levy. |

## Chain table (as built)
| Step | The sentence a student could say | Matches spec? |
|---|---|---|
| 1 | Demand shows how many litres people buy at each price. | Yes |
| 2 | S1 is what each extra litre costs to make; where it meets demand, the equilibrium e<sub>1</sub>, it's 80p and 60m litres. | Yes |
| 3 | Every point on S1 is a number of litres and what the last one costs, rising along S1. | Yes |
| 4 | The levy means the maker needs its cost plus 24p for each litre (56p → 80p). | Yes |
| 5 | It's 24p at every litre, so S2 is S1 moved up 24p, parallel. | Yes |
| 6 | At 80p makers now offer only 42m litres: S2 is also left, so supply has decreased. | Yes (label overlap: finding 2) |
| 7 | S2 meets demand at e<sub>2</sub>, so 51m litres are sold instead of 60m. | Yes |
| 8 | The price rises to 92p, only 12p of the 24p; the other 12p isn't passed on. | Yes (bare price while riding, Pc on landing) |
| 9 | The 24p wedge only fits at Q<sub>tax</sub>: top Pc 92p on demand, foot Pp 68p on S1. | Yes |
| 10 | The government gets 24p on each of the 51m litres sold. | Yes |
| 11 | Tax revenue = 24p × 51m = £12.24m, the box; no levy, no box. | Yes |
| 12 | Shoppers pay 12p a litre of the tax and the maker 12p; together they are the box. | Yes |
| 13 | Before the levy, consumer surplus is the triangle under demand above 80p. | Yes |
| 14 | The levy cuts it: part captured by the government (consumer burden), part no longer traded. | Yes |
| 15 | Before the levy, producer surplus is the triangle above S1 below 80p. | Yes |
| 16 | The levy cuts it the same two ways. | Yes |
| 17 | The 9m litres no longer traded are a loss nobody gets, the DWL; lost surplus = revenue + DWL. | Yes |
| 18 | This is the exam diagram for a specific tax. | Yes |
| 19 | When buyers can easily switch, they pay less of the tax (8p of 24p). | Yes |
| 20 | A percentage tax grows with the cost, so S2 fans out; shoppers pay 87.3p, the maker keeps 72.7p. | Yes (readout sum: finding 1) |

Spec vs build: the build follows the spec plus its "As built" and "After the first review" notes. Two differences aren't recorded there. S1 is drawn dashed from step 5 (finding 14). Step 18 has no readout, which is right, since its card has no numbers.

## Failure modes checked
- `npm run test`: **pass** (45 files, 568 passed, 4 skipped, 0 failed).
- Main spec 1 (slope presented as elasticity): **pass**. Step 19's "more elastic" is true at e<sub>1</sub> (Play after the exit: "2.00 · elastic"), and the consumer share 8/24 = 1/3 matches.
- Main spec 2 (slider label opposite to its effect): **pass**. "Levy per litre: 24p"; right means a bigger levy.
- Main spec 3 (readout reversed): n/a.
- Main spec 4 (silent clamping / off-curve equilibria): **pass**. The levy runs 0–40p; at 40p Q = 45, on the chart.
- Main spec 5 (degenerate tax): **pass**. No Explain market closes in 0–40p; VAT is fixed at 20%.
- Main spec 6 (prose unchecked against the diagram): **fail (finding 1, plus finding 13's wording)**. Checked at the defaults: Pe 80, Qe 60, Pc 92, Pp 68, Q 51, revenue £12.24m, CS = PS = £17.34m (from £24.00m), DWL £1.08m, lost £13.32m, S2 at 80p offers 42m, wedge start gap 69.3p, VAT Pc 87.3 / Pp 72.7. Checked at 30p: step 11 £14.63m = 30p × 48.75m; step 12 15p + 15p = 30p; step 14 Pc 95p, CS £15.84m; step 17 £16.32m = £14.63m + £1.69m; step 19 10p + 20p. All match their readouts. Fails: step 20's three-row sum, and step 17's "11.3m".
- Main spec 7 (line labelled as an area): **pass**. Burden names sit on the bands, prices on the lines.
- Main spec 8 (defining marks missing): **pass at 1280px**; **fail at 390px on step 20** (Q<sub>tax</sub> at 7.27px, finding 3).
- CLAUDE.md, real-pixel chart text: **fail at 390px, step 20 only**. On every other step every chart text is ≥ 12.7px.
- CLAUDE.md, e<sub>2</sub> only when the intervention moves the equilibrium: **pass**.
- CLAUDE.md, a computed number leaking where it shouldn't: **pass**. Explain-only labels don't appear in Play.
- Gates (P3): **pass**. Dot: pointer, keyboard (Shift+Arrow; focus stays on the handle) and touch. Guess: click and tap. Wedge: pointer (both "to spare" and "short of S1" seen), keyboard (focus moves to Next once the fit has played) and touch. Sweep: keyboard (Home/End) and touch. Locked labels say what to do; no state leaves a student stuck.
- Phone: **pass** for horizontal scroll (scrollWidth 390 on all 20 steps), and the card sits below the chart on every step, never over it. **Fail** for legibility on step 20 (finding 3), with crowding on steps 6 and 9 (finding 9).
- Exits (P7): **pass from a fresh load**. Elasticity: tax on, specific, demand "2.00 · elastic", no tour, slider focused and scrolled into view. Ad valorem: 20%, Pc $87.27 / Pp $72.73. **Minor fail** on return trips (finding 11).
- Play reuse of Explain's marks (P10): **pass with minor naming drift** (finding 12). Play shows "Pe … the price being traded" → "Pc … the price buyers pay", "Captured by the government (tax revenue)" / "No longer traded", and "CB" (introduced at step 12).
- Console: no script errors. Only blocked external loads (feedback form/fonts) from the offline test browser.

## Previous findings
| # (2026-11-12) | Severity then | Status | Evidence |
|---|---|---|---|
| 1 Step 11 height × width ≠ revenue | Blocker | Fixed | At 30p: "Height 30p a litre × width 48.75m litres = £14.63m" (30 × 48.75 = 14.625); widths are exact at every levy (Q = 60 − 0.375 × levy). |
| 2 Readout covers S2's label; S1's label under S2 (steps 8, 9, 11) | Major | Fixed | Steps 8, 9 and 11 show plain S1/S2 at their own line ends, clear of the readout (`step09-after.png`, `step11-30p.png`). The same failure now shows on step 6 (new finding 2). |
| 3 Consumer burden same violet as levy/box | Major | Owner decision | Listed in the spec's "Left for the owner"; still `#7c3aed` on both (`step12-burdens.png`). |
| 4 Riding note says "Pe 91.1p" | Major | Fixed | While riding: "80.7p", "85.2p", "90.6p" in ink; on landing: "Pc 92p" (`step08-guess-sequence-sheet.png`). |
| 5 Q<sub>tax</sub> illegible on a phone | Major | Not fixed (partly) | 14.08–16px on steps 7–19; still 7.27px on step 20 (new finding 3). |
| 6 Steps 18–20 drop the readout | Major | Fixed | Steps 19 and 20 have readouts (8p/16p/24p; 87.3p/14.5p/72.7p); step 18's card has no numbers. |
| 7 Play note Pe1/Pe2; CB/PB not introduced | Major | Fixed | Play: "Pe $80.00: the price being traded" → "Pc $90.00: the price buyers pay"; step 12 introduces "(CB)" / "(PB)". Leftover naming drift in finding 12. |
| 8 Steps 14/16 readout before the shrink | Minor | Fixed | Step 14 sheet: the readout comes in with the names, after the grey (`step14-sequence-sheet.png`). |
| 9 Step 19 words before the tween | Minor | Fixed | Card hidden at 0.47s, shown at 1.43s; the tween is 700ms. |
| 10 Stray glyph during burden wipe | Minor | Fixed | Step 12 sheet: the names fade in after each band's wipe; no fragments. |
| 11 Label collisions (steps 5, 9, 16, phone 8) | Minor | Not fixed (partly) | Fixed: "24p levy" is off e<sub>1</sub> (step 9), and "No longer traded" is clear of e<sub>2</sub> (`step16-end.png`). Still there or new: step 5 arrow through e<sub>1</sub>; steps 4–5 and 9 labels on lines; phone steps 6 and 9 (findings 5–9). |
| 12 DWL unlabelled; CS/PS/DWL abbreviations | Minor | Not fixed (partly) | Step 18 now ties "consumer surplus (CS)… (PS)… (DWL)". Steps 17 and 20 still leave the DWL triangle unlabelled (finding 4). |
| 13 Pc/Pp lines run past Q<sub>tax</sub> | Minor | Owner decision | Listed in "Left for the owner"; unchanged (`step11-30p.png`). |
| 14 Hover links point at the wrong mark | Minor | Fixed | "42m litres" → S2, the leftward arrow and its readout row; "every million litres sold" → strips and the "litres sold" bracket; "9m litres" → the DWL area. |
| 15 Wedge reason one-sided | Minor | Fixed | Card covers both cases; the chip reads "69.3p to spare" at Q = 25 and "56p short of S1" at Q = 72 (`step09-wedge-sheet.png`). |
| 16 e<sub>2</sub> height readable before the guess | Minor | Owner decision | Listed in "Left for the owner" ("Kept"). |
| 17 Levy slider has no visible label | Minor | Fixed | "Levy per litre: 24p" above the slider from step 4. |
| 18 Keyboard focus lost after the wedge fits | Minor | Fixed | After a keyboard fit, `activeElement` = the Next button (`explain-btn--primary`). |
| 19 "Equilibrium" unexplained; headline caps | Minor | Fixed / Owner decision | Step 2: "Where it meets demand is the market's equilibrium, e1". The caps ("E2", "24P") are in "Left for the owner". |
| 20 Pass-through claim unsourced | Minor | Fixed | Step 19 links "studies found" to the MRC Epidemiology Unit summary and says "That fits what happened". |
| 21 Tour covers the elasticity exit | Minor | Fixed | No tour after the exit (only the "Replay tour" button); the demand-elasticity slider is focused and scrolled into view (`play-exit-elasticity.png`). |
| 22 Card blank ~11s (14, 16), ~10s (20) | Minor | Not fixed (improved) | Step 14 now about 9.5s, step 20 6.2s (finding 10). |

Fixed: 15 (counting #19's equilibrium part). Owner decision: 3 (#3, #13, #16, plus #19's caps). Not fixed: 4 (#5, #11, #12, #22), each partly improved.

## Owner calibration (owner fills in)
| # | Agree? | Note |
|---|---|---|
| | | |

Missed by the reviewer:
