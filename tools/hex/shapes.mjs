// チュートリアル各面の盤面の形。分子の輪郭を六角格子へ落とし込む。
// 化学的な厳密さより「見て何の分子か分かる輪郭」を優先する。
const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

const ring = (cq, cr, R)=>{
  if(R === 0) return [[cq,cr]];
  const out = [];
  let q = cq + DIRS[4][0]*R, r = cr + DIRS[4][1]*R;
  for(let i=0;i<6;i++) for(let j=0;j<R;j++){
    out.push([q,r]); q += DIRS[i][0]; r += DIRS[i][1];
  }
  return out;
};
const disc = (cq, cr, R)=>{
  const out = [];
  for(let R2=0;R2<=R;R2++) out.push(...ring(cq,cr,R2));
  return out;
};
const chain = (q, r, dir, n)=>{
  const out = [];
  for(let i=0;i<n;i++){ out.push([q,r]); q += DIRS[dir][0]; r += DIRS[dir][1]; }
  return out;
};
const uniq = list =>{
  const seen = new Set(), out = [];
  for(const c of list){ const k = c[0]+','+c[1]; if(!seen.has(k)){ seen.add(k); out.push(c); } }
  return out;
};

export const SHAPES = {
  // 1. ベンゼン環。六角形の輪そのもので、このゲームの記号でもある
  benzene: uniq(ring(0,0,2)),

  // 2. グルコース。六員環に水酸基が生えた形
  glucose: uniq([...ring(0,0,2), ...chain(3,-1,0,1), ...chain(0,3,5,1), ...chain(-3,1,3,1), ...chain(2,-3,2,1)]),

  // 3. カフェイン。六員環と五員環が縮合した骨格＋メチル基3本
  caffeine: uniq([
    ...ring(0,0,2), ...ring(4,-2,2),
    ...chain(-3,1,3,2), ...chain(0,3,5,1), ...chain(6,-4,1,1)
  ]),

  // 4. アドレナリン。ベンゼン環から側鎖が伸びる
  adrenaline: uniq([
    ...ring(0,0,2), ...chain(3,-1,0,3), ...chain(-2,-1,2,1), ...chain(-3,1,3,1)
  ]),

  // 5. ヘキサミン。籠状の分子を、6方向へ均等に伸びる対称形として表す
  hexamine: uniq([
    ...ring(0,0,2), [0,0],
    ...DIRS.map(d=>[d[0]*3, d[1]*3])
  ]),

  // 6. グラフェン。炭素が六角格子に敷き詰まった構造そのもの
  graphene: uniq(disc(0,0,3))
};

export const STAGES = [
  { key:'benzene',    name:'ベンゼン',       formula:'C6H6',       level:'EASY',   keepRatio:0.55, density:0.42 },
  { key:'glucose',    name:'グルコース',     formula:'C6H12O6',    level:'EASY',   keepRatio:0.50, density:0.42 },
  { key:'caffeine',   name:'カフェイン',     formula:'C8H10N4O2',  level:'NORMAL', keepRatio:0.35, density:0.44 },
  { key:'adrenaline', name:'アドレナリン',   formula:'C9H13NO3',   level:'NORMAL', keepRatio:0.30, density:0.44 },
  { key:'hexamine',   name:'ヘキサミン',     formula:'(CH2)6N4',   level:'HARD',   keepRatio:0.10, density:0.44 },
  { key:'graphene',   name:'グラフェン',     formula:'C',          level:'HARD',   keepRatio:0.00, density:0.44 }
];
