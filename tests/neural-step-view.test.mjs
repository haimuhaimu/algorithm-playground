import test from 'node:test';
import assert from 'node:assert/strict';
import {paintStep} from '../neural-step-view.mjs';
import {createModel} from '../neural-core.mjs';

test('probability tiles cover the canvas exactly once, with no alpha-overlap grid artifacts',()=>{
 const tiles=[];const context=new Proxy({fillRect(x,y,w,h){if(String(this.fillStyle).startsWith('rgba'))tiles.push({x,y,w,h});}},{get:(o,k)=>o[k]??(()=>{})});
 paintStep({width:560,height:350,getContext:()=>context},createModel(),[],[],null);
 assert.ok(tiles.length>1);
 assert.equal(tiles.reduce((area,r)=>area+r.w*r.h,0),560*350);
 for(const r of tiles){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=560&&r.y+r.h<=350);}
 const firstRow=tiles.filter(r=>r.y===0);assert.equal(firstRow[0].x,0);assert.equal(firstRow.at(-1).x+firstRow.at(-1).w,560);
 for(let i=1;i<firstRow.length;i++)assert.equal(firstRow[i-1].x+firstRow[i-1].w,firstRow[i].x);
});
