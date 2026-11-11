// Resolves once every finite CSS animation running inside `root` (a chart's svg) has finished,
// or after `timeout` ms. Returns null when nothing is animating (or the browser has no Web
// Animations API, e.g. jsdom), so callers can skip waiting. Looping attention-getters (the drag
// hint, the halo's pulse) are ignored: they never finish and aren't "the animation".
export function whenAnimationsDone(root, { timeout = 15000 } = {}) {
  if (!root || typeof root.getAnimations !== 'function') return null;
  const running = root.getAnimations({ subtree: true }).filter((a) => (
    a.playState !== 'finished' && a.effect?.getComputedTiming?.().iterations !== Infinity
  ));
  if (!running.length) return null;
  const done = Promise.allSettled(running.map((a) => a.finished));
  const cap = new Promise((resolve) => setTimeout(resolve, timeout));
  return Promise.race([done, cap]);
}
