// エンジン側の修正を機械的に確かめる。 npx tsx tools/engine.check.ts
import { GameEngine } from '../src/game/GameEngine';
import { Pathogen } from '../src/game/entities/Pathogen';
import { GameState, TILE_SIZE, WAVE_CLEAR_ATP, VICTORY_WAVE, CELL_DEFINITIONS } from '../src/game/constants';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed++;
};

// requestAnimationFrame は使わない。update() を直接回して確かめる
const engine = () => {
  const e = new GameEngine();
  e.atp = 5000;
  e.state = GameState.PLAYING;
  return e;
};

// 1. 攻撃力強化が、次に細胞を置いても消えないこと
{
  const e = engine();
  e.buildCell('Neutrophil', 1, 5);
  e.buyUpgrade('damage', 150, () => { e.globalDamageMultiplier *= 1.2; });
  const afterBuy = e.globalDamageMultiplier;
  e.buildCell('Neutrophil', 1, 6);   // ここで updateBuffs() が走る
  check('攻撃力強化は細胞を追加しても消えない',
    Math.abs(e.globalDamageMultiplier - afterBuy) < 1e-9 && e.globalDamageMultiplier > 1.19,
    `x${e.globalDamageMultiplier.toFixed(2)}`);

  // 実際に撃った弾のダメージへ乗っているか
  let dmg = 0;
  const target = new Pathogen('Bacteria', 999, 0, 0, e.map);
  target.x = e.cells[0].x + 10; target.y = e.cells[0].y;
  e.pathogens.push(target);
  e.cells[0].update(1, e.pathogens, p => { dmg = p.damage; }, 1, e.globalDamageMultiplier);
  check('弾のダメージに全体強化が乗る', Math.abs(dmg - CELL_DEFINITIONS.Neutrophil.damage * 1.2) < 1e-6, `${dmg}`);
}

// 2. 研究は買うほど高くなること
{
  const e = engine();
  const c0 = e.upgradeCost('range', 120);
  e.buyUpgrade('range', 120, () => { e.globalRangeMultiplier *= 1.15; });
  const c1 = e.upgradeCost('range', 120);
  e.buyUpgrade('range', 120, () => { e.globalRangeMultiplier *= 1.15; });
  const c2 = e.upgradeCost('range', 120);
  check('研究の値段が上がる', c0 < c1 && c1 < c2, `${c0} → ${c1} → ${c2}`);
}

// 3. ATP生産強化がウェーブクリア時に効くこと
{
  const e = engine();
  e.buyUpgrade('atp', 100, () => { e.atpBonus += 25; });
  e.wave = 1;
  e.atp = 0;
  e.state = GameState.PLAYING;
  e.update(0.016);  // 敵が居ないのでウェーブ終了として処理される
  check('ATP生産強化がクリア時の回収に乗る', e.atp === WAVE_CLEAR_ATP + 25, `${e.atp} ATP`);
}

// 4. 売却で盤面が空き、ATPが戻ること
{
  const e = engine();
  e.atp = 200;
  e.buildCell('Neutrophil', 3, 3);
  const afterBuild = e.atp;
  const ok = e.sellCell(e.cells[0]);
  check('売却でATPが戻り、同じマスへ置き直せる',
    ok && e.cells.length === 0 && e.atp === afterBuild + 30 && e.map.isBuildable(3, 3),
    `${afterBuild} → ${e.atp} ATP`);
}

// 5. 規定ウェーブを守り切ると勝利になること
{
  const e = engine();
  e.wave = VICTORY_WAVE;
  e.state = GameState.PLAYING;
  e.update(0.016);
  // 直前に PLAYING を入れているため、型の絞り込みを外して比べる
  const stateAfter = e.state as GameState;
  check(`Wave ${VICTORY_WAVE} クリアで勝利になる`, stateAfter === GameState.VICTORY);
}

// 6. 継続ダメージが重ならないこと
{
  const e = engine();
  const p = new Pathogen('Bacteria', 1000, 0, 0, e.map);
  for (let i = 0; i < 5; i++) p.addDot(25, 4);
  const before = p.hp;
  p.update(1, e.map);
  const lost = before - p.hp;
  check('継続ダメージは重ねがけされない', Math.abs(lost - 25) < 1e-6, `1秒で ${lost.toFixed(0)} ダメージ`);
}

// 7. 経路の長さ（テンポ）
{
  const e = engine();
  const tiles = e.map.path.length;
  const px = tiles * TILE_SIZE;
  const sec = px / 100;   // 通常の細菌の速度
  check('1体が渡り切る時間が20〜30秒に収まる', sec >= 18 && sec <= 32,
    `${tiles}マス / ${sec.toFixed(0)}秒`);
}

console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
