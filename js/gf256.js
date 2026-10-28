/* GF(2^8) arithmetic — the finite field QR codes do their error-correction math in.
   Elements are bytes 0..255. Addition is XOR. Multiplication uses log/antilog tables
   built from the generator α = 2 and the primitive polynomial x^8+x^4+x^3+x^2+1 (0x11D). */
(function (Q) {
  'use strict';
  const PRIM = 0x11d;
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  const OVERFLOW = new Uint8Array(255); // 1 where computing α^i needed the XOR-with-0x11D step

  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) { x ^= PRIM; OVERFLOW[i + 1 < 255 ? i + 1 : 0] = 1; }
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

  function mul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }
  function div(a, b) {
    if (b === 0) throw new Error('division by zero in GF(256)');
    return a === 0 ? 0 : EXP[(LOG[a] + 255 - LOG[b]) % 255];
  }
  function pow(a, n) {
    if (a === 0) return n === 0 ? 1 : 0;
    return EXP[(((LOG[a] * n) % 255) + 255) % 255];
  }
  function inv(a) { return EXP[255 - LOG[a]]; }

  /* Polynomials are arrays of coefficients, highest degree first: [1, 3, 2] = x^2 + 3x + 2. */
  function polyMul(p, q) {
    const r = new Array(p.length + q.length - 1).fill(0);
    for (let i = 0; i < p.length; i++)
      for (let j = 0; j < q.length; j++) r[i + j] ^= mul(p[i], q[j]);
    return r;
  }
  function polyEval(p, xv) {
    let y = p[0];
    for (let i = 1; i < p.length; i++) y = mul(y, xv) ^ p[i];
    return y;
  }

  Q.GF = { PRIM, EXP, LOG, OVERFLOW, add: (a, b) => a ^ b, mul, div, pow, inv, polyMul, polyEval };
})(globalThis.QRLab = globalThis.QRLab || {});
