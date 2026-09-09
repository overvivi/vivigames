/* 風と演出で乱数列が変わると前の矢を参考にできなくなるため、物理を描画から分離する。 */
(function(root){
  'use strict';
  const GROUND=224, GRAVITY=110, STEP=1/120;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function pullAim(dx,dy,width){
    // 画面幅に追従する距離で、携帯でも画面の端まで引かずに最大威力に届く。
    const distance=Math.hypot(dx,dy),limit=clamp(width*.25,76,180);
    return {angle:Math.round(clamp(Math.atan2(dy,-dx)*180/Math.PI,5,80)),power:Math.round(clamp(distance/limit*100,20,100)),valid:distance>=12&&dx<=-3&&dy>=-6,distance,limit};
  }
  function grassSway(time,wind,phase){
    // 無風は弾道の条件。背景まで静止すると更新停止に見えるため微細な揺れを残す。
    return Math.sin(time*(wind===0?.85:1+Math.abs(wind)*.04)+phase)*(wind===0?1.1:2)+Math.sign(wind);
  }
  function rng(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  function launch(x,side,angle,power){const r=angle*Math.PI/180,v=power*3.3;return {x:x+side*23,y:GROUND-36,vx:side*Math.cos(r)*v,vy:-Math.sin(r)*v,age:0};}
  function advance(a,wind,dt=STEP){return {...a,x:a.x+a.vx*dt+wind*dt*dt/2,y:a.y+a.vy*dt+GRAVITY*dt*dt/2,vx:a.vx+wind*dt,vy:a.vy+GRAVITY*dt,age:a.age+dt};}
  function boxHit(a,b,box){
    let low=0,high=1;
    for(const [p,d,min,max] of [[a.x,b.x-a.x,box.x,box.x+box.w],[a.y,b.y-a.y,box.y,box.y+box.h]]){
      if(Math.abs(d)<1e-9){if(p<min||p>max)return null;continue;}
      const u=(min-p)/d,v=(max-p)/d;low=Math.max(low,Math.min(u,v));high=Math.min(high,Math.max(u,v));if(low>high)return null;
    }
    return low;
  }
  function contact(a,b,x){
    // 弓・羽飾り・マントは除外し、体の中央だけを当たり判定にする。
    const hits=[['head',45,{x:x-7,y:GROUND-47,w:14,h:13}],['body',30,{x:x-9,y:GROUND-34,w:18,h:32}]]
      .map(([kind,damage,box])=>({kind,damage,t:boxHit(a,b,box)})).filter(h=>h.t!==null).sort((a,b)=>a.t-b.t);
    return hits[0]||null;
  }
  function impact(a,b,target){
    const hit=contact(a,b,target);
    const gt=b.y>=GROUND?(GROUND-a.y)/(b.y-a.y):Infinity;
    if(hit&&hit.t<=gt)return {...hit,x:a.x+(b.x-a.x)*hit.t,y:a.y+(b.y-a.y)*hit.t};
    if(gt>=0&&gt<=1)return {kind:'ground',damage:0,x:a.x+(b.x-a.x)*gt,y:GROUND};
    if(b.age>12||b.x < -500||b.x>2000)return {kind:'out',damage:0,x:b.x,y:b.y};
    return null;
  }
  function trace(x,side,angle,power,wind,target){
    let a=launch(x,side,angle,power),best=Infinity;
    for(let i=0;i<1441;i++){
      const b=advance(a,wind);const hit=impact(a,b,target);
      best=Math.min(best,Math.hypot(b.x-target,b.y-(GROUND-25)));
      if(hit)return {...hit,miss:hit.damage?0:hit.x-target,best};a=b;
    }
    throw Error('Flight exceeded bound');
  }
  function solve(x,side,wind,target){
    let best=null;
    for(let angle=24;angle<=66;angle+=3)for(let power=35;power<=100;power+=1){
      const result=trace(x,side,angle,power,wind,target);
      const score=result.damage?Math.abs(angle-42)*.015:result.best+100;
      if(!best||score<best.score)best={angle,power,score};
    }
    return best;
  }
  class Duel{
    constructor(seed=Date.now(),difficulty='normal'){this.random=rng(seed);this.difficulty=difficulty;this.score=[0,0];this.round=0;this.newRound();}
    newRound(){this.round++;this.distance=400+Math.floor(this.random()*161);this.wind=this.random()<.18?0:Math.round((this.random()*2-1)*17);this.x=[115,115+this.distance];this.hp=[100,100];this.turn=0;this.shots=[0,0];this.arrow=null;this.result=null;this.previous=[[],[]];this.path=[];this.phase='aim';this.aiError=null;}
    fire(angle,power){if(this.phase!=='aim')return false;this.arrow=launch(this.x[this.turn],this.turn===0?1:-1,clamp(angle,5,80),clamp(power,20,100));this.path=[{x:this.arrow.x,y:this.arrow.y}];this.shots[this.turn]++;this.phase='flight';return true;}
    tick(){
      if(this.phase!=='flight')return null;
      const a=this.arrow,b=advance(a,this.wind);const hit=impact(a,b,this.x[1-this.turn]);this.arrow=b;
      this.path.push({x:b.x,y:b.y});
      if(!hit)return null;
      this.previous[this.turn]=this.path.filter((_,i)=>i%7===0);this.result={...hit,shooter:this.turn};
      this.hp[1-this.turn]=Math.max(0,this.hp[1-this.turn]-hit.damage);this.phase='settle';this.arrow=null;return this.result;
    }
    finishShot(){
      if(this.phase!=='settle')return;
      if(this.hp[1-this.turn]===0){this.score[this.turn]++;this.phase=this.score[this.turn]>=2?'match':'round';}
      else {this.turn=1-this.turn;this.phase='aim';}
    }
    enemyAim(){
      const solution=solve(this.x[1],-1,this.wind,this.x[0]);
      const error={easy:12,normal:7,hard:2.5}[this.difficulty]||7;
      // 外した後は同じ風に対して誤差を縮める。必中化せず難易度ごとの揺らぎを残す。
      if(this.aiError===null)this.aiError=(this.random()<.5?-1:1)*error;
      else this.aiError=this.aiError*.48+(this.random()-.5)*error*.45;
      return {angle:solution.angle,power:clamp(solution.power+this.aiError,20,100)};
    }
  }
  const api={Duel,rng,launch,advance,contact,impact,trace,solve,clamp,pullAim,grassSway,GROUND,GRAVITY,STEP};
  if(typeof module!=='undefined')module.exports=api;else root.AmberEngine=api;
})(typeof window!=='undefined'?window:this);
