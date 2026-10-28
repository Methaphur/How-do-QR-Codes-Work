/* Slide 11 — BCH(15,5) format information and where it lives. */
(function (Q) {
  'use strict';
  const { R, QR } = Q;
  let cv, divEl, bitsEl, eclSeg, maskSeg;
  let cur = null, ecl = 'M', mask = 0, hot = -1, sweep = -1, t0 = 0, geo = null;

  const lp = R.loop((dt, t) => {
    sweep = Math.floor((t - t0) / 70);
    if (sweep > 15) { sweep = -1; draw(); renderBits(); return false; }
    draw(); renderBits();
  });

  const pad = (v, n) => QR.bin(v, n);

  function renderDivision() {
    const f = QR.formatBits(ecl, mask);
    const G = 0x537;
    const lines = [];
    const eb = pad(QR.ECL[ecl].bits, 2), mb = pad(mask, 3);
    lines.push(`<span class="x">level ${ecl} = </span><span class="d">${eb}</span><span class="x">   mask ${mask} = </span><span class="d">${mb}</span>`);
    let rem = f.data << 10;
    lines.push(`<span class="d">${pad(f.data, 5)}</span>0000000000   <span class="x">data × x¹⁰</span>`);
    for (let i = 14; i >= 10; i--) {
      if (!((rem >> i) & 1)) continue;
      const g = G << (i - 10);
      const gs = pad(g, 15).replace(/^0+/, m => ' '.repeat(m.length));
      lines.push(`<span class="g">${gs.padEnd(15)}</span>   <span class="x">⊕ generator, shifted</span>`);
      rem ^= g;
      lines.push(`${pad(rem, 15)}`);
    }
    lines.push(`<span class="x">remainder (BCH bits):</span> <span class="e">${pad(f.bch, 10)}</span>`);
    lines.push(`<span class="d">${pad(f.data, 5)}</span><span class="e">${pad(f.bch, 10)}</span>   <span class="x">data + remainder</span>`);
    lines.push(`<span class="x">101010000010010   ⊕ fixed mask</span>`);
    lines.push(`<b>${pad(f.bits, 15)}</b>   <span class="x">→ written into the symbol</span>`);
    divEl.innerHTML = lines.map((l, i) => `<div class="ln" style="--i:${i}">${l}</div>`).join('');
  }

  function renderBits() {
    const f = QR.formatBits(ecl, mask);
    let h = '';
    for (let i = 14; i >= 0; i--) {
      const cls = [i >= 10 ? 'd' : 'e'];
      if (i === hot || i === sweep) cls.push('hot');
      h += `<span class="${cls.join(' ')}" data-b="${i}" title="bit ${i}">${(f.bits >> i) & 1}</span>`;
    }
    bitsEl.innerHTML = h;
  }

  function draw() {
    const { ctx, w } = R.fit(cv);
    geo = R.geo(cur.size, w, 2);
    const f = QR.formatBits(ecl, mask);
    const [A, B] = QR.formatPositions(cur.size);
    const pos = {};
    A.forEach(([x, y], i) => (pos[y * cur.size + x] = i));
    B.forEach(([x, y], i) => (pos[y * cur.size + x] = i));
    const ink = R.css('--ink'), d = R.css('--data'), e = R.css('--ec'), acc = R.css('--err');
    R.drawMatrix(ctx, cur.matrix, geo, {
      color(x, y, v) {
        const i = pos[y * cur.size + x];
        if (i == null) return v ? R.alpha(ink, 0.14) : null;
        const bit = (f.bits >> i) & 1;
        const c = i >= 10 ? d : e;
        if (i === hot || i === sweep) return acc;
        return bit ? c : R.alpha(c, 0.18);
      },
    });
    if (geo.cell > 11) {
      ctx.font = `${Math.round(geo.cell * 0.5)}px ${R.css('--f-mono')}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [x, y, i] of A.map((p, i) => [...p, i]).concat(B.map((p, i) => [...p, i]))) {
        ctx.fillStyle = (f.bits >> i) & 1 ? '#fff' : R.alpha(ink, 0.7);
        ctx.fillText(i, geo.ox + (x + 0.5) * geo.cell, geo.oy + (y + 0.5) * geo.cell);
      }
    }
  }

  function refresh(animate) {
    eclSeg.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.v === ecl));
    maskSeg.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', +b.dataset.v === mask));
    renderDivision(); renderBits(); draw();
    if (animate && !R.reduced()) { t0 = performance.now(); lp.stop(); lp.start(); }
  }

  Q.slide('format', {
    init(el) {
      cv = el.querySelector('#fmt-qr'); divEl = el.querySelector('#fmt-div'); bitsEl = el.querySelector('#fmt-bits');
      eclSeg = el.querySelector('#fmt-ecl'); maskSeg = el.querySelector('#fmt-mask');
      eclSeg.innerHTML = QR.ECL_NAMES.map(e => `<button type="button" data-v="${e}">${e}</button>`).join('');
      maskSeg.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map(m => `<button type="button" data-v="${m}">${m}</button>`).join('');
      eclSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ecl = b.dataset.v; refresh(true); } });
      maskSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { mask = +b.dataset.v; refresh(true); } });
      bitsEl.addEventListener('pointerover', e => { const s = e.target.closest('[data-b]'); if (s) { hot = +s.dataset.b; renderBits(); draw(); } });
      bitsEl.addEventListener('pointerleave', () => { hot = -1; renderBits(); draw(); });
      cv.addEventListener('pointermove', e => {
        if (!geo) return;
        const p = R.pointer(cv, e), h = R.hit(geo, p.x, p.y);
        let nh = -1;
        if (h) QR.formatPositions(cur.size).forEach(c => c.forEach(([x, y], i) => { if (x === h.x && y === h.y) nh = i; }));
        if (nh !== hot) { hot = nh; renderBits(); draw(); }
      });
      cv.addEventListener('pointerleave', () => { hot = -1; renderBits(); draw(); });
    },
    enter() { cur = Q.current(); ecl = cur.ecl; mask = cur.mask; refresh(true); },
    leave() { lp.stop(); },
    update() { if (Q.current() !== cur) { cur = Q.current(); ecl = cur.ecl; mask = cur.mask; refresh(false); } else draw(); },
  });
})(globalThis.QRLab);
