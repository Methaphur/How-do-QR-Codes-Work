/* Slide 9 — damage the code, decode it live with a real Reed–Solomon decoder. */
(function (Q) {
  'use strict';
  const { R, QR, GF } = Q;
  let cv, resEl, blocksEl, sumEl, mathEl, el;
  let cur = null, dmg = null, geo = null, tool = 'ink', painting = false, decor = [], lastMath = '', lastKey = '';

  function reset() {
    cur = Q.current();
    dmg = cur.matrix.map(r => r.slice());
    decor = [];
    run();
  }

  function draw() {
    const { ctx, w } = R.fit(cv);
    geo = R.geo(cur.size, w, 3);
    const ink = R.css('--ink'), err = R.css('--err');
    R.drawMatrix(ctx, dmg, geo, {
      color: (x, y, v) => (v !== cur.matrix[y][x] ? (v ? '#7a1f1f' : R.alpha(err, 0.28)) : v ? ink : null),
    });
    for (const d of decor) {
      const cx = geo.ox + d.x * geo.cell, cy = geo.oy + d.y * geo.cell;
      if (d.type === 'stain') {
        const g = ctx.createRadialGradient(cx, cy, d.r * geo.cell * 0.2, cx, cy, d.r * geo.cell);
        g.addColorStop(0, 'rgba(120,72,30,0.10)');
        g.addColorStop(0.85, 'rgba(120,72,30,0.22)');
        g.addColorStop(1, 'rgba(110,60,20,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, d.r * geo.cell, 0, Math.PI * 2); ctx.fill();
      } else if (d.type === 'logo') {
        const s = d.s * geo.cell;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = R.css('--data');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.18) : ctx.rect(cx - s / 2, cy - s / 2, s, s);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = R.css('--data');
        ctx.font = `800 ${Math.round(s * 0.26)}px ${R.css('--f-display')}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LOGO', cx, cy);
      }
    }
  }

  function paint(e) {
    const p = R.pointer(cv, e);
    const mx = (p.x - geo.ox) / geo.cell, my = (p.y - geo.oy) / geo.cell;
    const r = 0.95;
    let changed = false;
    for (let y = Math.floor(my - r); y <= Math.ceil(my + r); y++) for (let x = Math.floor(mx - r); x <= Math.ceil(mx + r); x++) {
      if (x < 0 || y < 0 || x >= cur.size || y >= cur.size) continue;
      if (Math.hypot(x + 0.5 - mx, y + 0.5 - my) > r) continue;
      const v = tool === 'ink' ? 1 : 0;
      if (dmg[y][x] !== v) { dmg[y][x] = v; changed = true; }
    }
    if (changed) run();
  }

  function dataCenter() {
    // pick a spot away from the finder patterns
    const n = cur.size;
    for (let t = 0; t < 50; t++) {
      const x = 4 + Math.random() * (n - 8), y = 4 + Math.random() * (n - 8);
      if ((x < 10 && y < 10) || (x > n - 10 && y < 10) || (x < 10 && y > n - 10)) continue;
      return [x, y];
    }
    return [n / 2, n / 2];
  }

  const actions = {
    stain() {
      const [x, y] = dataCenter(), r = 2.2 + Math.random() * 2.2;
      for (let yy = 0; yy < cur.size; yy++) for (let xx = 0; xx < cur.size; xx++)
        if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) < r && Math.random() < 0.55) dmg[yy][xx] = Math.random() < 0.6 ? 1 : 0;
      decor.push({ type: 'stain', x, y, r });
    },
    logo() {
      const n = cur.size, s = Math.round(n * 0.24);
      const x0 = Math.floor((n - s) / 2);
      for (let y = x0; y < x0 + s; y++) for (let x = x0; x < x0 + s; x++) dmg[y][x] = 0;
      decor.push({ type: 'logo', x: n / 2, y: n / 2, s });
    },
    noise() {
      const n = cur.size, k = Math.round(n * n * 0.02);
      for (let i = 0; i < k; i++) { const x = Math.floor(Math.random() * n), y = Math.floor(Math.random() * n); dmg[y][x] ^= 1; }
    },
    clear: reset,
  };

  function run() {
    draw();
    const rd = QR.read(dmg);
    // ground-truth damage per block
    const orig = cur.blocks.map(b => b.data.concat(b.ec));
    const damaged = rd.blocks ? rd.blocks.map((b, i) => b.received.reduce((s, v, j) => s + (v !== orig[i][j] ? 1 : 0), 0)) : null;
    const cap = Math.floor(cur.info.ec / 2);

    if (!rd.blocks) {
      resEl.className = 'result bad';
      resEl.innerHTML = `<small>Cannot decode</small>The format information is too damaged to tell the EC level and mask.`;
    } else if (rd.ok && rd.text === cur.text) {
      const fixed = rd.blocks.reduce((s, b) => s + b.errors, 0);
      resEl.className = 'result good';
      resEl.innerHTML = `<small>${fixed ? `Decoded after repairing ${fixed} byte${fixed > 1 ? 's' : ''}` : 'Decoded, no damage to the data'}</small>${R.esc(rd.text)}`;
    } else if (rd.ok) {
      resEl.className = 'result bad';
      resEl.innerHTML = `<small>Miscorrection: the damage pushed it to a different valid codeword</small>${R.esc(rd.text) || '(empty)'}`;
    } else {
      resEl.className = 'result bad';
      resEl.innerHTML = `<small>Cannot decode: ${R.esc(rd.reason)}</small>Too much damage in at least one block. Try a higher EC level.`;
    }

    if (damaged) {
      sumEl.textContent = `limit ${cap} per block · level ${cur.ecl}`;
      blocksEl.innerHTML = damaged.map((d, i) => `<div class="blockbar ${d > cap ? 'over' : ''}">
        <span>block ${i + 1}</span><div class="meter"><i style="width:${Math.min(100, (d / cap) * 100)}%"></i></div>
        <span>${d} / ${cap} ${rd.blocks[i].ok ? (d ? '✓ fixed' : '') : '✗'}</span></div>`).join('');
      renderMath(rd.blocks[0], orig[0]);
    }
  }

  function renderMath(b, orig) {
    const chip = (v, cls) => `<span class="${cls || ''}">${R.hex(v)}</span>`;
    const syn = b.syndromes.map(v => chip(v, v ? 'nz' : '')).join('');
    const clean = b.syndromes.every(v => v === 0);
    const lam = b.locator.map((c, i) => (i === 0 ? '1' : c ? `α${'<sup>' + GF.LOG[c] + '</sup>'}x${i > 1 ? '<sup>' + i + '</sup>' : ''}` : null)).filter(Boolean).join(' + ');
    let html = `<div class="step" style="--i:0"><span class="k">1 · syndromes S₀…S${b.syndromes.length - 1} = r(α⁰)…r(α${b.syndromes.length - 1})</span><div class="chips">${syn}</div>
      <span class="${clean ? 'k-ok' : 'k-err'}">${clean ? 'all zero → block is intact' : 'non-zero → something is wrong'}</span></div>`;
    if (!clean) {
      html += `<div class="step" style="--i:1"><span class="k">2 · Berlekamp–Massey → error locator</span><div>Λ(x) = ${lam}</div><span class="k">degree ${b.locator.length - 1}: expecting ${b.locator.length - 1} bad byte${b.locator.length - 1 === 1 ? '' : 's'}</span></div>`;
      if (b.ok) {
        html += `<div class="step" style="--i:2"><span class="k">3 · Chien search → positions where Λ(X⁻¹) = 0</span><div>bytes ${b.positions.map(p => '#' + (p + 1)).join(', ')}</div></div>`;
        html += `<div class="step" style="--i:3"><span class="k">4 · Forney → error values, XOR them in</span><div class="chips">${b.positions.map((p, k) => `<span>#${p + 1}: ${R.hex(b.received[p])} ⊕ ${R.hex(b.magnitudes[k])} = <b>${R.hex(b.corrected[p])}</b></span>`).join('')}</div></div>`;
        html += `<div class="step" style="--i:4"><span class="k">corrected block (original bytes restored)</span><div class="chips">${b.corrected.map((v, i) => chip(v, b.positions.includes(i) ? 'fx' : '')).join('')}</div></div>`;
      } else {
        html += `<div class="step" style="--i:2"><span class="k-err">✗ ${R.esc(b.reason)}. A block with ${b.syndromes.length} EC bytes can locate and fix at most ${b.syndromes.length / 2} errors.</span></div>`;
      }
    }
    const key = clean ? 'clean' : b.ok ? 'ok' + b.positions.length : 'fail';
    if (html !== lastMath) { mathEl.classList.toggle('still', key === lastKey); mathEl.innerHTML = html; lastMath = html; lastKey = key; }
  }

  Q.slide('repair', {
    init(e) {
      el = e;
      cv = el.querySelector('#rep-qr');
      resEl = el.querySelector('#rep-result');
      blocksEl = el.querySelector('#rep-blocks');
      sumEl = el.querySelector('#rep-sum');
      mathEl = el.querySelector('#rep-math');
      el.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
        tool = b.dataset.tool;
        el.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('is-on', x === b));
      }));
      el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.act;
        actions[a]();
        if (a !== 'clear') run();
      }));
      cv.addEventListener('pointerdown', e => { painting = true; cv.setPointerCapture(e.pointerId); paint(e); });
      cv.addEventListener('pointermove', e => { if (painting) paint(e); });
      const end = () => (painting = false);
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
    },
    enter() { if (!cur || Q.current() !== cur) reset(); else run(); },
    update() { if (Q.current() !== cur) reset(); else draw(); },
  });
})(globalThis.QRLab);
