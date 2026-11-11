import { fmtMoney, fmtPrice, fmtQty } from './format.js';

// Hardcoded per-region explanations for the "click a shaded area / line to learn what it
// is" feature. Keyed by the `data-region` value set on chart elements in marketChart.js.
// Covers all four government-intervention pages: price ceiling, price floor, indirect tax,
// and subsidy.
export const REGION_INFO = {
  cs: {
    title: 'Consumer Surplus',
    text: 'The benefit consumers get from paying less than the maximum price they were willing to pay — the area between the demand curve and the price actually paid.',
  },
  ps: {
    title: 'Producer Surplus',
    text: 'The benefit producers get from receiving more than the minimum price they were willing to accept — the area between the supply curve and the price actually received.',
  },
  dwl: {
    title: 'Deadweight Loss',
    text: "The loss of total welfare when the market doesn't trade the efficient quantity — value that simply disappears rather than shifting to anyone. A price ceiling, price floor or tax means too few units are traded; a subsidy means too many.",
  },
  ceiling: {
    title: 'Price Ceiling',
    text: 'A legal maximum price. Set below the equilibrium price, it stops the price rising to clear the market: at this price buyers want more than sellers will supply, and the gap between them is the shortage.',
  },
  floor: {
    title: 'Price Floor',
    text: 'A legal minimum price. Set above the equilibrium price, it stops the price falling to clear the market: at this price sellers want to supply more than buyers will buy, and the gap between them is the excess supply.',
  },
  shortage: {
    title: 'Shortage',
    text: 'Quantity demanded minus quantity supplied at the ceiling price (Qd − Qs). Only Qs is actually traded, so some buyers who would pay the ceiling price go without — expect queues, waiting lists or black markets.',
  },
  'excess-supply': {
    title: 'Excess supply',
    text: 'Quantity supplied minus quantity demanded at the floor price (Qs − Qd), often called a "surplus" — not the same thing as producer surplus. Only Qd is actually bought, so the rest goes unsold unless the government buys it up.',
  },
  'tax-consumer': {
    title: 'Consumer Burden',
    text: 'The portion of the tax that consumers pay through a higher price. How much of the burden falls here rather than on producers depends on how responsive (elastic) demand is relative to supply.',
  },
  'tax-producer': {
    title: 'Producer Burden',
    text: 'The portion of the tax that producers absorb through a lower price received. How much of the burden falls here rather than on consumers depends on how responsive (elastic) supply is relative to demand.',
  },
  'tax-revenue': {
    title: 'Government Tax Revenue',
    text: 'The total revenue the government collects from the tax — the tax per unit multiplied by the quantity still traded after the tax.',
  },
  'subsidy-overlap': {
    title: 'CS and PS overlap',
    text: 'The subsidy band counts as surplus twice: consumers get surplus from the lower price they pay, and producers get surplus from the higher price they receive. The overlap is paid for by the government, which is why its cost is subtracted when judging total welfare.',
  },
  'subsidy-cost': {
    title: 'Government Spending',
    text: 'The total the government pays: the subsidy per unit multiplied by the quantity sold.',
  },
  'bakery-revenue': {
    title: 'Bakery Revenue',
    text: 'What the seller takes in: the price it receives per unit multiplied by the quantity it sells. On a graph, that is the rectangle with height equal to the price and width equal to the quantity.',
  },
  'cs-original': {
    title: 'Consumer Surplus (before the subsidy)',
    text: 'The consumer surplus at the free-market price Pe: the area under demand and above Pe. The subsidy adds the marginal CS band beneath it.',
  },
  'ps-original': {
    title: 'Producer Surplus (before the subsidy)',
    text: 'The producer surplus at the free-market price Pe: the area above supply (S1) and below Pe. The subsidy adds the marginal PS band above it.',
  },
  'marginal-cs': {
    title: 'Marginal Consumer Surplus',
    text: 'The extra consumer surplus the subsidy creates: consumers now pay Pc instead of Pe, on every unit they buy, including the extra units the subsidy makes worth buying.',
  },
  'marginal-ps': {
    title: 'Marginal Producer Surplus',
    text: 'The extra producer surplus the subsidy creates: producers now receive Pp instead of Pe, on every unit they sell, including the extra units the subsidy makes worth producing.',
  },
};

