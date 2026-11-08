// src/pages/home.js
import { renderHero, renderSiteBar, renderFooter } from '../components/chrome.js';
import { renderBento } from '../components/bento.js';
import { renderSearchResults } from '../components/searchResults.js';
import { matchGraphs } from '../components/search.js';
import { getUnits, unitHref, familyHref, diagramHref } from '../lib/units.js';

function withHrefs(units) {
  return units.map((unit) => ({ ...unit, href: unitHref(unit) }));
}

function toResultGroups(matchGroups) {
  return matchGroups.map(({ unit, matches }) => ({
    unit,
    href: unitHref(unit),
    matches: matches.map((match) => ({
      label: match.label,
      level: match.level,
      context: match.context,
      href: match.kind === 'family'
        ? familyHref(unit, match.family)
        : diagramHref(unit, match.family, match.diagram),
    })),
  }));
}

export function initHomePage(doc) {
  const heroEl = doc.querySelector('#hero');
  const bentoEl = doc.querySelector('#bento');
  const resultsEl = doc.querySelector('#search-results');
  const searchInput = doc.querySelector('#search-input');
  const noResultsEl = doc.querySelector('#no-results');

  const siteBarEl = doc.querySelector('#site-bar');
  if (siteBarEl) renderSiteBar(siteBarEl);
  renderFooter(doc);

  renderHero(heroEl, {
    title: 'Drag the control. Watch the market move.',
    lede: 'Interactive IB Economics graphs. Change a price control, tax or subsidy and see surplus, revenue and deadweight loss redraw in their own colours.',
  });

  const units = getUnits();
  renderBento(bentoEl, withHrefs(units));

  searchInput.addEventListener('input', () => {
    const matchGroups = matchGraphs(searchInput.value, units);

    if (matchGroups === null) {
      bentoEl.hidden = false;
      resultsEl.hidden = true;
      renderBento(bentoEl, withHrefs(units));
      noResultsEl.hidden = true;
      return;
    }

    bentoEl.hidden = true;
    resultsEl.hidden = false;
    const groups = toResultGroups(matchGroups);
    renderSearchResults(resultsEl, groups);
    noResultsEl.hidden = groups.length !== 0;
  });
}
