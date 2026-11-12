import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, posix, relative, sep } from 'node:path';
import { parse } from 'es-module-lexer/minimal/js';
import { RUNTIME_FILES } from './runtime-files.mjs';

/** Relocate module specifiers only; keep comments, strings and algorithm code intact. */
export function publishModule(source, sourcePath, files = RUNTIME_FILES) {
  const publicPaths = new Map(Object.entries(files).map(([name, path]) => [path, name]));
  const [imports] = parse(source);
  let result = source;
  // Replace right-to-left so parser offsets remain valid after each replacement.
  for (const item of imports.toReversed()) {
    if (!item.n || !/^\.\.?\//.test(item.n)) {
      throw new Error(`Unsupported module reference in ${sourcePath}`);
    }
    const end = item.n.search(/[?#]/);
    const path = end < 0 ? item.n : item.n.slice(0, end);
    const suffix = end < 0 ? '' : item.n.slice(end);
    const target = posix.normalize(posix.join(posix.dirname(sourcePath), path));
    const name = publicPaths.get(target);
    if (!name) throw new Error(`Unlisted module ${item.n} in ${sourcePath}`);
    const specifier = `./${name}${suffix}`;
    // Static offsets exclude quotes; dynamic literal offsets include them.
    const replacement = item.d < 0 ? specifier : JSON.stringify(specifier);
    result = result.slice(0, item.s) + replacement + result.slice(item.e);
  }
  return result;
}

/** Never follow a source file or parent-directory symlink outside the selected root. */
export async function readContainedFile(root, path) {
  const directory = await realpath(root);
  const requested = join(directory, path);
  if (!(await lstat(requested)).isFile()) throw new Error(`Source must be a regular file: ${path}`);
  const target = await realpath(requested);
  const child = relative(directory, target);
  if (child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error(`Source outside root: ${path}`);
  }
  return readFile(target);
}

/** Source mode uses the explicit mapping; built mode serves only the same flat allowlist. */
export async function readRuntimeFile(root, publicName, { built = false } = {}) {
  if (!Object.hasOwn(RUNTIME_FILES, publicName)) throw new Error(`Not a public asset: ${publicName}`);
  const sourcePath = built ? publicName : RUNTIME_FILES[publicName];
  const bytes = await readContainedFile(root, sourcePath);
  return !built && publicName.endsWith('.mjs')
    ? Buffer.from(publishModule(bytes.toString('utf8'), sourcePath))
    : bytes;
}
