/* Slide 10 — the eight mask patterns and their penalty scores. */
(function (Q) {
  'use strict';
  const { R, QR } = Q;
  let cv, grid, formulaEl, penEl, curEl, totalEl, viewSeg;
  let cur = null, sel = 0, prevSel = 0, view = 'masked', t0 = 0, geo = null;

  const lp = R.loop((dt, t) => { draw(t); return t - t0 < 700; });

  function matrixFor(mk) {
    if (view === 'raw') return cur.base;
    if (view === 'pattern') return cur.base.map((row, y) => row.map((v, x) => (cur.fn[y][x] ? v : QR.MASKS[mk].fn(x, y) ? 1 : 0)));
    return cur.variants[mk].matrix;
  }

  function draw(t) {
    const { ctx, w } = R.fit(cv);
    geo = R.geo(cur.size, w, 2);
    const ink = R.css('--ink'), fnc = R.css('--fn');
    const a = matrixFor(prevSel), b = matrixFor(sel);
    const p = R.reduced() ? 1 : R.ease.inOut(Math.min(1, (t - t0) / 600));
    const front = p * (cur.size * 2 + 4) - 2;
    R.drawMatrix(ctx, b, geo, {
      color(x, y) {
        const m = x + y < front ? b : a;
        const v = m[y][x];
        if (view === 'pattern') return cur.fn[y][x] ? (v ? R.alpha(ink, 0.15) : null) : v ? fnc : null;
        if (Math.abs(x + y - front) < 1.5 && a[y][x] !== b[y][x]) return R.css('--accent');
        return v ? ink : null;
      },
    });
  }

  function select(mk) {
    prevSel = sel; sel = mk; t0 = performance.now();
    lp.stop(); lp.start();
    grid.querySelectorAll('.maskbtn').forEach((b, i) => b.classList.toggle('is-on', i === sel));
    formulaEl.innerHTML = `<span>mask ${sel}: <b>${QR.MASKS[sel].formula}</b></span>`;
    curEl.textContent = sel;
    const P = cur.variants[sel].penalty;
    const max = Math.max(...cur.variants.map(v => Math.max(v.penalty.n1, v.penalty.n2, v.penalty.n3, v.penalty.n4)), 1);
    const rows = [['N1 runs', P.n1, 'var(--data)'], ['N2 blocks', P.n2, 'var(--ec)'], ['N3 finder-like', P.n3, 'var(--err)'], ['N4 balance', P.n4, 'var(--fn)']];
    penEl.innerHTML = rows.map(([n, v, c]) => `<div class="penalty"><span>${n}</span><div class="bar"><i style="width:${(v / max) * 100}%;background:${c}"></i></div><span style="text-align:right">${v}</span></div>`).join('') +
      `<p class="caption">${P.darkPct.toFixed(1)}% dark modules</p>`;
    totalEl.textContent = `total ${P.total}${sel === cur.mask ? ' · chosen' : ''}`;
  }

  function thumbs() {
    const best = cur.mask;
    grid.innerHTML = QR.MASKS.map((m, i) => `<button type="button" class="maskbtn ${i === best ? 'best' : ''}" data-m="${i}" title="${m.formula}">
      <canvas width="60" height="60"></canvas><span class="t"><b>Mask ${i}</b><em>${cur.variants[i].penalty.total}</em></span></button>`).join('');
    grid.querySelectorAll('canvas').forEach((c, i) => {
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f5f7fa'; ctx.fillRect(0, 0, 60, 60);
      ctx.fillStyle = '#2a2f3a';
      const s = 60 / 12;
      for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (QR.MASKS[i].fn(x, y)) ctx.fillRect(x * s, y * s, s, s);
    });
  }

  function setup() {
    cur = Q.current();
    thumbs();
    sel = prevSel = cur.mask;
    select(cur.mask);
  }

  Q.slide('masking', {
    init(el) {
      cv = el.querySelector('#mask-qr'); grid = el.querySelector('#mask-grid');
      formulaEl = el.querySelector('#mask-formula'); penEl = el.querySelector('#mask-pen');
      curEl = el.querySelector('#mask-cur'); totalEl = el.querySelector('#mask-total');
      viewSeg = el.querySelector('#mask-view');
      grid.addEventListener('click', e => { const b = e.target.closest('.maskbtn'); if (b) select(+b.dataset.m); });
      viewSeg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        view = b.dataset.v;
        viewSeg.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
        prevSel = sel; t0 = 0; draw(performance.now());
      });
    },
    enter: setup,
    leave() { lp.stop(); },
    update() { if (Q.current() !== cur) setup(); else draw(performance.now()); },
  });
})(globalThis.QRLab);
