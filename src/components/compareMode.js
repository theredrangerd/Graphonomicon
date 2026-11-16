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
  // The frozen graph being edited, if any: further changes on the live page save into it.
  let editingId = null;
  const EDIT_NOTE = 'Editing a frozen graph: your changes save to it. Freeze adds a copy.';

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

  const doneButton = doc.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'compare-done';
  doneButton.textContent = 'Done editing';
  doneButton.hidden = true;

  const note = doc.createElement('span');
  note.className = 'compare-note';
  note.setAttribute('role', 'status');

  chartHead.append(toggleButton, freezeButton, doneButton, note);

  const tray = mountCompareTray(doc, {
    store,
    drawSnapshot,
    onView: () => !doc.querySelector('.compare-gallery') && openCompareGallery(doc, { store, drawSnapshot, labelOptions, onEdit: startEditing }),
  });

  function startEditing(snapshot, id) {
    editingId = id;
    doneButton.hidden = false;
    note.textContent = EDIT_NOTE;
    applyState(snapshot.state);
  }

  function stopEditing() {
    editingId = null;
    doneButton.hidden = true;
    note.textContent = '';
  }

  // The page calls this after its state changes; while a frozen graph is being edited, the
  // change is saved into it (only when something actually differs, so tween frames don't churn).
  function notifyChange() {
    if (editingId == null) return;
    const current = store.list().find((e) => e.id === editingId);
    if (!current) { stopEditing(); return; }
    const next = createSnapshot({ page, state: getState() });
    if (JSON.stringify(next.state) === JSON.stringify(current.snapshot.state)) return;
    store.update(editingId, { ...next, name: current.snapshot.name });
  }

  store.subscribe(() => {
    if (editingId != null && !store.list().some((e) => e.id === editingId)) stopEditing();
  });

  function setActive(next) {
    active = next;
    toggleButton.setAttribute('aria-pressed', String(active));
    freezeButton.hidden = !active;
    stopEditing();
    tray.setVisible(active);
  }

  function freeze() {
    const added = store.add(createSnapshot({ page, state: getState() }));
    if (!added.ok) {
      note.textContent = `You can freeze up to ${MAX_FROZEN} graphs. Delete one in the gallery to add another.`;
      return added;
    }
    note.textContent = editingId != null ? EDIT_NOTE : '';
    tray.flyIn(chart);
    return added;
  }

  toggleButton.addEventListener('click', () => setActive(!active));
  freezeButton.addEventListener('click', freeze);
  doneButton.addEventListener('click', stopEditing);

  return {
    enter: () => setActive(true),
    exit: () => setActive(false),
    freeze,
    notifyChange,
    isActive: () => active,
    destroy() {
      tray.destroy();
      toggleButton.remove();
      freezeButton.remove();
      doneButton.remove();
      note.remove();
    },
  };
}
