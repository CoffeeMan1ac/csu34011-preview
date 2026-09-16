/* Version C: tick off lectures. On wide screens the number circle is the button; on phones, where the
   circle is hidden, a tick box sits beside Slides. A progress chain sits beside the heading, and a short
   confirmation appears. Ticks are kept in localStorage: they survive reloads, closing the browser and
   restarts, until the visitor clears the site's data. Load after circle.js. */
window.CHECKLIST = (() => {
  const KEY = 'csu34011-done';
  const TOAST_MS = 2500;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const tick = (size) => UI.icon('tick', size);

  // Storage can be missing or blocked (private windows, strict settings); ticks then last for this visit.
  let memory = [];
  const load = () => {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(memory); }
  };
  const save = (done) => {
    memory = [...done];
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* kept in memory only */ }
  };

  const idOf = (card) => card.dataset.id || card.id.replace('lecture-', '');
  const markOf = (card) => card.querySelector('.n-art > span').textContent.trim();
  const nameOf = (card, mark) => (/^\d+$/.test(mark) && mark !== '0'
    ? `Lecture ${mark}` : card.querySelector('h3 > span:last-child').textContent.trim());

  // wholeCard: a click anywhere on a card that isn't a link or control ticks it (the circle stays the
  // keyboard and screen reader control).
  function mount({ wholeCard = false } = {}) {
    const main = document.querySelector('.b-main');
    main.classList.toggle('c-whole', wholeCard);
    const head = main.querySelector('.n-head2');
    const cards = [...main.querySelectorAll('.n-card')];
    const names = new Map();

    for (const card of cards) {
      const id = idOf(card);
      const mark = markOf(card);
      const name = nameOf(card, mark);
      names.set(id, name);
      card.querySelector('.n-art > span').outerHTML = `<button type="button" class="c-circle" data-done="${id}"
        aria-pressed="false" aria-label="Done: ${P.esc(name)}" title="Mark as done">
        <span class="c-mark">${mark}</span><span class="c-tick">${tick(30)}</span></button>`;
      const actions = card.querySelector('.n-actions');
      actions.classList.add('c-actions');
      actions.insertAdjacentHTML('afterbegin',
        `<input type="checkbox" class="c-box" data-done="${id}" title="Mark as done" aria-label="Done: ${P.esc(name)}">`);
    }

    // One chain of slanted segments for the whole list, always one row: beside the heading, or under it
    // when space is short. Segments share the width, so added lectures still fit.
    const text = document.createElement('div');
    text.append(...head.childNodes);
    head.append(text);
    head.classList.add('c-head');
    head.insertAdjacentHTML('beforeend', `<div class="c-progress">
      <p class="c-count"></p>
      <ol class="c-chain" aria-label="Lectures">${cards.map((card) => {
      const id = idOf(card);
      return `<li><a href="#${card.id}" data-chain="${id}">
        <span class="c-mark">${card.querySelector('.c-mark').textContent}</span><span class="c-tick">${tick(20)}</span></a></li>`;
    }).join('')}</ol></div>`);
    const chain = head.querySelector('.c-chain');
    const countEl = head.querySelector('.c-count');
    // On phones the segments are too narrow to tap well (WCAG 2.5.8), so there the chain only shows progress.
    const narrow = matchMedia('(max-width: 600px)');
    const fit = () => { chain.inert = narrow.matches; };
    narrow.addEventListener('change', fit);
    fit();

    document.body.insertAdjacentHTML('beforeend', '<div class="c-toast" role="status"></div>');
    const toast = document.body.lastElementChild;
    let toastTimer = null;
    const say = (text) => {
      clearTimeout(toastTimer);
      toast.innerHTML = `${tick(18)}<span>${P.esc(text)}</span>`;
      toast.classList.add('on');
      toastTimer = setTimeout(() => toast.classList.remove('on'), TOAST_MS);
    };

    // Search results are copies of the cards, so every copy is updated, not just the one clicked.
    function paint() {
      const done = load();
      for (const el of document.querySelectorAll('[data-done]')) {
        const on = done.has(el.dataset.done);
        if (el.type === 'checkbox') el.checked = on; else el.setAttribute('aria-pressed', on);
        el.closest('.n-card').classList.toggle('is-done', on);
      }
      let count = 0;
      for (const link of chain.querySelectorAll('[data-chain]')) {
        const on = done.has(link.dataset.chain);
        count += on;
        link.classList.toggle('is-done', on);
        link.setAttribute('aria-label', `${names.get(link.dataset.chain)}${on ? ', done' : ''}`);
      }
      countEl.textContent = `${count} of ${cards.length} done`;
    }

    function set(el, on) {
      const done = load();
      if (on) done.add(el.dataset.done); else done.delete(el.dataset.done);
      save(done);
      paint();
      const card = el.closest('.n-card');
      if (!calm.matches) card.animate([{ transform: 'scale(.98)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
      say(`${names.get(el.dataset.done)} ${on ? 'marked as done' : 'unmarked'}`);
    }
    document.addEventListener('click', (e) => {
      let circle = e.target.closest('.c-circle');
      if (!circle && wholeCard) {
        const card = e.target.closest('.c-whole .n-card');
        // Links and buttons keep their own job, and selecting text doesn't tick anything.
        if (!card || e.target.closest('a, button, input, label') || String(getSelection())) return;
        const box = card.querySelector('.c-box');
        if (getComputedStyle(box).display !== 'none') { box.click(); return; }
        circle = card.querySelector('.c-circle');
      }
      if (circle) set(circle, circle.getAttribute('aria-pressed') !== 'true');
    });
    document.addEventListener('change', (e) => {
      if (e.target.matches('.c-box')) set(e.target, e.target.checked);
    });

    // Search re-renders its copies; paint them as they appear. Another tab may tick things too.
    const results = main.querySelector('.v-results');
    if (results) new MutationObserver(paint).observe(results, { childList: true });
    addEventListener('storage', (e) => { if (e.key === KEY) paint(); });
    // Coming back with the Back button can show a stored copy of the page; bring it up to date.
    addEventListener('pageshow', (e) => { if (e.persisted) paint(); });
    paint();
  }

  return { mount };
})();
