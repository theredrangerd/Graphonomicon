# Graphonomicon success criteria

Reusable for every graph page. Started 2026-11-12, with the indirect tax Explain (sugar levy) as the first page run through it. This file holds the criteria; CLAUDE.md and the specs hold the decisions they come from. If the two disagree, fix one of them; don't silently pick.

There are three instruments, used in this order:

1. **Spec self-check (A):** before building, done by whoever writes the spec, with the results recorded in the spec. Does the spec, as written, give a student the understanding we're after?
2. **Product review (B):** after building, by the `graph-reviewer` subagent (`.claude/agents/graph-reviewer.md`). The reviewer only ever reviews built pages. Does the built page meet the principles?
3. **Student probes (C):** questions fixed in the spec before building; the reviewer checks that the built page makes every answer visible.

The point is to run these as an experiment (see "The experiment" at the end): build a few diagrams very well, prove the criteria catch what the owner would catch, then apply them across the site without the owner reviewing every page.

## Who it's for and what success looks like

**Mission.** Graphonomicon makes economics accessible, and economics graphs in particular intuitive. It does that through interactivity: the graph is interactive, and presented so clearly (with animation that plays the chain of analysis) that a student can't help understanding what is happening.

**The student.** A secondary-school student who wants to pass their exam: IB Economics now, AP Economics later. They heard the concept explained in class and didn't really get it. They go home, open the page, and think: *"Oh, I get what that part of the graph means."* Then they can use it: answer a question they haven't seen, predict what happens when something changes, draw the diagram in an exam knowing why each part is there.

**Success, in one line:** every part of the graph is clear, the student can interact with it, understands it intuitively, and can therefore problem-solve with it.

**What follows from the audience:**

