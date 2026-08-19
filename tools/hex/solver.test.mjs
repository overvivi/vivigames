// ソルバーの正しさを検証する。速度より「間違えないこと」を見る。
import { makeBoard, hexagon, generate, solve, revealedFrom, buildAllHints,
         isConsecutive, BLUE, BLACK, UNKNOWN } from './solver.mjs';

let pass = 0, fail = 0;
const ok = (cond, name)=>{ if(cond){ pass++; } else { fail++; console.error('  NG: ' + name); } };

// ---- 1. 並び判定 ----
{
  const S = new Set([0,1,2]);
  ok(isConsecutive([0,1,2,3,4,5], S, true) === true,  '環状: 0,1,2 は連続');
  ok(isConsecutive([0,1,2,3,4,5], new Set([0,2,4]), true) === false, '環状: 0,2,4 は非連続');
  ok(isConsecutive([0,1,2,3,4,5], new Set([5,0,1]), true) === true,  '環状: 端をまたぐ 5,0,1 は連続');
  ok(isConsecutive([0,1,2,3,4,5], new Set([5,0,1]), false) === false,'直線: 端をまたぐのは非連続');
  // 実際の ring は常に6要素で、盤外は null で残る。両端が離れている場合を見る
  ok(isConsecutive([0,null,2,null,null,null], new Set([0,2]), true) === false, '盤外は隙間として扱う');
  ok(isConsecutive([0,1,null,null,null,null], new Set([0,1]), true) === true,  '盤外があっても隣接していれば連続');
  ok(isConsecutive([0,1,2], new Set([1]), true) === true, '1個以下は常に連続扱い');
}

// ---- 2. 生成した問題が「真の配置」と一致するか ----
// ソルバーが推測せず、かつ間違った確定をしていないことの証明になる。
{
  const board = makeBoard(hexagon(4));
  let made = 0, mismatch = 0, unsolved = 0;
  for(let seed = 1; seed <= 30 && made < 15; seed++){
    const g = generate(board, { seed });
    if(!g) continue;
    made++;
    const res = solve(board, g.hints, revealedFrom(g.hints));
    if(!res.solved){ unsolved++; continue; }
    for(let i = 0; i < board.size; i++){
      if(res.state[i] !== g.truth[i]) { mismatch++; break; }
    }
  }
  ok(made >= 10, `十分な数を生成できた (${made}件)`);
  ok(unsolved === 0, '生成した問題はすべて推測なしで解け切る');
  ok(mismatch === 0, 'ソルバーの答えが真の配置と完全に一致する');
}

// ---- 3. 削り切れているか(最小性) ----
// 残ったヒントのどれか1つでも消すと解けなくなるはず。
{
  const board = makeBoard(hexagon(3));
  const g = generate(board, { seed: 12345 });
  ok(!!g, '盤面を生成できた');
  if(g){
    let removable = 0;
    for(const h of g.hints){
      const trial = g.hints.filter(x => x !== h);
      if(solve(board, trial, revealedFrom(trial)).solved) removable++;
    }
    ok(removable === 0, `余分なヒントが残っていない (削れるもの ${removable}件)`);
    ok(g.hints.length < g.totalHints, `ヒントを削減できている (${g.totalHints} → ${g.hints.length})`);
  }
}

// ---- 4. 矛盾した問題を「解けた」と誤答しないか ----
{
  const board = makeBoard(hexagon(2));
  const truth = board.cells.map((_,i)=> i % 3 === 0 ? BLUE : BLACK);
  const hints = buildAllHints(board, truth);
  // 全体の青数だけを嘘の値へ差し替える
  const broken = hints.map(h => h.kind === 'total' ? { ...h, count: h.count + 5 } : h);
  const res = solve(board, broken, revealedFrom(broken));
  ok(res.ok === false || res.solved === false, '矛盾する問題は解けたと報告しない');
}

// ---- 5. 難易度の記録 ----
{
  const board = makeBoard(hexagon(4));
  const depths = new Set();
  for(let seed = 1; seed <= 20; seed++){
    const g = generate(board, { seed });
    if(g) depths.add(g.depth);
  }
  ok(depths.size > 0, `難易度を記録できている (観測した深さ: ${[...depths].sort().join(', ')})`);
}

console.log(`\n${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
