(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BCData=factory();})(this,function(){
  'use strict';
  const schools={blood:{name:'血誓',color:'#e16c72'},bone:{name:'遺骨',color:'#d9c8a4'},plague:{name:'腐敗',color:'#94bc83'},storm:{name:'雷葬',color:'#e8c878'},occult:{name:'降霊',color:'#b89ae0'},body:{name:'肉体',color:'#bcb9b0'}};
  // 効果説明と実数値は同じデータを参照し、図鑑と選択画面の食い違いを防ぐ。
  const rows=[
    ['damage','骨髄の弾丸','bone',1,5,'弾の威力 +18%。','damage',.18],
    ['rate','狂った脈拍','blood',0,5,'射撃速度 +14%。','rate',.14],
    ['vitality','継ぎ接ぎの心臓','body',0,5,'最大生命 +18。生命を18回復。','hp',18],
    ['speed','這い寄る足音','body',11,4,'移動速度 +10%。','speed',.1],
    ['jump','鴉の羽根','occult',11,3,'ジャンプ力 +7%。空中ジャンプを1回追加。','jump',.07],
    ['armor','肋骨の聖衣','bone',14,5,'被ダメージを8%軽減。最大60%。','armor',.08],
    ['regen','縫合する肉','body',21,5,'毎秒、生命を0.4回復。','regen',.4],
    ['critical','見開く眼','blood',3,5,'会心率 +7%。会心は基本2倍。','crit',.07],
    ['critDamage','解剖学','bone',21,4,'会心ダメージ倍率 +0.4。','critPower',.4],
    ['bulletSpeed','穿つ針','bone',1,4,'弾速 +15%、弾の大きさ +8%。','bulletSpeed',.15],
    ['multishot','分裂する舌','blood',6,4,'同時発射 +1。各弾の威力は段階ごとに8%低下。','shots',1],
    ['pierce','貫く骨槍','bone',1,4,'敵を貫通する回数 +1。','pierce',1],
    ['bounce','反響する呪い','occult',4,3,'弾が壁で跳ね返る回数 +1。','bounce',1],
    ['homing','追悼の眼','occult',3,4,'弾が敵を追う強さ +1。','homing',1],
    ['lifesteal','吸血の歯','blood',6,5,'直撃時、4%の確率で生命を2回復。','leech',.04],
    ['explosion','破裂する臓腑','blood',0,4,'撃破時に爆発。半径54＋段階×5、威力は弾威力×段階×0.5。','explosion',1],
    ['ember','黒蝋の火','blood',2,5,'命中で燃焼。毎秒、弾威力の20%×段階。','burn',1],
    ['plague','疫病の聖水','plague',9,5,'命中で毒を蓄積（最大5重）。1重につき毎秒、弾威力の16%×段階。','poison',1],
    ['chill','墓場の冷気','occult',17,4,'命中した敵の移動・射撃速度を12%ずつ低下。','slow',.12],
    ['lightning','弔いの雷','storm',12,5,'3秒ごと、敵1体に弾威力×段階×1.6の雷撃。','lightning',1],
    ['conduit','罪の鎖','storm',4,4,'雷が連鎖する敵 +1。','chain',1],
    ['familiar','名もなき亡霊','occult',17,4,'自動攻撃する亡霊 +1。','familiar',1],
    ['echo','死者の復唱','occult',10,4,'20%ずつの確率で、威力55%の追撃を発射。','echo',.2],
    ['void','虚ろな聖痕','occult',22,4,'4秒ごとに1.8秒続く裂け目。毎秒、弾威力×段階の継続ダメージ。','void',1],
    ['gravity','底なしの棺','occult',22,4,'裂け目の範囲 +30、引き寄せる力を強化。','gravity',1],
    ['cleave','処刑人の鎌','bone',16,4,'2.5秒ごとに周囲を斬る。威力は弾威力×段階×2。','cleave',1],
    ['execution','首狩りの祈り','bone',5,4,'生命が5%×段階以下の雑魚を直撃で処刑。','execution',.05],
    ['spore','肉蛾の胞子','plague',19,4,'撃破時に毒霧。毎秒、弾威力×段階×0.35。','spore',1],
    ['barrier','骨の結界','bone',23,4,'8秒ごとに盾を6×段階回復。','barrier',1],
    ['thorns','茨の告解','blood',13,4,'被弾時、周囲へ弾威力×段階×3の報復。','thorns',1],
    ['dash','影渡り','occult',11,3,'回避の再使用時間 −15%、無敵時間 +0.04秒。','dash',1],
    ['cooldown','逆さの砂時計','storm',15,4,'雷・裂け目・鎌の発動間隔を10%短縮。','cooldown',.1],
    ['magnet','魂の呼び声','occult',17,3,'回復片の回収範囲 +65。','magnet',65],
    ['fortune','忌み子の幸運','storm',6,3,'毎回の強化候補 +1（最大6択）。','choices',1],
    ['growth','禁書の余白','occult',10,4,'以後、ウェーブ突破ごとに弾威力 +2%×段階。','growth',.02],
    ['sacrifice','血の契約','blood',7,3,'弾威力 +30%、最大生命 −12。','sacrifice',1],
    ['rage','瀕死の恍惚','blood',8,4,'失った生命の割合に応じて威力上昇。最大 +25%×段階。','rage',.25],
    ['split','骨の散華','bone',23,4,'直撃時に破片2個を放つ。各威力は弾威力×段階×0.18。','split',1],
    ['rebirth','不死の胎','body',20,1,'致死ダメージを一度だけ免れ、生命を50%回復。','rebirth',1],
    ['harvest','魂喰らい','plague',5,4,'ウェーブ報酬の遺灰 +25%×段階。','harvest',.25]
  ];
  const items=rows.map(([id,name,school,icon,max,desc,stat,value])=>({id,name,school,icon,max,desc,stat,value}));
  const evolutions=[
    {id:'bloodrain',name:'血の終末',school:'blood',icon:0,needs:{damage:3,lifesteal:2},desc:'全射撃が血の雨へ。威力 +45%、毎射撃で斜め上へ血弾を2発追加。'},
    {id:'ossuary',name:'千骨の大聖堂',school:'bone',icon:23,needs:{pierce:3,multishot:2},desc:'貫通 +6。骨弾が巨大化し、命中時の破片数が増加。'},
    {id:'pestilence',name:'腐敗の楽園',school:'plague',icon:9,needs:{plague:3,spore:2},desc:'毒威力3倍。毒を受けた敵の死で毒霧を残し、周囲へ毒を伝染させる。'},
    {id:'tempest',name:'葬雷の合唱',school:'storm',icon:12,needs:{lightning:3,conduit:2},desc:'雷の発動間隔を半減、連鎖 +4。雷が敵弾を消す。'},
    {id:'choir',name:'千の死者の聖歌',school:'occult',icon:17,needs:{familiar:3,echo:2},desc:'亡霊 +4、亡霊威力 +50%。霊弾が貫通し、追撃確率 +30%。'},
    {id:'eclipse',name:'臓物の日蝕',school:'occult',icon:22,needs:{void:3,gravity:2},desc:'裂け目が巨大な日蝕へ。範囲2倍、威力3倍、敵弾を吸収。'},
    {id:'phoenix',name:'灰より這うもの',school:'blood',icon:2,needs:{ember:3,rebirth:1},desc:'燃焼威力3倍。各ボス撃破で不死の胎の使用回数が1回戻る。'},
    {id:'butcher',name:'最後の解体者',school:'bone',icon:16,needs:{cleave:3,execution:2},desc:'鎌の範囲2倍・威力3倍。直撃で生命35%以下の雑魚を処刑。'}
  ];
  const resonances=[
    {id:'sanguine',name:'血の輪廻',school:'blood',pair:['bloodrain','phoenix'],desc:'燃焼中の敵への直撃で生命1回復（0.5秒に一度）。復活すると大奇跡が満ちる。'},
    {id:'boneMass',name:'万骨の処刑場',school:'bone',pair:['ossuary','butcher'],desc:'鎌が敵を捉えると、弾威力50%・貫通2の骨槍6本を上空へ放つ。'},
    {id:'rotMoon',name:'腐星蝕',school:'plague',pair:['pestilence','eclipse'],desc:'裂け目の内側を毒が侵す。範囲内の敵へ、0.35秒ごとに毒を1重与える。'},
    {id:'requiem',name:'弔鐘の大合唱',school:'storm',pair:['tempest','choir'],desc:'雷に撃たれた敵へ2秒間の葬印。亡霊が優先して狙い、霊弾の威力が35%上がる。'}
  ];
    const weapons=[
    {id:'lantern',name:'血灯の杖',icon:2,desc:'均整の取れた血弾。威力16 / 毎秒4発。',cost:0,damage:16,rate:4,color:'#fa828a',speed:530},
    {id:'needle',name:'骨縫いの針',icon:1,desc:'高速の貫通針。威力10 / 毎秒6発 / 貫通1。',cost:65,damage:10,rate:6,color:'#e9ddba',speed:760,pierce:1},
    {id:'censer',name:'腐臭の香炉',icon:9,desc:'毒を撒く三連弾。威力9 / 毎秒2.8回 / 毒1。',cost:110,damage:9,rate:2.8,color:'#a5d48b',speed:400,shots:2,poison:1},
    {id:'bell',name:'葬雷の鐘',icon:12,desc:'重い雷弾。威力28 / 毎秒2.2発 / 雷1。',cost:155,damage:28,rate:2.2,color:'#eed686',speed:600,lightning:1},
    {id:'book',name:'無名の経典',icon:10,desc:'追尾する霊弾。威力13 / 毎秒3.5発 / 亡霊1。',cost:210,damage:13,rate:3.5,color:'#cbb0ff',speed:410,homing:2,familiar:1},
    {id:'scythe',name:'解体者の骨',icon:16,desc:'大きな骨弾。威力38 / 毎秒1.8発 / 鎌1。',cost:280,damage:38,rate:1.8,color:'#eee0cc',speed:430,cleave:1,pierce:1}
  ];
  const ultimates={
    lantern:{name:'血の葬火',image:'ultimateA',row:0,desc:'全ての敵へ弾威力の16倍。即座に戦場を焼く。'},
    needle:{name:'万骨の雨',image:'ultimateA',row:1,desc:'全体へ8倍。続けて威力1.2倍の追尾骨槍を8本、空から降らせる。'},
    censer:{name:'腐肉の晩餐',image:'ultimateA',row:2,desc:'全体へ10倍。敵の集まる場所に4秒の腐蝕を残し、毎秒2倍で傷を刻む。'},
    bell:{name:'終祷の雷',image:'ultimateB',row:0,desc:'全体へ8倍。さらに近い敵6体までへ3倍の雷を3回落とす。'},
    book:{name:'死者の応答',image:'ultimateB',row:1,desc:'全体へ8倍。威力1.25倍の強く追う霊弾を8発放つ。'},
    scythe:{name:'処刑の円舞',image:'ultimateB',row:2,desc:'全体へ10倍。自分の周囲260以内の敵には、さらに8倍の斬撃。'}
  };
  const masks=[
    {id:'mourner',name:'葬送の仮面',icon:18,desc:'最大生命 +15。',cost:0,hp:15},
    {id:'crow',name:'鴉の仮面',icon:11,desc:'移動 +18%、空中ジャンプ +1。最大生命 −10。',cost:60,speed:.18,jumps:1,hp:-10},
    {id:'martyr',name:'殉教者の冠',icon:5,desc:'威力 +25%、最大生命 −25。',cost:100,damage:.25,hp:-25},
    {id:'surgeon',name:'縫合医の面',icon:21,desc:'毎秒生命 +0.7、被ダメージ −8%。',cost:150,regen:.7,armor:.08},
    {id:'oracle',name:'盲目の聖女',icon:3,desc:'強化候補 +1、リロール +2。',cost:200,choices:1,rerolls:2},
    {id:'hollow',name:'虚ろな王冠',icon:23,desc:'亡霊 +1、会心率 +12%、最大生命 −15。',cost:260,familiar:1,crit:.12,hp:-15}
  ];
  const meta=[
    {id:'heart',name:'心臓の祭壇',icon:0,max:8,cost:20,step:18,desc:'開始時の最大生命 +5 / 段階'},
    {id:'power',name:'骨の祭壇',icon:1,max:8,cost:25,step:20,desc:'開始時の威力 +4% / 段階'},
    {id:'tempo',name:'脈の祭壇',icon:15,max:6,cost:30,step:24,desc:'開始時の射撃速度 +3% / 段階'},
    {id:'mercy',name:'慈悲の祭壇',icon:19,max:5,cost:25,step:25,desc:'ウェーブ突破時の回復 +2 / 段階'},
    {id:'reroll',name:'運命の祭壇',icon:3,max:4,cost:35,step:35,desc:'1回の挑戦中のリロール +1 / 段階'},
    {id:'banish',name:'封印の祭壇',icon:10,max:3,cost:40,step:35,desc:'1回の挑戦中の能力封印 +1 / 段階'},
    {id:'vessel',name:'器の祭壇',icon:22,max:5,cost:30,step:30,desc:'必殺技の必要撃破数 −2 / 段階'},
    {id:'ashes',name:'遺灰の祭壇',icon:5,max:5,cost:30,step:30,desc:'獲得する遺灰 +5% / 段階'}
  ];
  const enemies=[
    {id:'heart',name:'心喰い',sprite:4,hp:25,speed:42,r:17,behavior:'float',desc:'左右に揺れ、足元へ血を落とす。'},
    {id:'nun',name:'口縫いの修道女',sprite:5,hp:36,speed:30,r:19,behavior:'aim',desc:'射線を合わせ、一発を狙って放つ。'},
    {id:'eye',name:'肉の監視者',sprite:6,hp:43,speed:45,r:20,behavior:'fan',desc:'三方向の弾を吐く。隙間を見極めろ。'},
    {id:'angel',name:'肋の天使',sprite:7,hp:60,speed:55,r:22,behavior:'dive',desc:'橙の予兆の後、あなたがいた場所へ突進する。'},
    {id:'leech',name:'血蛭の群れ',sprite:4,hp:17,speed:85,r:12,behavior:'chase',desc:'小さく速い追跡者。足を止めるな。'},
    {id:'cantor',name:'泣き歌い',sprite:5,hp:85,speed:26,r:24,behavior:'ring',desc:'円形の弾幕を歌う。'},
    {id:'watcher',name:'膿の預言者',sprite:6,hp:105,speed:28,r:25,behavior:'summon',desc:'心喰いを産み落とす。早めに葬れ。'},
    {id:'seraph',name:'失敗した救済',sprite:7,hp:130,speed:56,r:28,behavior:'burst',desc:'連続する扇弾を放つ精鋭。'}
  ];
  const bosses=[
    {id:'bishop',name:'縫い眼の司教',subtitle:'THE BISHOP OF SUTURED EYES',sprite:8,hp:1800,r:65,behavior:'bishop',desc:'瞼を縫い、信徒の内側だけを見るようになった司教。法衣に開いた眼は、彼らが最後に見たもの。',tactic:'狙い扇弾の間へ。三度目の祈りには全方位弾。'},
    {id:'butcher',name:'告解の解体者',subtitle:'THE CONFESSOR',sprite:9,hp:3600,r:61,behavior:'butcher',desc:'告白した罪を、肉ごと切り離す役目だった。いまは誰の声も聞こえず、刃だけが儀式を覚えている。',tactic:'縦の予告から横へ退く。後半は対称の位置にも柱。'},
    {id:'choir',name:'眼球の聖歌隊',subtitle:'THE WATCHING CHOIR',sprite:10,hp:6200,r:68,behavior:'choir',desc:'声を失った信徒の眼だけを、祭具に縫いつけた聖歌隊。瞬くたび、まだ生きていた頃の賛歌が漏れる。',tactic:'回転する環の隙間へ。呼び出す修道女にも注意。'},
    {id:'god',name:'脈打つ神',subtitle:'THE GOD BENEATH',sprite:11,hp:10500,r:72,behavior:'god',desc:'信仰を食べて、心臓だけになった神。聖堂に響く鼓動は祈りではない。もう終わらせてほしいという、最後の願い。',tactic:'円弾と狙い弾が重なる。柱を見て回避か大奇跡。'}
  ];
  bosses.push({id:'oblivion',name:'忘却の弔鐘',subtitle:'THE BELL OF OBLIVION',sprite:12,hp:24000,r:74,behavior:'oblivion',desc:'神が沈黙しても、地下の鐘は鳴り続けた。祈りを忘れた信徒の骨で鋳られ、聖堂に残った声を飲み込む。第64波で待つ、葬列の最深部。',tactic:'青白い道が音紋の隙間。三度目は二重に響く。後半は両端の柱にも注意。'});
  bosses.push({id:'reliquary',name:'緋の聖櫃',subtitle:'THE CRIMSON RELIQUARY',sprite:13,hp:30000,r:70,behavior:'reliquary',desc:'神の死さえ、聖遺物に変えてしまう棺。誰もいない内側から、血の光だけが漏れ続ける。第96波で待つ、封じられた祈り。',tactic:'赤い横線は跳躍や落下で外す。後半は高さの違う線が続く。'});
  const practiceWaves=[8,16,24,32,64,96];
  const bossForWave=wave=>bosses[wave>=64&&wave%64===0?4:wave>=96&&wave%64===32?5:(Math.max(0,Math.floor(wave/8)-1)%4)];
  function bestiaryProgress(id,amount=0){
    if(![...enemies,...bosses].some(d=>d.id===id))return null;
    const count=Math.max(0,Math.min(1e9,Number.isFinite(amount)?Math.floor(amount):0)),thresholds=bosses.some(d=>d.id===id)?[1,3,7]:[10,50,200],tier=thresholds.filter(n=>count>=n).length,next=thresholds[tier]||thresholds[2];
    return{count,tier,thresholds,next,remaining:Math.max(0,next-count),progress:Math.min(1,count/next),label:['まだ刻まれぬ印','血痕の印','骨碑の印','黒冠の印'][tier]};
  }
  const crowns=[{"id":"blood","name":"血冠","hp":1.8,"speed":1.15,"shot":0.82,"reward":4,"color":"#e66e7f","desc":"生命1.8倍。移動が15%、射撃が約22%速い。撃破で追加4遺灰。"},{"id":"bone","name":"骨冠","hp":2.5,"speed":0.75,"shot":1,"reward":5,"color":"#ddcdaa","desc":"生命2.5倍。移動は25%遅い。撃破で追加5遺灰。"},{"id":"curse","name":"呪冠","hp":1.6,"speed":1,"shot":1,"reward":5,"color":"#ca9cea","desc":"生命1.6倍。紫の予告後に8方向へ呪弾を放つ。撃破で追加5遺灰。"}];
  const achievements=[
    ['crownbreaker','冠を砕く者','冠を戴く異形を累計12体葬る',p=>p.crownKills>=12,100],
    ['first','初めての葬送','最初のウェーブを突破',p=>p.best>=1,10],['eight','司教の沈黙','第8波を突破',p=>p.best>=8,30],['sixteen','解体完了','第16波を突破',p=>p.best>=16,45],['twentyfour','歌声の終わり','第24波を突破',p=>p.best>=24,60],['clear','神殺し','第32波を突破',p=>p.best>=32,100],['endless','終わらない葬列','第48波を突破',p=>p.best>=48,150],
    ['reliquary','棺の内側の祈り','緋の聖櫃を葬る',p=>p.reliquaryKills>0,650],
    ['oblivion','最後の鐘を止める','忘却の弔鐘を葬る',p=>p.secretKills>0,500],
    ['hundred','百の墓標','累計100体撃破',p=>p.kills>=100,20],['thousand','千の墓標','累計1,000体撃破',p=>p.kills>=1000,60],['tenk','万人の墓所','累計10,000体撃破',p=>p.kills>=10000,200],
    ['evolve','異端への変貌','進化を1種発見',p=>p.evolutions.length>=1,30],['evolve4','禁忌の探求者','進化を4種発見',p=>p.evolutions.length>=4,80],['evolve8','深淵を知る者','進化を8種発見',p=>p.evolutions.length>=8,180],
    ['relic20','蒐集家','強化を20種発見',p=>p.discovered.length>=20,40],['relic40','禁書の完成','強化を40種発見',p=>p.discovered.length>=40,100],['weapons','六つの弔具','弔具を全て解放',p=>p.weapons.length===6,100],['masks','六つの顔','仮面を全て解放',p=>p.masks.length===6,100],
    ['altar','深い祈り','祭壇を計20段階強化',p=>Object.values(p.meta).reduce((a,b)=>a+b,0)>=20,70],['ten','繰り返す夜','10回の挑戦を終える',p=>p.runs>=10,50],['abyss','深淵の王','深度Vで神を葬る',p=>p.clearedDifficulty>=4,200]
  ].map(([id,name,desc,test,reward])=>({id,name,desc,test,reward}));
  const achievementTracks={
    crownbreaker:['crownKills',12,'体',1],first:['best',1,'波',0],eight:['best',8,'波',0],sixteen:['best',16,'波',0],twentyfour:['best',24,'波',0],clear:['best',32,'波',0],endless:['best',48,'波',0],
    reliquary:['reliquaryKills',1,'体',0],oblivion:['secretKills',1,'体',0],hundred:['kills',100,'体',1],thousand:['kills',1000,'体',1],tenk:['kills',10000,'体',1],
    evolve:['evolutions',1,'種',2],evolve4:['evolutions',4,'種',2],evolve8:['evolutions',8,'種',2],relic20:['discovered',20,'種',3],relic40:['discovered',40,'種',3],
    weapons:['weapons',6,'種',4],masks:['masks',6,'種',4],altar:['meta',20,'段階',5],ten:['runs',10,'回',6],abyss:['clearedDifficulty',5,'深度',5]
  };
  function achievementProgress(p,id){
    const t=achievementTracks[id];if(!t)return null;const [key,target,unit,art]=t,raw=key==='meta'?Object.values(p.meta).reduce((n,v)=>n+v,0):key==='clearedDifficulty'?p.clearedDifficulty+1:Array.isArray(p[key])?p[key].length:p[key];
    const current=p.achievements.includes(id)?target:Math.max(0,Math.min(target,Number.isFinite(raw)?raw:0));return{current,target,unit,art,remaining:target-current,ratio:current/target};
  }
  function achievementTarget(p){
    const chosen=achievements.find(a=>a.id===p.achievementGoal);if(chosen)return chosen;
    // 初回は一波突破を案内し、その後は未達成のうち最も進んでいる祈りを示す。
    if(!p.achievements.includes('first'))return achievements.find(a=>a.id==='first');
    return achievements.filter(a=>!p.achievements.includes(a.id)).sort((a,b)=>achievementProgress(p,b.id).ratio-achievementProgress(p,a.id).ratio)[0]||null;
  }
  const covenants=[
    {id:'glass',name:'硝子の心臓',icon:0,desc:'弾威力 +40%。最大生命 −25。'},
    {id:'hunger',name:'飢えの聖体',icon:6,desc:'撃破ごとに生命を1回復。弾威力 −12%。'},
    {id:'vigil',name:'眠らぬ弔鐘',icon:12,desc:'雷・裂け目・鎌の発動間隔 −28%。回避の再使用時間 +30%。'},
    {id:'chalice',name:'空の聖杯',icon:7,desc:'大奇跡の必要撃破数 −8。最大生命 −15。'},
    {id:'marrow',name:'骨の牢獄',icon:23,desc:'被ダメージ −12%。移動速度 −10%。'},
    {id:'pilgrim',name:'黄金の葬列',icon:5,desc:'ウェーブの遺灰 +40%。以後、雑魚の生命 +15%。'}
  ];
  const zones=['骨の礼拝堂','解体の回廊','盲目の聖歌堂','脈打つ最深部'];
  const damageSources=[
    {id:'main',name:'弔具の直撃',color:'#c57780'},
    {id:'shard',name:'骨片',color:'#ccbaa3'},
    {id:'familiar',name:'亡霊の弾',color:'#bba1da'},
    {id:'lightning',name:'葬雷',color:'#d6ba72'},
    {id:'cleave',name:'骨鎌',color:'#d8c9a8'},
    {id:'dot',name:'炎・毒・胞子',color:'#9fb77c'},
    {id:'void',name:'虚無の裂け目',color:'#a283ca'},
    {id:'blast',name:'死裂の爆発',color:'#d08b63'},
    {id:'thorns',name:'茨の反撃',color:'#b08396'},
    {id:'ultimate',name:'葬送の大奇跡',color:'#e1b69e'}
  ];
  const itemArt={"vitality":{"image":"relicA","index":0},"rate":{"image":"relicA","index":1},"lifesteal":{"image":"relicA","index":2},"multishot":{"image":"relicA","index":3},"critical":{"image":"relicA","index":4},"explosion":{"image":"relicA","index":5},"ember":{"image":"relicA","index":6},"sacrifice":{"image":"relicA","index":7},"damage":{"image":"relicB","index":0},"armor":{"image":"relicB","index":1},"critDamage":{"image":"relicB","index":2},"bulletSpeed":{"image":"relicB","index":3},"pierce":{"image":"relicB","index":4},"cleave":{"image":"relicB","index":5},"execution":{"image":"relicB","index":6},"split":{"image":"relicB","index":7},"bounce":{"image":"relicC","index":0},"homing":{"image":"relicC","index":1},"chill":{"image":"relicC","index":2},"familiar":{"image":"relicC","index":3},"echo":{"image":"relicC","index":4},"void":{"image":"relicC","index":5},"gravity":{"image":"relicC","index":6},"dash":{"image":"relicC","index":7},"speed":{"image":"relicD","index":0},"jump":{"image":"relicD","index":1},"regen":{"image":"relicD","index":2},"barrier":{"image":"relicD","index":3},"thorns":{"image":"relicD","index":4},"cooldown":{"image":"relicD","index":5},"magnet":{"image":"relicD","index":6},"fortune":{"image":"relicD","index":7},"plague":{"image":"relicE","index":0},"lightning":{"image":"relicE","index":1},"conduit":{"image":"relicE","index":2},"spore":{"image":"relicE","index":3},"growth":{"image":"relicE","index":4},"rage":{"image":"relicE","index":5},"rebirth":{"image":"relicE","index":6},"harvest":{"image":"relicE","index":7}};
  return{bestiaryProgress,achievementProgress,achievementTarget,practiceWaves,crowns,itemArt,schools,items,evolutions,resonances,weapons,ultimates,masks,meta,enemies,bosses,bossForWave,achievements,covenants,zones,damageSources,version:1,W:960,H:540,FLOOR:428,
  // 遺灰の落とし物ひとつの量と、床に残る秒数。実績の報酬は額面のこの割合。
  ASH:{drop:1,medal:.2,life:32},
  // 遊び方ごとの手応えと実入り。
  // 葬送：32波で終わる。敵は硬くよく撃ち、冠付きも早く多い。遺灰は四体の主からだけで、深度が深いほど多い。
  // 無限：底は無い。立ち上がりは穏やかで、32波を越えると主も雑魚も一波ごとに deep 倍ずつ硬くなり、撃つ間隔も詰まりつづける。
  //       遺灰は低確率の落とし物だけ。
  // deep は32波より先の一波ごとの硬さの倍率、rapid は射撃の速さの上限。
  MODES:{
    stage:{hp:1.25,grow:.09,bossHp:1.2,deep:1.035,rapid:2.2,fire:.8,hit:1.2,crownFrom:4,crownEvery:2,crownStep:13,bossAsh:25,depthAsh:.25,drop:0},
    endless:{hp:1,grow:.075,bossHp:1,deep:1.08,rapid:3.5,fire:1,hit:1,crownFrom:9,crownEvery:3,crownStep:16,bossAsh:0,depthAsh:0,drop:.02}
  }};
});
