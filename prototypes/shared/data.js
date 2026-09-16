/* Course content model, transcribed from the live site (index.html, log) on 2026-09-15.
   Every prototype renders from this one file, so variants differ only in UX, not content. */
window.LPN = (() => {
  // Files come from the local copy by default. Set window.LPN_BASE before this script to point a
  // published copy at the live site instead, so no course material has to be hosted anywhere else.
  const base = window.LPN_BASE || new URL('../../original/www.scss.tcd.ie/Tim.Fernando/LPN/', document.currentScript.src).href;
  const url = (p) => (/^https?:/.test(p) ? p : base + p);

  // Site switches. search: the search box. keywords: match the hidden keywords below (off: they may
  // not describe a PDF once it is replaced). aliases: treat "dcg" as "definite clause grammar" etc.
  const settings = { search: true, keywords: false, aliases: true };

  const course = {
    code: 'CSU34011',
    title: 'Symbolic Programming',
    // From intro.pdf ("as of 11 September 2026 and subject to change").
    lectures: [{ day: 'Mon', time: '10:00–11:00', room: 'JOLY' }, { day: 'Tue', time: '14:00–15:00', room: 'Goldsmith Hall' }],
    assessment: '80% two-hour exam in December, 20% coursework (two assignments)',
    book: { title: 'Learn Prolog Now', authors: 'Blackburn, Bos, Striegnitz', href: 'https://lpn.swi-prolog.org/' },
    blackboard: null, // live site says "See Blackboard" with no link
    // Optional one-line notice. Set a string to show it at the top of the page; null hides the strip.
    notice: null,
    swish: 'https://swish.swi-prolog.org',
  };

  // kind: course | chapter | supplement.  needs = draft prerequisite guesses (confirm with lecturer).
  const decks = [
    // intro.pdf is the one-page course info sheet (linked as "See Blackboard (intro)" on the live site); 0.pdf is linked as "why?".
    { id: 'intro', kind: 'course', title: 'Course info', blurb: 'Lecture times and rooms, labs, assessment', slides: 'PDFs/intro.pdf', pages: 1 },
    { id: 'why', kind: 'course', title: 'Why logic?', blurb: 'Logic & the search for truth: liar’s paradox, Russell, Cantor, Gödel, Turing', slides: 'PDFs/0.pdf', pages: 11 },

    { id: '1', kind: 'chapter', num: 1, title: 'Introduction', blurb: 'Logic programming: describing vs ordering', slides: 'PDFs/1.pdf', pages: 69, exercises: 'PDFs/1ex.pdf',
      extras: [{ label: 'note: first program', href: 'note1', type: 'code' }], needs: [],
      keywords: 'facts rules queries knowledge base syntax atoms variables declarative imperative' },
    { id: '2', kind: 'chapter', num: 2, title: 'Unification & Proofs', blurb: 'Unification in Prolog and proof search', slides: 'PDFs/2.pdf', pages: 63, exercises: 'PDFs/2ex.pdf',
      needs: ['1'], keywords: 'unification = occurs check proof search tree backtracking' },
    { id: '3', kind: 'chapter', num: 3, title: 'Recursion', blurb: 'Recursive definitions and non-termination', slides: 'PDFs/3.pdf', pages: 45, exercises: 'PDFs/3ex.pdf',
      needs: ['2'], keywords: 'recursion descend successor addition clause order goal order termination infinite loop' },
    { id: '4', kind: 'chapter', num: 4, title: 'Lists', blurb: 'A recursive data structure', slides: 'PDFs/4.pdf', pages: 52, exercises: 'PDFs/4ex.pdf',
      needs: ['3'], keywords: 'list head tail | member anonymous variable _ recursing down lists' },
    { id: '5', kind: 'chapter', num: 5, title: 'Arithmetic', blurb: 'is/2 and other built-in arithmetic predicates', slides: 'PDFs/5.pdf', pages: 57, exercises: 'PDFs/5ex.pdf',
      needs: ['3'], keywords: 'is/2 arithmetic comparison =:= < accumulator length max' },
    { id: '6', kind: 'chapter', num: 6, title: 'More Lists', blurb: 'append/3 and reverse/2 two ways', slides: 'PDFs/6.pdf', pages: 43, exercises: 'PDFs/6ex.pdf',
      needs: ['4', '5'], keywords: 'append prefix suffix sublist reverse naive accumulator' },
    { id: '7', kind: 'chapter', num: 7, title: 'Definite Clause Grammars', blurb: 'Context-free grammars and difference lists', slides: 'PDFs/7.pdf', pages: 44, exercises: 'PDFs/7ex.pdf',
      extras: [{ label: 'difference lists', href: 'PDFs/diffList.pdf', type: 'pdf', pages: 4 }], needs: ['6'],
      keywords: 'DCG --> context free grammar CFG difference lists parsing' },
    { id: 'farg', kind: 'supplement', parent: '7', title: 'Regular grammars & finite automata', blurb: 'As DCGs (+ regular expressions)', slides: 'PDFs/farg.pdf', pages: 13,
      needs: ['7'], keywords: 'regular grammar finite automaton automata regex regular expression' },
    { id: '8', kind: 'chapter', num: 8, title: 'More DCGs', blurb: 'Extra arguments and tests', slides: 'PDFs/8.pdf', pages: 30, exercises: 'PDFs/8ex.pdf',
      needs: ['7'], keywords: 'extra arguments parse tree {} beyond context free a^n b^n c^n' },
    { id: '9', kind: 'chapter', num: 9, title: 'A closer look at terms', blurb: '==/2, strings and operators, term structure', slides: 'PDFs/9.pdf', pages: 45, exercises: 'PDFs/9ex.pdf',
      needs: ['2'], keywords: '== comparing terms atom/1 var/1 functor/3 arg/3 =.. operators op strings' },
    { id: '10', kind: 'chapter', num: 10, title: 'Cuts & Negation', blurb: 'Backtracking pruned & negation as failure', slides: 'PDFs/10.pdf', pages: 61, exercises: 'PDFs/10ex.pdf',
      needs: ['2', '3'], keywords: 'cut ! green red negation as failure \\+ fail if-then-else' },
    { id: 'mi', kind: 'supplement', parent: '10', title: 'Mode indicators', blurb: 'Documenting Prolog predicates', slides: 'PDFs/mi.pdf', pages: 20,
      needs: ['5'], keywords: 'mode + - ? input output arguments documentation' },
    { id: '11', kind: 'chapter', num: 11, title: 'Database Manipulation', blurb: 'KB changes and collecting answers', slides: 'PDFs/11.pdf', pages: 51, exercises: 'PDFs/11ex.pdf',
      needs: ['10'], keywords: 'assert retract dynamic findall bagof setof memoisation' },
    { id: 'fm', kind: 'supplement', parent: '11', title: 'Finite models', blurb: 'Including finite automata and strings', slides: 'PDFs/fm.pdf', pages: 24,
      needs: ['farg', '11'], keywords: 'finite model automata strings' },
    { id: '12', kind: 'chapter', num: 12, title: 'Working with Files', blurb: 'Handling files and modularity', slides: 'PDFs/12.pdf', pages: 38, exercises: 'PDFs/12ex.pdf',
      needs: ['11'], keywords: 'files consult modules include read write streams' },
  ];

  const labs = {
    fromWeek: 2, place: 'E3 Learning Foundry',
    slots: [
      { day: 'Tue', time: '13:00–14:00', room: '02.009' },
      { day: 'Tue', time: '16:00–17:00', room: '02.009' },
      { day: 'Wed', time: '14:00–15:00', room: '02.009' },
      { day: 'Wed', time: '15:00–16:00', room: '01.009' },
    ],
  };

  const support = [
    { label: 'Support beyond Prolog', href: 'PDFs/support.pdf', type: 'pdf' },
    { label: 'Career support', href: 'careerSupport.pdf', type: 'pdf' },
    { label: 'Niteline: video', href: 'https://youtu.be/ccmj-CjzZcU', type: 'video' },
    { label: 'Niteline: slide', href: 'niteline.png', type: 'image' },
    { label: 'Niteline: flyer', href: 'flyer.png', type: 'image' },
  ];

  // Real log (week 1). Later weeks are SIMULATED so prototypes can be tested mid-term.
  const realLog = [{ week: 1, day: 'Mon', covered: [{ deck: 'intro' }, { deck: 'why' }, { deck: '1', page: 20 }] }];
  const simPace = { 2: [['1'], ['2', 30]], 3: [['2'], ['3']], 4: [['4']], 5: [['5']], 6: [['6']], 7: 'Reading week',
    8: [['7'], ['farg']], 9: [['8']], 10: [['9']], 11: [['10'], ['mi']], 12: [['11'], ['fm'], ['12']] };

  function logUpTo(week) {
    const log = [...realLog];
    for (let w = 2; w <= week; w++) {
      const p = simPace[w];
      if (typeof p === 'string') log.push({ week: w, note: p, simulated: true });
      else log.push({ week: w, day: 'Mon', simulated: true, covered: p.map(([deck, page]) => ({ deck, page })) });
    }
    return log;
  }

  // Where the class is: the last deck mentioned in the log, and the page reached (null = finished).
  function position(week) {
    const entries = logUpTo(week).filter((e) => e.covered);
    const last = entries.at(-1).covered.filter((c) => byId[c.deck].kind !== 'course').at(-1);
    return last ? { deck: byId[last.deck], page: last.page ?? null } : null;
  }

  const byId = Object.fromEntries(decks.map((d) => [d.id, d]));
  const label = (d) => (d.kind === 'chapter' ? `${d.num}. ${d.title}` : d.title);

  return { settings, course, decks, byId, labs, support, url, label, logUpTo, position, maxWeek: 12, realWeek: 1 };
})();
