import { GameMap } from './Map';
import { Cell, Projectile } from './entities/Cell';
import { Pathogen } from './entities/Pathogen';
import { CELL_DEFINITIONS, CellType, INITIAL_ATP, INITIAL_HP, TILE_SIZE, GameState, VisualEffect, WAVE_CLEAR_ATP, VICTORY_WAVE } from './constants';
import { soundManager } from './audio';

export class GameEngine {
  map: GameMap;
  cells: Cell[];
  pathogens: Pathogen[];
  projectiles: Projectile[];
  effects: VisualEffect[];
  atp: number;
  hp: number;
  wave: number;
  state: GameState;
  
  globalRangeMultiplier: number = 1.0;
  // 研究で買った全体攻撃力。細胞ではなくエンジン側に持たせる（Cell.fire を参照）
  globalDamageMultiplier: number = 1.0;
  // ウェーブクリア時のATP回収の上乗せ分
  atpBonus: number = 0;
  // 研究は買うほど高くなる。同じ値段で無限に買えると射程が青天井になっていた
  upgradeCounts: Record<string, number> = {};
  gameSpeed: number = 1.0;
  
  onStateChange?: (state: GameState) => void;
  onStatsChange?: (stats: { atp: number, hp: number, wave: number, gameSpeed: number }) => void;

  private lastTime: number = 0;
  private pathogensToSpawn: any[] = [];
  private spawnTimer: number = 0;
  private reqId: number = 0;

  constructor() {
    this.map = new GameMap();
    this.cells = [];
    this.pathogens = [];
    this.projectiles = [];
    this.effects = [];
    this.atp = INITIAL_ATP;
    this.hp = INITIAL_HP;
    this.wave = 0;
    this.state = GameState.MENU;
  }

  start() {
    this.cells = [];
    this.pathogens = [];
    this.projectiles = [];
    this.effects = [];
    this.atp = INITIAL_ATP;
    this.hp = INITIAL_HP;
    this.wave = 0;
    this.globalRangeMultiplier = 1.0;
    this.globalDamageMultiplier = 1.0;
    this.atpBonus = 0;
    this.upgradeCounts = {};
    this.gameSpeed = 1.0;
    this.map = new GameMap();
    this.setState(GameState.WAVE_TRANSITION);
    this.lastTime = performance.now();
    this.updateStats();
    this.loop(this.lastTime);
  }

  stop() {
    cancelAnimationFrame(this.reqId);
  }

  setState(newState: GameState) {
    this.state = newState;
    if (this.onStateChange) this.onStateChange(this.state);
  }

  updateStats() {
    if (this.onStatsChange) this.onStatsChange({ atp: this.atp, hp: this.hp, wave: this.wave, gameSpeed: this.gameSpeed });
  }

  setSpeed(speed: number) {
    this.gameSpeed = speed;
    this.updateStats();
  }

  addEffect(type: 'damageText' | 'explosion', x: number, y: number, text?: string, color?: string) {
    this.effects.push({
      type, x, y, text, color,
      timer: 0.8,
      maxTimer: 0.8
    });
  }

  buildCell(type: CellType, gridX: number, gridY: number): boolean {
    const def = CELL_DEFINITIONS[type];
    if (this.atp >= def.cost && this.map.isBuildable(gridX, gridY)) {
      this.atp -= def.cost;
      this.map.placeCell(gridX, gridY);
      const x = gridX * TILE_SIZE + TILE_SIZE / 2;
      const y = gridY * TILE_SIZE + TILE_SIZE / 2;
      this.cells.push(new Cell(type, gridX, gridY, x, y));
      this.updateStats();
      this.updateBuffs();
      soundManager.build();
      return true;
    }
    return false;
  }

  /** 研究の現在の値段。買うたびに5割ずつ上がる */
  upgradeCost(id: string, base: number) {
    return Math.round(base * Math.pow(1.5, this.upgradeCounts[id] || 0));
  }

  /** 研究を買う。買えたら true */
  buyUpgrade(id: string, base: number, apply: () => void): boolean {
    const cost = this.upgradeCost(id, base);
    if (this.atp < cost) return false;
    this.atp -= cost;
    this.upgradeCounts[id] = (this.upgradeCounts[id] || 0) + 1;
    apply();
    this.updateStats();
    return true;
  }

  /** 配置した細胞を売る。払った額の6割が戻る */
  sellCell(cell: Cell): boolean {
    const i = this.cells.indexOf(cell);
    if (i < 0) return false;
    this.cells.splice(i, 1);
    this.map.grid[cell.gridY][cell.gridX] = 0;
    this.atp += Math.floor(CELL_DEFINITIONS[cell.type].cost * 0.6);
    this.updateStats();
    this.updateBuffs();
    return true;
  }

  updateBuffs() {
    // Reset multipliers
    this.cells.forEach(c => c.damageMultiplier = 1);
    
    // Apply HelperTCell buffs
    const helpers = this.cells.filter(c => c.type === 'HelperTCell');
    for (const helper of helpers) {
      const buffRange = CELL_DEFINITIONS['HelperTCell'].range * this.globalRangeMultiplier;
      for (const cell of this.cells) {
        if (cell === helper) continue;
        const dx = cell.x - helper.x;
        const dy = cell.y - helper.y;
        if (dx*dx + dy*dy <= buffRange*buffRange) {
          cell.damageMultiplier = CELL_DEFINITIONS['HelperTCell'].buffMultiplier || 1.5;
        }
      }
    }
  }

