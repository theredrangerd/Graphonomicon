# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the owner's G11 IB Economics students, in class and revising on their own. Their job is conceptual understanding: seeing how an intervention (price control, tax, subsidy, externality) changes surplus, revenue and deadweight loss. Secondary and informal: other IB teachers and students who receive a link. Two arrival patterns must both work: a deep link to one diagram (dominant) and cold browse/search on the homepage.

## Product Purpose

An interactive, animated library of IB Economics graph explorers. Hand-drawn graphs become illegible once several relationships are annotated in one colour; here a student drags a control and watches shaded regions update live in distinct colours, so cause (intervention) to effect (welfare change) clicks. It is for conceptual understanding, not exam hand-drawing practice. Success is return engagement.

## Positioning

Live, distinctly coloured regions that respond to the student's own input, shared engine with one focused, deep-linkable page per scenario. Not a static annotated image and not a single mega-page with toggles.

## Operating Context

Multi-page static site (Vite, plain JS, GitHub Pages at /Graphonomicon/). Syllabus-ordered units: Microeconomics (large tile), Macroeconomics (medium), International and Development (small). Unbuilt tiles route to a shared Work in Progress page with a feedback Google Form. Teaching calendar drives build order; Government Intervention is built first.

## Capabilities and Constraints

- Name is **Graphonomicon** (capitalised), renamed from "Econ Tools"; it must be stated explicitly in the front end instead of "IB Econ Tools" / "IB Graphing Tools".
- Unofficial: not affiliated with the International Baccalaureate; "IB Economics" may appear in descriptors but not as the product name. A small unofficial/not-affiliated note is wanted.
- Per-unit accent colours and the demand/supply/government fill tokens are to be preserved.
- Shared chrome is injected by `src/components/chrome.js`; tokens live in `src/styles/tokens.css`.

## Brand Commitments

Name: Graphonomicon. Audience-first voice: students. Keep existing unit accent colours. Everything else about the visual identity (wordmark, logo, palette expression, type) is open and to be decided in design work.

## Evidence on Hand

Working Government Intervention pages (price ceiling, price floor, indirect tax, subsidy). No testimonials, usage data or analytics yet; do not fabricate any.

## Product Principles

1. Interactivity over animation alone: the student's input drives the picture.
2. Honest about completeness: unbuilt items stay visible and route to the WIP page.
3. One scenario per page, deep-linkable, with family cross-links.
4. Understanding over exam drill; no hint text that explains what dragging will teach.
5. Same visual language for every diagram so the tool feels like one product.

## Accessibility & Inclusion

No formal standard stated. Students use phones and laptops; layouts must stack at the 880px breakpoint and chart text must stay legible.
