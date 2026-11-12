import { lstat, mkdir, readdir, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, RUNTIME_FILES } from './runtime-files.mjs';
import { readRuntimeFile } from './runtime-content.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Build a flat, backwards-compatible site from feature-organized sources. */
export async function build(root = ROOT, out = join(root, 'dist')) {
  await mkdir(out, { recursive: true });
  const sourceRoot = await realpath(root), outputRoot = await realpath(out);
  if (sourceRoot === outputRoot) {
    throw new Error('Build output must differ from source');
  }
  for (const path of Object.values(RUNTIME_FILES)) {
    const source = await realpath(join(sourceRoot, path));
    const child = relative(outputRoot, source);
    if (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)) {
      throw new Error('Build output must not contain source files');
    }
  }
  for (const name of await readdir(out)) {
    if (!PUBLIC_FILES.includes(name)) throw new Error(`unexpected output file: ${name}`);
    if (!(await lstat(join(out, name))).isFile()) {
      throw new Error(`Output must be a regular file: ${name}`);
    }
  }
  // Validate everything before writing; a missing source does not leave a partial migration.
  const contents = await Promise.all(PUBLIC_FILES.map(name => readRuntimeFile(root, name)));
  await Promise.all(PUBLIC_FILES.map((name, index) => writeFile(join(out, name), contents[index])));
  return [...PUBLIC_FILES];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Built ${(await build()).length} runtime files → dist/`);
}
