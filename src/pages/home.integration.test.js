import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initHomePage } from './home.js';

function bodyOf(html) {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  return match[1];
}

describe('initHomePage against the real index.html markup', () => {
  beforeEach(() => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(join(dir, '..', '..', 'index.html'), 'utf8');
    document.body.innerHTML = bodyOf(html);
    initHomePage(document);
  });

  it('wires up against the real ids without throwing, and renders all 4 tiles', () => {
    expect(document.querySelectorAll('#bento a.bento__tile')).toHaveLength(4);
  });

  it('gives the search input an accessible name, since the placeholder alone is not one', () => {
    const input = document.querySelector('#search-input');
    expect(input.getAttribute('aria-label')).toBeTruthy();
  });

  it('marks the no-results message as a polite live region, so screen readers hear it appear', () => {
    const noResults = document.querySelector('#no-results');
    expect(noResults.getAttribute('aria-live')).toBe('polite');
  });

  it('applies the .no-results class so the empty-search message is styled, not raw text', () => {
    const noResults = document.querySelector('#no-results');
    expect(noResults.className).toContain('no-results');
  });
});
