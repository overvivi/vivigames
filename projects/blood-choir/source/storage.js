(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'));else root.BCStorage=factory(root.BCCore);})(this,function(C){
  'use strict';
  const valid=b=>b?.app==='BLOOD CHOIR'&&b.version===1&&b.profile?.version===1&&(!b.checkpoint||!!C.Run.restore(b.checkpoint));
  class SaveStore{
    constructor(storage,key,runKey,onFailure=()=>{}){this.storage=storage;this.key=key;this.runKey=runKey;this.backupKey=key+'.backup';this.markerKey=key+'.import-pending';this.onFailure=onFailure;this.recovery=null;}
    read(key){try{return JSON.parse(this.storage.getItem(key)||'null');}catch{return null;}}
    rawWrite(key,value){try{if(value===null)this.storage.removeItem(key);else this.storage.setItem(key,JSON.stringify(value));return true;}catch{this.onFailure();return false;}}
    readState(){
      const backup=this.read(this.backupKey);
      if(this.read(this.markerKey)?.version===1&&valid(backup)){
        // 中断した読込みでは、二つのキーを混ぜず、先に確保した同じ一組へ戻す。
        this.recovery=backup;this.recover();return{profile:backup.profile,checkpoint:backup.checkpoint};
      }
      return{profile:this.read(this.key),checkpoint:this.read(this.runKey)};
    }
    recover(){
      if(!this.recovery)return true;const b=this.recovery;
      if(!this.rawWrite(this.key,b.profile)||!this.rawWrite(this.runKey,b.checkpoint)||!this.rawWrite(this.markerKey,null))return false;
      this.recovery=null;return true;
    }
    write(key,value){if((key===this.key||key===this.runKey)&&!this.recover())return false;return this.rawWrite(key,value);}
    importBundle(next,current){
      if(!valid(next)||!valid(current)||!this.recover())return false;
      const backup=JSON.parse(JSON.stringify(current));
      if(!this.rawWrite(this.backupKey,backup)||!this.rawWrite(this.markerKey,{version:1}))return false;
      this.recovery=backup;
      if(this.rawWrite(this.key,next.profile)&&this.rawWrite(this.runKey,next.checkpoint)&&this.rawWrite(this.markerKey,null)){this.recovery=null;return true;}
      // 戻す書込みも失敗したら印を残し、再読込みでも控えを優先する。
      this.recover();return false;
    }
  }
  return{SaveStore};
});
