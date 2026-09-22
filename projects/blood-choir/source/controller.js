(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BCController=factory();})(this,function(){
  'use strict';
  class Controller{
    constructor(){this.index=-1;this.previous=[];this.direction='';this.repeat=0;}
    read(pads,dt){
      const list=Array.from(pads||[]).filter(p=>p?.connected&&p.mapping==='standard'),pad=list.find(p=>p.index===this.index)||list[0];
      const lost=this.index>=0&&!pad;
      if(!pad){this.index=-1;this.previous=[];this.direction='';return{connected:false,lost,move:0};}
      if(this.index!==pad.index){this.index=pad.index;this.previous=[];this.direction='';}
      const buttons=pad.buttons.map(b=>typeof b==='number'?b>.5:!!b.pressed||b.value>.5),edge=i=>!!buttons[i]&&!this.previous[i];
      const axis=i=>{const v=Number.isFinite(pad.axes[i])?pad.axes[i]:0;return Math.abs(v)<.22?0:Math.max(-1,Math.min(1,v));};
      const x=axis(0),y=axis(1),rx=axis(2),ry=axis(3),move=buttons[14]?-1:buttons[15]?1:x;
      const dir=buttons[12]?'up':buttons[13]?'down':buttons[14]?'left':buttons[15]?'right':Math.max(Math.abs(x),Math.abs(y))>.55?(Math.abs(x)>Math.abs(y)?x<0?'left':'right':y<0?'up':'down'):'';
      let nav='';this.repeat-=dt;if(dir&&dir!==this.direction){nav=dir;this.repeat=.38;}else if(dir&&this.repeat<=0){nav=dir;this.repeat=.16;}this.direction=dir;
      const state={connected:true,lost:false,active:buttons.some(Boolean)||!!x||!!y||!!rx||!!ry,move,aim:Math.hypot(rx,ry)>.3?{x:rx,y:ry}:null,jump:edge(0),dash:edge(1)||edge(5),ultimate:edge(2)||edge(4),pause:edge(9),confirm:edge(0),back:edge(1),nav};
      this.previous=buttons;return state;
    }
  }
  return{Controller};
});
