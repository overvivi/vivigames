// Hexcells型パズルのソルバーと生成器。
//
// 最重要の前提: **総当たりで解いてはいけない。**
// 「解が一意である」ことと「人間が論理だけで辿り着ける」ことは別物で、
// 前者だけを保証すると、最後に運任せの二択が残る盤面ができる。
// このソルバーは人間と同じ推論しか使わないため、解け切った=推測不要が保証される。

// ---------- 六角格子(axial座標) ----------
// 隣接の順序は時計回りで固定する。{n} の連続判定が順序に依存するため。
export const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
export const key = (q,r)=>`${q},${r}`;
export const hexDistance = (a,b)=>
  (Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[0]+a[1]-b[0]-b[1])) / 2;

export const UNKNOWN = 0, BLUE = 1, BLACK = 2;

// ---------- 盤面 ----------
// 任意の形を扱う。六角形に限らず、穴あきでも模様でもよい。
export function makeBoard(cellList){
  const cells = cellList.map(([q,r])=>[q,r]);
  const index = new Map(cells.map((c,i)=>[key(c[0],c[1]), i]));
  const at = (q,r)=> index.has(key(q,r)) ? index.get(key(q,r)) : null;

  // 隣接6マス。盤外は null のまま残す(連続判定で「隙間」として効かせるため)
  const ring = cells.map(c=>DIRS.map(([dq,dr])=>at(c[0]+dq, c[1]+dr)));
  // 半径2の範囲(自分を除く最大18マス)
  const halo = cells.map((c,i)=>
    cells.map((o,j)=>[o,j]).filter(([o,j])=>{
      const d = hexDistance(c,o);
      return j!==i && d>=1 && d<=2;
    }).map(([,j])=>j)
  );

  // 3軸の直線。連続判定のため、各直線内の並び順を揃える
  const lines = [];
  for(const axis of ['q','r','s']){
    const groups = new Map();
    cells.forEach((c,i)=>{
      const g = axis==='q' ? c[0] : axis==='r' ? c[1] : c[0]+c[1];
      if(!groups.has(g)) groups.set(g, []);
      groups.get(g).push(i);
    });
    for(const [, list] of groups){
      if(list.length < 2) continue;
      list.sort((a,b)=> axis==='q' ? cells[a][1]-cells[b][1] : cells[a][0]-cells[b][0]);
      lines.push({ axis, cells:list });
    }
  }
  return { cells, index, at, ring, halo, lines, size:cells.length };
}

// ---------- 並びの判定 ----------
// order に null(盤外)が混じる場合、そこは隙間として扱う。
// ring=true は環状に見る(隣接6マスは輪になっているため)。
export function isConsecutive(order, blueSet, ring){
  const seq = order.map(i => (i!==null && blueSet.has(i)) ? '1' : '0').join('');
  const n = (seq.match(/1/g) || []).length;
  if(n <= 1) return true;
  const runs = (ring ? seq + seq : seq).match(/1+/g) || [];
  return runs.some(run => run.length >= n);
}

// ---------- 制約 ----------
// kind: 'black'(隣接6) / 'blue'(半径2) / 'line'(直線) / 'total'(盤面全体の残り青)
// mode: 'plain' / 'consec'({n}) / 'split'(-n-)
// reveal: そのヒントを置くと、そのセル自身の色も分かる(黒セルの数字なら黒だと分かる)

function makeHint(kind, scope, order, ring, count, mode, reveal){
  return { kind, cells:scope, order, ring, count, mode, reveal };
}

