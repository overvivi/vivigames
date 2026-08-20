// ソルバーの正しさを検証する。
//
// 検証対象は games/hexamine.html に埋め込まれたソルバーそのもの。
// テスト用に別コピーを持つと必ず食い違うため、正本から取り出して動かす。

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const HTML = 'games/hexamine.html';
const html = readFileSync(HTML, 'utf8');
const m = html.match(/<script[^>]*id="solverSource"[^>]*>([\s\S]*?)<\/script>/);
if(!m) { console.error(`${HTML} から solverSource を取り出せなかった`); process.exit(1); }

// 末尾に受け渡し用の1行を足して、内部の関数を取り出す
const context = vm.createContext({ console });
vm.runInContext(m[1] + `
;globalThis.__api = { makeBoard, generate, solve, revealedFrom, buildAllHints,
                      isConsecutive, hexagon, nextStep, BLUE, BLACK, UNKNOWN };
`, context, { filename:'hexamine-solver.js' });
const { makeBoard, generate, solve, revealedFrom, buildAllHints,
        isConsecutive, hexagon, nextStep, BLUE } = context.__api;

let pass = 0, fail = 0;
const ok = (cond, name)=>{ if(cond){ pass++; } else { fail++; console.error('  NG: ' + name); } };

// ---- 1. 並び判定 ----
ok(isConsecutive([0,1,2,3,4,5], new Set([0,1,2]), true) === true,  '環状: 0,1,2 は連続');
ok(isConsecutive([0,1,2,3,4,5], new Set([0,2,4]), true) === false, '環状: 0,2,4 は非連続');
ok(isConsecutive([0,1,2,3,4,5], new Set([5,0,1]), true) === true,  '環状: 端をまたぐ 5,0,1 は連続');
ok(isConsecutive([0,1,2,3,4,5], new Set([5,0,1]), false) === false,'直線: 端をまたぐのは非連続');
ok(isConsecutive([0,null,2,null,null,null], new Set([0,2]), true) === false, '盤外は隙間として扱う');
ok(isConsecutive([0,1,null,null,null,null], new Set([0,1]), true) === true,  '盤外があっても隣接なら連続');
ok(isConsecutive([0,1,2], new Set([1]), true) === true, '1個以下は常に連続扱い');

// ---- 2. 生成した問題の解答が真の配置と一致するか ----
// 推測せず、かつ誤った確定もしていないことの証明になる。
{
  const board = makeBoard(hexagon(4));
  let made = 0, mismatch = 0, unsolved = 0;
  for(let seed = 1; seed <= 30 && made < 15; seed++){
    const g = generate(board, { seed });
    if(!g) continue;
    made++;
    const res = solve(board, g.hints, revealedFrom(g.hints), {});
    if(!res.solved){ unsolved++; continue; }
    for(let i = 0; i < board.size; i++) if(res.state[i] !== g.truth[i]) { mismatch++; break; }
  }
  ok(made >= 10, `十分な数を生成できた (${made}件)`);
  ok(unsolved === 0, '生成した問題はすべて推測なしで解け切る');
  ok(mismatch === 0, 'ソルバーの答えが真の配置と完全に一致する');
}

// ---- 3. これ以上削れないか ----
// 黒マスのヒントは丸ごと消さず「最初から見せる→隠す→?」と降格させる仕様なので、
// 削れるかどうかは種類ごとに見る。
{
  const board = makeBoard(hexagon(3));
  const g = generate(board, { seed: 12345 });
  ok(!!g, '盤面を生成できた');
  if(g){
    let removable = 0, downgradable = 0;
    for(const h of g.hints){
      if(h.kind === 'black'){
        // ? への降格は意図的に一部だけ試すため、ここでは判定しない。
        // 「最初から見せる」ものは必ず隠せるか試しているので、そこだけ検証する。
        if(!h.shown) continue;
        const trial = g.hints.map(x => x === h ? Object.assign({}, h, { shown:false }) : x);
        if(solve(board, trial, revealedFrom(trial), {}).solved) downgradable++;
      } else if(h.kind === 'line' || h.kind === 'blue'){
        const trial = g.hints.filter(x => x !== h);
        if(solve(board, trial, revealedFrom(trial), {}).solved) removable++;
      }
    }
    ok(removable === 0, `直線・青のヒントに余分が無い (削れるもの ${removable}件)`);
    ok(downgradable === 0, `最初から見せている黒マスは全て必要 (隠せるもの ${downgradable}件)`);
  }
}

