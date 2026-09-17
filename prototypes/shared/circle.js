/* Page builder for the prototypes R and S and the final versions A and B. `beyond` picks how the extra decks are laid out. */
window.CIRCLE = (() => {
  const { esc } = P;
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  // Everything the page links to is a file or another site, so all of it opens in a new tab and
  // this page stays where it was: PDFs (in the browser's own viewer), images, the log, SWISH.
  const TAB = ' target="_blank" rel="noopener"';
  const NEW = '<span class="sr-only"> (opens in a new tab)</span>';
  const newTab = () => TAB;
  const isExternal = (href) => new URL(href, location.href).origin !== location.origin;

  const quick = [
    { cls: 'q-info', icon: 'info', title: 'Course info', href: LPN.url(LPN.byId.intro.slides) },
    { cls: 'q-swish', icon: 'code', title: 'SWISH', href: LPN.course.swish },
    { cls: 'q-log', icon: 'clock', title: 'Lecture log', href: LPN.url('log') },
    { cls: 'q-book', icon: 'book', title: 'Learn Prolog Now', href: LPN.course.book.href },
  ];

  const headerColours = (window.THEME && window.THEME.header) || { bg: '#55476E', fg: '#6A5A88', opacity: 1 };
  const header = () => `<header class="b-head" style="${UI.pattern('Circuit Board', headerColours)}">
    <div class="b-wrap">
      <h1 class="n-title">Symbolic Programming</h1>
      <p class="n-code">CSU34011 · Trinity College Dublin</p>
      <nav class="n-quick" aria-label="Course">${quick.map((q) => `
        <a class="n-q ${q.cls}" href="${q.href}"${newTab(q.href)}>
          ${UI.icon(q.icon, 34)}<span>${q.title}${NEW}</span>
          ${isExternal(q.href) ? `<span class="ext">${UI.icon('external', 16)}</span>` : ''}
        </a>`).join('')}
      </nav>
    </div>
  </header>`;

  // Notes and the example program live inside their lecture's card, as they do on the live site.
  // Where the words already appear in the description ("…and difference lists"), link those words instead.
  const labelRe = (x) => new RegExp(x.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const inlineBlurb = (d) => {
    let html = esc(d.blurb);
    for (const x of (d.extras || []).filter((e) => e.type === 'pdf')) {
      if (labelRe(x).test(html)) html = html.replace(labelRe(x), (m) => `<a href="${LPN.url(x.href)}"${TAB}>${m}${NEW}</a>`);
    }
    return html;
  };
  const cardExtra = (d) => (x) => {
    if (x.type === 'code') return `<a class="n-also" href="${LPN.url(x.href)}"${TAB}>Example program from the lecture${NEW}</a>`;
    return labelRe(x).test(d.blurb) ? '' : `<a class="n-also" href="${LPN.url(x.href)}"${TAB}>${esc(cap(x.label))}${NEW}</a>`;
  };

  const card = (d) => {
    const what = `lecture ${d.num}, ${d.title}`;
    return `<article class="n-card" id="lecture-${d.id}">
      <div class="n-art" style="${UI.deckStyle(d)}"><span aria-hidden="true">${d.num}</span></div>
      <div class="n-body">
        <h3><span class="n-num" aria-hidden="true">${d.num}</span><span><span class="sr-only">Lecture ${d.num}: </span>${esc(d.title)}</span></h3>
        <p>${inlineBlurb(d)}</p>
        ${(d.extras || []).map(cardExtra(d)).join('')}
        <div class="n-actions">
          <a class="btn btn-primary" data-deck="${d.id}" href="${LPN.url(d.slides)}"${TAB} aria-label="Slides: ${esc(what)} (opens in a new tab)">Slides</a>
          <a class="btn btn-white" href="${LPN.url(d.exercises)}"${TAB} aria-label="Exercises: ${esc(what)} (opens in a new tab)">Exercises</a>
        </div>
      </div>
    </article>`;
  };

  // Whole decks that are not numbered chapters. Notes stay with their lecture, above.
  function beyondItems() {
    const why = LPN.byId.why;
    return [
      { mark: '0', title: why.title, sub: 'The opening lecture: logic and the search for truth', href: P.slidesHref(why), deck: why.id, style: UI.deckStyle(why) },
      ...LPN.decks.filter((x) => x.kind === 'supplement').map((d) => ({
        mark: '+', title: d.title, sub: d.blurb, with: `Goes with lecture ${d.parent}`,
        href: P.slidesHref(d), deck: d.id, style: UI.deckStyle(d),
      })),
    ];
  }

  // The pattern washes across the left of the row and fades out; the circle sits on top of it.
  const beyondRow = (x) => `<li class="r-row"${x.deck ? ` data-id="${x.deck}"` : ''}>
    <span class="r-bg" style="${x.style}" aria-hidden="true"></span>
    <span class="r-mark" aria-hidden="true">${x.mark}</span>
    <div>
      <h3>${esc(x.title)}${x.with ? `<span class="r-with r-with-title">${x.with}</span>` : ''}</h3>
      <p class="r-sub">${esc(x.sub)}</p>
      ${x.with ? `<span class="r-with r-with-mobile">${x.with}</span>` : ''}
    </div>
    <a class="btn btn-primary"${x.deck ? ` data-deck="${x.deck}"` : ''} href="${x.href}"${TAB} aria-label="Slides: ${esc(x.title)} (opens in a new tab)">Slides</a>
  </li>`;

  const beyondCard = (x) => `<article class="n-card"${x.deck ? ` id="lecture-${x.deck}"` : ''}>
    <div class="n-art" style="${x.style}"><span aria-hidden="true">${x.mark}</span></div>
    <div class="n-body">
      <h3><span class="n-num" aria-hidden="true">${x.mark}</span><span>${esc(x.title)}</span></h3>
      <p>${esc(x.sub)}</p>
      ${x.with ? `<span class="n-with">${x.with}</span>` : ''}
      <div class="n-actions one">
        <a class="btn btn-primary"${x.deck ? ` data-deck="${x.deck}"` : ''} href="${x.href}"${TAB} aria-label="Slides: ${esc(x.title)} (opens in a new tab)">Slides</a>
      </div>
    </div>
  </article>`;

  function support() {
    const s = Object.fromEntries(LPN.support.map((x) => [x.label, x]));
    const link = (x, label) => `<a href="${LPN.url(x.href)}"${TAB}>${label}${NEW}</a>`;
    return `<section class="n-support" aria-labelledby="supportTitle"><div class="b-wrap">
      <h2 id="supportTitle">Support beyond Prolog</h2>
      <p>${link(s['Support beyond Prolog'], 'Wellbeing')} · ${link(s['Career support'], 'Careers')} ·
         Niteline: ${link(s['Niteline: video'], 'video')}, ${link(s['Niteline: slide'], 'slide')}, ${link(s['Niteline: flyer'], 'flyer')}</p>
    </div></section>`;
  }

  const footer = () => `<footer class="n-foot"><div class="b-wrap">
    Site by <a href="https://denys.sh"${TAB}>Denys${NEW}</a>
    <small>Hero Patterns <a href="https://creativecommons.org/licenses/by/4.0/"${TAB}>CC BY 4.0${NEW}</a></small>
  </div></footer>`;

  // One section: every deck in teaching order, each extra straight after the lecture it belongs to.
  function mergedCards() {
    const why = LPN.byId.why;
    const out = [`<article class="n-card" id="lecture-${why.id}">
      <div class="n-art" style="${UI.deckStyle(why)}"><span aria-hidden="true">0</span></div>
      <div class="n-body">
        <h3><span class="n-num" aria-hidden="true">0</span><span>${esc(why.title)}</span></h3>
        <p>The opening lecture: logic and the search for truth</p>
        <div class="n-actions one"><a class="btn btn-primary" data-deck="${why.id}" href="${P.slidesHref(why)}"${TAB} aria-label="Slides: ${esc(why.title)} (opens in a new tab)">Slides</a></div>
      </div></article>`];
    for (const d of LPN.decks.filter((x) => x.kind === 'chapter')) {
      out.push(card(d));
      for (const s of LPN.decks.filter((x) => x.parent === d.id)) {
        out.push(beyondCard({ mark: '+', title: s.title, sub: s.blurb, with: `Goes with lecture ${d.num}`, href: P.slidesHref(s), deck: s.id, style: UI.deckStyle(s) }));
      }
    }
    return out.join('');
  }

  const page = ({ beyond = 'rows' } = {}) => `
    <a class="skip-link" href="#main">Skip to lectures</a>
    ${header()}
    <main class="b-main" id="main" tabindex="-1"><div class="b-wrap">
      <div class="n-head2"><h2>Slides</h2><p>from Learn Prolog Now and more</p></div>
      ${beyond === 'merged' || beyond === 'list' ? `<div class="n-grid${beyond === 'list' ? ' n-list' : ''}">${mergedCards()}</div>` : `
        <div class="n-grid">${LPN.decks.filter((d) => d.kind === 'chapter').map((d) => card(d)).join('')}</div>
        <div class="n-head2 b-gap"><h2>Beyond the book</h2><p>Extra topics from the lectures</p></div>
        ${beyond === 'cards'
          ? `<div class="n-grid">${beyondItems().map((x) => beyondCard(x)).join('')}</div>`
          : `<ol class="r-list">${beyondItems().map(beyondRow).join('')}</ol>`}`}
    </div></main>
    ${support()}
    ${footer()}`;

  return { page, beyondItems, card, header, support, footer };
})();
