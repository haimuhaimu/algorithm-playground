import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {build} from '../../scripts/build.mjs';
import {startServer} from '../../scripts/serve.mjs';
import {episodes} from '../../src/home/album/cat-album-episodes.mjs';

const assets = [
  'cat-album.html', 'cat-album.css', 'cat-album.mjs', 'cat-album-cover.jpg',
  'cat-comic-substitute.jpg', 'cat-comic-boss.jpg', 'cat-comic-warmth.jpg',
];

const chapterFile = episode => episode.file.replace(/^cat-comic-/, 'cat-album-').replace(/\.jpg$/, '.html');
const decode = value => value.replace(/&(?:amp|lt|gt|quot|apos|#39|#\d+|#x[0-9a-f]+);/gi, entity => {
  const named = {'&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'", '&#39;':"'"};
  if (Object.hasOwn(named, entity.toLowerCase())) return named[entity.toLowerCase()];
  return String.fromCodePoint(entity[2].toLowerCase() === 'x'
    ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10));
});
const text = markup => decode(markup.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const attributes = markup => Object.fromEntries([...markup.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)]
  .map(([, name, , value]) => [name, decode(value)]));
const links = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  .map(([, attrs, content]) => ({attributes: attributes(attrs), text: text(content)}));
const hasClass = (element, name) => (element.attributes.class ?? '').split(/\s+/).includes(name);

function elementById(html, id) {
  const elements = [...html.matchAll(new RegExp(`<([a-z][\\w:-]*)\\b([^>]*\\bid=["']${id}["'][^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi'))];
  assert.equal(elements.length, 1, `${id} appears exactly once`);
  return {attributes: attributes(elements[0][2]), text: text(elements[0][3])};
}

function assertVisibleTotals(html, expectedOccurrences, label) {
  const totals = [...html.matchAll(/<([a-z][\w:-]*)\b([^>]*\bdata-album-total=["'][^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi)];
  assert.equal(totals.length, expectedOccurrences, `${label} exposes each displayed album total`);
  for (const [, , attrs, content] of totals) {
    assert.equal(attributes(attrs)['data-album-total'], String(episodes.length), label);
    assert.match(text(content), new RegExp(`(?:^|[^\\d])${episodes.length}\\s*篇`), `${label} visible count matches the catalog`);
    assert.doesNotMatch(attrs, /\b(?:hidden|aria-hidden\s*=\s*["']true["'])/, `${label} count is visible`);
  }
}

test('the built homepage has an optional album beside the still-working experiment link', async () => {
  const out = await mkdtemp(join(tmpdir(), 'cat-album-build-'));
  try {
    await build(undefined, out);
    const home = await readFile(join(out, 'index.html'), 'utf8');
    assert.match(home, /href="\.\/pathfinding\.html#path-lab"/);
    assert.match(home, /href="\.\/cat-album\.html"[^>]*id="cat-album-entry"/);
    assert.match(home, /<dialog[^>]+aria-labelledby="cat-album-title"/);
    for (const asset of assets) assert.ok((await readFile(join(out, asset))).length > 0, asset);
    for (const episode of episodes) assert.ok((await readFile(join(out, chapterFile(episode)))).length > 0, episode.title);
  } finally {
    await rm(out, {recursive:true, force:true});
  }
});

test('the no-script album directory lists every chapter without requesting full comic images', async () => {
  const server = await startServer({port:0});
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const home = await (await fetch(base)).text();
    assertVisibleTotals(home, 2, 'homepage');
    const href = elementById(home, 'cat-album-entry').attributes.href;
    assert.equal(href, './cat-album.html');
    const response = await fetch(new URL(href, base));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/, 'a failed module must not send readers to one JPEG');
    const html = await response.text();
    assert.equal([...html.matchAll(/<img\b[^>]*cat-comic-/gi)].length, 0, 'the no-script directory must not request every full comic');
    const chapters = links(html).filter(link => hasClass(link, 'cat-album-chapter'));
    assert.deepEqual(chapters.map(link => ({href: link.attributes.href, title: link.text})),
      episodes.map(episode => ({href: './' + chapterFile(episode), title: episode.title})),
      'chapter count, order, exact titles and destinations match the published catalog');
    assert.match(html, /href="\.\/#cat-album-entry"/, 'the collection has a real return link');
    assert.doesNotMatch(html, /<script\b/, 'the fallback must not depend on another script');
    assertVisibleTotals(html, 1, 'album directory');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('every no-script chapter has one exact comic and working circular reading navigation', async () => {
  const server = await startServer({port:0});
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [index, episode] of episodes.entries()) {
      const file = chapterFile(episode);
      const response = await fetch(base + '/' + file);
      assert.equal(response.status, 200, file);
      assert.match(response.headers.get('content-type'), /text\/html/, file);
      const html = await response.text();
      assert.doesNotMatch(html, /<script\b/, `${file} remains readable without scripts`);
      assert.equal(elementById(html, 'cat-album-reading-title').text, episode.title, file);
      assert.equal(elementById(html, 'cat-album-reading-caption').text, episode.caption, file);
      assert.equal(elementById(html, 'cat-album-reading-count').text, `${index + 1} / ${episodes.length}`, file);
      const images = [...html.matchAll(/<img\b([^>]*)>/gi)].map(([, attrs]) => attributes(attrs));
      assert.equal(images.length, 1, `${file} loads only its selected comic`);
      assert.deepEqual({id: images[0].id, src: images[0].src, alt: images[0].alt,
        width: images[0].width, height: images[0].height},
      {id: 'cat-album-reading-image', src: './' + episode.file, alt: episode.alt,
        width: String(episode.width), height: String(episode.height)}, file);
      const previous = episodes[(index + episodes.length - 1) % episodes.length];
      const next = episodes[(index + 1) % episodes.length];
      assert.equal(elementById(html, 'cat-album-reading-prev').attributes.href, './' + chapterFile(previous), file);
      assert.equal(elementById(html, 'cat-album-reading-next').attributes.href, './' + chapterFile(next), file);
      const pageLinks = links(html);
      assert.ok(pageLinks.some(link => link.attributes.href === './cat-album.html'), `${file} links back to the directory`);
      const originals = pageLinks.filter(link => hasClass(link, 'cat-album-original'));
      assert.equal(originals.length, 1, `${file} has one original-image link`);
      assert.equal(originals[0].attributes.href, './' + episode.file, file);
      const image = await fetch(base + '/' + episode.file);
      assert.equal(image.status, 200, episode.file);
      assert.equal(image.headers.get('content-type'), 'image/jpeg', episode.file);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
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
