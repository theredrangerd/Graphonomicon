# Indirect tax page: Explain and Play modes — design

Date: 2026-11-09. Status: implemented. Ports the subsidy pilot (`2026-10-27-subsidy-explain-and-play-design.md`) to `indirect-tax.html`. The owner left every decision to Claude, so each item below is **Claude's call** and open to revision. These answer the questions in `docs/superpowers/handoff-2026-10-28-tax-explain-and-play.md`.

## Decisions

1. **Quantity axis (Ms. Patel request 2):** Qe + Q<sub>tax</sub>, matching Q<sub>subsidy</sub>. Q<sub>tax</sub> sits left of Qe, so the word symbol is anchored `end` at its line (the handoff's axis-label trap), and it shrinks away near Qe like every intervention symbol.
2. **IB perfect tax picture:** post-tax CS, post-tax PS, the revenue box split by colour into consumer burden and producer burden (outlined in `--gov`), and DWL. This is what the page already drew at IB. Area names now say "deadweight loss", not "welfare loss", like the subsidy. `TAX_AREA_LABELS` (`full` | `half` = burdens only | `none`) is the tax's own copy of the subsidy setting.
3. **Explain's teaching frame:** a specific tax on cans of soft drink (it fits the sugar-tax examples already on the page). S1 = what it costs to make, S2 = cost + tax, plus a "$X tax per can" bracket. The "aha" is step 6, **"The price rises by less than the tax"**: the consumer burden wipes up from Pe to Pc, then the producer burden wipes down to Pp, and the two shares add up to the tax.
4. **Steps (12):** demand → supply → tax (S2, slider appears) → e2 / Q<sub>tax</sub> → Pc/Pp → consumer burden → producer burden → revenue box → post-tax CS/PS → DWL (grows from Q<sub>tax</sub> to Qe) → **elasticity** (demand tweens to inelastic over 700ms; consumers now carry ~$15 of $20) → IB wrap-up (tweens back). The step-11 elasticity beat is new relative to the subsidy, because incidence vs. elasticity is the core IB point on taxes.
5. **Specific vs ad valorem:** Explain teaches specific only, and the wrap-up points to ad valorem in Play. Play keeps the radios in both views. "Try it in Play →" selects specific before animating the tax on.
6. **Explorer foci (revised by the owner, 2026-11-09):** Consumer surplus · Producer surplus · Consumer burden · Producer burden · Tax revenue · Deadweight loss. CS and PS show **only** the post-tax surplus with one chip. Showing the burden band inside a surplus view was confusing, especially since the burdens used the subsidy's marginal-CS/PS teal/gold. Each burden is its own focus ("CB $x" / "PB $x"), wiping out of Pe. Revenue shows the split box with one "Revenue $x" chip; DWL shows only the triangle. Bands wipe in after the supply shift (800ms stagger), and the reveal replays when a focus is picked while the tax is already on.
8. **Burden colours (owner, 2026-11-09):** the burdens no longer use teal/gold, which are the subsidy's marginal CS/PS and read as surplus. They now use their own tokens: `--burden-consumer` (violet) and `--burden-producer` (plum), both slices of the tax revenue box, which is outlined in `--gov` violet. Three options were previewed (A: two violets, B: violet + plum, C: slate greys), and the owner picked **B**.
7. **Closed market:** Explain's slider stops before the market closes (in both of Explain's markets). In Play, a closed market draws no focus areas and the note explains why.

## Shared-code changes

- `marketChart.js`: layers `taxConsumer`, `taxProducer`, `taxBracket`; focus `revenue`; `TAX_BANDS` chips; `drawSubsidyBracket` became `drawWedgeBracket`.
- `viewSwitch.js` exports per-page focus lists; `readPlayView(win, focusIds)`; `explainCard` takes a `sliderLabel` option.
- `regionExplainers.js`: live tax notes for revenue, both burdens and DWL.
- CSS: burden bands wipe out of Pe (`wipe-up` / `wipe-down`).

## Open

- Ms. Patel should confirm the Q<sub>tax</sub> label and the IB area names (`TAX_AREA_LABELS`).
- Step copy is a working draft.