// ---- 3b. 段階的な開示が効いているか ----
// 黒と確定した時点で数字が読めるので、最初から見えているマスは少なくて済むはず。
{
  const board = makeBoard(hexagon(4));
  let shownTotal = 0, hiddenNumbered = 0, silent = 0, made = 0;
  for(let seed=1; seed<=8; seed++){
    const g = generate(board, { seed });
    if(!g) continue;
    made++;
    shownTotal += g.hints.filter(h=>h.shown).length;
    hiddenNumbered += g.hints.filter(h=>h.kind==='black' && !h.shown && h.count!==null).length;
    silent += g.hints.filter(h=>h.kind==='black' && h.count===null).length;
  }
  const avgShown = shownTotal/made;
  ok(avgShown < board.size * 0.5,
     `最初から見えるマスが盤面の半分未満 (平均 ${avgShown.toFixed(1)} / ${board.size}マス)`);
  ok(hiddenNumbered > 0,
     `黒と確定してから読める数字が存在する (平均 ${(hiddenNumbered/made).toFixed(1)}件)`);
}

// ---- 4. 矛盾を「解けた」と誤答しないか ----
{
  const board = makeBoard(hexagon(2));
  const truth = board.cells.map((_,i)=> i % 3 === 0 ? BLUE : 2);
  const hints = buildAllHints(board, truth);
  const broken = hints.map(h => h.kind === 'total' ? { ...h, count: h.count + 5 } : h);
  const res = solve(board, broken, revealedFrom(broken), {});
  ok(res.ok === false || res.solved === false, '矛盾する問題は解けたと報告しない');
}

// ---- 5. 決定性(デイリーランキングの前提) ----
// 同じ種から必ず同じ問題が出ないと、全員へ同じ盤面を配れない。
{
  const board = makeBoard(hexagon(3));
  const sig = g => g && g.truth.join('') + '|' + g.hints.map(h=>`${h.kind}:${h.count}:${h.mode}`).sort().join(',');
  let same = 0, checked = 0;
  for(const seed of [7, 99, 12345, 888888]){
    const a = sig(generate(board,{seed})), b = sig(generate(board,{seed}));
    checked++; if(a && a === b) same++;
  }
  ok(same === checked, `同じ種から同じ問題が出る (${same}/${checked})`);
  ok(sig(generate(board,{seed:7})) !== sig(generate(board,{seed:8})), '違う種では違う問題になる');
}

// ---- 6. 難易度のつまみが効くか ----
// keepRatio を上げるとヒントが多く残り、易しくなるはず。
{
  const board = makeBoard(hexagon(3));
  const count = keepRatio => {
    const list = [];
    for(let seed=1; seed<=8; seed++){
      const g = generate(board, { seed, keepRatio });
      if(g) list.push(g.hints.length);
    }
    return list.reduce((a,b)=>a+b,0) / list.length;
  };
  const easy = count(0.6), hard = count(0);
  ok(easy > hard, `keepRatioでヒント数を制御できる (易 ${easy.toFixed(1)} > 難 ${hard.toFixed(1)})`);
}


// ---- 7. HINTが読めるヒントだけを根拠にするか ----
// 隠れている黒マスの数字はプレイヤーに見えない。それを根拠に示すと
// 「押す理由が見当たらない場所」を指すことになる。
{
  const board = makeBoard(hexagon(4));
  let bad = 0, checked = 0, given = 0;
  for(let seed=1; seed<=10; seed++){
    const g = generate(board, { seed });
    if(!g) continue;
    // 開始直後の盤面を作る
    const state = new Array(board.size).fill(0);
    for(const rv of revealedFrom(g.hints)) state[rv[0]] = rv[1];
    // 解き進めながら、毎回HINTが妥当かを見る
    for(let step=0; step<40; step++){
      const res = nextStep(board, g.hints, state);
      if(!res) break;
      checked++; given++;
      for(const hi of res.hints){
        const h = g.hints[hi];
        if(h.kind === 'black' && !h.shown && state[h.owner] !== 2) bad++;  // まだ読めない
        if(h.count === null) bad++;                                        // ? は情報を持たない
      }
      state[res.cell] = res.value;
    }
  }
  ok(given > 0, `HINTが手を返している (${given}回)`);
  ok(bad === 0, `読めないヒントを根拠にしていない (違反 ${bad}件)`);
}

