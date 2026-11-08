// Three rising bars in the demand / supply / government colours: the Graphonomicon mark.
export const BRAND_MARK = `<svg class="brand-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="13" width="5" height="9" fill="var(--demand)"/><rect x="9.5" y="8" width="5" height="14" fill="var(--supply)"/><rect x="17" y="2" width="5" height="20" fill="var(--gov)"/></svg>`;

export function renderSiteBar(container, { base = import.meta.env.BASE_URL } = {}) {
  container.innerHTML = `
    <header class="site-bar">
      <a class="site-bar__brand" href="${base}index.html">${BRAND_MARK}<span class="brand-word">Graphonomicon</span></a>
    </header>
  `;
}

export function renderFooter(doc) {
  if (doc.querySelector('.site-footer')) return;
  const footer = doc.createElement('footer');
  footer.className = 'site-footer';
  footer.textContent = 'Graphonomicon is an unofficial study tool. It is not affiliated with or endorsed by the International Baccalaureate.';
  doc.body.append(footer);
}

export function renderHero(container, { eyebrow, title, lede }) {
  const eyebrowHtml = eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : '';
  container.innerHTML = `
    <div class="hero">
      ${eyebrowHtml}
      <h1>${title}</h1>
      <p class="lede">${lede}</p>
    </div>
  `;
}

export function renderMiniHeader(container, { title, backHref, backLabel, siblings, base = import.meta.env.BASE_URL }) {
  const back = backHref
    ? `<a class="mini-header__back" href="${backHref}">&larr; ${backLabel || 'Back'}</a>`
    : '';
  const siblingLinks = (siblings || []).filter((s) => !s.current);
  const siblingNav = siblingLinks.length
    ? `<div class="mini-header__siblings">${siblingLinks.map((s) => `<a href="${s.href}">${s.name}</a>`).join('')}</div>`
    : '';
  container.innerHTML = `
    <header class="mini-header">
      ${back}
      <a class="mini-header__home" href="${base}index.html">${BRAND_MARK}<span class="brand-word">Graphonomicon</span></a>
      <span class="mini-header__title">${title}</span>
      ${siblingNav}
    </header>
  `;
  renderFooter(container.ownerDocument);
}
