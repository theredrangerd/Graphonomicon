import { describe, it, expect } from 'vitest';
import { getUnits, unitHref, familyHref, diagramHref, diagramModeLinks } from './units.js';

describe('getUnits', () => {
  it('returns all four IB syllabus units with their fixed tiers', () => {
    const units = getUnits();
    expect(units).toHaveLength(4);
    const tiers = Object.fromEntries(units.map((u) => [u.slug, u.tier]));
    expect(tiers.microeconomics).toBe('large');
    expect(tiers.macroeconomics).toBe('medium');
    expect(tiers.international).toBe('small');
    expect(tiers.development).toBe('small');
  });

  it('marks microeconomics as built and the other three units as coming-soon', () => {
    const byStatus = Object.fromEntries(getUnits().map((u) => [u.slug, u.status]));
    expect(byStatus.microeconomics).toBe('built');
    expect(byStatus.macroeconomics).toBe('coming-soon');
    expect(byStatus.international).toBe('coming-soon');
    expect(byStatus.development).toBe('coming-soon');
  });

  it('gives every unit a name and at least one search tag', () => {
    getUnits().forEach((unit) => {
      expect(typeof unit.name).toBe('string');
      expect(unit.name.length).toBeGreaterThan(0);
      expect(Array.isArray(unit.tags)).toBe(true);
      expect(unit.tags.length).toBeGreaterThan(0);
    });
  });
});

describe('microeconomics families', () => {
  it('lists the five topic families in syllabus/teaching order', () => {
    const micro = getUnits().find((u) => u.slug === 'microeconomics');
    const slugs = micro.families.map((f) => f.slug);
    expect(slugs).toEqual([
      'demand-and-supply',
      'elasticity',
      'government-intervention',
      'market-failure',
      'theory-of-the-firm',
    ]);
  });

  it('marks government-intervention as built and every other family as coming-soon', () => {
    const micro = getUnits().find((u) => u.slug === 'microeconomics');
    const byStatus = Object.fromEntries(micro.families.map((f) => [f.slug, f.status]));
    expect(byStatus['government-intervention']).toBe('built');
    expect(byStatus['demand-and-supply']).toBe('coming-soon');
    expect(byStatus['theory-of-the-firm']).toBe('coming-soon');
  });

  it('lists price ceiling, price floor, indirect tax, and subsidy as built SL diagrams in government-intervention', () => {
    const micro = getUnits().find((u) => u.slug === 'microeconomics');
    const gi = micro.families.find((f) => f.slug === 'government-intervention');
    const built = gi.diagrams.filter((d) => d.status === 'built').map((d) => d.slug);
    expect(built).toEqual(['price-ceiling', 'price-floor', 'indirect-tax', 'subsidy']);
    gi.diagrams.filter((d) => d.status === 'built').forEach((d) => {
      expect(d.level).toBe('SL');
    });
  });

  it('flags theory-of-the-firm diagrams as HL', () => {
    const micro = getUnits().find((u) => u.slug === 'microeconomics');
    const totf = micro.families.find((f) => f.slug === 'theory-of-the-firm');
    totf.diagrams.forEach((d) => {
      expect(d.level).toBe('HL');
    });
  });
});

describe('unitHref for a built unit', () => {
  it('links straight to the real unit page instead of the WIP stub', () => {
    expect(unitHref({ slug: 'microeconomics', status: 'built' })).toBe('/units/microeconomics.html');
  });

  it('still links to the WIP stub for a coming-soon unit', () => {
    expect(unitHref({ slug: 'macroeconomics', status: 'coming-soon' })).toBe('/units/wip.html?unit=macroeconomics');
  });
});

describe('unitHref', () => {
  it('points to the generic work-in-progress stub with the unit slug as a query param, for a coming-soon unit', () => {
    expect(unitHref({ slug: 'macroeconomics', status: 'coming-soon' })).toBe('/units/wip.html?unit=macroeconomics');
  });

  it('honors an explicit base path, so links still work under a GitHub Pages project subpath', () => {
    expect(unitHref({ slug: 'macroeconomics', status: 'coming-soon' }, '/Graphonomicon/')).toBe(
      '/Graphonomicon/units/wip.html?unit=macroeconomics'
    );
  });
});

describe('familyHref', () => {
  it('links to the real family page when built', () => {
    expect(familyHref({ slug: 'microeconomics' }, { slug: 'government-intervention', status: 'built' })).toBe(
      '/units/microeconomics/government-intervention.html'
    );
  });

  it('links to the WIP stub, tagged with the family slug, when not built', () => {
    expect(familyHref({ slug: 'microeconomics' }, { slug: 'market-failure', status: 'coming-soon' })).toBe(
      '/units/wip.html?unit=market-failure'
    );
  });
});

describe('diagramHref', () => {
  it('links to the real diagram page when built', () => {
    const href = diagramHref(
      { slug: 'microeconomics' },
      { slug: 'government-intervention' },
      { slug: 'price-ceiling', status: 'built' }
    );
    expect(href).toBe('/units/microeconomics/government-intervention/price-ceiling.html');
  });

  it('links to the WIP stub, tagged with the diagram slug, when not built', () => {
    const href = diagramHref(
      { slug: 'microeconomics' },
      { slug: 'government-intervention' },
      { slug: 'agricultural-markets', status: 'coming-soon' }
    );
    expect(href).toBe('/units/wip.html?unit=agricultural-markets');
  });
});

describe('diagramModeLinks', () => {
  const unit = getUnits().find((u) => u.slug === 'microeconomics');
  const family = unit.families.find((f) => f.slug === 'government-intervention');
  const find = (slug) => family.diagrams.find((d) => d.slug === slug);

  it('gives the subsidy page Explain and Play links', () => {
    const links = diagramModeLinks(unit, family, find('subsidy'));
    expect(links.map((l) => l.mode)).toEqual(['explain', 'play']);
    expect(links[0].href.endsWith('/subsidy.html#explain')).toBe(true);
    expect(links[1].href.endsWith('/subsidy.html#play')).toBe(true);
  });

  it('returns nothing for a diagram without modes', () => {
    expect(diagramModeLinks(unit, family, find('price-ceiling'))).toEqual([]);
  });
});
