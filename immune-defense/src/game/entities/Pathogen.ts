import { Position, PathogenType } from '../constants';
import { GameMap } from '../Map';

export class Pathogen {
  id: string;
  type: PathogenType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  reward: number;
  pathIndex: number;
  active: boolean;
  slowTimer: number = 0;
  // 継続ダメージは重ねずに1本だけ持つ。以前は命中のたびに配列へ足していたため、
  // 好酸球1体で常時5重（125dps相当）になり、他のユニットを選ぶ理由が消えていた。
  dot: { dps: number; timer: number } | null = null;

  constructor(type: PathogenType, hp: number, speed: number, reward: number, map: GameMap) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.type = type;
    this.maxHp = hp;
    this.hp = hp;
    this.baseSpeed = speed;
    this.speed = speed;
    this.reward = reward;
    
    this.pathIndex = 0;
    this.x = map.path[0].x;
    this.y = map.path[0].y;
    this.active = true;
  }

  update(dt: number, map: GameMap) {
    if (!this.active) return;

    // Apply DoT damage
    if (this.dot) {
      this.dot.timer -= dt;
      this.takeDamage(this.dot.dps * dt);
      if (this.dot.timer <= 0) this.dot = null;
    }
    
    // Stop moving if died from DoT
    if (!this.active) return;

    // Handle slow effect
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.speed = this.baseSpeed;
      }
    }

    if (this.pathIndex < map.path.length - 1) {
      const target = map.path[this.pathIndex + 1];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const moveAmount = this.speed * dt;
      
      if (dist <= moveAmount) {
        this.x = target.x;
        this.y = target.y;
        this.pathIndex++;
      } else {
        this.x += (dx / dist) * moveAmount;
        this.y += (dy / dist) * moveAmount;
      }
    } else {
      // Reached the end
      this.active = false;
    }
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.active = false;
    }
  }

  applySlow(factor: number, duration: number) {
    this.speed = this.baseSpeed * (1 - factor);
    this.slowTimer = duration;
  }
  
  // 重ねがけはせず、強い方のdpsを残して持続時間を上書きする
  addDot(dps: number, duration: number) {
    if (!this.dot || dps >= this.dot.dps) this.dot = { dps, timer: duration };
    else this.dot.timer = Math.max(this.dot.timer, duration);
  }
}
