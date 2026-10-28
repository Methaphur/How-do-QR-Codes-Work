/* Canvas helpers shared by every slide. */
(function (Q) {
  'use strict';
  const root = document.documentElement;

  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function alpha(color, a) {
    // works for #rrggbb tokens
    const c = color.replace('#', '');
    const n = parseInt(c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* Size a canvas to its CSS box at device pixel ratio. Returns ctx in CSS pixels. */
  function fit(canvas, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 300;
    const hh = h || canvas.clientHeight || w;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hh * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h: hh, dpr };
  }

  /* Geometry for drawing an n×n matrix with a quiet zone into a w×w square. */
  function geo(n, w, quiet) {
    quiet = quiet == null ? 2 : quiet;
    const cell = w / (n + quiet * 2);
    return { n, cell, ox: quiet * cell, oy: quiet * cell, w, quiet };
  }
  function hit(g, px, py) {
    const x = Math.floor((px - g.ox) / g.cell), y = Math.floor((py - g.oy) / g.cell);
    return x >= 0 && y >= 0 && x < g.n && y < g.n ? { x, y } : null;
  }
  function pointer(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /* Draw a matrix. opts.color(x, y, v) may return a fill (or null to skip a module). */
  function drawMatrix(ctx, m, g, opts) {
    opts = opts || {};
    const ink = opts.ink || css('--ink');
    if (opts.paper !== false) {
      ctx.fillStyle = opts.paper || css('--paper');
      ctx.fillRect(0, 0, g.w, g.w);
    }
    const gap = opts.gap || 0;
    for (let y = 0; y < g.n; y++) for (let x = 0; x < g.n; x++) {
      const v = m[y][x];
      const fill = opts.color ? opts.color(x, y, v) : v ? ink : null;
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(g.ox + x * g.cell + gap, g.oy + y * g.cell + gap, g.cell - gap * 2 + 0.4, g.cell - gap * 2 + 0.4);
    }
  }

  const ease = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* A tiny rAF loop that can be started/stopped by slides. */
  function loop(fn) {
    let id = 0, last = 0, running = false;
    const tick = t => {
      if (!running) return;
      const dt = last ? Math.min(64, t - last) : 16;
      last = t;
      if (fn(dt, t) === false) { running = false; return; }
      id = requestAnimationFrame(tick);
    };
    return {
      start() { if (!running) { running = true; last = 0; id = requestAnimationFrame(tick); } },
      stop() { running = false; cancelAnimationFrame(id); },
      get running() { return running; },
    };
  }

  const hex = v => v.toString(16).toUpperCase().padStart(2, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const vis = s => s.replace(/ /g, '␣');

  Q.R = { css, alpha, fit, geo, hit, pointer, drawMatrix, ease, reduced, loop, hex, esc, vis };
})(globalThis.QRLab = globalThis.QRLab || {});
