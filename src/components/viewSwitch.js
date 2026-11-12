const VIEWS = [['ib', 'IB perfect'], ['explorer', 'Explorer']];
// What each subsidy lens asks, shown above the graph while it's selected: each lens is one
// stakeholder, and the question is the one an IB evaluation turns on.
export const SUBSIDY_QUESTIONS = Object.freeze({
  gov: "What is the impact on the government's budget?",
  cs: 'What is the impact on consumers?',
  ps: 'What is the impact on producers?',
  societal: 'Who captures what?',
});
// The status strip under the lens buttons says what the graph is showing: the whole diagram (what an
// exam asks you to draw) or one lens, which is only a part of it.
const WHOLE_NOTE = 'The whole picture. This is what to draw in an exam.';
const PART_NOTE = 'Only part of the diagram. Exams need all of it.';
// Each page's focus chips, in order: [focus id, chip label].
// Subsidy mirrors the tax page: the government perspective (spending and the deadweight loss it
// leaves), then one lens per side of the market (its free-market surplus and the marginal band
// the subsidy adds), then the societal lens (just those two bands and the deadweight loss). The ids stay cs / ps / gov so shared links keep working.
export const SUBSIDY_FOCUSES = Object.freeze([
  ['gov', 'Government'],
  ['cs', 'Consumers'],
  ['ps', 'Producers'],
  ['societal', 'Society'],
]);
// Focus ids a shared link may still carry from before the lenses, and what they open now.
export const SUBSIDY_FOCUS_ALIASES = Object.freeze({ dwl: 'societal', overlap: 'cs' });
// The government perspective ('revenue' in URLs, kept so shared links work) builds the tax box; each lens is one side of the market: its surplus, its tax burden and its half of the DWL.
export const TAX_FOCUSES = Object.freeze([
  ['revenue', 'Government perspective'],
  ['consumer-lens', 'Consumer lens'],
  ['producer-lens', 'Producer lens'],
]);
// Focus ids a shared link may still carry from before the lenses, and what they open now.
export const TAX_FOCUS_ALIASES = Object.freeze({
  cs: 'consumer-lens', 'consumer-burden': 'consumer-lens', ps: 'producer-lens', 'producer-burden': 'producer-lens',
});

// Price ceiling / floor: the free-market surpluses, the deadweight loss, and the gap bracket
// (shortage under a ceiling, excess supply under a floor — same 'gap' focus, own label).
export const CEILING_FOCUSES = Object.freeze([
  ['cs', 'Consumer surplus'],
  ['ps', 'Producer surplus'],
  ['gap', 'Shortage'],
  ['dwl', 'Deadweight loss'],
]);
export const FLOOR_FOCUSES = Object.freeze([
  ['cs', 'Consumer surplus'],
  ['ps', 'Producer surplus'],
  ['gap', 'Excess supply'],
  ['dwl', 'Deadweight loss'],
]);

// IB perfect | Explorer segmented control, plus the focus bar (inserted right after the
// chart head) of chips that pick one area to highlight in Explorer. DOM + callbacks only.
// `ibView: false` drops the IB perfect option: the page is Explorer only and shows just the focus bar.
// `questions` (focus id -> text) turns the bar into a row of tinted lens buttons with no prompt; the
// selected lens's question shows beneath it, above the graph.
export function mountViewSwitch(chartHead, { view, focus, focuses = SUBSIDY_FOCUSES, ibView = true, questions = null, onChange }) {
  const doc = chartHead.ownerDocument;
  const root = doc.createElement('div');
  root.className = 'view-switch seg';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', 'Graph view');
  root.innerHTML = VIEWS.map(([v, label]) =>
    `<label class="seg__opt"><input type="radio" name="play-view" value="${v}"><span>${label}</span></label>`).join('');
  if (ibView) chartHead.append(root);

  const bar = doc.createElement('div');
  bar.className = questions ? 'focus-bar focus-bar--lenses' : 'focus-bar';
  bar.innerHTML = `${questions ? '' : '<span class="focus-bar__prompt">Pick something to highlight:</span>'}${focuses.map(([id, label]) =>
    `<button type="button" class="focus-chip" data-focus="${id}" aria-pressed="false">${label}</button>`).join('')}${questions ? '<div class="focus-question" aria-live="polite"></div>' : ''}`;
  chartHead.after(bar);

  const radios = [...root.querySelectorAll('input[name="play-view"]')];
  const chips = [...bar.querySelectorAll('.focus-chip')];
  let state = { view: 'ib', focus: null };

  const paint = () => {
    radios.forEach((r) => { r.checked = r.value === state.view; });
    bar.hidden = state.view !== 'explorer';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.focus === state.focus)));
    const status = bar.querySelector('.focus-question');
    if (status) {
      status.dataset.focus = state.focus ?? '';
      status.innerHTML = questions[state.focus]
        // A lens: its question, the warning that it's only part of the picture, and the way back.
        ? `<div class="focus-question__text"><strong class="focus-question__q">${questions[state.focus]}</strong><span>${PART_NOTE}</span></div><button type="button" class="focus-question__back">Show the exam diagram</button>`
        // No lens: the whole diagram, which is what an exam asks for.
        : `<div class="focus-question__text"><strong class="focus-question__badge">IB exam diagram</strong><span>${WHOLE_NOTE}</span></div>`;
    }
  };
  const set = ({ view: v, focus: f = null }) => {
    state = { view: v, focus: v === 'explorer' ? f : null };
    paint();
  };
  const user = (next) => { set(next); onChange({ ...state }); };
  set({ view: ibView ? view : 'explorer', focus });

  root.addEventListener('change', (e) => {
    if (e.target.name === 'play-view') user({ view: e.target.value, focus: state.focus });
  });
  bar.addEventListener('click', (e) => {
    if (e.target.closest('.focus-question__back')) { user({ view: 'explorer', focus: null }); return; }
    const chip = e.target.closest('.focus-chip');
    if (!chip) return;
    user({ view: 'explorer', focus: state.focus === chip.dataset.focus ? null : chip.dataset.focus });
  });

  return { set };
}
