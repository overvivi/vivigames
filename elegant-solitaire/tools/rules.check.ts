// 修正した点を機械的に確かめる。 npx tsx tools/rules.check.ts
import { deal, autoFinishStep, isWinState, GameState, CardData, Suit, Rank } from '../src/gameLogic';
import { dealSolvable, solve } from '../src/solver';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failed++;
};

const card = (suit: Suit, rank: number): CardData =>
  ({ id: `${suit}-${rank}`, suit, rank: rank as Rank, faceUp: true });

/**
 * 実際のプレイで「裏向きが1枚も無い」状態まで来たときの盤面を作る。
 * 場札は必ず降順・交互色の並びになっているので、それを再現する。
 */
function openBoard(stockCount = 0): GameState {
  const runs: CardData[][] = [];
  const pairs: [Suit, Suit][] = [['spades', 'hearts'], ['hearts', 'spades'], ['clubs', 'diamonds'], ['diamonds', 'clubs']];
  for (const [a, b] of pairs) {
    const run: CardData[] = [];
    for (let r = 13; r >= 1; r--) run.push(card(r % 2 === 1 ? a : b, r));
    runs.push(run);
  }
  const tableau: CardData[][] = [runs[0], runs[1], runs[2], runs[3], [], [], []];

  // 山札に残す枚数ぶんだけ、場札の先頭（＝一番小さい札）を山札へ移す
  const stock: CardData[] = [];
  for (let i = 0; i < stockCount; i++) {
    const pile = tableau[i % 4];
    if (pile.length) stock.push({ ...pile.pop()!, faceUp: false });
  }

  return { stock, waste: [], foundation: [[], [], [], []], tableau, score: 0, moves: 0 };
}

function runAuto(st: GameState) {
  let steps = 0;
  for (;;) {
    const next = autoFinishStep(st);
    if (!next) break;
    st = next;
    if (++steps > 3000) break;
  }
  return { st, steps };
}

// 1. 配られる盤面は必ず「解けると証明済み」であること
{
  let allSolvable = true;
  let worst = 0;
  for (let i = 0; i < 30; i++) {
    const t0 = performance.now();
    const g = dealSolvable();
    const ms = performance.now() - t0;
    if (ms > worst) worst = ms;
    if (!solve(g, 6000).solvable) allSolvable = false;
  }
  check('配牌30回すべてが解ける盤面', allSolvable, `最悪 ${worst.toFixed(0)}ms`);
}

// 2. 裏向きが無くなった局面から、オートで必ず勝ちきること
{
  const a = runAuto(openBoard(0));
  check('場札だけの局面をオートで勝ちきる', isWinState(a.st), `${a.steps} 手`);

  const b = runAuto(openBoard(12));
  check('山札が残っていてもオートで勝ちきる', isWinState(b.st), `${b.steps} 手`);
}

// 3. 組札は同じ絵柄でA→Kの順に積まれること
{
  const { st } = runAuto(openBoard(6));
  let ordered = true;
  for (const pile of st.foundation) {
    if (pile.length !== 13) ordered = false;
    pile.forEach((c, i) => {
      if (c.rank !== i + 1 || c.suit !== pile[0].suit) ordered = false;
    });
  }
  check('組札は同じ絵柄でA→Kの順に積まれる', ordered);
}

// 4. 送れる札がどこにも無ければ、オートは止まること（無限ループ防止）
{
  const stuck: GameState = {
    stock: [], waste: [],
    foundation: [[], [], [], []],
    // エースが1枚も表に出ておらず、どの札も組札へ送れない
    tableau: [[card('hearts', 5)], [card('spades', 9)], [], [], [], [], []],
    score: 0, moves: 0,
  };
  check('進めない局面ではオートが止まる', autoFinishStep(stuck) === null);
}

console.log(failed ? `\n${failed} 件失敗` : '\nすべて成功');
process.exit(failed ? 1 : 0);