export function buildAllHints(board, truth){
  const hints = [];
  const blueSet = new Set(truth.map((v,i)=>v===BLUE?i:-1).filter(i=>i>=0));

  board.cells.forEach((c,i)=>{
    if(truth[i] === BLACK){
      const order = board.ring[i];
      const scope = order.filter(x=>x!==null);
      const count = scope.filter(j=>truth[j]===BLUE).length;
      // 並び情報は常に付けられるわけではない。0個や全部埋まりでは意味がないため素の数字にする
      const consec = isConsecutive(order, blueSet, true);
      const mode = (count>=2 && count<=4) ? (consec?'consec':'split') : 'plain';
      hints.push(makeHint('black', scope, order, true, count, mode, [i, BLACK]));
    } else {
      // 青セルの数字は半径2を数える。Hexcellsでは並び情報を付けない
      const scope = board.halo[i];
      const count = scope.filter(j=>truth[j]===BLUE).length;
      hints.push(makeHint('blue', scope, scope, false, count, 'plain', [i, BLUE]));
    }
  });

  for(const line of board.lines){
    const count = line.cells.filter(j=>truth[j]===BLUE).length;
    const consec = isConsecutive(line.cells, blueSet, false);
    const mode = (count>=2) ? (consec?'consec':'split') : 'plain';
    hints.push(makeHint('line', line.cells, line.cells, false, count, mode, null));
  }

  // 盤面全体の残り青数。画面右上のカウンターそのもので、実際のプレイでも推理に使える
  hints.push(makeHint('total', board.cells.map((_,i)=>i), null, false, blueSet.size, 'plain', null));
  return hints;
}

// ---------- ある制約の「ありうる配置」を列挙する ----------
const ENUM_LIMIT = 22; // 未確定がこれを超える制約は、この場では判断を保留する

function enumerateHint(hint, state){
  const unknown = hint.cells.filter(i => state[i] === UNKNOWN);
  const knownBlue = hint.cells.filter(i => state[i] === BLUE).length;
  const need = hint.count - knownBlue;
  if(need < 0 || need > unknown.length) return { contradiction:true };
  if(unknown.length === 0) return { skip:true };
  if(unknown.length > ENUM_LIMIT) return { skip:true };

  const fixedBlue = hint.cells.filter(i => state[i] === BLUE);
  const valid = [];
  const combo = [];
  const check = () => {
    if(hint.mode === 'plain') return true;
    const set = new Set(fixedBlue);
    for(const i of combo) set.add(i);
    const consec = isConsecutive(hint.order, set, hint.ring);
    return hint.mode === 'consec' ? consec : !consec;
  };
  (function pick(pos, left){
    if(left === 0){ if(check()) valid.push(combo.slice()); return; }
    if(pos >= unknown.length || unknown.length - pos < left) return;
    combo.push(unknown[pos]); pick(pos+1, left-1); combo.pop();
    pick(pos+1, left);
  })(0, need);

  if(!valid.length) return { contradiction:true };
  return { unknown, valid };
}

// ---------- ソルバー ----------
// depth 1: 制約を1つずつ見る(人間の「このヒントだけで決まる」)
// depth 2: 重なる制約2つを束ねて見る(人間の「AとBを見比べる」)
// depth 2 が要る盤面は体感的に明確に難しい。生成時の難易度指標として使う。

