export const QMAX = 100;
export const PMAX = 180;

function shoelaceArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    sum += ax * by - bx * ay;
  }
  return Math.abs(sum) / 2;
}

function csPolyFor(Dmax, Pd, Q, price) {
  return [[0, Dmax], [Q, Pd(Q)], [Q, price], [0, price]];
}

// Points along the supply curve from quantity a to b, floored at a price of $0. A linear
// supply curve with a negative price intercept (steep, inelastic supply) hits the quantity
// axis at q0: the first q0 units would be supplied even at $0, so their minimum acceptable
// price is $0, not the negative number the straight line extrapolates to. Without the
// floor, surplus areas include a region below the axis and PS/DWL come out too big.
function supplyPath(Smin, slopeS, a, b) {
  const eff = (q) => Math.max(0, Smin + slopeS * q);
  const path = [[a, eff(a)]];
  if (Smin < 0) {
    const q0 = -Smin / slopeS;
    if ((q0 - a) * (q0 - b) < 0) path.push([q0, 0]);
  }
  path.push([b, eff(b)]);
  return path;
}

function psPolyFor(Smin, slopeS, Q, price) {
  return [...supplyPath(Smin, slopeS, 0, Q), [Q, price], [0, price]];
}

// Between demand and (floored) supply from the traded Q to Q*: works for Q < Q* (ceiling,
// floor, tax) and Q > Q* (subsidy) alike, since the path runs Q → Q* either way.
function dwlPolyFor(Q, Pd, Smin, slopeS, Qstar) {
  if (Math.abs(Q - Qstar) < 1e-9) return null;
  return [[Q, Pd(Q)], ...supplyPath(Smin, slopeS, Q, Qstar)];
}

// Clips a polygon to the half-plane where side(point) >= 0 (Sutherland–Hodgman, one edge).
export function clipPoly(poly, side) {
  const out = [];
  poly.forEach((cur, i) => {
    const prev = poly[(i + poly.length - 1) % poly.length];
    const sc = side(cur), sp = side(prev);
    if ((sc >= 0) !== (sp >= 0)) {
      const t = sp / (sp - sc);
      out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
    }
    if (sc >= 0) out.push(cur);
  });
  return out;
}

function freeMarketResult(base) {
  const { Qstar, Pstar, Dmax, Smin, slopeS, Pd } = base;
  const csPoly = csPolyFor(Dmax, Pd, Qstar, Pstar);
  const psPoly = psPolyFor(Smin, slopeS, Qstar, Pstar);
  return {
    ...base,
    mode: 'free',
    Q: Qstar, Pc: Pstar, Pp: Pstar, gap: 0,
    CS: shoelaceArea(csPoly), PS: shoelaceArea(psPoly), DWL: 0,
    govRevenue: 0, govCost: 0,
    csPoly, psPoly, dwlPoly: null, wedgePoly: null,
    requestedControl: null,
  };
}

function rationingResult(base, intervention) {
  const { Dmax, Smin, slopeD, slopeS, Qstar, Pstar, Pd, Ps } = base;
  const isFloor = intervention.type === 'floor';
  const controlPrice = intervention.price;
  const binding = isFloor ? controlPrice > Pstar : controlPrice < Pstar;
  if (!binding) {
    return { ...freeMarketResult(base), requestedControl: { type: intervention.type, price: controlPrice } };
  }

  const qd = Math.max(0, (Dmax - controlPrice) / slopeD);
  const qs = Math.max(0, (controlPrice - Smin) / slopeS);
  const Q = Math.min(qd, qs);
  const gap = isFloor ? qs - qd : qd - qs;

  const csPoly = csPolyFor(Dmax, Pd, Q, controlPrice);
  const psPoly = psPolyFor(Smin, slopeS, Q, controlPrice);
  const dwlPoly = dwlPolyFor(Q, Pd, Smin, slopeS, Qstar);

  return {
    ...base,
    mode: isFloor ? 'floor' : 'ceiling',
    Q, Pc: controlPrice, Pp: controlPrice, gap, qd, qs,
    CS: shoelaceArea(csPoly), PS: shoelaceArea(psPoly),
    DWL: dwlPoly ? shoelaceArea(dwlPoly) : 0,
    govRevenue: 0, govCost: 0,
    csPoly, psPoly, dwlPoly, wedgePoly: null,
    requestedControl: { type: intervention.type, price: controlPrice },
  };
}

