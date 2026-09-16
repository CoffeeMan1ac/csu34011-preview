/* Slide text for search, kept correct with nobody maintaining it.
   Each PDF is recognised by its size and a checksum of its last bytes (one small range request),
   so a replaced file is noticed however it was uploaded, even if the new file has the same size.
   Text then comes from, in order: the bundled copy (pdf-seed.js) if the file is unchanged, this
   browser's saved copy, or the PDF itself, read here with PDF.js and saved for next time.
   A missing or unreadable file simply has no page matches. Load after data.js. */
window.PDFINDEX = (() => {
  const TAIL = 1024;
  const READERS = 3;
  const PDFJS = new URL('vendor/pdfjs-4.10.38/', document.currentScript.src).href;
  // The bundled text is fetched only when search is first used, so plain visits don't download it.
  const SEED_URL = new URL('pdf-seed.js', document.currentScript.src).href;
  let seedLoading = null;
  const loadSeed = () => (seedLoading ||= window.PDF_SEED ? Promise.resolve(window.PDF_SEED) : new Promise((done) => {
    const tag = document.createElement('script');
    tag.src = SEED_URL;
    tag.onload = () => done(window.PDF_SEED || {});
    tag.onerror = () => done({}); // no bundle: every file is read in the browser instead
    document.head.append(tag);
  }));

  // Changed PDFs are read only once allowed: when someone starts searching, or earlier if the page decides to.
  let allow;
  const allowed = new Promise((go) => { allow = go; });
  const known = new Map();           // href -> pages, or null when the file can't be used
  const pending = new Map();         // href -> promise
  const stats = { seed: 0, saved: 0, read: 0, unavailable: 0 };
  const current = new Map();         // href -> fingerprint of the file on the server now
  const fromBundle = new Set();      // hrefs whose text came from the bundle, so need no saved copy
  let reading = 0;                   // files waiting for, or being, read
  let lib = null;

  // FNV-1a, run twice with different starting values: a small fingerprint with no dependencies.
  const fnv = (bytes, h) => { for (const b of bytes) h = Math.imul(h ^ b, 16777619) >>> 0; return h; };
  const hex = (n) => n.toString(16).padStart(8, '0');

  async function fingerprint(url) {
    const r = await fetch(url, { headers: { Range: `bytes=-${TAIL}` }, cache: 'no-store' });
    if (!r.ok) {
      // Release the error page's body, or the browser keeps the request open.
      r.body?.cancel().catch(() => {});
      throw new Error(`HTTP ${r.status}`);
    }
    let size;
    let tail;
    let whole = null;
    if (r.status === 206) {
      size = Number((r.headers.get('content-range') || '').split('/')[1]);
      tail = new Uint8Array(await r.arrayBuffer());
    } else {
      // The server ignored the range and sent the whole file; use it rather than fetch it twice.
      whole = new Uint8Array(await r.arrayBuffer());
      size = whole.length;
      tail = whole.subarray(Math.max(0, size - TAIL));
    }
    return { fp: `${size}:${hex(fnv(tail, 2166136261))}${hex(fnv(tail, 2166136261 ^ (size >>> 0)))}`, whole };
  }

  // This browser's saved copies, keyed by fingerprint. Any storage failure just means reading again.
  const store = (() => {
    let opening = null;
    const open = () => (opening ||= new Promise((done) => {
      try {
        const req = indexedDB.open('csu34011-slide-text', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('pages');
        req.onsuccess = () => done(req.result);
        req.onerror = () => done(null);
      } catch { done(null); }
    }));
    const run = async (mode, op) => {
      const db = await open();
      if (!db) return undefined;
      return new Promise((done) => {
        try {
          const t = db.transaction('pages', mode);
          const req = op(t.objectStore('pages'));
          t.oncomplete = () => done(req.result);
          t.onerror = t.onabort = () => done(undefined);
        } catch { done(undefined); }
      });
    };
    // Drop saved copies of files the site no longer has, so storage never grows beyond the current set.
    const keepOnly = (keys) => run('readwrite', (s) => {
      const req = s.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        if (!keys.has(c.key)) c.delete();
        c.continue();
      };
      return req;
    });
    const count = () => run('readonly', (s) => s.count());
    return { get: (key) => run('readonly', (s) => s.get(key)), put: (key, value) => run('readwrite', (s) => s.put(value, key)), keepOnly, count };
  })();

  // At most a few PDFs are read at once, so a big change doesn't swamp a slow machine.
  let active = 0;
  const queue = [];
  const limited = async (task) => {
    if (active >= READERS) await new Promise((go) => queue.push(go));
    else active++;
    try { return await task(); } finally { const next = queue.shift(); if (next) next(); else active--; }
  };

  // "12 / 40" is a page counter, not content. Lines that repeat on most pages are usually running
  // headers, so they are skipped when choosing a slide's title, but they stay searchable: on slides
  // that build up step by step, real content repeats on most pages too.
  const COUNTER = /^\d+\s*\/\s*\d+$/;
  function shape(pageLines) {
    const seen = new Map();
    for (const lines of pageLines) for (const l of new Set(lines)) seen.set(l, (seen.get(l) || 0) + 1);
    const n = pageLines.length;
    const repeated = new Set([...seen].filter(([, c]) => n > 4 && c > n * 0.5).map(([l]) => l));
    return pageLines.map((lines, i) => ({
      p: i + 1,
      t: (lines.find((l) => l.length > 2 && !repeated.has(l)) || '').slice(0, 90),
      x: lines.join(' ').replace(/\s+/g, ' '),
    }));
  }

  // gap: how wide a horizontal gap (as a share of the text height) counts as a space between words.
  const READING = { gap: 0.15 };

  // Some PDFs draw an accent as its own glyph before the letter ("G¨ odel"); put it back on the letter.
  const ACCENTS = { '¨': '̈', '´': '́', 'ˆ': '̂', '˜': '̃', '¸': '̧', '˚': '̊', 'ˇ': '̌' };
  const compose = (s) => s.replace(/([¨´ˆ˜¸˚ˇ]) ?([A-Za-z])/g, (m, mark, letter) => letter + ACCENTS[mark]).normalize('NFC');

  async function read(url, whole, opts = READING) {
    lib ||= import(`${PDFJS}pdf.min.mjs`).then((m) => { m.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`; return m; });
    const pdfjs = await lib;
    const doc = await pdfjs.getDocument(whole ? { data: whole.slice(), isEvalSupported: false } : { url, isEvalSupported: false }).promise;
    try {
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const { items } = await (await doc.getPage(i)).getTextContent();
        const lines = [];
        let line = '';
        let prev = null;
        for (const it of items) {
          if (!('str' in it)) continue;
          const x = it.transform[4];
          const y = it.transform[5];
          const h = it.height || Math.hypot(it.transform[2], it.transform[3]) || 10;
          if (prev) {
            if (Math.abs(y - prev.y) > Math.max(2, prev.h * 0.5)) { lines.push(line); line = ''; }
            // A gap, or a jump back to the left (labels in diagrams), separates words.
            else if ((x - prev.end > h * opts.gap || x < prev.end - h * 0.5) && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' ';
          }
          line += it.str;
          prev = { y, h, end: x + it.width };
          if (it.hasEOL) { lines.push(line); line = ''; prev = null; }
        }
        if (line) lines.push(line);
        // Rejoin words hyphenated across a line break ("course-" + "work"), as PDF readers do.
        const joined = [];
        for (const l of lines.map((s) => compose(s).replace(/\s+/g, ' ').trim()).filter((s) => s && !COUNTER.test(s))) {
          const last = joined[joined.length - 1];
          if (last && /[a-z]-$/i.test(last) && /^[a-z]/.test(l)) joined[joined.length - 1] = last.slice(0, -1) + l;
          else joined.push(l);
        }
        pages.push(joined);
      }
      return shape(pages);
    } finally {
      doc.destroy();
    }
  }

  async function resolve(href) {
    const url = LPN.url(href);
    let fp;
    let whole;
    try { ({ fp, whole } = await fingerprint(url)); } catch { stats.unavailable++; return null; }
    current.set(href, fp);
    const seed = await loadSeed();
    if (seed[href] && seed[href].fp === fp) { stats.seed++; fromBundle.add(href); return seed[href].pages; }
    fromBundle.delete(href);
    const saved = await store.get(fp);
    if (saved) { stats.saved++; return saved; }
    reading++;
    try {
      await allowed;
      const pages = await limited(() => read(url, whole));
      stats.read++;
      store.put(fp, pages);
      return pages;
    } catch {
      stats.unavailable++;
      return null;
    } finally {
      reading--;
    }
  }

  // Make sure every listed file is known; onUpdate(href) runs as each one becomes available.
  // Saved copies worth keeping: files on the server now that the bundle doesn't already cover.
  const needed = (hrefs) => new Set(hrefs.filter((h) => !fromBundle.has(h)).map((h) => current.get(h)).filter(Boolean));

  function ensure(hrefs, onUpdate = () => {}) {
    const all = Promise.all(hrefs.map((href) => {
      if (known.has(href)) return known.get(href);
      if (!pending.has(href)) {
        pending.set(href, resolve(href).then((pages) => {
          known.set(href, pages);
          pending.delete(href);
          onUpdate(href);
          return pages;
        }));
      }
      return pending.get(href);
    }));
    all.then(() => store.keepOnly(needed(hrefs)));
    return all;
  }

  // Used by build_seed.py: read every file afresh, exactly as a visitor's browser would.
  async function buildSeed(hrefs) {
    const out = {};
    await Promise.all(hrefs.map(async (href) => {
      const url = LPN.url(href);
      const { fp, whole } = await fingerprint(url);
      out[href] = { fp, pages: await limited(() => read(url, whole)) };
    }));
    return out;
  }

  return {
    ensure,
    pages: (href) => known.get(href),
    buildSeed,
    busy: () => reading > 0,
    startReading: () => allow(),
    stats: () => ({ ...stats, pdfjsLoaded: !!lib }),
    savedCount: () => store.count(),
    neededCount: (hrefs) => needed(hrefs).size,
    // For tests: read one file with different settings, bypassing every saved copy.
    readWith: (href, opts) => read(LPN.url(href), null, { ...READING, ...opts }),
  };
})();
