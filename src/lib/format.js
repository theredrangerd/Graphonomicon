export function fmtMoney(v) {
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
export function fmtPrice(v) { return '$' + v.toFixed(2); }
export function fmtQty(v) { return v.toFixed(1); }

// The indirect tax's Explain (the UK sugar levy) works in pence a litre and millions of litres.
// A price: whole pence bare ("80p"), a fraction to one decimal ("87.3p"), from £1 in pounds ("£1.04").
export function fmtPence(v) {
  const tenths = Math.round(v * 10) / 10;
  if (tenths >= 100) return '£' + (Math.round(v) / 100).toFixed(2);
  return (Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)) + 'p';
}
// A total: pence × millions of litres, in £ millions to the penny, so totals that should add up do.
export function fmtPounds(v) { return '£' + (Math.round(v) / 100).toFixed(2) + 'm'; }
// Millions of litres: "51m", "52.5m".
export function fmtLitres(q) {
  const tenths = Math.round(q * 10) / 10;
  return (Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)) + 'm';
}

export function setStatusPill(pill, text, mode) {
  pill.textContent = text;
  pill.className = 'status-pill' + (mode ? ' ' + mode : '');
}

// Takes a real point elasticity (absolute value), never a slope — see pointElasticities()
// in marketEngine.js. "Unit elastic" only when it rounds to exactly 1.00 as displayed.
export function elasticityLabel(e) {
  if (e == null) return '—';
  const shown = e.toFixed(2);
  if (shown === '1.00') return '1.00 · unit elastic';
  return shown + (e > 1 ? ' · elastic' : ' · inelastic');
}

export function fmtShift(v) {
  if (v > 0) return '+' + v;
  if (v < 0) return '−' + Math.abs(v);
  return '0';
}
