/* Shared prototype helpers: simulated week, local progress, slide search, and the dark control bar. */
window.P = (() => {
  const VARIANTS = [
    { id: 'a-syllabus', name: 'A · Syllabus table', hyp: 'Most visits are “grab a PDF”: one dense row per chapter gets you there fastest.' },
    { id: 'b-this-week', name: 'B · This week', hyp: 'Students arrive on a weekly rhythm: lead with where the class is and what I have not done yet.' },
    { id: 'c-search', name: 'C · Search-first', hyp: 'After week 3 the question is “where was X explained?”: full-text slide search beats browsing.' },
    { id: 'd-path', name: 'D · Learning path', hyp: 'Showing sequence + prerequisites helps catching up and revision, and explains the “+” extra decks.' },
    { id: 'e-reader', name: 'E · Reader', hyp: 'The real pain is juggling PDF tabs: slides, outline and exercises in one view.' },
    { id: 'f-gallery', name: 'F · Pattern gallery', hyp: 'heropatterns.com’s own layout: split hero with the current lecture, sticky finder bar, lecture gallery with details in a modal.' },
    { id: 'g-dashboard', name: 'G · Course dashboard', hyp: 'A + B + C as one Refactoring UI-style app screen: status cards, a catch-up list, ⌘K slide search.' },
    { id: 'h-search', name: 'H · Search hero', hyp: 'C in hi-fi: the search box is the homepage, and results open at the exact slide.' },
    { id: 'i-pocket', name: 'I · Pocket', hyp: 'Most visits are on a phone between lectures: bottom tabs, bottom sheets, big tap targets.' },
    { id: 'j-list', name: 'J · One list', hyp: 'Less is more: this week, then every lecture on one line with Slides and Exercises. No search, ticks or popups.' },
    { id: 'k-find', name: 'K · List + find', hyp: 'J plus one search box that filters the same list and shows matching slides under each lecture.' },
    { id: 'l-now', name: 'L · This week first', hyp: 'One card with one button for this week’s slides, then every lecture as a big tile.' },
    { id: 'm-index', name: 'M · Big index', hyp: 'Same content as today, set big and decisive: four course links up top, one large row per lecture, extras nested under the lecture they belong to.' },
    { id: 'n-book', name: 'N · Book & beyond', hyp: 'Students think in two kinds of material: the 12 Learn Prolog Now chapters, and the lecturer’s extra topics. Show both, big.' },
    { id: 'o-find', name: 'O · Big find', hyp: 'M with one large search box that finds a lecture or any slide. Nothing else added.' },
    { id: 'p-book', name: 'P · Numbers on the pattern', hyp: 'N cleaned up: numbers drawn straight onto the pattern, labelled extras that keep a pattern mark, full-width bands on phones.' },
    { id: 'q-beyond', name: 'Q · Labels only', hyp: 'Same as P, except Beyond the book drops the pattern marks and lets the label do the work. Compare the two sections.' },
    { id: 'r-circle', name: 'R · Circles back', hyp: 'Circled numbers restored, Beyond the book as N’s rows at P’s shorter height, smaller centred footer with a one-line pattern credit.' },
    { id: 's-cards', name: 'S · Beyond as cards', hyp: 'Same as R, except Beyond the book uses the same containers as Slides.' },
    { id: 'final-default', name: 'Final A · Default', hyp: 'The current site, redesigned: every lecture in teaching order, extras after their lecture.' },
    { id: 'final-search', name: 'Final B · With search', hyp: 'A, plus a search box that finds lectures and the exact slides, and a notice line.' },
    { id: 'final-checklist-card', name: 'Candidate D · Checklist, whole card', hyp: 'C, but a click anywhere on a card (outside its links) ticks it; the circle shows the tick.' },
    { id: 'final-checklist', name: 'Candidate C · With checklist', hyp: 'B in one list, plus ticking off lectures: click the number circle (a tick box on phones); a progress chain by the heading; kept in this browser.' },
  ];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('lpnproto:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('lpnproto:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  const qWeek = +new URLSearchParams(location.search).get('week');
  if (qWeek) store.set('week', qWeek);
  const week = Math.min(LPN.maxWeek, Math.max(1, qWeek || store.get('week', LPN.realWeek)));

  // Every same-site PDF link opens in the site's own viewer, which has a Back button, instead of the browser's PDF view.
  const VIEWER = new URL('viewer.html', document.currentScript.src).href;
  function viewerHref(pdfHref, { back = location.pathname + location.search, embed = false } = {}) {
    const u = new URL(pdfHref, location.href);
    const page = (u.hash.match(/page=(\d+)/) || [])[1];
    const v = new URL(VIEWER);
    v.searchParams.set('file', u.pathname);
    if (back) v.searchParams.set('back', back);
    if (embed) v.searchParams.set('embed', '1');
    if (page) v.hash = `page=${page}`;
    return v.href;
  }
  // PDFs open in the browser's own viewer, as they do on the live site. (The E reader still
  // embeds shared/viewer.html through viewerHref; nothing else uses it.)

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fileOf = (href) => href.split('/').pop();
  const slidesHref = (d, page) => LPN.url(d.slides) + (page ? '#page=' + page : '');

  const progress = (id) => store.get('progress', {})[id] || {};
  function setProgress(id, patch) {
    const all = store.get('progress', {});
    all[id] = { ...all[id], ...patch };
    store.set('progress', all);
  }

  // Which decks the class has touched by `week`, and where it currently is.
  function classState(w = week) {
    const covered = new Set(LPN.logUpTo(w).flatMap((e) => (e.covered || []).map((c) => c.deck)));
    const pos = LPN.position(w);
    return { covered, pos, status: (id) => (pos && pos.deck.id === id ? 'now' : covered.has(id) ? 'covered' : 'upcoming') };
  }

  // Consecutive duplicate titles are incremental builds of one slide.
  function outline(d) {
    const rows = (window.SEARCH_INDEX || {})[fileOf(d.slides)] || [];
    return rows.filter((r, i) => r.t && (i === 0 || r.t !== rows[i - 1].t)).map(({ p, t }) => ({ p, t }));
  }

  const sources = LPN.decks.flatMap((d) => [
    { deck: d, kind: 'slides', href: d.slides },
    ...(d.exercises ? [{ deck: d, kind: 'exercises', href: d.exercises }] : []),
    ...(d.extras || []).filter((x) => x.type === 'pdf').map((x) => ({ deck: d, kind: 'extra', href: x.href, label: x.label })),
  ]);

  // Accents are ignored when matching, so "godel" finds "Gödel".
  const fold = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '');
  const terms = (q) => fold(q).toLowerCase().split(/\s+/).filter(Boolean);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Words match from their start: "cut" finds "cut" and "cuts", not "consecutive". Numbers match
  // whole ("1" is not "12"). Terms starting with a symbol (\+, ==) match anywhere.
  const wordStart = (t) => (/^[a-z0-9]/i.test(t) ? '(?:^|[^a-z0-9])' : '');
  const termRe = (t, flags = 'i') => new RegExp(wordStart(t) + reEsc(t) + (/^\d+$/.test(t) ? '(?![0-9])' : ''), flags);
  const wholeRe = (t) => new RegExp(wordStart(t) + reEsc(t) + (/[a-z0-9]$/i.test(t) ? '(?![a-z0-9])' : ''), 'i');

  // What students type vs what the slides say. Applied when the whole query is one of these.
  const ALIASES = {
    '!': 'cut', '\\+': 'negation', naf: 'negation as failure',
    dcg: 'definite clause grammar', dcgs: 'definite clause grammar', cfg: 'context free grammar',
    kb: 'knowledge base', regex: 'regular expression', regexp: 'regular expression',
    fsa: 'automata', dfa: 'automata', nfa: 'automata', automaton: 'automata',
    unify: 'unification', unifies: 'unification', recursive: 'recursion', backtrack: 'backtracking',
    difflist: 'difference list', 'diff list': 'difference list',
  };
  const aliasOf = (q) => (LPN.settings && LPN.settings.aliases === false ? undefined : ALIASES[q.trim().toLowerCase()]);
  // "!" is also ordinary punctuation on half the slides, so it is searched only as its meaning.
  const REPLACED = new Set(['!']);
  // A bare number means "lecture N", not every slide that mentions the digit.
  const isNumber = (q) => /^\d+$/.test(q.trim());

  // Slide text comes from PDFINDEX when the page loads it (it stays correct as PDFs change; see
  // pdfindex.js), otherwise from the bundled search-index.js that the older prototypes use.
  const sourceFiles = () => [...new Set(sources.map((s) => s.href))];
  const pagesOf = (href) => (window.PDFINDEX
    ? window.PDFINDEX.pages(href) || []
    : (window.SEARCH_INDEX || {})[fileOf(href)] || []);
  const checkIndex = (onUpdate) => (window.PDFINDEX ? window.PDFINDEX.ensure(sourceFiles(), onUpdate) : Promise.resolve());
  const indexReady = () => true;

  function searchOnce(q, scope) {
    const ts = terms(q);
    if (!ts.length) return [];
    const res = ts.map((t) => ({ some: termRe(t), all: termRe(t, 'gi'), whole: wholeRe(t) }));
    const hits = [];
    for (const src of sources) {
      if (scope === 'slides' && src.kind === 'exercises') continue;
      if (scope === 'exercises' && src.kind !== 'exercises') continue;
      for (const pg of pagesOf(src.href)) {
        const hay = fold(pg.t + ' ' + pg.x);
        if (!res.every((r) => r.some.test(hay))) continue;
        // Title matches count most, whole words beat word starts, repeats add a little.
        const title = fold(pg.t);
        let score = 1;
        for (const r of res) {
          score += r.whole.test(title) ? 4 : r.some.test(title) ? 2.5 : 0;
          score += r.whole.test(hay) ? 0.5 : 0;
          score += Math.min(5, (hay.match(r.all) || []).length) * 0.2;
        }
        // Exercise sheets have no slide titles (the first line is a print timestamp).
        const t = src.kind === 'exercises' ? `Exercise sheet, page ${pg.p}` : pg.t;
        hits.push({ ...src, p: pg.p, t, x: pg.x, score });
      }
    }
    return hits;
  }

  function search(q, { scope = 'all' } = {}) {
    const best = new Map();
    const add = (hits, weight) => {
      for (const h of hits) {
        const key = `${h.href}#${h.p}`;
        const score = h.score * weight;
        if (!best.has(key) || best.get(key).score < score) best.set(key, { ...h, score });
      }
    };
    if (isNumber(q)) return [];
    if (!REPLACED.has(q.trim())) add(searchOnce(q, scope), 1);
    if (aliasOf(q)) add(searchOnce(aliasOf(q), scope), 0.9);
    return [...best.values()].sort((a, b) => b.score - a.score);
  }

  const matchDecks = (q) => {
    if (isNumber(q)) return LPN.decks.filter((d) => String(d.num) === q.trim());
    const find = (query) => {
      const res = terms(query).map((t) => termRe(t));
      if (!res.length) return [];
      return LPN.decks.filter((d) => {
        const useKeywords = !LPN.settings || LPN.settings.keywords;
        const hay = fold([d.title, d.blurb, useKeywords ? d.keywords : '', d.num].join(' '));
        return res.every((r) => r.test(hay));
      });
    };
    return [...new Set([...find(q), ...(aliasOf(q) ? find(aliasOf(q)) : [])])];
  };

  // Highlight on raw text, escaping each piece, so terms never match inside HTML entities.
  function highlight(text, q) {
    const ts = [...terms(q), ...(aliasOf(q) ? terms(aliasOf(q)) : [])];
    if (!ts.length) return esc(text);
    const re = new RegExp('(' + ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    return String(text).split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('');
  }

  function snippet(text, q, len = 150) {
    const ts = terms(q);
    const lower = text.toLowerCase();
    const at = Math.max(0, Math.min(...ts.map((t) => { const i = lower.indexOf(t); return i < 0 ? Infinity : i; })) - 50);
    const start = Number.isFinite(at) ? at : 0;
    const cut = text.slice(start, start + len);
    return (start > 0 ? '…' : '') + highlight(cut, q) + (start + len < text.length ? '…' : '');
  }

  function noteOpen(deckId, page) { store.set('recent', { deck: deckId, page: page ? +page : null, at: Date.now() }); }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-deck]');
    if (a) noteOpen(a.dataset.deck, a.dataset.page);
  });

  // The versions shown to the professor carry no prototype controls.
  const PRESENTED = new Set(['final-default', 'final-search', 'final-checklist', 'final-checklist-card']);

  function bar(id) {
    if (PRESENTED.has(id)) return;
    const i = VARIANTS.findIndex((v) => v.id === id);
    const v = VARIANTS[i];
    const prev = VARIANTS[(i + VARIANTS.length - 1) % VARIANTS.length];
    const next = VARIANTS[(i + 1) % VARIANTS.length];
    const el = document.createElement('div');
    el.className = 'proto-bar';
    el.setAttribute('aria-label', 'Prototype controls');
    el.innerHTML = `
      <a href="../index.html">← All variants</a>
      <b>${esc(v.name)}</b>
      <span class="hyp">${esc(v.hyp)}</span>
      <label>Simulated week <select>${Array.from({ length: LPN.maxWeek }, (_, k) => k + 1)
        .map((w) => `<option value="${w}" ${w === week ? 'selected' : ''}>${w}${w === LPN.realWeek ? ' (real)' : ''}</option>`).join('')}</select></label>
      <button type="button" data-reset>Reset my ticks</button>
      <span><a href="../${prev.id}/">‹ ${esc(prev.name.split(' · ')[0])}</a> · <a href="../${next.id}/">${esc(next.name.split(' · ')[0])} ›</a></span>`;
    el.querySelector('select').onchange = (e) => { store.set('week', +e.target.value); location.search = ''; };
    el.querySelector('[data-reset]').onclick = () => { store.set('progress', {}); store.set('recent', null); location.reload(); };
    document.body.prepend(el);
  }

  const simTag = () => (week > LPN.realWeek ? ' <span class="tag sim" title="Log entries after week 1 are simulated">simulated</span>' : '');

  return { VARIANTS, store, week, esc, viewerHref, checkIndex, indexReady, sourceFiles, fileOf, slidesHref, progress, setProgress, classState, outline, search, matchDecks, highlight, snippet, noteOpen, bar, simTag };
})();
