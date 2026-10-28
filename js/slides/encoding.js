/* Slides 3 & 4 — text → bit stream → data codewords. */
(function (Q) {
  'use strict';
  const { R, QR } = Q;
  const SEG_COLOR = { mode: 'var(--accent)', count: 'var(--fn)', data: 'var(--data)', terminator: 'var(--muted)', fill: 'var(--muted)', pad: 'var(--fn)' };
  const MAX_GROUPS = 48;

  /* ---------- slide 3: bits ---------- */
  let rows, total, modes;
  function renderBits() {
    const c = Q.current();
    const [mode, count, data] = c.segments;
    const grp = (label, bits, color, i) => `<div class="bitgrp" style="--c:${color};--i:${i}"><span class="lab">${R.esc(label)}</span><span class="b">${bits}</span></div>`;
    const shown = data.groups.slice(0, MAX_GROUPS);
    rows.innerHTML =
      `<div class="seg-row"><div class="name">Mode indicator<small>4 bits</small></div><div class="bits">${grp(c.modeName, mode.bits, SEG_COLOR.mode, 0)}</div></div>` +
      `<div class="seg-row"><div class="name">Character count<small>${count.bits.length} bits at v${c.version}</small></div><div class="bits">${grp(count.label, count.bits, SEG_COLOR.count, 1)}</div></div>` +
      `<div class="seg-row"><div class="name">Data<small>${data.bits.length} bits</small></div><div class="bits">${shown.map((g, i) => grp(R.vis(g.label), g.bits, SEG_COLOR.data, i + 2)).join('')}${data.groups.length > MAX_GROUPS ? `<span class="caption">+ ${data.groups.length - MAX_GROUPS} more</span>` : ''}</div></div>`;
    const len = mode.bits.length + count.bits.length + data.bits.length;
    total.textContent = `${len} bits before padding`;

    const opts = ['numeric', 'alphanumeric', 'byte'].map(m => ({
      m, ok: QR.canUseMode(Q.state.text, m) && Q.state.text.length > 0,
      bits: QR.canUseMode(Q.state.text, m) ? QR.bitLength(Q.state.text, m, c.version) : 0,
    }));
    const max = Math.max(...opts.map(o => o.bits), 1);
    const why = { numeric: 'only digits 0–9', alphanumeric: 'only A–Z 0–9 space $%*+-./:' };
    modes.innerHTML = opts.map(o => `<div class="modebar ${o.ok ? (o.m === c.mode ? 'on' : '') : 'off'}">
        <span class="name">${QR.MODES[o.m].name}</span>
        <div class="bar"><i style="width:${o.ok ? (o.bits / max) * 100 : 0}%;background:${o.m === c.mode ? 'var(--accent)' : 'var(--muted)'}"></i></div>
        <span class="v">${o.ok ? o.bits + ' bits' : why[o.m]}</span></div>`).join('');
  }

  Q.slide('bits', {
    init(el) {
      rows = el.querySelector('#bits-rows');
      total = el.querySelector('#bits-total');
      modes = el.querySelector('#bits-modes');
      el.querySelectorAll('[data-try]').forEach(b => b.addEventListener('click', () => Q.setText(b.dataset.try)));
    },
    enter: renderBits,
    update: renderBits,
  });

  /* ---------- slide 4: codewords ---------- */
  let bar, cap, ribbon, grid, lastKey = '';
  function renderCodewords(force) {
    const c = Q.current();
    const key = c.bits + c.ecl;
    if (!force && key === lastKey) return;
    lastKey = key;
    const segs = c.segments;
    const header = segs[0].bits.length + segs[1].bits.length;
    const parts = [
      [header, 'var(--accent)', 'mode + count'],
      [segs[2].bits.length, 'var(--data)', 'data'],
      [segs[3].bits.length + segs[4].bits.length, 'var(--muted)', 'terminator + fill'],
      [segs[5].bits.length, 'var(--fn)', 'pad bytes'],
    ];
    bar.innerHTML = parts.map(([n, col, t]) => `<i title="${t}: ${n} bits" style="width:0;background:${col}" data-w="${(n / c.capacityBits) * 100}"></i>`).join('');
    requestAnimationFrame(() => bar.querySelectorAll('i').forEach(i => (i.style.width = i.dataset.w + '%')));
    cap.textContent = `${header + segs[2].bits.length} of ${c.capacityBits} bits carry your message (v${c.version}-${c.ecl})`;

    // per-bit colour → ribbon grouped in bytes
    const colors = [];
    segs.forEach(s => { for (let i = 0; i < s.bits.length; i++) colors.push(SEG_COLOR[s.type]); });
    let html = '';
    for (let i = 0; i < c.bits.length; i += 8) {
      let byte = '';
      for (let j = i; j < i + 8; j++) byte += `<span style="color:${colors[j]}">${c.bits[j]}</span>`;
      html += byte + ' ';
    }
    ribbon.innerHTML = html;

    grid.innerHTML = c.dataCodewords.map((v, i) => {
      const counts = {};
      for (let j = i * 8; j < i * 8 + 8; j++) counts[colors[j]] = (counts[colors[j]] || 0) + 1;
      const col = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      return `<div class="cw" style="--c:${col};--i:${i}" title="codeword ${i + 1}: 0x${R.hex(v)}"><b>${v}</b><small>${QR.bin(v, 8)}</small></div>`;
    }).join('');
  }

  Q.slide('codewords', {
    init(el) {
      bar = el.querySelector('#cw-bar');
      cap = el.querySelector('#cw-cap');
      ribbon = el.querySelector('#cw-ribbon');
      grid = el.querySelector('#cw-grid');
    },
    enter() { renderCodewords(true); },
    update() { renderCodewords(false); },
  });
})(globalThis.QRLab);
