import { describe, it, expect, beforeEach } from 'vitest';
import { renderHero, renderMiniHeader } from './chrome.js';

describe('renderHero', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders the eyebrow, title, and lede text into the container', () => {
    renderHero(container, {
      eyebrow: 'IB ECONOMICS',
      title: 'Understand the graph, not just the answer',
      lede: 'Interactive diagrams for IB Economics revision.',
    });
    expect(container.querySelector('.eyebrow').textContent).toBe('IB ECONOMICS');
    expect(container.querySelector('h1').textContent).toBe('Understand the graph, not just the answer');
    expect(container.querySelector('.lede').textContent).toBe('Interactive diagrams for IB Economics revision.');
  });
});

describe('renderMiniHeader', () => {
  it('renders a link back to the homepage and the given title', () => {
    const container = document.createElement('div');
    renderMiniHeader(container, { title: 'Microeconomics' });
    const link = container.querySelector('.mini-header__home');
    expect(link.getAttribute('href')).toBe('/index.html');
    expect(container.querySelector('.mini-header__title').textContent).toBe('Microeconomics');
  });

  it('honors an explicit base path, so the home link still works under a GitHub Pages project subpath', () => {
    const container = document.createElement('div');
    renderMiniHeader(container, { title: 'Microeconomics', base: '/Graphonomicon/' });
    const link = container.querySelector('.mini-header__home');
    expect(link.getAttribute('href')).toBe('/Graphonomicon/index.html');
  });

  it('renders no back link when backHref is not given', () => {
    const container = document.createElement('div');
    renderMiniHeader(container, { title: 'Microeconomics' });
    expect(container.querySelector('.mini-header__back')).toBeNull();
  });

  it('renders a back link to one level up when backHref/backLabel are given', () => {
    const container = document.createElement('div');
    renderMiniHeader(container, {
      title: 'Government Intervention',
      backHref: '/units/microeconomics.html',
      backLabel: 'Microeconomics',
    });
    const back = container.querySelector('.mini-header__back');
    expect(back.getAttribute('href')).toBe('/units/microeconomics.html');
    expect(back.textContent).toContain('Microeconomics');
  });

  it('renders sibling links after the title, excluding the current page', () => {
    const container = document.createElement('div');
    renderMiniHeader(container, {
      title: 'Subsidy',
      siblings: [
        { name: 'Price ceiling', href: '/a.html', current: false },
        { name: 'Subsidy', href: '/b.html', current: true },
        { name: 'Indirect tax', href: '/c.html', current: false },
      ],
    });
    const links = container.querySelectorAll('.mini-header__siblings a');
    expect(links).toHaveLength(2);
    expect([...links].map((a) => a.textContent)).toEqual(['Price ceiling', 'Indirect tax']);
  });

  it('renders no siblings row when no siblings are given', () => {
    const container = document.createElement('div');
    renderMiniHeader(container, { title: 'Microeconomics' });
    expect(container.querySelector('.mini-header__siblings')).toBeNull();
  });
});
