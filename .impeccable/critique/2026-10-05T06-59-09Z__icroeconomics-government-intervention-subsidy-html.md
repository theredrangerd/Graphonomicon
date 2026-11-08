---
target: the subsidy graph
total_score: 26
p0_count: 0
p1_count: 3
timestamp: 2026-10-05T06-59-09Z
slug: icroeconomics-government-intervention-subsidy-html
---
Method: dual-agent (A: design review · B: detector + browser evidence)

Score 26/40 (Good). P0: 0, P1: 3, P2: 2, P3: 1.

Priority issues
1. [P1] Pp/Pe/Pc axis labels crowd and collide at small subsidies (layout/polish on marketChart label placement).
2. [P1] Subsidy band is the busiest region; DWL (the lesson's punchline) is the smallest, quietest mark (distill, colorize).
3. [P1] Accessibility: 6 inputs have no accessible name; no aria-live; SVG has no state description; muted grey (#838D9C) at 11-12.5px measures 2.6-3.4:1; sliders 4px high (harden).
4. [P2] Redundant outcome stats: CS vs "Consumer benefit", PS vs "Producer benefit", 9 tiles, zeros shown in free market (clarify, distill).
5. [P2] Hero pushes chart below the fold on laptops; legend and stats away from chart (layout).
6. [P3] Example cards use categorical color that already means consumer/producer/gov (documented in CLAUDE.md; judgment call).

Detector: 1 CLI finding (em-dash-overuse, likely partly false positive); browser overlay 28 labels (17 low contrast, 6 hairline+shadow, 1 repeating-gradient = intentional hatch).
