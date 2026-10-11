/* vida.js — «Una vida en la misma mesa». Escenario fijo sobre engine/stage.js: un solo bucle,
   todo se pinta desde el progreso del escenario (u = 0..1). Sin JS o con movimiento reducido no
   se crea nada: el CSS por defecto apila las cuatro fotos con su leyenda y su tarjeta. */
(function () {
  'use strict';
  var root = document.documentElement;
  var sec = document.getElementById('productos');
  if (!sec || !sec.classList.contains('vida') || !window.Stage) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var bp = Stage._math.blockProgress;
  var $ = function (s, r) { return (r || sec).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || sec).querySelectorAll(s)); };

  /* ── cronología en vh (docs/02-concepto-inmersiva.md § 3) ── */
  var SEG = { intro: 100, s1: 260, t12: 160, s2: 260, t23: 110, s3: 260, t34: 110, s4: 220 };
  var HOLD = ['s1', 's2', 's3', 's4'], TRANS = [null, 't12', 't23', 't34'];
  var T = {}, total = 0, k;
  for (k in SEG) total += SEG[k];
  var acc = 0; for (k in SEG) { T[k] = { at: acc / total, span: SEG[k] / total }; acc += SEG[k]; }

  root.classList.add('vida-live');
  var pin = $('.vida__pin'), ground = $('.vida__ground'), lead = $('.vida__lead');
  var sun = $('.vida__sun'), cool = $('.vida__cool');
  var photos = $$('.vida__photo'), stages = $$('.vida__stage'), album = $$('.vida__album a');
  var film = $('#vida-film');
  var portrait = function () { return innerWidth <= 820; };

  /* ── el hilo: el SVG visible según el ancho ── */
  var threads = { desk: $('[data-thread="desk"]'), port: $('[data-thread="port"]') };
  var thread = null, threadLen = 0, nodes = [], threadPath = null, head = null, halo = null;
  function pickThread() {
    var want = portrait() ? threads.port : threads.desk;
    if (want === thread) return;
    thread = want;
    var p = $('.vida__thread-path', thread);
    threadLen = p.getTotalLength(); threadPath = p;
    p.style.strokeDasharray = threadLen; p.style.strokeDashoffset = threadLen;
    nodes = $$('.vida__node', thread);
    head = $('.vida__head', thread); halo = $('.vida__halo', thread);
  }

  /* ── posición del escenario en el documento ── */
  var top = 0, span = 1;
  function layout() {
    var r = sec.getBoundingClientRect();
    top = r.top + scrollY; span = Math.max(1, sec.offsetHeight - innerHeight);
    pickThread();
  }

  /* ── el clip T1 (sólo escritorio): se pide cuando el escenario se acerca, nunca al abrir ── */
  var filmReady = false, filmDur = 0, lastSeek = 0, filmArmed = false;
  function armFilm() {
    if (filmArmed || !film) return;
    if (getComputedStyle(film).display === 'none') return;
    filmArmed = true;
    film.src = film.getAttribute('data-src');
    film.addEventListener('loadedmetadata', function () { filmDur = film.duration || 0; });
    film.addEventListener('canplay', function () { filmReady = true; }, { once: true });
    film.load();
  }
  if (film && 'IntersectionObserver' in window) {
    var fio = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { armFilm(); fio.disconnect(); } }, { rootMargin: '60% 0px' });
    fio.observe(sec);
  }
  function seekFilm(t) {
    if (!filmReady || !filmDur) return;
    var now = performance.now();
    if (film.seeking && now - lastSeek < 400) return;  /* no se re-busca cada cuadro; el perro guardián escribe igual a los 400 ms */
    var want = clamp(t, 0, filmDur - 0.04);
    if (Math.abs(film.currentTime - want) < 0.02) return;
    film.currentTime = want; lastSeek = now;
  }

  /* ── pintar un cuadro ── */
  var lastU = -1, photoOp = [-1, -1, -1, -1], filmOp = -1, cur = -1;
  function setOp(el, v, store, i) {
    v = +v.toFixed(3);
    if (store && store[i] === v) return;
    if (store) store[i] = v;
    el.style.opacity = v;
    el.style.visibility = v > 0 ? 'visible' : 'hidden';
  }
  function frame(s) {
    var u = clamp((s.current - top) / span, 0, 1);
    if (u === lastU) return;
    lastU = u;
    /* portada del escenario: visible al entrar, se va en la segunda mitad de la intro */
    var l = 1 - bp(u, T.intro.at + T.intro.span * 0.45, T.intro.span * 0.55);
    lead.style.setProperty('--lead', l.toFixed(3));
    lead.style.visibility = l > 0 ? 'visible' : 'hidden';
    /* acercamiento lentísimo: una sola transformación sobre el suelo entero */
    ground.style.transform = 'scale(' + (1 + 0.07 * u).toFixed(4) + ')';
    /* la luz es el reloj: la luz fría de la ventana (izquierda) se va, la dorada llega por la derecha */
    if (sun) {
      var sx = (-24 + 44 * u).toFixed(2), sy = (-6 + 14 * u).toFixed(2);
      sun.style.transform = 'translate(' + sx + 'vw,' + sy + 'vh)';
      sun.style.opacity = (0.04 + 0.18 * u * u).toFixed(3);
      cool.style.transform = 'translate(' + (-18 + 10 * u).toFixed(2) + 'vw,' + (-10 - 6 * u).toFixed(2) + 'vh)';
      cool.style.opacity = (0.26 * (1 - u) * (1 - u)).toFixed(3);
    }
    /* el clip entre Empiezan y Crecen */
    var useFilm = filmReady && !portrait();
    var t12 = T.t12, fOp = 0;
    if (useFilm) {
      var pf = bp(u, t12.at, t12.span);
      if (pf > 0 && pf < 1) {
        fOp = bp(u, t12.at, t12.span * 0.12);
        seekFilm(pf * filmDur);
      } else if (pf >= 1) { fOp = 0; }
      if (fOp !== filmOp) { setOp(film, fOp); filmOp = fOp; }
    }
    /* fotos: la k entra durante su transición; la k-1 se apaga cuando la k llegó entera */
    var current = 0, i;
    for (i = 0; i < 4; i++) {
      var tr = TRANS[i] ? T[TRANS[i]] : null, nx = i < 3 ? T[TRANS[i + 1]] : null;
      var inP = i === 0 ? 1 : (useFilm && i === 1 ? bp(u, tr.at + tr.span * 0.84, tr.span * 0.16) : bp(u, tr.at, tr.span));
      var outQ = nx ? bp(u, nx.at, nx.span) : 0;
      var gone = outQ >= 1;
      if (i === 0 && useFilm && fOp >= 1) inP = 0;  /* bajo el clip, la foto 1 no hace falta */
      var op = gone ? 0 : inP;
      setOp(photos[i], op, photoOp, i);
      /* la foto que se va se acerca un poco mientras se funde: disolvencia de cine, sólo transform */
      photos[i].style.setProperty('--out', (1 + 0.045 * outQ).toFixed(4));
      var hold = T[HOLD[i]];
      if (u >= hold.at - (tr ? tr.span * 0.5 : 0)) current = i;
    }
    /* leyendas y tarjetas: entran al asentarse la etapa, salen al empezar la transición siguiente */
    for (i = 0; i < 4; i++) {
      var h = T[HOLD[i]], n = i < 3 ? T[TRANS[i + 1]] : null;
      var out = n ? bp(u, n.at, n.span * 0.3) : 0;
      var cap = bp(u, h.at - (i ? 0.012 : 0), h.span * 0.09) * (1 - out);
      var cap2 = bp(u, h.at - (i ? 0.012 : 0) + h.span * 0.03, h.span * 0.1) * (1 - out);
      var card = bp(u, h.at + h.span * 0.03, h.span * 0.12) * (1 - out);
      var st = stages[i];
      st.style.setProperty('--cap', cap.toFixed(3));
      st.style.setProperty('--cap2', cap2.toFixed(3));
      st.style.setProperty('--c', card.toFixed(3));
      var on = cap > 0 || card > 0;
      if (on !== (st.getAttribute('data-on') === '1')) { st.setAttribute('data-on', on ? '1' : '0'); }
    }
    /* el hilo: se dibuja desde la intro hasta el final del escenario; un nudo por etapa */
    var t0 = T.intro.at + T.intro.span * 0.3, t = bp(u, t0, 0.985 - t0);
    threadPath.style.strokeDashoffset = (threadLen * (1 - t)).toFixed(1);
    /* el cometa: la punta viva del hilo, que avanza con el scroll y se apaga cuando el hilo sale del cuadro */
    if (head) {
      var live = t > 0.002 && t < 0.985;
      if (live) {
        var pt = threadPath.getPointAtLength(threadLen * t);
        head.setAttribute('cx', pt.x.toFixed(1)); head.setAttribute('cy', pt.y.toFixed(1));
        halo.setAttribute('cx', pt.x.toFixed(1)); halo.setAttribute('cy', pt.y.toFixed(1));
      }
      head.style.opacity = live ? 1 : 0; halo.style.opacity = live ? 1 : 0;
    }
    for (i = 0; i < nodes.length; i++) {
      var hk = T[HOLD[i]];
      nodes[i].style.opacity = bp(u, hk.at - 0.004, 0.02).toFixed(2);
    }
    if (current !== cur) {
      cur = current;
      for (i = 0; i < album.length; i++) album[i].classList.toggle('is-current', i === current);
    }
  }

  var stage = Stage.create({ stage: sec, pin: pin, segments: SEG, mobileScale: 0.8, lerp: 0.11, onFrame: frame, autostart: false });
  window.__vida = { stage: stage, T: T, layout: layout, u: function () { return lastU; } };

  /* ── anclas: suaves con el motor; dentro del escenario, a la etapa ── */
  var STAGE_AT = { 'vida-empiezan': 's1', 'vida-crecen': 's2', 'vida-retiran': 's3', 'vida-legado': 's4' };
  function targetY(id) {
    if (id === 'productos') return top;
    if (STAGE_AT[id]) return top + (T[STAGE_AT[id]].at + 0.012) * span;
    var el = document.getElementById(id); if (!el) return null;
    return el.getBoundingClientRect().top + scrollY - 24;  /* las secciones llevan su propio aire arriba; la píldora se esconde al bajar */
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    var id = a.getAttribute('href').slice(1); if (!id) return;
    layout();
    var y = targetY(id); if (y == null) return;
    e.preventDefault();
    y = clamp(y, 0, root.scrollHeight - innerHeight);
    if (stage.L.on) { stage.L.target = y; } else { scrollTo({ top: y, behavior: 'smooth' }); }
    history.replaceState(null, '', '#' + id);
  });

  function start() {
    layout(); stage.start(); layout();
    addEventListener('resize', function () { layout(); lastU = -1; });
    addEventListener('load', function () { layout(); lastU = -1; });
    setTimeout(function () { layout(); lastU = -1; }, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
