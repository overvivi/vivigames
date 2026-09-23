(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'));else root.BCTraining=factory(root.BCCore);})(this,function(C){
  'use strict';
  const lessons=[
    {title:'長衣を、滑らせる。',text:'左右へ移動してみよう。足元の小さな輪が、あなたの当たり判定。',pc:'A / D または ← / →',pad:'左スティック または 十字キー',touch:'画面を左右へなぞる',icon:19},
    {title:'空中で、もう一度。',text:'一度跳び、着地する前にもう一度。着地すると跳躍回数が戻る。',pc:'SPACE を離して、もう一度押す',pad:'下ボタンを離して、もう一度押す',touch:'「跳躍」をもう一度押す',icon:15},
    {title:'影を、すり抜ける。',text:'移動方向へ短く回避。その間は無敵。止まっている時は向いている方向へ。',pc:'SHIFT または 右クリック',pad:'右ボタン または RB / R1',touch:'右下の「回避」を押す',icon:20},
    {title:'大奇跡を、解き放つ。',text:'橙の弾を一掃し、異形をまとめて葬る。本番では撃破で力を溜める。',pc:'E を押す',pad:'左ボタン または LB / L1',touch:'右下の「大奇跡」を押す',icon:23},
    {title:'三つの命を、葬る。',text:'照準と射撃は自動。移動・跳躍・回避を使いながら異形を倒そう。',pc:'A / D · SPACE · SHIFT',pad:'左スティック · 下ボタン · 右ボタン',touch:'なぞる · 跳ぶ · 避ける',icon:0},
    {title:'力を、身体に刻む。',text:'ひとつ選ぶ。同じ能力を重ねると、禁忌進化への道が開く。',pc:'クリック または 1 / 2 / 3',pad:'十字キーで選ぶ · 下ボタンで決定',touch:'欲しい能力をタップ',icon:2}
  ];
  class Training{
    constructor(){this.run=new C.Run({seed:7301});this.run.training=true;this.run.intro=1e6;this.run.spawnLeft=0;this.run.events=[];this.step=0;this.distance=0;this.delay=0;this.finished=false;this.killsAtStart=0;}
    get lesson(){return lessons[Math.min(5,this.step)];}
    get progress(){return this.step===0?Math.min(1,this.distance/160):this.step===4?Math.min(1,(this.run.kills-this.killsAtStart)/3):this.delay>0?1:0;}
    next(){
      this.step++;this.delay=0;const r=this.run;
      if(this.step===3){
        // 稽古の大奇跡だけは満充填で始め、通常の撃破・弾消し処理そのものを試す。
        r.intro=0;r.spawnLeft=1;r.spawnTimer=1e9;r.charge=r.stats.ultimate;
        for(let i=0;i<5;i++){const e=r.spawn(0,false,160+i*160,115+(i%2)*35);e.shoot=.4+i*.15;}
      }
      if(this.step===4){
        r.intro=0;r.state='playing';r.spawnLeft=0;r.enemies=[];r.hostile=[];r.bullets=[];r.pickups=[];this.killsAtStart=r.kills;
        for(let i=0;i<3;i++)r.spawn(i===1?2:0,false,250+i*230,130+(i%2)*45);
      }
      if(this.step===5){r.state='upgrade';r.choices=['damage','rate','vitality'];r.completed=1;r.waveReport=null;}
    }
    update(dt,input={}){
      if(this.finished||this.step===5)return;const r=this.run,oldX=r.p.x;
      // 通常保存を持たない独立したRunで、学習中の被弾だけを止める。
      r.update(dt,{...input,fire:this.step===4,autoAim:true});
      if(this.delay>0){this.delay-=dt;if(this.delay<=0)this.next();return;}
      const events=r.events;
      if(this.step===0){this.distance+=Math.abs(r.p.x-oldX);if(this.distance>=160)this.delay=.55;}
      else if(this.step===1&&events.some(e=>e.type==='jump')&&r.p.jumps>=2)this.delay=.65;
      else if(this.step===2&&events.some(e=>e.type==='dash'))this.delay=.7;
      else if(this.step===3&&events.some(e=>e.type==='ultimate'))this.delay=1.35;
      else if(this.step===4&&r.state==='practiceDone')this.next();
    }
    finish(){if(this.step!==5)return false;this.finished=true;this.run.state='practiceDone';return true;}
  }
  return{Training,lessons};
});
