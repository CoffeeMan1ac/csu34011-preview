/* Version B: the search box on top of the page built by circle.js. */
window.VSEARCH = (() => {
  const { esc } = P;
  const TAB = ' target="_blank" rel="noopener"';
  const SHOWN = 5;
  // Convention, not a standard: don't flash a loading indicator for short waits.
  // The standard part is announcing status without moving focus (role="status", WCAG 4.1.3).
  const STATUS_DELAY_MS = 300;
  // Screen readers hear the result count once typing pauses, not after every key.
  const ANNOUNCE_DELAY_MS = 600;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  // Changed PDFs may be read in the background only on a connection that reports itself fast and
  // unmetered (Network Information API); anywhere that can't tell waits until someone searches.
  const roomy = () => {
    const c = navigator.connection;
    return !!c && !c.saveData && c.effectiveType === '4g';
  };
  const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500));

  // Slide order, and a slide built up over several pages counts once.
  const tidy = (hits) => hits
    .sort((a, b) => a.href.localeCompare(b.href) || a.p - b.p)
    .filter((h, i, arr) => !(i && arr[i - 1].href === h.href && arr[i - 1].t === h.t));

  const chip = (h) => {
    const what = `${h.kind === 'exercises' ? 'Exercise sheet page' : 'Slide'} ${h.p}${h.kind !== 'exercises' && h.t ? `: ${h.t}` : ''}`;
    return `<li><a href="${LPN.url(h.href)}#page=${h.p}"${TAB} title="${esc(what)}" aria-label="${esc(what)} (opens in a new tab)">${h.kind === 'exercises' ? 'ex' : 'p'}${h.p}</a></li>`;
  };

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
    // Keeps the heading order (h1, h2, h3) while the browse section with its "Slides" heading is hidden.
    const resultsTitle = document.createElement('h2');
    resultsTitle.className = 'sr-only';
    resultsTitle.textContent = 'Search results';
    resultsTitle.hidden = true;
    wrap.append(resultsTitle, results, browse);

    // A place for the lecturer to say one thing. Empty by default.
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
        <input id="q" type="text" inputmode="search" enterkeyhint="search" placeholder="Search lectures and slides" autocomplete="off" spellcheck="false">
        <button type="button" class="v-clear" id="clear" aria-label="Clear search">${UI.icon('x', 22)}</button>
      </div>
      <p class="v-status" id="vstatus" role="status"></p>
      <p class="sr-only" id="vcount" role="status"></p>`);

    const q = document.getElementById('q');
    const status = document.getElementById('vstatus');
    const count = document.getElementById('vcount');
    const cards = [...browse.querySelectorAll('.n-card')];
    const expanded = new Set();
    let lastTerm = '';
    let lastIds = new Set();
    const busy = () => !!(window.PDFINDEX && PDFINDEX.busy());

    let statusTimer = null;
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
      }, STATUS_DELAY_MS);
    }

    let countTimer = null;
    function announce(text) {
      clearTimeout(countTimer);
      countTimer = setTimeout(() => { count.textContent = text; }, ANNOUNCE_DELAY_MS);
    }

    function chips(id, pages) {
      if (!pages.length) return '';
      const best = expanded.has(id) ? pages
        : [...pages].sort((a, b) => b.score - a.score).slice(0, SHOWN)
          .sort((a, b) => a.href.localeCompare(b.href) || a.p - b.p);
      const rest = pages.length - best.length;
      return `<ul class="n-hits" aria-label="Matching pages">${best.map(chip).join('')}${rest
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
      resultsTitle.hidden = !term;

      if (!term) {
        results.replaceChildren();
        lastIds = new Set();
        announce('');
        if (wasSearching) enter([browse]);
        return;
      }

      const meta = new Set(P.matchDecks(term).map((d) => d.id));
      const byDeck = {};
      for (const h of P.search(term)) (byDeck[h.deck.id] ||= []).push(h);

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
      if (!shown.length && !busy()) {
        results.insertAdjacentHTML('beforebegin', `<p class="v-none" id="none">Nothing matches “${esc(term)}”</p>`);
      }
      if (!busy()) announce(shown.length ? `${UI.plural(shown.length, 'result')}` : 'No results');
      enter(fresh);
    }

    // Check the PDFs against the bundled text once the page is idle (a tiny request per file).
    let prepared = false;
    const prepare = () => {
      if (prepared) return;
      prepared = true;
      P.checkIndex(() => { if (q.value.trim()) render(); });
    };
    whenIdle(() => {
      prepare();
      if (roomy()) PDFINDEX.startReading();
    });
    const intent = () => {
      prepare();
      PDFINDEX.startReading();
    };

    q.addEventListener('focus', intent);
    q.addEventListener('input', () => { intent(); render(); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Escape') { q.value = ''; render(); } });
    document.getElementById('clear').addEventListener('click', () => { q.value = ''; render(); q.focus(); });
    results.addEventListener('click', (e) => {
      const more = e.target.closest('[data-more]');
      if (!more) return;
      const id = more.dataset.more;
      expanded.add(id);
      render();
      // The button is gone after re-rendering; move keyboard focus to that lecture's page links.
      results.querySelector(`[data-id="${id}"] .n-hits a`)?.focus();
    });
  }

  return { mount };
})();
