import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from '../../scripts/build.mjs';

test('built experiments keep shared navigation and studio sprites, without shipping the old guide bundle', async () => {
  const out = await mkdtemp(join(tmpdir(), 'cat-guides-'));
  try {
    const files = await build(undefined, out);
    const labs = files.filter(file => file.endsWith('.html') && file!=='index.html');
    for (const lab of labs) {
      const html = await readFile(join(out, lab), 'utf8');
      assert.match(html, /src="\.\/navigation\.mjs(?:\?[^"]*)?"/, lab);
      assert.match(html, /href="\.\/navigation\.css(?:\?[^"]*)?"/, lab);
    }
    for(const name of ['heim','bobby','chouchou']){
      const sprite=await readFile(join(out,`studio-${name}-idle.png`));
      assert.deepEqual([...sprite.subarray(0,4)],[137,80,78,71]);
    }
    assert.ok(!files.includes('cat-guide-lessons.mjs'));
    assert.ok(!files.includes('cat-guide-sprites.jpg'));
    assert.ok((await readdir(out)).every(file=>!/^IMG_|photos-manifest|sources$/i.test(file)));
  } finally {
    await rm(out, {recursive:true,force:true});
  }
});
