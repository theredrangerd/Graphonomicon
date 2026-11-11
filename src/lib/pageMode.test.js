import { describe, it, expect, vi } from 'vitest';
import { readMode, writeMode, onModeChange, readPlayView, writePlayView } from './pageMode.js';

function fakeWin(url = 'https://x.test/p.html') {
  const u = new URL(url);
  const listeners = {};
  const win = {
    location: { get search() { return u.search; }, get hash() { return u.hash; }, get pathname() { return u.pathname; } },
    history: { replaceState: vi.fn((s, t, next) => { const n = new URL(next, u); u.search = n.search; u.hash = n.hash; }) },
    addEventListener: (t, f) => { (listeners[t] ||= new Set()).add(f); },
    removeEventListener: (t, f) => { listeners[t]?.delete(f); },
    fire: (t) => (listeners[t] || []).forEach((f) => f()),
    setHash: (h) => { u.hash = h; },
  };
  return win;
}

describe('mode hash', () => {
  it('reads explain only for #explain', () => {
    expect(readMode(fakeWin())).toBe('play');
    expect(readMode(fakeWin('https://x.test/p.html#explain'))).toBe('explain');
    expect(readMode(fakeWin('https://x.test/p.html#foo'))).toBe('play');
  });
  it('writes the hash via replaceState keeping path and query', () => {
    const w = fakeWin('https://x.test/p.html?a=1');
    writeMode('explain', w);
    expect(w.history.replaceState).toHaveBeenCalledWith(null, '', '/p.html?a=1#explain');
    expect(readMode(w)).toBe('explain');
  });
  it('does not throw when history fails', () => {
    const w = fakeWin();
    w.history.replaceState = () => { throw new Error('no'); };
    expect(() => writeMode('play', w)).not.toThrow();
  });
  it('onModeChange fires on hashchange and unsubscribes', () => {
    const w = fakeWin();
    const cb = vi.fn();
    const off = onModeChange(cb, w);
    w.setHash('#explain');
    w.fire('hashchange');
    expect(cb).toHaveBeenCalledWith('explain');
    off();
    w.fire('hashchange');
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('play view params', () => {
  it('defaults to ib and ignores bogus values', () => {
    expect(readPlayView(fakeWin('https://x.test/p.html?view=bogus'))).toEqual({ view: 'ib', focus: null });
    expect(readPlayView(fakeWin())).toEqual({ view: 'ib', focus: null });
  });
  it('focus implies explorer', () => {
    expect(readPlayView(fakeWin('https://x.test/p.html?focus=cs'))).toEqual({ view: 'explorer', focus: 'cs' });
  });
  it('invalid focus is ignored', () => {
    expect(readPlayView(fakeWin('https://x.test/p.html?view=explorer&focus=nope'))).toEqual({ view: 'explorer', focus: null });
  });
  it('ib view clears params but keeps others and hash', () => {
    const w = fakeWin('https://x.test/p.html?view=explorer&focus=cs&x=1#play');
    writePlayView({ view: 'ib', focus: null }, w);
    expect(w.history.replaceState).toHaveBeenCalledWith(null, '', '/p.html?x=1#play');
  });
  it('explorer sets view and focus only when non-null', () => {
    const w = fakeWin('https://x.test/p.html#play');
    writePlayView({ view: 'explorer', focus: null }, w);
    expect(w.history.replaceState).toHaveBeenLastCalledWith(null, '', '/p.html?view=explorer#play');
    writePlayView({ view: 'explorer', focus: 'dwl' }, w);
    expect(w.history.replaceState).toHaveBeenLastCalledWith(null, '', '/p.html?view=explorer&focus=dwl#play');
  });
});

describe('stale detail param', () => {
  it('writeMode drops a leftover detail param and keeps the rest', () => {
    const w = fakeWin('https://x.test/p.html?detail=full&view=explorer');
    writeMode('play', w);
    expect(w.location.search).toBe('?view=explorer');
  });
  it('writePlayView drops a leftover detail param', () => {
    const w = fakeWin('https://x.test/p.html?detail=ib#play');
    writePlayView({ view: 'ib', focus: null }, w);
    expect(w.location.search).toBe('');
    expect(w.location.hash).toBe('#play');
  });
  it('readPlayView only accepts a focus from the page\'s own list', () => {
    expect(readPlayView(fakeWin('https://x.test/p.html?focus=revenue'), ['cs', 'ps', 'revenue', 'dwl'])).toEqual({ view: 'explorer', focus: 'revenue' });
    expect(readPlayView(fakeWin('https://x.test/p.html?view=explorer&focus=overlap'), ['cs', 'ps', 'revenue', 'dwl'])).toEqual({ view: 'explorer', focus: null });
  });
});
