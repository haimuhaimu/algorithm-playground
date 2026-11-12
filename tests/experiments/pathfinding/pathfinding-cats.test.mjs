import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT_ROUTE_SCENE, compareCatRoutes } from '../../../dist/pathfinding-cats.mjs';

test('without a selected cell, all three cats get their original shortest routes', () => {
  const { change, before, after } = compareCatRoutes();
  assert.equal(change, null);
  assert.deepEqual(before.walls, [4, 22, 31, 40, 58]);
  assert.deepEqual(before.routes.map(({ id, distance }) => [id, distance]), [
    ['heim', 9],
    ['bobby', 11],
    ['chouchou', 9],
  ]);
  assert.deepEqual(after, before);
});

test('removing the suggested wall saves only Bobby four steps', () => {
  const { suggested } = CAT_ROUTE_SCENE;
  const { change, before, after } = compareCatRoutes(suggested);
  assert.deepEqual(change, { index: 31, kind: 'removed' });
  assert.deepEqual(before.walls, [4, 22, 31, 40, 58]);
  assert.deepEqual(after.walls, [4, 22, 40, 58]);
  assert.deepEqual(after.routes.map(({ distance }) => distance), [9, 7, 9]);
  assert.ok(after.routes[1].path.includes(31));
});

test('adding a wall at the top gap makes Heim detour without carrying over a previous edit', () => {
  compareCatRoutes(31);
  const { change, before, after } = compareCatRoutes(13);
  assert.deepEqual(change, { index: 13, kind: 'added' });
  assert.deepEqual(before.walls, [4, 22, 31, 40, 58]);
  assert.deepEqual(after.walls, [4, 13, 22, 31, 40, 58]);
  assert.deepEqual(after.routes.map(({ distance }) => distance), [13, 11, 9]);
  assert.ok(after.routes[0].path.includes(49));
});

test('out-of-bounds, fractional, string and protected indices leave the original untouched', () => {
  const original = compareCatRoutes();
  for (const index of [-1, 63, 2.5, '31', NaN, Infinity, 10, 28, 46, 35]) {
    assert.deepEqual(compareCatRoutes(index), original, `unexpected edit at ${index}`);
  }
});

test('changing a returned snapshot cannot modify the scene or later comparisons', () => {
  const { cats, walls } = CAT_ROUTE_SCENE;
  assert.throws(() => { cats[0].start = 31; }, TypeError);
  assert.throws(() => { walls.pop(); }, TypeError);
  const result = compareCatRoutes(31);
  result.before.walls.pop();
  result.after.routes[1].path.length = 0;
  const next = compareCatRoutes(31);
  assert.deepEqual(next.before.walls, [4, 22, 31, 40, 58]);
  assert.equal(next.after.routes[1].path.length, 8);
});

test('a staged one-cell edit has a real changed map but does not disclose its route results', () => {
  const pending = compareCatRoutes(31, { reveal: false });
  assert.deepEqual(pending.change, { index: 31, kind: 'removed' });
  assert.deepEqual(pending.after.walls, [4, 22, 40, 58]);
  assert.equal(pending.after.routes, null, 'no route, distance or winner before the player tests the edit');
  assert.deepEqual(pending.before.routes.map(route => route.distance), [9, 11, 9]);
  assert.equal(compareCatRoutes(null, { reveal: false }).after.routes, null);
  assert.equal(compareCatRoutes(28, { reveal: false }).change, null, 'cat starts remain protected');
  const revealed = compareCatRoutes(31);
  assert.deepEqual(revealed.after.routes.map(route => route.distance), [9, 7, 9]);
  assert.equal(pending.after.routes, null, 'revealing a new snapshot cannot rewrite the pending one');
});

// An independent, goal-outward BFS gives the exact distance at every start.
// Deliberately do not call the A* engine or reuse its neighbor/route helpers.
function distancesFromGoal(cols, rows, goal, walls) {
  const distances = Array(cols * rows).fill(null);
  const queue = [goal];
  const blocked = new Set(walls);
  distances[goal] = 0;
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    const row = Math.floor(at / cols);
    const col = at % cols;
    for (const [y, x] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
      if (y < 0 || y >= rows || x < 0 || x >= cols) continue;
      const next = y * cols + x;
      if (blocked.has(next) || distances[next] !== null) continue;
      distances[next] = distances[at] + 1;
      queue.push(next);
    }
  }
  return distances;
}

test('every editable cell produces exactly one wall change and valid shortest routes', () => {
  const { cols, rows, goal, cats, walls } = CAT_ROUTE_SCENE;
  const protectedCells = [goal, ...cats.map(({ start }) => start)];
  for (let index = 0; index < cols * rows; index++) {
    if (protectedCells.includes(index)) continue;
    const { before, after } = compareCatRoutes(index);
    assert.deepEqual(before.walls, walls);
    const changed = [...walls.filter(wall => !after.walls.includes(wall)),
      ...after.walls.filter(wall => !walls.includes(wall))];
    assert.deepEqual(changed, [index]);
    for (const snapshot of [before, after]) {
      const distances = distancesFromGoal(cols, rows, goal, snapshot.walls);
      for (const [catIndex, { id, path, distance }] of snapshot.routes.entries()) {
        const cat = cats[catIndex];
        assert.equal(id, cat.id);
        assert.equal(distance, distances[cat.start], `incorrect distance at cell ${index} for ${id}`);
        if (distance === null) {
          assert.deepEqual(path, []);
          continue;
        }
        assert.equal(path[0], cat.start);
        assert.equal(path.at(-1), goal);
        assert.equal(path.length, distance + 1);
        for (const [step, cell] of path.entries()) {
          assert.ok(Number.isInteger(cell) && cell >= 0 && cell < cols * rows);
          assert.ok(!snapshot.walls.includes(cell));
          if (!step) continue;
          const previous = path[step - 1];
          assert.equal(Math.abs(Math.floor(cell / cols) - Math.floor(previous / cols)) +
            Math.abs(cell % cols - previous % cols), 1);
        }
      }
    }
  }
});
