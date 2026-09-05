import { CellType, CELL_DEFINITIONS, Position } from '../constants';
import { Pathogen } from './Pathogen';

export class Projectile {
  x: number;
  y: number;
  target: Pathogen;
  damage: number;
  speed: number;
  active: boolean;
  type: CellType;
  splashRadius?: number;
  slowFactor?: number;
  chainCount: number;
  hitTargets: Set<string>;
  dotDps?: number;
  dotDuration?: number;

  constructor(x: number, y: number, target: Pathogen, damage: number, type: CellType, chainCount: number = 0, hitTargets: Set<string> = new Set()) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = 420; // pixels per second（マスを1.4倍にしたので弾速も合わせる）
    this.active = true;
    this.type = type;
    this.chainCount = chainCount;
    this.hitTargets = hitTargets;
    this.hitTargets.add(target.id);
    
    const def = CELL_DEFINITIONS[type];
    if (def.splashRadius) this.splashRadius = def.splashRadius;
    if (def.slowFactor) this.slowFactor = def.slowFactor;
    if (def.dotDps) this.dotDps = def.dotDps;
    if (def.dotDuration) this.dotDuration = def.dotDuration;
  }

  update(dt: number) {
    if (!this.active || !this.target.active) {
      this.active = false;
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const moveAmount = this.speed * dt;
    
    if (dist <= moveAmount) {
      this.active = false; // Hit target
    } else {
      this.x += (dx / dist) * moveAmount;
      this.y += (dy / dist) * moveAmount;
    }
  }
}

export class Cell {
  id: string;
  type: CellType;
  x: number; // Center pixel coordinate
  y: number;
  gridX: number;
  gridY: number;
  cooldown: number = 0;
  damageMultiplier: number = 1;

  constructor(type: CellType, gridX: number, gridY: number, x: number, y: number) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.type = type;
    this.gridX = gridX;
    this.gridY = gridY;
    this.x = x;
    this.y = y;
  }

  update(dt: number, pathogens: Pathogen[], projectProjectiles: (p: Projectile) => void, rangeMultiplier: number = 1.0, globalDamageMultiplier: number = 1.0) {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }

    const def = CELL_DEFINITIONS[this.type];
    if (def.fireRate === 0) return; // Support cells don't fire projectiles directly in the same way (or handled differently)

    if (this.cooldown <= 0) {
      const target = this.findTarget(pathogens, def.range * rangeMultiplier);
      if (target) {
        this.fire(target, projectProjectiles, globalDamageMultiplier);
        this.cooldown = 1 / def.fireRate;
      }
    }
  }

  findTarget(pathogens: Pathogen[], range: number): Pathogen | null {
    // Basic targeting: first enemy in range
    for (const p of pathogens) {
      if (!p.active) continue;
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      if (dx * dx + dy * dy <= range * range) {
        return p;
      }
    }
    return null;
  }

  // 研究による全体強化は撃つ瞬間に掛ける。細胞に焼き付けると、
  // 配置のたびに走る updateBuffs() で damageMultiplier ごと1へ戻され、
  // 買った強化が消えていた。
  fire(target: Pathogen, projectProjectiles: (p: Projectile) => void, globalDamageMultiplier: number = 1.0) {
    const def = CELL_DEFINITIONS[this.type];
    const damage = def.damage * this.damageMultiplier * globalDamageMultiplier;
    projectProjectiles(new Projectile(this.x, this.y, target, damage, this.type, def.chainCount || 0));
  }
}
