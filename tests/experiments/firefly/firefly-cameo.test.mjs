import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../../../dist/',import.meta.url);

test('the habitat observer is decoration on the rim, not on the firefly field or a control',async()=>{
 const html=await readFile(new URL('firefly.html',root),'utf8');
 const rim=html.match(/<div class="habitat-heading">([\s\S]*?)<\/div>/)?.[1];
 const [sprite]=rim?.match(/<img\b[^>]*\bsrc="\.\/studio-(?:heim|bobby)-idle\.png"[^>]*>/)??[];
 assert.ok(sprite,'one studio cat belongs on the habitat rim, outside the interactive field');
 const fields=html.match(/<canvas id="fireflies"[^>]*>[\s\S]*?<\/canvas>/)?.[0];
 assert.ok(fields);
 assert.equal(html.split(sprite).length,2,'do not duplicate the rim illustration in the evidence or canvas');
 assert.match(sprite,/\bclass="[^"]*\bhabitat-cat\b/);
 assert.match(sprite,/\balt=""/);
 assert.match(sprite,/\baria-hidden="true"/);
 assert.doesNotMatch(sprite,/\btabindex=/i);
 const css=await readFile(new URL('firefly.css',root),'utf8');
 const style=css.match(/\.habitat-cat\s*\{([^}]*)\}/)?.[1]??'';
 assert.match(style,/\bposition\s*:\s*absolute\b/,'the observer does not resize the active field');
 assert.match(style,/\bpointer-events\s*:\s*none\b/,'the observer does not intercept taps');
});
