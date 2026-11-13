import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountExplainCard, isNear, THINK_RADIUS, THINK_GROWTH } from './explainCard.js';
import { SUBSIDY_STEPS } from '../pages/subsidyExplainSteps.js';
import { computeMarket } from '../lib/marketEngine.js';
import { DEFAULT_MARKET } from '../lib/pageControls.js';

const result = computeMarket({ ...DEFAULT_MARKET, intervention: { type: 'subsidy', amount: 20 } });

let container, onRender, onAmount, onFinish, card;
beforeEach(() => {
  document.body.innerHTML = '<section id="explain-card"></section>';
  container = document.getElementById('explain-card');
  onRender = vi.fn(); onAmount = vi.fn(); onFinish = vi.fn();
  card = mountExplainCard(container, {
    steps: SUBSIDY_STEPS, amount: 20,
    getContext: () => ({ amount: 20, result, dotQ: 45, explored: false }),
    onRender, onAmount, onFinish,
  });
});
const btn = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent === t);

describe('explain card', () => {
  it('starts at step 1 of 15 with Back disabled', () => {
    expect(container.querySelector('.explain-card__count').textContent).toBe('Step 1 of 19');
    expect(btn('Back').disabled).toBe(true);
    expect(container.querySelector('.explain-slider').closest('div').hidden).toBe(true);
  });
  it('Next renders with animate and shows step 2', () => {
    btn('Next').click();
    expect(onRender).toHaveBeenLastCalledWith(SUBSIDY_STEPS[1], { animate: true });
    expect(container.querySelector('h3').textContent).toBe('Supply: what it costs to bake');
    expect(container.querySelector('[aria-current="step"]')).toBe(container.querySelectorAll('.explain-dot')[1]);
  });
  it('Replay re-renders the current step with animate, without changing step', () => {
    btn('Next').click();
    onRender.mockClear();
    btn('↻ Replay').click();
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(onRender).toHaveBeenLastCalledWith(SUBSIDY_STEPS[1], { animate: true });
    expect(card.index()).toBe(1);
  });
  it('can mount Replay on a host element outside the card', () => {
    document.body.innerHTML = '<div id="h"><span class="status-pill"></span></div><section id="c"></section>';
    const host = document.getElementById('h');
    const c = document.getElementById('c');
    const r = vi.fn();
    mountExplainCard(c, { steps: SUBSIDY_STEPS, amount: 20, replayHost: host, getContext: () => ({ amount: 20, result, dotQ: 45 }), onRender: r, onAmount() {}, onFinish() {} });
    expect(c.querySelector('.explain-replay')).toBeNull();
    host.querySelector('.explain-replay').click();
    expect(r).toHaveBeenLastCalledWith(SUBSIDY_STEPS[0], { animate: true });
  });
  it('slider on step 4 calls onAmount then onRender without animate', () => {
    card.goTo(3);
    onRender.mockClear();
    const slider = container.querySelector('.explain-slider');
    expect(slider.closest('div').hidden).toBe(false);
    slider.value = '30';
    slider.dispatchEvent(new Event('input'));
    expect(onAmount).toHaveBeenCalledWith(30);
    expect(onRender).toHaveBeenCalledWith(SUBSIDY_STEPS[3], { animate: false });
    expect(onAmount.mock.invocationCallOrder[0]).toBeLessThan(onRender.mock.invocationCallOrder[0]);
  });
  it('refresh re-syncs the slider to the amount from getContext', () => {
    document.body.innerHTML = '<section id="explain-card"></section>';
    container = document.getElementById('explain-card');
    let amount = 20;
    card = mountExplainCard(container, {
      steps: SUBSIDY_STEPS, amount,
      getContext: () => ({ amount, result }),
      onRender, onAmount, onFinish,
    });
    amount = 35;
    card.refresh();
    expect(container.querySelector('.explain-slider').value).toBe('35');
  });
  it('last step offers Try it in Play', () => {
    card.goTo(18);
    btn('Try it in Play →').click();
    expect(onFinish).toHaveBeenCalled();
  });
  it('shows a think prompt only on steps that have one', () => {
    const think = container.querySelector('.explain-card__think');
    expect(think.hidden).toBe(true);
    card.goTo(4);
    expect(think.hidden).toBe(false);
    expect(think.textContent).toContain('where will S2 cross demand');
  });
  it('a gated step keeps Next (and ArrowRight) locked until its gate opens', () => {
    document.body.innerHTML = '<section id="explain-card"></section>';
    container = document.getElementById('explain-card');
    let done = false;
    const steps = [{ id: 'a', headline: () => 'A', text: () => '', gate: () => done }, { id: 'b', headline: () => 'B', text: () => '' }];
    card = mountExplainCard(container, { steps, amount: 20, getContext: () => ({}), onRender, onAmount, onFinish });
    expect(btn('Next').disabled).toBe(true);
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(card.index()).toBe(0);
    done = true;
    card.refresh();
    expect(btn('Next').disabled).toBe(false);
    btn('Next').click();
    expect(card.index()).toBe(1);
  });
  it('shows the step’s readout rows in the card (for phones)', () => {
    card.goTo(1);
    const rows = [...container.querySelectorAll('.explain-card__readout-row')].map((r) => r.textContent);
    expect(rows).toEqual(['Market price (Pe)$80', 'Loaves sold (Qe)60']);
  });
  it('ArrowRight advances, ignored on the range input', () => {
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(card.index()).toBe(1);
    card.goTo(2);
    container.querySelector('.explain-slider').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(card.index()).toBe(2);
  });
});

