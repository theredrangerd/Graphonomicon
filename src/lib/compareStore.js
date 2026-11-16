// The frozen graphs of one page visit, in memory only. Ids only ever increase, so a card
// keeps its identity across deletions.

export const MAX_FROZEN = 8;

export function createCompareStore() {
  let entries = [];
  let nextId = 1;
  const subscribers = new Set();
  const notify = () => subscribers.forEach((fn) => fn());

  return {
    add(snapshot) {
      if (entries.length >= MAX_FROZEN) return { ok: false, reason: 'full' };
      const id = nextId++;
      entries = [...entries, { id, snapshot }];
      notify();
      return { ok: true, id };
    },
    remove(id) {
      entries = entries.filter((e) => e.id !== id);
      notify();
    },
    list: () => [...entries],
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    clear() {
      entries = [];
      notify();
    },
  };
}
