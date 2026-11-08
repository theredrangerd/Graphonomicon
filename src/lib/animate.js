// Lightweight requestAnimationFrame tween. This project has no runtime dependencies
// (see package.json), and the only thing needed here is a single eased 0→1 ramp to
// animate an intervention's magnitude in/out — pulling in a full library (GSAP,
// anime.js) for that would be a heavy add to a static multi-page site.
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Under Vitest (jsdom, no real frame timing) jump straight to the end value instead of
// riding requestAnimationFrame — keeps page-controller tests synchronous and deterministic.
const SKIP_ANIMATION = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

// Runs `fn` after `ms`; immediately under Vitest, like tweenValue. Returns a cancel function.
export function delay(ms, fn) {
  if (SKIP_ANIMATION) { fn(); return () => {}; }
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
}

// Animates `from` -> `to`, calling onUpdate(value) every frame. Returns a cancel function.
export function tweenValue({ from, to, duration = 400, easing = easeOutCubic, onUpdate, onComplete }) {
  if (SKIP_ANIMATION) {
    onUpdate(to);
    if (onComplete) onComplete();
    return () => {};
  }
  const start = performance.now();
  let rafId = requestAnimationFrame(frame);
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    onUpdate(from + (to - from) * easing(t));
    if (t < 1) {
      rafId = requestAnimationFrame(frame);
    } else if (onComplete) {
      onComplete();
    }
  }
  return () => cancelAnimationFrame(rafId);
}
