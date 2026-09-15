// Grid-based world representation used for buildable-area checks and pathfinding.
export const CELL_SIZE = 2;

export class Grid {
  constructor(size) {
    this.size = size; // number of cells per side
    this.cells = new Array(size * size).fill(0); // 0 = open, 1 = static obstacle, 2 = tower
    this.half = size / 2;
  }

  index(col, row) { return row * this.size + col; }

  inBounds(col, row) { return col >= 0 && col < this.size && row >= 0 && row < this.size; }

  get(col, row) { return this.inBounds(col, row) ? this.cells[this.index(col, row)] : 1; }
  set(col, row, val) { if (this.inBounds(col, row)) this.cells[this.index(col, row)] = val; }

  isBlocked(col, row) { return this.get(col, row) !== 0; }

  worldToCell(x, z) {
    return {
      col: Math.floor(x / CELL_SIZE + this.half),
      row: Math.floor(z / CELL_SIZE + this.half)
    };
  }

  cellToWorld(col, row) {
    return {
      x: (col - this.half + 0.5) * CELL_SIZE,
      z: (row - this.half + 0.5) * CELL_SIZE
    };
  }
}
