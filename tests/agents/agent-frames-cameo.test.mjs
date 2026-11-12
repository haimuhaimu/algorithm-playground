import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const project=new URL('../../dist/',import.meta.url);

test('the monitor cameo stays on the bezel, outside the footage and frame evidence',async()=>{
 const html=await readFile(new URL('agent-frames.html',project),'utf8');
 const sprites=[...html.matchAll(/<img\b[^>]*\bsrc="\.\/studio-heim-idle\.png"[^>]*>/g)];
 assert.equal(sprites.length,1,'exactly one idle Heim sprite belongs on the monitor');
 const [sprite]=sprites[0];
 const bezel=html.match(/<div class="frames-monitor-head">([\s\S]*?)<\/div>/)?.[1];
 assert.ok(bezel?.includes(sprite),'the cameo is part of the bezel, not the footage, captions or replay thumbnails');
 assert.match(bezel,/嘿姆监看台/,'identify the monitor operator without placing him in the footage');
 assert.match(sprite,/\bclass="[^"]*\bframes-monitor-cat\b/,'the sprite must receive its out-of-flow styling');
 assert.match(sprite,/\balt=""/);
 assert.match(sprite,/\baria-hidden="true"/);
 assert.doesNotMatch(sprite,/\btabindex=/i);
 const stylesheet=html.match(/<link rel="stylesheet" href="(\.\/agent-frames\.css[^" ]*)">/)?.[1];
 assert.ok(stylesheet,'the page links its monitor stylesheet');
 const css=await readFile(new URL(stylesheet,project),'utf8');
 const style=css.match(/\.frames-monitor-cat\s*\{([^}]*)\}/)?.[1]??'';
 assert.match(style,/\bposition\s*:\s*absolute\b/,'keep the cat out of the monitor and control layout');
 assert.match(style,/\bpointer-events\s*:\s*none\b/,'the decoration must not intercept interaction');
});
