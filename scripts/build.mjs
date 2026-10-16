import {mkdir,readdir,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const FILES=['index.html','style.css','app.mjs','core.mjs','data.mjs','pathfinding.html','pathfinding.css','pathfinding.mjs','pathfinding-core.mjs','sand.html','sand.css','sand.mjs','sand-core.mjs','firefly.html','firefly.css','firefly.mjs','firefly-core.mjs','evolution.html','evolution.css','evolution.mjs','evolution-core.mjs','neural.html','neural.css','neural.mjs','neural-core.mjs','mining.html','mining.css','mining.mjs','mining-core.mjs'];
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
