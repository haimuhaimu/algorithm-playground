import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { filesIn } from './source-files.mjs';

const root = new URL('../', import.meta.url);
const files = [fileURLToPath(new URL('learning-tool.mjs', root))];
for (const directory of ['src', 'scripts', 'tests']) {
  files.push(...await filesIn(fileURLToPath(new URL(directory, root)), '.mjs'));
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`Syntax checked ${files.length} source, script and test modules.`);
