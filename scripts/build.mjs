import {mkdir,readdir,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const FILES=['navigation.css','navigation.mjs','index.html','style.css','app.mjs','core.mjs','data.mjs','pathfinding.html','pathfinding.css','pathfinding.mjs','pathfinding-core.mjs','sand.html','sand.css','sand.mjs','sand-core.mjs','firefly.html','firefly.css','firefly.mjs','firefly-core.mjs','evolution.html','evolution.css','evolution.mjs','evolution-core.mjs','neural.html','neural.css','neural.mjs','neural-core.mjs','mining.html','mining.css','mining.mjs','mining-core.mjs','pixel.html','pixel.css','pixel.mjs','pixel-core.mjs'];
FILES.push('local-drafts.mjs','evolution-birth.mjs');
FILES.push('pixel-recipient.mjs','pixel-recipient-ui.mjs','pixel-recipient.css');
FILES.push('neural-lesson.mjs','neural-lesson-ui.mjs','neural-lesson.css');
FILES.push('neural-step.mjs','neural-step-view.mjs');
FILES.push('feedback-story.mjs','feedback-story-ui.mjs','feedback-story.css');
FILES.push('seat-lesson.mjs','seat-lesson-ui.mjs','seat-lesson.css');
FILES.push('sand-lesson.mjs','sand-lesson-ui.mjs');
FILES.push('mining-shared-evidence.mjs','mining-shared-ui.mjs');
FILES.push('world-model.html','world-model.css','world-model.mjs','world-model-core.mjs','world-model-environment.mjs','world-model-session.mjs','world-model-lesson.mjs');
FILES.push('rsi.html','rsi.css','rsi.mjs','rsi-core.mjs','rsi-session.mjs');
export async function build(root=ROOT,out=join(root,'dist')){
 await mkdir(out,{recursive:true});
 if(await realpath(root)===await realpath(out))throw Error('Build output must differ from source');
 for(const name of await readdir(out)){
  if(!FILES.includes(name))throw Error(`unexpected output file: ${name}`);
  if(!(await lstat(join(out,name))).isFile())throw Error(`Output must be a regular file: ${name}`);
 }
 const contents=await Promise.all(FILES.map(async name=>{
  if(!(await lstat(join(root,name))).isFile())throw Error(`Source must be a regular file: ${name}`);
  return readFile(join(root,name));
 }));
 await Promise.all(FILES.map((name,i)=>writeFile(join(out,name),contents[i])));
 return [...FILES];
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(`Built ${(await build()).length} runtime files → dist/`);