export const REGION_BADGES = {
  cs: 'CS',
  ps: 'PS',
  dwl: 'DWL',
  ceiling: 'Pmax',
  floor: 'Pmin',
  shortage: 'Shortage',
  'excess-supply': 'Excess supply',
  'tax-consumer': 'CB',
  'tax-producer': 'PB',
  'tax-revenue': 'Tax rev',
  'subsidy-overlap': 'CS ∩ PS',
  'subsidy-cost': 'Gov',
  'bakery-revenue': 'Revenue',
  'marginal-cs': 'mCS',
  'marginal-ps': 'mPS',
  'cs-original': 'CS',
  'ps-original': 'PS',
};

function getContextNote(key, result) {
  if (!result) return null;
  if (result.mode === 'ceiling') {
    if (key === 'cs') {
      return `Consumers who manage to purchase at the legal ceiling price (${fmtPrice(result.Pc)}) gain surplus transferred from producers. However, because suppliers only provide ${fmtQty(result.qs)} units, other willing buyers face a shortage of ${fmtQty(result.gap)} units.`;
    }
    if (key === 'ps') {
      return `Producers receive only the capped price of ${fmtPrice(result.Pc)} and cut back production to ${fmtQty(result.qs)} units, sharply reducing producer surplus.`;
    }
    if (key === 'dwl') {
      return `Restricting output to ${fmtQty(result.qs)} units prevents mutually beneficial trades between ${fmtQty(result.qs)} and ${fmtQty(result.Qstar)} units that buyers and sellers wanted to make. This lost welfare disappears completely from society.`;
    }
    if (key === 'ceiling') {
      return `A legal maximum price of ${fmtPrice(result.Pc)}. Set below the market equilibrium (${fmtPrice(result.Pstar)}), it stops price from clearing the market.`;
    }
    if (key === 'shortage') {
      return `At ${fmtPrice(result.Pc)}, consumers demand ${fmtQty(result.qd)} units but producers only supply ${fmtQty(result.qs)} units, leaving a shortage of ${fmtQty(result.gap)} units.`;
    }
  } else if (result.mode === 'free') {
    if (key === 'cs') {
      return `At free-market equilibrium (Pe = ${fmtPrice(result.Pstar)}), consumer surplus is maximized without artificial shortages.`;
    }
    if (key === 'ps') {
      return `At free-market equilibrium (Pe = ${fmtPrice(result.Pstar)}), producer surplus is maximized without price suppression.`;
    }
  } else if (result.mode === 'tax' && !result.closed) {
    // The tax page's story is a tax on cans of soft drink.
    const perUnit = result.Pc - result.Pp;
    if (key === 'tax-revenue') {
      return `The government collects ${fmtMoney(perUnit)} on each of the ${fmtQty(result.Q)} cans sold, ${fmtMoney(result.govRevenue)} in all. Consumers pay ${fmtMoney(result.consumerIncidence)} of it through the higher price (consumer burden), and producers ${fmtMoney(result.producerIncidence)} through the lower price they keep (producer burden).`;
    }
    if (key === 'tax-consumer') {
      return `Customers now pay ${fmtPrice(result.Pc)} a can instead of ${fmtPrice(result.Pstar)}: ${fmtPrice(result.Pc - result.Pstar)} of the ${fmtPrice(perUnit)} tax, on each of the ${fmtQty(result.Q)} cans they still buy.`;
    }
    if (key === 'tax-producer') {
      return `Producers now keep ${fmtPrice(result.Pp)} a can instead of ${fmtPrice(result.Pstar)}: ${fmtPrice(result.Pstar - result.Pp)} of the ${fmtPrice(perUnit)} tax, on each of the ${fmtQty(result.Q)} cans they still sell.`;
    }
    if (key === 'dwl') {
      return `The ${fmtQty(result.Qstar - result.Q)} cans between Qtax and Qe are no longer sold, although buyers valued them more than they cost to make. That lost value goes to nobody, not even the government.`;
    }
  } else if (result.mode === 'subsidy') {
    if (key === 'bakery-revenue') {
      return `The bakery receives ${fmtMoney(result.Pp)} a loaf (Pp) and sells ${fmtQty(result.Q)} loaves, so its revenue is ${fmtMoney(result.Pp * result.Q)}. Customers pay ${fmtMoney(result.Pc)} of each loaf's price and the government pays the other ${fmtMoney(result.Pp - result.Pc)}.`;
    }
    if (key === 'subsidy-cost') {
      const amount = result.Pp - result.Pc;
      return `The government pays ${fmtMoney(amount)} on each of the ${fmtQty(result.Q)} loaves sold, ${fmtMoney(result.govCost)} in all. That money ends up in three places: lower prices for consumers (marginal CS), higher prices for producers (marginal PS), and a deadweight loss (DWL) nobody gets.`;
    }
  }
  return null;
}

