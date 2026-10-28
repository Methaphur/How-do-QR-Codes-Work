/* Shared state ("your message"), slide registry and deck navigation. */
(function (Q) {
  'use strict';

  /* ---------- shared message state ---------- */
  const listeners = [];
  Q.state = { text: 'QR codes are math!', ecl: 'M' };
  let cache = null, lastGood = null;
  Q.error = null;

  Q.current = function () {
    if (cache) return cache;
    const r = Q.QR.encode(Q.state.text, { ecl: Q.state.ecl });
    if (r.error) { Q.error = r.error; cache = lastGood; }
    else { Q.error = null; cache = lastGood = r; }
    return cache;
  };
  Q.encodeWith = (opts) => Q.QR.encode(Q.state.text, Object.assign({ ecl: Q.state.ecl }, opts));
  Q.onChange = fn => listeners.push(fn);
  function changed() {
    cache = null;
    Q.current();
    syncControls();
    listeners.forEach(fn => fn());
    const s = active();
    if (s && s.def.update) s.def.update();
  }
  Q.setText = t => { if (t !== Q.state.text) { Q.state.text = t; changed(); } };
  Q.setEcl = e => { if (e !== Q.state.ecl) { Q.state.ecl = e; changed(); } };

  function syncControls() {
    document.querySelectorAll('[data-msg]').forEach(inp => { if (inp !== document.activeElement) inp.value = Q.state.text; });
    document.querySelectorAll('[data-ecl] button').forEach(b => b.classList.toggle('is-on', b.dataset.v === Q.state.ecl));
    document.querySelectorAll('[data-msg-error]').forEach(el => { el.textContent = Q.error || ''; el.hidden = !Q.error; });
  }

  /* ---------- slide registry ---------- */
  const defs = {};
  Q.slide = (id, def) => { defs[id] = def; };
  let slides = [], idx = -1;
  const active = () => slides[idx];

  function go(i, fromHash) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === idx) return;
    const prev = active();
    const dir = i > idx ? 1 : -1;
    if (prev) { prev.el.classList.remove('is-active', 'back'); if (prev.def.leave) prev.def.leave(); }
    idx = i;
    const s = active();
    s.el.classList.add('is-active');
    s.el.classList.toggle('back', dir < 0);
    s.el.scrollTop = 0;
    s.seen = true;
    if (!s.inited && s.def.init) { s.def.init(s.el); s.inited = true; }
    if (s.def.enter) s.def.enter(s.el);
    if (!fromHash && location.hash.slice(1) !== s.id) {
      // absolute URL so a <base> tag can't redirect it; fall back if the history API is refused
      const url = location.href.split('#')[0] + '#' + s.id;
      try { history.replaceState(null, '', url); } catch (_) { location.replace(url); }
    }
    renderNav();
  }
  Q.go = id => { const i = slides.findIndex(s => s.id === id); if (i >= 0) go(i); };

  function renderNav() {
    const dots = document.querySelectorAll('.modules button');
    dots.forEach((d, i) => {
      d.classList.toggle('now', i === idx);
      d.classList.toggle('seen', !!slides[i].seen && i !== idx);
      d.setAttribute('aria-current', i === idx ? 'step' : 'false');
    });
    document.querySelector('.counter').textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    document.getElementById('prev').disabled = idx === 0;
    document.getElementById('next').disabled = idx === slides.length - 1;
  }

  function isTyping(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  function init() {
    const els = [...document.querySelectorAll('.slide')];
    slides = els.map(el => ({ el, id: el.dataset.id, def: defs[el.dataset.id] || {}, seen: false, inited: false }));

    const mod = document.querySelector('.modules');
    slides.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = (i + 1) + '. ' + (s.el.dataset.title || s.id);
      b.setAttribute('aria-label', b.title);
      b.addEventListener('click', () => go(i));
      mod.appendChild(b);
    });
    document.getElementById('prev').addEventListener('click', () => go(idx - 1));
    document.getElementById('next').addEventListener('click', () => go(idx + 1));

    document.addEventListener('keydown', e => {
      if (isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && e.target.tagName !== 'BUTTON')) { e.preventDefault(); go(idx + 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(slides.length - 1);
    });

    // swipe between slides (not when the gesture starts on an interactive surface)
    let sx = 0, sy = 0, ok = false;
    const deck = document.querySelector('.deck');
    deck.addEventListener('touchstart', e => {
      ok = !e.target.closest('canvas, input, button, .divgrid, .tape, .binlines, .eq');
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    deck.addEventListener('touchend', e => {
      if (!ok) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) go(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });

    window.addEventListener('hashchange', () => {
      const i = slides.findIndex(s => s.id === location.hash.slice(1));
      if (i >= 0) go(i, true);
    });
    let rz = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(() => { const s = active(); if (s && s.def.update) s.def.update(); });
    });

    // shared message inputs and EC-level pickers
    document.querySelectorAll('[data-msg]').forEach(inp => {
      inp.value = Q.state.text;
      inp.addEventListener('input', () => Q.setText(inp.value));
    });
    document.querySelectorAll('[data-ecl]').forEach(seg => {
      seg.innerHTML = Q.QR.ECL_NAMES.map(e => `<button type="button" data-v="${e}" title="${{ L: '~7%', M: '~15%', Q: '~25%', H: '~30%' }[e]} of codewords recoverable">${e}</button>`).join('');
      seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) Q.setEcl(b.dataset.v); });
    });
    document.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); Q.go(a.dataset.goto); }));

    // theme toggle
    const tbtn = document.getElementById('theme');
    tbtn.addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme
        ? document.documentElement.dataset.theme === 'dark'
        : !window.matchMedia('(prefers-color-scheme: light)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('qr-theme', document.documentElement.dataset.theme); } catch (_) {}
      const s = active(); if (s && s.def.update) s.def.update();
    });
    try { const t = localStorage.getItem('qr-theme'); if (t) document.documentElement.dataset.theme = t; } catch (_) {}

    Q.current();
    syncControls();
    const start = slides.findIndex(s => s.id === location.hash.slice(1));
    go(start >= 0 ? start : 0, true);
  }

  document.addEventListener('DOMContentLoaded', init);
})(globalThis.QRLab = globalThis.QRLab || {});