  startNextWave() {
    this.wave++;
    this.setState(GameState.PLAYING);
    this.updateStats();
    soundManager.upgrade();

    // Generate wave composition
    // 経路を69マスから39マスへ短くし、敵の速度も上げた（1体55秒→約22秒）。
    // そのぶん1体あたりに撃ち込める時間が減るので、HPの伸びも緩めてある。
    // ここの数値は実際に遊んで詰める前提の初期値。
    const count = 5 + this.wave * 3;
    const hpMult = 1 + (this.wave - 1) * 0.4;
    
    this.pathogensToSpawn = [];
    
    for (let i = 0; i < count; i++) {
      let type: any = 'Bacteria';
      let hp = 22 * hpMult;
      let speed = 100;
      let reward = 10;

      if (this.wave >= 3 && i % 4 === 0) {
        type = 'Virus';
        hp = 11 * hpMult;
        speed = 150;
      }
      if (this.wave >= 5 && i % 5 === 0) {
        type = 'Superbug';
        hp = 70 * hpMult;
        speed = 75;
        reward = 20;
      }

      this.pathogensToSpawn.push({ type, hp, speed, reward });
    }

    // Boss every 5 waves
    if (this.wave % 5 === 0) {
      this.pathogensToSpawn.push({
        type: 'BossPathogen',
        hp: 380 * hpMult,
        speed: 65,
        reward: 100
      });
    }

    this.spawnTimer = 0;
  }

  loop = (time: number) => {
    const rawDt = (time - this.lastTime) / 1000;
    const dt = Math.min(rawDt, 0.1) * this.gameSpeed; // Cap dt to prevent huge jumps, apply speed
    this.lastTime = time;

    if (this.state === GameState.PLAYING) {
      this.update(dt);
    }

    this.reqId = requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    // Update Effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].timer -= dt;
      if (this.effects[i].timer <= 0) {
        this.effects.splice(i, 1);
      }
    }

    // Spawning
    if (this.pathogensToSpawn.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const p = this.pathogensToSpawn.shift();
        this.pathogens.push(new Pathogen(p.type, p.hp, p.speed, p.reward, this.map));
        this.spawnTimer = 0.7; // 出現間隔。1.0秒だと波の頭が間延びしていた
      }
    }

    // Update Pathogens
    for (let i = this.pathogens.length - 1; i >= 0; i--) {
      const p = this.pathogens[i];
      p.update(dt, this.map);
      
      if (!p.active) {
        if (p.hp <= 0) {
          this.atp += p.reward;
          this.updateStats();
          soundManager.die();
        } else {
          // Reached end
          this.hp -= 1;
          this.updateStats();
          soundManager.baseHit();
          if (this.hp <= 0) {
            this.setState(GameState.GAME_OVER);
          }
        }
        this.pathogens.splice(i, 1);
      }
    }

    // Check wave end
    if (this.pathogens.length === 0 && this.pathogensToSpawn.length === 0 && this.state === GameState.PLAYING) {
      // 研究「ATP生産強化」はここに効く。以前は買っても即金50が入るだけで、
      // 100払って50返るという損な買い物になっていた。
      this.atp += WAVE_CLEAR_ATP + this.atpBonus;
      this.updateStats();
      if (this.wave >= VICTORY_WAVE) {
        this.setState(GameState.VICTORY);
      } else {
        this.setState(GameState.WAVE_TRANSITION);
      }
      soundManager.upgrade(); // Use upgrade sound as wave clear notification
    }

    // Update Cells
    for (const cell of this.cells) {
      cell.update(dt, this.pathogens, (proj) => {
        this.projectiles.push(proj);
        soundManager.shoot();
      }, this.globalRangeMultiplier, this.globalDamageMultiplier);
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt);
      
      if (!proj.active && proj.target.active) { // Hit
        soundManager.hit();
        this.addEffect('explosion', proj.target.x, proj.target.y);
        
        if (proj.splashRadius) {
          // Splash damage
          for (const p of this.pathogens) {
            const dx = p.x - proj.x;
            const dy = p.y - proj.y;
            if (dx*dx + dy*dy <= proj.splashRadius * proj.splashRadius) {
              p.takeDamage(proj.damage);
              this.addEffect('damageText', p.x, p.y - 10, Math.floor(proj.damage).toString(), '#ef4444');
              if (proj.slowFactor) p.applySlow(proj.slowFactor, 3);
            }
          }
        } else {
          // Single target
          proj.target.takeDamage(proj.damage);
          this.addEffect('damageText', proj.target.x, proj.target.y - 10, Math.floor(proj.damage).toString(), '#ef4444');
          if (proj.slowFactor) proj.target.applySlow(proj.slowFactor, 3);
          if (proj.dotDps && proj.dotDuration) proj.target.addDot(proj.dotDps, proj.dotDuration);
          
          if (proj.chainCount > 0) {
            let nextTarget: Pathogen | null = null;
            let minDist = Infinity;
            for (const p of this.pathogens) {
              if (!p.active || proj.hitTargets.has(p.id)) continue;
              const dx = p.x - proj.target.x;
              const dy = p.y - proj.target.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < 210 && dist < minDist) {
                minDist = dist;
                nextTarget = p;
              }
            }
            if (nextTarget) {
              const newHitTargets = new Set(proj.hitTargets);
              this.projectiles.push(new Projectile(proj.target.x, proj.target.y, nextTarget, proj.damage, proj.type, proj.chainCount - 1, newHitTargets));
            }
          }
        }
        this.projectiles.splice(i, 1);
      } else if (!proj.active) {
        this.projectiles.splice(i, 1); // Missed or target already dead
      }
    }
  }
}

