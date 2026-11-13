// Step card for an Explain mode (subsidy, indirect tax). Presentational: the page supplies the
// context and reacts to onRender/onAmount/onFinish (and, for steps that use them, onPredict and
// onPlayLink).
import { guardSliders } from '../lib/pageControls.js';

// The "Think:" prompt jumps to a bigger size (1 + THINK_GROWTH times) while the pointer is
// within THINK_RADIUS px of the Next button, and drops back when it leaves. On/off, not a scale.
export const THINK_RADIUS = 220;
export const THINK_GROWTH = 0.45;

// Whether the point is within `radius` of the rect (0 distance when it's over it).
export function isNear({ x, y }, rect, radius = THINK_RADIUS) {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy) <= radius;
}

export function mountExplainCard(container, {
  steps, amount, min = 0, max = 60, sliderLabel = 'Subsidy per loaf', formatAmount, replayHost, animationsDone, getContext, onRender, onLeave, onAmount, onFinish, onPredict, onPlayLink, isValidAmount = () => true,
}) {
  let current = 0;
  container.classList.add('explain-card', 'card');

  const count = el('p', 'explain-card__count');
  const headline = el('h3');
  const text = el('p', 'explain-card__text');
  // A question to think about before clicking Next; the next step answers it.
  const think = el('p', 'explain-card__think');
  // A step's `predict`: the student commits to a guess before the chart answers (ctx.prediction).
  const predictRow = el('div', 'explain-predict');
  predictRow.setAttribute('role', 'group');
  predictRow.setAttribute('aria-label', 'Your guess');
  // The step's readout rows (the values box the chart draws top-right). On a phone the chart
  // has no room for it, so pages.css shows this copy in the card instead.
  const readout = el('dl', 'explain-card__readout');
  const sliderRow = el('div', 'explain-card__slider');
  const slider = el('input', 'explain-slider');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = '1';
  slider.value = String(amount);
  slider.setAttribute('aria-label', sliderLabel);
  // A halo on the end of the slider the student is asked to take it to (a step's `sliderHalo`).
  const halo = el('span', 'explain-slider-halo');
  halo.hidden = true;
  sliderRow.append(slider, halo);
  // With `formatAmount`, the slider says what it is and where it's set ("Levy per litre: 24p").
  const sliderName = el('p', 'explain-card__slider-name');
  sliderName.hidden = true;
  // A step's `sliderNote`: a line under the slider that reacts to where the student has taken it.
  const sliderNote = el('p', 'explain-card__slider-note');
  sliderNote.hidden = true;
  const nav = el('div', 'explain-card__nav');
  const back = el('button', 'explain-btn'); back.type = 'button'; back.textContent = 'Back';
  // Replays the current step's entry animation, for a student who looked away. Lives on the
  // chart card when the page passes one (replayHost), else beside Back.
  const replay = el('button', 'explain-btn explain-replay'); replay.type = 'button';
  replay.textContent = '↻ Replay';
  replay.setAttribute('aria-label', 'Replay this step\'s animation');
  const backGroup = el('div', 'explain-card__back-group');
  backGroup.append(back);
  (replayHost ?? backGroup).append(replay);
  const next = el('button', 'explain-btn explain-btn--primary'); next.type = 'button';
  // A step's `playLink`: a way into Play from the middle of the walkthrough ("Try elasticity in Play →").
  const playLink = el('button', 'explain-btn explain-btn--play'); playLink.type = 'button';
  playLink.addEventListener('click', () => { const link = steps[current].playLink; if (link) onPlayLink?.(link.state); });
  playLink.hidden = true;
  const dots = el('div', 'explain-card__dots');
  const dotEls = steps.map((s, i) => {
    const d = el('button', 'explain-dot'); d.type = 'button';
    d.setAttribute('aria-label', `Step ${i + 1}: ${s.id}`);
    d.addEventListener('click', () => goTo(i));
    dots.append(d);
    return d;
  });
  nav.append(backGroup, dots, next);
  container.replaceChildren(count, headline, readout, text, predictRow, think, sliderName, sliderRow, sliderNote, playLink, nav);

  // The guesses, rebuilt on every paint: the chosen one stays marked and, once a guess is made,
  // the others can't be picked (the chart has answered it).
  function paintPredict(step, ctx) {
    const options = step.predict?.options ?? [];
    predictRow.hidden = options.length === 0;
    predictRow.replaceChildren(...options.map(([id, label]) => {
      const b = el('button', 'explain-btn explain-predict__btn'); b.type = 'button';
      b.textContent = label;
      const chosen = ctx.prediction === id;
      b.setAttribute('aria-pressed', String(chosen));
      b.disabled = ctx.prediction != null && !chosen;
      b.addEventListener('click', () => { if (getContext().prediction == null) onPredict?.(id); });
      return b;
    }));
  }

  function paintText() {
    const step = steps[current];
    const ctx = getContext();
    headline.innerHTML = step.headline(ctx); // static copy and formatted numbers only
    text.innerHTML = step.text(ctx); // static copy only
    // A step whose words change as the student drags (the cost dot) never lets the paragraph get
    // shorter than it has been, so a number gaining or losing a digit can't re-wrap the line
    // and make everything below jump; it only ever grows, and resets on a new step.
    if (step.drag) {
      text.style.minHeight = '';
      textFloor = Math.max(textFloor, text.offsetHeight);
      text.style.minHeight = `${textFloor}px`;
    } else {
      textFloor = 0;
      text.style.minHeight = '';
    }
    paintPredict(step, ctx);
    think.textContent = step.think?.(ctx) ?? '';
    // A step's prompt can go once its task is done (an empty prompt), rather than leave a bare "Think:".
    think.hidden = !think.textContent;
    // A gated step's think line is an instruction ("drag the dot"), styled as a call to action
    // until the gate opens.
    think.classList.toggle('explain-card__think--do', locked(ctx));
    // A step with `thinkDelay` holds its prompt back for that long, so a student who gets on
    // with it never sees it; it comes in only if they seem stuck.
    think.classList.toggle('explain-card__think--delayed', Boolean(step.thinkDelay) && !thinkReady && locked(ctx));
    // A prompt about the slider waits for the slider (the step's animation) like the rest of the card.
    think.classList.toggle('explain-card__think--with-slider', Boolean(step.sliderHalo));
    if (formatAmount) sliderName.textContent = `${sliderLabel}: ${formatAmount(ctx.amount)}`;
    sliderNote.textContent = step.sliderNote?.(ctx) ?? '';
    sliderNote.hidden = !sliderNote.textContent;
    const haloEnd = step.sliderHalo?.(ctx) ?? null;
    halo.hidden = !haloEnd;
    if (haloEnd) halo.dataset.end = haloEnd;
    const rows = step.captions?.(ctx)?.readout ?? [];
    readout.replaceChildren(...rows.map(({ label, value, mark }) => {
      const item = el('div', `explain-card__readout-row term--${mark}`);
      item.dataset.mark = mark;
      const dt = el('dt'); dt.textContent = label;
      const dd = el('dd'); dd.textContent = value;
      item.append(dt, dd);
      return item;
    }));
    readout.hidden = rows.length === 0;
    // A gated step (one the student has to do something on) keeps Next locked until
    // step.gate(ctx) says it's done; the page calls refresh() as the student acts.
    next.disabled = locked(ctx);
    const last = current === steps.length - 1;
    next.textContent = locked(ctx) ? (step.lockedLabel ?? 'Next') : last ? (step.finishLabel ?? 'Try it in Play →') : 'Next';
    playLink.hidden = !step.playLink;
    playLink.textContent = step.playLink?.label ?? '';
  }

  function locked(ctx = getContext()) {
    const step = steps[current];
    return Boolean(step.gate && !step.gate(ctx));
  }

  function paint() {
    const step = steps[current];
    slider.value = String(getContext().amount);
    count.textContent = `Step ${current + 1} of ${steps.length}`;
    paintText();
    // A step can show its slider only once the student has done something (`slider(ctx)`).
    sliderRow.hidden = !(typeof step.slider === 'function' ? step.slider(getContext()) : step.slider);
    sliderName.hidden = !formatAmount || sliderRow.hidden;
    back.disabled = current === 0;
    dotEls.forEach((d, i) => {
      if (i === current) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
  }

  // The learning happens on the chart, but eyes go to the words first. When a step animates, the
  // card's text stays hidden (layout kept, so nothing jumps) until the animation has played, then
  // fades in. `animationsDone()` is the page's hook (null when nothing is animating); Replay
  // skips the wait, since the student has already read the text.
  let revealToken = 0;
  let thinkReady = false;
  let textFloor = 0;
  let thinkTimer = null;
  function goTo(i, { hideText = true } = {}) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    const mine = ++revealToken;
    clearTimeout(thinkTimer);
    thinkReady = false;
    textFloor = 0;
    if (steps[current].thinkDelay) {
      thinkTimer = setTimeout(() => { thinkReady = true; paintText(); }, steps[current].thinkDelay);
    }
    paint();
    onRender(steps[current], { animate: true });
    const done = hideText ? animationsDone?.() : null;
    container.classList.toggle('explain-card--waiting', Boolean(done));
    container.setAttribute('aria-busy', done ? 'true' : 'false');
    // A step can hold its words a beat after its animation (`textDelay`), so the mark has time to land.
    const pause = steps[current].textDelay ?? 0;
    (pause && done ? done.then(() => new Promise((r) => setTimeout(r, pause))) : done)?.then(() => {
      if (mine !== revealToken) return; // the student moved on; that step owns the card now
      container.classList.remove('explain-card--waiting');
      container.setAttribute('aria-busy', 'false');
    });
  }

  // Holds the step's words back until `promise` settles (a reveal the student set off, like a
  // guess being answered on the chart), unless they've moved to another step by then.
  function waitFor(promise) {
    if (!promise) return;
    const mine = revealToken;
    container.classList.add('explain-card--waiting');
    container.setAttribute('aria-busy', 'true');
    promise.then(() => {
      if (mine !== revealToken) return;
      container.classList.remove('explain-card--waiting');
      container.setAttribute('aria-busy', 'false');
    });
  }

  back.addEventListener('click', () => goTo(current - 1));
  replay.addEventListener('click', () => goTo(current, { hideText: false }));
  // Leaving a step can play a short exit on the chart first (`onLeave(step)` returns a promise
  // that resolves when it has played); the next step arrives after it. Moving any other way
  // meanwhile (Back, a dot) abandons the pending advance.
  let leaving = false;
  function advance() {
    if (locked() || leaving) return;
    if (current === steps.length - 1) { onFinish(); return; }
    const out = onLeave?.(steps[current]);
    if (!out?.then) { goTo(current + 1); return; }
    leaving = true;
    next.disabled = true;
    const token = revealToken;
    out.then(() => {
      leaving = false;
      if (token === revealToken) goTo(current + 1); else paint();
    });
  }
  next.addEventListener('click', advance);

  guardSliders([slider], () => isValidAmount(+slider.value));
  slider.addEventListener('input', () => {
    onAmount(+slider.value);
    paintText();
    onRender(steps[current], { animate: false });
  });

  container.addEventListener('keydown', (e) => {
    if (e.target === slider) return;
    if (e.key === 'ArrowRight') advance();
    else if (e.key === 'ArrowLeft') goTo(current - 1);
  });

  // A "Think:" prompt gets big when the pointer comes near Next, so the question is hard to miss
  // on the way to skipping past it. Gated "do this" prompts (the dot step) stay put. --near is
  // 0 or THINK_GROWTH; pages.css turns it into a font size.
  const setNear = (on) => { think.style.setProperty('--near', on ? String(THINK_GROWTH) : '0'); };
  const onPointerMove = (e) => {
    if (!container.isConnected) { container.ownerDocument.removeEventListener('pointermove', onPointerMove); return; }
    if (think.hidden || think.classList.contains('explain-card__think--do') || next.disabled) { setNear(false); return; }
    // Measure Next where it sits with the prompt at rest: the bigger text can push the button
    // down, and measuring a moving target would make the size flicker.
    setNear(false);
    setNear(isNear({ x: e.clientX, y: e.clientY }, next.getBoundingClientRect()));
  };
  container.ownerDocument.addEventListener('pointermove', onPointerMove);
  container.ownerDocument.documentElement.addEventListener('pointerleave', () => setNear(false));

  paint();
  return { goTo, index: () => current, refresh: paint, waitFor };
}

function el(tag, cls) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  return node;
}
