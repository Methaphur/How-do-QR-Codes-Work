/* Slide 8 — Reed–Solomon long division, step by step, on your own codewords. */
(function (Q) {
  'use strict';
  const { R, RS, GF, QR } = Q;
  let el, tape, gen, div, out, prog, levels, ver, inter, interCap, playBtn;
  let cur = null, trace = null, s = 0, playing = false, acc = 0;

  const lp = R.loop(dt => {
    if (!playing) return false;
    acc += dt;
    if (acc > 650) { acc = 0; step(1); }
    if (s >= trace.steps.length) { playing = false; playBtn.textContent = 'Play'; return false; }
  });

  const powHtml = c => (c === 0 ? '0' : `α<sup>${GF.LOG[c]}</sup>`);

  function setup() {
    cur = Q.current();
    const b = cur.blocks[0];
    trace = RS.encode(b.data, cur.info.ec, true);
    s = 0;
    gen.innerHTML = trace.generator.map(c => `<span style="background:color-mix(in srgb,var(--fn) 18%,transparent)">${powHtml(c)}</span>`).join('');
    renderLevels();
    renderInterleave();
    render();
  }

  function renderLevels() {
    ver.textContent = cur.version;
    const rows = QR.ECL_NAMES.map(e => {
      const inf = QR.blockInfo(cur.version, e);
      const ec = inf.totalCodewords - inf.dataCodewords;
      return { e, data: inf.dataCodewords, ec, fix: Math.floor(inf.ec / 2) * inf.blocks.length, total: inf.totalCodewords };
    });
    levels.innerHTML = rows.map(r => `<div class="modebar ${r.e === cur.ecl ? 'on' : ''}">
      <span class="name">Level ${r.e}</span>
      <div class="bar"><i style="width:${(r.data / r.total) * 100}%;background:var(--data)"></i><i style="width:${(r.ec / r.total) * 100}%;background:var(--ec)"></i></div>
      <span class="v" title="data + EC codewords">${r.data}+${r.ec} · fix ${r.fix}</span></div>`).join('') +
      `<p class="caption" style="margin-top:.2rem"><span class="k-data">data</span> + <span class="k-ec">EC</span> codewords. "Fix" is how many damaged bytes (anywhere, unknown position) the code can repair.</p>`;
  }

  function renderInterleave() {
    const colors = ['var(--data)', 'var(--ec)', 'var(--fn)', 'var(--ok)', 'var(--err)', 'var(--accent)', 'var(--muted)', 'var(--data-2)'];
    inter.innerHTML = cur.origin.map(o => `<span style="background:color-mix(in srgb,${colors[o.block % colors.length]} ${o.ec ? 45 : 22}%,transparent)" title="block ${o.block + 1}, byte ${o.index + 1}${o.ec ? ' (EC)' : ''}">${o.block + 1}·${o.index + 1}</span>`).join('');
    interCap.textContent = cur.blocks.length > 1
      ? `Your code has ${cur.blocks.length} blocks. Each cell is block·byte in final order; darker cells are EC bytes.`
      : 'Your code currently has a single block. Try level Q or H, or a longer message, to see interleaving.';
  }

  function render() {
    const n = cur.info.ec, data = cur.blocks[0].data, st = trace.steps;
    prog.textContent = `step ${Math.min(s, st.length)} / ${st.length}`;
    tape.innerHTML = data.map((v, i) => `<span class="${i < s ? 'used' : i === s ? 'cur' : ''}">${v}</span>`).join('') +
      new Array(n).fill(0).map(() => '<span class="ecz">0</span>').join('');
    div.style.setProperty('--n', n + 1);
    if (s < st.length) {
      const t = st[s];
      const row = (label, arr, cls, fn) => `<div class="r ${cls}"><span>${label}</span>${arr.map((v, j) => `<span class="${fn ? fn(v, j) : ''}">${v}</span>`).join('')}</div>`;
      div.innerHTML =
        row('working', t.before, '', (v, j) => (j === 0 ? 'lead' : '')) +
        row(`g(x) × ${t.lead}${t.lead ? ` (α${'<sup>' + GF.LOG[t.lead] + '</sup>'})` : ''}`, t.scaled, 'gen') +
        row('XOR →', t.after, 'res flash', (v, j) => (j === 0 ? 'zero' : '')) +
        `<p class="caption" style="margin-top:.3rem">Lead byte ${t.lead}: multiply every coefficient of g(x) by ${t.lead} in GF(256), then XOR. The lead cancels to 0, the window slides one place right, and the next data byte comes in.</p>`;
    } else {
      div.innerHTML = `<p class="caption">All ${st.length} data bytes have been divided out. What is left in the window is the remainder.</p>`;
    }
    const done = s >= st.length;
    const ec = cur.blocks[0].ec;
    out.innerHTML = ec.map(v => `<span style="background:color-mix(in srgb,var(--ec) ${done ? 30 : 8}%,transparent)">${done ? v : '?'}</span>`).join('') +
      (done ? `<span style="background:transparent;color:var(--ok);min-width:auto;padding-inline:.5rem">✓ ${n} EC codewords</span>` : '');
  }

  function step(d) { s = Math.max(0, Math.min(trace.steps.length, s + d)); render(); }

  Q.slide('reed-solomon', {
    init(e) {
      el = e;
      tape = el.querySelector('#rs-tape'); gen = el.querySelector('#rs-gen'); div = el.querySelector('#rs-div');
      out = el.querySelector('#rs-out'); prog = el.querySelector('#rs-prog'); levels = el.querySelector('#rs-levels');
      ver = el.querySelector('#rs-ver'); inter = el.querySelector('#rs-inter'); interCap = el.querySelector('#rs-inter-cap');
      playBtn = el.querySelector('#rs-play');
      playBtn.addEventListener('click', () => {
        if (s >= trace.steps.length) s = 0;
        playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play';
        if (playing) { acc = 0; render(); lp.start(); }
      });
      el.querySelector('#rs-step').addEventListener('click', () => { playing = false; playBtn.textContent = 'Play'; step(1); });
      el.querySelector('#rs-reset').addEventListener('click', () => { playing = false; playBtn.textContent = 'Play'; s = 0; render(); });
      el.querySelector('#rs-end').addEventListener('click', () => { playing = false; playBtn.textContent = 'Play'; s = trace.steps.length; render(); });
    },
    enter() { setup(); },
    leave() { lp.stop(); playing = false; playBtn.textContent = 'Play'; },
    update() { if (Q.current() !== cur) setup(); },
  });
})(globalThis.QRLab);
