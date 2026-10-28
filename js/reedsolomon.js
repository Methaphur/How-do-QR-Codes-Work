/* Reed–Solomon over GF(256), as used by QR codes.
   Encoding: EC codewords = remainder of (message · x^n) ÷ g(x), where g(x) = ∏ (x − α^i), i = 0..n−1.
   Decoding: syndromes → Berlekamp–Massey (error locator) → Chien search (positions) → Forney (values). */
(function (Q) {
  'use strict';
  const GF = Q.GF;
  const genCache = {};

  function generator(n) {
    if (genCache[n]) return genCache[n];
    let g = [1];
    for (let i = 0; i < n; i++) g = GF.polyMul(g, [1, GF.EXP[i]]);
    return (genCache[n] = g);
  }

  /* Returns the EC codewords. With trace=true, also returns every step of the long division. */
  function encode(data, n, trace) {
    const g = generator(n);
    const reg = data.concat(new Array(n).fill(0));
    const steps = [];
    for (let i = 0; i < data.length; i++) {
      const lead = reg[i];
      const before = trace ? reg.slice(i, i + n + 1) : null;
      const scaled = g.map(c => GF.mul(c, lead));
      if (lead !== 0) for (let j = 0; j < g.length; j++) reg[i + j] ^= scaled[j];
      if (trace) steps.push({ i, lead, before, scaled, after: reg.slice(i, i + n + 1) });
    }
    const ec = reg.slice(data.length);
    return trace ? { ec, steps, generator: g } : ec;
  }

  function syndromes(cw, n) {
    const s = new Array(n);
    for (let j = 0; j < n; j++) s[j] = GF.polyEval(cw, GF.EXP[j]);
    return s;
  }

  /* Berlekamp–Massey. Returns Λ(x) lowest-degree-first: [1, Λ1, Λ2, ...]. */
  function berlekampMassey(S) {
    let C = [1], B = [1], L = 0, m = 1, b = 1;
    for (let n = 0; n < S.length; n++) {
      let d = S[n];
      for (let i = 1; i <= L; i++) d ^= GF.mul(C[i] || 0, S[n - i]);
      if (d === 0) { m++; continue; }
      const coef = GF.div(d, b);
      const T = C.slice();
      const need = B.length + m;
      while (C.length < need) C.push(0);
      for (let i = 0; i < B.length; i++) C[i + m] ^= GF.mul(coef, B[i]);
      if (2 * L <= n) { L = n + 1 - L; B = T; b = d; m = 1; } else m++;
    }
    while (C.length > 1 && C[C.length - 1] === 0) C.pop();
    return { locator: C, L };
  }

  function evalLow(p, xv) { // p lowest-degree-first
    let y = 0;
    for (let i = p.length - 1; i >= 0; i--) y = GF.mul(y, xv) ^ p[i];
    return y;
  }

  /* Decode one block. cw = data+EC codewords, n = number of EC codewords. */
  function decode(cw, n) {
    const N = cw.length;
    const S = syndromes(cw, n);
    const res = { syndromes: S, locator: [1], positions: [], magnitudes: [], corrected: cw.slice(), ok: true, errors: 0 };
    if (S.every(v => v === 0)) return res;

    const { locator, L } = berlekampMassey(S);
    res.locator = locator;
    if (2 * L > n) { res.ok = false; res.reason = 'more errors than the EC codewords can fix'; return res; }

    // Chien search: position idx holds the coefficient of x^(N-1-idx); its locator is X = α^(N-1-idx).
    const positions = [], Xs = [];
    for (let idx = 0; idx < N; idx++) {
      const p = N - 1 - idx;
      const Xinv = GF.EXP[(255 - p) % 255];
      if (evalLow(locator, Xinv) === 0) { positions.push(idx); Xs.push(GF.EXP[p % 255]); }
    }
    if (positions.length !== L) { res.ok = false; res.reason = 'error locator has no valid roots'; return res; }

    // Forney: Ω(x) = S(x)·Λ(x) mod x^n ; e = X · Ω(X⁻¹) / Λ'(X⁻¹)
    const omega = new Array(n).fill(0);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < locator.length && i + j < n; j++) omega[i + j] ^= GF.mul(S[i], locator[j]);
    const deriv = [];
    for (let i = 1; i < locator.length; i++) deriv.push(i % 2 === 1 ? locator[i] : 0);

    const out = cw.slice();
    const mags = [];
    for (let k = 0; k < positions.length; k++) {
      const X = Xs[k], Xinv = GF.inv(X);
      const den = evalLow(deriv, Xinv);
      if (den === 0) { res.ok = false; res.reason = 'Forney denominator is zero'; return res; }
      const e = GF.mul(X, GF.div(evalLow(omega, Xinv), den));
      mags.push(e);
      out[positions[k]] ^= e;
    }
    if (!syndromes(out, n).every(v => v === 0)) { res.ok = false; res.reason = 'correction did not check out'; return res; }

    res.positions = positions;
    res.magnitudes = mags;
    res.corrected = out;
    res.errors = positions.length;
    return res;
  }

  Q.RS = { generator, encode, decode, syndromes, berlekampMassey };
})(globalThis.QRLab = globalThis.QRLab || {});
