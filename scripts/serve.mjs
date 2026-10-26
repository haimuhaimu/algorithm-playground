import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const TYPES={'navigation.css':'text/css; charset=utf-8','navigation.mjs':'text/javascript; charset=utf-8','index.html':'text/html; charset=utf-8','style.css':'text/css; charset=utf-8','app.mjs':'text/javascript; charset=utf-8','core.mjs':'text/javascript; charset=utf-8','data.mjs':'text/javascript; charset=utf-8'};
Object.assign(TYPES,{'pathfinding.html':'text/html; charset=utf-8','pathfinding.css':'text/css; charset=utf-8','pathfinding.mjs':'text/javascript; charset=utf-8','pathfinding-core.mjs':'text/javascript; charset=utf-8'});
Object.assign(TYPES,{'sand.html':'text/html; charset=utf-8','sand.css':'text/css; charset=utf-8','sand.mjs':'text/javascript; charset=utf-8','sand-core.mjs':'text/javascript; charset=utf-8'});
Object.assign(TYPES,{'firefly.html':'text/html; charset=utf-8','firefly.css':'text/css; charset=utf-8','firefly.mjs':'text/javascript; charset=utf-8','firefly-core.mjs':'text/javascript; charset=utf-8'});
Object.assign(TYPES,{'evolution.html':'text/html; charset=utf-8','evolution.css':'text/css; charset=utf-8','evolution.mjs':'text/javascript; charset=utf-8','evolution-core.mjs':'text/javascript; charset=utf-8'});
Object.assign(TYPES,{'neural.html':'text/html; charset=utf-8','neural.css':'text/css; charset=utf-8','neural.mjs':'text/javascript; charset=utf-8','neural-core.mjs':'text/javascript; charset=utf-8'});
Object.assign(TYPES,{'mining.html':'text/html; charset=utf-8','mining.css':'text/css; charset=utf-8','mining.mjs':'text/javascript; charset=utf-8','mining-core.mjs':'text/javascript; charset=utf-8'});
Object.assign(TYPES,{'pixel.html':'text/html; charset=utf-8','pixel.css':'text/css; charset=utf-8','pixel.mjs':'text/javascript; charset=utf-8','pixel-core.mjs':'text/javascript; charset=utf-8'});
TYPES['local-drafts.mjs']='text/javascript; charset=utf-8';
TYPES['pixel-recipient.mjs']='text/javascript; charset=utf-8';
TYPES['pixel-recipient-ui.mjs']='text/javascript; charset=utf-8';
TYPES['pixel-recipient.css']='text/css; charset=utf-8';
TYPES['neural-lesson.mjs']='text/javascript; charset=utf-8';
TYPES['neural-lesson-ui.mjs']='text/javascript; charset=utf-8';
TYPES['neural-lesson.css']='text/css; charset=utf-8';
TYPES['neural-step.mjs']='text/javascript; charset=utf-8';
TYPES['neural-step-view.mjs']='text/javascript; charset=utf-8';
TYPES['space-theme.css']='text/css; charset=utf-8';
TYPES['Silkscreen-Regular.ttf']='font/ttf';
TYPES['Silkscreen-OFL.txt']='text/plain; charset=utf-8';
TYPES['feedback-story.mjs']='text/javascript; charset=utf-8';
TYPES['feedback-story-ui.mjs']='text/javascript; charset=utf-8';
TYPES['feedback-story.css']='text/css; charset=utf-8';
TYPES['seat-lesson.mjs']='text/javascript; charset=utf-8';
TYPES['seat-lesson-ui.mjs']='text/javascript; charset=utf-8';
TYPES['seat-lesson.css']='text/css; charset=utf-8';
TYPES['sand-lesson.mjs']='text/javascript; charset=utf-8';
TYPES['sand-lesson-ui.mjs']='text/javascript; charset=utf-8';
TYPES['mining-shared-evidence.mjs']='text/javascript; charset=utf-8';
TYPES['mining-shared-ui.mjs']='text/javascript; charset=utf-8';
TYPES['evolution-birth.mjs']='text/javascript; charset=utf-8';
for(const file of ['world-model','world-model-core','world-model-environment','world-model-session','world-model-lesson'])TYPES[file+'.mjs']='text/javascript; charset=utf-8';
TYPES['world-model.html']='text/html; charset=utf-8';TYPES['world-model.css']='text/css; charset=utf-8';
for(const file of ['rsi','rsi-core','rsi-session'])TYPES[file+'.mjs']='text/javascript; charset=utf-8';
TYPES['rsi.html']='text/html; charset=utf-8';TYPES['rsi.css']='text/css; charset=utf-8';
TYPES['recommendation.html']='text/html; charset=utf-8';
TYPES['home.css']='text/css; charset=utf-8';
for(const name of ['home.mjs','home-core.mjs'])TYPES[name]='text/javascript; charset=utf-8';
for(const name of ['home-preview-sand.jpg','home-preview-neural.jpg','home-preview-recommendation.jpg','home-preview-pathfinding.jpg','home-preview-firefly.jpg','home-preview-evolution.jpg','home-preview-mining.jpg','home-preview-pixel.jpg','home-preview-world-model.jpg','home-preview-rsi.jpg'])TYPES[name]='image/jpeg';
export function createAppServer(root=ROOT){
 const canonicalRoot=realpath(root);
 return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try{
   const path=decodeURIComponent((req.url||'/').split('?')[0]);
   const file=path==='/'?'index.html':path.slice(1);
   if(!path.startsWith('/')||!Object.hasOwn(TYPES,file))throw Error('Not an asset');
   const dir=await canonicalRoot,target=await realpath(join(dir,file));
   if(dirname(target)!==dir)throw Error('Outside root');
   const bytes=await readFile(target);
   res.writeHead(200,{'Content-Type':TYPES[file],'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:'Not found');}
 });
}
export async function startServer({port=3040,root=ROOT}={}){
 const server=createAppServer(root);
 await new Promise((ready,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',ready);});
 return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||3040);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer from 1 to 65535');
 const server=await startServer({port});console.log(`算法游乐场 → http://127.0.0.1:${server.address().port}/`);
}
