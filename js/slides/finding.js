/* Slide 12 — binarization, the 1:1:3:1:1 finder signature, and orientation from three finders. */
(function (Q) {
  'use strict';
  const { R } = Q;
  const S = 400, HANDLE = '#f5c518';
  let cv, rot, light, binBox, thrSeg, runsEl, foundEl, sweepBtn, spinBtn;
  let cur = null, thr = 'adaptive', scene, sctx, binImg, gray, bin, dirty = true;
  let A = { x: 12, y: 120 }, B = { x: 388, y: 120 }, drag = null;
  let sweepY = -1, sweepHits = [], finders = null, spinning = false;

  scene = document.createElement('canvas'); scene.width = scene.height = S;
  sctx = scene.getContext('2d', { willReadFrequently: true });
  binImg = document.createElement('canvas'); binImg.width = binImg.height = S;

  const lp = R.loop(dt => {
    let more = false;
    if (spinning) { rot.value = (+rot.value + dt * 0.03) % 360; dirty = true; sweepHits = []; finders = null; more = true; }
    if (sweepY >= 0) {
      sweepRows(3);
      if (sweepY >= 0) more = true;
    }
    draw();
    return more;
  });

  function sweepRows(count) {
    for (let k = 0; k < count && sweepY < S; k++, sweepY += 2) {
      const row = [];
      for (let x = 0; x < S; x++) row.push(bin[sweepY * S + x]);
      detect(row).forEach(h => sweepHits.push({ x: h.t, y: sweepY }));
    }
    if (sweepY >= S) { sweepY = -1; finders = cluster(sweepHits); sweepBtn.disabled = false; }
  }

  function geometry() {
    const n = cur.size, tot = n + 8, side = 260, cell = side / tot, th = (+rot.value * Math.PI) / 180;
    return { n, side, cell, th };
  }
  function toScene(u, v) { // module-centre coords → scene px
    const { side, cell, th } = geometry();
    const lx = -side / 2 + (u + 4) * cell, ly = -side / 2 + (v + 4) * cell;
    return { x: S / 2 + lx * Math.cos(th) - ly * Math.sin(th), y: S / 2 + lx * Math.sin(th) + ly * Math.cos(th) };
  }

  function renderScene() {
    const { n, side, cell, th } = geometry();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    sctx.fillStyle = '#aeb5bf';
    sctx.fillRect(0, 0, S, S);
    sctx.save();
    sctx.translate(S / 2, S / 2);
    sctx.rotate(th);
    sctx.shadowColor = 'rgba(0,0,0,.35)'; sctx.shadowBlur = 14; sctx.shadowOffsetY = 4;
    sctx.fillStyle = '#f7f7f5';
    sctx.fillRect(-side / 2, -side / 2, side, side);
    sctx.shadowColor = 'transparent';
    sctx.fillStyle = '#15181e';
    const m = cur.matrix;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      if (m[y][x]) sctx.fillRect(-side / 2 + (x + 4) * cell, -side / 2 + (y + 4) * cell, cell + 0.5, cell + 0.5);
    sctx.restore();
    if (light.checked) {
      sctx.globalCompositeOperation = 'multiply';
      const g = sctx.createRadialGradient(95, 95, 10, 95, 95, 420);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#e2e2e2'); g.addColorStop(0.7, '#6e6e6e'); g.addColorStop(1, '#262626');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, S, S);
      sctx.globalCompositeOperation = 'source-over';
    }
    // grayscale + threshold
    const px = sctx.getImageData(0, 0, S, S).data;
    gray = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    bin = new Uint8Array(S * S);
    if (thr === 'global') for (let i = 0; i < S * S; i++) bin[i] = gray[i] < 128 ? 1 : 0;
    else {
      const W = S + 1, I = new Float64Array(W * W), h = 12;
      for (let y = 0; y < S; y++) { let rs = 0; for (let x = 0; x < S; x++) { rs += gray[y * S + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + rs; } }
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const x0 = Math.max(0, x - h), y0 = Math.max(0, y - h), x1 = Math.min(S, x + h + 1), y1 = Math.min(S, y + h + 1);
        const mean = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
        bin[y * S + x] = gray[y * S + x] < mean * 0.86 ? 1 : 0;
      }
    }
    const bctx = binImg.getContext('2d');
    const im = bctx.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const v = bin[i] ? 20 : 245; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    bctx.putImageData(im, 0, 0);
    dirty = false;
  }

  /* run-length scan of a 0/1 array; returns hits {t: centre index, runs:[i..i+4]} */
  function runsOf(arr) {
    const runs = [];
    for (let i = 0; i < arr.length; i++) {
      if (runs.length && runs[runs.length - 1].v === arr[i]) runs[runs.length - 1].len++;
      else runs.push({ v: arr[i], len: 1, start: i });
    }
    return runs;
  }
  function detect(arr, runsOut) {
    const runs = runsOf(arr), hits = [];
    for (let i = 0; i + 4 < runs.length; i++) {
      if (runs[i].v !== 1) continue;
      const c = [0, 1, 2, 3, 4].map(k => runs[i + k].len);
      const tot = c.reduce((a, b) => a + b, 0);
      if (tot < 14) continue;
      const m = tot / 7, mv = m / 2;
      if (Math.abs(m - c[0]) < mv && Math.abs(m - c[1]) < mv && Math.abs(3 * m - c[2]) < 3 * mv && Math.abs(m - c[3]) < mv && Math.abs(m - c[4]) < mv) {
        hits.push({ t: runs[i + 2].start + runs[i + 2].len / 2, i });
      }
    }
    if (runsOut) runsOut.push(...runs);
    return hits;
  }

  function cluster(pts) {
    const cl = [];
    for (const p of pts) {
      const c = cl.find(c => Math.hypot(c.x - p.x, c.y - p.y) < 14);
      if (c) { c.n++; c.sx += p.x; c.sy += p.y; c.x = c.sx / c.n; c.y = c.sy / c.n; }
      else cl.push({ x: p.x, y: p.y, sx: p.x, sy: p.y, n: 1 });
    }
    const top = cl.filter(c => c.n >= 3).sort((a, b) => b.n - a.n).slice(0, 3);
    if (top.length < 3) return { fail: true, count: top.length };
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const [p, q, r] = top;
    let tl, o1, o2;
    const dpq = d(p, q), dpr = d(p, r), dqr = d(q, r);
    if (dqr >= dpq && dqr >= dpr) { tl = p; o1 = q; o2 = r; }
    else if (dpr >= dpq) { tl = q; o1 = p; o2 = r; }
    else { tl = r; o1 = p; o2 = q; }
    const cross = (o1.x - tl.x) * (o2.y - tl.y) - (o1.y - tl.y) * (o2.x - tl.x);
    const [tr, bl] = cross > 0 ? [o1, o2] : [o2, o1];
    const ang = ((Math.atan2(tr.y - tl.y, tr.x - tl.x) * 180) / Math.PI + 360) % 360;
    return { tl, tr, bl, ang };
  }

  function sampleLine() {
    const L = Math.hypot(B.x - A.x, B.y - A.y), steps = Math.max(2, Math.ceil(L));
    const arr = [];
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(A.x + ((B.x - A.x) * t) / steps), y = Math.round(A.y + ((B.y - A.y) * t) / steps);
      arr.push(x >= 0 && y >= 0 && x < S && y < S ? bin[y * S + x] : 0);
    }
    return { arr, steps };
  }

  function draw() {
    if (dirty) renderScene();
    const { ctx, w } = R.fit(cv);
    const k = w / S;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(binBox.checked ? binImg : scene, 0, 0, w, w);
    const ok = R.css('--ok');

    // scan line + hits
    const { arr, steps } = sampleLine();
    const runs = [];
    const hits = detect(arr, runs);
    ctx.strokeStyle = HANDLE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(A.x * k, A.y * k); ctx.lineTo(B.x * k, B.y * k); ctx.stroke();
    const hitRuns = new Set();
    hits.forEach(h => {
      for (let j = 0; j < 5; j++) hitRuns.add(h.i + j);
      const x = A.x + ((B.x - A.x) * h.t) / steps, y = A.y + ((B.y - A.y) * h.t) / steps;
      ctx.strokeStyle = ok; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x * k, y * k, 9, 0, Math.PI * 2); ctx.stroke();
    });
    for (const p of [A, B]) {
      ctx.fillStyle = HANDLE; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x * k, p.y * k, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // sweep
    if (sweepY >= 0) {
      ctx.strokeStyle = R.alpha(ok, 0.9); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, sweepY * k); ctx.lineTo(w, sweepY * k); ctx.stroke();
    }
    ctx.fillStyle = ok;
    sweepHits.forEach(h => { ctx.beginPath(); ctx.arc(h.x * k, h.y * k, 2.2, 0, Math.PI * 2); ctx.fill(); });

    if (finders && !finders.fail) {
      const { tl, tr, bl } = finders;
      ctx.strokeStyle = ok; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(tr.x * k, tr.y * k); ctx.lineTo(tl.x * k, tl.y * k); ctx.lineTo(bl.x * k, bl.y * k); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `600 13px ${R.css('--f-mono')}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [[tl, 'top-left'], [tr, 'top-right'], [bl, 'bottom-left']].forEach(([p, t]) => {
        const tw = ctx.measureText(t).width + 10;
        ctx.fillStyle = ok; ctx.fillRect(p.x * k - tw / 2, p.y * k - 30, tw, 18);
        ctx.fillStyle = '#06140d'; ctx.fillText(t, p.x * k, p.y * k - 21);
      });
      // "up" arrow from the top edge midpoint
      const ux = tl.x - bl.x, uy = tl.y - bl.y, L = Math.hypot(ux, uy);
      const mx = (tl.x + tr.x) / 2, my = (tl.y + tr.y) / 2;
      const ex = mx + (ux / L) * 34, ey = my + (uy / L) * 34;
      ctx.strokeStyle = HANDLE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx * k, my * k); ctx.lineTo(ex * k, ey * k); ctx.stroke();
      ctx.fillStyle = HANDLE; ctx.beginPath(); ctx.arc(ex * k, ey * k, 4, 0, Math.PI * 2); ctx.fill();
    }

    // run strip
    const ink = R.css('--ink'), paper = R.css('--paper');
    runsEl.innerHTML = runs.map((r, i) => `<i style="flex:${r.len} 0 0;background:${hitRuns.has(i) ? (r.v ? ok : R.alpha(ok, 0.3)) : r.v ? ink : paper}"></i>`).join('');
    let msg = hits.length
      ? `<span class="k-ok">${hits.length} finder signature${hits.length > 1 ? 's' : ''} on this line</span>`
      : '<span class="caption">no 1:1:3:1:1 pattern on this line</span>';
    if (finders) {
      msg = finders.fail
        ? `<span class="k-err">sweep found ${finders.count} finder${finders.count === 1 ? '' : 's'}; need 3</span>`
        : `<span class="k-ok">3 finders · rotation ≈ ${Math.round(finders.ang)}° (true ${Math.round(+rot.value)}°)</span>`;
    }
    foundEl.innerHTML = msg;
  }

  function lineThroughFinder() {
    const p = toScene(3.5, 3.5);
    A = { x: 12, y: p.y }; B = { x: S - 12, y: p.y };
  }

  function changed() { dirty = true; sweepHits = []; finders = null; draw(); }

  Q.slide('finding', {
    init(el) {
      cv = el.querySelector('#find-cv'); rot = el.querySelector('#find-rot'); light = el.querySelector('#find-light');
      binBox = el.querySelector('#find-bin'); thrSeg = el.querySelector('#find-thr');
      runsEl = el.querySelector('#find-runs'); foundEl = el.querySelector('#find-found');
      sweepBtn = el.querySelector('#find-sweep'); spinBtn = el.querySelector('#find-spin');
      rot.addEventListener('input', changed);
      light.addEventListener('change', changed);
      binBox.addEventListener('change', draw);
      thrSeg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        thr = b.dataset.v;
        thrSeg.querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
        changed();
      });
      sweepBtn.addEventListener('click', () => {
        spinning = false; spinBtn.textContent = 'Spin'; sweepHits = []; finders = null; sweepY = 0; sweepBtn.disabled = true;
        if (dirty) renderScene();
        if (R.reduced()) { sweepRows(S); draw(); } else lp.start();
      });
      spinBtn.addEventListener('click', () => { spinning = !spinning; spinBtn.textContent = spinning ? 'Stop' : 'Spin'; if (spinning) lp.start(); });
      cv.addEventListener('pointerdown', e => {
        const p = R.pointer(cv, e), k = cv.clientWidth / S;
        const dA = Math.hypot(p.x - A.x * k, p.y - A.y * k), dB = Math.hypot(p.x - B.x * k, p.y - B.y * k);
        if (Math.min(dA, dB) > 28) return;
        drag = dA < dB ? A : B;
        cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', e => {
        if (!drag) return;
        const p = R.pointer(cv, e), k = cv.clientWidth / S;
        drag.x = Math.max(0, Math.min(S, p.x / k)); drag.y = Math.max(0, Math.min(S, p.y / k));
        if (!lp.running) draw();
      });
      const end = () => (drag = null);
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    },
    enter() { cur = Q.current(); dirty = true; renderScene(); lineThroughFinder(); sweepHits = []; finders = null; draw(); },
    leave() { lp.stop(); spinning = false; spinBtn.textContent = 'Spin'; sweepY = -1; sweepBtn.disabled = false; },
    update() { if (Q.current() !== cur) { cur = Q.current(); changed(); } else draw(); },
  });
})(globalThis.QRLab);
