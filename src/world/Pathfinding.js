// Simple binary-heap-free A* over the Grid (grid sizes here are small enough
// that an array-scan open set is fast and simple). Used both to validate tower
// placement (must never seal a lane) and to build the waypoint list enemies follow.

const DIRS = [
  { dc: 1, dr: 0, cost: 1 }, { dc: -1, dr: 0, cost: 1 },
  { dc: 0, dr: 1, cost: 1 }, { dc: 0, dr: -1, cost: 1 },
  { dc: 1, dr: 1, cost: Math.SQRT2 }, { dc: -1, dr: 1, cost: Math.SQRT2 },
  { dc: 1, dr: -1, cost: Math.SQRT2 }, { dc: -1, dr: -1, cost: Math.SQRT2 }
];

function heuristic(a, b) {
  return Math.hypot(a.col - b.col, a.row - b.row);
}

export function findPath(grid, start, goal) {
  const key = (c, r) => `${c},${r}`;
  const open = new Map();
  const gScore = new Map();
  const fScore = new Map();
  const cameFrom = new Map();

  const startKey = key(start.col, start.row);
  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(start, goal));
  open.set(startKey, { ...start });

  while (open.size > 0) {
    let currentKey = null;
    let currentF = Infinity;
    for (const [k, node] of open) {
      const f = fScore.get(k) ?? Infinity;
      if (f < currentF) { currentF = f; currentKey = k; }
    }
    if (currentKey === null) break;
    const current = open.get(currentKey);
    open.delete(currentKey);

    if (current.col === goal.col && current.row === goal.row) {
      return reconstruct(cameFrom, currentKey, grid);
    }

    for (const dir of DIRS) {
      const nCol = current.col + dir.dc;
      const nRow = current.row + dir.dr;
      if (!grid.inBounds(nCol, nRow)) continue;
      if (grid.isBlocked(nCol, nRow) && !(nCol === goal.col && nRow === goal.row)) continue;
      // prevent diagonal cutting through two blocked corners
      if (dir.dc !== 0 && dir.dr !== 0) {
        if (grid.isBlocked(current.col + dir.dc, current.row) || grid.isBlocked(current.col, current.row + dir.dr)) continue;
      }
      const nKey = key(nCol, nRow);
      const tentativeG = (gScore.get(currentKey) ?? Infinity) + dir.cost;
      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        cameFrom.set(nKey, currentKey);
        gScore.set(nKey, tentativeG);
        fScore.set(nKey, tentativeG + heuristic({ col: nCol, row: nRow }, goal));
        if (!open.has(nKey)) open.set(nKey, { col: nCol, row: nRow });
      }
    }
  }
  return null; // no path found
}

function reconstruct(cameFrom, currentKey, grid) {
  const path = [currentKey];
  while (cameFrom.has(currentKey)) {
    currentKey = cameFrom.get(currentKey);
    path.push(currentKey);
  }
  path.reverse();
  return path.map((k) => {
    const [col, row] = k.split(',').map(Number);
    return { col, row, ...grid.cellToWorld(col, row) };
  });
}

// Checks that every given start still reaches the goal — used to reject a
// tower placement that would seal off a lane completely.
export function allLanesReachable(grid, starts, goal) {
  return starts.every((s) => findPath(grid, s, goal) !== null);
}
