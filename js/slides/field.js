/* Slide 7 — GF(256): the cycle of α and a byte calculator. */
(function (Q) {
  'use strict';
  const { R, GF, QR } = Q;
  let cv, slider, playBtn, readout, stepEl, aIn, bIn, addOut, mulOut;
  let i = 0, acc = 0, playing = true;

  const lp = R.loop(dt => {
    if (!playing) return false;
    acc += dt;
    if (acc > 90) { acc = 0; i = (i + 1) % 255; slider.value = i; draw(); }
  });

  const sup = n => String(n).split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
  const pos = (v, cx, cy, r) => { const a = ((v - 1) / 255) * Math.PI * 2 - Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };

  function draw() {
    const { ctx, w } = R.fit(cv);
    ctx.clearRect(0, 0, w, w);
    const cx = w / 2, cy = w / 2, r = w * 0.42;
    const fg = R.css('--fg'), muted = R.css('--muted'), acc1 = R.css('--ec'), data = R.css('--data');
    // chords α^j → α^(j+1)
    ctx.lineWidth = 1;
    for (let j = 0; j < i; j++) {
      const [x1, y1] = pos(GF.EXP[j], cx, cy, r), [x2, y2] = pos(GF.EXP[j + 1], cx, cy, r);
      ctx.strokeStyle = R.alpha(data, 0.12 + 0.5 * Math.pow(j / Math.max(1, i), 6));
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // dots by value
    const visited = new Set();
    for (let j = 0; j <= i; j++) visited.add(GF.EXP[j]);
    for (let v = 1; v < 256; v++) {
      const [x, y] = pos(v, cx, cy, r);
      ctx.fillStyle = visited.has(v) ? data : R.alpha(muted, 0.35);
      ctx.beginPath(); ctx.arc(x, y, visited.has(v) ? 2.4 : 1.6, 0, Math.PI * 2); ctx.fill();
    }
    const v = GF.EXP[i];
    const [px, py] = pos(v, cx, cy, r);
    ctx.fillStyle = acc1;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
    // ticks for 1, 64, 128, 192
    ctx.fillStyle = muted;
    ctx.font = `11px ${R.css('--f-mono')}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [1, 64, 128, 192].forEach(t => { const [x, y] = pos(t, cx, cy, r + 16); ctx.fillText(t, x, y); });
    // centre readout
    ctx.fillStyle = fg;
    ctx.font = `700 ${Math.round(w * 0.075)}px ${R.css('--f-display')}`;
    ctx.fillText(`α${sup(i)} = ${v}`, cx, cy - w * 0.04);
    const bits = QR.bin(v, 8), bw = w * 0.04, bx = cx - bw * 4;
    for (let b = 0; b < 8; b++) {
      ctx.fillStyle = bits[b] === '1' ? fg : R.alpha(muted, 0.25);
      ctx.fillRect(bx + b * bw + 1, cy + w * 0.04, bw - 2, bw - 2);
    }
    ctx.fillStyle = muted;
    ctx.font = `11px ${R.css('--f-mono')}`;
    ctx.fillText(`${visited.size} of 255 non-zero bytes reached`, cx, cy + w * 0.13);

    readout.textContent = `α^${i} = ${v} = 0x${R.hex(v)}`;
    if (i === 0) stepEl.textContent = 'α⁰ = 1   (start here, then keep multiplying by α = 2)';
    else {
      const p = GF.EXP[i - 1], d = p * 2;
      stepEl.textContent = d < 256
        ? `α${sup(i)} = α${sup(i - 1)} × 2 = ${p} × 2 = ${d}\n${QR.bin(p, 8)} → shift left → ${QR.bin(d, 8)}`
        : `α${sup(i)} = ${p} × 2 = ${d}, which needs 9 bits, so XOR with 285:\n${d.toString(2)} ⊕ 100011101 = ${QR.bin(v, 8)} = ${v}`;
    }
  }

  function calc() {
    const clamp = el => { let v = Math.max(0, Math.min(255, parseInt(el.value, 10) || 0)); return v; };
    const a = clamp(aIn), b = clamp(bIn);
    const x = a ^ b;
    addOut.textContent =
`  a  ${QR.bin(a, 8)}  (${a})
⊕ b  ${QR.bin(b, 8)}  (${b})
  ─────────────
     ${QR.bin(x, 8)}  (${x})

ordinary a + b = ${a + b}${a + b > 255 ? '  ✗ overflows a byte' : ''}
and a ⊕ b ⊕ b = ${x ^ b} = a again`;
    if (a === 0 || b === 0) {
      mulOut.textContent = `a ⊗ b = 0\n(zero has no logarithm;\n anything times 0 is 0)\n\nordinary a × b = ${a * b}`;
      return;
    }
    const la = GF.LOG[a], lb = GF.LOG[b], s = (la + lb) % 255, m = GF.mul(a, b);
    mulOut.textContent =
`a = α^${la}    b = α^${lb}
a ⊗ b = α^(${la}+${lb} mod 255)
      = α^${s} = ${m}
a ÷ b = α^${(la - lb + 255) % 255} = ${GF.div(a, b)}

ordinary a × b = ${a * b}${a * b > 255 ? '  ✗ overflows' : ''}`;
  }

  Q.slide('field', {
    init(el) {
      cv = el.querySelector('#gf-ring');
      slider = el.querySelector('#gf-i');
      playBtn = el.querySelector('#gf-play');
      readout = el.querySelector('#gf-readout');
      stepEl = el.querySelector('#gf-step');
      aIn = el.querySelector('#gf-a'); bIn = el.querySelector('#gf-b');
      addOut = el.querySelector('#gf-add'); mulOut = el.querySelector('#gf-mul');
      slider.addEventListener('input', () => { i = +slider.value; playing = false; playBtn.textContent = 'Play'; draw(); });
      playBtn.addEventListener('click', () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; if (playing) lp.start(); });
      [aIn, bIn].forEach(n => n.addEventListener('input', calc));
    },
    enter() {
      if (R.reduced()) { playing = false; i = 254; slider.value = i; playBtn.textContent = 'Play'; }
      draw(); calc();
      if (playing) lp.start();
    },
    leave() { lp.stop(); },
    update: draw,
  });
})(globalThis.QRLab);
