import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {build} from '../scripts/build.mjs';
import {startServer} from '../scripts/serve.mjs';

const assets = [
  'cat-album.css', 'cat-album.mjs', 'cat-album-cover.jpg',
  'cat-comic-substitute.jpg', 'cat-comic-boss.jpg', 'cat-comic-warmth.jpg',
];

test('the built homepage has an optional album beside the still-working experiment link', async () => {
  const out = await mkdtemp(join(tmpdir(), 'cat-album-build-'));
  try {
    await build(undefined, out);
    const home = await readFile(join(out, 'index.html'), 'utf8');
    assert.match(home, /href="\.\/pathfinding\.html#path-lab"/);
    assert.match(home, /href="\.\/cat-comic-substitute\.jpg"[^>]*id="cat-album-entry"/);
    assert.match(home, /<dialog[^>]+aria-labelledby="cat-album-title"/);
    for (const asset of assets) assert.ok((await readFile(join(out, asset))).length > 0, asset);
  } finally {
    await rm(out, {recursive:true, force:true});
  }
});

test('the local preview serves the real covers and does not expose the source project', async () => {
  const server = await startServer({port:0});
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const file of assets.filter(asset => asset.endsWith('.jpg'))) {
      const result = await fetch(base + '/' + file);
      assert.equal(result.status, 200, file);
      assert.equal(result.headers.get('content-type'), 'image/jpeg', file);
      assert.deepEqual([...new Uint8Array(await result.arrayBuffer()).slice(0, 3)], [255, 216, 255]);
    }
    assert.equal((await fetch(base + '/sources/')).status, 404);
    assert.equal((await fetch(base + '/photos-manifest.json')).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
