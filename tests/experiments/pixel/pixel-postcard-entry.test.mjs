import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('the two studio postcard selectors are real buttons and the drawing canvas is not overlaid',async()=>{
 const html=await readFile(new URL('../../../dist/pixel.html',import.meta.url),'utf8');
 assert.match(html,/<button id="preset-heim">嘿姆<\/button>/);
 assert.match(html,/<button id="preset-bobby">波比<\/button>/);
 assert.match(html,/<div class="paper-frame">\s*<canvas id="editor" width="512" height="512" tabindex="0" role="application"/);
 assert.doesNotMatch(html,/studio-(?:heim|bobby|chouchou)-idle\.png/);
});
