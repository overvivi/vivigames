(function(){
  'use strict';
  const D=window.BCData,C=window.BCCore,$=s=>document.querySelector(s),qa=new URLSearchParams(location.search).get('qa')==='1';
  const KEY='blood-choir.profile.v1'+(qa?'.qa':''),RUNKEY='blood-choir.run.v1'+(qa?'.qa':'');
  if(qa)document.body.classList.add('qa-mode');
  let profilePending=false,storageOK=true,run=null,paused=false,panelMode='',lastFocus=null,checkpoint=null,toastTimer,combatTimer,selectionDifficulty=0,codexTab='items',loadoutTab='weapon',settlement=[],lastState='',qaGod=false;
  const saves=new window.BCStorage.SaveStore({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem:k=>localStorage.removeItem(k)},KEY,RUNKEY,()=>{storageOK=false;$('#save-warning').hidden=false;});
  function read(key){return saves.read(key);}
  function write(key,value){return saves.write(key,value);}
  // 保存の案内が折り返しても、背後の閉じる・設定操作を覆わない高さを確保する。
  const noticeObserver=new ResizeObserver(()=>{const notice=$('#save-warning');notice.style.top=$('#topbar').getBoundingClientRect().bottom+'px';document.documentElement.style.setProperty('--save-notice-height',(notice.hidden?0:notice.getBoundingClientRect().height)+'px');});
  noticeObserver.observe($('#save-warning'));noticeObserver.observe($('#topbar'));
  const stored=saves.readState(),profile=C.normalizeProfile(stored.profile);checkpoint=stored.checkpoint;if(checkpoint&&!C.Run.restore(checkpoint)){checkpoint=null;write(RUNKEY,null);}
  if(checkpoint&&profile.settled.includes(checkpoint.id)){checkpoint=null;write(RUNKEY,null);}
  const renderer=new window.BCRenderer($('#game')),audio=new window.BCAudio.Audio();
  const controller=new window.BCController.Controller();let padUsed=false,padState={connected:false,move:0};
  let touchMode=matchMedia('(pointer:coarse)').matches;
  let pendingImport=null,training=null;
  const TOUCH={dead:9,span:74,tapMs:230,tapSlip:15};
  const points=new Map();let stickId=null,touchAxis=0,hintTimer=0,tapTimer=0;
  const keys=new Set(),input={move:0,aimX:480,aimY:140,fire:false,autoAim:true,jump:false,dash:false,ultimate:false};let mouseDown=false,mouseInside=false;
  function saveProfile(){if(!write(KEY,profile))return false;profilePending=false;if(checkpoint&&profile.settled.includes(checkpoint.id)){checkpoint=null;write(RUNKEY,null);}return true;}
  function settleRun(value){const awards=C.settle(profile,value);profilePending=true;saveProfile();return awards;}
  function settlePrevious(){if((profilePending||saves.recovery)&&!saveProfile()){toast('前の記録を保存できていません。再保存か、設定からの書き出しで記録を保管できます。');return false;}if(checkpoint){const old=C.Run.restore(checkpoint);if(old)settleRun(old);if(profilePending){toast('中断した葬送を保存できないため、新しい挑戦を止めています。再保存を試してください。');return false;}}return true;}
  function retrySave(){if(saveProfile()&&write(RUNKEY,checkpoint)){storageOK=true;$('#save-warning').hidden=true;toast('記録を保存し直しました。');if(!run)title();}else toast('まだ保存できません。設定から記録を書き出せます。');}
  function buy(type,id){
    const before=JSON.parse(JSON.stringify(profile));if(!C.purchase(profile,type,id))return;
    // 全弔具の解放などで同時に達成する実績と報酬も、購入と同じ単位で戻す。
    if(!saveProfile()){Object.assign(profile,before);toast('解放や選択を保存できないため、変更を取り消しました。');}
    else{titleGoal();audio.play('select');}
    if(type==='meta')altar();else loadout();
  }
  // 遺灰が実際に減るときだけ、確認を挟む。持っている装備の付け替えは無料なので素通しする。
  function purchaseCost(type,id){
    const defs=type==='weapon'?D.weapons:type==='mask'?D.masks:type==='meta'?D.meta:null;
    const d=defs?.find(x=>x.id===id);if(!d)return null;
    if(type==='meta'){const level=profile.meta[id]||0;return level>=d.max?null:{d,cost:d.cost+d.step*level};}
    return profile[type+'s'].includes(id)?null:{d,cost:d.cost};
  }
  function confirmBuy(type,id){
    const info=purchaseCost(type,id);
    if(!info){buy(type,id);return;}
    if(profile.ashes<info.cost)return;
    show('confirmBuy',header(type==='meta'?'AN OFFERING AT THE ALTAR':'A RELIC UNSEALED',info.d.name,'',false)
      +'<div class="buy-confirm">'+art(info.d)+'<div><p>'+info.d.desc+'</p><p class="buy-price"><b>'+fmt(info.cost)+'</b> の遺灰を捧げる<small>手元に '+fmt(profile.ashes)+'</small></p></div></div>'
      +'<div class="panel-actions"><button class="primary" data-action="commitBuy" data-type="'+type+'" data-id="'+id+'">捧げる</button><button data-action="'+(type==='meta'?'altar':'loadout')+'">やめる</button></div>',true);
  }
  function saveRun(){if(run&&!run.training&&['playing','upgrade','victory'].includes(run.state)){checkpoint=run.checkpoint();write(RUNKEY,checkpoint);}}
  function icon(n,extra=''){return'<span aria-hidden="true" class="relic-icon '+extra+'" style="background-position:'+(n%6*20)+'% '+(Math.floor(n/6)*100/3)+'%"></span>';}
  function art(d,extra=''){const devotion=D.weapons.includes(d)?'weapons':D.covenants.includes(d)?'covenants':D.meta.includes(d)?'altars':null;if(devotion)return'<canvas aria-hidden="true" data-devotion="'+devotion+'" data-id="'+d.id+'" class="relic-icon devotion-art '+extra+'" width="256" height="256"></canvas>';if(D.itemArt[d.id])return'<canvas aria-hidden="true" data-item-art="'+d.id+'" class="relic-icon item-art '+extra+'" width="256" height="256"></canvas>';if(d.pair){const i=D.resonances.findIndex(r=>r.id===d.id);return'<span aria-hidden="true" class="relic-icon resonance-art '+extra+'" style="background-position:'+(i%2*100)+'% '+(Math.floor(i/2)*100)+'%"></span>';}const n=D.evolutions.findIndex(e=>e.id===d.id);return d.needs&&n>=0?'<span aria-hidden="true" class="relic-icon evolution-art '+extra+'" style="background-position:'+(n%4*100/3)+'% '+(Math.floor(n/4)*100)+'%"></span>':icon(d.icon,extra);}
  function ritualCard(weapon){const d=D.ultimates[weapon];return'<div class="ritual-card"><canvas data-ritual="'+weapon+'" width="120" height="120" aria-hidden="true"></canvas><div><small>この弔具の大奇跡</small><h3>'+d.name+'</h3><p>'+d.desc+'</p><small>共通：敵弾と柱を消す · 1.2秒の無敵</small></div></div>';}
  function resonanceSection(evolved,highlight=null){
    const list=D.resonances.filter(d=>d.pair.every(id=>evolved.includes(id))&&(!highlight||highlight.includes(d.id)));if(!list.length)return'';
    return'<section class="resonance-section"><h3 class="section-label">'+(highlight?'共鳴が、目を覚ます。':'発現した共鳴')+'</h3><div class="resonance-list">'+list.map(d=>'<div class="resonance-entry">'+art(d)+'<div><h3>'+d.name+'</h3><p>'+d.desc+'</p><small>'+d.pair.map(id=>C.lookup[id].name).join(' × ')+'</small></div></div>').join('')+'</div></section>';
  }
  function fmt(n){return Math.floor(n).toLocaleString('ja-JP');}
  function damageReport(tally){
    const parts=D.damageSources.map(d=>({...d,value:tally?.[d.id]||0})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value),total=parts.reduce((n,d)=>n+d.value,0);if(!total)return'';
    return'<section class="damage-report" aria-label="能力ごとのダメージ"><h3 class="section-label">与えた傷の内訳 <span>'+fmt(total)+'</span></h3><div class="damage-grid">'+parts.map(d=>'<div class="damage-row"><div><span>'+d.name+'</span><b>'+fmt(d.value)+' <small>'+Math.round(d.value/total*100)+'%</small></b></div><i><b style="width:'+(d.value/total*100).toFixed(2)+'%;background:'+d.color+'"></b></i></div>').join('')+'</div><p class="minor">実際に削った生命だけを数える。処刑は直撃に、炎と毒と胞子はまとめて。</p></section>';
  }
  function minutes(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');}
  function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
  function combat(text,minor=false){$('#combat-toast').classList.toggle('minor-notice',minor);$('#combat-toast').textContent=text;$('#combat-toast').classList.add('show');clearTimeout(combatTimer);combatTimer=setTimeout(()=>$('#combat-toast').classList.remove('show'),2100);}
  function padFocus(direction){
    const root=$('#overlay').hidden?$('#title-screen'):$('#panel'),nodes=[...root.querySelectorAll('button:not(:disabled),select,input:not([hidden]),summary')].filter(e=>{const closed=e.closest('details:not([open])');return e.getClientRects().length&&(!closed||closed.querySelector('summary')===e);});
    if(!nodes.length)return;const current=document.activeElement;
    if(!nodes.includes(current)){(nodes.find(e=>e.classList.contains('primary'))||nodes[0]).focus();return;}
    if(['left','right'].includes(direction)&&current.matches('select,input[type="range"]')){
      if(current.tagName==='SELECT'){const options=[...current.options].filter(o=>!o.disabled),index=options.indexOf(current.selectedOptions[0]);current.value=options[C.clamp(index+(direction==='right'?1:-1),0,options.length-1)].value;current.dispatchEvent(new Event('input',{bubbles:true}));current.dispatchEvent(new Event('change',{bubbles:true}));}
      else{current.value=Number(current.value)+(direction==='right'?1:-1)*Number(current.step||1);current.dispatchEvent(new Event('input',{bubbles:true}));}return;
    }
    // 長いフォームと道程のページ操作は、画面上の距離より欄の順番を優先する。
    if(['up','down'].includes(direction)&&(['setup','settings'].includes(panelMode))){const next=nodes[C.clamp(nodes.indexOf(current)+(direction==='down'?1:-1),0,nodes.length-1)];next.focus({preventScroll:true});next.scrollIntoView({block:'nearest',inline:'nearest'});return;}
    const a=current.getBoundingClientRect(),cx=a.x+a.width/2,cy=a.y+a.height/2,horizontal=['left','right'].includes(direction),sign=['left','up'].includes(direction)?-1:1;
    const candidates=nodes.filter(e=>e!==current).map(e=>{const b=e.getBoundingClientRect(),dx=b.x+b.width/2-cx,dy=b.y+b.height/2-cy,forward=(horizontal?dx:dy)*sign,side=Math.abs(horizontal?dy:dx);return{e,forward,rank:forward+side*3};}).filter(x=>x.forward>4).sort((a,b)=>a.rank-b.rank);
    if(candidates.length){candidates[0].e.focus({preventScroll:true});candidates[0].e.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  function pollController(dt){
    let pads=[];try{pads=navigator.getGamepads?.()||[];}catch{}padState=controller.read(pads,dt);
    if(padState.lost&&padUsed){padUsed=false;if(run&&!paused){pause();toast('コントローラーが外れたため、休息しています。');}}
    if(document.hidden||!document.hasFocus())return;
    if(padState.active){if(!padUsed)audio.unlock();padUsed=true;touchMode=false;}
    
    $('#sound-unlock').hidden=!(padUsed&&run&&!paused&&audio.ctx?.state==='suspended');
    if(!padState.connected)return;
    if(padState.pause&&run){if(panelMode==='pause')$('#panel [data-action="backToRun"]').click();else pause();return;}
    if(!run||paused){
      if(padState.nav)padFocus(padState.nav);
      if(padState.confirm){const root=$('#overlay').hidden?$('#title-screen'):$('#panel');if(!root.contains(document.activeElement)||!document.activeElement.matches('button,input,summary'))padFocus('down');if(root.contains(document.activeElement)&&document.activeElement.matches('button,input[type="checkbox"],summary'))document.activeElement.click();}
      if(padState.back&&!$('#overlay').hidden)close();
    }else{input.jump||=padState.jump;input.dash||=padState.dash;input.ultimate||=padState.ultimate;}
  }
  function resetInput(){if(run?.p)run.p.jumpBuffer=0;keys.clear();releaseTouch();mouseDown=false;mouseInside=false;input.move=0;input.fire=false;input.jump=input.dash=input.ultimate=false;document.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));}
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else{
        await document.documentElement.requestFullscreen();
        // 端末が許せば横へ固定する。iOSのSafariは対応していないので黙って諦める。
        try{await screen.orientation?.lock?.('landscape');}catch{}
      }
    }catch{toast('この画面では全画面に切り替えられませんでした。');}
  }
  if(!document.fullscreenEnabled)$('#fullscreen-button').hidden=true;
  document.addEventListener('fullscreenchange',()=>$('#fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'全画面を終了':'全画面'));
  function title(){
    run=null;training=null;$('#training-hint').hidden=true;paused=false;lastState='';hidePanel();resetInput();$('#title-screen').hidden=false;$('#play-screen').hidden=true;
    $('#title-buttons').innerHTML=(checkpoint&&!profile.settled.includes(checkpoint.id)?'<button class="primary" data-action="continue">葬列を続ける <small>第'+checkpoint.wave+'波</small></button><button data-action="start">新たな葬送</button>':'<button class="primary" data-action="start">葬送を始める</button>')+'<button data-action="endlessRun">無限の葬送</button>';
    $('#title-stats').textContent='最深 '+profile.best+' 波　 ·　遺灰 '+fmt(profile.ashes)+'　 ·　禁忌 '+profile.evolutions.length+'/8';titleGoal();audio.set(profile.settings,false);
  }
  function achievementArt(id){return'<canvas data-achievement="'+id+'" width="128" height="128" aria-hidden="true"></canvas>';}
  function achievementMeter(d){const p=D.achievementProgress(profile,d.id);return'<div class="achievement-meter" role="progressbar" aria-label="'+d.name+'の進行" aria-valuemin="0" aria-valuemax="'+p.target+'" aria-valuenow="'+p.current+'"><i style="width:'+p.ratio*100+'%"></i></div><div class="achievement-count"><span>'+fmt(p.current)+' / '+fmt(p.target)+' '+p.unit+'</span><small>'+(profile.achievements.includes(d.id)?'達成済み':p.remaining?'あと '+fmt(p.remaining)+' '+p.unit:'帰還時に記録')+'</small></div>';}
  function titleGoal(){
    const root=$('#title-goal'),d=D.achievementTarget(profile);if(!root)return;
    if(!d){root.innerHTML='<p class="all-achievements">すべての祈りを、刻んだ。<br><small>実績 '+D.achievements.length+' / '+D.achievements.length+'</small></p>';return;}
    const earned=profile.achievements.includes(d.id);root.innerHTML='<button data-action="achievementDetail" data-id="'+d.id+'" class="title-goal-button">'+achievementArt(d.id)+'<span><small>'+(earned?'祈りは、刻まれた':profile.achievementGoal?'狙っている実績':'次の祈り')+'</small><strong>'+d.name+'</strong><span class="goal-desc">'+d.desc+'</span>'+achievementMeter(d)+'<em>'+(earned?'次の目標を選ぶ ›':'達成報酬 '+d.reward+' 遺灰　›')+'</em></span></button>';paintPortraits(root);
  }
  function pinAchievement(id){
    const d=D.achievements.find(a=>a.id===id);if(!d||profile.achievements.includes(id)||profile.achievementGoal===id)return;
    const top=$('#panel').scrollTop;profile.achievementGoal=id;saveProfile();codex();$('#panel').scrollTop=top;$('#achievement-'+id+' button')?.focus({preventScroll:true});titleGoal();audio.play('select');toast('目標：'+d.name);
  }
  function header(en,jp,desc='',close=true){return'<div class="panel-header"><div><div class="eyebrow">'+en+'</div><h2 id="panel-title">'+jp+'</h2>'+(desc?'<p>'+desc+'</p>':'')+'</div>'+(close?'<button class="close-panel" data-action="close" aria-label="閉じる">×</button>':'')+'</div>';}
  function show(mode,html,narrow=false){
    if($('#overlay').hidden)lastFocus=document.activeElement;
    panelMode=mode;paused=!!run;resetInput();$('#panel').className=narrow?'narrow':'';$('#panel').dataset.mode=mode;$('#panel').innerHTML=html;$('#overlay').hidden=false;$('#panel').scrollTop=0;$('#panel').focus({preventScroll:true});audio.set(profile.settings,false);paintPortraits();
  }
  function hidePanel(){panelMode='';$('#overlay').hidden=true;$('#panel').innerHTML='';if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  function resume(){if(!run)return;paused=false;hidePanel();resetInput();$('#game').focus({preventScroll:true});audio.resume();audio.set(profile.settings,true);}
  function close(){
    if(!run){hidePanel();return;}
    if(run.state==='upgrade'){upgrade();return;}
    if(run.state==='victory'){victory();return;}
    if(run.state==='dead'){results();return;}
    pause();
  }
  function setup(endless){
    const w=D.weapons.find(w=>w.id===profile.weapon),m=D.masks.find(m=>m.id===profile.mask);
    selectionDifficulty=C.clamp(selectionDifficulty,0,Math.min(4,profile.clearedDifficulty+1));
    let content=header(endless?'NO END BELOW':'DESCENT INTO THE CHOIR',endless?'無限の葬送':'葬送の支度',endless?'底は無い。どこまで潜れるか、それだけ。':'神は死ななかった。ただ、地下で腐り始めた。');
    if(endless)content+='<p class="help-copy">第32波で終わらない。敵は増えつづけ、硬くなりつづける。</p>';
    content+='<div class="codex-row">'+art(w)+'<canvas class="setup-costume" data-mask="'+m.id+'" width="120" height="120" aria-hidden="true"></canvas>'+'<p class="help-copy">'+w.name+' × '+m.name+'<br><button data-action="loadout">装備を変える</button></p></div><div class="setup-options"><div><label class="minor" for="difficulty">深度</label><select id="difficulty" class="option-select">'+['I — 地下聖堂','II — 異端の夜','III — 血の巡礼','IV — 神の臓腑','V — 最後の告解'].map((x,i)=>'<option value="'+i+'" '+(i>profile.clearedDifficulty+1?'disabled':'')+(i===selectionDifficulty?' selected':'')+'>'+x+(i>profile.clearedDifficulty+1?'（前の深度クリアで解放）':'')+'</option>').join('')+'</select></div>';
    content+='</div>';

    content+=ritualCard(w.id);
    if(checkpoint)content+='<p class="minor">新たに始めれば、中断中の葬送は終わる。遺灰は持ち帰る。</p>';
    content+='<p class="help-copy">照準も射撃も、はじめは自動。避けることに集中すればいい。</p><div class="panel-actions"><button class="primary" data-action="begin" data-endless="'+!!endless+'">聖堂へ降りる</button><button data-action="training">操作を試す</button></div>';
    show('setup',content,true);
  }
  function begin(endless){
    if(!settlePrevious())return;
    run=new C.Run({endless:!!endless,seed:crypto.getRandomValues(new Uint32Array(1))[0],weapon:profile.weapon,mask:profile.mask,meta:profile.meta,difficulty:selectionDifficulty});
    openRun();saveRun();
  }
  function openRun(){
    $('#play-screen').classList.toggle('training-mode',!!run.training);
    // 再挑戦や試射の計測し直しへ、前の戦闘の数字・閃光・揺れを持ち越さない。
    $('#title-screen').hidden=true;$('#play-screen').hidden=false;flashTouchHint();lastState='';settlement=[];renderer.effects=[];renderer.motes=[];renderer.stains=[];renderer.numbers=[];renderer.flash=0;renderer.shake=0;audio.unlock();resume();hud(true);
    if(run.state==='upgrade')upgrade();else if(run.state==='victory')victory();
  }
  function continueRun(){if(saves.recovery&&!saveProfile()){toast('元の記録を戻す処理が保存待ちです。再保存を試してください。');return;}if(checkpoint&&profile.settled.includes(checkpoint.id)){toast('終了した挑戦の保存を待っています。再保存を試してください。');return;}const restored=C.Run.restore(checkpoint);if(!restored){toast('保存された挑戦を読み込めませんでした。');return;}run=restored;openRun();}
  function needs(e){return Object.entries(e.needs).map(([id,n])=>'<'+((run?.count(id)||0)>=n?'b':'span')+'>'+C.lookup[id].name+' '+(run?run.count(id)+'/':'')+n+'</'+((run?.count(id)||0)>=n?'b':'span')+'>').join(' ＋ ');}
  function upgradePreview(id){
    const next=run.preview(id);if(!next)return'';
    const s=run.stats,one=n=>Number(n.toFixed(1)),percent=n=>Math.round(n*100)+'%';
    const fields=[['shot','1発の威力',one],['rate','射撃 / 秒',one],['shots','同時発射',one],['hp','最大生命',one],['currentHp','現在の生命',one],['armor','軽減',percent],['crit','会心率',percent],['critPower','会心倍率',n=>one(n)+'倍'],['regen','毎秒回復',one],['speed','移動速度',n=>Math.round(n)],['jumps','跳躍回数',one],['jump','跳躍力',n=>Math.round(n)],['pierce','貫通',one],['bounce','反射',one],['homing','追尾力',one],['bulletSpeed','弾速',n=>Math.round(n)],['size','弾の大きさ',n=>one(n)+'倍'],['leech','吸血確率',percent],['explosion','撃破爆発',n=>one(n)+'段階'],['burn','燃焼威力',n=>Math.round(n*20)+'% / 秒'],['poison','毒1重の威力',n=>Math.round(n*16)+'% / 秒'],['slow','敵の減速',percent],['lightning','雷の威力',n=>one(n*1.6)+'倍'],['chain','雷の連鎖',one],['familiar','亡霊',one],['echo','追撃確率',percent],['void','裂け目',n=>one(n)+'段階'],['gravity','引力',n=>one(n)+'段階'],['cleave','鎌の威力',n=>one(n*2*(id==='butcher'||run.has('butcher')?3:1))+'倍'],['execution','処刑の閾値',percent],['spore','胞子の威力',n=>one(n*.35)+'倍 / 秒'],['barrier','結界の補充',n=>one(n*6)],['thorns','反撃の威力',n=>one(n*3)+'倍'],['dashCD','回避の間隔',n=>one(n)+'秒'],['cooldown','スキル間隔',percent],['magnet','回収範囲',n=>Math.round(n)],['choices','候補数',one],['rage','瀕死の威力加算',percent],['split','破片の威力',n=>one(n*.18)+'倍'],['harvest','遺灰倍率',n=>Number(n.toFixed(2))+'倍']];
    const before={...s,currentHp:run.p.hp,shot:run.damageValue()*Math.pow(.92,run.count('multishot'))},after={...next.stats,currentHp:next.hp,shot:next.shot},lowerBetter=['dashCD','cooldown'];
    const changes=fields.filter(([key])=>Math.abs(before[key]-after[key])>.001).slice(0,3).map(([key,label,format])=>'<span>'+label+' <b class="'+((after[key]>before[key])!==lowerBetter.includes(key)?'gain':'cost')+'">'+format(before[key])+' → '+format(after[key])+'</b></span>');
    let html=changes.length?'<span class="upgrade-delta">'+changes.join('')+'</span>':'';
    const evo=D.evolutions.find(e=>e.needs[id]&&!run.has(e.id));
    if(evo){const remaining=Object.entries(evo.needs).reduce((sum,[key,n])=>sum+Math.max(0,n-run.count(key)-(key===id?1:0)),0);html+='<span class="evolution-hint '+(remaining===0?'ready':'')+'">'+evo.name+'：'+(remaining===0?(run.eligibleEvolutions().some(e=>e.id===evo.id)?'進化条件達成済み':'取得で進化条件達成'):'取得後、あと'+remaining+'段階')+'</span>';}
    if(id==='conduit'&&!s.lightning)html+='<span class="evolution-hint">弔いの雷を得ると効果を発揮</span>';
    if(id==='gravity'&&!s.void)html+='<span class="evolution-hint">虚ろな聖痕を得ると効果を発揮</span>';
    return html;
  }
  function upgrade(){
    let html=header(run.training?'THE FIRST MARK':'A GIFT FROM BELOW',run.training?'最後に、力をひとつ。':'何を、捧げる。',run.training?'司祭の稽古 6 / 6 · 好きな強化を選んでみよう。':'第'+run.completed+'波 突破。'+(run.waveReport?' 遺灰 +'+run.waveReport.souls+' · 回復 +'+run.waveReport.heal+(run.waveReport.flawless?' · 無傷達成':''):'ひとつ選び、身体に刻む。'),false);
    if(run.completed%64===0&&run.secretKills)html+='<p class="intro-quote">忘却の弔鐘は、鳴り止んだ。<br>その静けさを、あなたは覚えている。</p>';

    if(run.wave%8===0&&run.oathWave!==run.wave&&run.covenantChoices.length)html+='<div class="oath-banner"><div><b>主の遺骸が、契約を求めている。</b><p>強さには、代償がある。誓約をひとつ追加するか、そのまま進むか。</p></div><button data-action="covenant">血の誓約を見る</button></div>';
    html+='<div class="selection-grid">'+run.choices.map((id,i)=>{
      if(id==='communion')return'<article class="upgrade-card"><button class="choose" data-action="choose" data-id="communion">'+icon(0)+'<h3>最後の聖餐</h3><p>生命を全回復。威力 +10%、遺灰 +10。</p></button></article>';
      const d=C.lookup[id],evo=!!d.needs,s=D.schools[d.school];return'<article class="upgrade-card '+(evo?'evolution':'')+'" style="--school:'+s.color+'"><button class="choose" data-action="choose" data-id="'+id+'"><span class="school-label">'+(evo?'禁 忌 進 化':s.name+' · '+(run.count(id)?'深化':'新たな禁忌'))+'　'+(i+1)+'</span>'+art(d)+'<h3>'+d.name+'</h3><p>'+d.desc+'</p>'+upgradePreview(id)+(evo?'<p class="evo-needs">'+needs(d)+'</p>':'<span class="level-dots">'+Array.from({length:d.max},(_,j)=>j<=run.count(id)?'◆':'◇').join('')+'</span>')+'</button>'+(!evo&&!run.training?'<button class="banish" data-action="banish" data-id="'+id+'" '+(run.banishes<=0?'disabled':'')+'>この挑戦から封印する</button>':'')+'</article>';
    }).join('')+'</div><div class="panel-actions"><button data-action="reroll" '+(run.rerolls<=0?'disabled':'')+'>選び直す　'+run.rerolls+' 回</button><button data-action="build">現在のビルド</button><button data-action="pause">休息する</button></div><p class="progress-line">封印 残り '+run.banishes+' 回 · 能力を重ねると、新たな禁忌が開く</p>';
    if(run.training)html=html.slice(0,html.indexOf('<div class="panel-actions">'))+'<p class="progress-line">同じ能力を重ねると、禁忌進化への道が開く。</p>';
    show('upgrade',html);
  }
  function choose(id){
    if(run.training&&training?.step===5){if(run.choose(id)){training.finish();audio.play('select');trainingResults();}return;}
    const d=C.lookup[id],previous=[...run.stats.resonances];if(!run.choose(id))return;const awakened=run.stats.resonances.filter(id=>!previous.includes(id));saveRun();hud(true);audio.play(d?.needs?'evolve':'select');
    if(d?.needs)show('evolution',header('FORBIDDEN ASCENSION','禁忌が、目を開く。','',false)+'<div class="evolution-reveal" style="--school:'+D.schools[d.school].color+'">'+art(d,'evolution-splash')+'<h2 class="result-title">'+d.name+'</h2><p class="intro-quote">'+d.desc+'</p></div>'+resonanceSection(run.evolved,awakened)+'<div class="panel-actions"><button class="primary" data-action="resume">異形として進む</button>'+'<button data-action="paths">次の禁忌を選ぶ</button>'+'</div>',true);else resume();
  }
  function covenantAdvice(id){return{glass:'生命の下限は25。傷ついていても、減るのは新しい上限を超えた分だけ。',hunger:'生命が減っている時の撃破で回復。吸血とは別に働く。',vigil:'雷・裂け目・鎌に作用する。通常の射撃と亡霊の間隔は変わらない。',chalice:'大奇跡の必要数は8まで。溜めた力は、新しい必要数まで残る。',marrow:'軽減の上限は72%。歩みは鈍るが、回避の速さは変わらない。',pilgrim:'これから現れる雑魚だけ。主の生命は変わらない。遺灰の倍率には、他の効果も重なる。'}[id]||'';}
  function covenantPreview(id){
    const delta=run.previewCovenant(id);if(!delta)return'';const {before,after}=delta,one=n=>Number(n.toFixed(1)),seconds=n=>Number(n.toFixed(2))+'秒',percent=n=>Math.round(n*100)+'%',rows=[];
    const row=(label,a,b,format,lower=false)=>{if(Math.abs(a-b)<1e-8)return;rows.push('<span><span>'+label+'</span><b class="'+((b>a)!==lower?'gain':'cost')+'">'+format(a)+' → '+format(b)+'</b></span>');};
    row('1発の威力',before.shot,after.shot,one);row('最大生命',before.stats.hp,after.stats.hp,one);row('現在の生命',before.hp,after.hp,one);row('撃破時の回復',before.killHeal,after.killHeal,one);
    row('スキル間隔比',before.stats.cooldown,after.stats.cooldown,percent,true);row('回避の再使用',before.stats.dashCD,after.stats.dashCD,seconds,true);row('被害の軽減',before.stats.armor,after.stats.armor,percent);row('移動速度',before.stats.speed,after.stats.speed,one);row('突破の遺灰倍率',before.stats.harvest,after.stats.harvest,n=>Number(n.toFixed(2))+'倍');row('雑魚の生命倍率',before.enemyHp,after.enemyHp,n=>Number(n.toFixed(2))+'倍',true);row('大奇跡の必要数',before.stats.ultimate,after.stats.ultimate,n=>n+'体',true);
    let hint=covenantAdvice(id);if(id==='vigil'&&!run.stats.lightning&&!run.stats.void&&!run.stats.cleave)hint='対象となる自動スキルを、まだ持っていない。雷・裂け目・鎌を得てこそ、力を放つ。';
    return'<span class="covenant-delta" aria-label="誓約による実際の変化">'+rows.join('')+'</span><span class="covenant-note">'+hint+'</span>';
  }
  function covenant(){
    const html=header('A COVENANT IN BLOOD','遺骸に、誓う。','ボスごとに一度だけ。代償はこの挑戦が終わるまで続く。')+'<p class="covenant-intro">今の装備と能力で、誓った直後の変化を。</p><div class="selection-grid covenant-grid">'+run.covenantChoices.map(id=>{const d=D.covenants.find(d=>d.id===id);return'<article class="upgrade-card"><button class="choose" data-action="swear" data-id="'+id+'"><span class="school-label">血 の 誓 約</span>'+art(d)+'<h3>'+d.name+'</h3><p>'+d.desc+'</p>'+covenantPreview(id)+'</button></article>';}).join('')+'</div><div class="panel-actions"><button data-action="backToRun">今は誓わない</button></div>';show('covenant',html);
  }
  function pause(){
    if(run?.training){show('pause',header('A MOMENT TO LEARN','稽古を、ひと休み。','操作は自分のペースで。',false)+'<div class="panel-actions"><button class="primary" data-action="backToRun">稽古を続ける</button><button data-action="help">遊び方</button><button data-action="settings">設定</button><button data-action="title">稽古を終える</button></div>',true);return;}
    if(!run)return;show('pause',header('A MOMENT OF SILENCE','聖堂は、待っている。','第'+run.wave+'波 · '+minutes(run.time),false)+'<div class="panel-actions"><button class="primary" data-action="backToRun">葬送を続ける</button><button data-action="build">ビルドを見る</button><button data-action="settings">設定</button><button data-action="help">遊び方</button></div><div class="panel-actions"><button data-action="saveTitle">中断して扉へ戻る</button><button data-action="abandonConfirm">帰還して遺灰を受け取る</button></div><p class="progress-line">中断すれば、この波の初めから再び。</p>',true);
  }
  function build(){
    if(!run)return;const s=run.stats;let html=header('YOUR FORBIDDEN SCRIPTURE','刻まれた禁忌',run.weapon.name+' × '+run.mask.name);
    html+='<div class="build-stats"><div><small>1発の威力</small><b>'+Number((run.damageValue()*Math.pow(.92,run.count('multishot'))).toFixed(1))+'</b></div><div><small>射撃 / 秒</small><b>'+s.rate.toFixed(1)+'</b></div><div><small>会心</small><b>'+Math.round(s.crit*100)+'%</b></div><div><small>軽減</small><b>'+Math.round(s.armor*100)+'%</b></div></div><p class="minor">同時発射 '+s.shots+' 発 · 貫通 '+s.pierce+' · 亡霊 '+s.familiar+' 体 · 1発の威力は分裂の減衰と瀕死補正こみ。会心・追撃・自動スキルは別。</p>';
    html+=ritualCard(run.weapon.id)+resonanceSection(run.evolved)+damageReport(run.damageTally)+'<div class="item-grid codex-grid">'+Object.entries(run.stacks).map(([id,n])=>{const d=C.lookup[id];return'<div class="item-tile"><div class="codex-row">'+art(d)+'<h3>'+d.name+' '+n+'/'+d.max+'</h3></div><p>'+d.desc+'</p></div>';}).join('')+'</div>';
    if(!Object.keys(run.stacks).length)html+='<p class="empty-state">まだ何も、刻まれていない。<br>敵を絶やせば、強化をひとつ。</p>';
    html+='<h3 class="section-label" id="path-heading">禁忌への道</h3>'+'<div class="item-grid path-grid">'+D.evolutions.map(e=>{const resonance=D.resonances.find(d=>d.pair.includes(e.id)),partner=resonance?.pair.find(id=>id!==e.id),resonanceReady=partner&&run.has(partner);const reached=run.has(e.id);return'<div class="item-tile '+(reached?'selected':'')+'">'+art(e)+'<h3>'+e.name+(reached?' · 覚醒':'')+'</h3><p>'+e.desc+'</p><p class="evo-needs">'+needs(e)+'</p><p class="resonance-hint '+(resonanceReady?'ready':'')+'">'+(resonanceReady?(reached?'共鳴発現：':'覚醒すると共鳴：')+resonance.name:'共鳴：'+C.lookup[partner].name+' と組み合わせる')+'</p>'+'</div>';}).join('')+'</div><div class="panel-actions"><button data-action="backToRun">戻る</button></div>';
    if(run.covenants.length)html+='<h3 class="section-label">血の誓約</h3><div class="item-grid">'+run.covenants.map(id=>{const d=D.covenants.find(d=>d.id===id);return'<div class="item-tile">'+art(d)+'<h3>'+d.name+'</h3><p>'+d.desc+'</p></div>';}).join('')+'</div>';
    show('build',html);
  }
  function weaponMilestones(id){const best=profile.weaponBest[id]||0;return'<span class="weapon-milestones" aria-label="'+D.weapons.find(d=>d.id===id).name+'の到達記録"><b>最深 '+best+' 波</b><span>'+[8,16,24,32].map(n=>'<i class="'+(best>=n?'reached':'')+'" aria-label="'+n+'波 '+(best>=n?'突破済み':'未突破')+'">'+(best>=n?'◆ ':'◇ ')+n+'</i>').join('')+'</span></span>';}
  function weaponLedger(){return'<section class="weapon-ledger"><h3 class="section-label">六つの弔具の、足跡</h3><p class="minor">帰還した葬送の、最も深い記録。古い墓碑が消えても、これは残る。</p><div>'+D.weapons.map(d=>'<article>'+art(d)+'<div><h4>'+d.name+'</h4>'+weaponMilestones(d.id)+'</div></article>').join('')+'</div></section>';}
  function loadout(){
    const type=loadoutTab,defs=type==='weapon'?D.weapons:D.masks;
    let html=header('THE ARSENAL','弔具と仮面','死に方ではなく、葬り方を選ぶ。')+'<div class="tabs"><button data-action="equipmentTab" data-id="weapon" class="'+(type==='weapon'?'active':'')+'">弔具</button><button data-action="equipmentTab" data-id="mask" class="'+(type==='mask'?'active':'')+'">仮面</button><span class="balance">遺灰 '+fmt(profile.ashes)+'</span></div><div class="item-grid">';
    html+=defs.map(d=>{const owned=profile[type+'s'].includes(d.id),selected=profile[type]===d.id;return'<button class="item-tile '+(selected?'selected':'')+'" data-action="buy" data-type="'+type+'" data-id="'+d.id+'" '+(!owned&&profile.ashes<d.cost?'disabled':'')+'>'+(type==='mask'?'<canvas class="costume-portrait" data-mask="'+d.id+'" width="120" height="120" aria-hidden="true"></canvas>':art(d))+'<h3>'+d.name+'</h3><p>'+d.desc+'</p>'+(type==='weapon'?'<p class="weapon-ritual">大奇跡：'+D.ultimates[d.id].name+'<br>'+D.ultimates[d.id].desc+'</p>':'')+(type==='weapon'?weaponMilestones(d.id):'')+'<span class="price">'+(selected?'装備中':owned?'装備する':'解放　'+d.cost+' 遺灰')+'</span></button>';}).join('')+'</div><p class="progress-line">解放した装備は、ずっと手元に残る。</p><div class="panel-actions"><button class="primary" data-action="start">葬送の支度へ</button></div>';
    show('loadout',html);
  }
  function altar(){
    show('altar',header('ASHES TO ASHES','遺灰の祭壇','死の向こうへ、少しだけ持ち越す。')+'<div class="balance">遺灰 '+fmt(profile.ashes)+'</div><div class="item-grid" style="margin-top:18px">'+D.meta.map(d=>{const n=profile.meta[d.id]||0,cost=d.cost+n*d.step;return'<button class="item-tile '+(n===d.max?'selected':'')+'" data-action="buy" data-type="meta" data-id="'+d.id+'" '+(n>=d.max||profile.ashes<cost?'disabled':'')+'>'+art(d)+'<h3>'+d.name+' '+n+'/'+d.max+'</h3><p>'+d.desc+'</p><span class="price">'+(n===d.max?'満たされた祭壇':cost+' 遺灰')+'</span></button>';}).join('')+'</div><p class="progress-line">日替わりの悪夢では、祭壇の力は眠る。</p>');
  }
  function bestiaryMeter(id){
    const p=D.bestiaryProgress(id,profile.enemyKills[id]);
    return'<div class="bestiary-progress '+(p.tier?'earned':'unearned')+'"><canvas data-bestiary="'+Math.max(0,p.tier-1)+'" width="128" height="128" aria-hidden="true"></canvas><div><b>討伐 '+fmt(p.count)+' 体</b><span>'+p.label+'</span><div class="bestiary-steps">'+p.thresholds.map((n,i)=>'<small class="'+(p.tier>i?'reached':'')+'">'+n+'体</small>').join('')+'</div><p>'+(p.tier===3?'三つの記章を、すべて刻んだ。':'次の記章まで '+p.remaining+' 体')+'</p></div></div>';
  }
  function medalGains(){
    if(!run?.medalsEarned?.length)return'';
    return'<section class="medals-earned"><h3 class="section-label">新たな討伐の記章</h3><div>'+run.medalsEarned.map(m=>'<article><canvas data-bestiary="'+(m.tier-1)+'" width="128" height="128" aria-hidden="true"></canvas><p><b>'+[...D.enemies,...D.bosses].find(d=>d.id===m.id).name+'</b><span>'+m.label+'</span></p></article>').join('')+'</div><p class="minor">討伐の足跡は、禁書の「異形」に。</p></section>';
  }
  function codex(){
    let html=header('THE FORBIDDEN ARCHIVE','禁書','知ることも、ひとつの罪。')+'<div class="tabs">'+[['items','強化 '+profile.discovered.length+'/40'],['evolutions','禁忌進化 '+profile.evolutions.length+'/8'],['resonances','共鳴 '+profile.resonances.length+'/4'],['enemies','異形'],['covenants','血の誓約'],['achievements','実績 '+profile.achievements.length+'/'+D.achievements.length]].map(([id,name])=>'<button data-action="codexTab" data-id="'+id+'" class="'+(codexTab===id?'active':'')+'">'+name+'</button>').join('')+'</div><div class="item-grid codex-grid '+(codexTab==='achievements'?'achievements-grid':codexTab==='covenants'?'covenants-grid':'')+'">';
    if(codexTab==='items')html+=D.items.map(d=>'<div class="item-tile '+(!profile.discovered.includes(d.id)?'unseen':'')+'"><div class="codex-row">'+art(d)+'<h3>'+d.name+'</h3></div><p>'+d.desc+'</p><small>'+D.schools[d.school].name+' · 最大 '+d.max+' 段階 · '+(profile.discovered.includes(d.id)?'発見済み':'未発見')+'</small></div>').join('');
    if(codexTab==='evolutions')html+=D.evolutions.map(d=>'<div class="item-tile '+(profile.evolutions.includes(d.id)?'selected':'')+'">'+art(d)+'<h3>'+d.name+'</h3><p>'+d.desc+'</p><p class="evo-needs">'+needs(d)+'</p></div>').join('');
    if(codexTab==='resonances')html+=D.resonances.map(d=>'<div class="item-tile '+(profile.resonances.includes(d.id)?'selected':'unseen')+'">'+art(d)+'<h3>'+d.name+'</h3><p>'+d.desc+'</p><p class="evo-needs">'+d.pair.map(id=>C.lookup[id].name).join(' × ')+'</p><small>'+(profile.resonances.includes(d.id)?'発見済み':'同じ挑戦で2つの進化を揃えると発現')+'</small></div>').join('');
    if(codexTab==='enemies')html+='<section class="bestiary-guide"><h3>討伐の記章 '+[...D.enemies,...D.bosses].reduce((n,d)=>n+D.bestiaryProgress(d.id,profile.enemyKills[d.id]).tier,0)+' / 42</h3><p>帰還した葬送と日替わりの討伐だけを、異形ごとに数える。血痕・骨碑・黒冠、三つの印を禁書に。</p></section><section class="crown-guide"><h3>冠を戴く異形</h3><p>第9波から、3の倍数の波に一体。主の待つ波には現れない。</p><div>'+D.crowns.map(d=>'<article><canvas data-crown="'+d.id+'" width="96" height="96" aria-hidden="true"></canvas><div><h4>'+d.name+'</h4><p>'+d.desc+'</p></div></article>').join('')+'</div><small>これまでに砕いた冠 '+profile.crownKills+'</small></section>';
    if(codexTab==='enemies')html+=[...D.enemies,...D.bosses].map((d,i)=>'<div class="item-tile bestiary-entry" data-bestiary-id="'+d.id+'"><div class="codex-row"><canvas class="enemy-portrait" data-enemy="'+i+'" width="120" height="120" aria-hidden="true"></canvas><h3>'+d.name+'</h3></div><p>'+d.desc+'</p>'+(d.tactic?'<p class="boss-tactic">'+d.tactic+'</p><small>第'+(d.id==='oblivion'?64:d.id==='reliquary'?96:(i-7)*8)+'波 · 生命45%で第二段階</small>':'')+bestiaryMeter(d.id)+'</div>').join('');
    if(codexTab==='covenants'){
      html+='<section class="covenant-guide"><p>主を葬った後、三つの候補から一度だけ。強さも代償も帰還まで。同じ誓約は、二度と誓えない。</p><p>選ばずに進んでもいい。誓う前は、その時の装備と能力に合わせて示す。</p></section>';
      html+=D.covenants.map(d=>'<div class="item-tile covenant-entry">'+art(d)+'<h3>'+d.name+'</h3><p>'+d.desc+'</p><small>'+covenantAdvice(d.id)+'</small></div>').join('');
    }
    if(codexTab==='achievements'){
      html+='<div class="achievement-guide"><p>帰還して刻んだ足跡。ひとつ選べば、扉に飾れる。</p>'+(profile.achievementGoal?'<button data-action="clearAchievementGoal">目標を自動で選ぶ</button>':'')+'</div>';
      html+=D.achievements.map(d=>{const earned=profile.achievements.includes(d.id),pinned=profile.achievementGoal===d.id;return'<div id="achievement-'+d.id+'" class="item-tile achievement-tile '+(earned?'selected':'')+(pinned?' pinned':'')+'"><div class="codex-row">'+achievementArt(d.id)+'<div><small>'+(pinned?'狙っている実績':earned?'記録済みの祈り':'まだ刻まれぬ祈り')+'</small><h3>'+d.name+'</h3></div></div><p>'+d.desc+'</p>'+achievementMeter(d)+'<div class="achievement-actions"><small>'+(earned?'報酬獲得済み':d.reward+' 遺灰')+'</small>'+(!earned?'<button data-action="achievementGoal" data-id="'+d.id+'" aria-pressed="'+pinned+'">'+(pinned?'目標に設定済み':'目標にする')+'</button>':'')+'</div></div>';}).join('');
    }
    show('codex',html+'</div>');
  }
  function paintPortraits(root=$('#panel')){
    root.querySelectorAll('canvas[data-mask],canvas[data-enemy],canvas[data-ritual],canvas[data-item-art],canvas[data-crown],canvas[data-achievement],canvas[data-devotion],canvas[data-bestiary]').forEach(canvas=>{
      const view=new window.BCRenderer(canvas,{alpha:true});view.assets=renderer.assets;view.ctx.imageSmoothingEnabled=false;view.ctx.clearRect(0,0,canvas.width,canvas.height);
      if(canvas.hasAttribute('data-bestiary'))view.sprite('bestiary',Number(canvas.dataset.bestiary),3,1,64,64,122,122);
      else if(canvas.dataset.devotion){const kind=canvas.dataset.devotion,list=kind==='covenants'?D.covenants:kind==='weapons'?D.weapons:D.meta;view.sprite(kind,list.findIndex(d=>d.id===canvas.dataset.id),kind==='altars'?4:3,2,128,128,244,244);}
      else if(canvas.dataset.achievement){const d=D.achievementProgress(profile,canvas.dataset.achievement);view.sprite('achievements',d.art,4,2,64,64,120,120);}
      else if(canvas.dataset.crown){view.sprite('crowns',D.crowns.findIndex(d=>d.id===canvas.dataset.crown),4,2,48,48,92,92);}
      else if(canvas.dataset.itemArt){const d=D.itemArt[canvas.dataset.itemArt];view.sprite(d.image,d.index,4,2,128,128,244,244);}
      else if(canvas.dataset.ritual){const d=D.ultimates[canvas.dataset.ritual];view.sprite(d.image,d.row*4+2,4,3,60,60,115,115);}
      else if(canvas.dataset.mask){const idx=D.masks.findIndex(d=>d.id===canvas.dataset.mask);view.sprite('costumes',idx,3,2,60,60,114,114);}
      else if(Number(canvas.dataset.enemy)===13)view.sprite('reliquary',0,1,1,60,60,112,112);
      else if(Number(canvas.dataset.enemy)===9)view.sprite('executioner',0,1,1,60,60,112,112);
      else{const idx=Number(canvas.dataset.enemy),asset=idx===12?'secretboss':idx>=8?'bosses':idx>=4?'elites':'enemies';view.sprite(asset,idx===12?0:idx>=8?(idx-8)*4:idx>=4?(idx-4)*2:idx*4,idx>=4&&idx<8?2:4,idx===12?1:4,60,60,112,112);}
    });
  }
  function recordAt(key){
    if(key==='result')return run?run.finalRecord:null;
    const match=/^(\d+)$/.exec(String(key));return match?profile.records[Number(match[1])]:null;
  }
  function records(){
    let html=header('EPITAPHS','墓碑銘','この端末に眠る、過去の葬送。')+'<div class="result-stats"><div><strong>'+profile.best+'</strong><small>最深ウェーブ</small></div><div><strong>'+fmt(profile.kills)+'</strong><small>総撃破</small></div><div><strong>'+profile.runs+'</strong><small>挑戦</small></div><div><strong>'+profile.dailyBest+'</strong><small>日替わり最深</small></div></div>';
    if(!profile.records.length)html+='<p class="empty-state">まだ墓碑に名はない。<br>最初の葬送を始めよう。</p>';
    else html+='<div class="record-scroll"><table class="record-table"><thead><tr><th>NO.</th><th>到達</th><th>弔具</th><th>刻印</th></tr></thead><tbody>'+profile.records.map((r,i)=>'<tr><td>'+String(i+1).padStart(2,'0')+'</td><td>'+r.wave+' 波</td><td>'+D.weapons.find(w=>w.id===r.weapon).name+'</td><td>'+'深度 '+(r.difficulty+1)+(r.won?' · 神殺し':'')+'</td></tr>').join('')+'</tbody></table></div><p class="minor">到達の深い順に30件。</p>';
    html+=weaponLedger();show('records',html);
  }
  function epitaph(r){
    if(r.outcome!=='slain')return r.outcome==='victory'?'神を葬り、生還した。':'遺灰を携え、聖堂を後にした。';
    const hit=r.lastHit,enemy=[...D.enemies,...D.bosses].find(d=>d.id===hit?.enemy),attack={bullet:'の弾',contact:'との接触',pillar:'の血柱',beam:'の血光'}[hit?.kind];
    const loss=fmt(hit?.amount||0)+' ダメージ';
    return enemy&&attack?'最期：'+enemy.name+attack+' · '+loss:'聖堂の深みで、歌声のひとつとなった。';
  }
  function settings(){
    show('settings',header('RITUAL SETTINGS','儀式の調律','')+[['music','環境音'],['sfx','効果音']].map(([k,n])=>'<label class="settings-row"><span>'+n+'</span><input type="range" data-setting="'+k+'" aria-label="'+n+'" min="0" max="1" step=".05" value="'+profile.settings[k]+'"></label>').join('')+'<label class="settings-row"><span>背景の暗さ<small>異形と弾の明るさは保つ</small></span><input type="range" data-setting="backgroundDim" aria-label="背景の暗さ" min="0" max=".6" step=".05" value="'+profile.settings.backgroundDim+'"></label><label class="settings-row"><span>味方の演出の濃さ<small>敵弾と攻撃予告の濃さは一定</small></span><input type="range" data-setting="effectOpacity" aria-label="味方の演出の濃さ" min=".35" max="1" step=".05" value="'+profile.settings.effectOpacity+'"></label>'+'<label class="settings-row"><span>ダメージの数字<small>回復の数字は常に出る</small></span><select class="option-select" data-setting="damageNumbers" aria-label="ダメージの数字">'+[['all','すべて'],['critical','会心だけ'],['none','表示しない']].map(([id,n])=>'<option value="'+id+'" '+(profile.settings.damageNumbers===id?'selected':'')+'>'+n+'</option>').join('')+'</select></label>'+[['hitRing','自分の当たり判定の輪','淡い輪の内側が被弾する範囲。無敵中は青白く'],['autoAim','自動照準','切ると、マウスの位置へ撃つ'],['autoFire','自動射撃','切ると、長押しで撃つ'],['shake','画面の揺れ','被弾と大きな攻撃の振動'],['flashes','被弾・無敵の点滅','切ると、赤い画面と点滅を抑える'],['gore','血飛沫の粒子と血痕','異形の絵そのものは変わらない']].map(([k,n,d])=>'<label class="settings-row"><span>'+n+'<small>'+d+'</small></span><input type="checkbox" data-setting="'+k+'" aria-label="'+n+'" '+(profile.settings[k]?'checked':'')+'></label>').join('')+'<div class="panel-actions"><button data-action="soundTest">効果音を試聴</button><button data-action="close">戻る</button></div>',true);
  }
  function help(){
    show('help',header('HOW TO SURVIVE','生き残るために','')+'<div class="help-grid"><p><kbd>A</kbd><kbd>D</kbd> / ← →<br>左右へ滑るように移動</p><p><kbd>SPACE</kbd> / W / ↑<br>二段跳躍。空中でもう一度</p><p><kbd>SHIFT</kbd> / 右クリック<br>短い無敵回避。移動方向へ</p><p><kbd>E</kbd><br>撃破で溜まる大奇跡。敵弾を一掃</p><p><kbd>ESC</kbd><br>一時停止 / ビルド確認</p><p>マウスで照準、長押し射撃<br>自動照準・射撃は設定で切替</p></div><h3 class="section-label">葬送の流れ</h3><p class="help-copy">橙色の弾が敵の攻撃。足元の輪が、自分の当たり判定。<br>波の敵を絶やすと、強化をひとつ刻む。同じ強化が重なり、禁書の条件を満たせば「禁忌進化」が目を開く。<br>8波ごとに、聖堂の主。第32波で神を葬れば、帰るか、さらに深く降りるかを選べる。<br>倒れても遺灰は残る。遺灰は弔具・仮面・祭壇に変わる。</p><h3 class="section-label">連祷</h3><p class="help-copy">4.5秒のうちに葬りつづけるかぎり、連祷は途切れない。5体ごとに得点が伸び、最大2倍。生命を削られれば終わる。結界で受けたなら、まだ続く。</p><h3 class="section-label">パッドとスマホ</h3><p class="help-copy">左スティックで移動、A/×で跳躍、B/○で回避、X/□で大奇跡、STARTで休息。右スティックを倒しているあいだだけ手動照準。<br>スマホは横持ち専用。画面をなぞって移動、右下のボタンで跳躍と回避。画面を軽く叩いても跳べる。照準と射撃は自動。</p><p class="minor">当たり判定の輪、背景の暗さ、演出の濃さは設定から。残りは禁書に記されている。</p><div class="panel-actions">'+(!run?'<button class="primary" data-action="training">操作を試す</button>':'')+'<button data-action="close">わかった</button></div>',true);
  }
  function startTraining(){training=new window.BCTraining.Training();run=training.run;openRun();trainingHud();}
  function trainingHud(){
    const active=run?.training&&training&&!training.finished&&training.step<5;$('#training-hint').hidden=!active;if(!active)return;
    const lesson=training.lesson,method=padUsed?'pad':touchMode?'touch':'pc';
    if($('#training-hint').dataset.step!==String(training.step)){$('#training-hint').dataset.step=training.step;$('#training-icon').innerHTML=icon(lesson.icon);$('#training-title').textContent=lesson.title;$('#training-copy').textContent=lesson.text;$('#training-step').textContent='司祭の稽古 '+(training.step+1)+' / 6';}
    $('#training-input').textContent=lesson[method];$('#training-fill').style.width=training.progress*100+'%';
  }
  function trainingResults(){
    $('#training-hint').hidden=true;show('trainingResults',header('READY FOR THE REQUIEM','葬送の準備は、できた。','',false)+'<div class="training-finished">'+icon(23)+'<p class="intro-quote">動き、かわし、力を刻む。<br>その先で、禁忌が目を覚ます。</p></div><p class="help-copy">葬るほどに、大奇跡は満ちる。倒れても遺灰は残り、次の葬送を支える。</p><p class="minor">稽古は、何も記録に残さない。</p><div class="panel-actions"><button class="primary" data-action="trainingStart">葬送の支度へ</button><button data-action="trainingAgain">もう一度、稽古する</button><button data-action="title">扉へ戻る</button></div>',true);
  }
  function saveBundle(){return{app:'BLOOD CHOIR',version:1,date:new Date().toISOString(),profile,checkpoint};}
  function mountSaveTools(){
    $('#panel').insertAdjacentHTML('beforeend','<h3 class="section-label">記録を持ち運ぶ</h3><p class="minor">遺灰・装備・実績・中断した葬送を、ファイルへ。読み込みは扉へ戻ってから。</p><div class="panel-actions"><button data-action="exportSave">記録を書き出す</button><button data-action="importSave" '+(run?'disabled':'')+'>記録を読み込む</button><button data-action="restoreBackup" '+(run||!read(KEY+'.backup')?'disabled':'')+'>読み込み前の控えを確認</button></div><input id="import-save" type="file" accept=".json,application/json" hidden>');
    $('#import-save').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;if(file.size>2000000){toast('この記録は大きすぎます。');return;}try{previewImport(JSON.parse(await file.text()));}catch{toast('記録を読み込めませんでした。JSONファイルを確認してください。');}});
  }
  function previewImport(data){
    if(!data||data.app!=='BLOOD CHOIR'||data.version!==1||!data.profile||data.profile.version!==1){toast('BLOOD CHOIRの記録ファイルではありません。');return;}
    const restored=data.checkpoint?C.Run.restore(data.checkpoint):null;if(data.checkpoint&&!restored){toast('中断記録が壊れているため、読み込みを中止しました。');return;}
    const next=C.normalizeProfile(data.profile);pendingImport={profile:next,checkpoint:restored&&!next.settled.includes(restored.id)?restored.checkpoint():null};
    show('import',header('BRING THE DEAD HOME','この記録へ、戻る。','現在の記録は、読み込み前の控えとして残します。',false)+'<div class="result-stats"><div><strong>'+next.best+'</strong><small>最深ウェーブ（現在 '+profile.best+'）</small></div><div><strong>'+fmt(next.ashes)+'</strong><small>遺灰（現在 '+fmt(profile.ashes)+'）</small></div><div><strong>'+next.runs+'</strong><small>挑戦回数</small></div><div><strong>'+next.evolutions.length+'/8</strong><small>発見した進化</small></div></div><p class="progress-line">中断した葬送：'+(pendingImport.checkpoint?'第'+pendingImport.checkpoint.wave+'波':'なし')+'</p><div class="panel-actions"><button class="primary" data-action="confirmImport">この記録へ切り替える</button><button data-action="settings">取り消す</button></div>');
  }
  function victory(){
    const image='<div class="victory-art"><img src="assets/runtime/ending.webp" onerror="this.onerror=null;this.src=\'assets/ending.png\'" alt="鼓動を止めた神の心臓に、地上から淡い光が差し込む"><span>AND AT LAST, THERE WAS SILENCE.</span></div>';
    const summary='<div class="victory-summary"><div class="result-stats"><div><strong>32</strong><small>突破</small></div><div><strong>'+fmt(run.kills)+'</strong><small>葬った異形</small></div><div><strong>'+run.evolved.length+'</strong><small>禁忌進化</small></div><div><strong>'+fmt(run.souls)+'</strong><small>遺灰</small></div></div><p class="progress-line">葬送時間 '+minutes(run.time)+'</p></div>';
    show('victory','<h2 id="panel-title" class="result-title victory-title">THE GOD IS SILENT</h2><div class="victory-scene">'+image+summary+'</div><div class="panel-actions"><button class="primary" data-action="endless">さらに深く</button><button data-action="finish">帰還する</button></div>');
  }
  function finish(){if(!run)return;run.outcome=run.completed>=32?'victory':'retired';settlement=settleRun(run);run.state='dead';lastState='dead';results();}
  function results(){
    const won=run.completed>=32;let html='<div class="eyebrow" style="text-align:center">'+(won?'THE REQUIEM IS COMPLETE':'THE CHOIR REMEMBERS')+'</div><h2 id="panel-title" class="result-title">'+(won?'GOD SLAIN':'YOU ARE REMEMBERED')+'</h2><p class="result-sub">'+(won?'神を葬った者':'またひとつ、歌声が増えた。')+'</p>';
    html+='<div class="result-stats"><div><strong>'+run.completed+'</strong><small>突破ウェーブ</small></div><div><strong>'+fmt(run.kills)+'</strong><small>撃破</small></div><div><strong>+'+fmt(run.souls)+'</strong><small>持ち帰った遺灰</small></div></div><div class="result-build">'+Object.keys(run.stacks).map(id=>'<span title="'+C.lookup[id].name+' '+run.count(id)+'">'+art(C.lookup[id])+'</span>').join('')+'</div>';
    html+='<p class="progress-line">'+run.weapon.name+' × '+run.mask.name+' · '+minutes(run.time)+' · 禁忌進化 '+run.evolved.length+' 種</p><p class="death-recap">'+epitaph(run)+'</p><div class="panel-actions"><button data-action="build">このビルドを振り返る</button></div>';
    if(run.crownKills)html+='<p class="progress-line">砕いた冠 '+run.crownKills+'</p>';
    if(run.reliquaryKills)html+='<p class="progress-line">緋の聖櫃を葬った回数 '+run.reliquaryKills+'</p>';
    if(run.secretKills)html+='<p class="progress-line">忘却の弔鐘を葬った回数 '+run.secretKills+'</p>';
    html+=resonanceSection(run.evolved);
    html+=medalGains();
    if(settlement.length)html+='<div class="achievements-earned">'+settlement.map(a=>'実績「'+a.name+'」　+'+a.reward+' 遺灰').join('<br>')+'</div>';
    html+='<div class="panel-actions"><button class="primary" data-action="retry">もう一度、葬送へ</button><button data-action="title">扉へ戻る</button></div>';
    show('results',html);
  }
  function hud(full=false){
    if(!run)return;trainingHud();const p=run.p,s=run.stats;$('#hp-label').textContent=Math.ceil(p.hp)+' / '+s.hp;$('#hp-fill').style.width=(p.hp/s.hp*100)+'%';$('#shield-label').textContent=(p.shield?'結界 '+Math.ceil(p.shield)+'　':'')+'回避 '+(p.dashCD>0?p.dashCD.toFixed(1)+'s':'READY');$('#jump-label').textContent='跳躍 '+Math.max(0,s.jumps-p.jumps)+' / '+s.jumps;$('#wave-label').textContent=(run.training?'稽古 ':'WAVE ')+String(run.wave).padStart(2,'0');$('#zone-label').textContent=run.wave>32?'終わらない葬列':D.zones[Math.min(3,Math.floor((run.wave-1)/8))];$('#enemy-label').textContent='残り '+(run.enemies.length+run.spawnLeft)+' 体';$('#soul-label').textContent=fmt(run.souls);$('#charge-fill').style.width=run.charge/s.ultimate*100+'%';$('#charge-label').textContent=run.charge>=s.ultimate?(run.intro>0?'まもなく':'E · READY'):Math.floor(run.charge)+' / '+s.ultimate;$('#ultimate-button').classList.toggle('ready',run.charge>=s.ultimate&&run.intro<=0);$('#ultimate-button').disabled=run.charge<s.ultimate||run.intro>0;$('#ultimate-name').textContent=D.ultimates[run.weapon.id].name;$('#ultimate-button').title=D.ultimates[run.weapon.id].desc;$('#ultimate-button').setAttribute('aria-label','葬送の大奇跡 '+$('#charge-label').textContent);
    const boss=run.enemies.find(e=>e.boss);$('#boss-hud').hidden=!boss;if(boss){$('#boss-name').textContent=boss.name;$('#boss-fill').style.width=Math.max(0,boss.hp/boss.maxHp*100)+'%';}
    
    
    if(full){$('#build-button').innerHTML=(Object.keys(run.stacks).slice(-10).map(id=>art(C.lookup[id])).join('')||'禁忌はまだ刻まれていない')+(run.stats.resonances.length?'<b class="resonance-count">共鳴 '+run.stats.resonances.length+'</b>':'')+'<span>　書を開く</span>';paintPortraits($('#build-button'));}
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action,id=b.dataset.id;audio.unlock();
    if(a==='start')setup(false);if(a==='endlessRun')setup(true);if(a==='begin')begin(b.dataset.endless==='true');if(a==='continue')continueRun();if(a==='close')close();if(a==='resume')resume();
    if(a==='retrySave')retrySave();
    if(a==='training')startTraining();if(a==='trainingStart'){title();setup(false);}if(a==='trainingAgain')startTraining();
    if(a==='backToRun'){if(run.state==='upgrade')upgrade();else if(run.state==='victory')victory();else if(run.state==='dead')results();else resume();}
    if(a==='loadout')loadout();if(a==='altar')altar();if(a==='codex')codex();if(a==='records')records();if(a==='settings')settings();if(a==='help')help();if(a==='build')build();if(a==='pause')pause();
        if(a==='paths'){build();$('#path-heading').scrollIntoView({block:'start'});}
    
    if(a==='choose')choose(id);if(a==='reroll'&&run.reroll()){saveRun();upgrade();audio.play('select');}if(a==='banish'&&run.banish(id)){saveRun();upgrade();toast(C.lookup[id].name+'を封印した');}
    if(a==='covenant')covenant();if(a==='swear'&&run.swear(id)){saveRun();upgrade();hud(true);audio.play('evolve');toast('血の誓約を刻んだ');}
    if(a==='equipmentTab'){loadoutTab=id;loadout();}if(a==='codexTab'){codexTab=id;codex();}
    if(a==='achievementGoal')pinAchievement(id);if(a==='achievementDetail'){codexTab='achievements';codex();const target=$('#achievement-'+id);target?.scrollIntoView({block:'center'});target?.querySelector('button')?.focus({preventScroll:true});}if(a==='clearAchievementGoal'){profile.achievementGoal=null;saveProfile();codex();titleGoal();}
    if(a==='buy')confirmBuy(b.dataset.type,id);if(a==='commitBuy')buy(b.dataset.type,id);
    if(a==='toggleAim'||a==='toggleFire'){const key=a==='toggleAim'?'autoAim':'autoFire';profile.settings[key]=!profile.settings[key];saveProfile();hud();}
    if(a==='ultimate'&&run&&!paused)input.ultimate=true;
    if(a==='saveTitle'){if(run.state==='upgrade'||run.state==='victory')saveRun();title();}
    if(a==='abandonConfirm')show('abandon',header('RETURN TO THE SURFACE','ここで、葬送を終える。','',false)+'<p class="help-copy">ここで葬送を終え、'+fmt(run.souls)+' の遺灰を持ち帰る。</p><div class="panel-actions"><button class="primary" data-action="finish">帰還する</button><button data-action="backToRun">まだ戦う</button></div>',true);
    if(a==='finish')finish();if(a==='title')title();if(a==='retry'){const endless=run?.endless;run=null;title();setup(endless);}

    if(a==='settings')mountSaveTools();
    if(a==='fullscreen')toggleFullscreen();
    if(a==='enableAudio')audio.unlock();
    if(a==='exportSave'){const url=URL.createObjectURL(new Blob([JSON.stringify(saveBundle(),null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='BloodChoir-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(a==='importSave'&&!run)$('#import-save').click();
    if(a==='restoreBackup'&&!run)previewImport(read(KEY+'.backup'));
    if(a==='confirmImport'&&!run&&pendingImport){const next={app:'BLOOD CHOIR',version:1,profile:pendingImport.profile,checkpoint:pendingImport.checkpoint};if(!saves.importBundle(next,saveBundle())){toast('読み込みを完了できませんでした。元の記録を保ち、切り替えを中止しています。');return;}Object.assign(profile,pendingImport.profile);checkpoint=pendingImport.checkpoint;pendingImport=null;profilePending=false;title();toast('記録を読み込みました。');}
    if(a==='endless'&&run.continueEndless()){saveRun();upgrade();}if(a==='soundTest')audio.play('clear');
    if(qa&&a.startsWith('qa'))qaAction(a);
  });
  document.addEventListener('input',e=>{const key=e.target.dataset.setting;if(!key)return;profile.settings[key]=e.target.type==='checkbox'?e.target.checked:key==='damageNumbers'?e.target.value:Number(e.target.value);saveProfile();audio.set(profile.settings,!!run&&!paused);});
  document.addEventListener('change',e=>{if(e.target.id==='difficulty')selectionDifficulty=Number(e.target.value);});
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')padUsed=false;});
  window.addEventListener('keydown',e=>{
    padUsed=false;
    if(e.key==='Tab'&&!$('#overlay').hidden){const list=[...$('#panel').querySelectorAll('button:not(:disabled),input:not([hidden]),select,a')];if(list.length){if(e.shiftKey&&(document.activeElement===list[0]||document.activeElement===$('#panel'))){list.at(-1).focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){list[0].focus();e.preventDefault();}}return;}
    if(['INPUT','SELECT'].includes(e.target.tagName))return;
    if(e.code==='Escape'){e.preventDefault();if(run){if(panelMode==='pause')$('#panel [data-action="backToRun"]').click();else pause();}else if(!$('#overlay').hidden)hidePanel();return;}
    if(!run||paused){if(panelMode==='upgrade'&&/^[1-6]$/.test(e.key)){const id=run.choices[Number(e.key)-1];if(id)choose(id);}return;}
    if(['Space','ArrowUp','ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','ShiftLeft','ShiftRight','KeyE'].includes(e.code))e.preventDefault();keys.add(e.code);
    if(!e.repeat){if(['Space','KeyW','ArrowUp'].includes(e.code))input.jump=true;if(e.code.startsWith('Shift'))input.dash=true;if(e.code==='KeyE')input.ultimate=true;}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  const live=()=>!!run&&!paused;
  function stickAxis(p){const dx=p.x-p.anchor,a=Math.abs(dx);return a<=TOUCH.dead?0:Math.sign(dx)*Math.min(1,(a-TOUCH.dead)/(TOUCH.span-TOUCH.dead));}
  function retakeStick(){const p=points.values().next().value;stickId=p?p.id:null;touchAxis=p?stickAxis(p):0;}
  function releaseTouch(){points.clear();stickId=null;touchAxis=0;}
  function dropTouch(id){points.delete(id);if(id===stickId)retakeStick();}
  function touchDown(e){
    const now=performance.now();
    points.set(e.pointerId,{id:e.pointerId,x:e.clientX,anchor:e.clientX,from:e.clientX,at:now,slip:0});
    if(stickId===null)stickId=e.pointerId;
  }
  function touchDrag(e){
    const p=points.get(e.pointerId);if(!p)return;const now=performance.now();
    p.x=e.clientX;p.slip=Math.max(p.slip,Math.abs(p.x-p.from));
    // 指を戻したときに素直に追従するよう、支点を引き寄せる。
    const dx=p.x-p.anchor;if(Math.abs(dx)>TOUCH.span)p.anchor=p.x-Math.sign(dx)*TOUCH.span;
    if(p.id===stickId)touchAxis=stickAxis(p);
  }
  function touchUp(e){
    const p=points.get(e.pointerId);if(!p)return;
    if(p.slip<=TOUCH.tapSlip&&performance.now()-p.at<=TOUCH.tapMs)input.jump=true;
    dropTouch(e.pointerId);
  }
  // 急に開いた画面を、構えていた指が押してしまわないようにする。
  function guardTaps(){const p=$('#panel');p.classList.add('tap-guard');clearTimeout(tapTimer);tapTimer=setTimeout(()=>p.classList.remove('tap-guard'),360);}
  function flashTouchHint(){
    if(!touchMode)return;const h=document.querySelector('.touch-hint');if(!h)return;
    h.classList.remove('show');void h.offsetWidth;h.classList.add('show');
    clearTimeout(hintTimer);hintTimer=setTimeout(()=>h.classList.remove('show'),5200);
  }
  function pointAim(e){const r=$('#game').getBoundingClientRect();input.aimX=(e.clientX-r.left)/r.width*960;input.aimY=(e.clientY-r.top)/r.height*540;mouseInside=e.pointerType!=='touch'&&input.aimX>=0&&input.aimX<=960&&input.aimY>=0&&input.aimY<=540;}
  const surface=()=>$('#play-screen');
  surface().addEventListener('pointermove',e=>{if(e.pointerType==='touch'){if(live())touchDrag(e);return;}pointAim(e);});
  $('#game').addEventListener('pointerleave',()=>{mouseInside=false;});
  surface().addEventListener('pointerdown',e=>{
    // ボタンの上から始まった指は、そのボタンのもの。
    if(e.target.closest('button,a,select,input'))return;
    pointAim(e);padUsed=false;audio.unlock();touchMode=e.pointerType==='touch';
    if(e.pointerType==='touch'){
      // 捕捉は指だけ。マウスで捕まえると #game へ pointerleave が飛んで照準が切れる。
      e.preventDefault();try{surface().setPointerCapture(e.pointerId);}catch{}
      if(live())touchDown(e);return;
    }
    if(e.button===2)input.dash=true;else mouseDown=true;
  });
  $('#game').addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('pointerup',e=>{mouseDown=false;if(e.pointerType==='touch'){if(live())touchUp(e);else releaseTouch();}});
  window.addEventListener('pointercancel',e=>{mouseDown=false;if(e.pointerType==='touch')dropTouch(e.pointerId);});
  document.querySelectorAll('#touch-pad [data-touch]').forEach(btn=>{
    const press=e=>{e.preventDefault();if(!run||paused)return;touchMode=true;audio.unlock();btn.classList.add('pressed');input[btn.dataset.touch]=true;};
    const release=()=>btn.classList.remove('pressed');
    btn.addEventListener('pointerdown',press);
    for(const type of ['pointerup','pointercancel','pointerleave'])btn.addEventListener(type,release);
  });
  function suspend(){resetInput();if(run&&['playing','clearing'].includes(run.state)&&!paused)pause();audio.suspend();}
  window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
  let last=performance.now(),accumulator=0,hudTime=0;
  function frame(now){
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    pollController(dt);
    if(run){
      if(!paused&&(run.state==='playing'||run.state==='clearing')){
        accumulator+=dt;input.move=((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0))||touchAxis;input.fire=touchMode||profile.settings.autoFire||mouseDown;input.autoAim=touchMode||profile.settings.autoAim;
        if(padUsed&&padState.connected){input.move=padState.move;input.fire=true;input.autoAim=!padState.aim;if(padState.aim){input.aimX=run.p.x+padState.aim.x*500;input.aimY=run.p.y+padState.aim.y*500;}}
        while(accumulator>=1/60){if(qaGod){run.p.invuln=1;run.p.hp=run.stats.hp;}if(training?.run===run)training.update(1/60,input);else run.update(1/60,input);input.jump=input.dash=input.ultimate=false;accumulator-=1/60;if(!['playing','clearing'].includes(run.state))break;}
      }else accumulator=0;
      const events=run.events.splice(0);for(const e of events){renderer.event(e);audio.play(e.type,e.weapon);if(e.type==='boss')combat(e.name);if(e.type==='crowned')combat(D.crowns.find(d=>d.id===e.id).name+'の'+e.name+' · 撃破で追加遺灰',true);if(e.type==='bossPhase')combat(e.name+' — 祈りが、悲鳴に変わる');if(e.type==='revive')combat('不死の胎が、もう一度脈打つ');}
      if(run.state!==lastState){lastState=run.state;if(run.state==='upgrade'){saveRun();upgrade();}if(run.state==='victory'){saveRun();victory();}if(run.state==='dead'){settlement=settleRun(run);results();}if(!$('#overlay').hidden)guardTaps();}
      const padAim=padUsed&&padState.connected&&!!padState.aim,aim=!paused&&['playing','clearing'].includes(run.state)&&(padAim||!touchMode&&mouseInside)?window.BCRenderer.aimPoint(run,input,padAim):null;$('#game').classList.toggle('manual-cursor',!!aim&&!padAim);renderer.draw(run,paused?0:dt,profile.settings,aim);hudTime+=dt;if(hudTime>.1){hudTime=0;hud();}
    }
    requestAnimationFrame(frame);
  }
  function qaAction(a){
    if(a==='qaStart'){run=new C.Run({seed:42});openRun();saveRun();return;}if(!run)return;
    if(a==='qaGod'){qaGod=!qaGod;toast('検証用無敵 '+(qaGod?'ON':'OFF'));}
    if(a==='qaWave'){run.beginWave(Number($('#qa-wave').value));saveRun();resume();hud(true);}
    if(a==='qaClear'){run.enemies=[];run.spawnLeft=0;run.completeWave();saveRun();}
    if(a==='qaDie'){qaGod=false;run.p.invuln=0;run.rebirths=0;run.hurtPlayer(1e8);}
    if(a==='qaPhase'){const boss=run.enemies.find(e=>e.boss&&!e.dead);if(boss){boss.hp=boss.maxHp*.44;resume();toast('ボスの第二段階を検証');}else toast('主が現れてから。');}
    if(a==='qaBuild'){for(const id of ['damage','lifesteal','pierce','multishot','plague','spore','lightning','conduit','familiar','echo','void','gravity','cleave','execution','ember','rebirth'])run.stacks[id]=3;run.stats=run.computeStats();run.p.hp=run.stats.hp;run.rebirths=1;run.charge=run.stats.ultimate;hud(true);saveRun();toast('進化検証用ビルドを設定');}
    if(a==='qaAsh'){profile.ashes+=500;saveProfile();toast('検証用遺灰 +500');}
    if(a==='qaStress'){for(const d of D.items)run.stacks[d.id]=d.max;run.evolved=D.evolutions.map(d=>d.id);run.stats=run.computeStats();run.beginWave(96);run.intro=0;run.spawnLeft=0;run.bossSpawned=true;for(let i=0;i<64;i++){const e=run.spawn(i%8,false,40+(i%16)*58,70+Math.floor(i/16)*65);e.hp=e.maxHp=1e9;}qaGod=true;resume();hud(true);toast('最大能力・64体の負荷検証');}
  }
  if(qa){$('#qa-tools').hidden=false;$('#qa-tools').innerHTML='<span>QA · 通常保存は使いません</span><button data-action="qaStart">検証開始</button><select id="qa-wave" aria-label="検証ウェーブ">'+[1,8,9,16,24,32,48,64,96].map(n=>'<option>'+n+'</option>').join('')+'</select><button data-action="qaWave">波へ移動</button><button data-action="qaGod">無敵</button><button data-action="qaClear">殲滅</button><button data-action="qaBuild">進化準備</button><button data-action="qaPhase">第二段階</button><button data-action="qaDie">死亡</button><button data-action="qaAsh">遺灰</button><button data-action="qaStress">負荷</button>';}
  $('#loading-retry').addEventListener('click',()=>location.reload());
  renderer.load(false,(done,total)=>{if(!$('#loading-retry').hidden)return;document.querySelector('#loading-text').textContent='聖堂の扉を開いています… '+Math.round(done/total*100)+'%';document.querySelector('#loading-progress').value=done/total;}).then(()=>{for(const key of ['cover','icons','frame','evolutions','resonances'])document.documentElement.style.setProperty('--'+key+'-image','url("'+renderer.assets[key].src+'")');$('#loading').hidden=true;title();requestAnimationFrame(frame);}).catch(err=>{$('#loading-text').textContent='絵の読み込みが途中で止まりました。もう一度お試しください。';$('#loading-progress').hidden=true;$('#loading-retry').hidden=false;console.error(err);});
})();
