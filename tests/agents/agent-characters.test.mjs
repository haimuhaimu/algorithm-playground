import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const load=name=>readFile(new URL('../../dist/'+name,import.meta.url),'utf8');

test('Bobby is at the 07 signing desk before a receipt is known, not in the delivered-only parcel',async()=>{
 const html=await load('agent-mission.html');
 const scene=html.match(/<figure\b[^>]*id="mission-scene"[^>]*>[\s\S]*?<\/figure>/)?.[0]??'';
 assert.match(scene,/data-receipt="unknown"/);
 assert.match(scene,/<figcaption>[\s\S]*?07 号站 · 波比的签收台/);
 const clerk=scene.match(/<g class="scene-signing-desk">([\s\S]*?)<\/g>/)?.[1]??'';
 assert.match(clerk,/<image\b[^>]*href="\.\/studio-bobby-portrait\.png"/);
 const delivered=scene.match(/<g class="scene-confirmed">([\s\S]*?)<\/g>/)?.[1]??'';
 assert.match(delivered,/<use href="#supply-box"/);
 assert.doesNotMatch(delivered,/studio-bobby/);
 const css=await load('agent-mission.css');
 assert.match(css,/\.scene-confirmed\s*\{[^}]*visibility:\s*hidden/);
 assert.match(css,/\.mission-scene\[data-receipt=delivered\] \.scene-confirmed\s*\{[^}]*visibility:\s*visible/);
});

test('Chouchou is identified as the subtitle sender outside the changing caption and receipt fields',async()=>{
 const html=await load('agent-reroute.html');
 const transcript=html.match(/<div class="reroute-transcript">([\s\S]*?)<\/div>/)?.[1]??'';
 const label=transcript.match(/<span class="reroute-transcript-label">([\s\S]*?)<\/span>/)?.[1]??'';
 assert.match(label,/<img\b[^>]*src="\.\/studio-chouchou-portrait\.png"/);
 assert.match(label,/用户字幕 · 臭臭/);
 assert.match(transcript,/<p id="reroute-caption" aria-live="polite">「先送到 07 号站。」<\/p>/);
 assert.equal([...html.matchAll(/studio-chouchou-portrait\.png/g)].length,1);
});
