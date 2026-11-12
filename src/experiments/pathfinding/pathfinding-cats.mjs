
import { search } from './pathfinding-core.mjs';

export const CAT_ROUTE_SCENE = Object.freeze({
  cols: 9,
  rows: 7,
  goal: 35,
  suggested: 31,
  cats: Object.freeze([
    Object.freeze({ id: 'heim', name: '嘿姆', start: 10 }),
    Object.freeze({ id: 'bobby', name: '波比', start: 28 }),
    Object.freeze({ id: 'chouchou', name: '臭臭', start: 46 }),
  ]),
  walls: Object.freeze([4, 22, 31, 40, 58]),
});

function routeSnapshot(walls, reveal = true) {
  const { cols, rows, goal, cats } = CAT_ROUTE_SCENE;
  const routes = reveal ? cats.map(({ id, start }) => {
    const { path, distance } = search({ cols, rows, start, goal, walls }, 'astar');
    return { id, path, distance };
  }) : null;
  return { walls, routes };
}

export function compareCatRoutes(index = null, { reveal = true } = {}) {
  const { cols, rows, goal, cats, walls } = CAT_ROUTE_SCENE;
  const editable = Number.isInteger(index) && index >= 0 && index < cols * rows &&
    index !== goal && !cats.some(({ start }) => start === index);
  const change = editable ? { index, kind: walls.includes(index) ? 'removed' : 'added' } : null;
  const afterWalls = !change ? [...walls] : change.kind === 'removed'
    ? walls.filter(wall => wall !== index)
    : [...walls, index].sort((a, b) => a - b);

  return {
    change,
    before: routeSnapshot([...walls]),
    after: routeSnapshot(afterWalls, reveal),
  };
}
