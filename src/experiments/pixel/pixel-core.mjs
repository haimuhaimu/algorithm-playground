// A tiny, lossless four-color Huffman protocol. Palette and pixel count are shared.
export const POSTCARD_COLORS = Object.freeze(['#f3eedc', '#30352a', '#bdd754', '#e79d88']);
export const STUDIO_POSTCARD_NAMES = Object.freeze({heim:'嘿姆',bobby:'波比','chouchou-studio':'臭臭'});
export const EDITOR_POSTCARD_PRESETS = Object.freeze([...Object.keys(STUDIO_POSTCARD_NAMES),'heart','noise','blank']);
const validColor = n => Number.isInteger(n) && n >= 0 && n < 4;
function checkPixels(pixels) {
  if (!Array.isArray(pixels) || !pixels.length || pixels.length > 4096 || !Array.from(pixels).every(validColor)) throw new TypeError('Expected 1–4096 four-color pixels');
}

export function encode(pixels) {
  checkPixels(pixels);
  const counts = [0, 0, 0, 0];
  for (const color of pixels) counts[color]++;
  const queue = counts.flatMap((weight, symbol) => weight ? [{ weight, symbol, min: symbol }] : []);
  while (queue.length > 1) {
    queue.sort((a, b) => a.weight - b.weight || a.min - b.min);
    const left = queue.shift(), right = queue.shift();
    queue.push({ weight: left.weight + right.weight, min: Math.min(left.min, right.min), left, right });
  }
  const codes = [null, null, null, null];
  let header = '';
  function visit(node, prefix) {
    if (node.symbol !== undefined) {
      header += `1${node.symbol.toString(2).padStart(2, '0')}`;
      codes[node.symbol] = prefix || '0';
    } else {
      header += '0'; visit(node.left, `${prefix}0`); visit(node.right, `${prefix}1`);
    }
  }
  visit(queue[0], '');
  const payload = pixels.map(color => codes[color]).join('');
  const paddingBits = (8 - (header.length + payload.length) % 8) % 8;
  const bits = header + payload + '0'.repeat(paddingBits);
  const packet = Uint8Array.from({ length: bits.length / 8 }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
  const entropy = counts.reduce((sum, n) => n ? sum - n / pixels.length * Math.log2(n / pixels.length) : sum, 0);
  return { packet, codes, counts, payloadBits: payload.length, treeBits: header.length, paddingBits, entropy };
}

export function decode(packet, count) {
  return inspectPacket(packet, count).pixels;
}

// The teaching trace is produced by the same byte parser as normal delivery.
// Offsets are absolute bit positions in the packet, including its tree header.
export function inspectPacket(packet, count) {
  if (!(packet instanceof Uint8Array) || !packet.length || packet.length > 1538 || !Number.isInteger(count) || count < 1 || count > 4096) throw new TypeError('Invalid packet or pixel count');
  let cursor = 0, nodes = 0;
  const symbols = new Set();
  function bit() {
    if (cursor >= packet.length * 8) throw new Error('Truncated packet');
    const value = (packet[cursor >> 3] >> (7 - cursor % 8)) & 1;
    cursor++; return value;
  }
  function tree(depth = 0) {
    if (++nodes > 7 || depth > 3) throw new Error('Invalid code tree');
    if (bit()) {
      const symbol = bit() * 2 + bit();
      if (symbols.has(symbol)) throw new Error('Duplicate symbol');
      symbols.add(symbol); return { symbol };
    }
    return { left: tree(depth + 1), right: tree(depth + 1) };
  }
  const root = tree(), pixels = [], entries = [], codes = [null, null, null, null];
  const treeBits = cursor;
  function codebook(node, prefix = '') {
    if (node.symbol !== undefined) codes[node.symbol] = prefix || '0';
    else { codebook(node.left, prefix + '0'); codebook(node.right, prefix + '1'); }
  }
  codebook(root);
  for (let i = 0; i < count; i++) {
    let node = root, code = '';
    const startBit = cursor;
    if (node.symbol !== undefined) {
      if (bit() !== 0) throw new Error('Invalid single-color payload');
      code = '0';
    } else {
      while (node.symbol === undefined) {
        const direction = bit(); code += direction;
        node = direction ? node.right : node.left;
      }
    }
    pixels.push(node.symbol);
    entries.push({ index: i, color: node.symbol, code, startBit, endBit: cursor });
  }
  const payloadBits = cursor - treeBits, paddingBits = packet.length * 8 - cursor;
  if (packet.length * 8 - cursor > 7) throw new Error('Trailing bytes');
  while (cursor < packet.length * 8) if (bit()) throw new Error('Nonzero padding');
  return { pixels, entries, codes, treeBits, payloadBits, paddingBits };
}

export function preset(name) {
  if (name === 'blank') return Array(256).fill(0);
  if (name === 'noise') return Array.from({ length: 256 }, (_, i) => ((i * 73) ^ (i >> 2) ^ (i >> 5)) % 4);
  const drawings = {
    // Distinct silhouettes in the unchanged paper/ink/moss/coral palette.
    heim: [
      '0000000000000000', '0000000010000000', '0000000111000000', '0010000131100000',
      '0111001131111000', '0131111111111100', '0131111111111110', '0111111111111110',
      '0111111121111110', '0121111221111110', '0112211111111110', '0111113111111110',
      '0111111111111110', '0111111111111100', '0011101111111000', '0000000000000000',
    ],
    bobby: [
      '0000000000000000', '0010000000001000', '0011000000011000', '0013100000131000',
      '0013310001331000', '0013331013331000', '0001331113310000', '0001100000110000',
      '0010110001101000', '0010210001201000', '0010111011101000', '0001003300010000',
      '0000111111100000', '0000001000011100', '0000000111111100', '0000000000000000',
    ],
    // Hand-drawn in the shared four colors, after the studio portrait:
    // uneven ears and eyes, pale nose blaze and a wide, shaggy chest.
    'chouchou-studio': [
      '0000000000000000', '0000010000000000', '0000131010100000', '0000133131310110',
      '0001333303333131', '0013331303331310', '0013312103313100', '0133331000121310',
      '0013000000013310', '0103000330003311', '0100000030000010', '0110000303000001',
      '0100000000000110', '0011000000000100', '0000111111111000', '0000000000000000',
    ],
    // Keep the earlier studio postcard for pixel-chouchou-v1 receipt replay.
    // The long-haired studio cat: contrasting ears and mask, pale blaze and a curled tail.
    chouchou: [
      '0000000000000000', '0001000000000000', '0013100000010000', '0013111111131000',
      '0011111011111000', '0011210002111000', '0013310013311000', '0001100300110000',
      '0001300000310000', '0010300000001000', '0010300000001100', '0010330000111310',
      '0010003001113310', '0013313011331100', '0001111111111000', '0000000000000000',
    ],
    // Keep the previous image for pixel-cat-v1 receipt replay.
    cat: [
      '0000000000000000', '0000000000000000', '0001000000001000', '0001100000011000',
      '0001311111131000', '0001333333331000', '0001333333331000', '0001313333131000',
      '0001333333331000', '0001333133331000', '0001333333331000', '0000111111110000',
      '0000222222220000', '0002222222222000', '0000000000000000', '0000000000000000',
    ],
    heart: [
      '0000000000000000', '0000000000000000', '0000333003330000', '0003333333333000',
      '0033333333333300', '0033333333333300', '0033333333333300', '0003333333333000',
      '0000333333330000', '0000033333300000', '0000003333000000', '0000000330000000',
      '0000000000000000', '0000022222200000', '0000000000000000', '0000000000000000',
    ],
  };
  if (!drawings[name]) throw new Error('Unknown postcard');
  return drawings[name].join('').split('').map(Number);
}

// Four coral pixels on the viewer-left cheek; each is replaced with paper.
const POSTAGE_BYTE_CHEEK = [99, 114, 115, 131];
export const POSTAGE_BYTE_STEPS = POSTAGE_BYTE_CHEEK.length;

export function postageByteTrial(step = 0) {
  if (!Number.isInteger(step) || step < 0 || step > POSTAGE_BYTE_STEPS) {
    throw new RangeError('Invalid postage trial step');
  }
  const pixels = preset('chouchou-studio');
  const changed = POSTAGE_BYTE_CHEEK.slice(0, step);
  for (const index of changed) pixels[index] = 0;
  return { pixels, encoded: encode(pixels), changed };
}

export function stroke(pixels, from, to, color) {
  checkPixels(pixels);
  if (pixels.length !== 256 || !validColor(color) || ![from, to].every(p => p && [p.x, p.y].every(n => Number.isInteger(n) && n >= 0 && n < 16))) throw new TypeError('Invalid stroke');
  const next = [...pixels];
  let { x, y } = from;
  const dx = Math.abs(to.x - x), dy = -Math.abs(to.y - y), sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    next[y * 16 + x] = color;
    if (x === to.x && y === to.y) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return next;
}

// Compare actual packets, not an estimate of visual complexity. The original
// and rearranged postcards are isolated copies; neither writes to the editor.
export function rearrangement(pixels, seed = 42) {
  checkPixels(pixels);
  if (pixels.length !== 256 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError('Invalid postcard or seed');
  const shuffled = [...pixels];
  let state = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(state / 0x100000000 * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.every((p, i) => p === pixels[i]) && pixels.some(p => p !== pixels[0])) shuffled.push(shuffled.shift());
  const snapshot = data => {
    const copy = [...data], encoded = encode(copy), decoded = decode(encoded.packet, copy.length);
    return { pixels: copy, encoded, decoded, matches: decoded.reduce((n, p, i) => n + Number(p === copy[i]), 0) };
  };
  const before = snapshot(pixels), after = snapshot(shuffled);
  return {
    before, after,
    changedCells: pixels.reduce((n, p, i) => n + Number(p !== shuffled[i]), 0),
    samePacket: before.encoded.packet.length === after.encoded.packet.length && before.encoded.packet.every((p, i) => p === after.encoded.packet[i]),
  };
}