function taxResult(base, intervention) {
  const { Dmax, Smin, slopeD, slopeS, Qstar, Pstar, Pd, Ps } = base;
  let Q, Pc, Pp;

  if (intervention.mode === 'advalorem') {
    const rate = intervention.rate;
    Q = Math.max(0, (Dmax - Smin * (1 + rate)) / (slopeD + slopeS * (1 + rate)));
    Pp = Ps(Q);
    Pc = Pp * (1 + rate);
  } else {
    const amount = intervention.amount;
    Q = Math.max(0, (Dmax - Smin - amount) / (slopeD + slopeS));
    Pc = Pd(Q);
    Pp = Pc - amount;
  }
  const wedge = Pc - Pp;
  // Q hits 0 when the tax is at least the gap between the highest price any buyer will pay
  // and the lowest price any seller will accept: the market shuts, and Pc/Pp stop meaning
  // anything (no unit changes hands at either price), so pages must not report them.
  const closed = Q <= 0;

  // A closed market has no surplus regions: skip them rather than build zero-width shapes
  // at a notional (possibly negative) producer price.
  const csPoly = closed ? [] : csPolyFor(Dmax, Pd, Q, Pc);
  const psPoly = closed ? [] : psPolyFor(Smin, slopeS, Q, Pp);
  const dwlPoly = dwlPolyFor(Q, Pd, Smin, slopeS, Qstar);
  const wedgePoly = [[0, Pp], [Q, Pp], [Q, Pc], [0, Pc]];
  // Split the tax wedge at the pre-tax equilibrium price: the portion above Pstar is
  // the share consumers absorb (price paid rose), the portion below is what producers
  // absorb (price received fell) — this is what actually varies with relative elasticity.
  const consumerWedgePoly = [[0, Pstar], [Q, Pstar], [Q, Pc], [0, Pc]];
  const producerWedgePoly = [[0, Pp], [Q, Pp], [Q, Pstar], [0, Pstar]];
  // The deadweight loss cut across Pe: the part above is taken out of CS, the part below out of PS.
  const dwlConsumerPoly = dwlPoly ? clipPoly(dwlPoly, ([, p]) => p - Pstar) : null;
  const dwlProducerPoly = dwlPoly ? clipPoly(dwlPoly, ([, p]) => Pstar - p) : null;

  return {
    ...base,
    mode: 'tax',
    Q, Pc, Pp, gap: 0, closed,
    CS: shoelaceArea(csPoly), PS: shoelaceArea(psPoly),
    DWL: dwlPoly ? shoelaceArea(dwlPoly) : 0,
    govRevenue: wedge * Q, govCost: 0,
    consumerIncidence: (Pc - Pstar) * Q, producerIncidence: (Pstar - Pp) * Q,
    csPoly, psPoly, dwlPoly, wedgePoly, consumerWedgePoly, producerWedgePoly,
    dwlConsumerPoly, dwlProducerPoly,
    DWLConsumer: dwlConsumerPoly?.length >= 3 ? shoelaceArea(dwlConsumerPoly) : 0,
    DWLProducer: dwlProducerPoly?.length >= 3 ? shoelaceArea(dwlProducerPoly) : 0,
    requestedControl: null,
    interventionMode: intervention.mode,
    taxRate: intervention.mode === 'advalorem' ? intervention.rate : null,
  };
}

