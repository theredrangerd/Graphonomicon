// src/lib/units.js
const UNITS = [
  {
    slug: 'microeconomics',
    name: 'Microeconomics',
    tier: 'large',
    status: 'built',
    tags: ['supply', 'demand', 'elasticity', 'market failure', 'government intervention', 'minimum wage', 'price ceiling', 'price floor'],
    families: [
      {
        slug: 'demand-and-supply',
        name: 'Demand & Supply',
        status: 'coming-soon',
        diagrams: [
          { slug: 'demand-curve', name: 'Demand curve', level: 'SL', status: 'coming-soon', tags: ['demand shift', 'movement along demand'] },
          { slug: 'supply-curve', name: 'Supply curve', level: 'SL', status: 'coming-soon', tags: ['supply shift', 'movement along supply'] },
          { slug: 'market-equilibrium', name: 'Market equilibrium', level: 'SL', status: 'coming-soon', tags: ['equilibrium price', 'market clearing'] },
          { slug: 'consumer-producer-surplus', name: 'Consumer & producer surplus', level: 'SL', status: 'coming-soon', tags: ['consumer surplus', 'producer surplus'] },
          { slug: 'allocative-efficiency', name: 'Allocative efficiency', level: 'SL', status: 'coming-soon', tags: ['allocative efficiency'] },
        ],
      },
      {
        slug: 'elasticity',
        name: 'Elasticity',
        status: 'coming-soon',
        diagrams: [
          { slug: 'ped', name: 'Price elasticity of demand', level: 'SL', status: 'coming-soon', tags: ['ped', 'elastic', 'inelastic', 'total revenue'] },
          { slug: 'pes', name: 'Price elasticity of supply', level: 'SL', status: 'coming-soon', tags: ['pes'] },
          { slug: 'yed-xed', name: 'Income & cross elasticity', level: 'SL', status: 'coming-soon', tags: ['yed', 'xed', 'engel curve'] },
        ],
      },
      {
        slug: 'government-intervention',
        name: 'Government Intervention',
        status: 'built',
        diagrams: [
          { slug: 'price-ceiling', name: 'Price ceiling', level: 'SL', status: 'built', tags: ['price ceiling', 'rent control', 'shortage', 'deadweight loss'] },
          { slug: 'price-floor', name: 'Price floor', level: 'SL', status: 'built', tags: ['price floor', 'minimum wage', 'surplus', 'deadweight loss'] },
          { slug: 'indirect-tax', name: 'Indirect tax', level: 'SL', status: 'built', modes: ['explain', 'play'], tags: ['indirect tax', 'specific tax', 'ad valorem tax', 'tax incidence', 'tax revenue'] },
          { slug: 'subsidy', name: 'Subsidy', level: 'SL', status: 'built', modes: ['explain', 'play'], tags: ['subsidy', 'government spending'] },
        ],
      },
      {
        slug: 'market-failure',
        name: 'Market Failure',
        status: 'coming-soon',
        diagrams: [
          { slug: 'negative-production-externality', name: 'Negative externality of production', level: 'SL', status: 'coming-soon', tags: ['pollution', 'msc', 'mpc'] },
          { slug: 'negative-consumption-externality', name: 'Negative externality of consumption', level: 'SL', status: 'coming-soon', tags: ['demerit good', 'msb', 'mpb'] },
          { slug: 'positive-production-externality', name: 'Positive externality of production', level: 'SL', status: 'coming-soon', tags: ['spillover benefit'] },
          { slug: 'positive-consumption-externality', name: 'Positive externality of consumption', level: 'SL', status: 'coming-soon', tags: ['merit good'] },
          { slug: 'common-resources', name: 'Common resources / tragedy of the commons', level: 'SL', status: 'coming-soon', tags: ['tragedy of the commons'] },
          { slug: 'public-goods', name: 'Public goods', level: 'SL', status: 'coming-soon', tags: ['free rider', 'non-excludable'] },
        ],
      },
      {
        slug: 'theory-of-the-firm',
        name: 'Theory of the Firm',
        level: 'HL',
        status: 'coming-soon',
        diagrams: [
          { slug: 'perfect-competition', name: 'Perfect competition', level: 'HL', status: 'coming-soon', tags: ['normal profit', 'abnormal profit', 'loss'] },
          { slug: 'monopoly', name: 'Monopoly', level: 'HL', status: 'coming-soon', tags: ['welfare loss', 'natural monopoly'] },
          { slug: 'monopolistic-competition', name: 'Monopolistic competition', level: 'HL', status: 'coming-soon', tags: [] },
          { slug: 'oligopoly', name: 'Oligopoly', level: 'HL', status: 'coming-soon', tags: ['collusion', 'game theory', 'prisoner\'s dilemma', 'payoff matrix'] },
          { slug: 'lrac-minimum-efficient-scale', name: 'LRAC & minimum efficient scale', level: 'HL', status: 'coming-soon', tags: ['long-run average cost', 'economies of scale', 'minimum efficient scale'] },
        ],
      },
    ],
  },
  {
    slug: 'macroeconomics',
    name: 'Macroeconomics',
    tier: 'medium',
    status: 'coming-soon',
    tags: ['aggregate demand', 'aggregate supply', 'business cycle', 'fiscal policy', 'monetary policy'],
  },
  {
    slug: 'international',
    name: 'International Economics',
    tier: 'small',
    status: 'coming-soon',
    tags: ['trade', 'tariffs', 'exchange rate', 'quotas'],
  },
  {
    slug: 'development',
    name: 'Development Economics',
    tier: 'small',
    status: 'coming-soon',
    tags: ['growth', 'lorenz curve', 'inequality'],
  },
];

export function getUnits() {
  return UNITS;
}

export function unitHref(unit, base = import.meta.env.BASE_URL) {
  if (unit.status === 'built') return `${base}units/${unit.slug}.html`;
  return `${base}units/wip.html?unit=${unit.slug}`;
}

export function familyHref(unit, family, base = import.meta.env.BASE_URL) {
  if (family.status === 'built') return `${base}units/${unit.slug}/${family.slug}.html`;
  return `${base}units/wip.html?unit=${family.slug}`;
}

export function diagramHref(unit, family, diagram, base = import.meta.env.BASE_URL) {
  if (diagram.status === 'built') return `${base}units/${unit.slug}/${family.slug}/${diagram.slug}.html`;
  return `${base}units/wip.html?unit=${diagram.slug}`;
}

const MODE_LABELS = { explain: 'Explain', play: 'Play' };

export function diagramModeLinks(unit, family, diagram, base = import.meta.env.BASE_URL) {
  if (diagram.status !== 'built' || !diagram.modes) return [];
  const href = diagramHref(unit, family, diagram, base);
  return diagram.modes.map((mode) => ({ mode, label: MODE_LABELS[mode], href: `${href}#${mode}` }));
}
