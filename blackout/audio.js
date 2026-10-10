(function(root){'use strict';
 const files=['footstep-concrete-0.ogg','footstep-concrete-1.ogg','footstep-wood.ogg','footstep-snow-0.ogg','footstep-snow-1.ogg','metal.ogg','body.ogg','wood.ogg','glass.ogg','explosion.ogg','rumble.ogg','boom.ogg','radio.ogg','reload-rifle.wav','reload-pistol.wav','reload-shotgun.wav','pistol.ogg','rifle.ogg','shotgun.ogg','smg.ogg','laser.ogg','laser-large.ogg','forcefield.ogg','door.ogg','bell.ogg','plate.ogg','punch.ogg','points.ogg','healthpack.ogg','empty.ogg','pickup.ogg','heal.ogg','flow.ogg','wind.ogg','ambience.ogg'];
 // Per-theme ambience bed (sample, volume, rate) layered under the drone score.
 const BEDS={city:[['wind',.035,.7],['ambience',.055,.7]],ruins:[['wind',.05,.55],['ambience',.05,.6]],snow:[['wind',.09,.45]],subway:[['ambience',.07,.45],['wind',.02,1.3]],desert:[['wind',.07,.85]],facility:[['ambience',.06,.9],['wind',.02,1.6]],range:[['wind',.035,.7],['ambience',.055,.7]]};
 class Audio {
  constructor(scene,settings){this.scene=scene;this.settings=settings;this.pools=new Map();this.step=0;this.ambience=[];this.nodes=[];this.unlocked=false;this.beatAt=0;this.breathAt=0;this.vitalsOn=false;this.lastWhiz=0;}
  static preload(scene){for(const file of files)scene.load.audio(file.split('.')[0],'blackout/assets/audio/'+file);}
  unlock(){if(this.scene.sound.context?.state==='suspended')this.scene.sound.context.resume().catch(()=>{});this.scene.sound.unlock();this.unlocked=true;}
  get live(){return this.unlocked&&!this.settings.muted&&this.settings.volume>0;}
  play(key,volume=.5,rate=1,x=null,y=null){if(!this.live||!this.scene.cache.audio.exists(key))return;
   let pool=this.pools.get(key);if(!pool){pool=Array.from({length:['rifle','pistol','smg','laser'].includes(key)?6:3},()=>this.scene.sound.add(key));this.pools.set(key,pool);}const voice=pool.find(v=>!v.isPlaying);if(!voice)return;
   const p=this.scene.sim?.player;let attenuation=1,pan=0;if(p&&x!==null){const d=Math.hypot(x-p.x,y-p.y);attenuation=Math.max(0,1-d/1100);pan=Math.max(-1,Math.min(1,(x-p.x)/500));}
   if(attenuation<.02)return;voice.play({volume:Math.min(1,volume*this.settings.volume*attenuation),rate,pan});
  }
  // Small Web Audio synth for interface feedback, heartbeat and breathing. Silent when the sound manager has no Web Audio context.
  tone(freq,dur=.12,{type='sine',vol=.08,to=null,attack=.004,delay=0}={}){const ctx=this.scene.sound.context;if(!this.live||!ctx)return;const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(to)o.frequency.exponentialRampToValueAtTime(Math.max(20,to),t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol*this.settings.volume,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+dur+.02);}
  noise(dur=.3,{vol=.05,freq=900,q=1,type='bandpass',attack=.02,delay=0,sweep=null}={}){const ctx=this.scene.sound.context;if(!this.live||!ctx)return;const t=ctx.currentTime+delay,len=Math.ceil(ctx.sampleRate*dur),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
   const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=buf;f.type=type;f.frequency.setValueAtTime(freq,t);if(sweep)f.frequency.exponentialRampToValueAtTime(sweep,t+dur);f.Q.value=q;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol*this.settings.volume,t+attack);g.gain.linearRampToValueAtTime(0,t+dur);src.connect(f).connect(g).connect(ctx.destination);src.start(t);src.stop(t+dur+.02);}
  ui(kind){switch(kind){case 'tick':this.tone(1400,.05,{type:'square',vol:.025});break;case 'total':this.tone(523,.18,{type:'triangle',vol:.07});this.tone(784,.32,{type:'triangle',vol:.07,delay:.09});break;
   case 'rank':[523,659,784,1046].forEach((f,i)=>this.tone(f,.42,{type:'triangle',vol:.08,delay:i*.11}));this.play('bell',.4,1.2);break;case 'medal':this.tone(880,.25,{type:'triangle',vol:.06});this.tone(1320,.35,{type:'sine',vol:.05,delay:.07});break;
   case 'buy':this.play('points',.5,1);this.tone(660,.12,{type:'square',vol:.03});this.tone(990,.2,{type:'square',vol:.03,delay:.08});break;case 'deny':this.tone(180,.18,{type:'square',vol:.04,to:120});break;case 'select':this.tone(740,.06,{type:'triangle',vol:.04});break;}}
  // Low health: heartbeat whose tempo rises as health falls, and laboured breathing, until a heal or pickup lifts health back up.
  vitals(health,active){const ctx=this.scene.sound.context;if(!active||health>=35||!ctx){this.vitalsOn=false;return;}const now=ctx.currentTime,k=Math.max(0,Math.min(1,health/35));if(!this.vitalsOn){this.vitalsOn=true;this.beatAt=now;this.breathAt=now+.2;}
   if(now>=this.beatAt){this.tone(62,.16,{vol:.22-.08*k,to:38,attack:.006});this.tone(55,.14,{vol:.14-.05*k,to:34,attack:.006,delay:.16});this.beatAt=now+.48+.55*k;}
   if(now>=this.breathAt){const len=1+.6*k;this.noise(len*.42,{vol:.045,freq:700,q:.7,attack:len*.3});this.noise(len*.55,{vol:.035,freq:420,q:.6,attack:.05,delay:len*.5});this.breathAt=now+len*1.15;}}
  event(e){switch(e.type){
   case 'shot':{const kind=e.weapon,sounds={precision:['rifle',.8,.7],marksman:['rifle',.7,.78],battle:['rifle',.62,.82],lmg:['rifle',.5,.9],rocket:['boom',.7,.9],launcher:['shotgun',.7,.75],thumper:['shotgun',.7,.7],magnum:['pistol',.75,.7],machinepistol:['smg',.43,1.15],sawedoff:['shotgun',.95,.86],autoshotgun:['shotgun',.75,1.08],pulse:['laser',.32,1],rail:['laser-large',.7,.85]};
     const [key,vol,rate]=sounds[kind]||[kind,kind==='shotgun'?.85:.43,1];this.play(key,e.enemy?.18:vol,rate,e.x,e.y);if((kind==='shotgun'||kind==='sawedoff')&&!e.enemy)this.play('metal',.28,1.5);if(kind==='rail'&&!e.enemy)this.play('rumble',.45,1.4);if(kind==='rocket'&&e.enemy)this.tone(400,.4,{type:'sawtooth',vol:.02,to:120});break;}
   case 'footstep':{this.step++;const snow=e.surface==='snow';this.play(snow?(this.step%2?'footstep-snow-0':'footstep-snow-1'):this.step%2?'footstep-concrete-0':'footstep-concrete-1',.13,1+(this.step%3)*.035,e.x,e.y);break;}
   case 'reload':this.play('reload-'+(['shotgun','autoshotgun','sawedoff','launcher','thumper'].includes(e.weapon)?'shotgun':BPWorld.weapons[e.weapon]?.sprite==='handgun'?'pistol':'rifle'),.44);break;
   case 'empty':this.play('empty',.3);break;
   case 'swap':case 'equip':this.play('metal',.15,1.9);break;
   case 'action':this.play(e.action==='slide'?'wood':'body',.3,e.action==='vault'?.75:1.2,e.x,e.y);break;
   case 'meleeswing':this.play('wind',.16,e.heavy?2:3);break;
   case 'meleeimpact':this.play('body',.8,.75,e.x,e.y);this.play(e.finish?'punch':'metal',e.finish?.5:.25,1.3,e.x,e.y);break;
   case 'hit':this.play('body',.3,1.3,e.x,e.y);if(e.player)this.tone(2300,.03,{type:'square',vol:.018});break;
   case 'kill':if(e.credits){this.tone(1180,.07,{type:'triangle',vol:.05});this.tone(1760+Math.min(8,e.combo)*90,.12,{type:'triangle',vol:.045,delay:.05});}if(e.boss){this.play('rumble',.8,.7);this.play('bell',.5,.8);}break;
   case 'armorhit':this.play('plate',.35,1.4,e.x,e.y);break;case 'shieldhit':this.play('forcefield',.28,1.6,e.x,e.y);break;
   case 'explosion':this.play('explosion',.9,.9,e.x,e.y);this.play('rumble',.6,1,e.x,e.y);{const p=this.scene.sim?.player;if(p&&Math.hypot(p.x-e.x,p.y-e.y)<200&&e.radius>60)this.tone(3600,1.1,{vol:.02,attack:.05});}break;
   case 'destroy':this.play(e.kind==='glass'?'glass':e.kind==='crate'?'wood':'metal',.6,.9,e.x,e.y);if(e.kind==='jammer'||e.kind==='generator')this.play('forcefield',.6,.6,e.x,e.y);break;
   case 'pickup':this.play(e.kind==='health'?'healthpack':e.kind==='health'?'heal':'pickup',.4,1.1);break;
   case 'weaponfound':[392,523,659,784].forEach((f,i)=>this.tone(f,.3,{type:'triangle',vol:.06,delay:i*.07}));this.play('pickup',.5,.8);break;
   case 'intel':case 'cache':this.play('points',.5,1.1);this.tone(988,.2,{type:'triangle',vol:.05});break;
   case 'objective':this.play('bell',.32,e.partial?1.4:1);this.tone(659,.25,{type:'triangle',vol:.05,delay:.05});break;
   case 'flow':this.play('flow',.3,1.2);break;
   case 'checkpoint':case 'unlock':this.play('pickup',.55,.8);break;
   case 'healstart':this.play('reload-pistol',.3,1.3);this.noise(.5,{vol:.03,freq:3000,type:'highpass'});break;
   case 'radio':this.play('radio',.16,1.1);break;
   case 'damage':this.play('body',.5,.7);break;case 'armorbreak':this.play('glass',.5,.7);this.play('plate',.5,.8);break;
   case 'throw':case 'plant':this.play('metal',.2,1.8);break;
   case 'whiz':{const now=this.scene.sound.context?.currentTime||0;if(now-this.lastWhiz>.09){this.lastWhiz=now;this.noise(.16,{vol:.05,freq:3200,sweep:900,q:3});}break;}
   case 'telegraph':if(e.enemy==='sniper'||e.enemy==='wraith'||e.enemy==='rocketeer')this.tone(e.enemy==='rocketeer'?520:1250,.5,{type:'sine',vol:.025,to:e.enemy==='rocketeer'?1040:1300},e.x,e.y);else if(e.enemy==='bomber')this.tone(1600,.07,{type:'square',vol:.04});break;
   case 'flash':this.play('explosion',.6,1.8,e.x,e.y);if(e.self)this.tone(3400,1.6,{vol:.035,attack:.02});break;
   case 'smoke':this.noise(1.1,{vol:.06,freq:1200,q:.5,attack:.05});break;
   case 'emp':this.tone(900,.8,{type:'sawtooth',vol:.04,to:50});this.play('forcefield',.7,.7,e.x,e.y);break;
   case 'decoy':case 'deploy':this.play('door',.4,1.4,e.x,e.y);break;case 'gate':this.play('door',.6,.8,e.x,e.y);break;
   case 'zap':this.tone(140,.25,{type:'sawtooth',vol:.06,to:90});this.play('forcefield',.4,2);break;
   case 'stomp':this.play('punch',.8,.6,e.x,e.y);this.play('rumble',.7,.8,e.x,e.y);break;
   case 'blink':case 'blinkin':this.play('forcefield',.3,2.2,e.x,e.y);break;
   case 'wave':this.tone(110,.7,{type:'sawtooth',vol:.04});this.tone(165,.7,{type:'sawtooth',vol:.03,delay:.05});break;
   case 'waveclear':case 'stage':this.play('bell',.3,1.1);break;
   case 'death':this.tone(220,1.4,{type:'sine',vol:.08,to:55});this.vitalsOn=false;break;
   case 'complete':[392,494,587,784].forEach((f,i)=>this.tone(f,.6,{type:'triangle',vol:.06,delay:i*.14}));break;
  }}
  startAmbient(theme='city'){this.stopAmbient();if(!this.unlocked||this.settings.muted)return;for(const [key,vol,rate] of BEDS[theme]||BEDS.city){if(!this.scene.cache.audio.exists(key))continue;const voice=this.scene.sound.add(key,{loop:true,volume:vol*this.settings.volume,rate});voice.play();this.ambience.push(voice);}if(!this.settings.music)return;
   const ctx=this.scene.sound.context;if(!ctx)return;const gain=ctx.createGain();gain.gain.value=.012*this.settings.volume;gain.connect(ctx.destination);this.nodes.push(gain);
   const root={city:55,ruins:51.9,snow:49,subway:46.2,desert:58.3,facility:61.7,range:55}[theme]||55;for(const f of [root,root*1.4983,root*2,root*2.9966]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=f;osc.connect(gain);osc.start();this.nodes.push(osc);}this.musicGain=gain;
  }
  pressure(value){if(this.musicGain){const ctx=this.scene.sound.context;this.musicGain.gain.setTargetAtTime((.009+.016*value)*this.settings.volume,ctx.currentTime,.5);}}
  stopAmbient(){for(const a of this.ambience)a.destroy();this.ambience=[];for(const n of this.nodes){if(n.stop)try{n.stop();}catch{}n.disconnect();}this.nodes=[];this.musicGain=null;}
  pause(){this.scene.sound.pauseAll();if(this.musicGain)this.musicGain.gain.value=0;this.vitalsOn=false;}
  resume(){this.scene.sound.resumeAll();this.pressure(0);}
  destroy(){this.stopAmbient();for(const pool of this.pools.values())for(const a of pool)a.destroy();this.pools.clear();}
 }
 root.BPAudio=Audio;
})(globalThis);
