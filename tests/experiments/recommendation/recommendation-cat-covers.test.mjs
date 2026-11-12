import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {POSTS,PRESETS,INITIAL_PROFILE} from '../../../dist/data.mjs';
import {traceRanking,scorePost} from '../../../dist/core.mjs';
import {renderRecommendationCard} from '../../../dist/recommendation-cards.mjs';

const load=name=>readFile(new URL('../../../dist/'+name,import.meta.url));
const render=(post,index=0)=>renderRecommendationCard({
 ...post,...scorePost(post,PRESETS.click.weights,INITIAL_PROFILE,{}),
},index,INITIAL_PROFILE);

test('each existing topic renders exactly two studio covers, leaving other cards on category art',async()=>{
 const expected={
  cat:['0-0','0-1'],food:['1-0','1-4'],travel:['2-0','2-4'],
  tech:['3-0','3-4'],sport:['4-0','4-4'],craft:['5-0','5-4'],
 };
 for(const [topic,ids] of Object.entries(expected)){
  const posts=POSTS.filter(post=>post.topic===topic);
  const covers=posts.map(post=>[post.id,render(post).match(/<img[^>]+src="(\.\/studio-[^"]+\.png)"/)?.[1]]);
  assert.deepEqual(covers.filter(([,image])=>image).map(([id])=>id),ids);
  for(const [,image] of covers.filter(([,image])=>image)){
   assert.deepEqual([...(await load(image)).subarray(0,8)],[137,80,78,71,13,10,26,10]);
  }
 }
});

test('the two original cat posts keep their approved portrait art and titles',()=>{
 for(const [id,title,image] of [
  ['0-0','它以为自己藏得很好','./studio-bobby-portrait.png'],
  ['0-1','猫：这个家没我得散','./studio-heim-portrait.png'],
 ]){
  const card=render(POSTS.find(post=>post.id===id));
  assert.ok(card.includes(`src="${image}"`));
  assert.ok(card.includes(`<h3 title="${title}">${title}</h3>`));
 }
});

test('the feed displays the new title and art without replacing creator or newcomer identity',()=>{
 const card=render(POSTS.find(post=>post.id==='1-4'));
 assert.match(card,/data-id="1-4"/);
 assert.match(card,/波比试吃外婆的豆腐/);
 assert.match(card,/src="\.\/studio-bobby-idle\.png"/);
 assert.match(card,/GOOD FOOD/);
 assert.match(card,/豆腐小记 · 新作者/);
 assert.match(card,/data-feedback="1" data-post="1-4" aria-label="喜欢：波比试吃外婆的豆腐"/);
});

test('the visible cover credit names the illustrated cat, not the creator or topic',()=>{
 for(const [id,cat] of [['0-0','波比'],['0-1','嘿姆'],['2-0','臭臭']]){
  const card=render(POSTS.find(post=>post.id===id));
  assert.match(card,new RegExp(`<span class="post-cast">出镜：${cat}</span>`));
  assert.match(card,/<div class="creator">/);
 }
 assert.doesNotMatch(render(POSTS.find(post=>post.id==='0-2')),/class="post-cast"/);
});

test('visual remapping leaves the original candidate data and preset order intact',()=>{
 // Baseline of the original 48 candidate records, including numeric inputs and creator identities.
 assert.equal(createHash('sha256').update(JSON.stringify(POSTS)).digest('hex'),
  '7f237be1e65443f72ac3c9660e645d08662643718fe45bf0ba164865d04bc31c');
 const expected={
  click:['0-0','0-1','0-2','0-3','1-0','0-4'],
  balanced:['0-0','1-0','2-0','3-0','0-4','4-0'],
  newcomer:['0-4','1-4','2-4','0-5','3-4','4-4'],
 };
 for(const [preset,ids] of Object.entries(expected)){
  assert.deepEqual(traceRanking(POSTS,PRESETS[preset].weights,INITIAL_PROFILE).feed.map(post=>post.id),ids);
 }
});
