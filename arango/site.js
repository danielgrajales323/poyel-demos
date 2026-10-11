/* Arango Legacy Advisors — motor de la página.
   Lenis + GSAP ScrollTrigger sincronizados en un solo ticker. Todo el contenido vive en el DOM;
   el video y las líneas SVG son capas visuales detrás. */
(function () {
  'use strict';
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EN = document.documentElement.lang === 'en';
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (reduced) document.documentElement.classList.add('no-motion');

  /* ---------- 1. Lenis + GSAP en un ticker ---------- */
  let lenis = null;
  if (!reduced && hasGsap && typeof Lenis !== 'undefined' && !document.documentElement.classList.contains('vida-live')) {
    gsap.registerPlugin(ScrollTrigger);
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    // anclas internas por Lenis
    qa('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const el = q(id);
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -20, duration: 1.2, easing: (x) => 1 - Math.pow(1 - x, 4) });
        history.replaceState(null, '', id);
      });
    });
  } else if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
  }

  /* ---------- 2. Revelado palabra a palabra ---------- */
  function splitWords(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let i = 0;
    nodes.forEach((n) => {
      if (!n.nodeValue.trim()) return;
      const frag = document.createDocumentFragment();
      n.nodeValue.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'w';
        const inner = document.createElement('span'); inner.textContent = part;
        inner.style.setProperty('--d', Math.min(i++ * 0.022, 0.4).toFixed(3) + 's');
        w.appendChild(inner); frag.appendChild(w);
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  const reveals = qa('.reveal');
  if (!reduced) reveals.forEach(splitWords);
  qa('.reveal-up').forEach((el, i) => el.style.setProperty('--d', ((i % 4) * 0.08).toFixed(2) + 's'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  [...reveals, ...qa('.reveal-up')].forEach((el) => io.observe(el));
  // el hero se revela al cargar, no al hacer scroll
  qa('.hero .reveal').forEach((el) => setTimeout(() => el.classList.add('is-in'), 250));

  /* ---------- 3. Marquesinas: sólo giran cuando están en pantalla ---------- */
  const mio = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('is-visible', en.isIntersecting));
  }, { threshold: 0 });
  qa('[data-marquee]').forEach((m) => mio.observe(m));

  /* ---------- 4. Las líneas: se dibujan ---------- */
  function prepLine(path) {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    return len;
  }
  const heroPath = q('#line-hero');
  if (heroPath && !reduced && hasGsap) {
    prepLine(heroPath);
    gsap.to(heroPath, { strokeDashoffset: 0, duration: 2.4, ease: 'expo.out', delay: 0.5 });
    // parallax suave del contenido del hero
    gsap.to('.hero__content', { y: -60, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } });
    gsap.to('.hero__bg', { y: 80, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } });
  }
  qa('.line--faint .line__path, .contact__line .line__path').forEach((p) => {
    if (reduced || !hasGsap) return;
    prepLine(p);
    gsap.to(p, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: p.closest('section'), start: 'top 85%', end: 'center 45%', scrub: 1 } });
  });

  /* ---------- 5. La pila: la línea que no se corta ---------- */
  const stack = q('.stack__pin');
  if (stack && hasGsap) {
    const cards = qa('.stack__card', stack);
    const cut = q('#stack-cut'), healed = q('#stack-healed');
    // dos geometrías: en escritorio el hueco vive en la banda libre a la derecha de las tarjetas;
    // en móvil, en la banda inferior. Sólo se anima la que está visible.
    const desk = window.matchMedia('(min-width: 901px)').matches;
    const svg = q(desk ? '[data-stack-line="desk"]' : '[data-stack-line="mob"]', stack);
    const left = q('[data-seg="left"]', svg), bridge = q('[data-seg="bridge"]', svg), right = q('[data-seg="right"]', svg);
    if (!reduced) {
      [left, right].forEach((p) => { prepLine(p); gsap.to(p, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.stack', start: 'top 70%', end: 'top 10%', scrub: 1 } }); });
      prepLine(bridge);
      // el hueco se cierra a medida que las cuatro dudas se apilan
      gsap.to(bridge, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: stack, start: 'top 60%', end: 'bottom 90%', scrub: 1 } });
      gsap.to(cut, { opacity: 0, y: -20, ease: 'none', scrollTrigger: { trigger: stack, start: '40% 60%', end: '70% 60%', scrub: 1 } });
      gsap.to(healed, { opacity: 1, ease: 'none', scrollTrigger: { trigger: stack, start: '75% 60%', end: 'bottom 90%', scrub: 1 } });
      cards.forEach((card, i) => {
        const rot = i % 2 ? 2.2 : -2.2;
        gsap.fromTo(card, { rotate: rot * 1.6, y: 90 }, { rotate: rot * 0.35, y: 0, ease: 'none', scrollTrigger: { trigger: card, start: 'top 100%', end: 'top 25%', scrub: 0.8 } });
      });
    } else {
      cut.style.opacity = 0; healed.style.opacity = 1;
    }
  }

  /* ---------- 6. Pestañas ---------- */
  qa('[data-tabs]').forEach((tabs) => {
    const btns = qa('[role=tab]', tabs), panels = qa('[role=tabpanel]', tabs), imgs = qa('.tabs__img', tabs);
    function activate(btn) {
      btns.forEach((b) => { const on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      const id = btn.getAttribute('aria-controls');
      panels.forEach((p) => { const on = p.id === id; p.classList.toggle('is-active', on); p.hidden = !on; });
      imgs.forEach((im) => im.classList.toggle('is-active', im.dataset.for === id));
      if (hasGsap && !reduced) gsap.fromTo('#' + id, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out' });
    }
    btns.forEach((b, i) => {
      b.addEventListener('click', () => activate(b));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const n = btns[(i + 1) % btns.length]; n.focus(); activate(n); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const n = btns[(i - 1 + btns.length) % btns.length]; n.focus(); activate(n); }
      });
    });
  });

  /* ---------- 7. Calculadora DIME (aritmética, nunca una prima) ---------- */
  const calc = q('[data-calc]');
  if (calc) {
    const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');
    const inputs = {};
    qa('input[type=range]', calc).forEach((r) => { inputs[r.name] = r; });
    const outs = {}; qa('[data-out]', calc).forEach((o) => { outs[o.dataset.out] = o; });
    const amount = q('[data-amount]', calc);
    const eq = {}; qa('[data-eq]', calc).forEach((e) => { eq[e.dataset.eq] = e; });
    const hidden = q('input[name=estimacion]');
    let shown = 0;
    function paint(r) { const p = ((r.value - r.min) / (r.max - r.min)) * 100; r.style.setProperty('--p', p + '%'); }
    function compute(animate) {
      const v = {}; Object.keys(inputs).forEach((k) => { v[k] = +inputs[k].value; });
      outs.ingreso.textContent = usd(v.ingreso);
      outs.anios.textContent = v.anios + (EN ? (v.anios === 1 ? ' year' : ' years') : (v.anios === 1 ? ' año' : ' años'));
      outs.deudas.textContent = usd(v.deudas);
      outs.hipoteca.textContent = usd(v.hipoteca);
      outs.educacion.textContent = usd(v.educacion);
      outs.ahorros.textContent = usd(v.ahorros);
      const need = Math.max(0, v.ingreso * v.anios + v.deudas + v.hipoteca + v.educacion - v.ahorros);
      const rounded = Math.round(need / 1000) * 1000;
      eq.anios.textContent = v.anios;
      eq.deudas.textContent = usd(v.deudas + v.hipoteca);
      eq.mensual.textContent = usd(v.ingreso / 12);
      if (hidden && animate) hidden.value = usd(rounded);
      if (animate && !compute.used) { compute.used = true; if (window.__track) window.__track('calc_used', 'calculadora'); }
      if (animate && hasGsap && !reduced) {
        const o = { n: shown };
        gsap.to(o, { n: rounded, duration: 0.7, ease: 'expo.out', onUpdate: () => { amount.textContent = usd(o.n); } });
      } else {
        amount.textContent = usd(rounded);
      }
      shown = rounded;
    }
    Object.values(inputs).forEach((r) => { paint(r); r.addEventListener('input', () => { paint(r); compute(true); }); });
    compute(false);
  }

  /* ---------- 8. Formulario → WhatsApp con el mensaje listo ---------- */
  const form = q('[data-form]');
  if (form) {
    const err = q('[data-form-error]', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      if (!d.nombre.trim() || !d.telefono.trim()) { err.hidden = false; return; }
      err.hidden = true;
      const lines = (EN ? [
        'Hi, I am ' + d.nombre.trim() + '.',
        'I am interested in: ' + d.interes + '.',
        d.ciudad ? 'I am in ' + d.ciudad.trim() + '.' : '',
        d.correo ? 'My email: ' + d.correo.trim() : '',
        'My phone: ' + d.telefono.trim(),
        d.situacion ? 'My situation: ' + d.situacion.trim() : '',
        d.estimacion ? 'The calculator gave me ' + d.estimacion + ' of estimated coverage.' : '',
        'I would like my free consultation.'
      ] : [
        'Hola, soy ' + d.nombre.trim() + '.',
        'Me interesa: ' + d.interes + '.',
        d.ciudad ? 'Estoy en ' + d.ciudad.trim() + '.' : '',
        d.correo ? 'Mi correo: ' + d.correo.trim() : '',
        'Mi teléfono: ' + d.telefono.trim(),
        d.situacion ? 'Mi situación: ' + d.situacion.trim() : '',
        d.estimacion ? 'La calculadora me dio ' + d.estimacion + ' de cobertura estimada.' : '',
        'Quiero mi asesoría gratuita.'
      ]).filter(Boolean).join('\n');
      if (window.__track) window.__track('form_submit', 'contacto');
      window.open('https://wa.me/17816559014?text=' + encodeURIComponent(lines), '_blank', 'noopener');
    });
  }

  /* ---------- 9. Reels: el póster abre el embed oficial de Instagram en su lugar ---------- */
  qa('[data-reel]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      const wrap = a.parentElement;
      if (q('iframe', wrap)) return;
      const f = document.createElement('iframe');
      f.className = 'ig__embed';
      f.src = 'https://www.instagram.com/reel/' + a.dataset.reel + '/embed/';
      f.allow = 'autoplay; encrypted-media';
      f.title = a.querySelector('img').alt;
      f.loading = 'lazy';
      wrap.style.position = 'relative';
      wrap.appendChild(f);
    });
  });

  /* ---------- 10. La píldora se esconde al bajar rápido y vuelve al subir ---------- */
  const nav = q('#nav');
  let lastY = 0;
  function onScroll(y) {
    if (y > 120 && y > lastY + 4) nav.classList.add('is-hidden');
    else if (y < lastY - 4) nav.classList.remove('is-hidden');
    lastY = y;
  }
  if (lenis) lenis.on('scroll', (e) => onScroll(e.scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

  /* ---------- 11. El video del hero no gasta CPU fuera de pantalla ---------- */
  const vid = q('.hero__video');
  const pauseBtn = q('[data-pause]');
  if (vid && reduced) { vid.removeAttribute('autoplay'); vid.pause(); if (pauseBtn) pauseBtn.hidden = true; }
  if (vid && pauseBtn && !reduced) {
    pauseBtn.addEventListener('click', () => {
      const paused = vid.paused;
      if (paused) { vid.play().catch(() => {}); } else { vid.pause(); }
      vid.dataset.userPaused = paused ? '' : '1';
      pauseBtn.setAttribute('aria-pressed', paused ? 'false' : 'true');
      pauseBtn.textContent = paused ? (EN ? 'Pause video' : 'Pausar video') : (EN ? 'Play video' : 'Reproducir video');
    });
  }
  if (vid && !reduced) {
    const vio = new IntersectionObserver((en) => { if (vid.dataset.userPaused) return; en[0].isIntersecting ? vid.play().catch(() => {}) : vid.pause(); }, { threshold: 0.05 });
    vio.observe(vid);
  }
})();
