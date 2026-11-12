import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const pages=['recommendation','neural','mining','pathfinding','firefly','pixel','sand','evolution','world-model','rsi','distributions'];
for(const page of pages)test(`${page} has a non-scripted, touch-sized exit back to the learning routes`,async()=>{
 const html=await readFile(new URL(`../../dist/${page}.html`,import.meta.url),'utf8');
 assert.match(html,/<p class="learning-route-exit"><a(?: data-learning-return)? href="\.\/#learning-routes">← 回到学习路线[^<]*<\/a><\/p>\s*<\/main>/);
 assert.match(html,/navigation\.css\?v=/);
});
test('the shared learning exit remains a real link with a visible keyboard focus and a 44px target',async()=>{
 const css=await readFile(new URL('../../dist/navigation.css',import.meta.url),'utf8');
 assert.match(css,/\.learning-route-exit a\s*\{[^}]*min-height:44px/);
 assert.match(css,/\.learning-route-exit a:focus-visible\s*\{[^}]*outline:/);
});
test('the in-progress full-experiment exit has a 44px touch target too',async()=>{
 const css=await readFile(new URL('../../dist/learning-route.css',import.meta.url),'utf8');
 assert.match(css,/\.route-free a[^}]*\{[^}]*min-height:44px/);
});
