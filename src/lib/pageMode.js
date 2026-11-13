// URL state for the Explain/Play pages (subsidy, indirect tax): Explain/Play mode lives in the hash, the Play view
// (IB perfect vs Explorer) and Explorer focus live in query params. All writes use
// replaceState so toggling never piles up history entries, and a failing history API
// just leaves the address bar as it was.

import { FOCUS_IDS } from './marketChart.js';

const VIEW_PARAM = 'view';
const FOCUS_PARAM = 'focus';
// These pages have no detail levels; an old link's ?detail= is dropped on the next write.
const STALE_PARAMS = ['detail'];

export function readMode(win = window) {
  return win.location.hash === '#explain' ? 'explain' : 'play';
}

function replaceUrl(win, params, hash) {
  STALE_PARAMS.forEach((name) => params.delete(name));
  const qs = params.toString();
  try {
    win.history.replaceState(null, '', `${win.location.pathname}${qs ? `?${qs}` : ''}${hash}`);
  } catch { /* history unavailable: the address bar just stays as it was */ }
}

export function writeMode(mode, win = window) {
  replaceUrl(win, new URLSearchParams(win.location.search), mode === 'explain' ? '#explain' : '#play');
}

export function onModeChange(cb, win = window) {
  const handler = () => cb(readMode(win));
  win.addEventListener('hashchange', handler);
  return () => win.removeEventListener('hashchange', handler);
}

// `focusIds` is the page's own focus list, so a link can't pick a focus the page doesn't offer.
// `aliases` maps a retired focus id to its replacement, so links already shared keep working.
// `defaultView` is what a link with no view/focus opens on.
export function readPlayView(win = window, focusIds = FOCUS_IDS, aliases = {}, defaultView = 'ib') {
  const params = new URLSearchParams(win.location.search);
  const raw = params.get(FOCUS_PARAM);
  const rawFocus = aliases[raw] ?? raw;
  const focus = focusIds.includes(rawFocus) ? rawFocus : null;
  const view = focus || params.get(VIEW_PARAM) === 'explorer' || defaultView === 'explorer' ? 'explorer' : 'ib';
  return { view, focus };
}

export function writePlayView({ view, focus }, win = window) {
  const params = new URLSearchParams(win.location.search);
  params.delete(VIEW_PARAM);
  params.delete(FOCUS_PARAM);
  if (view === 'explorer') {
    params.set(VIEW_PARAM, 'explorer');
    if (focus) params.set(FOCUS_PARAM, focus);
  }
  replaceUrl(win, params, win.location.hash);
}