// ---- チュートリアルの進行 ----
// 規則を1つずつ教える設計なので、教える面より前にその記法が盤面へ出てはいけない。
// 種や生成の設定を触った時に、説明と盤面がずれたことをここで検出する。
{
  const { SHAPES } = await import('./shapes.mjs');
  // 正本(HTML)から定義を取り出す。テスト側に写しを持つと必ず食い違うため。
  const cut = (head, tail)=>{ const a = html.indexOf(head) + head.length;
    return html.slice(a, html.indexOf(tail, a)); };
  const STAGES = vm.runInNewContext("([" + cut("const STAGES = [", "  ];") + "])");
  const LESSONS = vm.runInNewContext("({" + cut("const LESSONS = {", "  };") + "})");

  // 面ごとに「出てよいもの」。順に解禁していく。
  const allowFrom = { blue:2, consec:3, split:4, silent:5 };
  const seen = { blue:0, consec:0, split:0, silent:0 };

  ok(STAGES.length === 6, 'チュートリアルは6面');
  STAGES.forEach((st, idx)=>{
    const no = idx + 1;
    ok(Array.isArray(LESSONS[st.key]) && LESSONS[st.key].length > 0,
       `${st.key}: 解説がある`);
    ok(st.seed !== undefined, `${st.key}: 盤面が固定されている`);

    let p = null, seed = st.seed;
    for(let a=0; a<40 && !p; a++, seed++){
      p = generate(makeBoard(SHAPES[st.key]), { seed, density:st.density,
            keepRatio:st.keepRatio, notation:st.notation,
            omitBlue:st.omitBlue, silentRatio:st.silentRatio });
    }
    ok(!!p, `${st.key}: 生成できる`);
    if(!p) return;

    const has = { blue:false, consec:false, split:false, silent:false };
    for(const h of p.hints){
      if(h.kind === 'blue') has.blue = true;
      if(h.mode === 'consec') has.consec = true;
      if(h.mode === 'split')  has.split = true;
      if(h.count === null)    has.silent = true;
    }
    for(const k of Object.keys(allowFrom)){
      if(has[k]) seen[k]++;
      ok(!has[k] || no >= allowFrom[k],
         `${no}. ${st.key}: 未習の ${k} が出ていない`);
    }
  });
  // 教えたものが一度も出ないのも困る(説明だけあって現物が無い状態)
  for(const k of Object.keys(allowFrom)) ok(seen[k] > 0, `${k} を実際に出す面がある`);

  // 出だしで詰まらせないため、どの面も「最初の一手」を示せる必要がある。
  // 誘導は nextStep をそのまま台本にしているので、初期状態で手が出るかを見る。
  STAGES.forEach((st, idx)=>{
    ok(st.guide !== undefined, `${idx+1}. ${st.key}: 誘導の設定がある`);
    let p = null, seed = st.seed;
    for(let a=0; a<40 && !p; a++, seed++){
      p = generate(makeBoard(SHAPES[st.key]), { seed, density:st.density,
            keepRatio:st.keepRatio, notation:st.notation,
            omitBlue:st.omitBlue, silentRatio:st.silentRatio });
    }
    if(!p) return;
    const b = makeBoard(SHAPES[st.key]);
    const init = new Array(b.size).fill(0);
    for(const rv of revealedFrom(p.hints)) init[rv[0]] = rv[1];
    ok(!!nextStep(b, p.hints, init), `${idx+1}. ${st.key}: 開いた直後に示せる一手がある`);
  });
}

// ---- 不定形の盤面 ----
// ∞モードとデイリーは種から輪郭を作る。デイリーは全員が同じ形である必要があり、
// 途切れた島や欠けたマス数があると盤面として成立しない。
{
  const cut = (head, tail)=>{ const a = html.indexOf(head) + head.length;
    return html.slice(a, html.indexOf(tail, a)); };
  // 正本から関数ごと取り出して動かす
  const shapeSrc = html.slice(html.indexOf('function shapeRnd(seed)'),
                             html.indexOf('// ---------- 盤面の再構築'));
  const DIRS_SRC = 'const DIRS=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];';
  const organicShape = vm.runInNewContext(
    DIRS_SRC + shapeSrc + ';organicShape');

  const key = c => c[0] + ',' + c[1];
  const connected = cells =>{
    const set = new Set(cells.map(key));
    const seen = new Set([key(cells[0])]);
    const stack = [cells[0]];
    const D = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
    while(stack.length){
      const c = stack.pop();
      for(const d of D){
        const p = [c[0]+d[0], c[1]+d[1]], k = key(p);
        if(set.has(k) && !seen.has(k)){ seen.add(k); stack.push(p); }
      }
    }
    return seen.size === set.size;
  };

  const SIZES_CELLS = [37, 61, 91, 127, 169, 271];
  for(const cells of SIZES_CELLS){
    const a = organicShape(12345, cells);
    ok(a.length === cells, `不定形 ${cells}: 指定どおりのマス数`);
    ok(new Set(a.map(key)).size === a.length, `不定形 ${cells}: 重複が無い`);
    ok(connected(a), `不定形 ${cells}: 盤面が途切れていない`);
    // 同じ種なら同じ形。デイリーのランキングはこれが前提
    const b = organicShape(12345, cells);
    ok(JSON.stringify(a) === JSON.stringify(b), `不定形 ${cells}: 同じ種なら同じ形`);
  }
  // 種が違えば形も変わる(毎回同じでは∞モードの意味が無い)
  let diff = 0;
  for(let s=1; s<=8; s++){
    if(JSON.stringify(organicShape(s, 91)) !== JSON.stringify(organicShape(s+100, 91))) diff++;
  }
  ok(diff === 8, '不定形: 種が違えば形も違う');

  // 実際に解ける盤面が作れること
  for(let s=1; s<=3; s++){
    const shape = organicShape(s * 777, 91);
    let p = null, seed = s * 31;
    for(let a=0; a<25 && !p; a++, seed++) p = generate(makeBoard(shape), { seed, density:0.44 });
    ok(!!p, `不定形 seed${s*777}: 推測なしで解ける盤面を生成できる`);
  }
}

console.log(`\n${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail ? 1 : 0);
