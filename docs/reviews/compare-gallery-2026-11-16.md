# Review: Compare mode on price floor / price ceiling (2026-11-16)
Spec: docs/superpowers/specs/2026-11-16-compare-gallery-design.md   Reviewer: graph-reviewer   Verdict: Ship after fixes

Screens: docs/reviews/screens/compare-gallery-2026-11-16/
Method note: browser JS execution was blocked by a permission prompt, so everything was driven by real clicks and keys. Not done: touch input, true 390px (the window bottomed out at about 606 CSS px, which is still in the stacked layout), the full 8-graph cap, price-ceiling Compare end to end (Compare button confirmed present only), and keyboard-only tab order. Source for the compare modules was read. `npm run test`: 52 files, 625 passed, 4 skipped.

## Summary
The core loop works: Compare, Freeze, a corner tray, a full-screen gallery with two cards redrawn at their own width, and labels that name what differs ("PED 1.00, floor $110" next to "PED 3.16, floor $110"). A student can see the PED comparison the owner wanted, and the cards are crisp, with correct exam symbols and shading (shot 4). The tray thumbnails are broken: each one draws a tiny chart in the top corner of an otherwise empty white box, so the tray is not a usable preview. The tray also sits on top of the sliders and real-world examples, and covers the chart at narrow width. Phone width shows one card per screen, so there the "two at once" comparison does not happen.

## Findings
| # | Severity | Principle | Where | Finding | Evidence | Suggested fix |
|---|---|---|---|---|---|---|
| 1 | Major | P1, P12 | Corner tray thumbnails (all states) | Thumbnails are drawn at a wrong, tiny size: the chart occupies about 20% of the box at the top, the rest is blank white. They look broken, and you cannot tell the frozen graphs apart (free market vs floor vs elastic). Likely `drawSnapshot` ran while the tray was hidden or zero-width, so the viewBox was sized from the wrong width. | shots 1-tray-thumb-zoom.png, 2-tray-two-thumbs.jpg; the same graphs in the gallery are correct (shot 3) | Redraw thumbnails once the tray is visible and laid out (on `setVisible`, after layout, and on resize), or scale the SVG with a fixed viewBox for the thumbnails (they have text hidden anyway). |
| 2 | Major | P12, P3 | Tray at 1280 and ~600px | The tray is a fixed overlay that covers page content. At 1280 it hides the Supply slider and the Real-world examples cards; the student cannot reach a slider while the tray is up without scrolling it out of the way. At ~600px it sits across the chart itself (shot 5), covering the curves being adjusted. The spec's "fixed corner overlay" avoided layout reflow but not content occlusion. | shot 2-tray-two-thumbs.jpg (Supply slider hidden), shot 5-mobile-tray-over-chart.jpg | Make the tray small and collapsible, or park it where nothing is (e.g. under the chart head). On narrow screens show only the "View (n)" pill. |
| 3 | Major | P12 | Gallery below 880px (shot 6) | One card per screen, so two states can never be seen together: the point of the feature. A student can only flip between them and compare from memory. The spec chose this deliberately, but the owner's goal is the side-by-side. On phones the cards could still be stacked vertically at half height. | shot 6-mobile-gallery.jpg | Consider stacking two cards vertically on mobile, or keep the previous card's label and a mini thumbnail visible. If one-at-a-time is kept, say so in the owner's notes: the feature does not deliver comparison on phones. |
| 4 | Minor | P3, P6 | "Edit this graph" | It silently overwrites the student's current live graph with the frozen one. If the live state was not frozen, it is lost, with no confirm and no undo. Also the URL gains `?view=explorer` afterwards while the status strip still reads "IB exam diagram" (screenshot after Edit); harmless visually, but the URL/state pairing looks inconsistent. | click on Edit in card 2, then the live page | Freeze the current live state first, or warn. Check that `view: 'explorer'` with no focus is meant to mean the exam diagram. |
| 5 | Minor | P12 | Gallery | The fixed "Replay tour" button floats over the gallery's bottom-left corner on every viewport. The gallery dots show both visible cards as "current" and are 12px targets (touch-hostile). | shots 3, 4, 6 | Hide the tour button while the gallery is open; enlarge the dots' hit area. |
| 6 | Minor | P4 | Gallery labels | Labels recompute as graphs are added or deleted, so a card's title changes ("no floor" became "PED 1.00, no floor" once a third graph differed in PED). That is correct logic but surprising: a student who wrote down "no floor" will not find it. Cards also show no numbers (price, DWL, surplus), only the exam symbols, so "which loses more?" has to be eyeballed; the spec defers this on purpose. | shots 3 and 6 | Fine for phase 1; note for the numeric-comparison phase. |
| 7 | Minor | P12 | Chart head | Compare and Freeze live in the chart header. After adjusting a slider far down the page the student must scroll back up to press Freeze. | scrolled-down state of the page | Consider a Freeze shortcut in the tray or a sticky header. |
| 8 | Minor | P11 | Gallery card, elastic demand (shot 4, right) | The free-market CS/PS vanish and the whole triangle is labelled "deadweight loss" (spelled out, not "DWL") when Qd falls to the axis. Economically consistent with the live chart (the floor is near the demand intercept), but the spelled-out label differs from the left card's "DWL", which makes a pair of cards read as two different concepts. | shot 4-gallery-ped-compare.jpg | Use one label size/wording across cards when space allows (existing renderer behaviour, not compare-specific). |