export function solve(board, hints, revealed, { maxDepth = 2 } = {}){
  const state = new Array(board.size).fill(UNKNOWN);
  for(const [i, v] of revealed) state[i] = v;

  let usedDepth = 0;
  let steps = 0;

  const applySingle = ()=>{
    let progress = false;
    for(const hint of hints){
      const res = enumerateHint(hint, state);
      if(res.contradiction) return 'contradiction';
      if(res.skip) continue;
      for(const i of res.unknown){
        const inAll  = res.valid.every(v => v.includes(i));
        const inNone = res.valid.every(v => !v.includes(i));
        if(inAll){ state[i] = BLUE;  progress = true; steps++; }
        else if(inNone){ state[i] = BLACK; progress = true; steps++; }
      }
      if(progress) usedDepth = Math.max(usedDepth, 1);
    }
    return progress;
  };

  const applyPair = ()=>{
    // 重なりのある2制約を束ね、両方を同時に満たす配置だけを残す
    for(let a=0; a<hints.length; a++){
      const A = hints[a];
      const openA = A.cells.filter(i=>state[i]===UNKNOWN);
      if(!openA.length) continue;
      const setA = new Set(A.cells);
      for(let b=a+1; b<hints.length; b++){
        const B = hints[b];
        if(!B.cells.some(i => setA.has(i) && state[i]===UNKNOWN)) continue;
        const union = [...new Set([...A.cells, ...B.cells])];
        const unknown = union.filter(i => state[i] === UNKNOWN);
        if(!unknown.length || unknown.length > 16) continue;

        const ok = [];
        for(let mask=0; mask < (1<<unknown.length); mask++){
          const trial = state.slice();
          for(let k=0;k<unknown.length;k++) trial[unknown[k]] = (mask>>k & 1) ? BLUE : BLACK;
          let fits = true;
          for(const hint of [A,B]){
            const blues = hint.cells.filter(i => trial[i] === BLUE);
            if(blues.length !== hint.count){ fits = false; break; }
            if(hint.mode !== 'plain'){
              const consec = isConsecutive(hint.order, new Set(blues), hint.ring);
              if(hint.mode === 'consec' ? !consec : consec){ fits = false; break; }
            }
          }
          if(fits) ok.push(mask);
        }
        if(!ok.length) return 'contradiction';

        let progress = false;
        for(let k=0;k<unknown.length;k++){
          const all  = ok.every(m => (m>>k & 1));
          const none = ok.every(m => !(m>>k & 1));
          if(all){ state[unknown[k]] = BLUE;  progress = true; steps++; }
          else if(none){ state[unknown[k]] = BLACK; progress = true; steps++; }
        }
        if(progress){ usedDepth = Math.max(usedDepth, 2); return true; }
      }
    }
    return false;
  };

  for(;;){
    const single = applySingle();
    if(single === 'contradiction') return { ok:false, solved:false, state, depth:usedDepth, steps };
    if(single) continue;
    if(maxDepth < 2) break;
    const pair = applyPair();
    if(pair === 'contradiction') return { ok:false, solved:false, state, depth:usedDepth, steps };
    if(!pair) break;
  }

  return { ok:true, solved: state.every(v => v !== UNKNOWN), state, depth:usedDepth, steps };
}

export const revealedFrom = hints =>
  hints.filter(h => h.reveal).map(h => h.reveal);

// ---------- 生成 ----------
// 全ヒントから始めて、解ける限りヒントを削る。削るほど難しくなる。
// ヒントを削るとそのセルの色も隠れるため、盤面の見た目も同時に決まる。

function mulberry32(seed){
  let a = seed >>> 0;
  return ()=>{
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generate(board, { seed = 1, density = 0.42, maxDepth = 2, keepRatio = 0 } = {}){
  const rnd = mulberry32(seed);
  const truth = board.cells.map(()=> rnd() < density ? BLUE : BLACK);

  // 青が極端に少ない/多い盤面は問題として成立しにくいので弾く
  const blues = truth.filter(v=>v===BLUE).length;
  if(blues < 3 || blues > board.size - 3) return null;

  const all = buildAllHints(board, truth);
  const full = solve(board, all, revealedFrom(all), { maxDepth });
  if(!full.solved) return null;

  // 削る順序をばらけさせる。同じ盤面でも seed が違えば別の問題になる
  const order = all.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [order[i],order[j]]=[order[j],order[i]]; }

  let kept = all.slice();
  for(const i of order){
    const target = all[i];
    if(!kept.includes(target)) continue;
    if(keepRatio > 0 && rnd() < keepRatio) continue; // わざと残して易しくする余地
    const trial = kept.filter(h => h !== target);
    const res = solve(board, trial, revealedFrom(trial), { maxDepth });
    if(res.solved) kept = trial;
  }

  const final = solve(board, kept, revealedFrom(kept), { maxDepth });
  return {
    truth, hints: kept, totalHints: all.length,
    blues, depth: final.depth, steps: final.steps,
    solved: final.solved
  };
}

// 形の作成ヘルパー
export const hexagon = R => {
  const out=[];
  for(let q=-R;q<=R;q++) for(let r=-R;r<=R;r++) if(Math.abs(q+r)<=R) out.push([q,r]);
  return out;
};