function getStatValue(key, result) {
  if (!result) return null;
  if (key === 'cs' && result.CS != null) return fmtMoney(result.CS);
  if (key === 'ps' && result.PS != null) return fmtMoney(result.PS);
  if (key === 'dwl' && result.DWL != null) return fmtMoney(result.DWL);
  if (key === 'ceiling' && result.Pc != null) return fmtPrice(result.Pc);
  if (key === 'shortage' && result.gap != null) return `${fmtQty(result.gap)} units`;
  if (key === 'tax-revenue' && result.govRevenue != null) return fmtMoney(result.govRevenue);
  if (key === 'tax-consumer' && result.consumerIncidence != null) return fmtMoney(result.consumerIncidence);
  if (key === 'tax-producer' && result.producerIncidence != null) return fmtMoney(result.producerIncidence);
  if (key === 'subsidy-cost' && result.govCost != null) return fmtMoney(result.govCost);
  if (key === 'bakery-revenue' && result.Pp != null && result.Q != null) return fmtMoney(result.Pp * result.Q);
  if (key === 'marginal-cs' && result.marginalCS != null) return fmtMoney(result.marginalCS);
  if (key === 'marginal-ps' && result.marginalPS != null) return fmtMoney(result.marginalPS);
  if (key === 'cs-original' && result.csTriangleArea != null) return fmtMoney(result.csTriangleArea);
  if (key === 'ps-original' && result.psTriangleArea != null) return fmtMoney(result.psTriangleArea);
  return null;
}