No blockers found. Economics in the gallery cards (Qd, Qs, excess supply bracket, DWL, Pmin and Pe symbols, e1 only) matches the live page.

## Probes
The spec lists no compare-specific probes (A8 not done for this feature). Reviewer-written substitutes, answered from the page only:
| Probe | Pass/Fail | Where the answer is visible | Answer as read from the page |
|---|---|---|---|
| Which of these two graphs has the bigger DWL? | Pass | Gallery two-up, shot 4 | The PED 3.16 card: the whole D-S triangle is hatched, versus a small triangle at PED 1.00. |
| What changed between these two? | Pass | Card titles | PED 1.00 vs PED 3.16; the floor is $110 in both. |
| Can I get back and change one? | Pass | "Edit this graph" | Restores sliders, toggle and view on the live page (verified; see finding 4 for side effects). |
| Do the two cards show who gains most from the floor? | Fail | Nothing numeric; CS/PS are only visible when non-zero | Not answerable without numbers (deferred by spec). |
| What does the tray thumbnail show? | Fail | Tray | Nothing legible (finding 1). |

## Chain table (as built)
Not applicable: Compare freezes finished pictures and does not replay the chain (spec anti-goal). Freeze is the fly-in animation only. The tween of the toggle was not affected: switching the floor on still plays as before.
| Step | Sentence | Matches spec? |
|---|---|---|
| Compare | "I'm collecting states to compare." | Yes |
| Freeze | "This state goes into the tray." | Yes, but the tray thumbnail does not show the state (finding 1) |
| View | "Two states side by side, redrawn at card width." | Yes |

## Failure modes checked
- Chart text real-pixel sized in gallery cards: pass (text crisp at card width, shot 3).
- Layer / detail contract on cards: pass (drawn through the same `renderMarketChart` path).
- Toggle tween via the change event on Edit: pass (code applies via the `change` dispatch before a single `render()`).
- Two-column matched heights with Compare button added: pass at 1280 (header wraps only on narrow).
- Lens frozen with its treatment: not tested.
- Cap of 8 graphs message: code reviewed only, not exercised.
- Tray occlusion of controls: fails (finding 2).
- Reduced motion: code handles it (no animate); not exercised.

## Owner calibration (owner fills in)
| # | Agree? | Note |
|---|---|---|
Missed by the reviewer:
