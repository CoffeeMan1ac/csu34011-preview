/* V and X: the U/V page plus one search box. */
window.VSEARCH = (() => {
  const { esc } = P;
  const TAB = ' target="_blank" rel="noopener"';
  const SHOWN = 5;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  // Slide order, and a slide built up over several pages counts once.
  const tidy = (hits) => hits
    .sort((a, b) => a.href.localeCompare(b.href) || a.p - b.p)
    .filter((h, i, arr) => !(i && arr[i - 1].href === h.href && arr[i - 1].t === h.t));

  const chip = (h) => `<li><a href="${LPN.url(h.href)}#page=${h.p}"${TAB} title="${esc(h.t || '')}">${h.kind === 'exercises' ? 'ex' : 'p'}${h.p}</a></li>`;

  // Short rise for whatever has just come into view.
  const enter = (els) => {
    if (calm.matches) return;
    els.forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 200, delay: Math.min(i, 8) * 30, easing: 'ease-out', fill: 'backwards' },
    ));
  };

  function mount(variantId) {
    P.bar(variantId);
    document.getElementById('app').innerHTML = CIRCLE.page({ beyond: 'cards' });

    // The normal page is set aside while searching; results go in one grid of their own.
    const wrap = document.querySelector('.b-main .b-wrap');
    const browse = document.createElement('div');
    browse.className = 'v-browse';
    browse.append(...wrap.childNodes);
    const results = document.createElement('div');
    results.className = 'n-grid v-results';
    results.hidden = true;
    wrap.append(results, browse);

    // A place for the lecturer to say one thing, if he ever wants to. Empty by default.
    const notice = new URLSearchParams(location.search).get('notice') || LPN.course.notice;
    if (notice) {
      document.querySelector('.b-main').insertAdjacentHTML('beforebegin',
        `<div class="v-notice"><div class="b-wrap"><b>Notice</b> ${esc(notice)}</div></div>`);
    }

    if (LPN.settings && LPN.settings.search === false) return;

    document.querySelector('.n-code').insertAdjacentHTML('afterend', `
      <div class="v-search" role="search">
        ${UI.icon('search', 22)}
        <label for="q" class="sr-only">Search lectures and slides</label>
        <input id="q" type="text" inputmode="search" placeholder="Search lectures and slides" autocomplete="off" spellcheck="false">
        <button type="button" class="v-clear" id="clear" aria-label="Clear search">${UI.icon('x', 22)}</button>
      </div>
      <p class="v-status" id="vstatus" role="status" aria-live="polite"></p>`);

    const q = document.getElementById('q');
    const status = document.getElementById('vstatus');

    // While changed PDFs are still being read, say so (after a short pause, so quick checks don't flicker).
    let statusTimer = null;
    const busy = () => !!(window.PDFINDEX && PDFINDEX.busy());
    function showStatus(on) {
      if (!on) {
        clearTimeout(statusTimer);
        statusTimer = null;
        status.classList.remove('on');
        status.textContent = '';
        return;
      }
      if (statusTimer || status.classList.contains('on')) return;
      statusTimer = setTimeout(() => {
        statusTimer = null;
        if (!busy() || !q.value.trim()) return;
        status.classList.add('on');
        status.textContent = 'Searching slides…';
      }, 300);
    }
    const cards = [...browse.querySelectorAll('.n-card')];
    const expanded = new Set();
    let lastTerm = '';
    let lastIds = new Set();

    function chips(id, pages) {
      if (!pages.length) return '';
      const best = expanded.has(id) ? pages
        : [...pages].sort((a, b) => b.score - a.score).slice(0, SHOWN)
          .sort((a, b) => a.href.localeCompare(b.href) || a.p - b.p);
      const rest = pages.length - best.length;
      return `<ul class="n-hits">${best.map(chip).join('')}${rest
        ? `<li><button type="button" class="more" data-more="${id}" aria-label="Show ${rest} more matching pages">+${rest} more</button></li>` : ''}</ul>`;
    }

    function render() {
      const term = q.value.trim();
      if (term !== lastTerm) expanded.clear();
      const wasSearching = !!lastTerm;
      lastTerm = term;

      document.body.classList.toggle('searching', !!term);
      showStatus(!!term && busy());
      document.getElementById('none')?.remove();
      browse.hidden = !!term;
      results.hidden = !term;

      if (!term) {
        results.replaceChildren();
        lastIds = new Set();
        if (wasSearching) enter([browse]);
        return;
      }

      const meta = new Set(P.matchDecks(term).map((d) => d.id));
      const byDeck = {};
      if (P.indexReady()) for (const h of P.search(term)) (byDeck[h.deck.id] ||= []).push(h);

      const shown = [];
      const fresh = [];
      for (const card of cards) {
        const id = card.id.replace('lecture-', '');
        const pages = tidy(byDeck[id] || []);
        if (!meta.has(id) && !pages.length) continue;
        const copy = card.cloneNode(true);
        copy.removeAttribute('id');
        copy.dataset.id = id;
        copy.style.animation = 'none';
        copy.querySelector('.n-actions').insertAdjacentHTML('beforebegin', chips(id, pages));
        shown.push(copy);
        if (!lastIds.has(id)) fresh.push(copy);
      }
      results.replaceChildren(...shown);
      lastIds = new Set(shown.map((el) => el.dataset.id));
      if (!shown.length && !busy()) results.insertAdjacentHTML('beforebegin', `<p class="v-none" id="none">Nothing matches “${esc(term)}”</p>`);
      enter(fresh);
    }

    // On first use, confirm the slide text against the PDFs on the server. Page matches fill in
    // as each file is confirmed or re-read.
    let checked = false;
    const firstUse = () => {
      if (checked) return;
      checked = true;
      P.checkIndex(() => { if (q.value.trim()) render(); });
    };

    q.addEventListener('focus', firstUse);
    q.addEventListener('input', () => { firstUse(); render(); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; render(); } });
    document.getElementById('clear').addEventListener('click', () => { q.value = ''; render(); q.focus(); });
    results.addEventListener('click', (e) => {
      const more = e.target.closest('[data-more]');
      if (!more) return;
      expanded.add(more.dataset.more);
      render();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.target.matches('input, textarea, select')) { e.preventDefault(); q.focus(); }
    });
  }

  return { mount };
})();
