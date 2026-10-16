import test from 'node:test';
import assert from 'node:assert/strict';

async function boot(mobile=true) {
 const {initNavigation}=await import('../navigation.mjs');
 class Node extends EventTarget {
  constructor(){super();this.hidden=false;this.dataset={};this.attrs={};this.focused=false;}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k];}
  focus(){this.focused=true;}
 }
 const nav=new Node(),button=new Node(),links=new Node(),label=new Node(),current=new Node();
 current.textContent='08 像素邮局';button.hidden=true;
 const nodes={'.experiment-toggle':button,'.experiment-links':links,'.experiment-current':label,'[aria-current="page"]':current};
 nav.querySelector=s=>nodes[s];nav.contains=n=>Object.values(nodes).includes(n)||n===nav;
 const media=Object.assign(new EventTarget(),{matches:mobile});
 initNavigation(nav,media);
 return {nav,button,links,label,media,click:()=>button.dispatchEvent(new Event('click')),
  key:key=>nav.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key})),
  resize:mobile=>{media.matches=mobile;media.dispatchEvent(new Event('change'));}};
}
test('mobile navigation names the current experiment and opens a complete link directory',async()=>{
 const u=await boot();assert.equal(u.label.textContent,'08 像素邮局');
 assert.equal(u.button.hidden,false);assert.equal(u.links.hidden,true);assert.equal(u.button.getAttribute('aria-expanded'),'false');
 u.click();assert.equal(u.links.hidden,false);assert.equal(u.button.getAttribute('aria-expanded'),'true');
 u.click();assert.equal(u.links.hidden,true);
});
test('Escape closes the mobile directory and returns focus to its trigger',async()=>{
 const u=await boot();u.click();u.key('Escape');
 assert.equal(u.links.hidden,true);assert.equal(u.button.focused,true);
});
test('desktop keeps all links visible and breakpoint changes cannot strand a hidden directory',async()=>{
 const u=await boot(false);assert.equal(u.links.hidden,false);assert.equal(u.button.hidden,true);
 u.resize(true);assert.equal(u.links.hidden,true);u.click();
 u.resize(false);assert.equal(u.links.hidden,false);assert.equal(u.button.hidden,true);
 u.resize(true);assert.equal(u.links.hidden,true);assert.equal(u.button.getAttribute('aria-expanded'),'false');
});
test('leaving the mobile navigation closes it without stealing focus',async()=>{
 const u=await boot();u.click();
 u.nav.dispatchEvent(Object.assign(new Event('focusout'),{relatedTarget:u.links}));assert.equal(u.links.hidden,false);
 u.nav.dispatchEvent(Object.assign(new Event('focusout'),{relatedTarget:{}}));assert.equal(u.links.hidden,true);assert.equal(u.button.focused,false);
});
