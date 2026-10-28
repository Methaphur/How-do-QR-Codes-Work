/* Slide 14 — the whole pipeline as clickable stages. */
(function (Q) {
  'use strict';
  const ENC = [
    ['Text → bits', 'bits', 'c-data'], ['Pad to codewords', 'codewords', 'c-data'], ['Reed–Solomon check bytes', 'reed-solomon', 'c-ec'],
    ['Interleave blocks', 'reed-solomon', 'c-ec'], ['Zig-zag placement', 'placement', 'c-data'], ['Mask + penalty', 'masking', 'c-fn'],
    ['Format info (BCH)', 'format', 'c-fn'], ['Print', 'intro', ''],
  ];
  const DEC = [
    ['Camera frame', 'finding', 'c-scan'], ['Binarize', 'finding', 'c-scan'], ['Find 1:1:3:1:1', 'finding', 'c-scan'],
    ['Homography', 'perspective', 'c-scan'], ['Sample modules', 'perspective', 'c-scan'], ['Read format', 'format', 'c-fn'],
    ['Unmask', 'masking', 'c-fn'], ['Syndromes → BM → Chien → Forney', 'repair', 'c-ec'], ['Bits → text', 'bits', 'c-data'],
  ];
  function lane(el, items, offset) {
    const label = el.querySelector('.lane').outerHTML;
    el.innerHTML = label + items.map(([t, id, c], i) =>
      (i ? '<span class="arrow" aria-hidden="true">→</span>' : '') +
      `<a class="chip ${c}" href="#${id}" style="--i:${i + offset}">${t}</a>`).join('');
    el.querySelectorAll('a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); Q.go(a.getAttribute('href').slice(1)); }));
  }
  Q.slide('pipeline', {
    init(el) { lane(el.querySelector('#pipe-enc'), ENC, 0); lane(el.querySelector('#pipe-dec'), DEC, ENC.length); },
  });
})(globalThis.QRLab);
