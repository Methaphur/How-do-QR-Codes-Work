/* Slide 2 — every structural region of a version-7 symbol, explorable by hover. */
(function (Q) {
  'use strict';
  const { R } = Q;
  // Fixed hues: the symbol always sits on light paper, so these only need to read on white.
  const REGIONS = [
    ['finder', 'Finder patterns', '#6d4fe0', 'Three bullseyes in the corners. Their 1:1:3:1:1 stripe ratio is what a scanner hunts for first.'],
    ['separator', 'Separators', '#9aa3b2', 'A one-module white border so the finders never touch the data next to them.'],
    ['timing', 'Timing patterns', '#0e9f9a', 'Alternating stripes between the finders. They work like a ruler, giving the scanner the module size and count.'],
    ['alignment', 'Alignment patterns', '#d23f97', 'Smaller bullseyes (version 2 and up) used to correct perspective and curved paper.'],
    ['format', 'Format information', '#e4570c', '15 bits, stored twice: the error-correction level and which mask was applied.'],
    ['version', 'Version information', '#8f6a00', '18 bits, stored twice (version 7 and up): which grid size this is.'],
    ['dark', 'Dark module', '#111620', 'One module beside the bottom-left finder that is always dark.'],
    ['data', 'Data codewords', '#2a68d8', 'Your message, packed into bytes and laid out in a zig-zag.'],
    ['ec', 'Error-correction codewords', '#d08700', 'Reed–Solomon check bytes computed from the data. They let the code survive damage.'],
    ['remainder', 'Remainder bits', '#7b8496', 'A few leftover modules that do not fit a whole byte.'],
    ['quiet', 'Quiet zone', '#3fae7c', 'A blank margin, at least 4 modules wide, that separates the code from its surroundings.'],
  ];
  let cv, legend, desc, cap, active = null, sample = null, geo = null;

  function draw() {
    const { ctx, w } = R.fit(cv);
    const c = sample;
    geo = R.geo(c.size, w, 4);
    const ink = R.css('--ink');
    ctx.fillStyle = R.css('--paper');
    ctx.fillRect(0, 0, w, w);
    const col = Object.fromEntries(REGIONS.map(r => [r[0], r[2]]));
    if (active === 'quiet') {
      ctx.fillStyle = R.alpha(col.quiet, 0.25);
      ctx.fillRect(0, 0, w, w);
      ctx.fillStyle = R.css('--paper');
      ctx.fillRect(geo.ox, geo.oy, c.size * geo.cell, c.size * geo.cell);
    }
    R.drawMatrix(ctx, c.matrix, geo, {
      paper: false,
      color(x, y, v) {
        const r = c.region[y][x];
        const mine = !active || active === r;
        if (!mine) return v ? R.alpha(ink, 0.13) : null;
        if (!active) return v ? col[r] : R.alpha(col[r], 0.12);
        return v ? col[r] : R.alpha(col[r], 0.22);
      },
    });
  }

  function setActive(id) {
    active = id;
    legend.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b.dataset.r === id));
    const r = REGIONS.find(x => x[0] === id);
    desc.innerHTML = r ? `<b style="color:var(--fg)">${r[1]}.</b> ${r[3]}` : 'Sizes run from version 1 (21×21) to version 40 (177×177), adding 4 modules per side at each step.';
    draw();
  }

  function rebuild() {
    sample = Q.encodeWith({ minVersion: 7 });
    if (sample.error) sample = Q.QR.encode('QR', { ecl: Q.state.ecl, minVersion: 7 });
    const counts = {};
    sample.region.forEach(row => row.forEach(r => (counts[r] = (counts[r] || 0) + 1)));
    const n = sample.size;
    counts.quiet = (n + 8) * (n + 8) - n * n;
    legend.innerHTML = REGIONS.map(([id, name, color]) =>
      `<button type="button" class="btn" data-r="${id}" style="justify-content:flex-start"><i style="width:11px;height:11px;border-radius:2px;background:${color}"></i>${name}<span style="margin-left:auto;font-family:var(--f-mono);color:var(--muted);font-size:.72rem">${counts[id] || 0}</span></button>`
    ).join('');
    cap.textContent = `Shown at version ${sample.version} (${n}×${n} modules) so that every part appears. It still encodes your message, “${Q.state.text}”.`;
    setActive(active);
  }

  Q.slide('anatomy', {
    init(el) {
      cv = el.querySelector('#anat-qr');
      legend = el.querySelector('#anat-legend');
      desc = el.querySelector('#anat-desc');
      cap = el.querySelector('#anat-cap');
      legend.addEventListener('pointerover', e => { const b = e.target.closest('button'); if (b) setActive(b.dataset.r); });
      legend.addEventListener('focusin', e => { const b = e.target.closest('button'); if (b) setActive(b.dataset.r); });
      legend.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setActive(b.dataset.r); });
      legend.addEventListener('pointerleave', () => setActive(null));
      cv.addEventListener('pointermove', e => {
        if (!geo) return;
        const p = R.pointer(cv, e), h = R.hit(geo, p.x, p.y);
        const id = h ? sample.region[h.y][h.x] : (p.x >= 0 && p.y >= 0 && p.x <= geo.w && p.y <= geo.w ? 'quiet' : null);
        if (id !== active) setActive(id);
      });
      cv.addEventListener('pointerleave', () => setActive(null));
    },
    enter: rebuild,
    update: rebuild,
  });
})(globalThis.QRLab);
