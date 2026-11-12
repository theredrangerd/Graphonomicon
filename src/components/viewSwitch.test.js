// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { mountViewSwitch } from './viewSwitch.js';

function setup(view = 'ib', focus = null) {
  document.body.innerHTML = '<div class="chart-head"></div>';
  const head = document.querySelector('.chart-head');
  const onChange = vi.fn();
  const api = mountViewSwitch(head, { view, focus, onChange });
  return { api, onChange, head, bar: document.querySelector('.focus-bar') };
}

describe('mountViewSwitch', () => {
  it('puts the focus bar right after the chart head, hidden at ib and shown at explorer', () => {
    const { head, bar, api } = setup('ib');
    expect(head.nextElementSibling).toBe(bar);
    expect(bar.hidden).toBe(true);
    api.set({ view: 'explorer', focus: null });
    expect(bar.hidden).toBe(false);
  });

  it('has the four subsidy chips, government perspective first like the tax page', () => {
    const { bar } = setup('explorer');
    expect([...bar.querySelectorAll('.focus-chip')].map((c) => c.textContent)).toEqual(
      ['Government perspective', 'Consumer lens', 'Producer lens', 'Societal lens']);
    expect(bar.textContent).toContain('Pick something to highlight:');
  });

  it('clicking a lens focuses it, clicking again clears it', () => {
    const { bar, onChange } = setup('explorer');
    const chip = bar.querySelector('[data-focus="cs"]');
    chip.click();
    expect(onChange).toHaveBeenLastCalledWith({ view: 'explorer', focus: 'cs' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    chip.click();
    expect(onChange).toHaveBeenLastCalledWith({ view: 'explorer', focus: null });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });

  it('choosing IB perfect clears the focus and hides the bar', () => {
    const { bar, onChange } = setup('explorer', 'cs');
    document.querySelector('input[value="ib"]').click();
    expect(onChange).toHaveBeenCalledWith({ view: 'ib', focus: null });
    expect(bar.hidden).toBe(true);
    expect(bar.querySelector('[aria-pressed="true"]')).toBeNull();
  });

  it('set() does not fire onChange', () => {
    const { api, onChange } = setup();
    api.set({ view: 'explorer', focus: 'gov' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