- **The destination is the exam diagram.** The page always lands on, and returns to, the full diagram a student would draw in an exam, in exam labels. Understanding is the route to passing, not a substitute for it. (PRODUCT.md's "understanding over exam drill" still stands: no drilling, but the understanding has to arrive at the exam answer.)
- **Real-world examples matter.** IB answers are rewarded for applying theory to real cases. So explanations are grounded in real, named, verifiable policies, and each page has real-world examples.
- **Stakeholders matter.** IB evaluation asks what a policy does to consumers, producers, the government and society. That is why Play has lenses, one per stakeholder, each answering "what is the impact on them?". (Mostly a Play concern; Explain sets up the marks the lenses reuse.)
- **AP comes later.** Keep exam-specific labels and wording in one place per page rather than scattered, so a second label set can be added without a rewrite. Don't build for AP yet.

## The principles

Each principle has an ID used in reviews. "Mark" means anything drawn: curve, point, line, band, bracket, arrow, chip, label.

- **P1. Every mark is named and meant.** At the moment a mark appears, the student can tell what it is and what it means, from what's on screen. Exam symbols (Pe/Qe, Pc/Pp, Q<sub>tax</sub>, e<sub>1</sub>/e<sub>2</sub>, …). One colour per concept, the same in Explain and Play, and never two concepts in one colour in the same frame.
- **P2. The animation is the chain of analysis.** Marks appear in the order an exam answer gives them (comparative statics, not a simulation over time). No mark before the thing that causes it. Pause on any frame and a student could say it as one sentence of the chain. The animation shows the *mechanism* (why the box is tax × quantity), not just the size of the result (a box that grows).
- **P3. The student learns by doing.** At least one insight is reached by the student's own action (drag, predict, slide), not by pressing Next. The graph answers the action immediately and truthfully. No hint text telling the student what dragging will teach.
- **P4. Words and graph are one thing.** Every number in the text is a coloured term matching its mark, and equals the value on the chart, live with the slider. Sums add up exactly. The text never says something the diagram doesn't show.
- **P5. It confronts the known confusions.** Each confusion the page targets (listed in its spec) has a step where the student meets it head-on, ideally by predicting first.
- **P6. It ends at the exam diagram.** Explain finishes on the full exam diagram; Play opens on it; a lens is always marked as a fragment, with a way back.
- **P7. The student can problem-solve.** After the page, the student can answer the page's probes (Instrument C), including a "what if" they haven't been shown. The page invites them to try one (Explain's exits into Play).
- **P8. It's grounded in the real world.** Explain's frame is a real, named policy. Real figures are sourced; illustrative numbers are never presented as real. The examples panel follows the CLAUDE.md rules (real URLs from a search, at least one non-Western).
- **P9. Each lens is one stakeholder's question.** (Play.) Each lens answers "what is the impact on them?" and nothing another lens derives. Deadweight loss is society's.
- **P10. Explain and Play are one explanation.** Play's chains reuse only marks Explain introduced, with the same names and colours, compressed.
- **P11. It's honest and correct.** The economics is right; numbers agree everywhere; a closed market reports "—"; no dynamics the model doesn't claim; the main spec's "Known failure modes" all pass; `npm run test` passes.
- **P12. It's accessible to everyone.** Works at phone width (390px: no horizontal scroll, chart text legible, every task doable by touch) and by keyboard. Plain language: short sentences; a term like "incidence" or "burden" is explained the first time it's used.

**Severity**, for every finding:
- **Blocker:** breaks P2, P4 or P11 (wrong order, wrong numbers, wrong economics), or a student can get stuck (a gate they can't pass).
- **Major:** a principle is weakened: an unexplained mark, a step with no clear sentence, a confusion left unaddressed.
- **Minor:** polish: timing, wording, spacing.

## Instrument A: the spec self-check (before building)

Run on the spec alone, before any code, by the spec's author. Each item passes or fails, with a one-line reason, recorded in the spec as a table. The reviewer later compares the built page against these tables (the chain table, the mark inventory, the probes).

- **A1. Confusions named.** The spec lists where students get lost, with where that came from (owner, research).
- **A2. The chain table.** From the step list, write one sentence per step. Every step yields one sentence; the sentences in order are a correct exam-style explanation.
- **A3. Mark inventory.** List every mark the page draws and the step it first appears. Each appears at or after its cause (P2), and is named when it appears (P1).
- **A4. Interactions earn their place.** For each task (drag, predict, slide): what insight does it produce, and could the student skip the insight by skipping the task? At least one task the insight depends on (P3).
- **A5. Confusions met.** Each A1 confusion maps to a step that confronts it (P5).
- **A6. Exam landing and exits.** Ends on the exam diagram; the ways into Play are named, each with the question it invites (P6, P7).
- **A7. Real-world frame.** Named policy, sourced figures, unverified claims flagged, what the model leaves out said (P8, P11).
- **A8. Probe set written.** The spec includes the page's student probes (Instrument C), fixed now, each with the step expected to answer it.
- **A9. Play consistency.** The spec says which Explain marks Play's chains reuse, and Play needs no mark Explain doesn't introduce (P10).
- **A10. Risks named.** Which known failure modes (main spec list, CLAUDE.md) the design is most at risk of.

A spec passes when A1–A10 all pass. A failed item is fixed in the spec before building, not during.

## Instrument B: the product review (after building)

Done by the `graph-reviewer` subagent, started fresh (not a fork of the session that built the page), so it doesn't inherit the builder's reasoning. It reads the page as a student would and checks it as an examiner would.

**Procedure:**

1. Read this file, CLAUDE.md, the page's spec (including its probes) and the main spec's "Known failure modes".
2. Run `npm run test`. Any failure is a blocker.
3. Start the dev server (`npm run dev`) and open the page in a browser (Playwright) at 1280px wide and at 390px.
4. **Walk Explain as a student.** For every step: read the card, wait for the animation, screenshot the end state. For each step with a timed sequence, also screenshot two or three mid-animation frames (the pause test). Do each task the way a student would: drag with the pointer, then again with the keyboard; at 390px, by touch. Note anywhere you didn't know what to do.
5. **Naive-reader pass.** On at least four screenshots (one early, the two-prices step, the revenue/box step, the final diagram), list every mark and what it means *using only what is visible on screen and in the card at that step*, not prior economics knowledge. Any mark you can't explain from the screen is a P1 finding.
6. **Play.** Exam diagram at load; switch the intervention on; each lens; a slider drag mid-chain (must cancel to the finished picture); switch off. Screenshot mid-chain frames. Check P9 and P10.
7. **Numbers.** On three steps, check every number in the text against the chart's readout and axis, at the default and at one other slider value; check that the sums add up.
8. **Probes** (Instrument C).
9. **Failure modes.** Go through the main spec's "Known failure modes" and the CLAUDE.md definition of done; note each that applies and whether it passes.
10. Write the report.

**The checks, by principle.** Each finding cites a principle ID, a step (or Play state), the evidence (screenshot path, value seen vs expected) and a severity.

| ID | Check |
|---|---|
| P1 | Naive-reader pass finds no unexplained mark. Exam symbols on the axes. Colours: one per concept, matching between Explain and Play, burdens never in surplus colours. No step introduces more than about three marks the student hasn't seen before (marks they already know may re-enter, in order). |
| P2 | Chain table from the built page matches the spec's (A2). No mark before its cause on any screenshot, including mid-animation frames. Each paused frame can be said as one sentence. The box/area animations show how the area is built, not only growth. |
| P3 | Each gated task can be completed by pointer, keyboard and touch; its locked label says what to do; the insight appears only after doing it. Slider drags update the chart live with no lag or jump. |
| P4 | Every number in the card is a coloured term; hovering one highlights its mark. Numbers match the chart (step 7). Sums exact. No sentence the diagram contradicts. **Every sum or product the page shows (a × b = c, a − b = c, a + b = c, in the card or a readout) holds on the numbers as displayed, after rounding, at every slider value the step allows: sweep the slider and check each one.** (Added 2026-11-13: both reviews of the tax Explain caught a displayed sum that didn't add up after rounding.) |
| P5 | Each confusion in the spec is visibly confronted at its mapped step. |
| P6 | Explain's last diagram is the full exam diagram; Play loads on it; lenses say "Only part of the diagram" with a way back. |
| P7 | All probes pass (Instrument C). Each exit into Play lands in the state it promises. |
| P8 | The frame's real figures match the sourced values; illustrative numbers aren't presented as real; examples-panel rules hold (links resolve, one non-Western). |
| P9 | Each lens's chain answers only its question; DWL only in the society view. |
| P10 | Every mark used in Play's chains appears in Explain, with the same name and colour. |
| P11 | Tests pass; economics correct; known failure modes pass; a closed market shows "—". |
| P12 | 390px: no horizontal scroll, chart text legible, tasks doable by touch, card doesn't cover the marks it names. Keyboard reaches every control. Technical terms explained at first use. |

**Verdict:** *Ship* (no blockers or majors), *Ship after fixes* (majors with clear fixes, no blockers), *Rework* (any blocker, or majors that are design problems rather than bugs).

## Instrument C: student probes (the "go home and get it" test)

Each page's spec lists 6–8 probes, written before building and not changed after, so the build can't be shaped around them. Cover these kinds:

- **Identify:** "What does this shaded area show?" (point at it)
- **Explain:** "Why is S2 above S1?"
- **Read:** "How much of the tax do consumers pay per unit?"
- **Calculate:** "What is the government's revenue?"
- **Predict:** "If demand were more elastic, who would pay more of the tax?" (not shown directly in Explain)
- **Evaluate:** "Which stakeholder loses most, and how do you know from the diagram?"
- **Apply:** one question about the real-world frame.

**How the reviewer runs them.** For each probe, cite the step, frame or interaction where the answer becomes visible on the page, and give the answer as read from there. A probe **passes** only if the answer can be read or worked out from what the page shows or lets the student do. It **fails** if the answer is only in prose with nothing on the graph to back it, if it needs knowledge the page never gives, or if the page shows something that contradicts it. Predict probes pass if the student can test the prediction on the page (e.g. in Play) and the page points them there.

## Report format

Written to `docs/reviews/<page>-<YYYY-MM-DD>.md`:

```
# Review: <page> (<date>)
Spec: <path>   Reviewer: graph-reviewer   Verdict: Ship | Ship after fixes | Rework

## Summary
<3–5 sentences: does a student who didn't get it in class get it here?>

## Findings
| # | Severity | Principle | Where | Finding | Evidence | Suggested fix |

## Probes
| Probe | Pass/Fail | Where the answer is visible | Answer as read from the page |

## Chain table (as built)
| Step | The sentence a student could say | Matches spec? |

## Failure modes checked
<each, pass/fail>

## Owner calibration (owner fills in)
| # | Agree? | Note |
Missed by the reviewer: <anything the owner caught that isn't above>
```

## The experiment

**Hypothesis:** a page that passes A, B and C makes its graph intuitive for a student who didn't get it in class, and the reviewer catches what the owner would have caught.

**Loop for each page:**

1. Write the spec, with probes, and run the spec self-check (A); fix the spec until it passes.
2. Build.
3. Run the product review (B + C). Fix blockers and majors; re-review.
4. The owner looks at the page and fills in the calibration table: which findings they agree with, and what they'd have flagged that the reviewer didn't.
5. **Update this file.** Every "missed by the reviewer" becomes a new check (or a sharper one) in this file, with the date and the page it came from. Every finding the owner rejects either gets its check reworded or a note on when it doesn't apply.

**Measures (kept in a table at the bottom of this file):** findings the owner agreed with; findings rejected; owner-only findings (missed); verdict agreement.

**When the owner can stop reviewing:** two pages in a row where the owner adds no major or blocker the reviewer missed, and agrees with the reviewer's verdict. After that, the owner spot-checks instead of reviewing everything; any later miss goes back into the loop.

**Limits, said plainly.** The reviewer is a model that already knows economics, so "would a student get this?" is a proxy. The naive-reader rule and the probes (answer only from what's on screen) narrow the gap but don't close it. The owner's judgement is the calibration now; real students (through analytics, still an open decision, or a classroom trial) are the real test later.

### Results

| Page | Date | Spec self-check | Verdict | Owner agreed | Owner rejected | Missed | Verdicts agree? |
|---|---|---|---|---|---|---|---|
| Indirect tax Explain (sugar levy) | 2026-11-12 | Pass (A1–A10) | Rework (1 blocker, 6 major, 15 minor) | | | | |
| Indirect tax Explain, re-review | 2026-11-13 | — | Rework (1 blocker, 2 major, 11 minor; 15 of 22 earlier fixed); all fixed after, except minors listed in the spec | | | | |

### Changes to these criteria

- 2026-11-12: first version.
- 2026-11-13: P4 check now sweeps the slider for displayed arithmetic that doesn't survive rounding (indirect tax Explain, both reviews).
