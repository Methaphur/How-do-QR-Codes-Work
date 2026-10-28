/* A from-scratch QR Code Model 2 encoder (versions 1–10) and a matching reader.
   Every stage is kept on the result so the slides can visualise it.
   Coordinates: x = column, y = row. Matrices are arrays of rows (m[y][x]), 1 = dark. */
(function (Q) {
  'use strict';
  const RS = Q.RS;

  const ECL = { L: { bits: 1, i: 0 }, M: { bits: 0, i: 1 }, Q: { bits: 3, i: 2 }, H: { bits: 2, i: 3 } };
  const ECL_NAMES = ['L', 'M', 'Q', 'H'];

  // [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] for L, M, Q, H — versions 1..10
  const BLOCKS = [
    null,
    [[7, 1, 19], [10, 1, 16], [13, 1, 13], [17, 1, 9]],
    [[10, 1, 34], [16, 1, 28], [22, 1, 22], [28, 1, 16]],
    [[15, 1, 55], [26, 1, 44], [18, 2, 17], [22, 2, 13]],
    [[20, 1, 80], [18, 2, 32], [26, 2, 24], [16, 4, 9]],
    [[26, 1, 108], [24, 2, 43], [18, 2, 15, 2, 16], [22, 2, 11, 2, 12]],
    [[18, 2, 68], [16, 4, 27], [24, 4, 19], [28, 4, 15]],
    [[20, 2, 78], [18, 4, 31], [18, 2, 14, 4, 15], [26, 4, 13, 1, 14]],
    [[24, 2, 97], [22, 2, 38, 2, 39], [22, 4, 18, 2, 19], [26, 4, 14, 2, 15]],
    [[30, 2, 116], [22, 3, 36, 2, 37], [20, 4, 16, 4, 17], [24, 4, 12, 4, 13]],
    [[18, 2, 68, 2, 69], [26, 4, 43, 1, 44], [24, 6, 19, 2, 20], [28, 6, 15, 2, 16]],
  ];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  const MAX_VERSION = 10;

  const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  const MODES = {
    numeric: { name: 'Numeric', indicator: '0001', countBits: v => (v < 10 ? 10 : 12) },
    alphanumeric: { name: 'Alphanumeric', indicator: '0010', countBits: v => (v < 10 ? 9 : 11) },
    byte: { name: 'Byte', indicator: '0100', countBits: v => (v < 10 ? 8 : 16) },
  };

  const MASKS = [
    { formula: '(row + col) mod 2 = 0', fn: (x, y) => (x + y) % 2 === 0 },
    { formula: 'row mod 2 = 0', fn: (x, y) => y % 2 === 0 },
    { formula: 'col mod 3 = 0', fn: (x, y) => x % 3 === 0 },
    { formula: '(row + col) mod 3 = 0', fn: (x, y) => (x + y) % 3 === 0 },
    { formula: '(⌊row/2⌋ + ⌊col/3⌋) mod 2 = 0', fn: (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0 },
    { formula: '(row·col) mod 2 + (row·col) mod 3 = 0', fn: (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0 },
    { formula: '((row·col) mod 2 + (row·col) mod 3) mod 2 = 0', fn: (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0 },
    { formula: '((row + col) mod 2 + (row·col) mod 3) mod 2 = 0', fn: (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0 },
  ];

  const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  const dec = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;

  const bin = (v, n) => v.toString(2).padStart(n, '0');

  function blockInfo(version, ecl) {
    const [ec, b1, d1, b2 = 0, d2 = 0] = BLOCKS[version][ECL[ecl].i];
    const blocks = [];
    for (let i = 0; i < b1; i++) blocks.push(d1);
    for (let i = 0; i < b2; i++) blocks.push(d2);
    const dataCodewords = b1 * d1 + b2 * d2;
    return { ec, blocks, dataCodewords, totalCodewords: dataCodewords + ec * blocks.length };
  }

  function detectMode(text) {
    if (/^[0-9]+$/.test(text)) return 'numeric';
    if ([...text].every(c => ALNUM.includes(c)) && text.length) return 'alphanumeric';
    return 'byte';
  }
  function canUseMode(text, mode) {
    if (mode === 'numeric') return /^[0-9]*$/.test(text);
    if (mode === 'alphanumeric') return [...text].every(c => ALNUM.includes(c));
    return true;
  }

  /* Data bits split into labelled groups, e.g. "123" → 10 bits. */
  function dataGroups(text, mode) {
    const groups = [];
    if (mode === 'numeric') {
      for (let i = 0; i < text.length; i += 3) {
        const chunk = text.slice(i, i + 3);
        const n = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
        groups.push({ label: chunk, bits: bin(parseInt(chunk, 10), n), note: chunk + ' → ' + n + ' bits' });
      }
    } else if (mode === 'alphanumeric') {
      for (let i = 0; i < text.length; i += 2) {
        const a = ALNUM.indexOf(text[i]);
        if (i + 1 < text.length) {
          const b = ALNUM.indexOf(text[i + 1]);
          groups.push({ label: text.slice(i, i + 2), bits: bin(a * 45 + b, 11), note: `45×${a} + ${b} = ${a * 45 + b}` });
        } else groups.push({ label: text[i], bits: bin(a, 6), note: `${a}` });
      }
    } else {
      for (const ch of text) {
        const bytes = enc.encode(ch);
        bytes.forEach((b, k) => groups.push({ label: k === 0 ? ch : '·', bits: bin(b, 8), note: '0x' + b.toString(16).toUpperCase().padStart(2, '0') }));
      }
    }
    return groups;
  }
  function charCount(text, mode) { return mode === 'byte' ? enc.encode(text).length : text.length; }

  function bitLength(text, mode, version) {
    const dataBits = dataGroups(text, mode).reduce((s, g) => s + g.bits.length, 0);
    return 4 + MODES[mode].countBits(version) + dataBits;
  }

  function chooseVersion(text, mode, ecl, minVersion) {
    for (let v = minVersion || 1; v <= MAX_VERSION; v++) {
      const cap = blockInfo(v, ecl).dataCodewords * 8;
      const cnt = charCount(text, mode);
      if (cnt >= 1 << MODES[mode].countBits(v)) continue;
      if (bitLength(text, mode, v) <= cap) return v;
    }
    return 0;
  }

  /* ---------- Function patterns ---------- */
  function emptyGrid(n, v) { return Array.from({ length: n }, () => new Array(n).fill(v)); }

  function buildFunctionPatterns(version) {
    const size = version * 4 + 17;
    const m = emptyGrid(size, 0);
    const fn = emptyGrid(size, false);
    const region = emptyGrid(size, '');
    const set = (x, y, dark, r) => { m[y][x] = dark ? 1 : 0; fn[y][x] = true; region[y][x] = r; };

    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0, 'timing'); set(i, 6, i % 2 === 0, 'timing'); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4, d === 4 ? 'separator' : 'finder');
      }
    }
    const al = ALIGN[version];
    for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, 'alignment');
    }
    // reserve format areas (filled later) and the dark module
    drawFormat(m, fn, region, size, 0, true);
    if (version >= 7) drawVersion(m, fn, region, size, version);
    return { size, m, fn, region };
  }

  function formatBits(ecl, mask) {
    const data = (ECL[ecl].bits << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return { data, bch: rem & 0x3ff, raw: (data << 10) | (rem & 0x3ff), bits: ((data << 10) | (rem & 0x3ff)) ^ 0x5412 };
  }

  /* Positions of the 15 format bits, both copies: [[x,y], ...] indexed by bit number (0 = LSB). */
  function formatPositions(size) {
    const a = [], b = [];
    for (let i = 0; i <= 5; i++) a.push([8, i]);
    a.push([8, 7], [8, 8], [7, 8]);
    for (let i = 9; i < 15; i++) a.push([14 - i, 8]);
    for (let i = 0; i < 8; i++) b.push([size - 1 - i, 8]);
    for (let i = 8; i < 15; i++) b.push([8, size - 15 + i]);
    return [a, b];
  }

  function drawFormat(m, fn, region, size, bits, reserveOnly) {
    const [a, b] = formatPositions(size);
    for (let i = 0; i < 15; i++) {
      const v = reserveOnly ? 0 : (bits >>> i) & 1;
      for (const [x, y] of [a[i], b[i]]) { m[y][x] = v; if (fn) fn[y][x] = true; if (region) region[y][x] = 'format'; }
    }
    m[size - 8][8] = 1;
    if (fn) fn[size - 8][8] = true;
    if (region) region[size - 8][8] = 'dark';
  }

  function versionBits(version) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    return (version << 12) | rem;
  }
  function drawVersion(m, fn, region, size, version) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const v = (bits >>> i) & 1, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      m[b][a] = v; fn[b][a] = true; region[b][a] = 'version';
      m[a][b] = v; fn[a][b] = true; region[a][b] = 'version';
    }
  }

  /* Zig-zag order of every non-function module. */
  function placementOrder(fn) {
    const size = fn.length, order = [];
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j, y = upward ? size - 1 - vert : vert;
          if (!fn[y][x]) order.push([x, y]);
        }
      }
    }
    return order;
  }

  function applyMask(m, fn, mask) {
    const f = MASKS[mask].fn;
    return m.map((row, y) => row.map((v, x) => (!fn[y][x] && f(x, y) ? v ^ 1 : v)));
  }

  /* The four penalty rules from ISO/IEC 18004. */
  function penalty(m) {
    const n = m.length;
    let n1 = 0, n2 = 0, n3 = 0;
    const lines = [];
    for (let y = 0; y < n; y++) lines.push(m[y]);
    for (let x = 0; x < n; x++) lines.push(m.map(r => r[x]));
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && line[i] === line[i - 1]) run++;
        else { if (run >= 5) n1 += 3 + run - 5; run = 1; }
      }
      const s = line.join('');
      for (const pat of ['10111010000', '00001011101']) {
        let k = s.indexOf(pat);
        while (k !== -1) { n3 += 40; k = s.indexOf(pat, k + 1); }
      }
    }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) n2 += 3;
    }
    let dark = 0;
    for (const row of m) for (const v of row) dark += v;
    const pct = (dark * 100) / (n * n);
    const n4 = 10 * Math.floor(Math.abs(pct - 50) / 5);
    return { n1, n2, n3, n4, total: n1 + n2 + n3 + n4, darkPct: pct };
  }

  /* ---------- Main encoder ---------- */
  function encode(text, opts) {
    opts = opts || {};
    const ecl = opts.ecl || 'M';
    let mode = opts.mode || detectMode(text);
    if (!canUseMode(text, mode)) mode = 'byte';
    const version = chooseVersion(text, mode, ecl, opts.minVersion);
    if (!version) return { error: `That message is too long for this demo (versions 1–${MAX_VERSION}). Try something shorter or a lower EC level.` };

    const info = blockInfo(version, ecl);
    const capacityBits = info.dataCodewords * 8;
    const groups = dataGroups(text, mode);
    const count = charCount(text, mode);
    const segments = [
      { type: 'mode', label: MODES[mode].name + ' mode', bits: MODES[mode].indicator },
      { type: 'count', label: count + (mode === 'byte' ? ' bytes' : ' characters'), bits: bin(count, MODES[mode].countBits(version)) },
      { type: 'data', label: 'Data', bits: groups.map(g => g.bits).join(''), groups },
    ];
    let bits = segments.map(s => s.bits).join('');
    const term = '0'.repeat(Math.min(4, capacityBits - bits.length));
    bits += term;
    const byteFill = '0'.repeat((8 - (bits.length % 8)) % 8);
    bits += byteFill;
    const padBytes = [];
    for (let i = 0; bits.length < capacityBits; i++) { const p = i % 2 ? 0x11 : 0xec; padBytes.push(p); bits += bin(p, 8); }
    segments.push({ type: 'terminator', label: 'Terminator', bits: term });
    segments.push({ type: 'fill', label: 'Byte fill', bits: byteFill });
    segments.push({ type: 'pad', label: 'Pad bytes', bits: padBytes.map(p => bin(p, 8)).join(''), padBytes });

    const dataCodewords = [];
    for (let i = 0; i < bits.length; i += 8) dataCodewords.push(parseInt(bits.slice(i, i + 8), 2));

    // split into blocks, compute EC for each
    const blocks = [];
    let k = 0;
    for (const len of info.blocks) {
      const data = dataCodewords.slice(k, k + len);
      k += len;
      blocks.push({ data, ec: RS.encode(data, info.ec) });
    }
    // interleave; remember where each final codeword came from
    const final = [], origin = [];
    const maxData = Math.max(...info.blocks);
    for (let i = 0; i < maxData; i++) blocks.forEach((b, bi) => { if (i < b.data.length) { final.push(b.data[i]); origin.push({ block: bi, index: i, ec: false }); } });
    for (let i = 0; i < info.ec; i++) blocks.forEach((b, bi) => { final.push(b.ec[i]); origin.push({ block: bi, index: b.data.length + i, ec: true }); });

    // matrix
    const fp = buildFunctionPatterns(version);
    const { size, fn, region } = fp;
    const base = fp.m.map(r => r.slice());
    const order = placementOrder(fn);
    const placement = order.map(([x, y], i) => {
      const cw = i >> 3;
      const bit = cw < final.length ? (final[cw] >> (7 - (i & 7))) & 1 : 0;
      base[y][x] = bit;
      region[y][x] = cw >= final.length ? 'remainder' : origin[cw].ec ? 'ec' : 'data';
      return { x, y, codeword: cw < final.length ? cw : -1, bit: i & 7 };
    });

    // masks: evaluate all 8 with their format info drawn
    const variants = MASKS.map((_, mk) => {
      const mm = applyMask(base, fn, mk);
      drawFormat(mm, null, null, size, formatBits(ecl, mk).bits);
      return { matrix: mm, penalty: penalty(mm) };
    });
    let mask = opts.mask;
    if (mask == null) {
      mask = 0;
      variants.forEach((v, i) => { if (v.penalty.total < variants[mask].penalty.total) mask = i; });
    }

    return {
      text, mode, modeName: MODES[mode].name, ecl, version, size,
      info, capacityBits, segments, bits, dataCodewords, blocks, final, origin,
      fn, region, base, placement, variants, mask,
      format: formatBits(ecl, mask),
      matrix: variants[mask].matrix,
    };
  }

  /* ---------- Reader: matrix → codewords → RS decode → text ---------- */
  function readFormat(m) {
    const size = m.length;
    const [a, b] = formatPositions(size);
    const copies = [a, b].map(pos => pos.reduce((acc, [x, y], i) => acc | (m[y][x] << i), 0));
    let best = null;
    for (const e of ECL_NAMES) for (let mk = 0; mk < 8; mk++) {
      const bits = formatBits(e, mk).bits;
      for (const c of copies) {
        let d = 0, v = bits ^ c;
        while (v) { d += v & 1; v >>>= 1; }
        if (!best || d < best.distance) best = { ecl: e, mask: mk, distance: d };
      }
    }
    return best.distance <= 3 ? best : { ...best, failed: true };
  }

  function parseBits(bits, version) {
    let p = 0;
    const take = n => { const v = parseInt(bits.slice(p, p + n), 2); p += n; return v; };
    let out = '';
    const bytes = [];
    while (p + 4 <= bits.length) {
      const ind = bits.slice(p, p + 4); p += 4;
      if (ind === '0000') break;
      const mode = Object.keys(MODES).find(k => MODES[k].indicator === ind);
      if (!mode) return { ok: false, text: out };
      const cnt = take(MODES[mode].countBits(version));
      if (mode === 'numeric') {
        for (let i = 0; i < cnt; i += 3) {
          const n = Math.min(3, cnt - i), w = n === 3 ? 10 : n === 2 ? 7 : 4;
          out += String(take(w)).padStart(n, '0');
        }
      } else if (mode === 'alphanumeric') {
        for (let i = 0; i < cnt; i += 2) {
          if (i + 1 < cnt) { const v = take(11); out += ALNUM[Math.floor(v / 45)] + ALNUM[v % 45]; }
          else out += ALNUM[take(6)];
        }
      } else {
        for (let i = 0; i < cnt; i++) bytes.push(take(8));
        out += dec.decode(new Uint8Array(bytes.splice(0)));
      }
    }
    return { ok: true, text: out };
  }

  function read(m) {
    const size = m.length, version = (size - 17) / 4;
    const format = readFormat(m);
    if (format.failed) return { ok: false, format, stage: 'format', reason: 'format information is unreadable' };
    const { fn } = buildFunctionPatterns(version);
    const unmasked = applyMask(m, fn, format.mask);
    const order = placementOrder(fn);
    const info = blockInfo(version, format.ecl);
    const raw = [];
    for (let i = 0; i < info.totalCodewords; i++) {
      let v = 0;
      for (let b = 0; b < 8; b++) { const [x, y] = order[i * 8 + b]; v = (v << 1) | unmasked[y][x]; }
      raw.push(v);
    }
    // de-interleave
    const recv = info.blocks.map(() => []);
    let k = 0;
    const maxData = Math.max(...info.blocks);
    for (let i = 0; i < maxData; i++) info.blocks.forEach((len, bi) => { if (i < len) recv[bi].push(raw[k++]); });
    for (let i = 0; i < info.ec; i++) info.blocks.forEach((_, bi) => recv[bi].push(raw[k++]));

    const blocks = recv.map((cw, bi) => ({ received: cw, dataLen: info.blocks[bi], ...RS.decode(cw, info.ec) }));
    const ok = blocks.every(b => b.ok);
    const data = [];
    blocks.forEach(b => data.push(...b.corrected.slice(0, b.dataLen)));
    const bits = data.map(v => bin(v, 8)).join('');
    const parsed = parseBits(bits, version);
    return { ok: ok && parsed.ok, format, version, info, raw, blocks, text: parsed.text, reason: ok ? null : blocks.find(b => !b.ok).reason };
  }

  Q.QR = {
    encode, read, readFormat, formatBits, formatPositions, versionBits, penalty, applyMask, placementOrder,
    buildFunctionPatterns, blockInfo, detectMode, canUseMode, bitLength, chooseVersion, dataGroups,
    MODES, MASKS, ALNUM, ALIGN, ECL, ECL_NAMES, MAX_VERSION, bin,
  };
})(globalThis.QRLab = globalThis.QRLab || {});
