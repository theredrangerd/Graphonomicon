import { createCompareStore, MAX_FROZEN } from '../lib/compareStore.js';
import { createSnapshot } from '../lib/snapshot.js';
import { mountCompareTray } from './compareTray.js';
import { openCompareGallery } from './compareGallery.js';

// Compare mode for one page visit: a Compare button in the chart header reveals Freeze, each
// freeze parks the current state in the corner tray, and View opens the gallery. Frozen
// graphs live in memory only and survive leaving and re-entering compare mode.

export function mountCompareMode(doc, { chartHead, chart, page, getState, drawSnapshot, applyState, labelOptions }) {
  const store = createCompareStore();
  let active = false;

  const toggleButton = doc.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'compare-toggle';
  toggleButton.textContent = 'Compare';
  toggleButton.setAttribute('aria-pressed', 'false');

  const freezeButton = doc.createElement('button');
  freezeButton.type = 'button';
  freezeButton.className = 'compare-freeze';
  freezeButton.textContent = 'Freeze';
  freezeButton.hidden = true;

  const note = doc.createElement('span');
  note.className = 'compare-note';
  note.setAttribute('role', 'status');

  chartHead.append(toggleButton, freezeButton, note);

  const tray = mountCompareTray(doc, {
    store,
    drawSnapshot,
    onView: () => !doc.querySelector('.compare-gallery') && openCompareGallery(doc, { store, drawSnapshot, labelOptions, onEdit: (snapshot) => applyState(snapshot.state) }),
  });

  function setActive(next) {
    active = next;
    toggleButton.setAttribute('aria-pressed', String(active));
    freezeButton.hidden = !active;
    note.textContent = '';
    tray.setVisible(active);
  }

  function freeze() {
    const added = store.add(createSnapshot({ page, state: getState() }));
    if (!added.ok) {
      note.textContent = `You can freeze up to ${MAX_FROZEN} graphs. Delete one in the gallery to add another.`;
      return added;
    }
    note.textContent = '';
    tray.flyIn(chart);
    return added;
  }

  toggleButton.addEventListener('click', () => setActive(!active));
  freezeButton.addEventListener('click', freeze);

  return {
    enter: () => setActive(true),
    exit: () => setActive(false),
    freeze,
    isActive: () => active,
    destroy() {
      tray.destroy();
      toggleButton.remove();
      freezeButton.remove();
      note.remove();
    },
  };
}
