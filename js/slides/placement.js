/* Slide 5 — the zig-zag placement of codeword bits. */
(function (Q) {
  'use strict';
  const { R } = Q;
  let cv, info, playBtn, speed, pathBox, cur, geo, k = 0, playing = true, lookup = null, hover = null;

  const lp = R.loop(dt => {
    if (!playing) return false;
    const total = cur.placement.length;
    k = Math.min(total, k + (dt / 1000) * speed.value * 8);
    draw();
    if (k >= total) { playing = false; playBtn.textContent = 'Replay'; return false; }
  });

  function colorFor(p, v) {
    if (p.codeword < 0) return v ? R.css('--muted') : null;
    const o = cur.origin[p.codeword];
    const base = o.ec ? (p.codeword % 2 ? '--ec' : '--ec-2') : (p.codeword % 2 ? '--data' : '--data-2');
    const c = R.css(base);
    return v ? c : R.alpha(c, 0.16);
  }

  function draw() {
    const { ctx, w } = R.fit(cv);
    const n = cur.size;
    geo = R.geo(n, w, 2);
    ctx.fillStyle = R.css('--paper');
    ctx.fillRect(0, 0, w, w);
    const fnc = R.css('--fn');
    // function patterns
    R.drawMatrix(ctx, cur.base, geo, {
      paper: false,
      color: (x, y, v) => (cur.fn[y][x] ? (v ? R.alpha(fnc, 0.75) : R.alpha(fnc, 0.08)) : null),
    });
    // faint dots on empty data cells
    ctx.fillStyle = R.alpha(R.css('--ink'), 0.12);
    const kk = Math.floor(k);
    for (let i = kk; i < cur.placement.length; i++) {
      const p = cur.placement[i];
      ctx.fillRect(geo.ox + (p.x + 0.45) * geo.cell, geo.oy + (p.y + 0.45) * geo.cell, geo.cell * 0.1 + 0.6, geo.cell * 0.1 + 0.6);
    }
    for (let i = 0; i < kk; i++) {
      const p = cur.placement[i];
      const fill = colorFor(p, cur.base[p.y][p.x]);
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(geo.ox + p.x * geo.cell, geo.oy + p.y * geo.cell, geo.cell + 0.4, geo.cell + 0.4);
    }
    // highlighted codeword on hover
    if (hover != null && hover >= 0) {
      ctx.strokeStyle = R.css('--err');
      ctx.lineWidth = 2;
      cur.placement.forEach(p => { if (p.codeword === hover) ctx.strokeRect(geo.ox + p.x * geo.cell + 1, geo.oy + p.y * geo.cell + 1, geo.cell - 2, geo.cell - 2); });
    }
    // path
    if (pathBox.checked && kk > 1) {
      ctx.beginPath();
      for (let i = 0; i < kk; i++) {
        const p = cur.placement[i];
        const X = geo.ox + (p.x + 0.5) * geo.cell, Y = geo.oy + (p.y + 0.5) * geo.cell;
        i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.strokeStyle = R.alpha(R.css('--ink'), 0.45);
      ctx.lineWidth = Math.max(1, geo.cell * 0.12);
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    // cursor
    if (kk < cur.placement.length && kk > 0) {
      const p = cur.placement[kk - 1];
      ctx.strokeStyle = R.css('--err');
      ctx.lineWidth = 2.5;
      ctx.strokeRect(geo.ox + p.x * geo.cell - 1, geo.oy + p.y * geo.cell - 1, geo.cell + 2, geo.cell + 2);
    }
    if (hover == null) {
      const cw = cur.placement[Math.max(0, kk - 1)].codeword;
      info.innerHTML = kk >= cur.placement.length
        ? `<span>All <b>${cur.final.length}</b> codewords placed</span><span><b>${cur.placement.length - cur.final.length * 8}</b> remainder bits</span><span>Before masking</span>`
        : `<span>Placing codeword <b>${cw + 1}</b> of ${cur.final.length}</span><span>${cur.origin[cw] && cur.origin[cw].ec ? '<span class="k-ec">error correction</span>' : '<span class="k-data">data</span>'}</span>`;
    }
  }

  function reset(play) {
    cur = Q.current();
    lookup = {};
    cur.placement.forEach(p => (lookup[p.y * cur.size + p.x] = p));
    k = 0;
    playing = play && !R.reduced();
    if (!playing) k = cur.placement.length;
    playBtn.textContent = playing ? 'Pause' : 'Play';
    draw();
    if (playing) lp.start();
  }

  Q.slide('placement', {
    init(el) {
      cv = el.querySelector('#place-qr');
      info = el.querySelector('#place-info');
      playBtn = el.querySelector('#place-play');
      speed = el.querySelector('#place-speed');
      pathBox = el.querySelector('#place-path');
      playBtn.addEventListener('click', () => {
        if (k >= cur.placement.length) { reset(true); return; }
        playing = !playing;
        playBtn.textContent = playing ? 'Pause' : 'Play';
        if (playing) lp.start();
      });
      el.querySelector('#place-step').addEventListener('click', () => {
        playing = false; playBtn.textContent = 'Play';
        k = Math.min(cur.placement.length, (Math.floor(k / 8) + 1) * 8);
        draw();
      });
      el.querySelector('#place-reset').addEventListener('click', () => reset(true));
      pathBox.addEventListener('change', draw);
      cv.addEventListener('pointermove', e => {
        if (!geo) return;
        const p = R.pointer(cv, e), h = R.hit(geo, p.x, p.y);
        const m = h && lookup[h.y * cur.size + h.x];
        if (m && m.codeword >= 0) {
          hover = m.codeword;
          const v = cur.final[m.codeword], o = cur.origin[m.codeword];
          info.innerHTML = `<span>Codeword <b>${m.codeword + 1}</b> (${o.ec ? '<span class="k-ec">EC</span>' : '<span class="k-data">data</span>'}, block ${o.block + 1})</span><span>value <b>${v}</b> = ${Q.QR.bin(v, 8).split('').map((b, i) => (i === m.bit ? `<b style="color:var(--err)">${b}</b>` : b)).join('')}</span><span>bit ${m.bit + 1} of 8</span>`;
        } else {
          hover = h ? -1 : null;
          if (h) info.innerHTML = m ? '<span>Remainder bit, always 0 before masking</span>' : `<span>Function pattern: <b>${cur.region[h.y][h.x]}</b>. Data skips it.</span>`;
        }
        if (!playing) draw();
      });
      cv.addEventListener('pointerleave', () => { hover = null; if (!playing) draw(); });
    },
    enter() { reset(true); },
    leave() { lp.stop(); },
    update() {
      const c = Q.current();
      if (c !== cur) reset(true); else draw();
    },
  });
})(globalThis.QRLab);
