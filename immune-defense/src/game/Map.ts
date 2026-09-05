import { Position, GRID_WIDTH, GRID_HEIGHT, TILE_SIZE } from './constants';

export class GameMap {
  grid: number[][]; // 0: empty, 1: path, 2: occupied by cell
  path: Position[];
  waypoints: Position[];

  constructor() {
    this.grid = Array(GRID_HEIGHT).fill(0).map(() => Array(GRID_WIDTH).fill(0));
    this.path = [];
    this.waypoints = [];
    this.generateMap();
  }

  generateMap() {
    // 20×12 用のS字経路。全長39マス。
    // 以前は69マスあり、1体が渡り切るのに55秒かかっていた。
    // 序盤はほとんど何も起きない時間になっていたので、経路自体を短くした。
    this.waypoints = [
      { x: 0, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 9 },
      { x: 10, y: 9 },
      { x: 10, y: 3 },
      { x: 15, y: 3 },
      { x: 15, y: 10 },
      { x: 19, y: 10 }
    ];

    // Build path connecting waypoints
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const p1 = this.waypoints[i];
      const p2 = this.waypoints[i + 1];
      
      let x = p1.x;
      let y = p1.y;

      this.grid[y][x] = 1;
      this.path.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2 });

      while (x !== p2.x || y !== p2.y) {
        if (x < p2.x) x++;
        else if (x > p2.x) x--;
        else if (y < p2.y) y++;
        else if (y > p2.y) y--;
        
        this.grid[y][x] = 1;
        this.path.push({ x: x * TILE_SIZE + TILE_SIZE/2, y: y * TILE_SIZE + TILE_SIZE/2 });
      }
    }
  }

  isBuildable(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
    return this.grid[y][x] === 0;
  }

  placeCell(x: number, y: number) {
    if (this.isBuildable(x, y)) {
      this.grid[y][x] = 2;
      return true;
    }
    return false;
  }
}
