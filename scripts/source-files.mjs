import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Enumerate only the requested source tree; never follow symlink directories. */
export async function filesIn(directory, suffix) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path, suffix));
    else if (entry.isFile() && entry.name.endsWith(suffix)) files.push(path);
  }
  return files.sort();
}
