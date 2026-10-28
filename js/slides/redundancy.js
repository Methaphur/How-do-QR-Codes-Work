/* Slide 6 — repetition, parity and Hamming(7,4): three ways to add redundancy. */
(function (Q) {
  'use strict';
  let msgEl, codesEl;
  let msg = [1, 0, 1, 1];
  const flips = { rep: new Set(), par: new Set(), ham: new Set() };

  const CODES = {
    rep: {
      name: 'Repetition ×3', cost: '+8 bits · 200% extra',
      encode: m => m.flatMap(b => [b, b, b]),
      parity: i => false,
      gap: i => i > 0 && i % 3 === 0,
      decode(r) {
        const out = [];
        for (let i = 0; i < r.length; i += 3) out.push(r[i] + r[i + 1] + r[i + 2] >= 2 ? 1 : 0);
        return { out, fixed: [] };
      },
      explain: (r, d, nflips) => `majority vote of each triple → ${d.out.join('')}`,
    },
    par: {
      name: 'Parity bit', cost: '+1 bit · 25% extra',
      encode: m => m.concat([m.reduce((a, b) => a ^ b, 0)]),
      parity: i => i === 4,
      gap: i => i === 4,
      decode(r) {
        const ok = r.reduce((a, b) => a ^ b, 0) === 0;
        return { out: r.slice(0, 4), fixed: [], detectOnly: true, ok };
      },
      explain: (r, d) => (d.ok ? 'parity checks out' : 'parity fails: some bit is wrong, but which one?'),
    },
    ham: {
      name: 'Hamming(7,4)', cost: '+3 bits · 75% extra',
      // positions 1..7 = p1 p2 d1 p3 d2 d3 d4
      encode: ([d1, d2, d3, d4]) => [d1 ^ d2 ^ d4, d1 ^ d3 ^ d4, d1, d2 ^ d3 ^ d4, d2, d3, d4],
      parity: i => i === 0 || i === 1 || i === 3,
      gap: () => false,
      decode(r) {
        const s1 = r[0] ^ r[2] ^ r[4] ^ r[6], s2 = r[1] ^ r[2] ^ r[5] ^ r[6], s3 = r[3] ^ r[4] ^ r[5] ^ r[6];
        const s = s1 + 2 * s2 + 4 * s3;
        const c = r.slice();
        if (s) c[s - 1] ^= 1;
        return { out: [c[2], c[4], c[5], c[6]], fixed: s ? [s - 1] : [], syndrome: '' + s3 + s2 + s1, s };
      },
      explain: (r, d) => (d.s ? `syndrome ${d.syndrome}₂ = ${d.s} → flip position ${d.s}` : 'syndrome 000 → no error'),
    },
  };

  function render() {
    msgEl.innerHTML = msg.map((b, i) => `<button type="button" class="cell" data-i="${i}" aria-label="message bit ${i + 1}">${b}</button>`).join('');
    codesEl.innerHTML = Object.entries(CODES).map(([id, C]) => {
      const sent = C.encode(msg);
      const recv = sent.map((b, i) => (flips[id].has(i) ? b ^ 1 : b));
      const d = C.decode(recv);
      const nflips = flips[id].size;
      const right = d.out.join('') === msg.join('');
      let verdict, cls;
      if (d.detectOnly) {
        if (nflips === 0) { verdict = '✓ no errors'; cls = 'k-ok'; }
        else if (!d.ok) { verdict = '⚠ error detected, cannot fix it'; cls = 'k-ec'; }
        else { verdict = '✗ parity looks fine, but the message is wrong'; cls = 'k-err'; }
      } else if (right) { verdict = nflips ? '✓ corrected → ' + d.out.join('') : '✓ no errors'; cls = 'k-ok'; }
      else { verdict = '✗ decoded ' + d.out.join('') + ', which is wrong'; cls = 'k-err'; }
      const cells = (arr, clickable) => arr.map((b, i) => {
        const c = ['cell'];
        if (C.parity(i)) c.push('par');
        if (C.gap(i)) c.push('gap');
        if (clickable && flips[id].has(i)) c.push('flipped');
        if (clickable && d.fixed.includes(i)) c.push('fixed');
        if (!clickable) c.push('static');
        return clickable
          ? `<button type="button" class="${c.join(' ')}" data-code="${id}" data-i="${i}" aria-label="received bit ${i + 1}">${b}</button>`
          : `<span class="${c.join(' ')}">${b}</span>`;
      }).join('');
      return `<div class="code-row">
          <div><b>${C.name}</b><div class="caption">${C.cost}</div></div>
          <div style="display:flex;flex-direction:column;gap:.35rem;min-width:0">
            <div class="row" style="gap:.5rem"><span class="caption" style="width:4.2rem">sent</span><div class="cells">${cells(sent, false)}</div></div>
            <div class="row" style="gap:.5rem"><span class="caption" style="width:4.2rem">received</span><div class="cells">${cells(recv, true)}</div></div>
            <div class="verdict"><span class="caption">${C.explain(recv, d, nflips)}</span> · <span class="${cls}">${verdict}</span></div>
          </div></div>`;
    }).join('');
  }

  Q.slide('redundancy', {
    init(el) {
      msgEl = el.querySelector('#red-msg');
      codesEl = el.querySelector('#red-codes');
      msgEl.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { msg[+b.dataset.i] ^= 1; render(); } });
      codesEl.addEventListener('click', e => {
        const b = e.target.closest('[data-code]');
        if (!b) return;
        const s = flips[b.dataset.code], i = +b.dataset.i;
        s.has(i) ? s.delete(i) : s.add(i);
        render();
      });
      el.querySelector('#red-reset').addEventListener('click', () => { Object.values(flips).forEach(s => s.clear()); render(); });
      el.querySelector('#red-rand').addEventListener('click', () => {
        Object.entries(CODES).forEach(([id, C]) => { flips[id].clear(); flips[id].add(Math.floor(Math.random() * C.encode(msg).length)); });
        render();
      });
      flips.rep.add(4); flips.ham.add(5); flips.par.add(1);
    },
    enter: render,
  });
})(globalThis.QRLab);
