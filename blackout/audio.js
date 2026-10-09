(function(root){'use strict';
 const files=['footstep-concrete-0.ogg','footstep-concrete-1.ogg','footstep-wood.ogg','metal.ogg','body.ogg','wood.ogg','glass.ogg','explosion.ogg','rumble.ogg','radio.ogg','reload-rifle.wav','reload-pistol.wav','reload-shotgun.wav','pistol.ogg','rifle.ogg','shotgun.ogg','smg.ogg','empty.ogg','pickup.ogg','heal.ogg','flow.ogg','wind.ogg','ambience.ogg'];
 class Audio {
  constructor(scene,settings){this.scene=scene;this.settings=settings;this.pools=new Map();this.step=0;this.ambience=[];this.nodes=[];this.unlocked=false;}
  static preload(scene){for(const file of files)scene.load.audio(file.split('.')[0],'blackout/assets/audio/'+file);}
  unlock(){if(this.scene.sound.context?.state==='suspended')this.scene.sound.context.resume().catch(()=>{});this.scene.sound.unlock();this.unlocked=true;}
  play(key,volume=.5,rate=1,x=null,y=null){if(!this.unlocked||this.settings.muted||this.settings.volume===0||!this.scene.cache.audio.exists(key))return;
   let pool=this.pools.get(key);if(!pool){pool=Array.from({length:['rifle','pistol','smg'].includes(key)?6:3},()=>this.scene.sound.add(key));this.pools.set(key,pool);}const voice=pool.find(v=>!v.isPlaying);if(!voice)return;
   const p=this.scene.sim?.player;let attenuation=1,pan=0;if(p&&x!==null){const d=Math.hypot(x-p.x,y-p.y);attenuation=Math.max(0,1-d/1100);pan=Math.max(-1,Math.min(1,(x-p.x)/500));}
   if(attenuation<.02)return;voice.play({volume:Math.min(1,volume*this.settings.volume*attenuation),rate,pan});
  }
  event(e){switch(e.type){
   case 'shot':{const kind=e.weapon;const sounds={precision:['rifle',.8,.7],lmg:['rifle',.5,.9],rocket:['explosion',.65,1.3],launcher:['shotgun',.7,.75]};const [key,vol,rate]=sounds[kind]||[kind,kind==='shotgun'?.85:.43,1];this.play(key,e.enemy?.18:vol,rate,e.x,e.y);if(kind==='shotgun'&&!e.enemy)this.play('metal',.28,1.5);break;}
   case 'footstep':this.step++;this.play(this.step%2?'footstep-concrete-0':'footstep-concrete-1',.13,1+(this.step%3)*.035,e.x,e.y);break;
   case 'reload':this.play('reload-'+(e.weapon==='shotgun'?'shotgun':e.weapon==='pistol'?'pistol':'rifle'),.44);break;
   case 'empty':this.play('empty',.3);break;
   case 'swap':this.play('metal',.15,1.9);break;
   case 'action':this.play(e.action==='slide'?'wood':'body',.3,e.action==='vault'?.75:1.2,e.x,e.y);break;
   case 'meleeswing':this.play('wind',.16,e.heavy?2:3);break;
   case 'meleeimpact':this.play('body',.8,.75,e.x,e.y);this.play('metal',.25,1.3,e.x,e.y);break;
   case 'hit':this.play('body',.3,1.3,e.x,e.y);break;
   case 'armorhit':this.play('metal',.45,1.5,e.x,e.y);break;
   case 'explosion':this.play('explosion',.9,.9,e.x,e.y);this.play('rumble',.6,1,e.x,e.y);break;
   case 'destroy':this.play(e.kind==='glass'?'glass':e.kind==='crate'?'wood':'metal',.6,.9,e.x,e.y);break;
   case 'pickup':this.play(e.kind==='health'?'heal':'pickup',.4,1.1);break;
   case 'flow':this.play('flow',.3,1.2);break;
   case 'checkpoint':case 'unlock':this.play('pickup',.55,.8);break;
   case 'healstart':this.play('reload-pistol',.3,1.3);break;
   case 'radio':this.play('radio',.16,1.1);break;
   case 'damage':this.play('body',.5,.7);break;
   case 'throw':this.play('metal',.2,1.8);break;
  }}
  startAmbient(){this.stopAmbient();if(!this.unlocked||this.settings.muted)return;for(const [key,vol,rate] of [['wind',.035,.7],['ambience',.055,.7]]){if(!this.scene.cache.audio.exists(key))continue;const voice=this.scene.sound.add(key,{loop:true,volume:vol*this.settings.volume,rate});voice.play();this.ambience.push(voice);}if(!this.settings.music)return;
   const ctx=this.scene.sound.context;if(!ctx)return;const gain=ctx.createGain();gain.gain.value=.012*this.settings.volume;gain.connect(ctx.destination);this.nodes.push(gain);
   for(const f of [55,82.4069,110,164.8138]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=f;osc.connect(gain);osc.start();this.nodes.push(osc);}this.musicGain=gain;
  }
  pressure(value){if(this.musicGain){const ctx=this.scene.sound.context;this.musicGain.gain.setTargetAtTime((.009+.012*value)*this.settings.volume,ctx.currentTime,.5);}}
  stopAmbient(){for(const a of this.ambience)a.destroy();this.ambience=[];for(const n of this.nodes){if(n.stop)try{n.stop();}catch{}n.disconnect();}this.nodes=[];this.musicGain=null;}
  pause(){this.scene.sound.pauseAll();if(this.musicGain)this.musicGain.gain.value=0;}
  resume(){this.scene.sound.resumeAll();this.pressure(0);}
  destroy(){this.stopAmbient();for(const pool of this.pools.values())for(const a of pool)a.destroy();this.pools.clear();}
 }
 root.BPAudio=Audio;
})(globalThis);