describe('think prompt proximity', () => {
  const rect = { left: 100, right: 200, top: 100, bottom: 140 };
  it('is near within the radius of the button and not beyond it', () => {
    expect(isNear({ x: 150, y: 120 }, rect)).toBe(true);
    expect(isNear({ x: 200 + THINK_RADIUS, y: 120 }, rect)).toBe(true);
    expect(isNear({ x: 200 + THINK_RADIUS + 1, y: 120 }, rect)).toBe(false);
  });
  it('makes the Think prompt big when the pointer is near Next, with no in-between sizes', () => {
    btn('Next').getBoundingClientRect = () => rect;
    const think = container.querySelector('.explain-card__think');
    card.goTo(4); // a "Think:" prompt with no gate
    expect(think.hidden).toBe(false);
    const sizes = new Set();
    for (const x of [900, 600, 450, 400, 350, 300, 250, 200, 150]) {
      document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 120 }));
      sizes.add(think.style.getPropertyValue('--near'));
    }
    expect([...sizes].sort()).toEqual(['0', String(THINK_GROWTH)]);
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 900 }));
    expect(think.style.getPropertyValue('--near')).toBe('0');
  });
});

describe('text waits for the chart animation', () => {
  const mountWith = (animationsDone) => {
    document.body.innerHTML = '<section id="explain-card"></section>';
    const c = document.getElementById('explain-card');
    const mounted = mountExplainCard(c, {
      steps: SUBSIDY_STEPS, amount: 20, animationsDone,
      getContext: () => ({ amount: 20, result, dotQ: 45, explored: false }),
      onRender: vi.fn(), onAmount() {}, onFinish() {},
    });
    return { c, mounted };
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('hides the words while the step animates, then shows them', async () => {
    let finish;
    const { c, mounted } = mountWith(() => new Promise((r) => { finish = r; }));
    mounted.goTo(1);
    expect(c.classList.contains('explain-card--waiting')).toBe(true);
    expect(c.getAttribute('aria-busy')).toBe('true');
    finish();
    await tick();
    expect(c.classList.contains('explain-card--waiting')).toBe(false);
    expect(c.getAttribute('aria-busy')).toBe('false');
  });

  it('shows the words straight away when nothing is animating', () => {
    const { c, mounted } = mountWith(() => null);
    mounted.goTo(1);
    expect(c.classList.contains('explain-card--waiting')).toBe(false);
  });

  it('does not hide the words again on Replay', () => {
    const { c, mounted } = mountWith(() => new Promise(() => {}));
    document.body.innerHTML = '';
    const host = document.createElement('div');
    document.body.append(host);
    const c2 = document.createElement('section');
    document.body.append(c2);
    const m2 = mountExplainCard(c2, {
      steps: SUBSIDY_STEPS, amount: 20, replayHost: host, animationsDone: () => new Promise(() => {}),
      getContext: () => ({ amount: 20, result, dotQ: 45, explored: false }),
      onRender: vi.fn(), onAmount() {}, onFinish() {},
    });
    m2.goTo(1);
    expect(c2.classList.contains('explain-card--waiting')).toBe(true);
    host.querySelector('.explain-replay').click();
    expect(c2.classList.contains('explain-card--waiting')).toBe(false);
  });

  it('a thinkDelay step holds its prompt back until the delay has passed', () => {
    vi.useFakeTimers();
    const { c, mounted } = mountWith(() => new Promise(() => {}));
    mounted.goTo(2);
    const think = c.querySelector('.explain-card__think');
    expect(think.classList.contains('explain-card__think--delayed')).toBe(true);
    vi.advanceTimersByTime(6101);
    expect(think.classList.contains('explain-card__think--delayed')).toBe(false);
    vi.useRealTimers();
  });

  it('a step the student has already left does not reveal the next one early', async () => {
    const resolvers = [];
    const { c, mounted } = mountWith(() => new Promise((r) => { resolvers.push(r); }));
    mounted.goTo(1);
    mounted.goTo(3);
    resolvers[0]();
    await tick();
    expect(c.classList.contains('explain-card--waiting')).toBe(true);
    resolvers[1]();
    await tick();
    expect(c.classList.contains('explain-card--waiting')).toBe(false);
  });
});

describe('predict, Play exits and holding the words', () => {
  const STEPS = [
    { id: 'one', headline: () => 'One', text: () => 'first', layers: [] },
    {
      id: 'guess', headline: () => 'Guess', text: (ctx) => (ctx.prediction ? `you said ${ctx.prediction}` : 'guess first'), layers: [],
      predict: { options: [['all', 'All 24p'], ['some', 'Some of it'], ['none', 'None of it']] },
      gate: (ctx) => ctx.prediction != null, lockedLabel: 'Make a guess',
    },
    { id: 'exit', headline: () => 'Exit', text: () => 'go on', layers: [], playLink: { label: 'Try elasticity in Play →', state: { focus: 'slope' } } },
    { id: 'last', headline: () => 'Last', text: () => 'done', layers: [], finishLabel: 'Try ad valorem in Play →' },
  ];
  let c, ctx, onPredict, onPlayLink, onFinishFn, mounted;
  beforeEach(() => {
    document.body.innerHTML = '<section id="explain-card"></section>';
    c = document.getElementById('explain-card');
    ctx = { amount: 24, prediction: null };
    onPredict = vi.fn((id) => { ctx.prediction = id; mounted.refresh(); });
    onPlayLink = vi.fn();
    onFinishFn = vi.fn();
    mounted = mountExplainCard(c, {
      steps: STEPS, amount: 24, getContext: () => ctx,
      onRender: vi.fn(), onAmount() {}, onFinish: onFinishFn, onPredict, onPlayLink,
    });
  });
  const button = (t) => [...c.querySelectorAll('button')].find((b) => b.textContent === t);

  it('shows the guesses only on a predict step, and keeps Next locked until one is picked', () => {
    expect(c.querySelector('.explain-predict').hidden).toBe(true);
    mounted.goTo(1);
    expect(c.querySelector('.explain-predict').hidden).toBe(false);
    expect([...c.querySelectorAll('.explain-predict button')].map((b) => b.textContent)).toEqual(['All 24p', 'Some of it', 'None of it']);
    expect(button('Make a guess').disabled).toBe(true);
    button('Some of it').click();
    expect(onPredict).toHaveBeenCalledWith('some');
    expect(c.textContent).toContain('you said some');
    expect(button('Next').disabled).toBe(false);
    // The guess is made: it stays marked and the others can't be picked now.
    expect(button('Some of it').getAttribute('aria-pressed')).toBe('true');
    expect(button('All 24p').disabled).toBe(true);
  });

  it('offers a step’s own way into Play beside Next, and the last step’s own label', () => {
    mounted.goTo(2);
    button('Try elasticity in Play →').click();
    expect(onPlayLink).toHaveBeenCalledWith({ focus: 'slope' });
    expect(button('Next')).toBeDefined();
    mounted.goTo(3);
    expect(button('Try elasticity in Play →')).toBeUndefined();
    button('Try ad valorem in Play →').click();
    expect(onFinishFn).toHaveBeenCalled();
  });

  it('waitFor hides the words until the promise settles, unless the student has moved on', async () => {
    mounted.goTo(1);
    let done;
    mounted.waitFor(new Promise((r) => { done = r; }));
    expect(c.classList.contains('explain-card--waiting')).toBe(true);
    done();
    await new Promise((r) => setTimeout(r, 0));
    expect(c.classList.contains('explain-card--waiting')).toBe(false);
  });
});
