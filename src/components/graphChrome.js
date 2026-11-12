import { getDetailLevel, setDetailLevel, hasSeenTour, markTourSeen } from '../lib/prefs.js';
import { mountDetailSettings } from './detailSettings.js';
import { startTour, mountReplayButton } from './tour.js';

// The shared extras every graph page gets: the detail-settings gear on the chart card, the
// bottom-left replay button, and the first-visit walkthrough. Each page supplies its own
// tour steps (built for the current detail level) and re-renders on a detail change.
// A page with its own view switch passes detailSettings: false: no gear, and the chart is
// always drawn at the IB level.
export function initGraphChrome(doc, { chartHead, steps, onDetailChange, detailSettings = true }) {
  let detail = detailSettings ? getDetailLevel() : 'ib';
  let tour = null;

  if (detailSettings) {
    mountDetailSettings(chartHead, {
      level: detail,
      onChange(level) {
        setDetailLevel(level);
        detail = level;
        onDetailChange(level);
      },
    });
  }

  const chrome = {
    getDetail: () => detail,
    startTour() {
      tour?.end();
      tour = startTour(doc, steps(detail), { onDone: () => { tour = null; } });
    },
  };

  mountReplayButton(doc, () => chrome.startTour());
  return chrome;
}

// Called by the page after its first render, so the tour's targets are laid out. Marked
// seen before it starts: a student who closes the tab mid-tour isn't shown it again. If the
// flag can't be saved (storage reads but won't write), skip it rather than nag every load.
export function maybeAutoStartTour(chrome, win = window) {
  if (hasSeenTour(win) || !markTourSeen(win)) return;
  chrome.startTour();
}

// The standard walkthrough for an intervention page (price ceiling, floor, tax, subsidy).
// The "tap a shaded area" step only appears on pages whose regions are clickable (they stay
// clickable at every detail level).
export function interventionTourSteps({ policyName, sliderNoun, clickableRegions, viewSwitch = false, explorerOnly = false }) {
  return [
    {
      target: '.toggle-row--primary',
      title: 'Turn the policy on and off.',
      text: `Flip this switch to impose the ${policyName} on the free market, and watch the graph change.`,
    },
    {
      // Only the panels that hold sliders — not the "Real world examples" panel.
      target: '.sidebar .panel:has(input[type="range"])',
      title: 'Drag anything.',
      text: `These sliders move the ${sliderNoun}, shift demand and supply, and change how steep the curves are. Everything updates live.`,
    },
    ...(clickableRegions ? [{
      target: '#chart',
      title: 'Tap a shaded area',
      text: 'to see what it means and how big it is.',
    }] : []),
    explorerOnly
      ? {
        target: '.focus-bar',
        title: 'Pick something to highlight.',
        text: 'Choose an area to see it on its own, one at a time.',
      }
      : viewSwitch
      ? {
        target: '.view-switch',
        title: 'Switch views.',
        text: 'IB perfect is the diagram to draw in an exam; Explorer lets you highlight one area at a time.',
      }
      : {
        target: '.detail-gear',
        title: 'Change how much you see.',
        text: 'This gear switches between a fully annotated diagram and IB perfect, the version to replicate on exams.',
      },
  ];
}
