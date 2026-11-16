import { migrateSnapshot } from '../lib/snapshot.js';

// The corner tray of frozen graphs: a fixed overlay (never in the page's layout flow), one
// small thumbnail per frozen graph redrawn at thumbnail width, and the button that opens the
// gallery. `flyIn` is the freeze animation: a scaled transient copy of the live chart
// travels to the tray, then the real thumbnail (already drawn) takes its place.

const SVG_NS = 'http://www.w3.org/2000/svg';
const FLY_MS = 400;

export function mountCompareTray(doc, { store, drawSnapshot, onView }) {
  const root = doc.createElement('div');
  root.className = 'compare-tray';
  root.hidden = true;
  root.innerHTML = '<div class="compare-tray__thumbs"></div><button type="button" class="compare-tray__view"></button>';
  doc.body.append(root);
  const thumbs = root.querySelector('.compare-tray__thumbs');
  const viewButton = root.querySelector('.compare-tray__view');
  let visible = false;

  function render() {
    const entries = store.list().filter(({ snapshot }) => migrateSnapshot(snapshot));
    thumbs.textContent = '';
    entries.forEach(({ snapshot }) => {
      const thumb = doc.createElement('div');
      thumb.className = 'compare-tray__thumb';
      const svg = doc.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'market-chart');
      svg.setAttribute('aria-hidden', 'true');
      thumb.append(svg);
      thumbs.append(thumb);
      drawSnapshot(svg, snapshot);
    });
    viewButton.textContent = `View (${entries.length})`;
    root.hidden = !visible || entries.length === 0;
  }

  const unsubscribe = store.subscribe(render);
  viewButton.addEventListener('click', () => onView());
  render();

  return {
    setVisible(next) { visible = next; render(); },
    flyIn(fromSvg) {
      const win = doc.defaultView;
      const reduced = win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced || typeof fromSvg.animate !== 'function') return Promise.resolve();
      const from = fromSvg.getBoundingClientRect();
      const lastThumb = thumbs.lastElementChild ?? root;
      const to = lastThumb.getBoundingClientRect();
      const flyer = fromSvg.cloneNode(true);
      flyer.classList.add('compare-tray__flyer');
      Object.assign(flyer.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, margin: '0', zIndex: '70', pointerEvents: 'none', transformOrigin: 'top left' });
      doc.body.append(flyer);
      const scale = from.width ? to.width / from.width : 0.2;
      const animation = flyer.animate(
        [{ transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})`, opacity: 0.6 }],
        { duration: FLY_MS, easing: 'ease-in-out' },
      );
      return animation.finished.catch(() => {}).then(() => flyer.remove());
    },
    destroy() { unsubscribe(); root.remove(); },
  };
}
