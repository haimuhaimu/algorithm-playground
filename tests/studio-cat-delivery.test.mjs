import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';
import {build} from '../scripts/build.mjs';
import {startServer} from '../scripts/serve.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const module = 'studio-cat-assets.mjs';
const images = [
  'studio-brand-cats.png',
  'studio-heim-portrait.png', 'studio-heim-idle.png', 'studio-heim-run.png',
  'studio-bobby-portrait.png', 'studio-bobby-idle.png', 'studio-bobby-run.png',
  'studio-chouchou-portrait.png', 'studio-chouchou-idle.png', 'studio-chouchou-run.png',
];
const privateFiles = ['studio-heim-source.png', 'studio-heim-working.png', 'studio-cat-sources.md', 'candidate-atlas.png', 'IMG_001.jpg'];

function paeth(left, above, corner) {
  const guess = left + above - corner;
  const l = Math.abs(guess - left), a = Math.abs(guess - above), c = Math.abs(guess - corner);
  return l <= a && l <= c ? left : a <= c ? above : corner;
}

function assertTransparentRgba(bytes, file) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), file);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', file);
  assert.deepEqual([...bytes.subarray(24, 29)], [8, 6, 0, 0, 0], `${file} must be a non-interlaced 8-bit RGBA PNG`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  const chunks = [];
  for (let offset = 8; offset < bytes.length; ) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const pixels = inflateSync(Buffer.concat(chunks));
  assert.equal(pixels.length, height * (width * 4 + 1), file);
  // Only reconstruct the alpha channel; each filter predicts from alpha samples at adjacent pixels.
  let above = new Uint8Array(width), row = new Uint8Array(width);
  let clear = false, visible = false;
  for (let y = 0; y < height && !(clear && visible); y++) {
    const offset = y * (width * 4 + 1);
    const filter = pixels[offset];
    assert.ok(filter <= 4, `${file} has an invalid PNG filter`);
    for (let x = 0; x < width; x++) {
      const left = row[x - 1] ?? 0, corner = above[x - 1] ?? 0;
      const prediction = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above[x]
        : filter === 3 ? (left + above[x]) >> 1 : paeth(left, above[x], corner);
      row[x] = pixels[offset + (x + 1) * 4] + prediction;
      clear ||= row[x] === 0;
      visible ||= row[x] > 0;
    }
    [above, row] = [row, above];
  }
  assert.ok(clear && visible, `${file} needs both fully clear background and visible artwork`);
}

test('build includes exactly the approved transparent studio PNGs and their module, byte-for-byte', async () => {
  const out = await mkdtemp(join(tmpdir(), 'studio-cats-build-'));
  try {
    await build(root, out);
    const built = await readdir(out);
    assert.deepEqual(built.filter(file => file.startsWith('studio-')).sort(), [...images, module].sort());
    for (const file of privateFiles) assert.ok(!built.includes(file), `${file} must stay local`);
    for (const file of [...images, module]) {
      const bytes = await readFile(join(out, file));
      assert.deepEqual(bytes, await readFile(join(root, file)), file);
      if (file.endsWith('.png')) assertTransparentRgba(bytes, file);
    }
  } finally {
    await rm(out, {recursive:true, force:true});
  }
});

test('local preview serves studio PNGs and their JavaScript module with the correct MIME types', async () => {
  const server = await startServer({port:0});
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const file of [...images, module]) {
      const result = await fetch(`${base}/${file}`);
      assert.equal(result.status, 200, file);
      assert.equal(result.headers.get('content-type'), file === module ? 'text/javascript; charset=utf-8' : 'image/png', file);
      assert.deepEqual(Buffer.from(await result.arrayBuffer()), await readFile(join(root, file)), file);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('local preview refuses unlisted studio drafts, private notes and original photos even when on disk', async () => {
  const source = await mkdtemp(join(tmpdir(), 'studio-cats-private-'));
  try {
    await Promise.all(privateFiles.map(file => writeFile(join(source, file), 'Not approved for delivery')));
    const server = await startServer({port:0, root:source});
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      for (const file of privateFiles) assert.equal((await fetch(`${base}/${file}`)).status, 404, file);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    await rm(source, {recursive:true, force:true});
  }
});
