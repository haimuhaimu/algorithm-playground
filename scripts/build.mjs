import {mkdir,readdir,readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {episodes} from '../cat-album-episodes.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const FILES=['navigation.css','navigation.mjs','index.html','style.css','app.mjs','core.mjs','data.mjs','pathfinding.html','pathfinding.css','pathfinding.mjs','pathfinding-core.mjs','sand.html','sand.css','sand.mjs','sand-core.mjs','firefly.html','firefly.css','firefly.mjs','firefly-core.mjs','evolution.html','evolution.css','evolution.mjs','evolution-core.mjs','neural.html','neural.css','neural.mjs','neural-core.mjs','mining.html','mining.css','mining.mjs','mining-core.mjs','pixel.html','pixel.css','pixel.mjs','pixel-core.mjs'];
FILES.push('local-drafts.mjs','evolution-birth.mjs');
FILES.push('pathfinding-cats.mjs','pathfinding-cats-ui.mjs','pathfinding-cats.css');
FILES.push('pixel-recipient.mjs','pixel-recipient-ui.mjs','pixel-recipient.css');
FILES.push('pixel-code.mjs','pixel-code-ui.mjs','pixel-code.css');
FILES.push('pixel-delivery.mjs');
FILES.push('pixel-tool.mjs','pixel-tool-ui.mjs');
FILES.push('neural-lesson.mjs','neural-lesson-ui.mjs','neural-lesson.css');
FILES.push('neural-step.mjs','neural-step-view.mjs');
FILES.push('neural-guide.mjs','neural-guide-ui.mjs','neural-guide-view.mjs','neural-guide.css');
FILES.push('neural-cat-lesson.mjs','neural-cat-lesson-ui.mjs','neural-cat-lesson.css',
 'neural-cat-01.jpg','neural-cat-02.jpg','neural-cat-03.jpg','neural-cat-04.jpg',
 'neural-cat-05.jpg','neural-cat-06.jpg','neural-cat-07.jpg','neural-cat-08.jpg');
FILES.push('neural-cat-coach.mjs','neural-cat-coach-ui.mjs');
FILES.push('neural-cat-quick-ui.mjs');
FILES.push('neural-cat-09.jpg','neural-cat-10.jpg','neural-cat-11.jpg','neural-cat-12.jpg',
 'neural-cat-13.jpg','neural-cat-14.jpg','neural-cat-15.jpg','neural-cat-16.jpg',
 'neural-cat-17.jpg','neural-cat-18.jpg','neural-cat-19.jpg','neural-cat-20.jpg');
FILES.push('neural-gradient.mjs','neural-gradient-ui.mjs');
FILES.push('neural-residual-core.mjs','neural-residual.mjs','neural-residual-ui.mjs','neural-residual-view.mjs','neural-residual.css');
FILES.push('neural-generalization.mjs','neural-generalization-ui.mjs','neural-generalization-view.mjs','neural-generalization.css');
FILES.push('space-theme.css','experiment-showcase.css');
FILES.push('learn.html','learning-route.mjs','learning-route-ui.mjs','learning-route.css','learning-route-trials.mjs','learning-route-return.mjs','learning-route-return-ui.mjs');
FILES.push('learning-tool.mjs','learning-tool-manifest.json','AI_USAGE.md');
FILES.push('genai-handoff.mjs','bayes-tool.mjs');
FILES.push('agent-mission.html','agent-mission.css','agent-mission.mjs','agent-tool.mjs');
FILES.push('agent-reroute.html','agent-reroute.css','agent-reroute-ui.mjs','agent-reroute-tool.mjs');
FILES.push('agent-frames.html','agent-frames.css','agent-frames-ui.mjs','agent-frames-tool.mjs');
FILES.push('Silkscreen-Regular.ttf','Silkscreen-OFL.txt');
FILES.push('feedback-story.mjs','feedback-story-ui.mjs','feedback-story.css');
FILES.push('seat-lesson.mjs','seat-lesson-ui.mjs','seat-lesson.css');
FILES.push('recommendation-cards.mjs');
FILES.push('sand-lesson.mjs','sand-lesson-ui.mjs');
FILES.push('mining-shared-evidence.mjs','mining-shared-ui.mjs');
FILES.push('mining-bayes.mjs','mining-bayes-ui.mjs','mining-bayes.css');
FILES.push('distributions.html','distributions.css','distributions.mjs','distributions-core.mjs');
FILES.push('world-model.html','world-model.css','world-model.mjs','world-model-core.mjs','world-model-environment.mjs','world-model-session.mjs','world-model-lesson.mjs');
FILES.push('world-model-planning.mjs');
FILES.push('sand-history.mjs');
FILES.push('sand-bowl.mjs');
FILES.push('firefly-beat.mjs','firefly-beat-ui.mjs','firefly-beat.css');
FILES.push('rsi.html','rsi.css','rsi.mjs','rsi-core.mjs','rsi-session.mjs');
FILES.push('recommendation.html','home.css','home.mjs','home-core.mjs','home-preview-sand.jpg','home-preview-neural.jpg','home-preview-recommendation.jpg','home-preview-pathfinding.jpg','home-preview-firefly.jpg','home-preview-evolution.jpg','home-preview-mining.jpg','home-preview-pixel.jpg','home-preview-world-model.jpg','home-preview-rsi.jpg');
FILES.push('cat-album.css','cat-album.mjs','cat-album-episodes.mjs','cat-album-cover.jpg',...episodes.map(episode=>episode.file));
FILES.push('studio-cat-assets.mjs','studio-brand-cats.png',
 'studio-heim-portrait.png','studio-heim-idle.png','studio-heim-run.png',
 'studio-bobby-portrait.png','studio-bobby-idle.png','studio-bobby-run.png',
 'studio-chouchou-portrait.png','studio-chouchou-idle.png','studio-chouchou-run.png');
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
