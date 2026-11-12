import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSubsidyPage } from './subsidy.js';

function bodyOf(html) {
  return html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
}

describe('initSubsidyPage against the real page markup', () => {
  beforeEach(() => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(join(dir, '..', '..', 'units', 'microeconomics', 'government-intervention', 'subsidy.html'), 'utf8');
    document.body.innerHTML = bodyOf(html);
  });

  it('wires up against the real ids without throwing, and shows the free-market default', () => {
    expect(() => initSubsidyPage(document)).not.toThrow();
    expect(document.querySelector('#stat-cost').textContent).toBe('$0');
  });

  it('applies the subsidy outcome once the subsidy toggle is switched on', () => {
    initSubsidyPage(document);
    document.querySelector('#subsidy-toggle').checked = true;
    document.querySelector('#subsidy-toggle').dispatchEvent(new Event('change'));
    expect(document.querySelector('#stat-cost').textContent).toBe('$1,350');
  });

  it('renders a mini-header back link plus sibling diagram links, with no separate family-nav row', () => {
    initSubsidyPage(document);
    const back = document.querySelector('#mini-header a.mini-header__back');
    expect(back).not.toBeNull();
    expect(back.getAttribute('href')).toBe('/units/microeconomics/government-intervention.html');
    const siblingLinks = document.querySelectorAll('#mini-header .mini-header__siblings a');
    expect(siblingLinks.length).toBeGreaterThan(0);
    expect(document.querySelector('#family-nav')).toBeNull();
  });

  it('names the dashed box "Government spending" in the legend', () => {
    expect(document.querySelector('.legend [data-legend="gov"]').textContent.trim()).toBe('Government spending');
  });

  it('has the Explain card, the outcome panel id and every legend key', () => {
    expect(document.querySelector('#explain-card')).not.toBeNull();
    expect(document.querySelector('#outcome-panel')).not.toBeNull();
    const keys = [...document.querySelectorAll('.legend [data-legend]')].map((i) => i.dataset.legend);
    expect(keys).toEqual(expect.arrayContaining(['demand', 'supply', 'cs', 'ps', 'gov', 'dwl', 'marginal-cs', 'marginal-ps']));
    expect(keys).not.toContain('overlap');;
    expect(document.querySelector('[data-legend="marginal-cs"]').textContent).toBe('Marginal consumer surplus');
    expect(document.querySelector('[data-legend="marginal-ps"]').textContent).toBe('Marginal producer surplus');
  });

  it('labels the incidence tiles as marginal consumer / producer surplus', () => {
    const label = (id) => document.querySelector(id).closest('.stat').querySelector('.k').textContent;
    expect(label('#stat-incidence-consumer')).toBe('Marginal consumer surplus');
    expect(label('#stat-incidence-producer')).toBe('Marginal producer surplus');
  });

  it('renders three real-world example links that open in a new tab safely', () => {
    const links = document.querySelectorAll('.examples-list a');
    expect(links).toHaveLength(3);
    links.forEach((link) => {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  it('shows the elasticity simplification disclaimer, linked to the Elasticity stub', () => {
    initSubsidyPage(document);
    const disclaimer = document.querySelector('.panel-disclaimer');
    expect(disclaimer.textContent).toMatch(/Simplified/);
    expect(document.querySelector('#elasticity-more').getAttribute('href')).toMatch(/wip\.html\?unit=elasticity$/);
  });
});