// Wires hover-pop and click-to-explain behavior onto a market chart SVG. Safe to call once
// per chart element — it listens on the SVG itself (event delegation), so it keeps working
// across re-renders even though renderMarketChart() tears down and rebuilds the chart's
// child elements on every call.
export function attachRegionExplainers(svg) {
  let popover = null;
  let activeRegion = null;

  // Works at every detail level: Clean / IB perfect drop the chips, but tapping a shaded
  // area still explains it.
  function findRegion(target) {
    return target && target.closest ? target.closest('[data-region]') : null;
  }

  function closePopover() {
    if (popover) {
      popover.remove();
      popover = null;
    }
    if (activeRegion) {
      svg.querySelectorAll('.region-active').forEach((el) => el.classList.remove('region-active'));
      activeRegion = null;
    }
  }

  function positionPopover(el, clientX, clientY) {
    const pad = 12;
    // Measure after appending so offsetWidth/Height are real, then clamp into the viewport
    // so a click near an edge never renders the card partly off-screen.
    const w = el.offsetWidth || 300, h = el.offsetHeight || 180;
    let left = clientX + pad, top = clientY + pad;
    if (left + w > window.innerWidth - pad) left = clientX - w - pad;
    if (top + h > window.innerHeight - pad) top = clientY - h - pad;
    left = Math.max(pad, left);
    top = Math.max(pad, top);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  function openPopover(regionEl, key, clientX, clientY) {
    const info = REGION_INFO[key];
    if (!info) return;
    closePopover();
    activeRegion = regionEl;

    // Highlight all matching elements for this region key (e.g. shaded polygon and badge)
    svg.querySelectorAll(`[data-region="${key}"]`).forEach((el) => el.classList.add('region-active'));

    popover = document.createElement('div');
    popover.className = `region-popover region-popover--${key}`;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-labelledby', 'region-popover-title');

    const result = svg._lastResult;
    const badgeLabel = REGION_BADGES[key] || key.toUpperCase();
    const statVal = getStatValue(key, result);
    const contextNote = getContextNote(key, result);

    const header = document.createElement('div');
    header.className = 'region-popover__header';

    const pill = document.createElement('span');
    pill.className = `region-popover__pill region-popover__pill--${key}`;
    pill.textContent = badgeLabel;

    const heading = document.createElement('h4');
    heading.id = 'region-popover-title';
    heading.textContent = info.title;

    const close = document.createElement('button');
    close.className = 'region-popover__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', closePopover);

    header.append(pill, heading, close);
    popover.appendChild(header);

    if (statVal) {
      const statRow = document.createElement('div');
      statRow.className = 'region-popover__stat';
      const k = document.createElement('span');
      k.className = 'k';
      k.textContent = 'Current value';
      const v = document.createElement('span');
      v.className = 'v';
      v.textContent = statVal;
      statRow.append(k, v);
      popover.appendChild(statRow);
    }

    const body = document.createElement('p');
    body.className = 'region-popover__def';
    body.textContent = info.text;
    popover.appendChild(body);

    if (contextNote) {
      const callout = document.createElement('div');
      callout.className = `region-popover__callout region-popover__callout--${key}`;
      const calloutTitle = document.createElement('div');
      calloutTitle.className = 'callout-title';
      calloutTitle.textContent = result && result.mode === 'ceiling' ? 'Under this price ceiling' : 'In this market';
      const calloutP = document.createElement('p');
      calloutP.textContent = contextNote;
      callout.append(calloutTitle, calloutP);
      popover.appendChild(callout);
    }

    document.body.appendChild(popover);

    if (clientX == null || clientY == null) {
      const rect = regionEl.getBoundingClientRect ? regionEl.getBoundingClientRect() : { left: 100, top: 100, width: 40, height: 20 };
      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;
    }
    positionPopover(popover, clientX, clientY);
  }

  svg.addEventListener('pointerover', (e) => {
    const region = findRegion(e.target);
    if (region) {
      const key = region.dataset.region;
      svg.querySelectorAll(`[data-region="${key}"]`).forEach((el) => el.classList.add('region-hover'));
    }
  });
  svg.addEventListener('pointerout', (e) => {
    const region = findRegion(e.target);
    if (region) {
      const key = region.dataset.region;
      svg.querySelectorAll(`[data-region="${key}"]`).forEach((el) => el.classList.remove('region-hover'));
    }
  });

  svg.addEventListener('click', (e) => {
    const region = findRegion(e.target);
    if (!region) return;
    const key = region.dataset.region;
    if (activeRegion && activeRegion.dataset.region === key) {
      closePopover();
    } else {
      openPopover(region, key, e.clientX, e.clientY);
    }
  });

  svg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const region = findRegion(e.target);
      if (region) {
        e.preventDefault();
        const key = region.dataset.region;
        const rect = region.getBoundingClientRect ? region.getBoundingClientRect() : { left: 100, top: 100, width: 40, height: 20 };
        if (activeRegion && activeRegion.dataset.region === key) {
          closePopover();
        } else {
          openPopover(region, key, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!popover) return;
    // Only clicks that land on the active region itself (handled above, which toggles it
    // closed) or inside the popover should be ignored here — everywhere else, including
    // empty chart background/axes inside the SVG, should close it.
    if (popover.contains(e.target) || findRegion(e.target) === activeRegion) return;
    closePopover();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopover();
  });

  return {
    close() {
      closePopover();
      svg.querySelectorAll('.region-hover').forEach((el) => el.classList.remove('region-hover'));
    },
  };
}
