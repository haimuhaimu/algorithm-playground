/** A non-modal directory: real links still work if JavaScript is unavailable. */
export function initNavigation(nav, media) {
 const button=nav.querySelector('.experiment-toggle');
 const links=nav.querySelector('.experiment-links');
 const current=nav.querySelector('[aria-current="page"]');
 if(!button||!links||!current)return;
 nav.querySelector('.experiment-current').textContent=current.textContent.trim();
 let open=false;
 function render() {
  button.hidden=!media.matches;
  links.hidden=media.matches&&!open;
  button.setAttribute('aria-expanded',String(media.matches&&open));
 }
 button.addEventListener('click',()=>{open=!open;render();});
 nav.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&media.matches&&open){
   event.preventDefault();open=false;render();button.focus();
  }
 });
 nav.addEventListener('focusout',event=>{
  if(media.matches&&open&&!nav.contains(event.relatedTarget)){open=false;render();}
 });
 media.addEventListener('change',()=>{open=false;render();});
 render();
}
if(typeof document!=='undefined'){
 for(const nav of document.querySelectorAll('.experiment-nav')){
  initNavigation(nav,matchMedia('(max-width: 760px)'));
 }
}
