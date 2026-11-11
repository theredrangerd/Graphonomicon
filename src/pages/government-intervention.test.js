import { describe, it, expect, beforeEach } from 'vitest';
import { initGovernmentInterventionPage } from './government-intervention.js';

describe('initGovernmentInterventionPage', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="mini-header"></div>
      <div id="hero"></div>
      <div id="diagram-bento"></div>
      <iframe id="feedback-form"></iframe>
    `;
    initGovernmentInterventionPage(document);
  });

  it('renders one tile per diagram in the family', () => {
    expect(document.querySelectorAll('#diagram-bento a.bento__tile')).toHaveLength(4);
  });

  it('links the four built diagrams to their real pages with an SL pill', () => {
    const link = document.querySelector('a[href="/units/microeconomics/government-intervention/price-ceiling.html"]');
    expect(link).not.toBeNull();
    expect(link.querySelector('.level-pill').textContent).toBe('SL');
    expect(link.querySelector('.bento__badge')).toBeNull();
  });

  it('splits the Subsidy and Indirect tax tiles into Explain and Play, but not the price controls', () => {
    const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    click(document.querySelector('a[href$="/price-ceiling.html"]'));
    expect(document.querySelector('.bento__split')).toBeNull();
    for (const slug of ['subsidy', 'indirect-tax']) {
      click(document.querySelector(`a[href$="/${slug}.html"]`));
      const links = document.querySelectorAll('.bento__split a.bento__mode');
      expect(links).toHaveLength(2);
      expect(links[0].textContent).toBe('Explain');
      expect(links[0].getAttribute('href').endsWith(`${slug}.html#explain`)).toBe(true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
  });
});
