import { migrateSnapshot } from '../lib/snapshot.js';
import { labelSnapshots } from '../lib/snapshotLabels.js';

// Full-screen gallery of the frozen graphs: two cards on screen at a time (one below the
// mobile breakpoint), slid sideways with native scroll-snap. Cards redraw their snapshot
// through `drawSnapshot` at their own width, so chart text stays real-pixel sized.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function openCompareGallery(doc, { store, drawSnapshot, labelOptions, onClose, onEdit }) {
  const opener = doc.activeElement;
  const root = doc.createElement('div');
  root.className = 'compare-gallery';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Compare frozen graphs');
  root.innerHTML = `
    <div class="compare-gallery__bar">
      <h2 class="compare-gallery__title">Compare graphs</h2>
      <button type="button" class="compare-gallery__close">Close</button>
    </div>
    <div class="compare-gallery__stage">
      <button type="button" class="compare-gallery__prev" aria-label="Previous graph">‹</button>
      <div class="compare-gallery__track" tabindex="0"></div>
      <button type="button" class="compare-gallery__next" aria-label="Next graph">›</button>
    </div>
    <div class="compare-gallery__dots"></div>`;
  doc.body.append(root);
  const track = root.querySelector('.compare-gallery__track');
  const dots = root.querySelector('.compare-gallery__dots');

  const step = (dir) => {
    const first = track.firstElementChild;
    const width = first ? first.getBoundingClientRect().width : 0;
    track.scrollBy?.({ left: dir * width, behavior: 'smooth' });
  };

  function render() {
    const entries = store.list()
      .map(({ id, snapshot }) => ({ id, snapshot: migrateSnapshot(snapshot) }))
      .filter((e) => e.snapshot);
    track.textContent = '';
    dots.textContent = '';
    if (!entries.length) {
      const empty = doc.createElement('p');
      empty.className = 'compare-gallery__empty';
      empty.textContent = 'Nothing frozen yet. Close this, set up a graph and press Freeze.';
      track.append(empty);
      return;
    }
    const titles = labelSnapshots(entries.map((e) => e.snapshot), labelOptions);
    entries.forEach(({ id, snapshot }, i) => {
      const card = doc.createElement('section');
      card.className = 'compare-card';
      card.innerHTML = `
        <header class="compare-card__head">
          <h3 class="compare-card__title"></h3>
          <span class="compare-card__actions">
            <button type="button" class="compare-card__edit">Edit this graph</button>
            <button type="button" class="compare-card__delete" aria-label="Delete this graph">Delete</button>
          </span>
        </header>`;
      card.querySelector('.compare-card__title').textContent = titles[i];
      const svg = doc.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'market-chart');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', titles[i]);
      card.append(svg);
      card.querySelector('.compare-card__delete').addEventListener('click', () => store.remove(id));
      card.querySelector('.compare-card__edit').addEventListener('click', () => { close(); onEdit?.(snapshot); });
      track.append(card);
      drawSnapshot(svg, snapshot);

      const dot = doc.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Go to graph ${i + 1}`);
      dot.addEventListener('click', () => card.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' }));
      dots.append(dot);
    });
    syncDots();
  }

  function syncDots() {
    const cardEls = [...track.querySelectorAll('.compare-card')];
    if (!cardEls.length) return;
    const width = cardEls[0].getBoundingClientRect().width || 1;
    const lead = Math.round(track.scrollLeft / width);
    [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === lead || i === lead + 1)));
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  }

  let closed = false;
  const unsubscribe = store.subscribe(render);
  function close() {
    if (closed) return;
    closed = true;
    unsubscribe();
    doc.removeEventListener('keydown', onKey);
    root.remove();
    opener?.focus?.();
    onClose?.();
  }

  root.querySelector('.compare-gallery__close').addEventListener('click', close);
  root.querySelector('.compare-gallery__prev').addEventListener('click', () => step(-1));
  root.querySelector('.compare-gallery__next').addEventListener('click', () => step(1));
  track.addEventListener('scroll', syncDots, { passive: true });
  doc.addEventListener('keydown', onKey);
  render();
  root.querySelector('.compare-gallery__close').focus();
  return { close };
}
