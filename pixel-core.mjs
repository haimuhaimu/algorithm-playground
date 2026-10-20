// A tiny, lossless four-color Huffman protocol. Palette and pixel count are shared.
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
  const root = tree(), pixels = [];
  for (let i = 0; i < count; i++) {
    let node = root;
    if (node.symbol !== undefined) {
      if (bit() !== 0) throw new Error('Invalid single-color payload');
    } else {
      while (node.symbol === undefined) node = bit() ? node.right : node.left;
    }
    pixels.push(node.symbol);
  }
  if (packet.length * 8 - cursor > 7) throw new Error('Trailing bytes');
  while (cursor < packet.length * 8) if (bit()) throw new Error('Nonzero padding');
  return pixels;
}

export function preset(name) {
  if (name === 'blank') return Array(256).fill(0);
  if (name === 'noise') return Array.from({ length: 256 }, (_, i) => ((i * 73) ^ (i >> 2) ^ (i >> 5)) % 4);
  const drawings = {
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
