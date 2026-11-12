const MODES = [['explain', 'Explain'], ['play', 'Play']];

// Explain | Play segmented control for a chart head. Fires onChange on user change only;
// setMode (used for URL/back-button sync) never does.
export function mountModeSwitch(chartHead, { mode, onChange }) {
  const doc = chartHead.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'mode-switch seg';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', 'Page mode');
  root.innerHTML = MODES.map(([v, label]) =>
    `<label class="seg__opt"><input type="radio" name="page-mode" value="${v}"><span>${label}</span></label>`).join('');
  chartHead.append(root);

  const radios = [...root.querySelectorAll('input[name="page-mode"]')];
  const setMode = (m) => { radios.forEach((r) => { r.checked = r.value === m; }); };
  setMode(mode);

  root.addEventListener('change', (e) => {
    if (e.target.name === 'page-mode') onChange(e.target.value);
  });

  return { setMode };
}

// Text link for pages whose default is Play: "Wait, how does this work?" opens Explain, and in
// Explain it reads "Back to Play". It sits in `playHost` (the page header) in Play and moves to
// `explainHost` (the chart head) in Explain, where the header is hidden. Fires onChange on user click only.
export function mountModeLink({ playHost, explainHost, mode, onChange }) {
  const doc = playHost.ownerDocument;
  const link = doc.createElement('button');
  link.type = 'button';
  link.className = 'mode-link';

  let current = mode;
  const setMode = (m) => {
    current = m;
    link.dataset.mode = m;
    link.textContent = m === 'play' ? 'Wait, how does this work?' : '← Back to Play';
    (m === 'play' ? playHost : explainHost).append(link);
  };
  setMode(mode);

  link.addEventListener('click', () => onChange(current === 'play' ? 'explain' : 'play'));

  return { setMode };
}