function subsidyResult(base, intervention) {
  const { Dmax, Smin, slopeD, slopeS, Qstar, Pstar, Pd, Ps } = base;
  const amount = intervention.amount;
  const Q = (Dmax - Smin + amount) / (slopeD + slopeS);
  const Pc = Pd(Q);
  const Pp = Pc + amount;

  const csPoly = csPolyFor(Dmax, Pd, Q, Pc);
  const psPoly = psPolyFor(Smin, slopeS, Q, Pp);
  const dwlPoly = dwlPolyFor(Q, Pd, Smin, slopeS, Qstar);
  const wedgePoly = [[0, Pc], [Q, Pc], [Q, Pp], [0, Pp]];
  // Split the subsidy wedge at the pre-subsidy equilibrium price: the portion below Pstar
  // is the benefit consumers capture (price paid fell), the portion above is what producers
  // capture (price received rose) — this is what actually varies with relative elasticity.
  const consumerWedgePoly = [[0, Pc], [Q, Pc], [Q, Pstar], [0, Pstar]];
  const producerWedgePoly = [[0, Pstar], [Q, Pstar], [Q, Pp], [0, Pp]];
  // CS reaches down to Pc and PS up to Pp, so they overlap inside the subsidy band: the
  // part of the band under demand and above (original) supply. Welfare counts it twice,
  // which is exactly why the government's payment has to be subtracted.
  const overlapPoly = clipPoly(
    clipPoly(wedgePoly, ([q, p]) => Pd(q) - p),
    ([q, p]) => p - Ps(q),
  );

  const polyArea = (poly) => (poly.length < 3 ? 0 : shoelaceArea(poly));
  const marginalCsPoly = clipPoly(csPoly, ([, p]) => Pstar - p);
  const marginalPsPoly = clipPoly(psPoly, ([, p]) => p - Pstar);
  const csTrianglePoly = csPolyFor(Dmax, Pd, Qstar, Pstar);
  const psTrianglePoly = psPolyFor(Smin, slopeS, Qstar, Pstar);

  return {
    ...base,
    mode: 'subsidy',
    // Free-market CS/PS triangles, plus the slices of the subsidised CS/PS that lie beyond
    // Pe: marginal CS is the extra consumer surplus under demand below Pe, marginal PS the
    // extra producer surplus above Pe. Marginal CS + PS + DWL = government spending.
    csTrianglePoly, psTrianglePoly,
    csTriangleArea: polyArea(csTrianglePoly),
    psTriangleArea: polyArea(psTrianglePoly),
    marginalCsPoly, marginalPsPoly,
    marginalCS: polyArea(marginalCsPoly),
    marginalPS: polyArea(marginalPsPoly),
    overlapArea: polyArea(overlapPoly),
    overlapPoly,
    // The parts of CS/PS that lie outside the overlap band, where their area labels go.
    csOnlyPoly: clipPoly(csPoly, ([, p]) => p - Pp),
    psOnlyPoly: clipPoly(psPoly, ([, p]) => Pc - p),
    // Split at the pre-subsidy price Pe: the chart stripes the halves in opposite directions.
    overlapAbovePoly: clipPoly(overlapPoly, ([, p]) => p - Pstar),
    overlapBelowPoly: clipPoly(overlapPoly, ([, p]) => Pstar - p),
    Q, Pc, Pp, gap: 0,
    CS: shoelaceArea(csPoly), PS: shoelaceArea(psPoly),
    DWL: dwlPoly ? shoelaceArea(dwlPoly) : 0,
    govRevenue: 0, govCost: amount * Q,
    consumerIncidence: (Pstar - Pc) * Q, producerIncidence: (Pp - Pstar) * Q,
    csPoly, psPoly, dwlPoly, wedgePoly, consumerWedgePoly, producerWedgePoly,
    requestedControl: null,
  };
}

export function computeMarket({ demand, supply, slopeD, slopeS, intervention = { type: 'none' } }) {
  const Dmax = demand, Smin = supply;
  const noTrade = Dmax <= Smin;
  // Never clamp quantities to the chart here: a clamped Q is a point that isn't on the
  // curves, and every surplus/incidence figure derived from it comes out wrong. Keeping
  // the market on-chart is the page's job (see fitsChart + guardSliders in pageControls.js).
  const Qstar = noTrade ? 0 : (Dmax - Smin) / (slopeD + slopeS);
  const Pstar = Dmax - slopeD * Qstar;

  function Pd(q) { return Dmax - slopeD * q; }
  function Ps(q) { return Smin + slopeS * q; }

  const base = { Dmax, Smin, slopeD, slopeS, Qstar, Pstar, noTrade, Pd, Ps };

  if (noTrade) {
    return {
      ...base, mode: 'free', Q: 0, Pc: 0, Pp: 0, gap: 0,
      CS: 0, PS: 0, DWL: 0, govRevenue: 0, govCost: 0,
      csPoly: [], psPoly: [], dwlPoly: null, wedgePoly: null,
      requestedControl: null,
    };
  }

  switch (intervention.type) {
    case 'ceiling':
    case 'floor':
      return rationingResult(base, intervention);
    case 'tax':
      return taxResult(base, intervention);
    case 'subsidy':
      return subsidyResult(base, intervention);
    default:
      return freeMarketResult(base);
  }
}

// True when every quantity and price in a result sits inside the drawn axes, so the chart
// shows exactly what the stats report. Pages use this to stop sliders at the chart's edge.
export function fitsChart(result) {
  if (result.noTrade) return true;
  const qs = [result.Qstar, result.Q];
  // A closed market's Pc/Pp aren't prices anyone trades at (and aren't drawn), so they
  // don't need to fit — the student can push a tax far enough to shut the market.
  const ps = result.closed ? [result.Pstar] : [result.Pstar, result.Pc, result.Pp];
  return qs.every((q) => q >= 0 && q <= QMAX) && ps.every((p) => p >= 0 && p <= PMAX);
}

// Point price elasticities (absolute values) at the free-market equilibrium. On a linear
// curve elasticity varies along the curve, so it can't be read off the slope alone — it
// depends on P/Q at the point as well. Measured at the shared equilibrium point, the
// PED/PES ratio is also exactly what decides tax/subsidy incidence.
export function pointElasticities({ Pstar, Qstar, slopeD, slopeS, noTrade }) {
  if (noTrade || Qstar <= 0) return { ped: null, pes: null };
  return { ped: Pstar / (slopeD * Qstar), pes: Pstar / (slopeS * Qstar) };
}
