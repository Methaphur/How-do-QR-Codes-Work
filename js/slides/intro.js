/* Slide 1 — the live QR code, assembled module by module. */
(function (Q) {
  'use strict';
  const { R } = Q;
  let cv, stats, parts = [], t0 = 0, shown = null;
  const lp = R.loop((dt, t) => { draw(t); return t - t0 < maxEnd + 100; });
  let maxEnd = 0;

  function fly(m) {
    const n = m.length;
    parts = [];
    maxEnd = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!m[y][x]) continue;
      const a = Math.random() * Math.PI * 2, d = n * (0.7 + Math.random() * 0.8);
      const dist = Math.hypot(x - n / 2, y - n / 2) / n;
      const p = {
        x, y, sx: n / 2 + Math.cos(a) * d, sy: n / 2 + Math.sin(a) * d,
        rot: (Math.random() - 0.5) * 4, delay: dist * 700 + Math.random() * 350, dur: 800,
      };
      maxEnd = Math.max(maxEnd, p.delay + p.dur);
      parts.push(p);
    }
  }
  function morph(from, to) {
    const n = to.length;
    parts = [];
    maxEnd = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = from && from.length === n ? from[y][x] : 0, b = to[y][x];
      if (!a && !b) continue;
      const p = { x, y, sx: x, sy: y, rot: 0, delay: a !== b ? Math.random() * 220 : 0, dur: a !== b ? 260 : 0, grow: b && !a, shrink: a && !b };
      maxEnd = Math.max(maxEnd, p.delay + p.dur);
      parts.push(p);
    }
  }

  function draw(t) {
    const { ctx, w } = R.fit(cv);
    const cur = shown;
    const g = R.geo(cur.size, w, 3);
    ctx.fillStyle = R.css('--paper');
    ctx.fillRect(0, 0, w, w);
    const ink = R.css('--ink'), hot = R.css('--data');
    const el = t - t0;
    for (const p of parts) {
      let k = p.dur ? Math.max(0, Math.min(1, (el - p.delay) / p.dur)) : 1;
      if (R.reduced()) k = 1;
      const e = R.ease.outCubic(k);
      let s = 1;
      if (p.grow) s = e; else if (p.shrink) s = 1 - e; else if (p.rot) s = 0.35 + 0.65 * e;
      if (s <= 0.01) continue;
      const cx = g.ox + (p.sx + (p.x - p.sx) * e + 0.5) * g.cell;
      const cy = g.oy + (p.sy + (p.y - p.sy) * e + 0.5) * g.cell;
      const sz = g.cell * s + 0.4;
      ctx.save();
      ctx.translate(cx, cy);
      if (p.rot) ctx.rotate(p.rot * (1 - e));
      ctx.globalAlpha = p.rot ? Math.min(1, 0.2 + e) : 1;
      ctx.fillStyle = (p.grow || p.shrink) && k < 1 ? hot : ink;
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
  }

  function setStats(c) {
    stats.innerHTML = `<span>Version <b>${c.version}</b></span><span><b>${c.size}×${c.size}</b> modules</span><span><b>${c.modeName}</b> mode</span>` +
      `<span>EC <b>${c.ecl}</b></span><span><b>${c.info.totalCodewords}</b> codewords = ${c.info.dataCodewords} data + ${c.info.totalCodewords - c.info.dataCodewords} EC</span>`;
  }

  function replay() { shown = Q.current(); fly(shown.matrix); t0 = performance.now(); lp.stop(); lp.start(); }

  Q.slide('intro', {
    init(el) {
      cv = el.querySelector('#intro-qr');
      stats = el.querySelector('#intro-stats');
      el.querySelector('#intro-replay').addEventListener('click', replay);
    },
    enter() { setStats(Q.current()); replay(); },
    leave() { lp.stop(); },
    update() {
      const c = Q.current();
      setStats(c);
      if (shown && c.matrix !== shown.matrix) { morph(shown.matrix, c.matrix); shown = c; t0 = performance.now(); lp.stop(); lp.start(); }
      else draw(performance.now());
    },
  });
})(globalThis.QRLab);
