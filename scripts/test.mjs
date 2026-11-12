import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { filesIn } from './source-files.mjs';

const directory = fileURLToPath(new URL('../tests', import.meta.url));
const files = await filesIn(directory, '.test.mjs');
if (!files.length) throw new Error('No tests found');
const child = spawn(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
child.on('error', error => { throw error; });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
