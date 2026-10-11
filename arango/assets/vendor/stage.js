/* stage.js — one sticky stage, one loop. Runtime for the picture-strip grammar (references/page-grammars.md § 9),
 * measured on pear.no (references/harvest/pear-no-study.md § 2–3, sites/pear.no/JS-notes.md).
 *
 *   <section class="stage"><div class="pin"> …layers… </div></section>
 *   Stage.create({
 *     stage: '.stage', pin: '.pin',
 *     segments: { hero: 1200, work: 600, bridge: 300, terms: 900, rest: 300, reel: 600, sky: 500, apply: 250, close: 700 }, // vh
 *     mobileScale: 7300 / 5350,            // taller stage on phones (optional)
 *     lerp: 0.085,                          // smoothing per frame (pear.no)
 *     blocks: [ { id: 'hero', at: 0, span: .224, update(p, s) { … } } ],   // p = 0..1 inside the block
 *     onFrame(s) { … }                      // s = { progress, current, velocity, vh, vw }
 *   })
 *   DOM blocks: any element with data-at="0.74" data-span="0.18" gets --p (0..1) and .is-live while 0<p<1.
 *   Stage.anchors() → { hero: { at, span }, … } — the same numbers the shot list uses (art-direction.md § 8).
 *   Stage.seek(fraction | 'segmentName') — smooth when the engine is on, native scrollTo otherwise.
 *
 * Engine ON only when neither prefers-reduced-motion nor a coarse pointer: then wheel is intercepted (preventDefault,
 * ctrl-wheel passes for zoom), keyboard scrolls, and `scroll` re-syncs when something else moved the page.
 * Engine OFF: native scroll, the loop just reads scrollY. Either way there is ONE rAF loop and every layer is painted from it.
 */
