/* Version C: tick off lectures. A tick box beside each Slides button, a chain of progress beside each
   section heading, a short confirmation. Ticks live in this browser only (localStorage). Load after circle.js. */
window.CHECKLIST = (() => {
  const KEY = 'csu34011-done';
  const TOAST_MS = 2500;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const tick = UI.icon('tick', 16);

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
  const titleOf = (card) => card.querySelector('h3 > span:last-child').textContent.trim();
  const nameOf = (card) => {
    const mark = markOf(card);
    return /^\d+$/.test(mark) && mark !== '0' ? `Lecture ${mark}` : titleOf(card);
  };

  function mount() {
    const main = document.querySelector('.b-main');
    const sections = [...main.querySelectorAll('.n-head2')].map((head) => {
      let grid = head.nextElementSibling;
      while (grid && !grid.matches('.n-grid')) grid = grid.nextElementSibling;
      return { head, cards: grid ? [...grid.querySelectorAll('.n-card')] : [] };
    });

    // The number circle and the phone number get a tick that shows when done.
    for (const card of main.querySelectorAll('.n-card')) {
      const mark = markOf(card);
      for (const el of card.querySelectorAll('.n-art > span, .n-num')) {
        el.innerHTML = `<span class="c-mark">${mark}</span><span class="c-tick">${tick}</span>`;
      }
      const actions = card.querySelector('.n-actions');
      actions.classList.add('c-actions');
      actions.insertAdjacentHTML('afterbegin',
        `<input type="checkbox" class="c-box" data-done="${idOf(card)}" title="Mark as done" aria-label="Done: ${P.esc(nameOf(card))}">`);
    }

    // Progress chain: one link per card, to the right of the heading or under it when space is short.
    for (const { head, cards } of sections) {
      if (!cards.length) continue;
      const text = document.createElement('div');
      text.append(...head.childNodes);
      head.append(text);
      head.classList.add('c-head');
      head.insertAdjacentHTML('beforeend', `<ol class="c-chain">${cards.map((card) => `
        <li><a href="#${card.id}" data-chain="${idOf(card)}" data-name="${P.esc(nameOf(card))}">
          <span class="c-mark">${markOf(card)}</span><span class="c-tick">${tick}</span></a></li>`).join('')}</ol>`);
    }

    document.body.insertAdjacentHTML('beforeend', '<div class="c-toast" role="status"></div>');
    const toast = document.body.lastElementChild;
    let toastTimer = null;
    const say = (text) => {
      clearTimeout(toastTimer);
      toast.innerHTML = `${tick}<span>${P.esc(text)}</span>`;
      toast.classList.add('on');
      toastTimer = setTimeout(() => toast.classList.remove('on'), TOAST_MS);
    };

    // Search results are copies of the cards, so every copy is updated, not just the one clicked.
    function paint() {
      const done = load();
      for (const box of document.querySelectorAll('[data-done]')) {
        box.checked = done.has(box.dataset.done);
        box.closest('.n-card').classList.toggle('is-done', box.checked);
      }
      for (const { head, cards } of sections) {
        const chain = head.querySelector('.c-chain');
        if (!chain) continue;
        let count = 0;
        for (const link of chain.querySelectorAll('[data-chain]')) {
          const on = done.has(link.dataset.chain);
          count += on;
          link.classList.toggle('is-done', on);
          link.setAttribute('aria-label', `${link.dataset.name}${on ? ', done' : ''}`);
        }
        chain.setAttribute('aria-label', `Progress: ${count} of ${cards.length} done`);
      }
    }

    document.addEventListener('change', (e) => {
      const box = e.target.closest('[data-done]');
      if (!box) return;
      const done = load();
      if (box.checked) done.add(box.dataset.done); else done.delete(box.dataset.done);
      save(done);
      paint();
      const card = box.closest('.n-card');
      if (!calm.matches) card.animate([{ transform: 'scale(.98)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
      say(`${nameOf(card)} ${box.checked ? 'marked as done' : 'unmarked'}`);
    });

    // Search re-renders its copies; paint them as they appear.
    const results = main.querySelector('.v-results');
    if (results) new MutationObserver(paint).observe(results, { childList: true });
    // Another tab ticked something.
    addEventListener('storage', (e) => { if (e.key === KEY) paint(); });
    paint();
  }

  return { mount };
})();
