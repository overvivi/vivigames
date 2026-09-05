import { deal } from '../src/gameLogic';
import { solve } from '../src/solver';

// 「解ける配牌を1つ手に入れるまで」の実測。上限ノード数ごとに比べる。
for (const budget of [6000, 12000, 25000, 40000]) {
  let totalMs = 0, worst = 0, attemptsTotal = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    let attempts = 0;
    for (;;) {
      attempts++;
      if (solve(deal(), budget).solvable) break;
      if (attempts > 60) break;
    }
    const ms = performance.now() - t0;
    totalMs += ms; attemptsTotal += attempts;
    if (ms > worst) worst = ms;
  }
  console.log(`上限${String(budget).padStart(6)} : 平均 ${(totalMs / N).toFixed(0)}ms / 最悪 ${worst.toFixed(0)}ms / 平均試行 ${(attemptsTotal / N).toFixed(1)}回`);
}
