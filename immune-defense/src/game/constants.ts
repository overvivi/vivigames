// 32×18 のままだと、携帯では1マスが10px・敵が4pxしか無く、
// 常にピンチズームしないと遊べなかった。マス数を減らして1マスを大きくする。
// TILE_SIZE を上げているのは、キャンバスの内部解像度を確保して
// PCで拡大表示したときにぼやけないようにするため。
export const TILE_SIZE = 56;
export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 12;
export const CANVAS_WIDTH = TILE_SIZE * GRID_WIDTH;
export const CANVAS_HEIGHT = TILE_SIZE * GRID_HEIGHT;

export const INITIAL_ATP = 200;
export const INITIAL_HP = 20;
// ウェーブを乗り切った時のATP回収。研究「ATP生産強化」でここが増える
export const WAVE_CLEAR_ATP = 25;
// ここまで守り切ればクリア。終わりが無いと達成感が出ないため区切りを置く
export const VICTORY_WAVE = 30;

export type Position = { x: number; y: number };

export enum GameState {
  MENU,
  PLAYING,
  WAVE_TRANSITION,
  GAME_OVER,
  VICTORY,
}

export type CellType = 'Neutrophil' | 'Macrophage' | 'NKCell' | 'HelperTCell' | 'MemoryBCell' | 'Eosinophil' | 'PlasmaCell';
export type PathogenType = 'Bacteria' | 'Virus' | 'Superbug' | 'BossPathogen';

export interface VisualEffect {
  x: number;
  y: number;
  text?: string;
  color?: string;
  type: 'damageText' | 'explosion';
  timer: number;
  maxTimer: number;
}

export interface CellStats {
  cost: number;
  damage: number;
  range: number;
  fireRate: number; // Attacks per second
  name: string;
  description: string;
  color: string;
  type: CellType;
  splashRadius?: number;
  slowFactor?: number;
  buffMultiplier?: number;
  dotDps?: number;
  dotDuration?: number;
  chainCount?: number;
}

export const CELL_DEFINITIONS: Record<CellType, CellStats> = {
  Neutrophil: {
    type: 'Neutrophil',
    name: '好中球 (Neutrophil)',
    description: '基本ユニット。安価で連射が早い。',
    cost: 50,
    damage: 10,
    range: 170,
    fireRate: 1.5,
    color: '#e2e8f0', // slate-200
  },
  Macrophage: {
    type: 'Macrophage',
    name: 'マクロファージ (Macrophage)',
    description: '大食細胞。高威力で範囲攻撃(貪食)を行う。',
    cost: 150,
    damage: 40,
    range: 140,
    fireRate: 0.5,
    splashRadius: 85,
    color: '#f87171', // red-400
  },
  NKCell: {
    type: 'NKCell',
    name: 'NK細胞 (Natural Killer)',
    description: '単体特化の狙撃手。射程が長く高威力。',
    cost: 120,
    damage: 80,
    range: 335,
    fireRate: 0.3,
    color: '#60a5fa', // blue-400
  },
  HelperTCell: {
    type: 'HelperTCell',
    name: 'ヘルパーT細胞 (Helper T)',
    description: '支援ユニット。周囲の味方の攻撃力を上げる。',
    cost: 200,
    damage: 0,
    range: 210,
    fireRate: 0,
    buffMultiplier: 1.5,
    color: '#34d399', // emerald-400
  },
  MemoryBCell: {
    type: 'MemoryBCell',
    name: '記憶B細胞 (Memory B)',
    description: '抗体を放ち、敵の移動速度を低下させる。',
    cost: 180,
    damage: 5,
    range: 195,
    fireRate: 1.0,
    slowFactor: 0.5,
    color: '#a78bfa', // violet-400
  },
  Eosinophil: {
    type: 'Eosinophil',
    name: '好酸球 (Eosinophil)',
    description: '毒素を放ち、敵に継続ダメージ(DoT)を与える。',
    cost: 160,
    damage: 15,
    range: 180,
    fireRate: 1.2,
    dotDps: 25,
    dotDuration: 4,
    color: '#f472b6', // pink-400
  },
  PlasmaCell: {
    type: 'PlasmaCell',
    name: 'プラズマ細胞 (Plasma)',
    description: '抗体が連鎖し、最大3体の敵に次々とダメージを与える。',
    cost: 220,
    damage: 45,
    range: 225,
    fireRate: 0.8,
    chainCount: 3,
    color: '#fcd34d', // amber-300
  }
};
