import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { build, ROOT } from '../../scripts/build.mjs';
import { RUNTIME_FILES, PUBLIC_FILES } from '../../scripts/runtime-files.mjs';
import { readRuntimeFile } from '../../scripts/runtime-content.mjs';
import { startServer } from '../../scripts/serve.mjs';

test('a build output folder containing mapped sources is rejected before any source is overwritten', async () => {
  const root = await mkdtemp(join(tmpdir(), 'playground-source-overwrite-'));
  try {
    for (const path of Object.values(RUNTIME_FILES)) {
      await mkdir(join(root, dirname(path)), { recursive: true });
      await writeFile(join(root, path), path.endsWith('.mjs') ? 'export {};\n' : 'SOURCE');
    }
    const source = join(root, RUNTIME_FILES['rsi.mjs']);
    await assert.rejects(build(root, dirname(source)), /output.*source/i);
    assert.equal(await readFile(source, 'utf8'), 'export {};\n');
    assert.deepEqual((await readdir(dirname(source))).sort(), ['rsi-core.mjs', 'rsi-session.mjs', 'rsi.css', 'rsi.html', 'rsi.mjs']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a symlinked source parent cannot publish files outside the selected root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'playground-contained-'));
  const outside = await mkdtemp(join(tmpdir(), 'playground-external-'));
  try {
    await mkdir(join(outside, 'home'));
    await writeFile(join(outside, 'home/index.html'), 'PRIVATE');
    await symlink(outside, join(root, 'src'));
    await assert.rejects(readRuntimeFile(root, 'index.html'), /outside root/);
    const server = await startServer({ root, port: 0 });
    try {
      assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/`)).status, 404);
    } finally { await new Promise(resolve => server.close(resolve)); }
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('source preview and built preview expose identical bytes and headers, never physical source paths', async () => {
  const output = await mkdtemp(join(tmpdir(), 'playground-source-parity-'));
  const source = await startServer({ port: 0 });
  let built;
  try {
    await build(ROOT, output);
    built = await startServer({ root: output, built: true, port: 0 });
    const urls = [source, built].map(server => `http://127.0.0.1:${server.address().port}`);
    for (const file of PUBLIC_FILES) {
      const responses = await Promise.all(urls.map(base => fetch(`${base}/${file}?v=compatibility`, {
        headers: { Origin: 'http://127.0.0.1:3100' },
      })));
      assert.ok(responses.every(response => response.status === 200), file);
      for (const header of ['content-type', 'content-length', 'content-security-policy', 'x-content-type-options', 'cache-control', 'access-control-allow-origin']) {
        assert.equal(responses[0].headers.get(header), responses[1].headers.get(header), file + ' ' + header);
      }
      assert.deepEqual(await responses[0].arrayBuffer(), await responses[1].arrayBuffer(), file);
    }
    for (const base of urls) {
      for (const path of ['/src/home/index.html', '/src/shared/navigation.mjs', '/scripts/runtime-files.mjs', '/tests/delivery/source-boundaries.test.mjs', '/assets/comics/cat-album-cover.jpg', '/package-lock.json', '/docs/ARCHITECTURE.md']) {
        assert.equal((await fetch(base + path)).status, 404, path);
      }
    }
  } finally {
    await new Promise(resolve => source.close(resolve));
    if (built) await new Promise(resolve => built.close(resolve));
    await rm(output, { recursive: true, force: true });
  }
});
