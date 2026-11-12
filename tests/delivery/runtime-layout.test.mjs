import test from 'node:test';
import assert from 'node:assert/strict';

const delivery = await import('../../scripts/runtime-content.mjs').catch(() => ({}));
const files = {
  'home.mjs': 'src/home/home.mjs',
  'core.mjs': 'src/experiments/recommendation/core.mjs',
  'navigation.mjs': 'src/shared/navigation.mjs',
};

test('nested source imports retain their existing public URL and version suffix', () => {
  assert.equal(typeof delivery.publishModule, 'function', 'delivery needs a source-to-public module resolver');
  const source = "import { rank } from '../experiments/recommendation/core.mjs?v=one&entry=cat#part';\n";
  assert.equal(delivery.publishModule(source, files['home.mjs'], files),
    "import { rank } from './core.mjs?v=one&entry=cat#part';\n");
});

test('module relocation handles re-exports and literal dynamic imports without rewriting comments or prose', () => {
  assert.equal(typeof delivery.publishModule, 'function');
  const source = [
    "// import x from '../shared/navigation.mjs'",
    "const prose = \"from '../shared/navigation.mjs'\";",
    "export { mount } from '../shared/navigation.mjs';",
    "const later = import('../shared/navigation.mjs?v=2');",
  ].join('\n');
  assert.equal(delivery.publishModule(source, files['home.mjs'], files), [
    "// import x from '../shared/navigation.mjs'",
    "const prose = \"from '../shared/navigation.mjs'\";",
    "export { mount } from './navigation.mjs';",
    'const later = import("./navigation.mjs?v=2");',
  ].join('\n'));
});

test('unlisted modules and runtime-relative expressions fail closed instead of producing broken public imports', () => {
  assert.equal(typeof delivery.publishModule, 'function');
  for (const source of [
    "import '../private.mjs';", "import 'unlisted-package';", 'import(somePath);', 'console.log(import.meta.url);',
  ]) assert.throws(() => delivery.publishModule(source, files['home.mjs'], files), /Unsupported|Unlisted/);
});