(function () {
  'use strict';
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var vh = function () { return innerHeight || document.documentElement.clientHeight || 0; };
  var vw = function () { return innerWidth || document.documentElement.clientWidth || 0; };
  /* segments {name: vh} → { total, table: {name: {at, span, vh}} } in stage fractions, in insertion order */
  var segmentTable = function (segments) {
    var names = Object.keys(segments), total = 0, i;
    for (i = 0; i < names.length; i++) total += +segments[names[i]] || 0;
    var table = {}, acc = 0;
    for (i = 0; i < names.length; i++) {
      var len = +segments[names[i]] || 0;
      table[names[i]] = { at: total ? acc / total : 0, span: total ? len / total : 0, vh: len };
      acc += len;
    }
    return { total: total, table: table };
  };
  /* progress of a block: 0 before `at`, 1 after `at + span`, linear between; span 0 → step */
  var blockProgress = function (progress, at, span) {
    if (!(span > 0)) return progress >= at ? 1 : 0;
    return clamp((progress - at) / span, 0, 1);
  };
  var easeOutExpo = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  var easePress = function (t) { /* cubic-bezier(.22,1,.36,1) ≈ */ var u = 1 - t; return 1 - u * u * u * (1 - 0.34 * t); };

  function create(opts) {
    opts = opts || {};
    var doc = document, root = doc.documentElement;
    var stageEl = typeof opts.stage === 'string' ? doc.querySelector(opts.stage) : (opts.stage || doc.querySelector('.stage'));
    var pinEl = typeof opts.pin === 'string' ? doc.querySelector(opts.pin) : (opts.pin || (stageEl && stageEl.querySelector('.pin')));
    var seg = segmentTable(opts.segments || { all: 100 });
    var reduced = !!(matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var coarse = !!(matchMedia && matchMedia('(pointer: coarse)').matches);
    var smooth = opts.smooth === false ? false : !reduced && !coarse;
    var L = { target: scrollY || 0, current: scrollY || 0, velocity: 0, on: smooth };
    var lerpK = opts.lerp || 0.085, lastSet = -1, raf = 0, blocks = [], domBlocks = [], api;

    function applyHeight() {
      if (!stageEl) return;
      var scale = coarse && opts.mobileScale ? opts.mobileScale : 1;
      stageEl.style.height = (seg.total * scale) + 'vh';
      stageEl.style.position = stageEl.style.position || 'relative';
      if (pinEl) { pinEl.style.position = 'sticky'; pinEl.style.top = '0'; pinEl.style.height = '100dvh'; pinEl.style.overflow = 'clip'; }
    }
    var maxScroll = function () { return Math.max(0, root.scrollHeight - vh()); };

    function collect() {
      blocks = (opts.blocks || []).slice();
      domBlocks = [];
      var els = doc.querySelectorAll('[data-at]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        domBlocks.push({ el: el, at: +el.getAttribute('data-at') || 0, span: +el.getAttribute('data-span') || 0, live: null });
      }
    }

    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (L.on) {
        var prev = L.current;
        L.current = lerp(L.current, L.target, lerpK);
        if (Math.abs(L.target - L.current) < 0.08) L.current = L.target;
        L.velocity = L.current - prev;
        if (Math.abs(scrollY - L.current) > 0.5) { lastSet = L.current; scrollTo(0, L.current); }
      } else {
        var y = scrollY || 0; L.velocity = y - L.current; L.current = L.target = y;
      }
      var max = maxScroll();
      var progress = max > 0 ? clamp(L.current / max, 0, 1) : 0;
      var s = { progress: progress, current: L.current, velocity: L.velocity, vh: vh(), vw: vw(), time: t, reduced: reduced };
      var i, b, p;
      for (i = 0; i < blocks.length; i++) {
        b = blocks[i]; p = blockProgress(progress, b.at, b.span);
        if (b.ease) p = b.ease(p);
        if (b.update && (p !== b._p || b.always)) b.update(p, s);
        b._p = p;
      }
      for (i = 0; i < domBlocks.length; i++) {
        b = domBlocks[i]; p = blockProgress(progress, b.at, b.span);
        if (p !== b._p) { b.el.style.setProperty('--p', p.toFixed(4)); b._p = p; }
        var live = p > 0 && p < 1;
        if (live !== b.live) { b.el.classList.toggle('is-live', live); b.live = live; }
      }
      if (opts.onFrame) opts.onFrame(s);
    }

    function onWheel(e) {
      if (e.ctrlKey) return; /* pinch-zoom passes */
      e.preventDefault();
      var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh() : 1;
      L.target = clamp(L.target + e.deltaY * unit, 0, maxScroll());
    }
    function onKey(e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      var h = vh();
      var d = { ArrowDown: 90, ArrowUp: -90, PageDown: h * 0.9, PageUp: -h * 0.9, ' ': h * 0.9, Home: -1e7, End: 1e7 }[e.key];
      if (d === undefined) return;
      e.preventDefault(); L.target = clamp(L.target + d, 0, maxScroll());
    }
    function onScroll() { /* something else moved the page (anchor, find-in-page, restore) */
      if (Math.abs(scrollY - lastSet) > 2) L.target = L.current = scrollY;
    }

    function start() {
      applyHeight(); collect();
      if (L.on) {
        addEventListener('wheel', onWheel, { passive: false });
        addEventListener('keydown', onKey);
        addEventListener('scroll', onScroll, { passive: true });
      }
      addEventListener('resize', applyHeight);
      doc.addEventListener('visibilitychange', function () { if (doc.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) raf = requestAnimationFrame(frame); });
      raf = requestAnimationFrame(frame);
      root.classList.add('stage-ready');
      root.classList.toggle('stage-smooth', L.on);
    }

    api = {
      L: L, reduced: reduced, coarse: coarse, segments: seg.table, total: seg.total,
      anchors: function () { return seg.table; },
      progress: function () { var m = maxScroll(); return m > 0 ? clamp(L.current / m, 0, 1) : 0; },
      seek: function (where) {
        var f = typeof where === 'string' ? (seg.table[where] ? seg.table[where].at : 0) : +where;
        var y = clamp(f * maxScroll(), 0, maxScroll());
        if (L.on) { L.target = y; } else { lastSet = y; scrollTo(0, y); L.target = L.current = y; }
      },
      add: function (block) { blocks.push(block); return block; },
      refresh: collect,
      destroy: function () { cancelAnimationFrame(raf); removeEventListener('wheel', onWheel); removeEventListener('keydown', onKey); removeEventListener('scroll', onScroll); removeEventListener('resize', applyHeight); },
      start: start
    };
    if (opts.autostart !== false) {
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
    }
    return api;
  }

  var Stage = { create: create, version: '1.0.0', _math: { lerp: lerp, clamp: clamp, vh: vh, segmentTable: segmentTable, blockProgress: blockProgress, easeOutExpo: easeOutExpo, easePress: easePress } };
  if (typeof module !== 'undefined' && module.exports) module.exports = Stage;
  if (typeof window !== 'undefined') window.Stage = Stage;
})();
