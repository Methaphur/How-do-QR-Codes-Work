/* Slide 13 — perspective correction with a homography from 4 reference points. */
(function (Q) {
  'use strict';
  const { R, QR } = Q;
  const HANDLE = '#f5c518';
  let cam, flat, gridBox, hEl, readEl;
  let cur = null, n = 0, U = [], refs = [], H = null, drag = -1, anim = null, sampled = null;

  const lp = R.loop((dt, t) => {
    if (!anim) return false;
    const p = R.reduced() ? 1 : R.ease.inOut(Math.min(1, (t - anim.t0) / 750));
    refs = anim.from.map((a, i) => ({ x: a.x + (anim.to[i].x - a.x) * p, y: a.y + (anim.to[i].y - a.y) * p }));
    draw();
    if (p >= 1) { anim = null; return false; }
  });

  /* 3-D pose of the paper → normalised positions of the 4 reference points */
  function pose(rx, ry, rz, D) {
    const tot = n + 8;
    return U.map(([u, v]) => {
      let X = (u - n / 2) / tot, Y = (v - n / 2) / tot, Z = 0;
      [X, Y] = [X * Math.cos(rz) - Y * Math.sin(rz), X * Math.sin(rz) + Y * Math.cos(rz)];
      [Y, Z] = [Y * Math.cos(rx) - Z * Math.sin(rx), Y * Math.sin(rx) + Z * Math.cos(rx)];
      [X, Z] = [X * Math.cos(ry) + Z * Math.sin(ry), -X * Math.sin(ry) + Z * Math.cos(ry)];
      Z += D;
      const f = D * 0.92;
      return { x: 0.5 + (f * X) / Z, y: 0.5 + (f * Y) / Z };
    });
  }

  function solve(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [u, v] = src[i], { x, y } = dst[i];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
    }
    for (let c = 0; c < 8; c++) {
      let p = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      if (Math.abs(A[p][c]) < 1e-12) return null;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    return b.map((v, i) => v / A[i][i]).concat([1]);
  }
  const apply = (h, u, v) => { const w = h[6] * u + h[7] * v + 1; return { x: (h[0] * u + h[1] * v + h[2]) / w, y: (h[3] * u + h[4] * v + h[5]) / w, w }; };

  function draw() {
    const { ctx, w, dpr } = R.fit(cam);
    const dst = refs.map(p => ({ x: p.x * w, y: p.y * w }));
    H = solve(U, dst);
    const bg = ctx.createLinearGradient(0, 0, w, w);
    bg.addColorStop(0, '#59616e'); bg.addColorStop(1, '#2f353f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, w);
    const corners = H && [[-4, -4], [n + 4, -4], [n + 4, n + 4], [-4, n + 4]].map(([u, v]) => apply(H, u, v));
    if (!H || corners.some(c => c.w <= 0.05)) {
      readEl.innerHTML = '<span class="k-err">those points can’t come from a flat square, so move them apart</span>';
      sampled = null;
      drawFlat();
      drawHandles(ctx, dst);
      return;
    }
    // paper
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#f6f7f9';
    ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); ctx.fill();
    ctx.restore();
    // modules as projected quads
    const G = [];
    for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) G.push(apply(H, x, y));
    const at = (x, y) => G[y * (n + 1) + x];
    ctx.fillStyle = '#14171d';
    ctx.beginPath();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!cur.matrix[y][x]) continue;
      const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = '#14171d'; ctx.lineWidth = 0.35; ctx.stroke();

    // sample the rendered pixels at every module centre
    const img = ctx.getImageData(0, 0, cam.width, cam.height).data;
    sampled = [];
    const centres = [];
    for (let y = 0; y < n; y++) {
      const row = [];
      for (let x = 0; x < n; x++) {
        const p = apply(H, x + 0.5, y + 0.5);
        centres.push(p);
        const px = Math.round(p.x * dpr), py = Math.round(p.y * dpr);
        let g = 255;
        if (px >= 0 && py >= 0 && px < cam.width && py < cam.height) { const i = (py * cam.width + px) * 4; g = (img[i] + img[i + 1] + img[i + 2]) / 3; }
        row.push(g < 128 ? 1 : 0);
      }
      sampled.push(row);
    }

    if (gridBox.checked) {
      ctx.strokeStyle = 'rgba(80,150,255,.55)'; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        let a = at(i, 0), b = at(i, n); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        a = at(0, i); b = at(n, i); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      centres.forEach((p, i) => {
        const x = i % n, y = Math.floor(i / n);
        ctx.fillStyle = sampled[y][x] === cur.matrix[y][x] ? '#3fcb8c' : '#ff4d4d';
        ctx.fillRect(p.x - 1.1, p.y - 1.1, 2.2, 2.2);
      });
    }
    drawHandles(ctx, dst);
    drawFlat();

    hEl.innerHTML = H.map(v => `<span>${Math.abs(v) < 5e-5 ? '0' : v.toFixed(Math.abs(v) < 1 ? 4 : 2)}</span>`).join('');
    const bad = sampled.reduce((s, row, y) => s + row.reduce((t, v, x) => t + (v !== cur.matrix[y][x] ? 1 : 0), 0), 0);
    const rd = QR.read(sampled);
    readEl.innerHTML = rd.ok
      ? `<span class="k-ok">✓ reads “${R.esc(rd.text)}”</span>${bad ? ` <span class="caption">(${bad} modules mis-sampled, then fixed by RS)</span>` : ''}`
      : `<span class="k-err">✗ ${bad} modules mis-sampled, too many to decode</span>`;
  }

  function drawHandles(ctx, dst) {
    const labels = ['finder', 'finder', 'finder', 'alignment'];
    ctx.font = `600 11px ${R.css('--f-mono')}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    dst.forEach((p, i) => {
      ctx.strokeStyle = HANDLE; ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(245,197,24,.25)';
      ctx.beginPath(); ctx.arc(p.x, p.y, i === 3 ? 9 : 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y); ctx.lineTo(p.x + 5, p.y); ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x, p.y + 5); ctx.stroke();
      const tw = ctx.measureText(labels[i]).width + 8;
      ctx.fillStyle = HANDLE; ctx.fillRect(p.x - tw / 2, p.y + 15, tw, 15);
      ctx.fillStyle = '#1b1b1b'; ctx.fillText(labels[i], p.x, p.y + 23);
    });
  }

  function drawFlat() {
    const { ctx, w } = R.fit(flat);
    const g = R.geo(n, w, 2);
    if (!sampled) { ctx.fillStyle = R.css('--paper'); ctx.fillRect(0, 0, w, w); return; }
    const ink = R.css('--ink');
    R.drawMatrix(ctx, sampled, g, { color: (x, y, v) => (v !== cur.matrix[y][x] ? '#e5484d' : v ? ink : null) });
  }

  function animateTo(target) { anim = { from: refs.map(p => ({ ...p })), to: target, t0: performance.now() }; lp.stop(); lp.start(); }
  const deg = d => (d * Math.PI) / 180;
  function randomTilt() {
    const s = () => (Math.random() < 0.5 ? -1 : 1);
    animateTo(pose(deg(s() * (18 + Math.random() * 30)), deg(s() * (18 + Math.random() * 30)), deg((Math.random() - 0.5) * 120), 2 + Math.random() * 0.6));
  }

  function setup() {
    cur = Q.encodeWith({ minVersion: 2 });
    if (cur.error) cur = Q.QR.encode('QR', { minVersion: 2 });
    n = cur.size;
    U = [[3.5, 3.5], [n - 3.5, 3.5], [3.5, n - 3.5], [n - 6.5, n - 6.5]];
    const tilted = pose(deg(-32), deg(26), deg(-14), 2.2);
    refs = R.reduced() ? tilted : pose(0, 0, 0, 2.3);
    draw();
    if (!R.reduced()) setTimeout(() => animateTo(tilted), 250);
  }

  Q.slide('perspective', {
    init(el) {
      cam = el.querySelector('#persp-cam'); flat = el.querySelector('#persp-flat');
      gridBox = el.querySelector('#persp-grid'); hEl = el.querySelector('#persp-h'); readEl = el.querySelector('#persp-read');
      gridBox.addEventListener('change', draw);
      el.querySelector('#persp-tilt').addEventListener('click', randomTilt);
      el.querySelector('#persp-reset').addEventListener('click', () => animateTo(pose(0, 0, 0, 2.3)));
      cam.addEventListener('pointerdown', e => {
        const p = R.pointer(cam, e), w = cam.clientWidth;
        let best = -1, bd = 30;
        refs.forEach((r, i) => { const d = Math.hypot(r.x * w - p.x, r.y * w - p.y); if (d < bd) { bd = d; best = i; } });
        if (best < 0) return;
        drag = best; anim = null; lp.stop();
        cam.setPointerCapture(e.pointerId);
      });
      cam.addEventListener('pointermove', e => {
        if (drag < 0) return;
        const p = R.pointer(cam, e), w = cam.clientWidth;
        refs[drag] = { x: Math.max(0.02, Math.min(0.98, p.x / w)), y: Math.max(0.02, Math.min(0.98, p.y / w)) };
        draw();
      });
      const end = () => (drag = -1);
      cam.addEventListener('pointerup', end); cam.addEventListener('pointercancel', end);
    },
    enter: setup,
    leave() { lp.stop(); anim = null; },
    update() { const c = Q.encodeWith({ minVersion: 2 }); if (!c.error && c.matrix.join() !== cur.matrix.join()) setup(); else draw(); },
  });
})(globalThis.QRLab);
