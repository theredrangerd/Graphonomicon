// Resolves once every finite CSS animation running inside `root` (a chart's svg) has finished,
// or after `timeout` ms. Returns null when nothing is animating (or the browser has no Web
// Animations API, e.g. jsdom), so callers can skip waiting. Looping attention-getters (the drag
// hint, the halo's pulse) are ignored: they never finish and aren't "the animation".
export function whenAnimationsDone(root, { timeout = 15000, only } = {}) {
  if (!root || typeof root.getAnimations !== 'function') return null;
  // `only`: a selector; just animations running on elements matching it count (a step can
  // reveal its words once its main mark is in, while later extras are still to come).
  const running = root.getAnimations({ subtree: true }).filter((a) => (
    a.playState !== 'finished' && a.effect?.getComputedTiming?.().iterations !== Infinity
    && (!only || a.effect?.target?.matches?.(only))
  ));
  if (!running.length) return null;
  const done = Promise.allSettled(running.map((a) => a.finished));
  const cap = new Promise((resolve) => setTimeout(resolve, timeout));
  return Promise.race([done, cap]);
}
