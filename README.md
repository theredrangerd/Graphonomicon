# Graphonomicon

**Interactive IB Economics graphs that play out the chain of analysis, so you can see *why* a diagram looks the way it does.**

Graphonomicon is a free, student-built library of animated economics diagrams. Switch on a tax, a subsidy, or a price control and the graph shows how theory gets from the cause to the outcome, step by step, in the order an IB exam answer would give it. Drag a slider and the shaded regions (consumer surplus, producer surplus, government revenue, deadweight loss) update live, each in its own colour.

> Unofficial. Graphonomicon is not affiliated with, or endorsed by, the International Baccalaureate.

---

## Why it exists

Economics graphs are hard to learn from a whiteboard. A teacher draws the base curves, then adds a price control, then consumer surplus, then producer surplus, then deadweight loss, often all in the same pen colour. By the end it's an illegible tangle, and a student who didn't follow it live has nothing to untangle at home.

Graphonomicon is built for that student: someone who heard a concept in class, didn't quite get it, and opens a page that evening. Success is a single moment, *"oh, I get what that part of the graph means"*, and then being able to use it to solve problems.

## What makes it different

**1. The animation is the chain of analysis.**
When you switch an intervention on, the graph doesn't jump to the end result. For a subsidy, supply shifts first, then the prices each side faces move (with the per-unit payment visible along the curve), then the surplus areas appear, then the numbers. Two rules keep it honest:

- *Nothing appears before the thing that causes it.*
- *Pause on any frame and you could say it as one sentence of the argument.*

The order is the logical one an exam answer gives (comparative statics), never a simulation of prices adjusting over time. The tool doesn't claim dynamics the model doesn't have.

**2. You drive it.**
Dragging a control goes straight to the finished picture, so you can test "what if the subsidy were bigger?" and watch every region respond. Interactivity, not animation alone, is what makes cause and effect click.

**3. Lenses for each stakeholder.**
IB evaluation turns on *who* is affected. Each lens answers one question about one party:

| Lens | The question it answers |
|---|---|
| Consumers | What do buyers gain (or lose)? |
| Producers | What do sellers gain (or lose)? |
| Government | What is the impact on its budget? |
| Society | Where does the money go, and what is wasted? |

**4. The default view is the exam diagram.**
A lens shows only part of the picture, and the page says so: *"Only part of the diagram. Exams need all of it."* The plain page is the complete IB exam diagram, because students should never draw a single lens as their exam answer.

**5. It's honest about what it is and isn't.**
It is for conceptual understanding, not a substitute for the hand-drawn diagram skill that exams test. Pages that aren't built yet stay visible and say so, rather than being hidden or overpromised. There is no made-up usage data anywhere on the site.

## Explain and Play

Where a topic has a long chain of reasoning, the page offers two modes:

- **Explain** is a guided walkthrough with things to do. In the indirect tax page, built around the real UK sugar levy (24p a litre, April 2018), you drag a dot along the supply curve, guess whether the price will rise by the full 24p *before* the graph answers, then work through who bears the tax, what each side loses, and where the deadweight loss comes from.
- **Play** is the free sandbox: toggle the intervention, move the sliders, switch lenses, and watch the chain replay.

## What's built so far

The first unit follows the order the material is actually taught in class, starting with **Government Intervention** (Microeconomics):

| Diagram | Modes |
|---|---|
| Price ceiling | Exam diagram, Explore |
| Price floor | Exam diagram, Explore |
| Indirect tax (specific and ad valorem) | Explain, Play (with a Societal lens) |
| Subsidy | Explain, Play (with all four lenses) |

Market failure, elasticity, supply and demand fundamentals, and Theory of the Firm (HL) are on the roadmap and already visible on the site as "work in progress". Macroeconomics, International and Development follow after Microeconomics.

Each page also has real-world examples (every page includes at least one from outside Europe and North America), and shaded areas can be tapped for an explanation.

## Who it's for

- **IB Economics students** (SL and HL) revising or catching up on a concept. Every diagram is tagged SL or HL.
- **Teachers**, who can share a link to exactly one scenario ("price floor on minimum wage") for class or revision. Every graph is its own page with its own link.

## The design thinking behind it

- **One engine, many focused pages.** A shared rendering engine draws every curve, shaded region, label and animation. Each scenario then gets its own page with only the controls that matter. A single mega-page with toggles was considered and rejected, because most visitors arrive from a link to one specific graph.
- **No hint text on the sliders.** A student should discover what a flatter or steeper curve means by dragging it, not by reading it first. The elasticity readouts are true point elasticity at the equilibrium, never a word guessed from the slope.
- **Consistent visual language.** The same colours mean the same thing on every page, inspired by Isotype wall charts. Chart text is sized in real pixels so it stays readable on a phone, and layouts stack on small screens.
- **Pages are reviewed against written criteria.** `docs/success-criteria.md` defines what a good page is (a self-check before building, a review of the built page by a separate reviewer, and "student probes" fixed in each spec). Design decisions, including rejected alternatives, are recorded in `docs/superpowers/specs/`.

## For the technically curious

Built with Vite and vanilla JavaScript, with no UI framework. Every page is a real static `.html` file, which keeps every graph trivially deep-linkable and suits free static hosting such as GitHub Pages. Tests use Vitest and jsdom and sit next to the code they cover.

```bash
npm install
npm run dev       # local dev server
npm run build     # production build
npm run test      # test suite
```

Key places to look:

- `src/lib/` holds the shared economics model, animation helpers and the unit/diagram data.
- `src/components/` holds the shared UI (header, search, bento grid, tour).
- `src/pages/` holds the logic for each page.
- `docs/` holds design specs, reviews and success criteria.

## Feedback and requests

Every page, including work-in-progress ones, embeds a feedback form for requesting graphs or reporting problems. That is the intended channel for suggestions.
