import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as source from '../../learning-tool.mjs';
import * as published from '../../dist/learning-tool.mjs';

const actions = values => values.map(action => ({ action }));
const requests = [
  { experimentId: 'learning-route', actions: actions(['train']) },
  { experimentId: 'pixel-decode', preset: 'bobby', actions: [{ action: 'read', value: 528 }] },
  { experimentId: 'bayes-update', actions: [] },
  { experimentId: 'agent-tool-loop', actions: actions(['stop', 'restart', 'retry', 'check']) },
  { experimentId: 'agent-reroute', actions: actions(['advance', 'advance', 'reroute', 'advance', 'verify-new']) },
  { experimentId: 'agent-frames', actions: actions([
    ...Array(8).fill('advance'), 'start-manual', ...Array(5).fill('advance'), 'pin', ...Array(3).fill('advance'),
  ]) },
];

test('the stable source entry and deployed API produce mutually replayable receipts for every executable lesson', () => {
  assert.deepEqual(source.listLearningTools(), published.listLearningTools());
  for (const request of requests) {
    const receipt = source.runLearningTool(request);
    const release = published.runLearningTool(request);
    assert.deepEqual(receipt, release, request.experimentId);
    assert.equal(published.replayLearningReceipt(receipt).matches, true);
    assert.equal(source.replayLearningReceipt(release).matches, true);
  }
  const frames = source.runLearningTool(requests.at(-1)).result.evidence;
  assert.deepEqual(frames.fixed.frameIds, [0, 4, 8]);
  assert.deepEqual(frames.manual.frameIds, [0, 5, 8]);
});

test('CLI source discovery works from another working directory without relying on a dist import', () => {
  const cli = new URL('../../scripts/learning-tool.mjs', import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(cli), 'list'], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout);
  assert.equal(data.ok, true);
  assert.equal(data.data.experiments.length, 10);
  assert.deepEqual(data.data.runnables.map(tool => tool.id), requests.map(request => request.experimentId));
});
