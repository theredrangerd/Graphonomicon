import { describe, it, expect } from 'vitest';
import { fmtMoney, fmtPrice, fmtQty, elasticityLabel, fmtShift, fmtPence, fmtPounds, fmtLitres } from './format.js';

describe('fmtPence', () => {
  it('shows whole pence bare and a fraction to one decimal', () => {
    expect(fmtPence(80)).toBe('80p');
    expect(fmtPence(0)).toBe('0p');
    expect(fmtPence(87.2727)).toBe('87.3p');
    expect(fmtPence(12.0001)).toBe('12p');
  });
  it('switches to pounds from £1', () => {
    expect(fmtPence(104)).toBe('£1.04');
    expect(fmtPence(99.98)).toBe('£1.00');
    expect(fmtPence(120)).toBe('£1.20');
  });
});

describe('fmtPounds', () => {
  it('turns pence × millions of litres into £ millions, to the penny', () => {
    expect(fmtPounds(1224)).toBe('£12.24m');
    expect(fmtPounds(108)).toBe('£1.08m');
    expect(fmtPounds(2400)).toBe('£24.00m');
  });
});

describe('fmtLitres', () => {
  it('names millions of litres, whole when it is whole', () => {
    expect(fmtLitres(51)).toBe('51m');
    expect(fmtLitres(52.5)).toBe('52.5m');
    expect(fmtLitres(46.3246)).toBe('46.3m');
  });
});

describe('fmtMoney', () => {
  it('rounds to whole dollars with a thousands separator', () => {
    expect(fmtMoney(1800)).toBe('$1,800');
    expect(fmtMoney(0)).toBe('$0');
  });
});

describe('fmtPrice', () => {
  it('shows exactly two decimal places', () => {
    expect(fmtPrice(80)).toBe('$80.00');
    expect(fmtPrice(96)).toBe('$96.00');
  });
});

describe('fmtQty', () => {
  it('shows exactly one decimal place', () => {
    expect(fmtQty(60)).toBe('60.0');
    expect(fmtQty(44)).toBe('44.0');
  });
});

describe('elasticityLabel', () => {
  it('classifies a real elasticity value against 1', () => {
    expect(elasticityLabel(4 / 3)).toBe('1.33 · elastic');
    expect(elasticityLabel(0.42)).toBe('0.42 · inelastic');
    expect(elasticityLabel(1.001)).toBe('1.00 · unit elastic');
    expect(elasticityLabel(null)).toBe('—');
  });
});

describe('fmtShift', () => {
  it('shows a signed offset', () => {
    expect(fmtShift(10)).toBe('+10');
    expect(fmtShift(-10)).toBe('−10');
    expect(fmtShift(0)).toBe('0');
  });
});
