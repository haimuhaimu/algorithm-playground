import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const homepage = () => readFile(new URL('../index.html', import.meta.url), 'utf8');
const textContent = markup => markup.replace(/<[^>]+>/g, '').trim();

test('the established headline and primary experiment link remain the homepage introduction', async () => {
  const home = await homepage();
  const hero = home.match(/<section class="showcase-hero"[^>]*>([\s\S]+?)<\/section>/)?.[1] ?? '';
  assert.equal(textContent(hero.match(/<h1[^>]*>(.+?)<\/h1>/)?.[1] ?? ''), '算法，玩着就懂了。');
  assert.equal(textContent(hero.match(/<p class="hero-description">(.+?)<\/p>/)?.[1] ?? ''), '从一粒沙到一个会学习的模型，把看不见的规则，变成看得见的变化。');
  assert.match(hero, /<a class="primary-link" href="#experiments">探索十个实验\s/);
  assert.match(hero, /<figcaption><span>[^\n]*?A\* 寻路演示/);
});

test('the demo opens the cats’ editable map while the catalog and old search links still work', async () => {
  const home = await homepage();
  const search = await readFile(new URL('../pathfinding.html', import.meta.url), 'utf8');
  assert.match(home, /class="hero-experiment" href="\.\/pathfinding\.html#cat-route-lab"/);
  assert.match(home, /class="experiment-entry pathfinding-entry" href="\.\/pathfinding\.html#path-lab"/);
  const cats = search.match(/<section\b[^>]*\bid="cat-route-lab"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.match(cats, /id="cat-route-after"/);
  assert.match(cats, /id="cat-route-before"/);
  assert.match(cats, /href="\.\/#experiments"/);
  const toolbar = search.match(/<section\b[^>]*\bid="path-lab"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
  assert.match(toolbar, /id="play"/);
  assert.match(toolbar, /id="step"/);
  assert.match(search, /id="arena"/);
});

test('the sticky search toolbar is bounded by the regular boards and comparison, not the cats’ lesson', async () => {
  const search = await readFile(new URL('../pathfinding.html', import.meta.url), 'utf8');
  const start = search.indexOf('<div class="path-play-area">');
  assert.notEqual(start, -1, 'the regular search needs its own block to contain the sticky toolbar');
  let depth = 0, end = -1;
  for (const tag of search.slice(start).matchAll(/<(\/?)div\b[^>]*>/g)) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) {
      end = start + tag.index;
      break;
    }
  }
  assert.ok(end > start);
  const regular = search.slice(start, end);
  for (const id of ['path-lab', 'arena', 'comparison']) assert.ok(regular.includes(`id="${id}"`), id);
  assert.ok(search.indexOf('id="cat-route-lab"') > end, 'the cat title and controls must not share the sticky block');
});

test('the doodle card opens the cat-label exercise without removing the circle/square entry', async () => {
  const home = await homepage();
  const neural = await readFile(new URL('../neural.html', import.meta.url), 'utf8');
  assert.match(home, /class="experiment-entry featured-entry neural-entry" href="\.\/neural\.html#cat-lesson"/);
  assert.match(neural, /id="first-lesson"/);
  assert.match(neural, /href="#first-lesson"[^>]*>[^<]*圆方/);
  assert.match(neural, /id="cat-quick"[\s\S]*?手填的演示特征/);
});

test('the cat-label tile previews the actual two test cards while the learning route still shows the classifier', async () => {
  const home = await homepage();
  const tile = home.match(/<a\b[^>]*\bneural-entry\b[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '';
  const route = home.match(/<figure class="learning-route-visual">([\s\S]*?)<\/figure>/)?.[1] ?? '';
  assert.deepEqual([...tile.matchAll(/<img src="([^"]+)"/g)].map(([, src]) => src), [
    './neural-cat-07.jpg',
    './neural-cat-08.jpg',
  ]);
  assert.match(route, /<img src="\.\/home-preview-neural\.jpg"/);
});

test('the mining card enters the crew flight and the shared-evidence lesson remains reachable', async () => {
  const home = await homepage();
  const mining = await readFile(new URL('../mining.html', import.meta.url), 'utf8');
  assert.ok(home.includes('class="experiment-entry mining-entry" href="./mining.html#mining-flight"'));
  assert.ok(mining.includes('id="mining-flight"'));
  assert.ok(mining.includes('href="#shared-title"'));
});

test('the Pixel Post card can draw both real presets and retains its static fallback', async () => {
  const home = await homepage();
  const card = home.match(/<a\b[^>]*\bpixel-entry\b[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '';
  assert.match(card, /src="\.\/home-preview-pixel\.jpg"/);
  const live = card.match(/class="home-postcards" hidden[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.deepEqual([...live.matchAll(/data-postcard="([^"]+)" width="16" height="16"/g)].map(m => m[1]), ['heim','bobby']);
});

test('the demo and play link precede the optional comic on a narrow screen', async () => {
  const home = await homepage();
  assert.ok(home.indexOf('id="hero-canvas"') < home.indexOf('class="hero-experiment"'));
  assert.ok(home.indexOf('class="hero-experiment"') < home.indexOf('id="cat-album-entry"'));
});

test('the about section introduces each cat with its own portrait and approved nickname', async () => {
  const home = await homepage();
  const about = home.match(/<section[^>]* id="about"[^>]*>([\s\S]+?)<\/section>/)?.[1] ?? '';
  const profiles = [
    ['heim', '嘿姆｜贪心队长'],
    ['bobby', '波比｜回归探员'],
    ['chouchou', '臭臭｜递归参谋'],
  ];
  const roster = about.match(/<ul[^>]*>([\s\S]+?)<\/ul>/)?.[1] ?? '';
  const entries = Array.from(roster.matchAll(/<li>([\s\S]+?)<\/li>/g), ([, item]) => item.trim());
  assert.equal(entries.length, profiles.length, 'keep the cast together inside the existing about section');
  for (const [index, [file, label]] of profiles.entries()) {
    assert.ok(entries[index].includes(`src="./studio-${file}-portrait.png"`), `wrong portrait for ${label}`);
    assert.equal(textContent(entries[index]), label);
  }
});
