// ソルバーの当たりを見るための使い捨て計測。 npx tsx src/solver.check.ts
import { deal } from '../src/gameLogic';
import { solve } from '../src/solver';

const N = Number(process.argv[2] || 300);
const BUDGET = Number(process.argv[3] || 60000);

let ok = 0, exhausted = 0, no = 0;
let total = 0, worst = 0, nodesMax = 0;

for (let i = 0; i < N; i++) {
  const g = deal();
  const t0 = performance.now();
  const r = solve(g, BUDGET);
  const ms = performance.now() - t0;
  total += ms;
  if (ms > worst) worst = ms;
  if (r.nodes > nodesMax) nodesMax = r.nodes;
  if (r.solvable) ok++;
  else if (r.exhausted) exhausted++;
  else no++;
}

console.log(`配牌 ${N} 件 / ノード上限 ${BUDGET}`);
console.log(`  解けると証明できた : ${ok} (${(ok / N * 100).toFixed(1)}%)`);
console.log(`  探索し尽くして不可 : ${no} (${(no / N * 100).toFixed(1)}%)`);
console.log(`  上限で打ち切り(不明): ${exhausted} (${(exhausted / N * 100).toFixed(1)}%)`);
console.log(`  平均 ${(total / N).toFixed(1)}ms / 最悪 ${worst.toFixed(0)}ms / 最大ノード ${nodesMax}`);
